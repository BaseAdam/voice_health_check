import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      <Text>Notka z zaleceniami</Text>
      <Link href="/results">Wpisz wyniki</Link>
      <Link href="/checkin">Rozpocznij check-in</Link>
      <Link href="/settings">Ustawienia</Link>
    </View>
  );
}
