import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  KEY_LABELS,
  deleteKey,
  saveKey,
  testElevenLabs,
  testGroq,
  useApiKeys,
  type KeyName,
  type KeySource,
  type TestResult,
} from '../src/api';
import { REMINDER_TIME_LABELS, type ReminderTime } from '../src/domain/recommendations';
import { REMINDER_SLOTS, parseTime } from '../src/domain/reminders';
import { scheduleTestReminder, useNotificationPermission } from '../src/reminders';
import { speak, transcribe } from '../src/services/elevenlabs';
import { MAX_RECORDING_SECONDS, useRecorder } from '../src/services/recorder';
import { useStore } from '../src/store';
import { Button, colors, layout, text } from '../src/ui';

type Provider = 'elevenlabs' | 'groq';

const SOURCE_LABELS: Record<KeySource, string> = {
  settings: 'ustawienia',
  env: '.env',
  default: 'domyślny',
  none: 'brak',
};
const SECRET: Record<KeyName, boolean> = { elevenlabs: true, groq: true, voiceId: false };
const EMPTY_DRAFTS: Record<KeyName, string> = { elevenlabs: '', groq: '', voiceId: '' };

const mask = (value: string) => '••••••••' + value.slice(-4);

export default function Settings() {
  const { keys, reload } = useApiKeys();
  const [drafts, setDrafts] = useState(EMPTY_DRAFTS);
  const [saveStatus, setSaveStatus] = useState('');
  const [tests, setTests] = useState<Partial<Record<Provider, TestResult | 'pending'>>>({});
  const recorder = useRecorder();
  const [voicePhase, setVoicePhase] = useState<'idle' | 'transcribing' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');

  if (!keys) return null;

  // Pasted keys often carry trailing whitespace/newlines.
  const filled = (Object.keys(drafts) as KeyName[]).filter((name) => drafts[name].trim());
  const draftOrCurrent = (name: KeyName) => drafts[name].trim() || keys[name].value;

  async function save() {
    try {
      await Promise.all(filled.map((name) => saveKey(name, drafts[name].trim())));
      setDrafts(EMPTY_DRAFTS);
      setSaveStatus('Zapisano');
    } catch {
      setSaveStatus('Nie udało się zapisać');
    }
    reload();
  }

  async function remove(name: KeyName) {
    await deleteKey(name).catch(() => setSaveStatus('Nie udało się usunąć'));
    reload();
  }

  async function test(provider: Provider) {
    setTests((t) => ({ ...t, [provider]: 'pending' }));
    const result =
      provider === 'elevenlabs'
        ? await testElevenLabs(draftOrCurrent('elevenlabs'), draftOrCurrent('voiceId'))
        : await testGroq(draftOrCurrent('groq'));
    setTests((t) => ({ ...t, [provider]: result }));
  }

  /** Record → transcribe → read back. Uses saved keys. */
  async function voiceTest() {
    setVoiceError('');
    setTranscript('');
    try {
      const uri = await recorder.start(); // resolves when recording stops
      if (!uri) return;
      setVoicePhase('transcribing');
      const recognized = await transcribe(uri);
      setTranscript(recognized);
      setVoicePhase('speaking');
      await speak(recognized);
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : String(e));
    } finally {
      setVoicePhase('idle');
    }
  }

  const field = (name: KeyName) => {
    const { value, source } = keys[name];
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{KEY_LABELS[name]}</Text>
        <Text style={text.muted}>
          Aktualny: {value ? (SECRET[name] ? mask(value) : value) : '—'} (źródło: {SOURCE_LABELS[source]})
        </Text>
        <TextInput
          accessibilityLabel={KEY_LABELS[name]}
          value={drafts[name]}
          onChangeText={(input) => setDrafts((d) => ({ ...d, [name]: input }))}
          placeholder={SECRET[name] ? 'Wklej nowy klucz' : 'Wpisz nowe ID głosu'}
          placeholderTextColor={colors.muted}
          secureTextEntry={SECRET[name]}
          autoCapitalize="none"
          autoCorrect={false}
          style={layout.input}
        />
        {source === 'settings' && <Button title="Usuń" variant="danger" onPress={() => remove(name)} />}
      </View>
    );
  };

  const testButton = (provider: Provider) => {
    const result = tests[provider];
    return (
      <View style={styles.field}>
        <Button
          title="Testuj połączenie"
          variant="secondary"
          onPress={() => test(provider)}
          disabled={result === 'pending'}
        />
        {result === 'pending' && <Text style={text.muted}>Testuję…</Text>}
        {result && result !== 'pending' && (
          <Text style={result.ok ? styles.ok : text.error}>{result.message}</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={text.heading}>ElevenLabs</Text>
        {field('elevenlabs')}
        {field('voiceId')}
        {testButton('elevenlabs')}
      </View>

      <View style={styles.section}>
        <Text style={text.heading}>Groq</Text>
        {field('groq')}
        {testButton('groq')}
      </View>

      <Button title="Zapisz klucze" onPress={save} disabled={filled.length === 0} />
      {saveStatus !== '' && <Text style={text.muted}>{saveStatus}</Text>}

      <View style={styles.section}>
        <Text style={text.heading}>Test głosu</Text>
        <Text style={text.muted}>
          Nagraj krótkie zdanie (max {MAX_RECORDING_SECONDS} s) – aplikacja je rozpozna i przeczyta na
          głos. Używa zapisanych kluczy.
        </Text>
        {recorder.isRecording ? (
          <Button title="Zatrzymaj nagrywanie" variant="secondary" onPress={recorder.stop} />
        ) : (
          <Button title="Nagraj" variant="secondary" onPress={voiceTest} disabled={voicePhase !== 'idle'} />
        )}
        {recorder.isRecording ? <Text style={styles.recording}>Nagrywam…</Text> : null}
        {voicePhase === 'transcribing' ? <Text style={text.muted}>Rozpoznaję…</Text> : null}
        {transcript ? <Text style={text.body}>Rozpoznano: {transcript}</Text> : null}
        {voicePhase === 'speaking' ? <Text style={text.muted}>Czytam na głos…</Text> : null}
        {voiceError ? <Text style={text.error}>{voiceError}</Text> : null}
        {recorder.permissionDenied ? (
          <>
            <Text style={text.error}>Brak dostępu do mikrofonu. Włącz go w ustawieniach systemu.</Text>
            <Button title="Otwórz ustawienia" variant="secondary" onPress={() => Linking.openSettings()} />
          </>
        ) : null}
      </View>

      <Reminders />

      <Text style={text.muted}>
        Klucze są zapisywane w bezpiecznym magazynie urządzenia. Bez klucza w ustawieniach aplikacja
        używa wartości z .env (tylko do developmentu).
      </Text>
    </ScrollView>
  );
}

function Reminders() {
  const reminders = useStore((s) => s.reminders);
  const setReminder = useStore((s) => s.setReminder);
  const { granted, enable } = useNotificationPermission();
  // Drafts let the user type freely; only a valid HH:MM reaches the store (and reschedules).
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(REMINDER_SLOTS.map((slot) => [slot, reminders[slot].time])) as Record<ReminderTime, string>,
  );
  const [denied, setDenied] = useState(false);
  const [testStatus, setTestStatus] = useState('');
  const invalid = REMINDER_SLOTS.some((slot) => !parseTime(drafts[slot]));

  function editTime(slot: ReminderTime, input: string) {
    setDrafts((d) => ({ ...d, [slot]: input }));
    if (parseTime(input)) setReminder(slot, { time: input.trim() });
  }

  async function test() {
    const ok = await scheduleTestReminder();
    setDenied(!ok);
    setTestStatus(ok ? 'Przypomnienie pojawi się za 10 s.' : '');
  }

  return (
    <View style={styles.section}>
      <Text style={text.heading}>Przypomnienia</Text>
      {granted === false ? (
        <Button
          title="Włącz powiadomienia"
          variant="secondary"
          onPress={async () => setDenied(!(await enable()))}
        />
      ) : null}
      {denied && !granted ? (
        <>
          <Text style={text.error}>Brak zgody na powiadomienia. Włącz je w ustawieniach systemu.</Text>
          <Button title="Otwórz ustawienia" variant="secondary" onPress={() => Linking.openSettings()} />
        </>
      ) : null}
      {REMINDER_SLOTS.map((slot) => (
        <View key={slot} style={styles.slot}>
          <Text style={[text.body, styles.slotLabel]}>{REMINDER_TIME_LABELS[slot]}</Text>
          <TextInput
            accessibilityLabel={`Godzina przypomnienia: ${REMINDER_TIME_LABELS[slot]}`}
            value={drafts[slot]}
            onChangeText={(input) => editTime(slot, input)}
            placeholder="GG:MM"
            placeholderTextColor={colors.muted}
            keyboardType="numbers-and-punctuation"
            style={[layout.input, styles.time, !parseTime(drafts[slot]) && styles.invalid]}
          />
          <Switch
            accessibilityLabel={`Przypomnienie: ${REMINDER_TIME_LABELS[slot]}`}
            value={reminders[slot].enabled}
            onValueChange={(enabled) => setReminder(slot, { enabled })}
            trackColor={{ true: colors.beet, false: colors.line }}
          />
        </View>
      ))}
      {invalid ? <Text style={text.error}>Wpisz godzinę w formacie GG:MM, na przykład 9:30.</Text> : null}
      <Text style={text.muted}>
        Przypomnienie dotyczy nawyku, którego jeszcze nie odhaczono. Gdy wszystko jest odhaczone, nie
        pojawia się.
      </Text>
      <Button title="Przypomnienie testowe za 10 s" variant="secondary" onPress={test} />
      {testStatus ? <Text style={text.muted}>{testStatus}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 20, gap: 20 },
  section: { ...layout.card, gap: 14 },
  field: { gap: 8 },
  label: { fontSize: 17, fontWeight: '600', color: colors.ink },
  ok: { fontSize: 15, lineHeight: 21, color: colors.leaf },
  recording: { fontSize: 15, fontWeight: '600', color: colors.signal },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slotLabel: { flex: 1, textTransform: 'capitalize' },
  time: { width: 88, textAlign: 'center' },
  invalid: { borderColor: colors.signal },
});
