import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { KEY_LABELS, useApiKeys } from '../src/api';

const REQUIRED_KEYS = ['elevenlabs', 'groq'] as const;

export default function Checkin() {
  const { keys } = useApiKeys();
  if (!keys) return null;

  const missing = REQUIRED_KEYS.filter((name) => !keys[name].value);
  if (missing.length > 0) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 16 }}>
        <Text>
          Do check-inu potrzebne są klucze API. Brakuje: {missing.map((n) => KEY_LABELS[n]).join(', ')}.
        </Text>
        <Link href="/settings">Przejdź do ustawień</Link>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      <Text>Głosowy check-in</Text>
      <Link href="/summary" replace>
        Zakończ check-in
      </Link>
    </View>
  );
}
