import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Test the provider boundary directly without building the app or calling paid APIs.
const bundle = await build({
  stdin: { contents: "export {createProviders, ServiceError} from './lib/providers.ts'", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { createProviders, ServiceError } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const tasks = {
  interview: 'GEMINI_INTERVIEW_MODEL',
  write: 'GEMINI_WRITING_MODEL',
  photo: 'GEMINI_PHOTO_MODEL',
  transcribe: 'GEMINI_TRANSCRIPTION_MODEL',
  research: 'GEMINI_RESEARCH_MODEL',
};
const credentials = { GOOGLE_CLOUD_PROJECT: 'routing-fixture', VERTEX_API_KEY: 'mock-cloud', GEMINI_API_KEY: 'mock-studio' };
const overrides = Object.fromEntries(Object.entries(tasks).map(([task, key]) => [key, `gemini-test-${task}`]));
const calls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
  return Response.json(String(url).includes('aiplatform.googleapis.com')
    ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'fixture output' }] } }] }
    : String(url).includes('openrouter.ai')
      ? { choices: [{ message: { content: 'fixture output' } }] }
      : { output_text: 'fixture output' });
};

try {
  for (const task of Object.keys(tasks)) {
    assert.equal(createProviders({}).modelFor(task), 'gemini-3.8-flash', 'Unconfigured tasks retain the existing default');
    assert.equal(createProviders({ GEMINI_MODEL: 'gemini-test-global' }).modelFor(task), 'gemini-test-global', 'Global model remains the fallback');
    assert.equal(createProviders({ GEMINI_MODEL: 'gemini-test-global', ...overrides }).modelFor(task), overrides[tasks[task]], 'Task override wins');
    assert.equal(createProviders({ GEMINI_MODEL: 'gemini-test-global', [tasks[task]]: '' }).modelFor(task), 'gemini-test-global', 'Empty environment values use the fallback');
  }

  // Language steering rides the same precedence: a routed language owns the
  // model for every text task, while en/es keep their Gemini task models even
  // with the zh route configured. Default-language construction — the
  // transcription and translation call sites — stays on Gemini. All fetches
  // are mocked; no paid API calls.
  const routedEnv = { ...credentials, GEMINI_MODEL: 'gemini-test-global', ...overrides, OPENROUTER_API_KEY: 'mock-openrouter' };
  assert.equal(createProviders(routedEnv).backend(), 'ai-studio', 'default-language construction (transcription, translation) stays on Gemini');
  for (const task of ['interview', 'write', 'photo', 'research']) {
    const zh = createProviders(routedEnv, 'zh');
    assert.equal(zh.modelFor(task), 'qwen/qwen3.8-flash', 'a routed language owns the model for every task');
    await zh.gemini('Fixture instructions', 'Fixture input', true);
    const routedCall = calls.at(-1);
    assert.equal(routedCall.url, 'https://openrouter.ai/api/v1/chat/completions', 'routed task calls dispatch to the route base URL');
    assert.equal(routedCall.body.model, 'qwen/qwen3.8-flash');
    assert.equal(routedCall.headers.Authorization, 'Bearer mock-openrouter');
    for (const language of ['en', 'es']) {
      const geminiProvider = createProviders(routedEnv, language);
      await geminiProvider.gemini('Fixture instructions', 'Fixture input', true, geminiProvider.modelFor(task));
      assert.equal(calls.at(-1).body.model, overrides[tasks[task]], `${language} keeps per-task Gemini models when the zh route is configured`);
    }
  }

  for (const backend of ['vertex', 'ai-studio']) {
    const provider = createProviders({ ...credentials, GEMINI_BACKEND: backend, GEMINI_MODEL: 'gemini-test-global', ...overrides });
    for (const task of Object.keys(tasks)) {
      const model = provider.modelFor(task);
      assert.equal(await provider.gemini('Fixture instructions', 'Fixture input', true, model), 'fixture output');
      const call = calls.at(-1);
      if (backend === 'vertex') {
        assert.ok(call.url.endsWith(`/models/${model}:generateContent`), 'Cloud URL dispatches to the selected task model');
        assert.equal(call.headers['x-goog-api-key'], credentials.VERTEX_API_KEY);
        assert.equal(call.body.generationConfig.responseMimeType, 'application/json');
        assert.equal(call.body.generationConfig.thinkingConfig, undefined, 'Do not assume arbitrary models support the default model thinking configuration');
      } else {
        assert.equal(call.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
        assert.equal(call.body.model, model, 'Studio request dispatches to the selected task model');
        assert.equal(call.headers['x-goog-api-key'], credentials.GEMINI_API_KEY);
        assert.equal(call.body.store, false);
      }
    }
    await provider.gemini('Fixture instructions', 'Fixture input', false);
    const legacyCall = calls.at(-1);
    assert.ok(backend === 'vertex'
      ? legacyCall.url.endsWith('/models/gemini-test-global:generateContent')
      : legacyCall.body.model === 'gemini-test-global', 'Existing callers retain global-model selection');
    if (backend === 'vertex') assert.equal(legacyCall.body.generationConfig.responseMimeType, undefined);
    else assert.equal(legacyCall.body.system_instruction, 'Fixture instructions');

    for (const invalid of ['../other-model', 'models/gemini-test', 'model?key=value', 'model\nheader', '', 'a'.repeat(129)]) {
      const before = calls.length;
      await assert.rejects(provider.gemini('Fixture', 'Fixture', true, invalid), error => error instanceof ServiceError && error.status === 503);
      assert.equal(calls.length, before, 'Invalid model IDs must fail before sending a request');
      if (invalid) assert.throws(() => createProviders({ GEMINI_INTERVIEW_MODEL: invalid }).modelFor('interview'), ServiceError);
    }
  }

  const defaultCloud = createProviders({ ...credentials, GEMINI_BACKEND: 'vertex' });
  await defaultCloud.gemini('Fixture', 'Fixture');
  assert.deepEqual(calls.at(-1).body.generationConfig.thinkingConfig, { thinkingLevel: 'LOW' }, 'Preserve the existing default-model cost control');

  const beforeMissingKey = calls.length;
  await assert.rejects(createProviders({ GEMINI_BACKEND: 'vertex', GOOGLE_CLOUD_PROJECT: 'routing-fixture', GEMINI_API_KEY: 'mock-studio' }).gemini('Fixture', 'Fixture'), ServiceError);
  assert.equal(calls.length, beforeMissingKey, 'Missing Cloud credentials must not fall back to Studio');
  let cloudAttempts = 0;
  globalThis.fetch = async url => {
    cloudAttempts++;
    assert.ok(String(url).includes('aiplatform.googleapis.com'), 'Failed Cloud requests must never fall back to Studio');
    return new Response('', { status: 403 });
  };
  await assert.rejects(defaultCloud.gemini('Fixture', 'Fixture', true, defaultCloud.modelFor('write')), error => error instanceof ServiceError && error.status === 503);
  assert.equal(cloudAttempts, 1);
} finally {
  globalThis.fetch = originalFetch;
}
console.log('Passed: per-step model precedence, both backend request formats, existing-call compatibility, ID validation, and no Cloud-to-Studio fallback.');
