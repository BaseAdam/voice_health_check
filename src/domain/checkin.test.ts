import {
  ALL_DONE_TEXT,
  allDoneText,
  answersFor,
  confirmationText,
  daySummary,
  isEvening,
  pendingHabits,
} from './checkin';
import { RECOMMENDATIONS, VIT_D_SUPPLEMENT_HABIT } from './recommendations';

const fiber = RECOMMENDATIONS.ldl.high!.habit!;
const iron = RECOMMENDATIONS.ferritin.low!.habit!;
const habits = [VIT_D_SUPPLEMENT_HABIT, iron, fiber];

it('evening starts at 18:00', () => {
  expect(isEvening(new Date(2026, 9, 21, 17, 59))).toBe(false);
  expect(isEvening(new Date(2026, 9, 21, 18, 0))).toBe(true);
});

it('answers from another day do not count', () => {
  const log = { date: '2026-10-20', answers: { fiber: 'yes' as const } };
  expect(answersFor(log, '2026-10-21')).toEqual({});
  expect(answersFor(log, '2026-10-20')).toEqual({ fiber: 'yes' });
  expect(answersFor(null, '2026-10-21')).toEqual({});
});

it('only "yes" ticks a habit off', () => {
  expect(pendingHabits(habits, { fiber: 'yes', iron_food: 'no' })).toEqual([VIT_D_SUPPLEMENT_HABIT, iron]);
});

describe('confirmationText', () => {
  it('yes: rule text, detail only in the fixed template', () => {
    expect(confirmationText(fiber, 'yes', undefined, false)).toBe(fiber.yesText);
    expect(confirmationText(fiber, 'yes', 'jabłko', false)).toBe(`Zanotowane: jabłko. ${fiber.yesText}`);
  });

  it('no: tip for the rest of the day before evening, no tip in the evening', () => {
    expect(confirmationText(fiber, 'no', undefined, false)).toBe(`Rozumiem. ${fiber.noTip}`);
    expect(confirmationText(fiber, 'no', 'jeszcze nie', true)).not.toContain(fiber.noTip);
  });
});

describe('daySummary', () => {
  const answers = { vit_d_supplement: 'yes', iron_food: 'no' } as const;

  it('daytime: done / not yet / skipped, no closing', () => {
    expect(daySummary(habits, answers, ['fiber'], false)).toBe(
      'Udało się: suplement witaminy D. Jeszcze nie: produkty bogate w żelazo. Pominięte: posiłek z błonnikiem.',
    );
  });

  it('evening: closes the day with a count', () => {
    expect(daySummary(habits, answers, [], true)).toBe(
      'Udało się: suplement witaminy D. Nie udało się: produkty bogate w żelazo, posiłek z błonnikiem. ' +
        'Odhaczone nawyki: 1 z 3. Do jutra!',
    );
  });

  it('all done: short text by day, full summary in the evening', () => {
    const all = { vit_d_supplement: 'yes', iron_food: 'yes', fiber: 'yes' } as const;
    expect(allDoneText(habits, all, false)).toBe(ALL_DONE_TEXT);
    expect(allDoneText(habits, all, true)).toContain('Odhaczone nawyki: 3 z 3.');
  });
});
