import { Stack } from 'expo-router';
import { useReminders } from '../src/reminders';
import { useHydrated } from '../src/store';
import { colors } from '../src/ui';

const SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: colors.paper },
  headerShadowVisible: false,
  headerTintColor: colors.beet,
  headerTitleStyle: { color: colors.ink, fontWeight: '600' as const },
  contentStyle: { backgroundColor: colors.paper },
};

export default function RootLayout() {
  // Wait for persisted results so screens don't flash the "no results" state.
  const hydrated = useHydrated();
  useReminders(hydrated);
  if (!hydrated) return null;

  return (
    <Stack screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="index" options={{ title: 'Dziś' }} />
      <Stack.Screen name="results" options={{ title: 'Wyniki badań' }} />
      <Stack.Screen name="plan" options={{ title: 'Twój plan' }} />
      <Stack.Screen name="checkin" options={{ title: 'Check-in' }} />
      <Stack.Screen name="summary" options={{ title: 'Podsumowanie dnia' }} />
      <Stack.Screen name="settings" options={{ title: 'Ustawienia' }} />
    </Stack>
  );
}
