import { Link, router } from 'expo-router';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { evaluate, type Status } from '../src/domain/evaluate';
import { DISCLAIMER, REMINDER_TIME_LABELS } from '../src/domain/recommendations';
import { formatDate, formatDecimal, formatRange } from '../src/format';
import { useStore } from '../src/store';

export default function Plan() {
  const results = useStore((s) => s.results);

  if (!results) {
    return (
      <View style={styles.screen}>
        <Text>Nie ma jeszcze wyników badań.</Text>
        <Link href="/results">Wpisz wyniki</Link>
      </View>
    );
  }

  // The season rule uses today, not the test date: the check-in is daily.
  const { statuses, habits } = evaluate(results.values, results.sex, new Date(), results.ranges);
  const abnormal = statuses.filter((s) => s.status === 'low' || s.status === 'high');
  const withFoods = abnormal.filter((s) => s.recommendation?.habit);
  const names = (status: Status) =>
    statuses
      .filter((s) => s.status === status)
      .map((s) => s.marker.name)
      .join(', ');
  const normal = names('normal');
  const missing = names('missing');

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
      <Text style={styles.muted}>Wyniki z dnia {formatDate(results.testDate)}</Text>

      {abnormal.length === 0 ? (
        <Text style={styles.heading}>Wszystkie podane wyniki są w normie.</Text>
      ) : (
        <>
          <Text style={styles.heading}>Poza normą</Text>
          {abnormal.map((s) => (
            <View key={s.marker.id} style={styles.card}>
              <Text style={styles.bold}>
                {s.marker.name}: {formatDecimal(s.value!)} {s.marker.unit}
              </Text>
              <Text>
                {s.status === 'low' ? 'Poniżej' : 'Powyżej'} normy ({formatRange(s.range, s.marker.unit)})
              </Text>
              <Text>{s.recommendation?.explanation}</Text>
            </View>
          ))}
        </>
      )}

      {withFoods.length > 0 ? (
        <>
          <Text style={styles.heading}>Co jeść</Text>
          {withFoods.map((s) => (
            <Text key={s.marker.id}>
              <Text style={styles.bold}>{s.marker.name}: </Text>
              {s.recommendation?.habit?.foods.join(', ')}
            </Text>
          ))}
        </>
      ) : null}

      {habits.length > 0 ? (
        <>
          <Text style={styles.heading}>Codziennie sprawdzimy</Text>
          {habits.map((h) => (
            <View key={h.category} style={styles.card}>
              <Text>{h.question}</Text>
              <Text style={styles.muted}>Pora: {REMINDER_TIME_LABELS[h.time]}</Text>
              {h.note ? <Text style={styles.note}>{h.note}</Text> : null}
            </View>
          ))}
        </>
      ) : null}

      {normal ? <Text>W normie: {normal}</Text> : null}
      {missing ? <Text style={styles.muted}>Brak wyniku: {missing}</Text> : null}

      {/* TTS comes in the next step. */}
      <Button title="Odsłuchaj" disabled onPress={() => {}} />
      {habits.length > 0 ? (
        <Button title="Rozpocznij check-in" onPress={() => router.push('/checkin')} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 24, gap: 14 },
  disclaimer: { backgroundColor: '#fff4e5', color: '#663c00', padding: 12, borderRadius: 6 },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 8 },
  card: { gap: 4, padding: 12, borderRadius: 6, backgroundColor: '#f2f2f2' },
  bold: { fontWeight: '600' },
  muted: { color: '#666' },
  note: { color: '#663c00' },
});
