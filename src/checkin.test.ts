import { checkinReducer, initCheckin, type CheckinEvent, type CheckinState } from './checkin';
import { REASK_TEXT } from './domain/checkin';
import { RECOMMENDATIONS, VIT_D_SUPPLEMENT_HABIT } from './domain/recommendations';

const fiber = RECOMMENDATIONS.ldl.high!.habit!;
const habits = [VIT_D_SUPPLEMENT_HABIT, fiber];

/** Applies events in order; async events get the current step unless one is given. */
function run(state: CheckinState, ...events: (CheckinEvent | Omit<Extract<CheckinEvent, { step: number }>, 'step'>)[]) {
  return events.reduce<CheckinState>(
    (s, e) => checkinReducer(s, ('step' in e || ['start', 'next', 'skip'].includes(e.type) ? e : { ...e, step: s.step }) as CheckinEvent),
    state,
  );
}

const atListening = () => run(initCheckin(habits, false), { type: 'start' }, { type: 'spoken' });

it('nothing pending → allDone, start does nothing', () => {
  const s = initCheckin([], false);
  expect(s.phase).toBe('allDone');
  expect(checkinReducer(s, { type: 'start' })).toBe(s);
});

it('happy path: ask → listen → transcribe → interpret → confirm → next habit → summary', () => {
  let s = run(initCheckin(habits, false), { type: 'start' });
  expect(s).toMatchObject({ phase: 'asking', index: 0, speech: VIT_D_SUPPLEMENT_HABIT.question });

  s = run(s, { type: 'spoken' }, { type: 'recorded', uri: 'file://a.m4a' });
  expect(s).toMatchObject({ phase: 'transcribing', audioUri: 'file://a.m4a' });

  s = run(s, { type: 'transcribed', text: 'no jasne' });
  expect(s).toMatchObject({ phase: 'interpreting', transcript: 'no jasne' });

  s = run(s, { type: 'answered', answer: 'yes' });
  expect(s).toMatchObject({ phase: 'confirming', speech: VIT_D_SUPPLEMENT_HABIT.yesText });

  s = run(s, { type: 'spoken' });
  expect(s).toMatchObject({ phase: 'asking', index: 1, speech: fiber.question, transcript: '' });

  s = run(s, { type: 'spoken' }, { type: 'recorded', uri: 'b' }, { type: 'transcribed', text: 'nie' });
  s = run(s, { type: 'answered', answer: 'no' }, { type: 'next' });
  expect(s.phase).toBe('summary');
});

it('"no" before evening confirms with the tip for the rest of the day', () => {
  const s = run(atListening(), { type: 'answered', answer: 'no' });
  expect(s.speech).toBe(`Rozumiem. ${VIT_D_SUPPLEMENT_HABIT.noTip}`);
});

it('unclear: re-ask once, then manual Tak/Nie', () => {
  let s = run(atListening(), { type: 'recorded', uri: 'a' }, { type: 'transcribed', text: 'eee' }, { type: 'unclear' });
  expect(s).toMatchObject({ phase: 'asking', unclearCount: 1, manual: false });
  expect(s.speech).toBe(`${REASK_TEXT} ${VIT_D_SUPPLEMENT_HABIT.question}`);

  s = run(s, { type: 'spoken' }, { type: 'recorded', uri: 'b' }, { type: 'transcribed', text: 'hmm' }, { type: 'unclear' });
  expect(s).toMatchObject({ phase: 'listening', unclearCount: 2, manual: true });

  s = run(s, { type: 'answered', answer: 'yes' });
  expect(s.phase).toBe('confirming');
});

it('mic/STT failure → listening with manual buttons and the error', () => {
  const s = run(atListening(), { type: 'recorded', uri: 'a' }, { type: 'failed', error: 'Brak połączenia z internetem.' });
  expect(s).toMatchObject({ phase: 'listening', manual: true, error: 'Brak połączenia z internetem.' });
});

it('TTS failure: asking moves on to listening; confirming keeps the text for "Dalej"', () => {
  let s = run(initCheckin(habits, false), { type: 'start' }, { type: 'speakFailed', error: 'x' });
  expect(s).toMatchObject({ phase: 'listening', error: 'x' });

  s = run(s, { type: 'answered', answer: 'yes' }, { type: 'speakFailed', error: 'y' });
  expect(s).toMatchObject({ phase: 'confirming', error: 'y' });
  expect(run(s, { type: 'next' })).toMatchObject({ phase: 'asking', index: 1 });
});

it('skip marks the habit as skipped and moves on; skip while confirming just moves on', () => {
  let s = run(initCheckin(habits, false), { type: 'start' }, { type: 'skip' });
  expect(s).toMatchObject({ phase: 'asking', index: 1, skipped: ['vit_d_supplement'] });

  s = run(s, { type: 'spoken' }, { type: 'answered', answer: 'yes' }, { type: 'skip' });
  expect(s).toMatchObject({ phase: 'summary', skipped: ['vit_d_supplement'] });
});

it('stale async results (older step) are ignored', () => {
  const listening = atListening();
  const skipped = checkinReducer(listening, { type: 'skip' });
  expect(checkinReducer(skipped, { type: 'recorded', step: listening.step, uri: 'late' })).toBe(skipped);
});
