export type Sex = 'female' | 'male';
export type MarkerId = 'vitD' | 'ferritin' | 'hemoglobin' | 'b12' | 'ldl' | 'glucose';
/** Inclusive bounds; a missing bound means "no limit on that side". */
export type Range = { min?: number; max?: number };

export type Marker = {
  id: MarkerId;
  name: string;
  unit: string;
  range: Record<Sex, Range>;
};

const same = (range: Range): Record<Sex, Range> => ({ female: range, male: range });

// Default adult reference ranges. Ranges differ between laboratories –
// the range printed on the user's lab report always takes precedence.
export const MARKERS: readonly Marker[] = [
  // 30–50 ng/ml is optimal per Polish 2023 guidelines; 100 is a typical lab upper limit.
  { id: 'vitD', name: 'Witamina D (25-OH)', unit: 'ng/ml', range: same({ min: 30, max: 100 }) },
  {
    id: 'ferritin',
    name: 'Ferrytyna',
    unit: 'ng/ml',
    range: { female: { min: 15, max: 200 }, male: { min: 30, max: 300 } },
  },
  {
    id: 'hemoglobin',
    name: 'Hemoglobina',
    unit: 'g/dl',
    range: { female: { min: 12, max: 16 }, male: { min: 13, max: 16.5 } },
  },
  { id: 'b12', name: 'Witamina B12', unit: 'pg/ml', range: same({ min: 200, max: 900 }) },
  // Upper limit for low cardiovascular risk; targets are lower for higher-risk patients.
  { id: 'ldl', name: 'Cholesterol LDL', unit: 'mg/dl', range: same({ max: 115 }) },
  { id: 'glucose', name: 'Glukoza na czczo', unit: 'mg/dl', range: same({ min: 70, max: 99 }) },
];
