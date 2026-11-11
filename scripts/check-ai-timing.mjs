import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Wave 7 PR A timing instrumentation: one {event:'ai_call'|'db_call'} line per
// AI provider call and per Supabase roundtrip, in the PR #44 {event:...}
// console convention. Proves the line shape (task/model/backend/language/
// thinking/vertexLocation/ttftMs/totalMs/status/tokens) across every call
// type, the Vertex region field, streamed-usage capture, fallback
// double-logging, Server-Timing on non-streaming JSON only, and the privacy
// invariant: no prompt text, story content, emails, or raw user ids in any
// line. All fetches are mocked; no paid API calls.
const bundle = await build({
  stdin: { contents: [
    "export {createProviders, ServiceError} from './lib/providers.ts';",
    "export {generateStoryImage} from './lib/image-provider.ts';",
    "export {db, identity} from './server/storage.ts';",
    "export {handleApi} from './server/api.ts';",
  ].join(''), resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { createProviders, generateStoryImage, db, identity, handleApi } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

// Markers that must never reach a log line: prompt text, story content, an
// email, and raw user/story ids. The sweep at the end asserts all of them.
const PROMPT = 'PROMPT-TEXT-MUST-NOT-LOG';
const STORY = 'STORY-CONTENT-MUST-NOT-LOG';
const EMAIL = 'narrator@example.invalid';
const USER_ID = 'a1111111-2222-4333-8444-555555555555';
const STORY_ID = 'b1111111-2222-4333-8444-555555555555';

const lines = [];
const originalError = console.error;
console.error = (...args) => {
  for (const arg of args) {
    try { lines.push(JSON.parse(String(arg))); } catch { lines.push({ nonjson: String(arg) }); }
  }
};
const originalFetch = globalThis.fetch;
// Some fixtures stream SSE; strings pass through verbatim ('[DONE]').
const sse = (events) => new Response(new ReadableStream({ start: controller => {
  controller.enqueue(new TextEncoder().encode(events.map(e => 'data: ' + (typeof e === 'string' ? e : JSON.stringify(e))).join('\n\n') + '\n\n'));
  controller.close();
} }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
const callLines = () => lines.filter(l => l.event === 'ai_call' || l.event === 'db_call');
const AI_FIELDS = ['event', 'task', 'model', 'backend', 'language', 'thinking', 'vertexLocation', 'ttftMs', 'totalMs', 'status'];
const DB_FIELDS = ['event', 'task', 'model', 'backend', 'ttftMs', 'totalMs', 'status'];
const assertAiShape = line => {
  for (const key of AI_FIELDS) assert.ok(key in line, `ai_call line missing ${key}: ${JSON.stringify(line)}`);
  assert.equal(typeof line.task, 'string', 'task is a string');
  assert.equal(typeof line.model, 'string', 'model is a string');
  assert.equal(typeof line.backend, 'string', 'backend is a string');
  assert.equal(typeof line.ttftMs, 'number', 'ttftMs is a number (or null)');
  assert.equal(typeof line.totalMs, 'number', 'totalMs is a number');
  assert.ok(line.ttftMs >= 0 && line.ttftMs <= line.totalMs, 'ttft precedes the total');
  assert.ok(['ok', 'error'].includes(line.status), 'status is ok or error');
};
const assertDbShape = line => {
  for (const key of DB_FIELDS) assert.ok(key in line, `db_call line missing ${key}: ${JSON.stringify(line)}`);
  assert.ok(typeof line.ttftMs === 'number' && typeof line.totalMs === 'number');
  assert.ok(['ok', 'error'].includes(line.status));
};

const VERTEX_ENV = { GEMINI_BACKEND: 'vertex', GOOGLE_CLOUD_PROJECT: 'fixture-project', VERTEX_API_KEY: 'k', GOOGLE_CLOUD_LOCATION: 'us-east5' };

try {
  // --- A. Vertex whole-result: region, thinking, mapped tokens, one line per call.
  globalThis.fetch = async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'fixture output' }] } }], usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7, thoughtsTokenCount: 3 } });
  const vertex = createProviders(VERTEX_ENV, 'en');
  lines.length = 0;
  await vertex.gemini(`${PROMPT} instructions`, `${STORY} input`, true, vertex.modelFor('write'), 'write');
  assert.equal(callLines().length, 1, 'one provider call emits exactly one line');
  assertAiShape(callLines()[0]);
  assert.equal(callLines()[0].event, 'ai_call');
  assert.equal(callLines()[0].task, 'write');
  assert.equal(callLines()[0].model, 'gemini-3.8-flash');
  assert.equal(callLines()[0].backend, 'vertex');
  assert.equal(callLines()[0].language, 'en');
  assert.equal(callLines()[0].thinking, 'LOW', 'the default model carries thinkingLevel LOW on GenerateContent paths');
  assert.equal(callLines()[0].vertexLocation, 'us-east5', 'Vertex lines report the resolved region');
  assert.deepEqual(callLines()[0].tokens, { input: 11, output: 7, thinking: 3 });

  // --- B. Vertex stream: TTFT at the first chunk, usageMetadata from the final event.
  globalThis.fetch = async () => sse([
    { candidates: [{ content: { parts: [{ text: '{"question":"' }] } }] },
    { candidates: [{ content: { parts: [{ text: 'How now?"}' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 9, thoughtsTokenCount: 4 } },
  ]);
  lines.length = 0;
  const chunks = [];
  for await (const chunk of vertex.interviewStream(`${PROMPT} instructions`, STORY, vertex.modelFor('interview'), new AbortController().signal, 'interview')) chunks.push(chunk);
  assert.equal(chunks.join(''), '{"question":"How now?"}', 'streaming text is unchanged');
  assert.equal(callLines().length, 1, 'one streamed call emits exactly one line');
  assertAiShape(callLines()[0]);
  assert.equal(callLines()[0].task, 'interview');
  assert.equal(callLines()[0].backend, 'vertex');
  assert.equal(callLines()[0].vertexLocation, 'us-east5');
  assert.deepEqual(callLines()[0].tokens, { input: 5, output: 9, thinking: 4 }, 'final-event usageMetadata is captured');
  // A model override drops the thinking config, and the line must agree.
  globalThis.fetch = async () => sse([{ candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] }]);
  lines.length = 0;
  for await (const chunk of vertex.interviewStream(PROMPT, STORY, 'gemini-test', new AbortController().signal, 'interview')) void chunk;
  assert.equal(callLines()[0].thinking, null, 'a non-default model reports thinking null');
  // No usageMetadata in the stream, no tokens field at all.
  globalThis.fetch = async () => sse([{ candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] }]);
  lines.length = 0;
  for await (const chunk of vertex.interviewStream(PROMPT, STORY, vertex.modelFor('interview'), new AbortController().signal, 'interview')) void chunk;
  assert.ok(!('tokens' in callLines()[0]), 'tokens omitted when the stream carried none');

  // --- C. AI-Studio whole-result: the resolved thinking level reaches the
  // interactions body too (default LOW for the default model), unverified
  // usage shape logged raw, vertexLocation null.
  globalThis.fetch = async () => Response.json({ output_text: 'fixture output', usage: { unverifiedField: 'shape-1', otherCount: 4 } });
  const studio = createProviders({ GEMINI_API_KEY: 'k', NIMBLE_API_KEY: 'fixture-nimble' }, 'en');
  lines.length = 0;
  await studio.gemini(PROMPT, STORY, true, undefined, 'research');
  assert.equal(callLines().length, 1);
  assertAiShape(callLines()[0]);
  assert.equal(callLines()[0].backend, 'ai-studio');
  assert.equal(callLines()[0].thinking, 'LOW', 'the interactions body carries the default-model thinking level');
  assert.equal(callLines()[0].vertexLocation, null, 'non-Vertex lines carry no region');
  assert.deepEqual(callLines()[0].tokens, { raw: { unverifiedField: 'shape-1', otherCount: 4 } }, 'unverified usage shapes are logged raw');

  // --- D. AI-Studio stream on the default model: thinking LOW, mapped tokens.
  globalThis.fetch = async () => sse([
    { candidates: [{ content: { parts: [{ text: 'partial' }] } }] },
    { candidates: [{ content: { parts: [{ text: ' reply' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 6 } },
  ]);
  lines.length = 0;
  for await (const chunk of studio.interviewStream(PROMPT, STORY, studio.modelFor('interview'), new AbortController().signal, 'interview')) void chunk;
  assert.equal(callLines().length, 1);
  assertAiShape(callLines()[0]);
  assert.equal(callLines()[0].backend, 'ai-studio');
  assert.equal(callLines()[0].thinking, 'LOW');
  assert.deepEqual(callLines()[0].tokens, { input: 2, output: 6 });

  // --- E. OpenRouter route: mapped usage on whole-result, raw on streamed.
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: 'fixture output' } }], usage: { prompt_tokens: 10, completion_tokens: 5, completion_tokens_details: { reasoning_tokens: 2 } } });
  // The routed provider's Gemini fallback needs a Gemini key of its own.
  const zh = createProviders({ OPENROUTER_API_KEY: 'k', GEMINI_API_KEY: 'k' }, 'zh');
  lines.length = 0;
  await zh.gemini(PROMPT, STORY, true, undefined, 'write');
  assert.equal(callLines().length, 1);
  assertAiShape(callLines()[0]);
  assert.equal(callLines()[0].backend, 'openai-compatible');
  assert.equal(callLines()[0].model, 'qwen/qwen3.8-flash');
  assert.equal(callLines()[0].language, 'zh');
  assert.equal(callLines()[0].thinking, null);
  assert.equal(callLines()[0].vertexLocation, null);
  assert.deepEqual(callLines()[0].tokens, { input: 10, output: 5, thinking: 2 }, 'chat-completions usage is mapped');
  globalThis.fetch = async () => sse([
    { choices: [{ delta: { content: '你好' } }] },
    { choices: [{ delta: { content: '，世界' } }] },
    { choices: [], usage: { prompt_tokens: 9, completion_tokens: 4 } },
    '[DONE]',
  ]);
  lines.length = 0;
  const routed = [];
  for await (const chunk of zh.interviewStream(PROMPT, STORY, zh.modelFor('interview'), new AbortController().signal, 'interview')) routed.push(chunk);
  assert.deepEqual(routed, ['你好', '，世界'], 'routed streaming text is unchanged');
  assert.equal(callLines().length, 1);
  assert.equal(callLines()[0].status, 'ok');
  assert.deepEqual(callLines()[0].tokens, { raw: { prompt_tokens: 9, completion_tokens: 4 } }, 'OpenRouter streamed usage is logged raw, not guessed');

  // --- F. A routed stream failing before its first chunk logs the failed call
  // AND the Gemini fallback that served the user.
  globalThis.fetch = async url => String(url).includes('openrouter.ai') ? new Response('', { status: 502 }) : Response.json({ output_text: '{"question":"Gemini fallback?"}' });
  lines.length = 0;
  const fallbackChunks = [];
  for await (const chunk of zh.interviewStream(PROMPT, STORY, zh.modelFor('interview'), new AbortController().signal, 'interview')) fallbackChunks.push(chunk);
  assert.equal(fallbackChunks.join(''), '{"question":"Gemini fallback?"}');
  assert.equal(callLines().length, 2, 'fallback shows as an error line plus the retry that served it');
  assert.equal(callLines()[0].status, 'error');
  assert.equal(callLines()[0].backend, 'openai-compatible');
  assert.equal(callLines()[1].status, 'ok');
  assert.equal(callLines()[1].backend, 'ai-studio');
  assert.equal(callLines()[1].model, 'gemini-3.8-flash', 'the Gemini fallback keeps the task model');

  // --- G. Nimble search is timed as a dependency without a token concept.
  globalThis.fetch = async () => Response.json({ results: [{ title: 't', url: 'https://fixture.example/a', content: 'c' }] });
  lines.length = 0;
  await studio.nimble('fixture query', 'en');
  assert.equal(callLines().length, 1);
  assertAiShape(callLines()[0]);
  assert.equal(callLines()[0].task, 'nimble');
  assert.equal(callLines()[0].backend, 'nimble');
  assert.ok(!('tokens' in callLines()[0]));

  // --- H. Illustration: Vertex call carries the region and usageMetadata.
  const png = 'iVBORw0KGgoAAAANSUhEUg==';
  globalThis.fetch = async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } });
  lines.length = 0;
  await generateStoryImage(VERTEX_ENV, { language: 'en', style: 'illustration', words: [`${STORY} memory`] });
  assert.equal(callLines().length, 1);
  assertAiShape(callLines()[0]);
  assert.equal(callLines()[0].task, 'illustrate');
  assert.equal(callLines()[0].backend, 'vertex');
  assert.equal(callLines()[0].vertexLocation, 'us-east5');
  assert.equal(callLines()[0].language, 'en');
  assert.deepEqual(callLines()[0].tokens, { input: 3, output: 2 });

  // --- I. Supabase: db() names the roundtrip without its query string, and
  // identity() is timed even though it sits outside db().
  const supaEnv = { SUPABASE_URL: 'https://supabase.fixture', SUPABASE_PUBLISHABLE_KEY: 'pub', SUPABASE_SECRET_KEY: 'secret' };
  globalThis.fetch = async () => Response.json([{ id: 'row' }]);
  lines.length = 0;
  await db(supaEnv, `storypress_stories?id=eq.${STORY_ID}&owner_id=eq.${USER_ID}&select=data`);
  assert.equal(callLines().length, 1);
  assertDbShape(callLines()[0]);
  assert.equal(callLines()[0].event, 'db_call');
  assert.equal(callLines()[0].task, 'GET storypress_stories', 'the task strips the query string');
  assert.equal(callLines()[0].model, 'postgrest');
  assert.equal(callLines()[0].backend, 'supabase');
  globalThis.fetch = async () => Response.json({ id: USER_ID, email: EMAIL });
  lines.length = 0;
  const user = await identity(new Request('https://app.test/api/story', { headers: { Authorization: 'Bearer fixture' } }), supaEnv);
  assert.equal(user?.id, USER_ID, 'the return value still carries the id for callers');
  assert.equal(callLines().length, 1);
  assertDbShape(callLines()[0]);
  assert.equal(callLines()[0].task, 'GET auth/v1/user');
  assert.ok(!JSON.stringify(callLines()[0]).includes(EMAIL));

  // --- J. Error statuses: provider HTTP error, fetch-level failure (no ttft),
  // an interrupted stream, and a Supabase error — each exactly one line.
  globalThis.fetch = async () => new Response('', { status: 500 });
  lines.length = 0;
  await assert.rejects(() => studio.gemini(PROMPT, STORY, true, undefined, 'write'));
  assert.equal(callLines().length, 1);
  assert.equal(callLines()[0].status, 'error');
  assertAiShape(callLines()[0]);
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  lines.length = 0;
  await assert.rejects(() => studio.gemini(PROMPT, STORY, true, undefined, 'write'));
  assert.equal(callLines().length, 1);
  assert.equal(callLines()[0].status, 'error');
  assert.equal(callLines()[0].ttftMs, null, 'a fetch that never answered has no ttft');
  globalThis.fetch = async () => sse([{ candidates: [{ content: { parts: [{ text: 'partial' }] } }] }]);
  lines.length = 0;
  await assert.rejects(async () => { for await (const chunk of studio.interviewStream(PROMPT, STORY, studio.modelFor('interview'), new AbortController().signal, 'interview')) void chunk; });
  assert.equal(callLines().length, 1);
  assert.equal(callLines()[0].status, 'error', 'an interrupted stream reports error');
  assert.equal(typeof callLines()[0].ttftMs, 'number');
  globalThis.fetch = async () => new Response('nope', { status: 403 });
  lines.length = 0;
  await assert.rejects(() => db(supaEnv, 'storypress_stories?select=data'));
  assert.equal(callLines().length, 1);
  assertDbShape(callLines()[0]);
  assert.equal(callLines()[0].status, 'error');

  // --- K. Server-Timing on non-streaming JSON responses only.
  const apiEnv = { GEMINI_API_KEY: 'fixture-key' };
  const apiRequest = body => new Request('https://app.test/api/story', { method: 'POST', headers: { 'oai-authenticated-user-id': USER_ID, Origin: 'https://app.test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  globalThis.fetch = async () => Response.json({ output_text: 'fixture transcript' });
  const transcriptResponse = await handleApi(apiRequest({ action: 'transcribe', audio: { data: 'QQ==', mime: 'audio/wav' } }), apiEnv);
  assert.equal(transcriptResponse.status, 200);
  const serverTiming = transcriptResponse.headers.get('Server-Timing');
  assert.match(serverTiming, /(^|,)\s*identity;dur=\d+/, 'the identity span rides the JSON response');
  assert.match(serverTiming, /ai_transcribe;dur=\d+/, 'the AI span rides the JSON response');
  globalThis.fetch = async () => sse([{ candidates: [{ content: { parts: [{ text: '{"question":"How now?"}' }] }, finishReason: 'STOP' }] }]);
  const streamResponse = await handleApi(apiRequest({ action: 'interview', stream: true, story: { name: '', language: 'en', occasion: 'life', turns: [], sources: [], sample: false, approved: false } }), apiEnv);
  assert.equal(streamResponse.headers.get('Content-Type'), 'text/event-stream; charset=utf-8');
  assert.equal(streamResponse.headers.get('Server-Timing'), null, 'SSE responses never carry late timings');

  // --- L. Privacy sweep over every line this run emitted.
  assert.ok(lines.length > 0, 'the run produced log lines to sweep');
  for (const line of lines) {
    const text = JSON.stringify(line);
    assert.ok(!text.includes(PROMPT), 'no prompt text in log lines');
    assert.ok(!text.includes(STORY), 'no story content in log lines');
    assert.ok(!text.includes('@'), 'no emails in log lines');
    assert.ok(!text.includes(USER_ID), 'no raw user ids in log lines');
    assert.ok(!text.includes(STORY_ID), 'no raw story ids in log lines');
  }
  for (const line of callLines()) {
    const fields = line.event === 'ai_call' ? AI_FIELDS : DB_FIELDS;
    for (const key of Object.keys(line)) assert.ok(fields.includes(key), `unexpected field ${key} on ${line.event}`);
  }
  console.error = originalError;
  globalThis.fetch = originalFetch;
  console.log(`check-ai-timing: ${lines.length} log lines swept across ${callLines().length} instrumented calls; all shapes and the privacy invariant hold.`);
} finally {
  console.error = originalError;
  globalThis.fetch = originalFetch;
}
