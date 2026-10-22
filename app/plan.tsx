import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApiKeys } from '../src/api';
import { evaluate, type Status } from '../src/domain/evaluate';
import { REMINDER_TIME_LABELS } from '../src/domain/recommendations';
import { planSpeech } from '../src/domain/speech';
import { formatDate, formatDecimal, formatRange } from '../src/format';
import { useNotificationPermission } from '../src/reminders';
import { speak, stopSpeaking } from '../src/services/elevenlabs';
import { useStore } from '../src/store';
import { ActionBar, Button, Disclaimer, colors, layout, text } from '../src/ui';

export default function Plan() {
  const results = useStore((s) => s.results);
  const remindersAsked = useStore((s) => s.remindersAsked);
  const setRemindersAsked = useStore((s) => s.setRemindersAsked);
  const notifications = useNotificationPermission();
  const { keys } = useApiKeys();
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState('');
  // Leaving the screen stops the reading.
  useFocusEffect(useCallback(() => stopSpeaking, []));

  if (!results) {
    return (
      <View style={layout.screen}>
        <ScrollView contentContainerStyle={layout.content}>
          <Text style={text.body}>Nie ma jeszcze wyników badań.</Text>
        </ScrollView>
        <ActionBar>
          <Button title="Wpisz wyniki" onPress={() => router.push('/results')} />
        </ActionBar>
      </View>
    );
  }

  // The season rule uses today, not the test date: the check-in is daily.
  const evaluation = evaluate(results.values, results.sex, new Date(), results.ranges);
  const { statuses, habits } = evaluation;
  const abnormal = statuses.filter((s) => s.status === 'low' || s.status === 'high');
  const withFoods = abnormal.filter((s) => s.recommendation?.habit);
  const names = (status: Status) =>
    statuses
      .filter((s) => s.status === status)
      .map((s) => s.marker.name)
      .join(', ');
  const normal = names('normal');
  const missing = names('missing');
  const canListen = keys !== null && keys.elevenlabs.value !== '';

  async function listen() {
    if (speaking) return stopSpeaking();
    setSpeechError('');
    setSpeaking(true);
    try {
      await speak(planSpeech(evaluation));
    } catch (e) {
      setSpeechError(e instanceof Error ? e.message : String(e));
    } finally {
      setSpeaking(false);
    }
  }

  return (
    <View style={layout.screen}>
      <ScrollView contentContainerStyle={layout.content}>
        <Disclaimer />
        <Text style={text.muted}>Wyniki z dnia {formatDate(results.testDate)}</Text>

        {abnormal.length === 0 ? (
          <Text style={text.heading}>Wszystkie podane wyniki są w normie.</Text>
        ) : (
          <>
            <Text style={text.heading}>Poza normą</Text>
            {abnormal.map((s) => (
              <View key={s.marker.id} style={layout.card}>
                <Text style={text.heading}>
                  {s.marker.name}: {formatDecimal(s.value!)} {s.marker.unit}
                </Text>
                <Text style={text.muted}>
                  {s.status === 'low' ? 'Poniżej' : 'Powyżej'} normy ({formatRange(s.range, s.marker.unit)})
                </Text>
                <Text style={text.body}>{s.recommendation?.explanation}</Text>
              </View>
            ))}
          </>
        )}

        {withFoods.length > 0 ? (
          <>
            <Text style={text.heading}>Co jeść</Text>
            {withFoods.map((s) => (
              <Text key={s.marker.id} style={text.body}>
                <Text style={styles.bold}>{s.marker.name}: </Text>
                {s.recommendation?.habit?.foods.join(', ')}
              </Text>
            ))}
          </>
        ) : null}

        {habits.length > 0 ? (
          <>
            <Text style={text.heading}>Codziennie sprawdzimy</Text>
            {habits.map((h) => (
              <View key={h.category} style={layout.card}>
                <Text style={text.body}>{h.question}</Text>
                <Text style={text.muted}>Pora: {REMINDER_TIME_LABELS[h.time]}</Text>
                {h.note ? <Text style={styles.note}>{h.note}</Text> : null}
              </View>
            ))}
          </>
        ) : null}

        {/* Asked once, after the plan exists – not at app start. */}
        {habits.length > 0 && !remindersAsked && notifications.granted === false ? (
          <View style={[layout.card, styles.ask]}>
            <Text style={text.heading}>Włączyć przypomnienia w ciągu dnia?</Text>
            <Text style={text.body}>
              Rano, przed obiadem i wieczorem przypomnimy o nawyku, którego jeszcze nie odhaczono. Godziny
              zmienisz w ustawieniach.
            </Text>
            <Button
              title="Włącz przypomnienia"
              variant="secondary"
              onPress={() => {
                setRemindersAsked();
                notifications.enable();
              }}
            />
            <Button title="Nie teraz" variant="quiet" onPress={setRemindersAsked} />
          </View>
        ) : null}

        {normal ? <Text style={text.body}>W normie: {normal}</Text> : null}
        {missing ? <Text style={text.muted}>Brak wyniku: {missing}</Text> : null}

        {keys && !canListen ? (
          <View style={layout.card}>
            <Text style={text.body}>Do odsłuchu potrzebny jest klucz ElevenLabs.</Text>
            <Button title="Przejdź do ustawień" variant="quiet" onPress={() => router.push('/settings')} />
          </View>
        ) : null}
        {speechError ? <Text style={text.error}>{speechError}</Text> : null}
      </ScrollView>

      {canListen || habits.length > 0 ? (
        <ActionBar>
          {canListen ? (
            <Button title={speaking ? 'Zatrzymaj' : 'Odsłuchaj plan'} variant="secondary" onPress={listen} />
          ) : null}
          {habits.length > 0 ? (
            <Button title="Rozpocznij check-in" onPress={() => router.push('/checkin')} />
          ) : null}
        </ActionBar>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '600' },
  note: { fontSize: 15, lineHeight: 21, color: colors.noteInk },
  ask: { gap: 12 },
});
