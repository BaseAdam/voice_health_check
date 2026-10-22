import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useReducer, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KEY_LABELS, useApiKeys } from '../src/api';
import {
  checkinReducer,
  currentHabit,
  initCheckin,
  type CheckinEvent,
  type Phase,
} from '../src/checkin';
import {
  allDoneText,
  answersFor,
  daySummary,
  isEvening,
  pendingHabits,
  REASK_TEXT,
  type YesNo,
} from '../src/domain/checkin';
import { evaluate } from '../src/domain/evaluate';
import { toISODate } from '../src/format';
import { speak, stopSpeaking, transcribe } from '../src/services/elevenlabs';
import { interpretAnswer } from '../src/services/llm';
import { useRecorder } from '../src/services/recorder';
import { useStore, type LabResults } from '../src/store';
import { ActionBar, Button, Disclaimer, colors, layout, text } from '../src/ui';

const REQUIRED_KEYS = ['elevenlabs', 'groq'] as const;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function statusLabel(phase: Phase, recording: boolean): string {
  if (phase === 'asking' || phase === 'confirming') return 'Mówię…';
  if (phase === 'listening') return recording ? 'Słucham…' : 'Twoja kolej';
  if (phase === 'transcribing' || phase === 'interpreting') return 'Myślę…';
  return '';
}

export default function Checkin() {
  const { keys } = useApiKeys();
  const results = useStore((s) => s.results);
  if (!keys) return null;

  const missing = REQUIRED_KEYS.filter((name) => !keys[name].value);
  if (missing.length > 0) {
    return (
      <View style={layout.screen}>
        <ScrollView contentContainerStyle={layout.content}>
          <Text style={text.body}>
            Do check-inu potrzebne są klucze API. Brakuje: {missing.map((n) => KEY_LABELS[n]).join(', ')}.
          </Text>
        </ScrollView>
        <ActionBar>
          <Button title="Przejdź do ustawień" onPress={() => router.push('/settings')} />
        </ActionBar>
      </View>
    );
  }
  if (!results) {
    return (
      <View style={layout.screen}>
        <ScrollView contentContainerStyle={layout.content}>
          <Text style={text.body}>Najpierw wpisz wyniki badań – z nich wynikają nawyki do sprawdzania.</Text>
        </ScrollView>
        <ActionBar>
          <Button title="Wpisz wyniki" onPress={() => router.push('/results')} />
        </ActionBar>
      </View>
    );
  }
  return <Session results={results} />;
}

function Session({ results }: { results: LabResults }) {
  const [now] = useState(() => new Date());
  const [allHabits] = useState(() => evaluate(results.values, results.sex, now, results.ranges).habits);
  const [state, dispatch] = useReducer(checkinReducer, null, () =>
    initCheckin(
      pendingHabits(allHabits, answersFor(useStore.getState().today, toISODate(now))),
      isEvening(now),
    ),
  );
  const today = useStore((s) => s.today);
  const setAnswer = useStore((s) => s.setAnswer);
  const recorder = useRecorder();

  const { phase, step, speech, audioUri, transcript } = state;
  const habit = currentHabit(state);
  const answers = answersFor(today, toISODate(now));
  const finalText =
    phase === 'summary'
      ? daySummary(allHabits, answers, state.skipped, state.evening)
      : phase === 'allDone'
        ? allDoneText(allHabits, answers, state.evening)
        : '';

  // Leaving the screen stops speech (the recorder hook cleans up on unmount).
  useFocusEffect(useCallback(() => stopSpeaking, []));

  // Side effects of entering a phase. Every transition bumps `step`, so this runs once per step;
  // results arriving after the step changed (e.g. "Pomiń") are dropped by `active` and by the reducer.
  useEffect(() => {
    let active = true;
    const send = (e: CheckinEvent) => {
      if (active) dispatch(e);
    };
    if (phase === 'asking' || phase === 'confirming') {
      speak(speech).then(
        () => send({ type: 'spoken', step }),
        (e) => send({ type: 'speakFailed', step, error: message(e) }),
      );
    } else if (phase === 'transcribing') {
      transcribe(audioUri).then(
        (text) => send({ type: 'transcribed', step, text }),
        (e) => send({ type: 'failed', step, error: message(e) }),
      );
    } else if (phase === 'interpreting' && habit) {
      interpretAnswer(habit.question, habit, transcript).then((r) => {
        if (!active) return;
        if (r.answer === 'unclear') return dispatch({ type: 'unclear', step });
        setAnswer(habit.category, r.answer);
        dispatch({ type: 'answered', step, answer: r.answer, detail: r.detail });
      });
    } else if (phase === 'summary' || phase === 'allDone') {
      speak(finalText).catch((e) => send({ type: 'speakFailed', step, error: message(e) }));
    }
    return () => {
      active = false;
    };
  }, [phase, step, speech, audioUri, transcript, habit, finalText, setAnswer]);

  async function talk() {
    stopSpeaking();
    const atStep = step;
    try {
      const uri = await recorder.start(); // resolves when recording stops
      if (uri) dispatch({ type: 'recorded', step: atStep, uri });
      else dispatch({ type: 'failed', step: atStep, error: 'Brak dostępu do mikrofonu – odpowiedz przyciskiem.' });
    } catch {
      dispatch({ type: 'failed', step: atStep, error: 'Nie udało się nagrać odpowiedzi.' });
    }
  }

  function answerManually(answer: YesNo) {
    if (!habit) return;
    setAnswer(habit.category, answer);
    dispatch({ type: 'answered', step, answer });
  }

  function skip() {
    stopSpeaking();
    if (recorder.isRecording) recorder.stop();
    dispatch({ type: 'skip' });
  }

  if (phase === 'intro') {
    return (
      <View style={layout.screen}>
        <ScrollView contentContainerStyle={layout.content}>
          <Text style={text.title}>Dzisiejszy check-in</Text>
          <Text style={text.body}>Pytania do odpowiedzi: {state.habits.length}</Text>
          <View style={layout.card}>
            {state.habits.map((h) => (
              <Text key={h.category} style={text.body}>
                • {h.label}
              </Text>
            ))}
          </View>
          <Text style={text.muted}>
            Odpowiadaj głosem: naciśnij „Mów”, powiedz odpowiedź i naciśnij „Gotowe”.
          </Text>
        </ScrollView>
        <ActionBar>
          <Button title="Zacznij" onPress={() => dispatch({ type: 'start' })} />
        </ActionBar>
      </View>
    );
  }

  if (phase === 'summary' || phase === 'allDone') {
    return (
      <View style={layout.screen}>
        <ScrollView contentContainerStyle={layout.content}>
          <Disclaimer />
          <Text style={text.title}>{phase === 'summary' ? 'Podsumowanie' : 'Na dziś gotowe'}</Text>
          <Text style={styles.question}>{finalText}</Text>
          {state.error ? <Text style={text.error}>{state.error}</Text> : null}
        </ScrollView>
        <ActionBar>
          <Button title="Wróć do ekranu głównego" onPress={() => router.dismissTo('/')} />
        </ActionBar>
      </View>
    );
  }

  return (
    <View style={layout.screen}>
      <ScrollView contentContainerStyle={layout.content}>
        <View style={styles.top}>
          <Text style={text.muted}>
            Nawyk {state.index + 1} z {state.habits.length}
          </Text>
          <Button title="Pomiń" variant="quiet" onPress={skip} />
        </View>
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {statusLabel(phase, recorder.isRecording)}
        </Text>
        <Text style={styles.question}>{habit?.question}</Text>
        {state.unclearCount > 0 && phase !== 'confirming' ? <Text style={text.muted}>{REASK_TEXT}</Text> : null}
        {transcript ? <Text style={text.body}>Rozpoznano: „{transcript}”</Text> : null}
        {phase === 'confirming' ? <Text style={styles.confirm}>{speech}</Text> : null}
        {state.error ? <Text style={text.error}>{state.error}</Text> : null}

        {phase === 'listening' ? (
          <TalkButton
            label={recorder.isRecording ? 'Gotowe' : 'Mów'}
            recording={recorder.isRecording}
            onPress={recorder.isRecording ? recorder.stop : talk}
          />
        ) : null}
        {phase === 'listening' && state.manual && !recorder.isRecording ? (
          <View style={styles.answers}>
            <AnswerButton label="Tak" onPress={() => answerManually('yes')} />
            <AnswerButton label="Nie" onPress={() => answerManually('no')} />
          </View>
        ) : null}
        {recorder.permissionDenied ? (
          <Button title="Otwórz ustawienia mikrofonu" variant="secondary" onPress={() => Linking.openSettings()} />
        ) : null}
      </ScrollView>
      {phase === 'confirming' ? (
        <ActionBar>
          <Button
            title="Dalej"
            onPress={() => {
              stopSpeaking();
              dispatch({ type: 'next' });
            }}
          />
        </ActionBar>
      ) : null}
    </View>
  );
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** The one bold element of the app: push-to-talk. Recording turns it red with a pulsing halo. */
function TalkButton({ label, recording, onPress }: { label: string; recording: boolean; onPress: () => void }) {
  const reduceMotion = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!recording || reduceMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, reduceMotion, pulse]);

  return (
    <View style={styles.talkArea}>
      {recording ? (
        <Animated.View
          style={[
            styles.halo,
            reduceMotion
              ? styles.haloStatic
              : {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }],
                },
          ]}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Gotowe – zakończ nagrywanie' : 'Mów – nagraj odpowiedź'}
        onPress={onPress}
        style={({ pressed }) => [styles.talk, recording && styles.talkRecording, pressed && styles.pressed]}
      >
        <Text style={styles.talkText}>{label}</Text>
      </Pressable>
    </View>
  );
}

function AnswerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.answer, pressed && styles.pressed]}
    >
      <Text style={styles.answerText}>{label}</Text>
    </Pressable>
  );
}

const TALK_SIZE = 200;

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { fontSize: 17, fontWeight: '600', color: colors.beet },
  question: { fontSize: 24, lineHeight: 31, fontWeight: '600', color: colors.ink },
  confirm: { fontSize: 17, lineHeight: 24, color: colors.leaf },
  talkArea: { alignSelf: 'center', width: TALK_SIZE, height: TALK_SIZE, marginVertical: 16 },
  halo: { position: 'absolute', inset: 0, borderRadius: TALK_SIZE / 2, backgroundColor: colors.signal },
  haloStatic: { opacity: 0.25, transform: [{ scale: 1.12 }] },
  talk: {
    width: TALK_SIZE,
    height: TALK_SIZE,
    borderRadius: TALK_SIZE / 2,
    backgroundColor: colors.beet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  talkRecording: { backgroundColor: colors.signal },
  talkText: { color: colors.onBeet, fontSize: 28, fontWeight: '700' },
  answers: { flexDirection: 'row', gap: 12 },
  answer: {
    flex: 1,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerText: { fontSize: 22, fontWeight: '600', color: colors.ink },
  pressed: { opacity: 0.8 },
});
