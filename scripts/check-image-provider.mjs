import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: "export {generateStoryImage,imageModel} from './lib/image-provider.ts'; export {ServiceError} from './lib/providers.ts'", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { generateStoryImage, imageModel, ServiceError } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const env = { GEMINI_BACKEND: 'vertex', GOOGLE_CLOUD_PROJECT: 'image-fixture', VERTEX_API_KEY: 'mock-cloud-key', GEMINI_API_KEY: 'mock-studio-key' };
const input = { language: 'en', style: 'illustration',instructions:'I am a woman with short hair. Make it cozy.', words: ['I made pancakes with my father in a small kitchen.'], paper: { headline: 'PRIVATE_GHOSTWRITER_ADDITION', paragraphs: ['An invented detail must never become visual evidence.'] } };
const jpeg = '/9j/4AAQSkZJRgABAQ==';
const imageResponse = (data = jpeg, mimeType = 'image/jpeg') => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, inlineData: { mimeType: 'image/jpeg', data: 'PRIVATE_THOUGHT' } }, { inlineData: { mimeType, data } }] } }] });
let nextBody = imageResponse();
let nextStatus = 200;
let calls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options, body: JSON.parse(options.body) }); return Response.json(nextBody, { status: nextStatus }); };

try {
  assert.equal(imageModel({}), 'gemini-3.1-flash-lite-image');
  assert.equal(imageModel({ GEMINI_IMAGE_MODEL: 'gemini-test-image' }), 'gemini-test-image');
  assert.throws(() => imageModel({ GEMINI_IMAGE_MODEL: '../bad-model' }), ServiceError);
  const image = await generateStoryImage(env, input);
  assert.equal(image.data, `data:image/jpeg;base64,${jpeg}`);
  assert.equal(image.model, 'gemini-3.1-flash-lite-image');
  const first = calls[0];
  assert.ok(first.url.startsWith('https://aiplatform.googleapis.com/v1/projects/image-fixture/locations/global/'));
  assert.ok(first.url.endsWith('/models/gemini-3.1-flash-lite-image:generateContent'));
  assert.equal(first.options.headers['x-goog-api-key'], env.VERTEX_API_KEY);
  assert.ok(first.options.signal instanceof AbortSignal);
  assert.deepEqual(first.body.generationConfig, { responseModalities: ['TEXT', 'IMAGE'], candidateCount: 1, imageConfig: { aspectRatio: '3:2' } });
  assert.deepEqual(JSON.parse(first.body.contents[0].parts[0].text).originalWords, input.words);
  assert.equal(JSON.parse(first.body.contents[0].parts[0].text).artDirection,input.instructions);
  assert.match(first.body.systemInstruction.parts[0].text,/Never infer gender from a name, voice/);
  assert.match(first.body.systemInstruction.parts[0].text,/cute, cozy hand-drawn storybook/);
  const beforeBadDirection=calls.length;
  await assert.rejects(generateStoryImage(env,{...input,instructions:'x'.repeat(601)}),error=>error.status===400);
  assert.equal(calls.length,beforeBadDirection);
  assert.ok(!JSON.stringify(first.body).includes('PRIVATE_GHOSTWRITER_ADDITION'));
  assert.ok(!JSON.stringify(first.body).includes('mock-cloud-key'));
  assert.ok(first.body.systemInstruction.parts[0].text.includes('not a historical photograph'));
  assert.ok(first.body.systemInstruction.parts[0].text.includes('simplified figures'));
  await generateStoryImage({ ...env, GOOGLE_CLOUD_LOCATION: 'us-central1', GEMINI_IMAGE_MODEL: 'gemini-test-image' }, { ...input, style: 'comic' });
  assert.ok(calls.at(-1).url.startsWith('https://us-central1-aiplatform.googleapis.com/'));
  assert.ok(calls.at(-1).url.endsWith('/models/gemini-test-image:generateContent'));
  assert.ok(calls.at(-1).body.systemInstruction.parts[0].text.includes('wordless three-panel comic'));

  const beforeInvalid = calls.length;
  for (const settings of [{ ...env, VERTEX_API_KEY: '' }, { ...env, GEMINI_BACKEND: 'ai-studio' }, { ...env, GOOGLE_CLOUD_PROJECT: '../bad' }, { ...env, GOOGLE_CLOUD_LOCATION: 'global?bad' }, { ...env, GEMINI_IMAGE_MODEL: 'bad/path' }]) {
    await assert.rejects(generateStoryImage(settings, input), error => error instanceof ServiceError && error.status === 503);
  }
  for (const bad of [{ ...input, words: [] }, { ...input, words: [' '] }, { ...input, words: ['a'.repeat(12001)] }, { ...input, words: Array(6).fill('a'.repeat(11000)) }, { ...input, style: 'unknown' }]) await assert.rejects(generateStoryImage(env, bad), error => error instanceof ServiceError && error.status === 400);
  assert.equal(calls.length, beforeInvalid, 'Invalid input or Cloud settings must not send requests or fall back to Studio');

  for (const [mime, data] of [['image/png', 'iVBORw0KGgo='], ['image/webp', 'UklGRgAAAABXRUJQ']]) {
    nextBody = imageResponse(data, mime);
    assert.equal((await generateStoryImage(env, input)).data, `data:${mime};base64,${data}`);
  }
  for (const [mime, data] of [['image/svg+xml', 'PHN2Zz4='], ['image/png', jpeg], ['image/jpeg', 'not+base64'], ['image/jpeg', ''], ['image/jpeg', '/9j/' + 'A'.repeat(8 * 1024 * 1024)]]) {
    nextBody = imageResponse(data, mime);
    await assert.rejects(generateStoryImage(env, input), error => error instanceof ServiceError && error.message.includes('kept'));
  }
  for (const body of [{ candidates: [] }, { promptFeedback: { blockReason: 'SAFETY' } }, { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] }, { candidates: [{ content: { parts: [{ text: 'No image' }] } }] }, { candidates: [{ content: { parts: [{ thought: true, inlineData: { mimeType: 'image/jpeg', data: jpeg } }] } }] }, { candidates: [{ content: { parts: {} } }] }]) {
    nextBody = body;
    await assert.rejects(generateStoryImage(env, input), error => error instanceof ServiceError && error.message.includes('kept'));
  }
  for (const [upstream, expected] of [[429, 429], [401, 503], [402, 503], [403, 503], [404, 503], [500, 502]]) {
    nextStatus = upstream; nextBody = { error: { message: 'PRIVATE_PROVIDER_ERROR' } };
    const before = calls.length;
    await assert.rejects(generateStoryImage(env, input), error => error instanceof ServiceError && error.status === expected && !error.message.includes('PRIVATE_PROVIDER_ERROR'));
    assert.equal(calls.length, before + 1, 'Failed Cloud calls must not retry on AI Studio');
  }
  globalThis.fetch = async () => { throw new DOMException('Timeout fixture', 'TimeoutError'); };
  await assert.rejects(generateStoryImage(env, input), error => error instanceof ServiceError && error.status === 504 && error.message.includes('kept'));
} finally { globalThis.fetch = originalFetch; }
console.log('Passed: story-grounded illustration/comic requests, Cloud-only model routing, thought exclusion, image MIME/signature/size validation, and preserved-art errors. No paid calls.');
