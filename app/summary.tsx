import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { allDoneText, answersFor, daySummary, isEvening, pendingHabits } from '../src/domain/checkin';
import { evaluate } from '../src/domain/evaluate';
import { toISODate } from '../src/format';
import { useStore } from '../src/store';
import { ActionBar, Button, Disclaimer, layout, text } from '../src/ui';

/** Read-only view of today's habits (the check-in itself speaks its summary). */
export default function Summary() {
  const results = useStore((s) => s.results);
  const today = useStore((s) => s.today);
  const [now] = useState(() => new Date());

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

  const habits = evaluate(results.values, results.sex, now, results.ranges).habits;
  const answers = answersFor(today, toISODate(now));
  const summary =
    habits.length === 0
      ? 'Brak nawyków do sprawdzania – wszystkie podane wyniki są w normie.'
      : pendingHabits(habits, answers).length === 0
        ? allDoneText(habits, answers, isEvening(now))
        : daySummary(habits, answers, [], isEvening(now));

  return (
    <View style={layout.screen}>
      <ScrollView contentContainerStyle={layout.content}>
        <Disclaimer />
        <Text style={styles.summary}>{summary}</Text>
      </ScrollView>
      <ActionBar>
        <Button title="Wróć do ekranu głównego" onPress={() => router.dismissTo('/')} />
      </ActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { ...text.body, fontSize: 20, lineHeight: 28 },
});
