import { Link } from 'expo-router';
import { View } from 'react-native';
import { useStore } from '../src/store';

export default function Home() {
  const hasResults = useStore((s) => s.results !== null);

  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      {hasResults ? (
        <>
          <Link href="/plan">Twój plan</Link>
          <Link href="/results">Edytuj wyniki</Link>
          <Link href="/checkin">Rozpocznij check-in</Link>
          <Link href="/summary">Podsumowanie dnia</Link>
        </>
      ) : (
        <Link href="/results">Wpisz wyniki</Link>
      )}
      <Link href="/settings">Ustawienia</Link>
    </View>
  );
}
