import assert from 'node:assert/strict';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import worker from '../dist/server/index.js';

// check-social-share: the artifact-first social path. Four sections:
//  1. Files-only invariant — image/video share payloads carry files (and a
//     title) and nothing else; a reader-link /s/ token can never ride along.
//  2. Desktop detection matrix — the runtime canShare probe is the single
//     gate for the native sheet; download stays the fallback; capability is
//     never inferred from user-agent or version.
//  3. Growth credit — right-aligned in the share-image header row's empty
//     half, drawn by the same canvas pass with zero network fetches.
//  4. Credit config — the URL flows through the services payload from
//     STORYPRESS_CREDIT_URL, defaulting to the request origin.
// Modeled on check-video.mjs: esbuild bundles, recording canvas, fetch counter.

// ---- Section 1: the audited payload seam --------------------------------
const payloadBundle = await build({
  stdin: { contents: "export {artifactSharePayload,shareSheetAvailable} from './lib/share-payload.ts';", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { artifactSharePayload, shareSheetAvailable } = await import('data:text/javascript;base64,' + Buffer.from(payloadBundle.outputFiles[0].text).toString('base64'));

const shareFile = typeof File === 'function' ? new File(['png-bytes'], 'storypress-1.png', { type: 'image/png' }) : { name: 'storypress-1.png' };
const titled = artifactSharePayload([shareFile], 'A remembered afternoon');
assert.deepEqual(Object.keys(titled).sort(), ['files', 'title'], 'a files share payload carries files and title only');
const untitled = artifactSharePayload([shareFile]);
assert.deepEqual(Object.keys(untitled), ['files'], 'an untitled share payload carries files only');
assert.ok(!('url' in titled) && !('text' in titled) && !('url' in untitled) && !('text' in untitled), 'no url/text key may ride in a files payload');
assert.ok(!JSON.stringify(titled).includes('/s/'), 'a share payload must never embed a reader token');
const payloadSrc = (await fs.readFile('lib/share-payload.ts', 'utf8')).replace(/\/\/[^\n]*/g, '');
assert.ok(!/\b(url|text)\b/.test(payloadSrc), 'the audited builder must never name url or text');

// Every navigator.share call site: no call may pass files and url together,
// and a files share must route through the audited builder — so a future
// edit cannot bolt a reader link onto a posted artifact.
const shareArgs = src => {
  const out = []; let i = src.indexOf('navigator.share(');
  while (i >= 0) {
    let depth = 1, j = i + 'navigator.share('.length, args = '';
    while (j < src.length && depth) { const ch = src[j]; if (ch === '(') depth++; else if (ch === ')') depth--; if (depth) args += ch; j++; }
    out.push(args); i = src.indexOf('navigator.share(', j);
  }
  return out;
};
const CALL_SITES = ['app/keepsake-studio.tsx', 'app/sharing.tsx', 'app/invites.tsx', 'lib/reader.ts'];
for (const path of CALL_SITES) {
  const src = await fs.readFile(path, 'utf8');
  for (const args of shareArgs(src)) {
    const hasFiles = /files/i.test(args), hasUrl = /\burl\b/.test(args);
    assert.ok(!(hasFiles && hasUrl), `${path}: a share payload must never carry files and url together`);
    if (hasFiles) assert.ok(args.includes('artifactSharePayload('), `${path}: files shares must route through the audited artifactSharePayload builder`);
  }
}

// ---- Section 2: desktop detection matrix --------------------------------
// The runtime capability probe is the single gate: canShare true offers the
// native sheet (desktop Chromium 128+ included), false or absent keeps the
// download fallback. Capability, never a user-agent or version sniff.
for (const path of CALL_SITES) {
  const src = await fs.readFile(path, 'utf8');
  assert.ok(!/userAgent|navigator\.vendor/.test(src), `${path}: the share gate is a capability probe, never user-agent sniffing`);
}
const setNavigator = mock => Object.defineProperty(globalThis, 'navigator', { value: mock, configurable: true });
setNavigator({ canShare: () => true, share: async () => {} });
assert.equal(shareSheetAvailable([shareFile]), true, 'canShare true offers the native share sheet');
setNavigator({ canShare: () => false, share: async () => {} });
assert.equal(shareSheetAvailable([shareFile]), false, 'canShare false keeps the download fallback');
setNavigator({ share: async () => {} });
assert.equal(shareSheetAvailable([shareFile]), false, 'an absent canShare probe keeps the download fallback');
const studioSrc = await fs.readFile('app/keepsake-studio.tsx', 'utf8');
assert.ok(studioSrc.includes('download={`storypress-${index+1}.png`}'), 'the per-image download anchor stays on the fallback path');

// ---- Section 3: the growth credit on the share image ---------------------
const imageBundle = await build({
  stdin: { contents: "export {shareImages} from './lib/share-images.ts'; export {keepsakeCopy} from './lib/keepsake.ts'; export {samplePaper} from './lib/story.ts';", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'browser', format: 'esm',
});
const { shareImages, keepsakeCopy, samplePaper } = await import('data:text/javascript;base64,' + Buffer.from(imageBundle.outputFiles[0].text).toString('base64'));

let fetchCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { fetchCalls++; return Response.json({}); };

// Conservative measure (1.0em CJK, 0.55em other) and a context that records
// every fillText — the bounds proven here hold for real Georgia/Songti runs.
const measureAt = (size, text) => Array.from(text).reduce((w, ch) => { const c = ch.codePointAt(0); return w + ((c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xff00 && c <= 0xff60) ? size : size * 0.55); }, 0);
const fontPx = font => parseFloat(font?.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '16');
let drawn = [];
const ctx = {
  fillStyle: '', strokeStyle: '', font: '',
  measureText(s) { return { width: measureAt(fontPx(this.font), s) }; },
  fillText(text, x, y) { drawn.push({ text, x, y, width: measureAt(fontPx(this.font), text) }); },
  fillRect() {}, drawImage() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
};
globalThis.document = {
  fonts: { ready: Promise.resolve() },
  createElement(tag) {
    if (tag !== 'canvas') throw new Error(`unexpected element ${tag}`);
    return { width: 0, height: 0, getContext: () => ctx, toBlob: resolve => resolve(new Blob(['png-bytes'], { type: 'image/png' })) };
  },
};
globalThis.Image = class MockImage { set src(v) { queueMicrotask(() => { this.naturalWidth = 900; this.naturalHeight = 600; this.onload?.(); }); } };

const jpeg = '/9j/4AAQSkZJRgABAQ==';
const enStory = { name: 'Wei', language: 'en', occasion: 'life', turns: [], sources: [], sample: false, approved: true, artwork: 'memories', photo: `data:image/jpeg;base64,${jpeg}`, paper: samplePaper };
const creditHost = 'storypress-app.vercel.app';
const headerRow = () => drawn.filter(t => t.y === 75);

drawn = [];
const pages = await shareImages(enStory, `https://${creditHost}`);
assert.ok(pages.length >= 1, 'the fixture yields at least one share image');
const credit = headerRow().find(t => t.text.includes(creditHost));
assert.ok(credit, 'the credit URL is drawn in the header row');
assert.equal(credit.text, `${keepsakeCopy.en.madeWith} · ${creditHost}`, 'the credit carries the localized made-with phrase and the short URL');
assert.ok(credit.x + credit.width <= 990, `the credit ends inside the column edge (ends at ${credit.x + credit.width})`);
const folio = headerRow().find(t => t.x === 90);
assert.ok(folio, 'the folio stays left-aligned at x 90');
assert.ok(credit.x >= folio.x + folio.width + 24, 'the credit never collides with the folio text');
const title = drawn.find(t => t.y === 145);
assert.ok(title && samplePaper.headline.startsWith(title.text), 'the title still starts at y 145 below the header row');

// The same credit in zh and es, drawn by the same canvas pass.
for (const [language, phrase] of [['zh', keepsakeCopy.zh.madeWith], ['es', keepsakeCopy.es.madeWith]]) {
  drawn = [];
  await shareImages({ ...enStory, language }, `https://${creditHost}`);
  const localized = headerRow().find(t => t.text.includes(creditHost));
  assert.ok(localized && localized.text.startsWith(phrase), `${language} credit carries the localized phrase`);
  assert.ok(localized.x + localized.width <= 990 && localized.x >= headerRow().find(t => t.x === 90).x + headerRow().find(t => t.x === 90).width + 24, `${language} credit stays right-aligned and collision-free`);
}

// Before the credit existed — no right-aligned text in the header row.
drawn = [];
await shareImages(enStory);
assert.equal(headerRow().length, 1, 'without a credit URL the header row carries only the folio');
assert.ok(headerRow()[0].x === 90, 'the lone header text is the folio');

// An impossible configured URL sheds, then skips — it may never collide.
drawn = [];
await shareImages(enStory, `https://${'x'.repeat(200)}.example.com`);
assert.ok(!headerRow().some(t => t.x !== 90), 'an impossible URL is skipped rather than colliding with the folio');

assert.equal(fetchCalls, 0, 'the credit joins the canvas pass with zero network fetches');

// ---- Section 4: credit config flows through the services payload --------
const env = { SUPABASE_URL: 'https://storypress-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only', SUPABASE_SECRET_KEY: 'sb_secret_test-only', STORYPRESS_PUBLIC_SHARING: 'true' };
const base = 'https://story.test';
const services = async e => await (await worker.fetch(new Request(base + '/api/story', { method: 'GET' }), e)).json();
const configured = await services({ ...env, STORYPRESS_CREDIT_URL: 'https://onceandours.example' });
assert.equal(configured.socialCredit.url, 'https://onceandours.example', 'STORYPRESS_CREDIT_URL configures the credit URL');
const defaulted = await services(env);
assert.equal(defaulted.socialCredit.url, base, 'without config the credit URL defaults to the request origin');
assert.equal(fetchCalls, 0, 'the services payload resolves the credit without any upstream call');

if (originalFetch) globalThis.fetch = originalFetch;
console.log('check-social-share: files-only invariant, desktop detection matrix, growth credit, and services config all pass');
