import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: "export {handleApi} from './server/api.ts'", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.txt': 'text', '.jpg': 'dataurl' } });
const { handleApi } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const userId = 'c60a25ef-f588-4df5-a89f-dcb1ea1a6470';
const env = { GEMINI_BACKEND: 'vertex', GOOGLE_CLOUD_PROJECT: 'image-fixture', VERTEX_API_KEY: 'mock-cloud', GEMINI_IMAGE_MODEL: 'gemini-test-image', SUPABASE_URL: 'https://storage-fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'mock-publishable', SUPABASE_SECRET_KEY: 'mock-secret', NIMBLE_API_KEY: 'mock-search' };
const jpeg = '/9j/4AAQSkZJRgABAQ==';
const story = {
  name: 'PRIVATE_PROFILE_NAME', language: 'en', occasion: 'life', sample: false, approved: false,
  turns: [{ role: 'assistant', text: 'PRIVATE_ASSISTANT_GUESS' }, { role: 'user', text: 'I made pancakes with my father in a small kitchen.' }],
  sources: [{ id: 'fixture', title: 'PRIVATE_SOURCE_TEXT', url: 'https://example.org/history', publisher: 'Archive', date: '1960', description: 'PRIVATE_RESEARCH_DESCRIPTION', connection: 'PRIVATE_RESEARCH_CONNECTION', question: 'PRIVATE_RESEARCH_QUESTION', selected: true }],
  photo: `data:image/jpeg;base64,${jpeg}`, photoCaption: 'PRIVATE_PHOTO_CAPTION',
  photoAnalysis: { visibleDetails: ['PRIVATE_PHOTO_ANALYSIS'], possibleContext: [], question: 'PRIVATE_PHOTO_QUESTION', searchQueries: [] },
  paper: { headline: 'PRIVATE_GHOSTWRITER_HEADLINE', standfirst: 'PRIVATE_GHOSTWRITER_STANDFIRST', paragraphs: ['PRIVATE_GHOSTWRITER_PARAGRAPH'], quote: '' },
  generatedArt: { data: `data:image/jpeg;base64,${jpeg}`, style: 'illustration', model: 'old-model', sourceKey: 'old-fixture' }, artwork: 'generated',
};
const request = (extra = {}, signedIn = true) => new Request('https://story.test/api/story', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://story.test', ...(signedIn ? { Authorization: 'Bearer mock-user-jwt' } : {}) }, body: JSON.stringify({ action: 'illustrate', imageStyle: 'illustration', story, ...extra }) });
const originalFetch = globalThis.fetch;
let queue = [];
let calls = [];
globalThis.fetch = async (url, options) => {
  const next = queue.shift();
  assert.ok(next, 'Unexpected external call');
  const call = { url: String(url), options, body: options.body ? JSON.parse(options.body) : undefined };
  calls.push(call); next.check?.(call);
  return Response.json(next.body, { status: next.status || 200 });
};
const auth = () => ({ check: call => { assert.equal(call.url, `${env.SUPABASE_URL}/auth/v1/user`); assert.equal(call.options.headers.Authorization, 'Bearer mock-user-jwt'); }, body: { id: userId, email: 'fixture@example.invalid' } });
const quota = allowed => ({ check: call => { assert.equal(call.url, `${env.SUPABASE_URL}/rest/v1/rpc/storypress_reserve_ai`); assert.deepEqual(call.body, { p_user: userId, p_action: 'discover' }, 'Images reserve the existing three-unit action'); assert.equal(call.options.headers.apikey, env.SUPABASE_SECRET_KEY); assert.equal(call.options.headers.Authorization, undefined); }, body: allowed });
const imageCall = () => ({
  check: call => {
    assert.ok(call.url.endsWith('/models/gemini-test-image:generateContent'));
    assert.ok(call.url.startsWith('https://aiplatform.googleapis.com/'));
    assert.equal(call.options.headers['x-goog-api-key'], env.VERTEX_API_KEY);
    const brief = JSON.parse(call.body.contents[0].parts[0].text);
    assert.deepEqual(brief.originalWords, [story.turns[1].text]);
    assert.ok(!JSON.stringify(call.body).includes('PRIVATE_'), 'No assistant guesses, photo data, sources, generated prose, or profile name in image brief');
    assert.ok(!JSON.stringify(call.body).includes('base64'));
    assert.equal(call.body.generationConfig.candidateCount, 1);
  },
  body: { candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: jpeg } }] } }] },
});

try {
  assert.equal((await handleApi(request({}, false), env)).status, 401);
  assert.equal(calls.length, 0, 'Unsigned requests cannot spend quota or call models');
  for (const extra of [{ story: { ...story, sample: true } }, { story: { ...story, turns: [{ role: 'assistant', text: 'Only an assistant question.' }] } }, { story: { ...story, paper: undefined } }, { imageStyle: 'unknown' }]) {
    queue = [auth()]; const before = calls.length;
    assert.equal((await handleApi(request(extra), env)).status, 400);
    assert.equal(calls.length, before + 1, 'Invalid illustration requests stop after identity verification');
    assert.equal(queue.length, 0);
  }
  queue = [auth(), quota(false)]; const beforeQuota = calls.length;
  assert.equal((await handleApi(request(), env)).status, 429);
  assert.equal(calls.length, beforeQuota + 2, 'Quota refusal must not call the image provider');
  assert.equal(queue.length, 0);

  for (const style of ['illustration', 'comic']) {
    queue = [auth(), quota(true), imageCall()]; const before = calls.length;
    const response = await handleApi(request({ imageStyle: style }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { image: { data: `data:image/jpeg;base64,${jpeg}`, model: 'gemini-test-image', style } });
    assert.equal(calls.length, before + 3, 'Exactly auth, quota, and one image request');
    assert.equal(queue.length, 0);
  }
  assert.ok(calls.every(call => !call.url.includes('nimble')), 'Illustration generation never searches');

  const oldStory = structuredClone(story);
  queue = [auth(), quota(true), { status: 500, body: { error: { message: 'PRIVATE_UPSTREAM_ERROR' } } }];
  const failed = await handleApi(request(), env);
  assert.equal(failed.status, 502);
  const failure = await failed.json();
  assert.match(failure.error, /existing artwork are kept/);
  assert.ok(!failure.error.includes('PRIVATE_UPSTREAM_ERROR'));
  assert.equal(failure.image, undefined, 'Failure provides no replacement image');
  assert.deepEqual(story, oldStory, 'Original paper and artwork remain unchanged');
  assert.equal(queue.length, 0);
} finally { globalThis.fetch = originalFetch; }
console.log('Passed: illustration API authentication, original-story requirements, durable three-unit quota gating, one Cloud request, private context exclusion, no-store response, and preserved-art failure.');
