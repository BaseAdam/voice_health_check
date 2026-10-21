import { Stack } from 'expo-router';
import { useHydrated } from '../src/store';

export default function RootLayout() {
  // Wait for persisted results so screens don't flash the "no results" state.
  const hydrated = useHydrated();
  if (!hydrated) return null;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Voice Health Check' }} />
      <Stack.Screen name="results" options={{ title: 'Wyniki badań' }} />
      <Stack.Screen name="plan" options={{ title: 'Twój plan' }} />
      <Stack.Screen name="checkin" options={{ title: 'Check-in' }} />
      <Stack.Screen name="summary" options={{ title: 'Podsumowanie dnia' }} />
      <Stack.Screen name="settings" options={{ title: 'Ustawienia' }} />
    </Stack>
  );
}
