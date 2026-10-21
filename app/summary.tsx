import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { allDoneText, answersFor, daySummary, isEvening, pendingHabits } from '../src/domain/checkin';
import { evaluate } from '../src/domain/evaluate';
import { DISCLAIMER } from '../src/domain/recommendations';
import { toISODate } from '../src/format';
import { useStore } from '../src/store';

/** Read-only view of today's habits (the check-in itself speaks its summary). */
export default function Summary() {
  const results = useStore((s) => s.results);
  const today = useStore((s) => s.today);
  const [now] = useState(() => new Date());

  if (!results) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Text>Nie ma jeszcze wyników badań.</Text>
        <Link href="/results">Wpisz wyniki</Link>
      </ScrollView>
    );
  }

  const habits = evaluate(results.values, results.sex, now, results.ranges).habits;
  const answers = answersFor(today, toISODate(now));
  const text =
    habits.length === 0
      ? 'Brak nawyków do sprawdzania – wszystkie podane wyniki są w normie.'
      : pendingHabits(habits, answers).length === 0
        ? allDoneText(habits, answers, isEvening(now))
        : daySummary(habits, answers, [], isEvening(now));

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
      <Text style={styles.text}>{text}</Text>
      <Link href="/" dismissTo>
        Wróć do ekranu głównego
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 24, gap: 16 },
  disclaimer: { backgroundColor: '#fff4e5', color: '#663c00', padding: 12, borderRadius: 6 },
  text: { fontSize: 18 },
});
