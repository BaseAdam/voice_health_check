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
- Treści medyczne (normy, zalecenia, pytania, wskazówki) są DETERMINISTYCZNE – tylko z `src/domain/` (czysty TS, bez Reacta).
- LLM wyłącznie interpretuje transkrypcję odpowiedzi → JSON `{ answer: "yes"|"no"|"unclear", note }`. Nie generuje porad.
- Wskazówka po odpowiedzi i podsumowanie dnia = deterministyczne teksty z reguł.
- Żadnych dawek leków/suplementów. Suplementy diety można polecać, ale ZAWSZE z notką „skonsultuj z lekarzem lub
  farmaceutą i przeczytaj ulotkę” (`SUPPLEMENT_NOTE`).
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
- TypeScript 6: domyślnie `types: []` – globalne typy (np. jest) trzeba dopisać w `tsconfig.json` → `compilerOptions.types`.

## Struktura
```
app/_layout.tsx     Stack (czeka na hydrację store), handler/listener notyfikacji
app/index.tsx       menu: plan / edycja wyników / check-in / ustawienia; bez wyników CTA „Wpisz wyniki”
app/results.tsx     formularz wyników (płeć, wartości, edytowalne normy, data badania, dane demo)
app/plan.tsx        notka z evaluate(): disclaimer, poza normą, co jeść, nawyki + pory; „Odsłuchaj”
app/checkin.tsx     głosowy check-in (push-to-talk)
app/summary.tsx     podsumowanie dnia
app/settings.tsx    klucze API + godziny przypomnień
src/domain/markers.ts          markery, jednostki, zakresy referencyjne (zależne od płci)
src/domain/recommendations.ts  wyjaśnienia, produkty, pytania, teksty tak/nie, pora, kategoria nawyku
src/domain/evaluate.ts         evaluate(): statusy markerów + max 4 nawyki (priorytet wg odchylenia)
src/domain/evaluate.test.ts    testy jest
src/format.ts       parsowanie/formatowanie liczb (przecinek), zakresów i dat
src/store.ts        zustand + persist (wyniki badań, tylko zmienione normy; NIE klucze API)
src/api.ts          klucze (secure-store/.env, useApiKeys()), testy połączenia, stt(), tts(), interpret()
src/reminders.ts    expo-notifications
```

## Komendy
```
npx expo start              # Expo Go
npm run typecheck
npm run lint
npm test                    # jest (preset jest-expo)
```
