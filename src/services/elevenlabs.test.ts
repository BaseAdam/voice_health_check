import { createAudioPlayer } from 'expo-audio';
import { fetch as expoFetch } from 'expo/fetch';
import { convertFormDataAsync } from 'expo/src/winter/fetch/convertFormData';
import { errorMessage, hash, speak, stopSpeaking, transcribe } from './elevenlabs';

// Native modules have no jest mocks: fakes with just what elevenlabs.ts touches.
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn(async () => {}) }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  Directory: class {
    exists = true;
  },
  // Cached clips exist; recordings expose the Blob-like API (name, type, bytes) that expo/fetch encodes.
  File: class {
    uri: string;
    exists = true;
    type = 'audio/mp4';
    constructor(...parts: unknown[]) {
      this.uri = parts.map(String).join('/');
    }
    get name() {
      return this.uri.split('/').pop();
    }
    async bytes() {
      return new Uint8Array([1, 2, 3]);
    }
  },
}));
jest.mock('../api', () => ({
  loadKeys: async () => ({ elevenlabs: { value: 'sk_test' }, voiceId: { value: 'voice' } }),
}));

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

describe('speak / stopSpeaking', () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const fakePlayer = () => ({ play: jest.fn(), pause: jest.fn(), remove: jest.fn(), addListener: jest.fn() });

  it('stopSpeaking silences the playing clip', async () => {
    const player = fakePlayer();
    jest.mocked(createAudioPlayer).mockReturnValueOnce(player as never);
    const done = speak('a');
    await tick();
    expect(player.play).toHaveBeenCalled();

    stopSpeaking();
    // remove() only drops expo-audio's registry entry; without pause() the sound keeps playing.
    expect(player.pause).toHaveBeenCalled();
    await expect(done).resolves.toBeUndefined();
  });

  it('a new clip stops the previous one', async () => {
    const first = fakePlayer();
    const second = fakePlayer();
    jest.mocked(createAudioPlayer).mockReturnValueOnce(first as never).mockReturnValueOnce(second as never);
    void speak('a');
    await tick();
    void speak('b');
    await tick();
    expect(first.pause).toHaveBeenCalled();
    expect(second.play).toHaveBeenCalled();
    stopSpeaking();
  });
});

it('transcribe sends the recording in a form expo/fetch can encode', async () => {
  // Device setup: React Native's FormData patched by the Expo runtime. jest has Node's FormData and
  // jest-expo stubs the patch, hence requireActual.
  const RNFormData = jest.requireActual('react-native/Libraries/Network/FormData').default;
  const { installFormDataPatch } = jest.requireActual('expo/src/winter/FormData');
  installFormDataPatch(RNFormData);
  const nodeFormData = globalThis.FormData;
  globalThis.FormData = RNFormData as never;
  const sent: string[] = [];
  // Encodes the body like expo/fetch, which is also the global fetch on the device (SDK 57).
  const fakeFetch = async (_url: string, init: { body: FormData }) => {
    const { body } = await convertFormDataAsync(init.body); // RN { uri } parts: "Unsupported FormDataPart implementation"
    sent.push(new TextDecoder().decode(body));
    return { ok: true, status: 200, json: async () => ({ text: ' tak ' }) };
  };
  jest.mocked(expoFetch).mockImplementation(fakeFetch as never);
  const globalFetch = jest.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch as never);
  try {
    await expect(transcribe('file:///rec.m4a')).resolves.toBe('tak');
    expect(sent[0]).toContain('name="file"; filename="rec.m4a"');
  } finally {
    globalFetch.mockRestore();
    globalThis.FormData = nodeFormData;
  }
});
