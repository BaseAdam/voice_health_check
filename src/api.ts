import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useState } from 'react';

export const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';
// https://console.groq.com/docs/models – supports strict Structured Outputs (constrained decoding).
export const GROQ_MODEL = 'openai/gpt-oss-120b';

export type KeyName = 'elevenlabs' | 'groq' | 'voiceId';
export type KeySource = 'settings' | 'env' | 'default' | 'none';
export type Keys = Record<KeyName, { value: string; source: KeySource }>;

export const KEY_LABELS: Record<KeyName, string> = {
  elevenlabs: 'ElevenLabs API key',
  groq: 'Groq API key',
  voiceId: 'ElevenLabs voice ID',
};

const STORE_KEYS: Record<KeyName, string> = {
  elevenlabs: 'elevenlabsApiKey',
  groq: 'groqApiKey',
  voiceId: 'elevenlabsVoiceId',
};

// EXPO_PUBLIC_* is inlined into the JS bundle at build time: dev-only fallback.
const FALLBACKS: Record<KeyName, { value?: string; source: KeySource }> = {
  elevenlabs: { value: process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY, source: 'env' },
  groq: { value: process.env.EXPO_PUBLIC_GROQ_API_KEY, source: 'env' },
  voiceId: { value: DEFAULT_VOICE_ID, source: 'default' },
};

export async function loadKeys(): Promise<Keys> {
  const names = Object.keys(STORE_KEYS) as KeyName[];
  // An unreadable keystore entry (e.g. after reinstall) behaves like a missing one.
  const stored = await Promise.all(
    names.map((name) => SecureStore.getItemAsync(STORE_KEYS[name]).catch(() => null)),
  );
  const keys = {} as Keys;
  names.forEach((name, i) => {
    const fallback = FALLBACKS[name];
    keys[name] = stored[i]
      ? { value: stored[i], source: 'settings' }
      : fallback.value
        ? { value: fallback.value, source: fallback.source }
        : { value: '', source: 'none' };
  });
  return keys;
}

export const saveKey = (name: KeyName, value: string) =>
  SecureStore.setItemAsync(STORE_KEYS[name], value);

export const deleteKey = (name: KeyName) => SecureStore.deleteItemAsync(STORE_KEYS[name]);

/** Keys with their source; `keys` is null until loaded. Re-reads on every screen focus. */
export function useApiKeys() {
  const [keys, setKeys] = useState<Keys | null>(null);
  const reload = useCallback(() => {
    loadKeys().then(setKeys);
  }, []);
  useFocusEffect(reload);
  return { keys, reload };
}

export type TestResult = { ok: boolean; message: string };

const NETWORK_ERROR: TestResult = { ok: false, message: 'Brak połączenia z serwerem' };

/** null = network failure. */
async function probe(url: string, headers: Record<string, string>): Promise<Response | null> {
  try {
    return await fetch(url, { headers });
  } catch {
    return null;
  }
}

async function httpError(res: Response): Promise<TestResult> {
  const body = await res.json().catch(() => null);
  // ElevenLabs: { detail: { message } } or { detail: "..." }; Groq (OpenAI-style): { error: { message } }.
  const detail = body?.detail?.message ?? body?.error?.message ?? body?.detail;
  const suffix = typeof detail === 'string' ? ` (${detail})` : '';
  const message = res.status === 401 ? 'Nieprawidłowy klucz' : `Błąd HTTP ${res.status}`;
  return { ok: false, message: message + suffix };
}

/** Free call: fetching the voice checks the key and the voice ID at once. */
export async function testElevenLabs(apiKey: string, voiceId: string): Promise<TestResult> {
  if (!apiKey) return { ok: false, message: 'Brak klucza' };
  const res = await probe(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`, {
    'xi-api-key': apiKey,
  });
  if (!res) return NETWORK_ERROR;
  if (res.status === 404) return { ok: false, message: 'Nie znaleziono głosu o tym ID' };
  if (!res.ok) return httpError(res);
  return { ok: true, message: 'Połączenie OK' };
}

/** Free call: listing models checks the key and that the interpretation model is available. */
export async function testGroq(apiKey: string): Promise<TestResult> {
  if (!apiKey) return { ok: false, message: 'Brak klucza' };
  const res = await probe('https://api.groq.com/openai/v1/models', {
    Authorization: `Bearer ${apiKey}`,
  });
  if (!res) return NETWORK_ERROR;
  if (!res.ok) return httpError(res);
  const body = await res.json().catch(() => null);
  const hasModel =
    Array.isArray(body?.data) && body.data.some((m: { id?: unknown }) => m.id === GROQ_MODEL);
  return hasModel
    ? { ok: true, message: 'Połączenie OK' }
    : { ok: false, message: `Klucz OK, ale model ${GROQ_MODEL} jest niedostępny` };
}
