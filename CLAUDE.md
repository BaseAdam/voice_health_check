# Voice Health Check
Zadanie rekrutacyjne (1–2h). Aplikacja mobilna: głos jako interfejs do codziennego check-inu zdrowotnego.

## Stack
React Native + Expo SDK 58 (TypeScript, expo-router), działa w Expo Go na fizycznym telefonie.
ElevenLabs: STT (scribe_v2, pl) + TTS (eleven_flash_v2_5). Groq (API zgodne z OpenAI, openai/gpt-oss-120b, json_schema strict).
expo-audio (NIE expo-av), expo-file-system (nowe API File/Paths, nie /legacy), expo-notifications (tylko lokalne),
expo-secure-store, zustand + persist w AsyncStorage.

## Jedyny przepływ end-to-end
wpisanie wyników → notka z zaleceniami → głosowy check-in (3–4 pytania, push-to-talk) → podsumowanie dnia.
Przypomnienia lokalne dokładamy DOPIERO gdy ten przepływ działa.

## Poza zakresem
PDF/OCR, push z serwera, konta/backend/sync, wykresy historii, rozmowa real-time (ElevenLabs Agents/WebRTC),
automatyczne wykrywanie końca mowy.

## Zasady
- Treści medyczne (normy, zalecenia, pytania, wskazówki) są DETERMINISTYCZNE – tylko z `src/rules.ts`.
- LLM wyłącznie interpretuje transkrypcję odpowiedzi → JSON `{ answer: "yes"|"no"|"unclear", note }`. Nie generuje porad.
- Wskazówka po odpowiedzi i podsumowanie dnia = deterministyczne teksty z reguł.
- Żadnych dawek leków/suplementów. Suplement tylko jako przypomnienie o zaleceniu lekarza (nazwa wpisana przez użytkownika).
- Disclaimer „nie zastępuje konsultacji z lekarzem” na notce i podsumowaniu.
- Klucze API: wpisywane w aplikacji (expo-secure-store), fallback `.env` (`EXPO_PUBLIC_*`, tylko dev – trafia do bundla).
  Nic nie hardkodowane, `.env` w .gitignore, commitujemy tylko `.env.example`.
- UI i głos po polsku, pytania w formie neutralnej płciowo („Czy udało Ci się dziś…”).
- Prostota ponad abstrakcje. Stan: jeden store zustand + persist. Notka liczona z wyników, nie przechowywana.

## Gotchas
- iOS: przy `allowsRecording: true` odtwarzanie leci przez słuchawkę rozmowną – `setAudioModeAsync({ allowsRecording: true })`
  tuż przed nagraniem, `false` przed odtworzeniem TTS.
- Expo Go ze sklepu obsługuje tylko najnowsze SDK – trzymamy SDK 58.
- Android w Expo Go: brak `SCHEDULE_EXACT_ALARM`, przypomnienia DAILY mogą się spóźnić o kilka minut (akceptujemy).
- TTS zwraca binarne mp3: `fetch` z `expo/fetch` → `arrayBuffer()` → `new File(Paths.cache, …).write(new Uint8Array(buf))`.
  Fallback: endpoint `/with-timestamps` (JSON z `audio_base64`).
- STT upload: RN `FormData` z `{ uri, name: 'a.m4a', type: 'audio/m4a' }`.

## Struktura
```
app/_layout.tsx     Stack + handler/listener notyfikacji
app/index.tsx       notka z zaleceniami albo CTA „Wpisz wyniki”; start check-inu
app/results.tsx     formularz wyników (płeć, wartości, opcjonalny suplement od lekarza)
app/checkin.tsx     głosowy check-in (push-to-talk)
app/summary.tsx     podsumowanie dnia
app/settings.tsx    klucze API + godziny przypomnień
src/rules.ts        markery, normy, zalecenia, pytania, wskazówki + evaluate()/pickQuestions()
src/rules.check.ts  assert-owy self-check
src/store.ts        zustand + persist
src/api.ts          klucze (secure-store/.env), stt(), tts(), interpret()
src/reminders.ts    expo-notifications
```

## Komendy
```
npx expo start              # Expo Go
npx tsc --noEmit
npx tsx src/rules.check.ts
```
