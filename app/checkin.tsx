import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function Checkin() {
  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      <Text>Głosowy check-in</Text>
      <Link href="/summary" replace>
        Zakończ check-in
      </Link>
    </View>
  );
}
