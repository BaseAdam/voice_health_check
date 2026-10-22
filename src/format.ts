import type { Range } from './domain/markers';

/** '' → undefined (no value); otherwise a non-negative number, or NaN if not one. Accepts a decimal comma. */
export function parseDecimal(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return undefined;
  return /^\d+(\.\d*)?$/.test(t) ? Number(t) : NaN;
}

/** Polish notation: 13.5 → "13,5". */
export const formatDecimal = (n: number) => String(n).replace('.', ',');

export function formatRange({ min, max }: Range, unit: string): string {
  if (min !== undefined && max !== undefined) return `${formatDecimal(min)}–${formatDecimal(max)} ${unit}`;
  if (max !== undefined) return `≤ ${formatDecimal(max)} ${unit}`;
  if (min !== undefined) return `≥ ${formatDecimal(min)} ${unit}`;
  return 'brak zakresu';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date as YYYY-MM-DD (toISOString would use UTC and shift the day near midnight). */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Real calendar date in YYYY-MM-DD, not after `today`. */
export function isValidTestDate(text: string, today: Date): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return toISODate(date) === text && text <= toISODate(today);
}

/** YYYY-MM-DD → DD.MM.YYYY */
export const formatDate = (iso: string) => iso.split('-').reverse().join('.');

/** "dziś 13:00" / "jutro 09:00" / "24.10.2026 09:00" */
export function formatWhen(date: Date, now: Date): string {
  const day = toISODate(date);
  const tomorrow = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const label = day === toISODate(now) ? 'dziś' : day === tomorrow ? 'jutro' : formatDate(day);
  return `${label} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
