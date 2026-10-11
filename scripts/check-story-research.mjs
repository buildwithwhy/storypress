import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundle this API boundary in memory; no app build and no external requests.
const bundle = await build({
  stdin: { contents: "export {handleApi} from './server/api.ts'", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
  loader: { '.txt': 'text', '.jpg': 'dataurl' },
});
const { handleApi } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const tasks = { interview: 'GEMINI_INTERVIEW_MODEL', write: 'GEMINI_WRITING_MODEL', photo: 'GEMINI_PHOTO_MODEL', transcribe: 'GEMINI_TRANSCRIPTION_MODEL', research: 'GEMINI_RESEARCH_MODEL' };
const models = Object.fromEntries(Object.keys(tasks).map(task => [task, `gemini-fixture-${task}`]));
const env = { GEMINI_BACKEND: 'vertex', GOOGLE_CLOUD_PROJECT: 'research-fixture', VERTEX_API_KEY: 'mock-cloud', NIMBLE_API_KEY: 'mock-search', ...Object.fromEntries(Object.entries(tasks).map(([task, key]) => [key, models[task]])) };
const suggestion = { query: 'Spanish restaurants Islington London history', reason: 'A public restaurant history may help place this memory.' };
const story = {
  name: 'Fictional narrator', language: 'en', occasion: 'life',
  turns: [{ role: 'assistant', text: 'PRIVATE_ASSISTANT_GUESS' }, { role: 'user', text: 'I moved from California to London and remember a Spanish restaurant in Islington.' }],
  sources: [], researchQueries: ['Islington public history'], sample: false, approved: false,
  photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==',
  photoAnalysis: { visibleDetails: ['PRIVATE_PHOTO_DETAIL'], possibleContext: [], question: 'What do you recall?', searchQueries: [] },
};
const request = (action, extra = {}) => new Request('https://story.test/api/story', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://story.test', 'oai-authenticated-user-id': 'fixture' },
  body: JSON.stringify({ action, story, ...extra }),
});
const originalFetch = globalThis.fetch;
let queue = [];
globalThis.fetch = async (url, init) => {
  const next = queue.shift();
  assert.ok(next, 'Unexpected external request');
  next.check?.(String(url), JSON.parse(init.body));
  return Response.json(next.body);
};
const model = (task, output, check) => ({
  check: (url, body) => { assert.ok(url.endsWith(`/models/${models[task]}:generateContent`), `${task} must use its configured model`); check?.(body); },
  body: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: typeof output === 'string' ? output : JSON.stringify(output) }] } }] },
});

try {
  const status = await handleApi(new Request('https://story.test/api/story'), env);
  assert.deepEqual((await status.json()).models, { ...models, image: 'gemini-3.1-flash-lite-image' });
  assert.equal((await handleApi(new Request('https://story.test/api/story'), { ...env, GEMINI_WRITING_MODEL: '../invalid' })).status, 503);

  queue = [model('interview', { question: 'What was the name of that restaurant?', readyToWrite: false, researchSuggestion: suggestion }, body => {
    const context = JSON.parse(body.contents[0].parts[0].text);
    assert.deepEqual(context.previousResearchSuggestions, story.researchQueries);
    assert.deepEqual(context.transcript, story.turns);
  })];
  assert.deepEqual((await (await handleApi(request('interview'), env)).json()).researchSuggestion, suggestion);
  assert.equal(queue.length, 0, 'Interview suggestions must not automatically search');
  // A selected story mode must reach both model steps, including legacy IDs.
  for (const [occasion, label] of [['life', 'A life memory'], ['wedding', 'A love story'], ['graduation', 'A new chapter']]) {
    for (const action of ['interview', 'write']) {
      const output = action === 'interview' ? { question: 'Which moment would you like to develop?', readyToWrite: false } : { headline: 'A remembered moment', standfirst: 'A fictional fixture.', paragraphs: ['I moved from California to London.'], quote: '' };
      queue = [model(action, output, body => {
        const context = JSON.parse(body.contents[0].parts[0].text);
        assert.equal(context.storyFocus.label, label);
        assert.ok(context.storyFocus.interview && context.storyFocus.writing);
        if (action === 'write') assert.ok(context.transcript.every(turn => turn.role === 'user'), 'Mode focus must not allow interviewer suggestions into testimony');
      })];
      assert.equal((await handleApi(request(action, { story: { ...story, occasion } }), env)).status, 200);
      assert.equal(queue.length, 0);
    }
  }
  queue = [model('interview', { question: 'Why did you decide to move?', readyToWrite: false, researchSuggestion: null })];
  assert.equal((await (await handleApi(request('interview'), env)).json()).researchSuggestion, null);
  queue = [model('interview', { question: 'Why did you decide to move?', researchSuggestion: { query: 'q'.repeat(221), reason: 'Too long.' } })];
  assert.equal((await handleApi(request('interview'), env)).status, 502, 'Oversized generated queries must not enter the UI');

  for (const extra of [
    { researchSearch: { query: suggestion.query, approved: false } },
    { researchSearch: { query: suggestion.query } },
    { researchSearch: { query: 'q'.repeat(221), approved: true } },
    { researchSearch: { query: suggestion.query, approved: true }, photoSearch: { query: 'public photo clue', approved: true } },
  ]) assert.equal((await handleApi(request('discover', extra), env)).status, 400);
  assert.equal((await handleApi(request('interview', { researchSearch: { query: suggestion.query, approved: true } }), env)).status, 400);
  assert.equal(queue.length, 0, 'Invalid search requests must fail before any provider call');

  const source = { id: 'fixture', title: 'Public restaurant history', url: 'https://example.org/restaurant-history', publisher: 'Public archive', date: '', description: 'A public history.', connection: 'This may relate to the place you mentioned.', question: 'Does this look like the restaurant you remember?', selected: false };
  queue = [
    { check: (url, body) => { assert.ok(url.includes('nimbleway.com')); assert.equal(body.query, suggestion.query); assert.ok(!JSON.stringify(body).includes('PRIVATE_')); assert.ok(!JSON.stringify(body).includes('base64')); }, body: { results: [{ title: source.title, url: source.url, content: 'A public restaurant history.' }] } },
    model('research', { sources: [source, { ...source, url: 'https://invented.example/archive' }] }, body => {
      const context = JSON.parse(body.contents[0].parts[0].text);
      assert.equal(context.reviewedResearchSearch, suggestion.query);
      assert.ok(context.note.includes('not proof'));
      assert.ok(context.story.transcript.every(turn => turn.role === 'user'));
      assert.equal(context.story.previousResearchSuggestions, undefined);
      assert.ok(!JSON.stringify(context).includes('PRIVATE_'));
    }),
  ];
  const discoveries = await (await handleApi(request('discover', { researchSearch: { query: suggestion.query, approved: true } }), env)).json();
  assert.equal(discoveries.query, suggestion.query);
  assert.equal(discoveries.sources.length, 1, 'Keep only URLs actually returned by Nimble');
  assert.equal(discoveries.sources[0].selected, false);
  assert.equal(queue.length, 0, 'Approved wording bypasses the search-planner model');

  queue = [model('research', { query: 'Islington public history' }), { body: { results: [] } }];
  assert.equal((await handleApi(request('discover'), env)).status, 200, 'General discovery still uses the research model');
  queue = [model('photo', { visibleDetails: [], possibleContext: [], question: 'What do you remember?', searchQueries: [] })];
  assert.equal((await handleApi(request('photo', { photoConsent: true }), env)).status, 200);
  queue = [model('transcribe', 'A fictional recording.')];
  assert.equal((await (await handleApi(request('transcribe', { audio: { data: 'UklGRg==', mime: 'audio/wav' } }), env)).json()).transcript, 'A fictional recording.');
  queue = [model('write', { headline: 'London memories', standfirst: 'A move across the Atlantic.', paragraphs: ['I moved from California to London.'], quote: '' })];
  assert.equal((await handleApi(request('write'), env)).status, 200);
  assert.equal(queue.length, 0);
} finally {
  globalThis.fetch = originalFetch;
}
console.log('Passed: API model dispatch, remembered research suggestions, explicit query approval, exact Nimble query, no automatic search, narrator-only context, and source URL filtering.');
