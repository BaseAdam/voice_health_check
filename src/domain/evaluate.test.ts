import { evaluate, MAX_HABITS, type Results } from './evaluate';
import { RECOMMENDATIONS, SUPPLEMENT_NOTE, VIT_D_SUPPLEMENT_HABIT } from './recommendations';

const JANUARY = new Date(2026, 0, 15);
const JULY = new Date(2026, 6, 15);

const NORMAL: Results = { vitD: 40, ferritin: 80, hemoglobin: 14, b12: 500, ldl: 100, glucose: 85 };

const statusOf = (results: Results, sex: 'female' | 'male' = 'female', date = JULY) =>
  Object.fromEntries(evaluate(results, sex, date).statuses.map((s) => [s.marker.id, s.status]));
const categories = (results: Results, date = JULY) =>
  evaluate(results, 'female', date).habits.map((h) => h.category);

describe('w normie', () => {
  it('all markers normal → no habits, also in vitamin D season', () => {
    expect(Object.values(statusOf(NORMAL))).toEqual(Array(6).fill('normal'));
    expect(categories(NORMAL, JANUARY)).toEqual([]);
  });
});

describe('wartości graniczne', () => {
  it('bounds are inclusive', () => {
    expect(statusOf({ vitD: 30, glucose: 99, ldl: 115 })).toMatchObject({
      vitD: 'normal',
      glucose: 'normal',
      ldl: 'normal',
    });
    expect(statusOf({ vitD: 100, glucose: 70 })).toMatchObject({ vitD: 'normal', glucose: 'normal' });
  });

  it('just past a bound is abnormal', () => {
    expect(statusOf({ vitD: 29.9, glucose: 99.1, ldl: 115.1 })).toMatchObject({
      vitD: 'low',
      glucose: 'high',
      ldl: 'high',
    });
  });

  it('LDL has no lower bound', () => {
    expect(statusOf({ ldl: 1 }).ldl).toBe('normal');
  });

  it('ferritin and hemoglobin ranges depend on sex', () => {
    expect(statusOf({ ferritin: 20, hemoglobin: 12.5 }, 'female')).toMatchObject({
      ferritin: 'normal',
      hemoglobin: 'normal',
    });
    expect(statusOf({ ferritin: 20, hemoglobin: 12.5 }, 'male')).toMatchObject({
      ferritin: 'low',
      hemoglobin: 'low',
    });
  });

  it('direction without a diet habit gives only an explanation', () => {
    const { statuses, habits } = evaluate({ vitD: 150 }, 'female', JULY);
    const vitD = statuses.find((s) => s.marker.id === 'vitD');
    expect(vitD?.status).toBe('high');
    expect(vitD?.recommendation?.explanation).toMatch(/lekarzem/);
    expect(habits).toEqual([]);
  });
});

describe('brak danych', () => {
  it('no results → all missing, no habits, no supplement even in season', () => {
    expect(Object.values(statusOf({}))).toEqual(Array(6).fill('missing'));
    expect(categories({}, JANUARY)).toEqual([]);
  });

  it('non-finite value counts as missing', () => {
    expect(statusOf({ vitD: NaN }).vitD).toBe('missing');
  });

  it('partial results evaluate only what is given', () => {
    expect(statusOf({ b12: 150 })).toMatchObject({ b12: 'low', vitD: 'missing', ldl: 'missing' });
    expect(categories({ b12: 150 })).toEqual(['b12_food']);
  });
});

describe('sezon witaminy D', () => {
  it('low vitamin D in season → supplement habit first, with consultation note', () => {
    const { habits } = evaluate({ vitD: 20 }, 'female', JANUARY);
    expect(habits.map((h) => h.category)).toEqual(['vit_d_supplement', 'vit_d_food']);
    expect(habits[0].note).toBe(SUPPLEMENT_NOTE);
  });

  it('low vitamin D out of season → food habit only', () => {
    expect(categories({ vitD: 20 }, JULY)).toEqual(['vit_d_food']);
  });

  it.each([
    [new Date(2026, 3, 30), true], // April
    [new Date(2026, 4, 1), false], // May
    [new Date(2026, 7, 31), false], // August
    [new Date(2026, 8, 1), true], // September
  ])('season boundary %s → supplement %s', (date, expected) => {
    expect(categories({ vitD: 20 }, date).includes('vit_d_supplement')).toBe(expected);
  });
});

describe('priorytet i limit', () => {
  it(`max ${MAX_HABITS} habits, supplement first, then by deviation, iron once`, () => {
    // Deviations: glucose 0.52, ferritin 0.47, Hb 0.17, LDL 0.30, B12 0.25, vitD 0.33
    const all: Results = { vitD: 20, ferritin: 8, hemoglobin: 10, b12: 150, ldl: 150, glucose: 150 };
    expect(categories(all, JANUARY)).toEqual(['vit_d_supplement', 'vegetables', 'iron_food', 'vit_d_food']);
  });
});

describe('treści', () => {
  const habits = [
    VIT_D_SUPPLEMENT_HABIT,
    ...Object.values(RECOMMENDATIONS).flatMap((r) => [r.low?.habit, r.high?.habit]),
  ].filter((h) => h !== undefined);
  const texts = [
    ...habits.flatMap((h) => [h.question, h.yesText, h.noTip, h.note ?? '']),
    ...Object.values(RECOMMENDATIONS).flatMap((r) => [r.low?.explanation ?? '', r.high?.explanation ?? '']),
  ];

  it('no doses anywhere', () => {
    for (const text of texts) {
      expect(text).not.toMatch(/\d\s*(mg|µg|mcg|j\.\s?m\.|IU|tabl|kaps)/i);
    }
  });

  it('every supplement habit carries the consultation note', () => {
    for (const h of habits.filter((h) => h.category.includes('supplement'))) {
      expect(h.note).toBe(SUPPLEMENT_NOTE);
    }
  });
});
