import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { Button, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { DISCLAIMER } from '../src/domain/recommendations';
import { toISODate } from '../src/format';
import { speak, stopSpeaking, transcribe } from '../src/services/elevenlabs';
import { interpretAnswer } from '../src/services/llm';
import { useRecorder } from '../src/services/recorder';
import { useStore, type LabResults } from '../src/store';

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
      <View style={styles.screen}>
        <Text>
          Do check-inu potrzebne są klucze API. Brakuje: {missing.map((n) => KEY_LABELS[n]).join(', ')}.
        </Text>
        <Link href="/settings">Przejdź do ustawień</Link>
      </View>
    );
  }
  if (!results) {
    return (
      <View style={styles.screen}>
        <Text>Najpierw wpisz wyniki badań – z nich wynikają nawyki do sprawdzania.</Text>
        <Link href="/results">Wpisz wyniki</Link>
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
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.title}>Dzisiejszy check-in</Text>
        <Text>Pytania do odpowiedzi: {state.habits.length}</Text>
        {state.habits.map((h) => (
          <Text key={h.category}>• {h.label}</Text>
        ))}
        <Text style={styles.muted}>
          Odpowiadaj głosem: naciśnij „Mów”, powiedz odpowiedź i naciśnij „Gotowe”.
        </Text>
        <BigButton label="Zacznij" onPress={() => dispatch({ type: 'start' })} />
      </ScrollView>
    );
  }

  if (phase === 'summary' || phase === 'allDone') {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
        <Text style={styles.title}>{phase === 'summary' ? 'Podsumowanie' : 'Na dziś gotowe'}</Text>
        <Text style={styles.question}>{finalText}</Text>
        {state.error ? <Text style={styles.error}>{state.error}</Text> : null}
        <Link href="/" dismissTo>
          Wróć do ekranu głównego
        </Link>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.muted}>
        Nawyk {state.index + 1} z {state.habits.length}
      </Text>
      <Text style={styles.status} accessibilityLiveRegion="polite">
        {statusLabel(phase, recorder.isRecording)}
      </Text>
      <Text style={styles.question}>{habit?.question}</Text>
      {state.unclearCount > 0 && phase !== 'confirming' ? <Text style={styles.muted}>{REASK_TEXT}</Text> : null}
      {transcript ? <Text>Rozpoznano: „{transcript}”</Text> : null}
      {phase === 'confirming' ? <Text style={styles.confirm}>{speech}</Text> : null}
      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}

      {phase === 'listening' ? (
        <BigButton
          label={recorder.isRecording ? 'Gotowe' : 'Mów'}
          active={recorder.isRecording}
          onPress={recorder.isRecording ? recorder.stop : talk}
        />
      ) : null}
      {phase === 'listening' && state.manual && !recorder.isRecording ? (
        <View style={styles.row}>
          <View style={styles.grow}>
            <Button title="Tak" onPress={() => answerManually('yes')} />
          </View>
          <View style={styles.grow}>
            <Button title="Nie" onPress={() => answerManually('no')} />
          </View>
        </View>
      ) : null}
      {recorder.permissionDenied ? (
        <Button title="Otwórz ustawienia mikrofonu" onPress={() => Linking.openSettings()} />
      ) : null}
      {phase === 'confirming' ? (
        <Button
          title="Dalej"
          onPress={() => {
            stopSpeaking();
            dispatch({ type: 'next' });
          }}
        />
      ) : null}
      <Button title="Pomiń" onPress={skip} />
    </ScrollView>
  );
}

function BigButton({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.big, active && styles.bigActive, pressed && styles.bigPressed]}
    >
      <Text style={styles.bigText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '600' },
  status: { fontSize: 16, fontWeight: '600', color: '#1a5fb4' },
  question: { fontSize: 20 },
  confirm: { fontSize: 17, color: '#1a7f37' },
  muted: { color: '#666' },
  error: { color: '#c62828' },
  disclaimer: { backgroundColor: '#fff4e5', color: '#663c00', padding: 12, borderRadius: 6 },
  row: { flexDirection: 'row', gap: 12 },
  grow: { flex: 1 },
  big: {
    alignSelf: 'center',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#1a5fb4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigActive: { backgroundColor: '#c62828' },
  bigPressed: { opacity: 0.8 },
  bigText: { color: 'white', fontSize: 24, fontWeight: '600' },
});
