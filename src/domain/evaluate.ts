import { MARKERS, type Marker, type MarkerId, type Sex } from './markers';
import {
  RECOMMENDATIONS,
  VIT_D_SUPPLEMENT_HABIT,
  type Habit,
  type HabitCategory,
  type Recommendation,
} from './recommendations';

export type Status = 'low' | 'normal' | 'high' | 'missing';
export type Results = Partial<Record<MarkerId, number>>;

export type MarkerStatus = {
  marker: Marker;
  value?: number;
  status: Status;
  /** Relative distance past the crossed bound (0 when normal/missing). */
  deviation: number;
  recommendation?: Recommendation;
};

export type Evaluation = { statuses: MarkerStatus[]; habits: Habit[] };

export const MAX_HABITS = 4;
// September–April: too little sun in Poland for skin synthesis of vitamin D.
const VIT_D_SEASON_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4];

function assess(marker: Marker, value: number | undefined, sex: Sex): MarkerStatus {
  if (value === undefined || !Number.isFinite(value)) return { marker, status: 'missing', deviation: 0 };
  const { min, max } = marker.range[sex];
  if (min !== undefined && value < min) {
    return { marker, value, status: 'low', deviation: (min - value) / min, recommendation: RECOMMENDATIONS[marker.id].low };
  }
  if (max !== undefined && value > max) {
    return { marker, value, status: 'high', deviation: (value - max) / max, recommendation: RECOMMENDATIONS[marker.id].high };
  }
  return { marker, value, status: 'normal', deviation: 0 };
}

export function evaluate(results: Results, sex: Sex, date: Date): Evaluation {
  const statuses = MARKERS.map((marker) => assess(marker, results[marker.id], sex));

  const seen = new Set<HabitCategory>();
  const habits: Habit[] = [];
  // Supplement first, then food habits by largest deviation; one habit per category (iron: ferritin + Hb).
  const vitD = statuses.find((s) => s.marker.id === 'vitD');
  if (vitD?.status === 'low' && VIT_D_SEASON_MONTHS.includes(date.getMonth() + 1)) {
    habits.push(VIT_D_SUPPLEMENT_HABIT);
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
