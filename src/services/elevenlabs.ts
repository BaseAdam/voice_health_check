import { fetch as expoFetch } from 'expo/fetch';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { loadKeys } from '../api';

// https://elevenlabs.io/docs/models – Flash v2.5: multilingual (incl. Polish), lowest latency, half the credits per character.
export const TTS_MODEL = 'eleven_flash_v2_5';
export const STT_MODEL = 'scribe_v2';
const BASE_URL = 'https://api.elevenlabs.io/v1';
const NETWORK_ERROR = 'Brak połączenia z internetem.';

/** cyrb53 – 53-bit string hash; plenty to name a few dozen cached clips. */
export function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** ElevenLabs error → Polish message. Error body: { detail: { status | code, message } }. */
export function errorMessage(status: number, body: string): string {
  if (status === 401) {
    if (body.includes('quota_exceeded')) return 'Wyczerpany miesięczny limit ElevenLabs.';
    if (body.includes('missing_permissions')) return 'Klucz ElevenLabs nie ma wymaganych uprawnień.';
    return 'Nieprawidłowy klucz ElevenLabs.';
  }
  if (status === 429) return 'Za dużo zapytań do ElevenLabs – spróbuj za chwilę.';
  return `Błąd ElevenLabs (HTTP ${status}).`;
}

type HttpResponse = { ok: boolean; status: number; text(): Promise<string> };

async function call<R extends HttpResponse>(send: () => Promise<R>): Promise<R> {
  let res: R;
  try {
    res = await send();
  } catch {
    throw new Error(NETWORK_ERROR);
  }
  if (!res.ok) throw new Error(errorMessage(res.status, await res.text().catch(() => '')));
  return res;
}

async function credentials() {
  const keys = await loadKeys();
  if (!keys.elevenlabs.value) throw new Error('Brak klucza ElevenLabs – dodaj go w Ustawieniach.');
  return { apiKey: keys.elevenlabs.value, voiceId: keys.voiceId.value };
}

/** TTS clip from cache, or generated and cached. Texts are deterministic, so most calls hit the cache. */
async function ttsFile(text: string): Promise<File> {
  const { apiKey, voiceId } = await credentials();
  const dir = new Directory(Paths.cache, 'tts');
  if (!dir.exists) dir.create();
  const file = new File(dir, `${hash(`${TTS_MODEL}|${voiceId}|${text}`)}.mp3`);
  if (file.exists) return file;

  const res = await call(() =>
    expoFetch(`${BASE_URL}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: TTS_MODEL }),
    }),
  );
  const bytes = new Uint8Array(await res.arrayBuffer());
  try {
    await file.write(bytes);
  } catch (e) {
    if (file.exists) file.delete(); // never leave a truncated clip in the cache
    throw e;
  }
  return file;
}

let current: { player: AudioPlayer; done: () => void } | null = null;
let generation = 0;

/** Stops current playback; its speak() promise resolves as if finished. */
export function stopSpeaking() {
  generation++;
  if (!current) return;
  const { player, done } = current;
  current = null;
  player.remove();
  done();
}

/** Speaks `text`; resolves AFTER playback ends (or is stopped). One clip at a time. */
export async function speak(text: string): Promise<void> {
  stopSpeaking();
  const id = generation;
  const file = await ttsFile(text);
  // iOS: with recording allowed, playback goes to the earpiece – switch it off before playing.
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  if (id !== generation) return; // stopped or superseded while loading

  return new Promise<void>((resolve, reject) => {
    const player = createAudioPlayer({ uri: file.uri });
    const entry = { player, done: resolve };
    current = entry;
    player.addListener('playbackStatusUpdate', (status) => {
      if (current !== entry) return;
      if (status.error) {
        current = null;
        player.remove();
        reject(new Error('Nie udało się odtworzyć nagrania.'));
      } else if (status.didJustFinish) {
        current = null;
        player.remove();
        resolve();
      }
    });
    player.play();
  });
}

/** Speech-to-text (Scribe, Polish). Throws a Polish message when nothing was recognized. */
export async function transcribe(fileUri: string): Promise<string> {
  const { apiKey } = await credentials();
  const form = new FormData();
  form.append('model_id', STT_MODEL);
  form.append('language_code', 'pl');
  form.append('tag_audio_events', 'false');
  // React Native FormData file part.
  form.append('file', { uri: fileUri, name: 'a.m4a', type: 'audio/m4a' } as unknown as Blob);

  const res = await call(() =>
    fetch(`${BASE_URL}/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': apiKey }, body: form }),
  );
  const body = await res.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) throw new Error('Nie udało się rozpoznać mowy – spróbuj jeszcze raz.');
  return text;
}
