import assert from 'node:assert/strict';
import { build } from 'esbuild';
import fs from 'node:fs/promises';

// check-video: the hidden memory video's pure storyboard. Modeled on
// check-image-provider.mjs — esbuild bundle, fixture stories in en/zh/es,
// exact assertions. Canvas and encoder code stay outside this bundle: only
// what a deterministic check can own ships here. All fetches are mocked —
// no network, no paid calls.

const bundle = await build({
  stdin: { contents: "export {buildStoryboard,buildVideoManifest,videoManifestSchema,audioTrackSchema,VIDEO_WIDTH,VIDEO_HEIGHT} from './lib/video-storyboard.ts'; export {wrapLines} from './lib/share-images.ts'; export {samplePaper} from './lib/story.ts';", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { buildStoryboard, buildVideoManifest, videoManifestSchema, audioTrackSchema, VIDEO_WIDTH, VIDEO_HEIGHT, wrapLines, samplePaper } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

// Privacy guard: the fetch mock counts every network touch. The render path
// must close with zero — story content never leaves the device.
let fetchCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { fetchCalls++; return Response.json({}); };

// Fixtures. Tiny base64 payloads stand in for the photograph and the AI
// illustration; the sample paper is the repo's Moon-landing keepsake.
const jpeg = '/9j/4AAQSkZJRgABAQ==';
const enStory = { name: 'Wei', language: 'en', occasion: 'life', turns: [], sources: [], sample: false, approved: true, artwork: 'memories', photo: `data:image/jpeg;base64,${jpeg}`, photoCaption: 'The living room in Queens', paper: samplePaper };
const zhPaper = {
  headline: '一小间客厅，一整个新世界',
  standfirst: '外婆的电视机让皇后区的一家人团聚在一个夜晚，那个夜晚的影响远远超出了这间客厅。',
  paragraphs: [
    '一九六九年七月，我九岁。我们一家人挤在外婆位于皇后区的客厅里，一起看登月。家里只有她有一台电视机。',
    '我记得自己和表兄弟姐妹们坐在地毯上。外婆不停地端来一碟碟食物，仿佛宇航员真的要来吃晚饭似的。',
    '电视机天线总需要有人扶着。表哥常常被派去转动它，他一边转一边大声问，有了没有？',
    '那一刻所有人都安静了下来。外婆在围裙上擦了擦手，坐到了离电视机最近的沙发上。'],
  quote: '外婆不停地端来一碟碟食物，仿佛宇航员真的要来吃晚饭似的。',
};
const zhStory = { name: '薇', language: 'zh', occasion: 'life', turns: [], sources: [], sample: false, approved: true, artwork: 'generated', generatedArt: { data: `data:image/jpeg;base64,${jpeg}`, style: 'illustration', model: 'gemini-3.1-flash-lite-image', sourceKey: 'fixture' }, paper: zhPaper };
const esPaper = {
  headline: 'Una sala pequeña, un mundo entero.',
  standfirst: 'El televisor de la abuela reunió a la familia en Queens, en una noche que llegó mucho más allá de su sala.',
  paragraphs: [
    'En julio de 1969 yo tenía nueve años y todos nos apretujamos en la sala de mi abuela en Queens para ver la llegada a la Luna. Ella tenía el único televisor de la familia.',
    'Recuerdo estar sentado en la alfombra con mis primos. La abuela no dejaba de traer platos de comida, como si los astronautas fueran a venir a cenar.'],
  quote: 'La abuela no dejaba de traer platos de comida, como si los astronautas fueran a venir a cenar.',
};
const esStory = { ...enStory, language: 'es', paper: esPaper };

// Conservative 40px-font measure: CJK-family code points 40px, everything
// else 20px — the seam the frame renderer must keep overflow-free.
const measure = text => Array.from(text).reduce((w, ch) => { const c = ch.codePointAt(0); return w + ((c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xff00 && c <= 0xff60) ? 40 : 20); }, 0);

try {
  // Purity by construction: after stripping comments, the module must name no
  // DOM or network surface at all.
  const source = (await fs.readFile('lib/video-storyboard.ts', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/\b(document|window|navigator)\b/.test(source), 'the storyboard module must never touch the DOM');
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/.test(source), 'the storyboard module must never touch the network');

  // Scene list derivation — en sample paper.
  const en = buildStoryboard(enStory, 'en');
  const kinds = en.map(s => s.kind);
  assert.equal(kinds[0], 'title', 'the storyboard opens on the title card');
  assert.equal(kinds.at(-1), 'end', 'the storyboard closes on the end card');
  const enProse = en.filter(s => s.kind === 'prose');
  assert.ok(enProse.length >= 4 && enProse.length <= 8, `prose cards must stay in the 4-8 range, got ${enProse.length}`);
  assert.equal(en[0].text, samplePaper.headline);
  assert.equal(en.at(-1).text, 'A memory, kept.', 'the end card carries the keepsake credit line');
  assert.ok(en.some(s => s.kind === 'quote' && s.text === samplePaper.quote), 'a present paper quote yields a quote card');
  assert.deepEqual(kinds, ['title', ...Array(enProse.length).fill('prose'), 'quote', 'end'], 'scenes must read title, prose cards, quote, end');
  for (const scene of en) {
    if (scene.kind === 'prose') assert.equal(scene.image, enStory.photo, 'every prose card carries a Ken Burns subject');
    else assert.equal(scene.image, undefined, 'typographic cards stay image-free');
    assert.ok(scene.text && scene.text.length <= 381, 'excerpts stay inside the unit budget');
    assert.ok(Number.isInteger(scene.durationMs) && scene.durationMs >= 1000, 'every scene holds at least a second');
    assert.ok(scene.kenBurns.from >= 1 && scene.kenBurns.to >= 1, 'Ken Burns never dips below 1x scale');
    assert.ok(Number.isFinite(scene.kenBurns.panX) && Number.isFinite(scene.kenBurns.panY), 'Ken Burns pan parameters exist per scene');
  }
  const enSum = en.reduce((n, s) => n + s.durationMs, 0);
  assert.ok(enSum >= 45000 && enSum <= 75000, `durations must sum inside the 45-75s target, got ${enSum}ms`);
  assert.deepEqual(buildStoryboard(enStory, 'en'), en, 'storyboard derivation must be deterministic');
  assert.equal(VIDEO_WIDTH, 1080); assert.equal(VIDEO_HEIGHT, 1350);

  // A paper without a quote must not fabricate a quote card.
  assert.ok(!buildStoryboard({ ...enStory, paper: { ...samplePaper, quote: '' } }, 'en').some(s => s.kind === 'quote'), 'an absent quote yields no quote card');

  // zh and es fixtures: language follows the artifact, and every scene text
  // wraps inside the 900px measure without overflowing the card's prose area.
  const zh = buildStoryboard(zhStory, 'zh');
  assert.equal(zh[0].text, zhPaper.headline);
  assert.equal(zh.at(-1).text, '把一段回忆留下。', 'the zh end card carries the zh credit line');
  const zhProse = zh.filter(s => s.kind === 'prose');
  assert.ok(zhProse.length >= 4 && zhProse.length <= 8, `zh prose cards must stay in the 4-8 range, got ${zhProse.length}`);
  assert.ok(zhProse.every(s => s.image === zhStory.generatedArt.data), 'zh prose cards carry the illustration as Ken Burns subject');
  for (const [lang, story] of [['zh', zhStory], ['es', esStory], ['en', enStory]]) {
    for (const scene of buildStoryboard(story, lang)) {
      if (!scene.text) continue;
      const lines = wrapLines(scene.text, 900, measure);
      for (const line of lines) assert.ok(measure(line) <= 900, `${lang} ${scene.kind} text must never overflow the 900px measure`);
      assert.ok(lines.length <= 12, `${lang} ${scene.kind} must stay inside the card's prose area, got ${lines.length} lines`);
    }
  }

  // Manifest schema: shape, per-language copy, and the empty narration seam.
  const manifest = buildVideoManifest(zhStory, 'zh');
  const parsed = videoManifestSchema.parse(manifest);
  assert.equal(parsed.language, 'zh');
  assert.equal(parsed.width, 1080); assert.equal(parsed.height, 1350);
  assert.equal(parsed.byline, '薇');
  assert.equal(parsed.standfirst, zhPaper.standfirst);
  assert.equal(parsed.scenes.length, zh.length);
  assert.equal(parsed.audioTrack, undefined, 'v1 fixtures must leave the audioTrack seam empty');
  for (const bad of [
    { ...manifest, scenes: [] },
    { ...manifest, scenes: [{ ...manifest.scenes[0], kenBurns: undefined }] },
    { ...manifest, scenes: [{ ...manifest.scenes[0], durationMs: 0 }] },
    { ...manifest, language: 'fr' },
  ]) assert.equal(videoManifestSchema.safeParse(bad).success, false, 'malformed manifests must not validate');

  // The narration seam: the schema accepts an audioTrack, and narration
  // length gates scene pacing through the same duration derivation — with
  // no track present, the pacing band still holds.
  assert.equal(audioTrackSchema.safeParse({ kind: 'clip', durationMs: 61000, source: 'fixture-take-3' }).success, true);
  assert.equal(audioTrackSchema.safeParse({ kind: 'canvas', durationMs: 30000 }).success, true);
  assert.equal(audioTrackSchema.safeParse({ kind: 'none', durationMs: 0 }).success, true);
  assert.equal(audioTrackSchema.safeParse({ kind: 'mixtape', durationMs: 0 }).success, false, 'unknown track kinds must not validate');
  assert.equal(audioTrackSchema.safeParse({ kind: 'clip', durationMs: -1 }).success, false, 'negative durations must not validate');
  const narrated = buildVideoManifest(zhStory, 'zh', { kind: 'clip', durationMs: 61000, source: 'fixture-take-3' });
  assert.equal(narrated.audioTrack.kind, 'clip');
  assert.equal(narrated.audioTrack.source, 'fixture-take-3');
  assert.equal(narrated.scenes.reduce((n, s) => n + s.durationMs, 0), 61000, 'narration length must gate scene pacing exactly');
  assert.equal(buildStoryboard(zhStory, 'zh', { kind: 'canvas', durationMs: 30000 }).reduce((n, s) => n + s.durationMs, 0), 30000);
  const silentSum = buildStoryboard(zhStory, 'zh', { kind: 'none', durationMs: 0 }).reduce((n, s) => n + s.durationMs, 0);
  assert.ok(silentSum >= 45000 && silentSum <= 75000, 'an empty track falls back to the pacing band');
} finally { globalThis.fetch = originalFetch; }

assert.equal(fetchCalls, 0, 'the whole render path must make zero network calls');
console.log('Passed: scene derivation for en/zh/es fixtures, 4-8 prose cards, 45-75s pacing band, deterministic Ken Burns, 900px measure hold, manifest schema, and the empty audioTrack narration seam. No network calls.');
