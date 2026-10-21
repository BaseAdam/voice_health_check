import { errorMessage, hash } from './elevenlabs';

// Native audio module has no jest mock; only pure helpers are tested here.
jest.mock('expo-audio', () => ({}));

it('maps ElevenLabs errors to Polish messages', () => {
  expect(errorMessage(401, '{"detail":{"status":"invalid_api_key"}}')).toBe('Nieprawidłowy klucz ElevenLabs.');
  expect(errorMessage(401, '{"detail":{"status":"quota_exceeded"}}')).toBe('Wyczerpany miesięczny limit ElevenLabs.');
  expect(errorMessage(401, '{"detail":{"status":"missing_permissions"}}')).toMatch(/uprawnień/);
  expect(errorMessage(429, '')).toMatch(/Za dużo zapytań/);
  expect(errorMessage(500, '')).toBe('Błąd ElevenLabs (HTTP 500).');
  expect(errorMessage(500, '{"detail":{"message":"Boom"}}')).toBe('Błąd ElevenLabs (HTTP 500) (Boom).');
});

it('maps both documented causes of 402 and keeps the API message otherwise', () => {
  const credits =
    '{"detail":{"type":"payment_required","code":"insufficient_credits","message":"Your account does not have enough credits for this operation.","status":"insufficient_credits"}}';
  expect(errorMessage(402, credits)).toMatch(/Za mało kredytów/);
  expect(errorMessage(402, '{"detail":{"message":"This voice is not available for free users."}}')).toMatch(
    /darmowym planie.*voice ID/,
  );
  expect(errorMessage(402, '{"detail":{"message":"Something else"}}')).toBe(
    'Ta operacja wymaga płatnego planu ElevenLabs (Something else).',
  );
  expect(errorMessage(402, 'not json')).toBe('Ta operacja wymaga płatnego planu ElevenLabs.');
});

it('cache hash is deterministic and sensitive to every part of the key', () => {
  expect(hash('a|b|tekst')).toBe(hash('a|b|tekst'));
  expect(hash('a|b|tekst')).not.toBe(hash('a|c|tekst'));
  expect(hash('a|b|tekst')).not.toBe(hash('a|b|tekst.'));
  expect(hash('zażółć')).toMatch(/^[0-9a-z]+$/);
});
