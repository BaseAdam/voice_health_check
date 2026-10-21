import type { Habit, HabitCategory } from './recommendations';

export type YesNo = 'yes' | 'no';
/** Today's answers per habit. Only "yes" ticks a habit off; "no" is asked again later the same day. */
export type DayAnswers = Partial<Record<HabitCategory, YesNo>>;
export type DayLog = { date: string; answers: DayAnswers };

// From this hour a check-in closes the day: no tips for "the rest of the day", full-day summary.
export const EVENING_HOUR = 18;
export const isEvening = (now: Date) => now.getHours() >= EVENING_HOUR;

/** Answers logged for `today` (YYYY-MM-DD); a log from another day counts as empty. */
export const answersFor = (log: DayLog | null, today: string): DayAnswers =>
  log?.date === today ? log.answers : {};

export const pendingHabits = (habits: Habit[], answers: DayAnswers) =>
  habits.filter((h) => answers[h.category] !== 'yes');

export const REASK_TEXT = 'Nie rozumiem odpowiedzi. Powiedz proszę „tak” albo „nie”.';
export const ALL_DONE_TEXT = 'Na dziś wszystko odhaczone. Brawo!';
const NO_EVENING_TEXT = 'Rozumiem, zapisuję. Jutro kolejna szansa.';

/** Spoken after an answer. `detail` (from the LLM, already sanitized) only fills a fixed template. */
export function confirmationText(habit: Habit, answer: YesNo, detail: string | undefined, evening: boolean) {
  if (answer === 'no') return evening ? NO_EVENING_TEXT : `Rozumiem. ${habit.noTip}`;
  return detail ? `Zanotowane: ${detail}. ${habit.yesText}` : habit.yesText;
}

/** Whole-day status; in the evening it also closes the day. */
export function daySummary(
  habits: Habit[],
  answers: DayAnswers,
  skipped: HabitCategory[],
  evening: boolean,
): string {
  const names = (list: Habit[]) => list.map((h) => h.label).join(', ');
  const done = habits.filter((h) => answers[h.category] === 'yes');
  const open = habits.filter((h) => answers[h.category] !== 'yes');
  const skippedNow = open.filter((h) => skipped.includes(h.category));
  const notYet = open.filter((h) => !skipped.includes(h.category));

  const parts: string[] = [];
  if (done.length > 0) parts.push(`Udało się: ${names(done)}.`);
  if (notYet.length > 0) parts.push(`${evening ? 'Nie udało się' : 'Jeszcze nie'}: ${names(notYet)}.`);
  if (skippedNow.length > 0) parts.push(`Pominięte: ${names(skippedNow)}.`);
  if (evening) parts.push(`Odhaczone nawyki: ${done.length} z ${habits.length}. Do jutra!`);
  return parts.join(' ');
}

/** Shown and spoken when nothing is left to ask today. */
export const allDoneText = (habits: Habit[], answers: DayAnswers, evening: boolean) =>
  evening ? `${ALL_DONE_TEXT} ${daySummary(habits, answers, [], true)}` : ALL_DONE_TEXT;
