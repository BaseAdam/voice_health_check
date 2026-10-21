import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function Summary() {
  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      <Text>Podsumowanie dnia</Text>
      <Link href="/" dismissTo>
        Wróć do ekranu głównego
      </Link>
    </View>
  );
}
