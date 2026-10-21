import { evaluate } from './evaluate';
import { DISCLAIMER, SUPPLEMENT_NOTE } from './recommendations';
import { planSpeech } from './speech';

const JANUARY = new Date(2026, 0, 15);

it('demo plan: disclaimer first, markers without units, foods, questions, supplement note', () => {
  const text = planSpeech(evaluate({ vitD: 18, ferritin: 10, ldl: 145 }, 'female', JANUARY));
  expect(text.startsWith(DISCLAIMER)).toBe(true);
  expect(text).toContain('Witamina D: wynik poniżej normy.');
  expect(text).toContain('Cholesterol LDL: wynik powyżej normy.');
  expect(text).toContain('łosoś');
  expect(text).toContain('Czy udało Ci się dziś przyjąć suplement witaminy D?');
  expect(text).toContain(SUPPLEMENT_NOTE);
  expect(text).not.toMatch(/\d|ng\/ml|mg\/dl|\(/);
});

it('all normal → short confirmation, no questions', () => {
  const text = planSpeech(evaluate({ vitD: 40 }, 'female', JANUARY));
  expect(text).toBe(`${DISCLAIMER} Wszystkie podane wyniki są w normie.`);
});
