import { errorMessage, hash } from './elevenlabs';

// Native audio module has no jest mock; only pure helpers are tested here.
jest.mock('expo-audio', () => ({}));

it('maps ElevenLabs errors to Polish messages', () => {
  expect(errorMessage(401, '{"detail":{"status":"invalid_api_key"}}')).toBe('Nieprawidłowy klucz ElevenLabs.');
  expect(errorMessage(401, '{"detail":{"status":"quota_exceeded"}}')).toBe('Wyczerpany miesięczny limit ElevenLabs.');
  expect(errorMessage(401, '{"detail":{"status":"missing_permissions"}}')).toMatch(/uprawnień/);
  expect(errorMessage(429, '')).toMatch(/Za dużo zapytań/);
  expect(errorMessage(500, '')).toBe('Błąd ElevenLabs (HTTP 500).');
});

it('cache hash is deterministic and sensitive to every part of the key', () => {
  expect(hash('a|b|tekst')).toBe(hash('a|b|tekst'));
  expect(hash('a|b|tekst')).not.toBe(hash('a|c|tekst'));
  expect(hash('a|b|tekst')).not.toBe(hash('a|b|tekst.'));
  expect(hash('zażółć')).toMatch(/^[0-9a-z]+$/);
});
