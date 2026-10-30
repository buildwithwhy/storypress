import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Language routing: zh story text follows the OpenAI-compatible adapter when
// OPENROUTER_API_KEY is configured, en/es stay on Gemini, and every
// unconfigured or failed route degrades to Gemini. All fetches are mocked —
// no paid API calls.

const bundle = await build({
  stdin: { contents: "export {createProviders, ServiceError, textRoute} from './lib/providers.ts'", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { createProviders, ServiceError, textRoute } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const env = { OPENROUTER_API_KEY: 'mock-openrouter', GEMINI_API_KEY: 'mock-gemini' };

// Route table steering, decided without any network call.
assert.deepEqual(textRoute({}, 'zh'), { provider: 'gemini' }, 'zh without a key stays on Gemini');
assert.deepEqual(textRoute({ OPENROUTER_API_KEY: 'k' }, 'zh'), { provider: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', apiKeyEnv: 'OPENROUTER_API_KEY', model: 'qwen/qwen3.8-flash' }, 'the zh default model matches the approved spec');
assert.equal(textRoute({ OPENROUTER_API_KEY: 'k', STORYPRESS_ZH_TEXT_MODEL: 'qwen/qwen-test' }, 'zh').model, 'qwen/qwen-test', 'STORYPRESS_ZH_TEXT_MODEL overrides the zh model');
for (const language of ['en', 'es']) assert.deepEqual(textRoute({ OPENROUTER_API_KEY: 'k' }, language), { provider: 'gemini' }, `${language} never routes off Gemini`);

const calls = [];
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
let fallbackLogs = 0;
console.error = (...args) => { if (String(args[0]).includes('[language-routing]')) fallbackLogs++; else originalConsoleError(...args); };

const assertGeminiCall = () => { assert.equal(calls.at(-1).url, GEMINI_URL); return calls.at(-1); };

try {
  // zh + key: the adapter serves the routed call with the configured model.
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    return String(url).includes('openrouter.ai')
      ? Response.json({ choices: [{ message: { content: 'fixture output' } }] })
      : Response.json({ output_text: 'fixture output' });
  };
  const zh = createProviders(env, 'zh');
  assert.equal(await zh.gemini('Fixture instructions', 'Fixture input', true), 'fixture output');
  assert.equal(calls.length, 1, 'a routed call must not touch Gemini');
  let call = calls[0];
  assert.equal(call.url, CHAT_URL);
  assert.equal(call.headers.Authorization, 'Bearer mock-openrouter');
  assert.equal(call.body.model, 'qwen/qwen3.8-flash');
  assert.deepEqual(call.body.response_format, { type: 'json_object' });
  assert.equal(call.body.messages[0].role, 'system');
  assert.ok(call.body.messages[0].content.startsWith('Fixture instructions'));
  assert.equal(call.body.messages[1].content, 'Fixture input');
  assert.equal(zh.modelFor('interview'), 'qwen/qwen3.8-flash');
  assert.equal(zh.backend(), 'openai-compatible');
  assert.equal(zh.modelConfigured(), true);

  // Non-JSON and image-bearing inputs (photo analysis) map to the adapter contract.
  await zh.gemini('Describe the photograph', [{ type: 'text', text: 'context' }, { type: 'image', data: 'abc', mime_type: 'image/jpeg' }], false);
  call = calls.at(-1);
  assert.equal(call.body.response_format, undefined, 'non-JSON calls omit response_format');
  assert.deepEqual(call.body.messages[1].content[1], { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc' } });

  // en/es with a configured key still call Gemini.
  for (const language of ['en', 'es']) {
    const provider = createProviders(env, language);
    assert.equal(await provider.gemini('Fixture instructions', 'Fixture input', true), 'fixture output');
    assertGeminiCall();
  }

  // zh without a key degrades to Gemini at construction.
  const zhDegraded = createProviders({ GEMINI_API_KEY: 'mock-gemini' }, 'zh');
  assert.equal(await zhDegraded.gemini('Fixture instructions', 'Fixture input', true), 'fixture output');
  assertGeminiCall();

  // A failed routed call logs and falls back to Gemini for that call.
  calls.length = 0;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    if (String(url).includes('openrouter.ai')) return new Response('', { status: 503 });
    return Response.json({ output_text: 'gemini output' });
  };
  const logsBefore = fallbackLogs;
  assert.equal(await zh.gemini('Fixture instructions', 'Fixture input', true), 'gemini output');
  assert.deepEqual(calls.map(c => c.url), [CHAT_URL, GEMINI_URL], 'a failed routed call must retry once on Gemini');
  assert.equal(calls[1].body.model, 'gemini-3.8-flash', 'the completion fallback must use a valid Gemini model id');
  assert.equal(fallbackLogs, logsBefore + 1, 'a routed failure must leave a server log line');

  // Interview streaming maps SSE deltas into the AsyncIterable shape.
  calls.length = 0;
  const sse = ['data: ' + JSON.stringify({ choices: [{ delta: { content: '你好' } }] }), '', 'data: ' + JSON.stringify({ choices: [{ delta: { content: '，世界' } }] }), '', 'data: [DONE]', ''].join('\n');
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(new ReadableStream({ start: controller => { controller.enqueue(new TextEncoder().encode(sse)); controller.close(); } }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  };
  const chunks = [];
  for await (const chunk of zh.interviewStream('Fixture instructions', 'Fixture input', zh.modelFor('interview'), new AbortController().signal)) chunks.push(chunk);
  assert.deepEqual(chunks, ['你好', '，世界']);
  assert.equal(calls[0].url, CHAT_URL);
  assert.equal(calls[0].body.stream, true);

  // A routed stream that fails before its first chunk falls back to Gemini.
  calls.length = 0;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    if (String(url).includes('openrouter.ai')) return new Response('', { status: 502 });
    return Response.json({ output_text: 'gemini stream' });
  };
  const fallbackChunks = [];
  for await (const chunk of zh.interviewStream('Fixture instructions', 'Fixture input', zh.modelFor('interview'), new AbortController().signal)) fallbackChunks.push(chunk);
  assert.deepEqual(fallbackChunks, ['gemini stream']);
  assert.deepEqual(calls.map(c => c.url), [CHAT_URL, GEMINI_URL]);
  assert.equal(calls[1].body.model, 'gemini-3.8-flash', 'the stream fallback must use a valid Gemini model id, not the routed one');

  // Misconfigured routed model names fail the same way Gemini model ids do.
  const misconfigured = createProviders({ ...env, STORYPRESS_ZH_TEXT_MODEL: 'bad model' }, 'zh');
  assert.throws(() => misconfigured.modelFor('interview'), error => error instanceof ServiceError && error.status === 503);
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
}
console.log('check-language-routing: PASS');
