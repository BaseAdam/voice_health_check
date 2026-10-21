import { MARKERS, type Marker, type MarkerId, type Range, type Sex } from './markers';
import {
  RECOMMENDATIONS,
  VIT_D_SUPPLEMENT_HABIT,
  type Habit,
  type HabitCategory,
  type Recommendation,
} from './recommendations';

export type Status = 'low' | 'normal' | 'high' | 'missing';
export type Results = Partial<Record<MarkerId, number>>;
/** User-edited ranges (e.g. from the lab report); markers not listed use the default for sex. */
export type CustomRanges = Partial<Record<MarkerId, Range>>;

export type MarkerStatus = {
  marker: Marker;
  value?: number;
  status: Status;
  /** Range actually used for this marker. */
  range: Range;
  /** Relative distance past the crossed bound (0 when normal/missing). */
  deviation: number;
  recommendation?: Recommendation;
};

export type Evaluation = { statuses: MarkerStatus[]; habits: Habit[] };

export const MAX_HABITS = 4;
// September–April: too little sun in Poland for skin synthesis of vitamin D.
const VIT_D_SEASON_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4];

function assess(marker: Marker, value: number | undefined, range: Range): MarkerStatus {
  const base = { marker, range };
  if (value === undefined || !Number.isFinite(value)) return { ...base, status: 'missing', deviation: 0 };
  const { min, max } = range;
  if (min !== undefined && value < min) {
    return { ...base, value, status: 'low', deviation: (min - value) / min, recommendation: RECOMMENDATIONS[marker.id].low };
  }
  if (max !== undefined && value > max) {
    return { ...base, value, status: 'high', deviation: (value - max) / max, recommendation: RECOMMENDATIONS[marker.id].high };
  }
  return { ...base, value, status: 'normal', deviation: 0 };
}

export function evaluate(results: Results, sex: Sex, date: Date, ranges: CustomRanges = {}): Evaluation {
  const statuses = MARKERS.map((marker) =>
    assess(marker, results[marker.id], ranges[marker.id] ?? marker.range[sex]),
  );

  const seen = new Set<HabitCategory>();
  const habits: Habit[] = [];
  // Supplement first, then food habits by largest deviation; one habit per category (iron: ferritin + Hb).
  const vitD = statuses.find((s) => s.marker.id === 'vitD');
  if (vitD?.status === 'low' && VIT_D_SEASON_MONTHS.includes(date.getMonth() + 1)) {
    habits.push(VIT_D_SUPPLEMENT_HABIT);
    seen.add('vit_d_food'); // in season the supplement replaces the vitamin D food habit
  }
  for (const s of [...statuses].sort((a, b) => b.deviation - a.deviation)) {
    const habit = s.recommendation?.habit;
    if (habit && !seen.has(habit.category)) {
      seen.add(habit.category);
      habits.push(habit);
    }
  }
  return { statuses, habits: habits.slice(0, MAX_HABITS) };
}
