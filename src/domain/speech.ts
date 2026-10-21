import type { Evaluation } from './evaluate';
import { DISCLAIMER } from './recommendations';

/** "Witamina D (25-OH)" → "Witamina D": parentheses read badly aloud. */
const spokenName = (name: string) => name.replace(/\s*\(.*\)/, '');

/** Plan read aloud: same content as the /plan screen, without numbers and units (TTS reads them badly). */
export function planSpeech({ statuses, habits }: Evaluation): string {
  const abnormal = statuses.filter((s) => s.status === 'low' || s.status === 'high');
  const foods = [...new Set(abnormal.flatMap((s) => s.recommendation?.habit?.foods ?? []))];

  const parts = [DISCLAIMER];
  if (abnormal.length === 0) parts.push('Wszystkie podane wyniki są w normie.');
  for (const s of abnormal) {
    const side = s.status === 'low' ? 'poniżej' : 'powyżej';
    parts.push(`${spokenName(s.marker.name)}: wynik ${side} normy. ${s.recommendation?.explanation ?? ''}`);
  }
  if (foods.length > 0) parts.push(`Warto jeść: ${foods.join(', ')}.`);
  if (habits.length > 0) {
    parts.push('Codziennie zapytam:', ...habits.map((h) => h.question));
    parts.push(...habits.flatMap((h) => (h.note ? [h.note] : [])));
  }
  return parts.join(' ');
}
