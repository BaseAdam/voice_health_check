import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Voice Health Check' }} />
      <Stack.Screen name="results" options={{ title: 'Wyniki badań' }} />
      <Stack.Screen name="checkin" options={{ title: 'Check-in' }} />
      <Stack.Screen name="summary" options={{ title: 'Podsumowanie dnia' }} />
      <Stack.Screen name="settings" options={{ title: 'Ustawienia' }} />
    </Stack>
  );
}
