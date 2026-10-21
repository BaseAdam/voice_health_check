import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CustomRanges, Results } from '../src/domain/evaluate';
import { MARKERS, type Marker, type MarkerId, type Range, type Sex } from '../src/domain/markers';
import { formatDecimal, isValidTestDate, parseDecimal, toISODate } from '../src/format';
import { useStore } from '../src/store';

type RangeDraft = { min: string; max: string };

const SEX_LABELS: Record<Sex, string> = { female: 'Kobieta', male: 'Mężczyzna' };
const EMPTY_RANGE: RangeDraft = { min: '', max: '' };
// Low vitamin D, low ferritin, high LDL; the rest within the female defaults.
const DEMO_VALUES: Partial<Record<MarkerId, string>> = {
  vitD: '18',
  ferritin: '10',
  hemoglobin: '13,5',
  b12: '450',
  ldl: '145',
  glucose: '88',
};

const toText = (n: number | undefined) => (n === undefined ? '' : formatDecimal(n));
const toDraft = (r: Range): RangeDraft => ({ min: toText(r.min), max: toText(r.max) });

/** Empty is fine (= no value / no bound). */
function numberError(text: string): string | undefined {
  const n = parseDecimal(text);
  return n === undefined || n > 0 ? undefined : 'Podaj liczbę większą od zera';
}

function rangeError({ min, max }: RangeDraft): string | undefined {
  const error = numberError(min) ?? numberError(max);
  if (error) return error;
  const lo = parseDecimal(min);
  const hi = parseDecimal(max);
  return lo !== undefined && hi !== undefined && lo >= hi ? 'Min musi być mniejsze niż max' : undefined;
}

export default function ResultsScreen() {
  const saved = useStore((s) => s.results);
  const setResults = useStore((s) => s.setResults);

  const [sex, setSex] = useState<Sex | null>(saved?.sex ?? null);
  const [values, setValues] = useState<Partial<Record<MarkerId, string>>>(() =>
    Object.fromEntries(MARKERS.map((m) => [m.id, toText(saved?.values[m.id])])),
  );
  // Only edited ranges; the others follow the default for the selected sex.
  const [ranges, setRanges] = useState<Partial<Record<MarkerId, RangeDraft>>>(() =>
    Object.fromEntries(Object.entries(saved?.ranges ?? {}).map(([id, r]) => [id, toDraft(r)])),
  );
  const [testDate, setTestDate] = useState(saved?.testDate ?? toISODate(new Date()));

  const shownRange = (m: Marker) => ranges[m.id] ?? (sex ? toDraft(m.range[sex]) : EMPTY_RANGE);
  const markerError = (m: Marker) => {
    const edited = ranges[m.id];
    return numberError(values[m.id] ?? '') ?? (edited ? rangeError(edited) : undefined);
  };
  const dateError = isValidTestDate(testDate, new Date())
    ? undefined
    : 'Podaj datę w formacie RRRR-MM-DD, nie późniejszą niż dziś';

  const blocker = !sex
    ? 'Wybierz płeć.'
    : !MARKERS.some((m) => parseDecimal(values[m.id] ?? '') !== undefined)
      ? 'Wpisz co najmniej jeden wynik.'
      : dateError || MARKERS.some(markerError)
        ? 'Popraw zaznaczone pola.'
        : undefined;

  function editRange(m: Marker, bound: keyof RangeDraft, text: string) {
    setRanges((r) => ({ ...r, [m.id]: { ...(r[m.id] ?? shownRange(m)), [bound]: text } }));
  }

  function resetRange(id: MarkerId) {
    setRanges((r) => {
      const next = { ...r };
      delete next[id];
      return next;
    });
  }

  function loadDemo() {
    setSex('female');
    setValues(DEMO_VALUES);
    setRanges({});
    setTestDate(toISODate(new Date()));
  }

  function save() {
    if (!sex || blocker) return;
    const parsedValues: Results = {};
    const customRanges: CustomRanges = {};
    for (const m of MARKERS) {
      const value = parseDecimal(values[m.id] ?? '');
      if (value !== undefined) parsedValues[m.id] = value;
      const draft = ranges[m.id];
      const range = draft && { min: parseDecimal(draft.min), max: parseDecimal(draft.max) };
      // Store only real overrides, so a later sex change still picks the right default.
      if (range && (range.min !== m.range[sex].min || range.max !== m.range[sex].max)) {
        customRanges[m.id] = range;
      }
    }
    setResults({ sex, values: parsedValues, ranges: customRanges, testDate });
    router.replace('/plan');
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Button title="Wczytaj dane demo" onPress={loadDemo} />

      <View style={styles.field}>
        <Text style={styles.label}>Płeć</Text>
        <View style={styles.row} accessibilityRole="radiogroup">
          {(['female', 'male'] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSex(s)}
              accessibilityRole="radio"
              accessibilityState={{ checked: sex === s }}
              style={[styles.chip, sex === s && styles.chipActive]}
            >
              <Text style={sex === s ? styles.chipActiveText : undefined}>{SEX_LABELS[s]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Data badania</Text>
        <TextInput
          accessibilityLabel="Data badania"
          value={testDate}
          onChangeText={setTestDate}
          placeholder="RRRR-MM-DD"
          keyboardType="numbers-and-punctuation"
          style={styles.input}
        />
        {dateError ? <Text style={styles.error}>{dateError}</Text> : null}
      </View>

      {MARKERS.map((m) => {
        const range = shownRange(m);
        const error = markerError(m);
        return (
          <View key={m.id} style={styles.field}>
            <Text style={styles.label}>{m.name}</Text>
            <View style={styles.row}>
              <TextInput
                accessibilityLabel={`${m.name}, wynik w ${m.unit}`}
                value={values[m.id]}
                onChangeText={(text) => setValues((v) => ({ ...v, [m.id]: text }))}
                placeholder="wynik"
                keyboardType="decimal-pad"
                style={[styles.input, styles.grow]}
              />
              <Text>{m.unit}</Text>
            </View>
            <View style={styles.row}>
              <Text>Norma:</Text>
              <TextInput
                accessibilityLabel={`${m.name}, dolna granica normy`}
                value={range.min}
                onChangeText={(text) => editRange(m, 'min', text)}
                placeholder="min"
                keyboardType="decimal-pad"
                style={[styles.input, styles.bound]}
              />
              <Text>–</Text>
              <TextInput
                accessibilityLabel={`${m.name}, górna granica normy`}
                value={range.max}
                onChangeText={(text) => editRange(m, 'max', text)}
                placeholder="max"
                keyboardType="decimal-pad"
                style={[styles.input, styles.bound]}
              />
            </View>
            {ranges[m.id] ? (
              <Button title="Przywróć domyślną normę" onPress={() => resetRange(m.id)} />
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        );
      })}

      <Text style={styles.muted}>
        Domyślne normy dotyczą dorosłych i różnią się między laboratoriami – wpisz normę z wyniku
        badania.
      </Text>
      <Button title="Zapisz i pokaż plan" onPress={save} disabled={blocker !== undefined} />
      {blocker ? <Text style={styles.muted}>{blocker}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 24, gap: 20 },
  field: { gap: 6 },
  label: { fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10 },
  grow: { flex: 1 },
  bound: { width: 80 },
  chip: { borderWidth: 1, borderColor: '#999', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  chipActive: { backgroundColor: '#1a5fb4', borderColor: '#1a5fb4' },
  chipActiveText: { color: 'white' },
  error: { color: '#c62828' },
  muted: { color: '#666' },
});
