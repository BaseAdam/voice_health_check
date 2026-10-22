import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { answersFor, type DayLog, type YesNo } from './domain/checkin';
import type { CustomRanges, Results } from './domain/evaluate';
import type { Sex } from './domain/markers';
import type { HabitCategory, ReminderTime } from './domain/recommendations';
import { DEFAULT_REMINDERS, type ReminderSettings, type ReminderSlot } from './domain/reminders';
import { toISODate } from './format';

export type LabResults = {
  sex: Sex;
  values: Results;
  /** Only ranges the user changed; the rest use the default for `sex`. */
  ranges: CustomRanges;
  /** YYYY-MM-DD */
  testDate: string;
};

type State = {
  results: LabResults | null;
  /** Only today's habit answers; history is out of scope. */
  today: DayLog | null;
  setResults: (results: LabResults) => void;
  /** Saved right after each answer, so an interrupted check-in keeps its progress. */
  setAnswer: (category: HabitCategory, answer: YesNo) => void;
  reminders: ReminderSettings;
  setReminder: (slot: ReminderTime, patch: Partial<ReminderSlot>) => void;
  /** The "enable reminders?" card on /plan is shown once. */
  remindersAsked: boolean;
  setRemindersAsked: () => void;
};

// API keys never go here – they live in expo-secure-store (src/api.ts).
export const useStore = create<State>()(
  persist(
    (set) => ({
      results: null,
      today: null,
      setResults: (results) => set({ results }),
      setAnswer: (category, answer) =>
        set((s) => {
          const date = toISODate(new Date());
          return { today: { date, answers: { ...answersFor(s.today, date), [category]: answer } } };
        }),
      reminders: DEFAULT_REMINDERS,
      setReminder: (slot, patch) =>
        set((s) => ({ reminders: { ...s.reminders, [slot]: { ...s.reminders[slot], ...patch } } })),
      remindersAsked: false,
      setRemindersAsked: () => set({ remindersAsked: true }),
    }),
    { name: 'voice-health-check', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** AsyncStorage hydration is async: false until the persisted state is loaded. */
export const useHydrated = () =>
  useSyncExternalStore(useStore.persist.onFinishHydration, useStore.persist.hasHydrated);
