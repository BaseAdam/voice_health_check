import { loadKeys } from '../api';
import { RECOMMENDATIONS } from '../domain/recommendations';
import { interpretAnswer, LLM_MODEL } from './llm';

// api.ts pulls in expo-router / secure-store; only loadKeys is needed here.
jest.mock('../api', () => ({ loadKeys: jest.fn() }));

const habit = RECOMMENDATIONS.ldl.high!.habit!;
const QUESTION = habit.question;
const fetchMock = jest.fn();
const keys = (groq: string) => ({ groq: { value: groq, source: groq ? 'settings' : 'none' } });

const reply = (content: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
});

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  (loadKeys as jest.Mock).mockResolvedValue(keys('gsk_test'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

it('sends a strict json_schema request with the transcript as data and parses the answer', async () => {
  fetchMock.mockResolvedValue(reply(JSON.stringify({ answer: 'yes', detail: 'jabłko' })));

  expect(await interpretAnswer(QUESTION, habit, 'zjadłem jabłko')).toEqual({ answer: 'yes', detail: 'jabłko' });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
  expect(init.headers.Authorization).toBe('Bearer gsk_test');
  const body = JSON.parse(init.body);
  expect(body.model).toBe(LLM_MODEL);
  expect(body.response_format.type).toBe('json_schema');
  expect(body.response_format.json_schema.strict).toBe(true);
  expect(body.messages[1].content).toContain('"zjadłem jabłko"');
  expect(body.messages[1].content).toContain('płatki owsiane');
});

it('null detail is omitted; detail is sanitized and capped', async () => {
  fetchMock.mockResolvedValueOnce(reply(JSON.stringify({ answer: 'no', detail: null })));
  expect(await interpretAnswer(QUESTION, habit, 'nie')).toEqual({ answer: 'no' });

  fetchMock.mockResolvedValueOnce(reply(JSON.stringify({ answer: 'yes', detail: `<b>${'ż'.repeat(80)}</b>` })));
  const { detail } = await interpretAnswer(QUESTION, habit, 'tak');
  expect(detail).toMatch(/^[bż]+$/);
  expect(detail!.length).toBeLessThanOrEqual(60);
});

it.each([
  ['invalid JSON content', () => reply('not json')],
  ['missing content', () => reply(undefined)],
  ['schema mismatch', () => reply(JSON.stringify({ answer: 'maybe', detail: null }))],
  ['HTTP 401', () => ({ ok: false, status: 401, json: async () => ({}) })],
  ['HTTP 500', () => ({ ok: false, status: 500, json: async () => ({}) })],
])('%s → unclear', async (_name, response) => {
  fetchMock.mockResolvedValue(response());
  expect(await interpretAnswer(QUESTION, habit, 'tak')).toEqual({ answer: 'unclear' });
});

it('network error → unclear', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));
  expect(await interpretAnswer(QUESTION, habit, 'tak')).toEqual({ answer: 'unclear' });
});

it('missing key or empty transcript → unclear without calling the API', async () => {
  (loadKeys as jest.Mock).mockResolvedValue(keys(''));
  expect(await interpretAnswer(QUESTION, habit, 'tak')).toEqual({ answer: 'unclear' });
  (loadKeys as jest.Mock).mockResolvedValue(keys('gsk_test'));
  expect(await interpretAnswer(QUESTION, habit, '   ')).toEqual({ answer: 'unclear' });
  expect(fetchMock).not.toHaveBeenCalled();
});
