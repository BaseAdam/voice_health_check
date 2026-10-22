import { pendingHabits, type DayAnswers } from './checkin';
import type { Habit, ReminderTime } from './recommendations';

export type ReminderSlot = { enabled: boolean; /** HH:MM */ time: string };
export type ReminderSettings = Record<ReminderTime, ReminderSlot>;
export type PlannedReminder = { date: Date; body: string };

export const REMINDER_TITLE = 'Check-in zdrowia';
export const DEFAULT_REMINDERS: ReminderSettings = {
  morning: { enabled: true, time: '09:00' },
  lunch: { enabled: true, time: '13:00' },
  evening: { enabled: true, time: '19:00' },
};
// Today + 6 days × 3 slots = max 21 (iOS keeps at most 64). The window rolls forward on every app open.
export const PLAN_DAYS = 7;
export const REMINDER_SLOTS: ReminderTime[] = ['morning', 'lunch', 'evening'];

/** "9:05" / "09:05" → [9, 5]; anything else → null. */
export function parseTime(text: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [hours, minutes] = [Number(m[1]), Number(m[2])];
  return hours <= 23 && minutes <= 59 ? [hours, minutes] : null;
}

/** Notification body for one slot, or null when nothing is left to tick off. */
export function reminderBody(slot: ReminderTime, habits: Habit[], answers: DayAnswers): string | null {
  const pending = pendingHabits(habits, answers);
  if (pending.length === 0) return null;
  if (slot === 'evening') {
    const labels = pending.map((h) => h.label).join(', ');
    return `Zostało do odhaczenia: ${labels}. Podsumuj dzień – 30 sekund na głosie.`;
  }
  const habit = pending.find((h) => h.time === slot) ?? pending[0];
  // Supplement reminders always carry SUPPLEMENT_NOTE.
  return habit.note ? `${habit.reminder} ${habit.note}` : habit.reminder;
}

/**
 * Reminders after `now`, sorted by time: today's use today's answers, later days assume nothing is
 * ticked off yet (the plan is recomputed after every check-in and app open).
 */
export function planReminders(
  habits: Habit[],
  answers: DayAnswers,
  settings: ReminderSettings,
  now: Date,
): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  for (let day = 0; day < PLAN_DAYS; day++) {
    for (const slot of REMINDER_SLOTS) {
      const time = parseTime(settings[slot].time);
      if (!settings[slot].enabled || !time) continue;
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, ...time);
      if (date <= now) continue;
      const body = reminderBody(slot, habits, day === 0 ? answers : {});
      if (body) planned.push({ date, body });
    }
  }
  // Slot times are editable, so "lunch" may come before "morning".
  return planned.sort((a, b) => a.date.getTime() - b.date.getTime());
}
