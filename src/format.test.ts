import { formatRange, formatWhen, isValidTestDate, parseDecimal, toISODate } from './format';

describe('parseDecimal', () => {
  it('empty → no value', () => {
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal('  ')).toBeUndefined();
  });

  it('accepts dot and comma', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal(' 40 ')).toBe(40);
    expect(parseDecimal('12,')).toBe(12); // mid-typing
  });

  it('rejects text, negatives and exponents', () => {
    for (const bad of ['abc', '-5', '1e3', '12,5,1', ',5']) expect(parseDecimal(bad)).toBeNaN();
  });
});

describe('isValidTestDate', () => {
  const today = new Date(2026, 9, 21);

  it('accepts real past and current dates', () => {
    expect(isValidTestDate('2026-10-21', today)).toBe(true);
    expect(isValidTestDate('2024-02-29', today)).toBe(true);
  });

  it('rejects malformed, impossible and future dates', () => {
    for (const bad of ['21.10.2026', '2026-1-5', '2025-02-29', '2026-13-01', '2026-10-22']) {
      expect(isValidTestDate(bad, today)).toBe(false);
    }
  });
});

it('toISODate uses local date', () => {
  expect(toISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
});

it('formatRange handles one-sided ranges', () => {
  expect(formatRange({ min: 12, max: 16.5 }, 'g/dl')).toBe('12–16,5 g/dl');
  expect(formatRange({ max: 115 }, 'mg/dl')).toBe('≤ 115 mg/dl');
  expect(formatRange({}, 'mg/dl')).toBe('brak zakresu');
});

it('formatWhen: today, tomorrow (across month end), later', () => {
  const now = new Date(2026, 9, 31, 20, 0);
  expect(formatWhen(new Date(2026, 9, 31, 21, 5), now)).toBe('dziś 21:05');
  expect(formatWhen(new Date(2026, 10, 1, 9, 0), now)).toBe('jutro 09:00');
  expect(formatWhen(new Date(2026, 10, 2, 9, 0), now)).toBe('02.11.2026 09:00');
});
