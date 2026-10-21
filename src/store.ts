import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CustomRanges, Results } from './domain/evaluate';
import type { Sex } from './domain/markers';

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
  setResults: (results: LabResults) => void;
};

// API keys never go here – they live in expo-secure-store (src/api.ts).
export const useStore = create<State>()(
  persist(
    (set) => ({
      results: null,
      setResults: (results) => set({ results }),
    }),
    { name: 'voice-health-check', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** AsyncStorage hydration is async: false until the persisted state is loaded. */
export const useHydrated = () =>
  useSyncExternalStore(useStore.persist.onFinishHydration, useStore.persist.hasHydrated);
