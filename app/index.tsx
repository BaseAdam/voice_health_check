import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { answersFor, type YesNo } from '../src/domain/checkin';
import { evaluate } from '../src/domain/evaluate';
import { planReminders } from '../src/domain/reminders';
import { formatWhen, toISODate } from '../src/format';
import { useNotificationPermission } from '../src/reminders';
import { useStore } from '../src/store';

const MARKS: Record<YesNo, { mark: string; spoken: string }> = {
  yes: { mark: '✓', spoken: 'zrobione' },
  no: { mark: '✗', spoken: 'jeszcze nie' },
};

/** Current time, refreshed when the screen regains focus or the app comes back (e.g. the next morning). */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(new Date()));
      return () => sub.remove();
    }, []),
  );
  return now;
}

export default function Today() {
  const results = useStore((s) => s.results);
  const today = useStore((s) => s.today);
  const reminders = useStore((s) => s.reminders);
  const { granted } = useNotificationPermission();
  const now = useNow();

  if (!results) {
    return (
      <View style={styles.screen}>
        <Text>Wpisz wyniki badań – na ich podstawie aplikacja ułoży codzienne nawyki.</Text>
        <Button title="Wpisz wyniki" onPress={() => router.push('/results')} />
        <Link href="/settings">Ustawienia</Link>
      </View>
    );
  }

  const habits = evaluate(results.values, results.sex, now, results.ranges).habits;
  const answers = answersFor(today, toISODate(now));
  const next = planReminders(habits, answers, reminders, now)[0];

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.heading}>Nawyki na dziś</Text>
      {habits.length === 0 ? (
        <Text>Wszystkie podane wyniki są w normie – nie ma nawyków do sprawdzania.</Text>
      ) : (
        habits.map((h) => {
          const answer = answers[h.category];
          return (
            <View
              key={h.category}
              style={styles.row}
              accessible
              accessibilityLabel={`${h.label}: ${answer ? MARKS[answer].spoken : 'jeszcze nie pytano'}`}
            >
              <Text style={styles.mark}>{answer ? MARKS[answer].mark : '–'}</Text>
              <Text style={styles.label}>{h.label}</Text>
              {answer ? null : <Text style={styles.muted}>jeszcze nie pytano</Text>}
            </View>
          );
        })
      )}

      {habits.length > 0 && granted === false ? (
        <Text style={styles.muted}>
          Przypomnienia są wyłączone. <Link href="/settings">Włącz w ustawieniach</Link>
        </Text>
      ) : null}
      {habits.length > 0 && granted ? (
        <Text style={styles.muted}>
          {next ? `Następne przypomnienie: ${formatWhen(next.date, now)}` : 'Brak zaplanowanych przypomnień.'}
        </Text>
      ) : null}
      {habits.length > 0 ? <Button title="Check-in teraz" onPress={() => router.push('/checkin')} /> : null}

      <Link href="/plan">Twój plan</Link>
      <Link href="/results">Edytuj wyniki</Link>
      <Link href="/summary">Podsumowanie dnia</Link>
      <Link href="/settings">Ustawienia</Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 24, gap: 16 },
  heading: { fontSize: 18, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 6, backgroundColor: '#f2f2f2' },
  mark: { fontSize: 18, width: 20, textAlign: 'center' },
  label: { flex: 1 },
  muted: { color: '#666' },
});
