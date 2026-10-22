# Voice Health Check
Zadanie rekrutacyjne (1–2h). Aplikacja mobilna: głos jako interfejs do codziennego check-inu zdrowotnego.

## Stack
React Native + Expo SDK 57 (TypeScript, expo-router), działa w Expo Go na fizycznym telefonie.
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
- LLM wyłącznie interpretuje transkrypcję odpowiedzi → JSON `{ answer: "yes"|"no"|"unclear", detail? }` (walidacja zod).
  Nie generuje porad. Każdy błąd (klucz, sieć, timeout, HTTP, JSON, schemat) → `unclear`.
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
- Expo Go z App Store obsługuje JEDNO SDK i po premierze nowego SDK jest kilka tygodni w tyle. Stan 2026-10-21: sklep = SDK 57
  (SDK 58 wyszło 15.10, Expo Go 58 w sklepie „w ciągu kilku tygodni”) → trzymamy SDK 57. Sprawdzenie: `expoGoSdkVersion`
  w https://api.expo.dev/v2/versions/latest. Zmiana SDK: `npx expo install expo@~<wersja> --fix`, potem
  `npx expo install --dev jest-expo jest @types/jest eslint-config-expo @types/react typescript`, a na koniec CZYSTA
  instalacja (`rm -rf node_modules package-lock.json && npm install`) – przyrostowo npm zagnieździł `expo-modules-core`.
- `expo-audio` ma peer `expo-asset: "*"` – npm dociąga najnowszą (z innego SDK) i bundle pada na `expo/internal/...`.
  Dlatego `expo-asset` jest przypięty bezpośrednio (`npx expo install expo-asset`).
- Android w Expo Go: brak `SCHEDULE_EXACT_ALARM`, przypomnienia mogą się spóźnić o kilka minut (akceptujemy).
- Przypomnienia = jednorazowe wyzwalacze DATE na dziś + 6 dni (max 21, iOS trzyma max 64), id `reminder-<n>`; okno
  przesuwa się przy otwarciu aplikacji, więc bez otwarcia przez 7 dni przypomnienia ustają. Android 13+ pokazuje prośbę
  o zgodę dopiero gdy istnieje kanał – `ensureChannel()` przed `requestPermissionsAsync()`.
- TTS zwraca binarne mp3: `fetch` z `expo/fetch` → `arrayBuffer()` → `await new File(Paths.cache, …).write(new Uint8Array(buf))`
  (SDK 57: `File.write()` synchroniczne, SDK 58: zwraca Promise – kod robi `await`, działa w obu).
  Fallback: endpoint `/with-timestamps` (JSON z `audio_base64`).
- STT upload: RN `FormData` z `{ uri, name: 'a.m4a', type: 'audio/m4a' }`.
- `react-dom` jest zainstalowany tylko jako peer dependency (konflikt ERESOLVE przy instalacji ESLint) – przez to Expo
  uznaje projekt za webowy. Dlatego `app.json` ma `"platforms": ["ios", "android"]`; bez tego przeglądarka / klawisz `w`
  kończą się „Unable to resolve react-native-web”.
- Jest: `expo-audio` nie ma mocka w jest-expo – w testach importujących go `jest.mock('expo-audio', () => ({}))`.
- TypeScript 6: domyślnie `types: []` – globalne typy (np. jest) trzeba dopisać w `tsconfig.json` → `compilerOptions.types`.

## Struktura
```
app/_layout.tsx     Stack (czeka na hydrację store), useReminders(): sync przypomnień, dotknięcie → /checkin
app/index.tsx       ekran „Dziś”: nawyki ✓ / ✗ / „jeszcze nie pytano”, następne przypomnienie, „Check-in teraz”, menu;
                    bez wyników CTA „Wpisz wyniki”
app/results.tsx     formularz wyników (płeć, wartości, edytowalne normy, data badania, dane demo)
app/plan.tsx        notka z evaluate(): disclaimer, poza normą, co jeść, nawyki + pory; „Odsłuchaj”; karta zgody na przypomnienia (raz)
app/checkin.tsx     głosowy check-in: efekty maszyny stanów (speak/nagranie/STT/LLM), push-to-talk TAP start/stop, fallbacki Tak/Nie, Pomiń
app/summary.tsx     podgląd stanu nawyków na dziś (tylko odczyt)
app/settings.tsx    klucze API, test głosu, przypomnienia (GG:MM + przełącznik na porę, zgoda, test za 10 s)
src/domain/markers.ts          markery, jednostki, zakresy referencyjne (zależne od płci)
src/domain/recommendations.ts  wyjaśnienia, produkty, pytania, teksty tak/nie i przypomnienia, pora, kategoria nawyku
src/domain/evaluate.ts         evaluate(): statusy markerów + max 4 nawyki (priorytet wg odchylenia)
src/domain/evaluate.test.ts    testy jest
src/domain/speech.ts           planSpeech(): tekst notki do odsłuchu (bez liczb i jednostek)
src/domain/checkin.ts          teksty check-inu (potwierdzenia, dopytanie, podsumowanie dnia), wieczór od 18:00
src/domain/reminders.ts        planReminders(): pory × 7 dni, treść z nieodhaczonego nawyku, nic gdy wszystko odhaczone
src/checkin.ts      reducer maszyny stanów check-inu (czysty TS, `step` odrzuca spóźnione wyniki async)
src/format.ts       parsowanie/formatowanie liczb (przecinek), zakresów i dat
src/store.ts        zustand + persist (wyniki badań, tylko zmienione normy, odpowiedzi z DZIŚ, ustawienia przypomnień;
                    NIE klucze API)
src/api.ts          klucze (secure-store/.env, useApiKeys()), testy połączenia
src/services/llm.ts         interpretAnswer(): Groq, Structured Outputs strict + zod, nigdy nie rzuca
src/services/elevenlabs.ts  speak() (TTS + cache po hashu, resolve po końcu odtwarzania), stopSpeaking(), transcribe() (Scribe)
src/services/recorder.ts    useRecorder(): push-to-talk, uprawnienia, tryb audio iOS, limit 30 s
src/reminders.ts    expo-notifications: handler, kanał Androida, syncReminders() (kolejka), zgoda, test, routing dotknięcia
```

## Komendy
```
npx expo start              # Expo Go
npm run typecheck
npm run lint
npm test                    # jest (preset jest-expo)
```
