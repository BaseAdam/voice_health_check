import { RECOMMENDATIONS, SUPPLEMENT_NOTE, VIT_D_SUPPLEMENT_HABIT } from './recommendations';
import { DEFAULT_REMINDERS, PLAN_DAYS, parseTime, planReminders, reminderBody } from './reminders';

const fiber = RECOMMENDATIONS.ldl.high!.habit!; // morning
const iron = RECOMMENDATIONS.ferritin.low!.habit!; // lunch
const habits = [iron, fiber];

it('parseTime accepts H:MM and HH:MM only', () => {
  expect(parseTime('9:05')).toEqual([9, 5]);
  expect(parseTime(' 23:59 ')).toEqual([23, 59]);
  for (const bad of ['24:00', '12:60', '1200', '12:5', '', 'ab:cd']) expect(parseTime(bad)).toBeNull();
});

describe('reminderBody', () => {
  it('morning/lunch: pending habit of that time of day, else any pending', () => {
    expect(reminderBody('morning', habits, {})).toBe(fiber.reminder);
    expect(reminderBody('lunch', habits, {})).toBe(iron.reminder);
    expect(reminderBody('lunch', habits, { iron_food: 'yes' })).toBe(fiber.reminder);
    expect(reminderBody('morning', habits, { fiber: 'no' })).toBe(fiber.reminder); // "no" is asked again
  });

  it('evening lists what is left', () => {
    expect(reminderBody('evening', habits, { fiber: 'yes' })).toBe(
      `Zostało do odhaczenia: ${iron.label}. Podsumuj dzień – 30 sekund na głosie.`,
    );
  });

  it('nothing left → no reminder', () => {
    for (const slot of ['morning', 'lunch', 'evening'] as const) {
      expect(reminderBody(slot, habits, { fiber: 'yes', iron_food: 'yes' })).toBeNull();
    }
  });

  it('supplement reminder carries the consult note', () => {
    expect(reminderBody('morning', [VIT_D_SUPPLEMENT_HABIT], {})).toContain(SUPPLEMENT_NOTE);
  });
});

describe('planReminders', () => {
  const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);

  it('only future slots today, all slots on the following days', () => {
    const plan = planReminders(habits, {}, DEFAULT_REMINDERS, at(22, 13, 0));
    expect(plan[0].date).toEqual(at(22, 19)); // 13:00 is not after now
    expect(plan[1].date).toEqual(at(23, 9));
    expect(plan).toHaveLength(1 + 3 * (PLAN_DAYS - 1));
    expect(plan[plan.length - 1].date).toEqual(at(28, 19));
  });

  it("today's answers apply to today only", () => {
    const plan = planReminders(habits, { fiber: 'yes', iron_food: 'yes' }, DEFAULT_REMINDERS, at(22, 8));
    expect(plan[0].date).toEqual(at(23, 9));
    expect(plan[0].body).toBe(fiber.reminder);
  });

  it('disabled slots are skipped, edited times are sorted', () => {
    const settings = {
      morning: { enabled: true, time: '10:30' },
      lunch: { enabled: true, time: '8:15' },
      evening: { enabled: false, time: '19:00' },
    };
    const plan = planReminders(habits, {}, settings, at(22, 7));
    expect(plan.slice(0, 3).map((r) => r.date)).toEqual([at(22, 8, 15), at(22, 10, 30), at(23, 8, 15)]);
    expect(plan).toHaveLength(2 * PLAN_DAYS);
  });

  it('no habits → no reminders', () => {
    expect(planReminders([], {}, DEFAULT_REMINDERS, at(22, 7))).toEqual([]);
  });
});
