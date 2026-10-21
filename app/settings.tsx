import { useState } from 'react';
import { Button, ScrollView, Text, TextInput, View } from 'react-native';
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

  const field = (name: KeyName) => {
    const { value, source } = keys[name];
    return (
      <View style={{ gap: 6 }}>
        <Text style={{ fontWeight: '600' }}>{KEY_LABELS[name]}</Text>
        <Text>
          Aktualny: {value ? (SECRET[name] ? mask(value) : value) : '—'} (źródło:{' '}
          {SOURCE_LABELS[source]})
        </Text>
        <TextInput
          accessibilityLabel={KEY_LABELS[name]}
          value={drafts[name]}
          onChangeText={(text) => setDrafts((d) => ({ ...d, [name]: text }))}
          placeholder={SECRET[name] ? 'Wklej nowy klucz' : 'Wpisz nowe ID głosu'}
          secureTextEntry={SECRET[name]}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10 }}
        />
        {source === 'settings' && <Button title="Usuń" onPress={() => remove(name)} />}
      </View>
    );
  };

  const testButton = (provider: Provider) => {
    const result = tests[provider];
    return (
      <View style={{ gap: 6 }}>
        <Button
          title="Testuj połączenie"
          onPress={() => test(provider)}
          disabled={result === 'pending'}
        />
        {result === 'pending' && <Text>Testuję…</Text>}
        {result && result !== 'pending' && (
          <Text style={{ color: result.ok ? '#1a7f37' : '#c62828' }}>{result.message}</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontSize: 18, fontWeight: '600' }}>ElevenLabs</Text>
      {field('elevenlabs')}
      {field('voiceId')}
      {testButton('elevenlabs')}

      <Text style={{ fontSize: 18, fontWeight: '600' }}>Groq</Text>
      {field('groq')}
      {testButton('groq')}

      <Button title="Zapisz" onPress={save} disabled={filled.length === 0} />
      {saveStatus !== '' && <Text>{saveStatus}</Text>}
      <Text style={{ color: '#666' }}>
        Klucze są zapisywane w bezpiecznym magazynie urządzenia. Bez klucza w ustawieniach
        aplikacja używa wartości z .env (tylko do developmentu).
      </Text>
    </ScrollView>
  );
}
