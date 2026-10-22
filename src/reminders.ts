import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { answersFor } from './domain/checkin';
import { evaluate } from './domain/evaluate';
import { REMINDER_TITLE, planReminders } from './domain/reminders';
import { toISODate } from './format';
import { useStore } from './store';

const CHANNEL_ID = 'reminders';
// Only our daily reminders are replaced on sync; the 10 s test notification is left alone.
const ID_PREFIX = 'reminder-';

// Show reminders also while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android 13+ shows the permission prompt only once a channel exists; iOS has no channels.
const ensureChannel = () =>
  Platform.OS === 'android'
    ? Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Przypomnienia',
        importance: Notifications.AndroidImportance.HIGH,
      })
    : Promise.resolve(null);

async function schedule() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  const { results, today, reminders } = useStore.getState();
  if (!results || !(await Notifications.getPermissionsAsync()).granted) return;
  await ensureChannel();
  const now = new Date();
  const habits = evaluate(results.values, results.sex, now, results.ranges).habits;
  const plan = planReminders(habits, answersFor(today, toISODate(now)), reminders, now);
  for (const [i, { date, body }] of plan.entries()) {
    await Notifications.scheduleNotificationAsync({
      identifier: ID_PREFIX + i,
      content: { title: REMINDER_TITLE, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
    });
  }
}

let queue = Promise.resolve();
/** Replaces scheduled reminders with a fresh plan. Calls run one at a time, so they never duplicate. */
function syncReminders(): Promise<void> {
  queue = queue.then(schedule).catch((e) => console.warn('Reminder sync failed', e));
  return queue;
}

/** Asks for permission if the system still allows asking; schedules reminders when granted. */
async function enableReminders(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  const { granted } =
    current.granted || !current.canAskAgain ? current : await Notifications.requestPermissionsAsync();
  if (granted) await syncReminders();
  return granted;
}

export async function scheduleTestReminder(): Promise<boolean> {
  if (!(await enableReminders())) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: REMINDER_TITLE, body: 'To jest przypomnienie testowe. Dotknij, aby otworzyć check-in.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, channelId: CHANNEL_ID },
  });
  return true;
}

/**
 * Notification permission (null until checked), re-checked on focus and when the app comes back
 * from system settings. `enable` asks for it.
 */
export function useNotificationPermission() {
  const [granted, setGranted] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      const check = () => Notifications.getPermissionsAsync().then((p) => setGranted(p.granted));
      check();
      const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
      return () => sub.remove();
    }, []),
  );
  const enable = useCallback(async () => {
    const result = await enableReminders();
    setGranted(result);
    return result;
  }, []);
  return { granted, enable };
}

// A fresh check-in on top of the home screen; an open one is closed, so two never run at once.
function openCheckin() {
  if (router.canDismiss()) router.dismissAll();
  router.push('/checkin');
}

/** Root-layout wiring, once the store is hydrated: keeps the schedule fresh, opens /checkin on tap. */
export function useReminders(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    syncReminders();
    const unsubscribe = useStore.subscribe((s, prev) => {
      if (s.results !== prev.results || s.today !== prev.today || s.reminders !== prev.reminders) {
        syncReminders();
      }
    });
    // Rolls the 7-day window forward and picks up a new day or permission changed in system settings.
    const appState = AppState.addEventListener('change', (s) => s === 'active' && syncReminders());

    // App launched by tapping a notification.
    if (Notifications.getLastNotificationResponse()) {
      Notifications.clearLastNotificationResponse();
      openCheckin();
    }
    const tap = Notifications.addNotificationResponseReceivedListener(() => {
      Notifications.clearLastNotificationResponse();
      openCheckin();
    });
    return () => {
      unsubscribe();
      appState.remove();
      tap.remove();
    };
  }, [ready]);
}
