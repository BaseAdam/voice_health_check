# Voice Health Check

A mobile app (React Native + Expo, iOS and Android) for a daily voice check-in on habits that follow from blood
test results. Recruitment task.

The app UI and voice are in Polish; button labels below are quoted in Polish with an English gloss.

## The problem and why this one

Blood test results usually end up in a drawer: I know my vitamin D or ferritin is low, but that knowledge does not
change what I actually eat during the day. What is missing is not information but a cheap, daily nudge to act. So
voice is used here for a short check-in that reminds me of specific habits during the day, and answering takes
a dozen or so seconds with no forms to fill in. I chose this problem because many common deviations (vitamin D,
ferritin, LDL) can be supported with diet and supplements, the recommendations can rest on deterministic rules
instead of an LLM, and the medical risk is much lower than in triage or a pre-teleconsultation interview.

## What I built

One end-to-end flow:

1. **Lab results** – 6 markers (vitamin D, ferritin, haemoglobin, B12, LDL, glucose), sex-specific reference ranges
   that can be edited to match the lab printout, and a “Wczytaj dane demo” (load demo data) button.
2. **Note** – what is out of range and why, what to eat, up to 4 daily habits with a time of day; it can be read
   aloud.
3. **Voice check-in** – 3–4 yes/no questions, push-to-talk (“Mów” → “Gotowe”, speak → done), a confirmation and a
   tip for the rest of the day. After two unclear answers, Tak/Nie (yes/no) buttons appear.
4. **Day summary** – spoken and on screen. The next check-in only asks about habits not yet ticked off.

Plus a “Dziś” (today) screen with habit status and the next reminder, and local reminders.

## Decisions

- **Recommendations come from rules, not from the LLM.** Ranges, explanations, questions, tips and the summary are
  deterministic (`src/domain/`, plain TypeScript with tests). The same result always produces the same, reviewable
  text, and a model cannot make up medical advice. No drug or supplement doses; a supplement always comes with a
  note to consult a doctor or pharmacist; a disclaimer on the note and the summary.
- **The LLM only classifies the answer.** Transcript → `{ answer: "yes" | "no" | "unclear", detail }` (JSON Schema
  in `strict` mode + zod validation). Any failure – missing key, network, timeout, HTTP, bad JSON – yields
  `unclear`: one re-ask, then the Tak/Nie buttons.
- **Turn-based STT + TTS instead of ElevenLabs Agents.** Agents need WebRTC, i.e. a development build instead of
  Expo Go – too much risk for a 2-hour task. A turn: TTS question (Flash v2.5) → recording → STT (Scribe v2,
  Polish) → classification → TTS confirmation. Texts are deterministic, so TTS clips are cached by a hash of
  model + voice + text, and a repeated check-in uses almost no credits.
- **Reminders during the day, not just an evening summary.** In the evening you can only record the result; during
  the day you can still change what you do. Three slots (9:00, 13:00, 19:00 by default, editable in Ustawienia –
  settings), each about a habit not ticked off yet; when everything is ticked off, there is no reminder. Local
  notifications are scheduled 7 days ahead and recomputed after every answer and on app open.
- **Keys: SecureStore + `.env` fallback.** Keys entered in Ustawienia go to expo-secure-store; `.env`
  (`EXPO_PUBLIC_*`) is for development only, because it is compiled into the bundle. In production the calls would
  go through a backend proxy, since a key stored on the device cannot be hidden – deliberately left out of this
  scope.
- **Groq as the LLM** (`openai/gpt-oss-120b`): OpenAI-compatible API, Structured Outputs in `strict` mode, a free
  key and low latency – the user waits for a confirmation after every answer.

## What I cut and why

- **PDF/OCR import** – every lab uses a different format and the reading has to be verified; the form plus demo
  data are enough to show the flow.
- **Server push** – needs a backend; local notifications cover reminders.
- **Fitting reminder times to the user's daily rhythm** – needs history; fixed, editable slots instead.
- **Backend and accounts** – data stays on the device (AsyncStorage), no sync.
- **History and charts** – only today's answers are stored.
- **Dictating results by voice** – decimal numbers and units are where STT is weakest; the form is more reliable.
- **Automatic end-of-speech detection** – push-to-talk never cuts the user off and needs no tuning.

## What's next

1. **Backend proxy for ElevenLabs and Groq** – keys off the device; required before sharing the app with anyone.
2. **Development build (EAS)** – no dependency on the Expo Go version, exact reminders on Android.
3. **Answer history** – the basis for trends, a reminder to retest and fitting reminder times.
4. **PDF results import** – OCR with the user confirming every value.
5. **Reminder times based on daily rhythm** – from the times the user actually does the check-in.
6. **Accounts, sync, server push** – once there is a second device or sharing with a doctor.
7. **Real-time conversation (ElevenLabs Agents) and automatic end of speech** – after the development build, once
   the turn-based flow has proven itself with users.

## Running it

Requirements:

- Node.js 20.19.4+, 22.13+ or 24.3+ (required by React Native 0.86).
- A phone with Expo Go (App Store / Google Play) that supports Expo SDK 57, on the same Wi-Fi as the computer.
- ElevenLabs and Groq keys – the free plans are enough.

```
npm install
npx expo start
```

Scan the QR code: with the camera on iOS, in Expo Go on Android.

**Keys** – either:

- in the app: Ustawienia → paste the keys → “Zapisz klucze” (save keys) → “Testuj połączenie” (test connection);
- in `.env` (development only): copy `.env.example` to `.env`, fill it in and restart `npx expo start`.
  Expo CLI writes these values to `.expo/dev/logs/start.log`, so for a demo the in-app settings are better.

**Where to get free keys:**

- ElevenLabs: sign up at elevenlabs.io → [elevenlabs.io/app/api/api-keys](https://elevenlabs.io/app/api/api-keys) →
  create a key with the Text to Speech, Speech to Text and Voices (read) permissions. The free plan only works with
  premade voices – the app's default voice is premade; Voice Library voices return HTTP 402.
- Groq: [console.groq.com/keys](https://console.groq.com/keys) → “Create API Key”.

**Handy for testing:** “Wczytaj dane demo” (results screen), plus “Przypomnienie testowe za 10 s” (test reminder in
10 s) and “Wyczyść dzisiejsze odpowiedzi” (clear today's answers) in Ustawienia.

```
npm test            # jest
npm run typecheck
npm run lint
```
