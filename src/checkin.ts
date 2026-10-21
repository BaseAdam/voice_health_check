import { confirmationText, REASK_TEXT, type YesNo } from './domain/checkin';
import type { Habit, HabitCategory } from './domain/recommendations';

/**
 * Check-in state machine (pure; side effects live in app/checkin.tsx):
 * intro → per habit: asking → listening → transcribing → interpreting → confirming → … → summary.
 * No pending habits at all → allDone.
 */
export type Phase =
  | 'intro'
  | 'asking'
  | 'listening'
  | 'transcribing'
  | 'interpreting'
  | 'confirming'
  | 'summary'
  | 'allDone';

export type CheckinState = {
  phase: Phase;
  habits: Habit[];
  index: number;
  evening: boolean;
  /** Bumped on every transition; async results tagged with an older step are ignored. */
  step: number;
  unclearCount: number;
  /** Show manual Tak/Nie buttons (second unclear answer, mic/STT failure). */
  manual: boolean;
  /** Text spoken in asking/confirming. */
  speech: string;
  audioUri: string;
  transcript: string;
  error: string;
  skipped: HabitCategory[];
};

export type CheckinEvent =
  | { type: 'start' }
  | { type: 'spoken'; step: number }
  | { type: 'speakFailed'; step: number; error: string }
  | { type: 'recorded'; step: number; uri: string }
  | { type: 'transcribed'; step: number; text: string }
  | { type: 'failed'; step: number; error: string }
  | { type: 'unclear'; step: number }
  | { type: 'answered'; step: number; answer: YesNo; detail?: string }
  | { type: 'next' }
  | { type: 'skip' };

const QUESTION_PHASES: Phase[] = ['asking', 'listening', 'transcribing', 'interpreting'];

export const currentHabit = (s: CheckinState): Habit | undefined => s.habits[s.index];

export function initCheckin(habits: Habit[], evening: boolean): CheckinState {
  return {
    phase: habits.length === 0 ? 'allDone' : 'intro',
    habits,
    index: 0,
    evening,
    step: 0,
    unclearCount: 0,
    manual: false,
    speech: '',
    audioUri: '',
    transcript: '',
    error: '',
    skipped: [],
  };
}

const to = (s: CheckinState, patch: Partial<CheckinState>): CheckinState => ({ ...s, ...patch, step: s.step + 1 });

function askHabit(s: CheckinState, index: number): CheckinState {
  const reset = { index, unclearCount: 0, manual: false, audioUri: '', transcript: '', error: '' };
  if (index >= s.habits.length) return to(s, { ...reset, phase: 'summary', speech: '' });
  return to(s, { ...reset, phase: 'asking', speech: s.habits[index].question });
}

export function checkinReducer(s: CheckinState, e: CheckinEvent): CheckinState {
  if ('step' in e && e.step !== s.step) return s; // stale async result (e.g. after "Pomiń")
  const habit = currentHabit(s);

  switch (e.type) {
    case 'start':
      return s.phase === 'intro' ? askHabit(s, 0) : s;
    case 'spoken':
      if (s.phase === 'asking') return to(s, { phase: 'listening' });
      if (s.phase === 'confirming') return askHabit(s, s.index + 1);
      return s;
    case 'speakFailed':
      // Asking: the question is on screen, go on listening. Elsewhere: keep the text, "Dalej" continues.
      if (s.phase === 'asking') return to(s, { phase: 'listening', error: e.error });
      return { ...s, error: e.error };
    case 'recorded':
      return s.phase === 'listening' ? to(s, { phase: 'transcribing', audioUri: e.uri, error: '' }) : s;
    case 'transcribed':
      return s.phase === 'transcribing' ? to(s, { phase: 'interpreting', transcript: e.text }) : s;
    case 'failed':
      return QUESTION_PHASES.includes(s.phase) ? to(s, { phase: 'listening', manual: true, error: e.error }) : s;
    case 'unclear': {
      if (s.phase !== 'interpreting' || !habit) return s;
      const unclearCount = s.unclearCount + 1;
      // Ask again once; the second time fall back to Tak/Nie buttons.
      if (unclearCount >= 2) return to(s, { phase: 'listening', unclearCount, manual: true });
      return to(s, { phase: 'asking', unclearCount, speech: `${REASK_TEXT} ${habit.question}` });
    }
    case 'answered':
      if (!QUESTION_PHASES.includes(s.phase) || !habit) return s;
      return to(s, {
        phase: 'confirming',
        error: '',
        speech: confirmationText(habit, e.answer, e.detail, s.evening),
      });
    case 'next':
      return s.phase === 'confirming' ? askHabit(s, s.index + 1) : s;
    case 'skip':
      if (s.phase === 'confirming') return askHabit(s, s.index + 1); // answer already saved
      if (!QUESTION_PHASES.includes(s.phase) || !habit) return s;
      return askHabit({ ...s, skipped: [...s.skipped, habit.category] }, s.index + 1);
  }
}
