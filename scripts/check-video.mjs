import assert from 'node:assert/strict';
import { build } from 'esbuild';
import fs from 'node:fs/promises';

// check-video: the hidden memory video's storyboard, frame renderer, and
// encode ladder. Modeled on check-image-provider.mjs — esbuild bundles,
// fixture stories in en/zh/es, exact assertions. Two bundles: the pure
// storyboard ships node-side; the browser bundle carries the real canvas
// renderer, the real Mediabunny muxer, and the real ladder driver, with
// every browser surface around them mocked. All fetches are counted — no
// network, no paid calls, anywhere in the render path.

const bundle = await build({
  stdin: { contents: "export {buildStoryboard,buildVideoManifest,videoManifestSchema,audioTrackSchema,VIDEO_WIDTH,VIDEO_HEIGHT} from './lib/video-storyboard.ts'; export {wrapLines} from './lib/share-images.ts'; export {keepsakeCopy,mastheadCopy} from './lib/keepsake.ts'; export {samplePaper} from './lib/story.ts';", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { buildStoryboard, buildVideoManifest, videoManifestSchema, audioTrackSchema, VIDEO_WIDTH, VIDEO_HEIGHT, wrapLines, keepsakeCopy, mastheadCopy, samplePaper } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

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

  // ---- Sections below own the frame renderer and the encode ladder. The
  // browser bundle pulls the real renderer, the real Mediabunny muxer, and
  // the real ladder driver; the browser around them is a recording mock.
  const browserBundle = await build({
    stdin: { contents: "export {frameTimeline,sceneAt,kenBurnsAt,drawKenBurns,renderFrame,loadManifestImages,createCanvas} from './lib/video-frames.ts'; export {VIDEO_FPS,FULL_VIDEO_SIZE,DOWNGRADED_VIDEO_SIZE,videoBitrate,webCodecsMp4Rung,mediaRecorderRung,defaultRungs,encodeMemoryVideo,VideoEncodeUnavailableError} from './lib/video-encode.ts';", resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'browser', format: 'esm',
  });
  const video = await import('data:text/javascript;base64,' + Buffer.from(browserBundle.outputFiles[0].text).toString('base64'));

  // Browser mocks. The context records every draw; its measure is
  // conservative (1.0em CJK, 0.55em other) so bounds proven here hold for
  // real Georgia/Songti runs. isTypeSupported throws if a rung ever calls
  // it — probes must be real recordings, never capability claims.
  const ctxLog = { fillText: [], drawImage: [], fillRect: [], strokes: 0 };
  const measureAt = (size, text) => Array.from(text).reduce((w, ch) => { const c = ch.codePointAt(0); return w + ((c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xff00 && c <= 0xff60) ? size : size * 0.55); }, 0);
  const makeCtx = () => ({
    fillStyle: '', strokeStyle: '', font: '', textAlign: 'left',
    measureText(s) { return { width: measureAt(parseFloat(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '16'), s) }; },
    fillText(text, x, y) { ctxLog.fillText.push({ text, x, y, font: this.font }); },
    fillRect(...a) { ctxLog.fillRect.push(a); },
    drawImage(...a) { ctxLog.drawImage.push(a); },
    save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
    moveTo() {}, lineTo() {}, stroke() { ctxLog.strokes++; },
  });
  const sharedCtx = makeCtx();
  let requestFrames = 0;
  let failNextVideoPlays = false;
  const makeCanvas = () => ({ width: 0, height: 0, getContext: () => sharedCtx, captureStream: () => ({ getVideoTracks: () => [{ requestFrame: () => { requestFrames++; } }], addTrack() {} }) });
  const makeVideoElement = () => ({
    videoWidth: 0, videoHeight: 0, onloadeddata: null, onerror: null, _src: '',
    set src(v) { this._src = String(v); queueMicrotask(() => { if (failNextVideoPlays) { failNextVideoPlays = false; this.onerror?.(); } else { this.videoWidth = 160; this.videoHeight = 200; this.onloadeddata?.(); } }); },
    get src() { return this._src; },
  });
  globalThis.document = { fonts: { ready: Promise.resolve() }, createElement(tag) { if (tag === 'canvas') return makeCanvas(); if (tag === 'video') return makeVideoElement(); throw new Error(`unexpected element ${tag}`); } };
  globalThis.Image = class MockImage { set src(v) { queueMicrotask(() => { this.naturalWidth = 900; this.naturalHeight = 600; this.onload?.(); }); } };
  globalThis.URL.createObjectURL = () => 'blob:check-video-mock';
  globalThis.URL.revokeObjectURL = () => {};

  // Frames: the renderer must be the share-image language with a time
  // parameter — contiguous slots, storyboard Ken Burns, every drawn line
  // inside the measure, the Ken Burns window always covered.
  const slots = video.frameTimeline(manifest);
  const totalMs = slots[slots.length - 1].endMs;
  assert.equal(slots[0].startMs, 0, 'the timeline starts at zero');
  for (let i = 1; i < slots.length; i++) assert.equal(slots[i].startMs, slots[i - 1].endMs, 'scene slots must be contiguous');
  assert.equal(slots[slots.length - 1].endMs, manifest.scenes.reduce((n, s) => n + s.durationMs, 0), 'the timeline spans exactly the manifest durations');
  assert.equal(video.sceneAt(slots, 0).scene, slots[0].scene, 'time zero belongs to the first scene');
  assert.equal(video.sceneAt(slots, slots[0].endMs).scene, slots[1].scene, 'a scene boundary hands over exactly once');
  assert.equal(video.sceneAt(slots, totalMs - 1).scene, slots[slots.length - 1].scene, 'the last millisecond belongs to the last scene');
  assert.equal(video.sceneAt(slots, -5).scene, slots[0].scene, 'negative time clamps to the first scene');
  assert.equal(video.sceneAt(slots, totalMs + 999).scene, slots[slots.length - 1].scene, 'overflow time clamps to the last scene');
  const kb = slots[1].scene.kenBurns;
  assert.equal(video.kenBurnsAt(kb, 0).scale, kb.from, 'Ken Burns starts at the scene\'s from scale');
  assert.equal(video.kenBurnsAt(kb, 1).scale, kb.to, 'Ken Burns ends at the scene\'s to scale');
  assert.equal(video.kenBurnsAt(kb, -1).scale, kb.from, 'Ken Burns progress clamps at the bottom');
  assert.equal(video.kenBurnsAt(kb, 2).scale, kb.to, 'Ken Burns progress clamps at the top');
  assert.ok(Math.abs(video.kenBurnsAt(kb, 0.5).scale - (kb.from + kb.to) / 2) < 1e-9, 'Ken Burns interpolation is linear');
  const fakeImage = { naturalWidth: 900, naturalHeight: 600 };
  const images = new Map([[zhStory.photo, fakeImage], [zhStory.generatedArt.data, fakeImage]]);
  const frameCount = Math.round(totalMs * video.VIDEO_FPS / 1000);
  let kenBurnsFrames = 0;
  for (let i = 0; i < frameCount; i++) {
    const timeMs = i * 1000 / video.VIDEO_FPS;
    const slot = video.sceneAt(slots, timeMs);
    const drawMark = ctxLog.drawImage.length, textMark = ctxLog.fillText.length;
    video.renderFrame(sharedCtx, manifest, timeMs, slots, images);
    for (const entry of ctxLog.fillText.slice(textMark)) {
      assert.ok(entry.y >= 12 && entry.y <= 1300, 'drawn text stays on the canvas');
      if (entry.x === 90) {
        const size = parseFloat(entry.font.match(/(\d+(?:\.\d+)?)px/)[1]);
        assert.ok(measureAt(size, entry.text) <= 900, `rendered ${slot.scene.kind} text must fit the 900px measure`);
      }
    }
    const draws = ctxLog.drawImage.slice(drawMark);
    if (slot.scene.kind === 'prose') {
      assert.equal(draws.length, 1, 'an image-bearing prose frame draws its Ken Burns subject exactly once');
      const [img, dx, dy, dw, dh] = draws[0];
      assert.equal(img, fakeImage, 'the drawn subject is the decoded manifest image');
      kenBurnsFrames++;
      if (slot === slots[1]) {
        const p = (timeMs - slot.startMs) / (slot.endMs - slot.startMs);
        const expected = kb.from + (kb.to - kb.from) * p;
        const drawn = dw / 900; // cover base scale is 1 for the 900x600 fixture in the 900x470 window
        assert.ok(Math.abs(drawn - expected) < 0.02, `the drawn Ken Burns scale must match the storyboard at p=${p.toFixed(3)}`);
      }
      assert.ok(dx <= 90.25 && dx + dw >= 989.75, 'the Ken Burns draw must cover the window horizontally');
      assert.ok(dy <= 110.25 && dy + dh >= 579.75, 'the Ken Burns draw must cover the window vertically');
    } else {
      assert.equal(draws.length, 0, 'typographic cards draw no image');
    }
  }
  assert.ok(kenBurnsFrames > 0, 'the drive must exercise Ken Burns frames');
  const esManifest = buildVideoManifest(esStory, 'es');
  const esSlots = video.frameTimeline(esManifest);
  for (const t of [0, 500, 1200, esSlots[1].startMs + 50]) video.renderFrame(sharedCtx, esManifest, t, esSlots, new Map([[esStory.photo, fakeImage]]));
  assert.equal(fetchCalls, 0, 'the frame path must make zero network calls');

  // End-card growth credit: the closing frame draws the localized made-with
  // phrase and the configured short URL in the masthead row's empty half —
  // the share-image header slot and primitives, one line. The URL is render
  // config from the services payload; the manifest never carries it.
  const creditHost = 'onceandours.example';
  const endSlot = slots[slots.length - 1];
  const headerRow = () => ctxLog.fillText.filter(t => t.y === 75);
  ctxLog.fillText = [];
  video.renderFrame(sharedCtx, manifest, endSlot.endMs - 1, slots, images, `https://${creditHost}`);
  const zhCredit = headerRow().find(t => t.text.includes(creditHost));
  assert.ok(zhCredit, 'the end card draws the credit URL in the header row');
  assert.equal(zhCredit.text, `${keepsakeCopy.zh.madeWith} · ${creditHost}`, 'the end-card credit carries the localized phrase and the configured URL');
  const zhCreditWidth = measureAt(parseFloat(zhCredit.font.match(/(\d+(?:\.\d+)?)px/)[1]), zhCredit.text);
  assert.ok(zhCredit.x + zhCreditWidth <= 990, `the end-card credit ends inside the column edge (ends at ${zhCredit.x + zhCreditWidth})`);
  assert.ok(zhCredit.x >= 90 + measureAt(22, mastheadCopy.zh.toUpperCase()) + 24, 'the end-card credit never collides with the masthead text');
  assert.ok(headerRow().every(t => t.x === 90 || t === zhCredit), 'the end-card header row carries only the masthead and the credit');
  assert.equal(headerRow().find(t => t.x === 90).text, mastheadCopy.zh.toUpperCase(), 'the end-card masthead is unchanged beside the credit');

  // Render config, not content: without a credit URL the header row holds
  // only the masthead, and the credit never enters the manifest.
  ctxLog.fillText = [];
  video.renderFrame(sharedCtx, manifest, endSlot.endMs - 1, slots, images);
  assert.equal(headerRow().length, 1, 'without a credit URL the end-card header row carries only the masthead');
  assert.ok(!('creditUrl' in parsed), 'the manifest stays free of render config');

  // The credit rides the end card only — the title frame never draws it.
  ctxLog.fillText = [];
  video.renderFrame(sharedCtx, manifest, 0, slots, images, `https://${creditHost}`);
  assert.ok(!headerRow().some(t => t.text.includes(creditHost)), 'the title frame never draws the credit');

  // The same credit in the other artifact languages, drawn by the same pass.
  for (const [lang, story, phrase] of [['en', enStory, keepsakeCopy.en.madeWith], ['es', esStory, keepsakeCopy.es.madeWith]]) {
    const langManifest = buildVideoManifest(story, lang);
    const langSlots = video.frameTimeline(langManifest);
    ctxLog.fillText = [];
    video.renderFrame(sharedCtx, langManifest, langSlots[langSlots.length - 1].endMs - 1, langSlots, new Map(), `https://${creditHost}`);
    const credit = headerRow().find(t => t.text.includes(creditHost));
    assert.ok(credit && credit.text.startsWith(phrase), `${lang} end-card credit carries the localized phrase`);
    assert.ok(credit.x + measureAt(parseFloat(credit.font.match(/(\d+(?:\.\d+)?)px/)[1]), credit.text) <= 990, `${lang} end-card credit ends inside the column edge`);
  }

  // Encoder seam: the driver hands the manifest to exactly one rung encode,
  // records every degradation explicitly, and ends the exhausted ladder in
  // a typed share-images refusal.
  const fixtureBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const arrivals = [];
  const refusingRung = name => ({ name, async trial(input) { input.record(`${name}:refused-1080x1350`); return null; }, async encode() { throw new Error(`${name} must never encode after refusing its trial`); } });
  const scriptedRung = {
    name: 'scripted',
    async trial(input) { input.record('scripted:trial-720x900'); return { width: 720, height: 900 }; },
    async encode(input) { arrivals.push(input.manifest); return { blob: new Blob([fixtureBytes]), mimeType: 'video/mp4' }; },
  };
  const shortStory = { ...zhStory, paper: { ...zhPaper, paragraphs: zhPaper.paragraphs.slice(0, 2), quote: '' } };
  const shortManifest = buildVideoManifest(shortStory, 'zh');
  const result = await video.encodeMemoryVideo(shortManifest, { rungs: [refusingRung('primary'), scriptedRung] });
  assert.equal(Buffer.from(await result.blob.arrayBuffer()).toString('hex'), Buffer.from(fixtureBytes).toString('hex'), 'the mocked encoder\'s fixture bytes must be the delivered video');
  assert.equal(result.width, 720); assert.equal(result.height, 900);
  assert.equal(arrivals.length, 1, 'the mocked encoder must receive the manifest exactly once');
  assert.equal(arrivals[0], shortManifest, 'the mocked encoder must receive the real manifest object');
  assert.deepEqual(result.path, ['primary:refused-1080x1350', 'scripted:trial-720x900', 'scripted:accepted-720x900'], 'every rung step must be recorded, never silent');
  await assert.rejects(
    video.encodeMemoryVideo(shortManifest, { rungs: [refusingRung('webcodecs-mp4'), refusingRung('mediarecorder-mp4'), refusingRung('mediarecorder-webm')] }),
    e => { assert.ok(e instanceof video.VideoEncodeUnavailableError); assert.deepEqual(e.path, ['webcodecs-mp4:refused-1080x1350', 'mediarecorder-mp4:refused-1080x1350', 'mediarecorder-webm:refused-1080x1350', 'share-images'], 'the exhausted ladder must end at share-images, explicitly'); return true; },
    'the exhausted ladder must fail with the typed refusal',
  );
  await assert.rejects(video.encodeMemoryVideo(narrated, { rungs: [scriptedRung] }), /narration/, 'a narrated manifest without its audio track must refuse explicitly');
  assert.equal(arrivals.length, 1, 'the narrated refusal must happen before any rung sees the manifest');
  await video.encodeMemoryVideo(narrated, { rungs: [scriptedRung], audio: { numberOfChannels: 1, sampleRate: 24000 } });
  assert.equal(arrivals.length, 2, 'with the audio track supplied, the narrated manifest reaches the encoder too');
  assert.equal(arrivals[1], narrated, 'the narrated handoff passes the real manifest');

  // Real rung, mocked codec: the full-size refusal downgrades once to
  // 720x900, and the real Mediabunny muxer turns mocked H.264 chunks into a
  // genuine MP4 container — the primary rung proven end to end.
  const configureLog = [];
  const avcNalu = new Uint8Array([0, 0, 0, 1, 0x65, 1, 2, 3]);
  const avcCDescription = new Uint8Array([1, 0x64, 0x00, 0x28, 0xff, 0xe1, 0x00, 0x0a, 0x67, 0x64, 0x00, 0x28, 0xac, 0xd9, 0x40, 0x50, 0x05, 0xbb, 0x01, 0x00, 0x04, 0x68, 0xeb, 0xec, 0xb4]);
  globalThis.EncodedVideoChunk = class MockEncodedVideoChunk {};
  globalThis.VideoFrame = class MockVideoFrame { constructor(source, init) { this.timestamp = init.timestamp; this.duration = init.duration; } close() {} };
  globalThis.VideoEncoder = class MockVideoEncoder {
    constructor({ output, error }) { this.output = output; this.errorOut = error; }
    configure(config) { configureLog.push(config); if (config.width >= 1080) throw new Error('refused: resolution too large for this encoder'); this.config = config; }
    encode(frame, options) {
      this.output(Object.assign(new globalThis.EncodedVideoChunk(), {
        type: options?.keyFrame ? 'key' : 'delta', timestamp: frame.timestamp, duration: frame.duration,
        data: avcNalu, byteLength: avcNalu.byteLength, copyTo: dest => dest.set(avcNalu),
      }), { decoderConfig: { codec: 'avc1.640028', codedWidth: this.config.width, codedHeight: this.config.height, description: avcCDescription } });
      frame.close();
    }
    async flush() {} close() {}
  };
  const wcResult = await video.encodeMemoryVideo(shortManifest, { rungs: [video.webCodecsMp4Rung()], creditUrl: `https://${creditHost}` });
  assert.equal(wcResult.width, 720, 'the full-size refusal must downgrade once to 720x900');
  assert.equal(wcResult.height, 900);
  assert.deepEqual(wcResult.path, ['webcodecs-mp4:refused-1080x1350', 'webcodecs-mp4:accepted-720x900'], 'the downgrade must be explicit and singular');
  assert.ok(configureLog.length >= 3 && configureLog.some(c => c.width === 1080) && configureLog.some(c => c.width === 720 && c.codec === 'avc1.640028'), 'the trial must probe full size before the downgrade and the encode');
  assert.ok(wcResult.blob.size > 1000, 'the real mux path must produce an MP4-sized blob');
  assert.equal(wcResult.blob.type, 'video/mp4');
  const head = Buffer.from(await wcResult.blob.slice(0, 12).arrayBuffer()).toString('latin1');
  assert.equal(head.slice(4, 8), 'ftyp', 'the output must be a genuine MP4 container');
  assert.ok(ctxLog.fillText.some(t => t.text.includes(creditHost)), 'the encode path threads the credit into the rendered frames');

  // MediaRecorder rung: candidates are proven by short real recordings
  // loaded into a media element — the first (Safari) candidate fails to
  // play here, the second verifies, and the encode carries the verified
  // candidate. isTypeSupported would throw if anyone consulted it.
  let recorderLog = [];
  globalThis.MediaRecorder = class MockMediaRecorder {
    constructor(stream, options) { this.stream = stream; this.options = options; this.state = 'inactive'; recorderLog.push(options); }
    static isTypeSupported() { throw new Error('isTypeSupported must never decide a rung'); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(96).fill(7)]) }); this.onstop?.(); }
  };
  failNextVideoPlays = true; // the Safari candidate records but does not play on this mocked device
  const mrResult = await video.encodeMemoryVideo(
    { ...shortManifest, scenes: shortManifest.scenes.slice(0, 2).map(s => ({ ...s, durationMs: 500 })) },
    { rungs: [video.mediaRecorderRung(['video/mp4; codecs="avc1.42E01E"', 'video/mp4; codecs="avc1.4d002a"'], 'mediarecorder-mp4')] },
  );
  assert.equal(mrResult.mimeType, 'video/mp4', 'the MediaRecorder rung must deliver MP4 when a candidate verifies');
  assert.equal(mrResult.blob.size, 96, 'the mock recording\'s bytes must be the delivered video');
  assert.deepEqual(mrResult.path, ['mediarecorder-mp4:refused-video/mp4; codecs="avc1.42E01E"', 'mediarecorder-mp4:accepted-1080x1350'], 'the failed candidate must be refused by name, never silently');
  assert.deepEqual(recorderLog.map(o => o.mimeType), ['video/mp4; codecs="avc1.42E01E"', 'video/mp4; codecs="avc1.4d002a"', 'video/mp4; codecs="avc1.4d002a"'], 'probes then the encode must carry the verified candidate');
  assert.equal(requestFrames, 30, 'both three-frame probes and the 24-frame encode must advance the capture');

  assert.deepEqual(video.defaultRungs().map(r => r.name), ['webcodecs-mp4', 'mediarecorder-mp4', 'mediarecorder-webm'], 'the ladder order must be WebCodecs MP4, MediaRecorder MP4, MediaRecorder WebM');
  assert.deepEqual(video.FULL_VIDEO_SIZE, { width: 1080, height: 1350 }, 'the ladder renders at the share-image canvas size');
  assert.deepEqual(video.DOWNGRADED_VIDEO_SIZE, { width: 720, height: 900 }, 'the one downgrade is 720x900');
  assert.equal(video.videoBitrate(720, 900), Math.round(3500000 * (720 * 900) / (1080 * 1350)), 'bitrate scales with area');
} finally { globalThis.fetch = originalFetch; }

assert.equal(fetchCalls, 0, 'the whole render path must make zero network calls');
console.log('Passed: scene derivation for en/zh/es fixtures, 4-8 prose cards, 45-75s pacing band, deterministic Ken Burns, 900px measure hold, manifest schema, the empty audioTrack narration seam, frame rendering with Ken Burns cover-fit, the end-card growth credit (localized, config-sourced, end-card only, manifest-free), the encoder seam (manifest received exactly once), explicit ladder degradation to a typed share-images refusal, the real muxer producing an MP4 container, probe-verified MediaRecorder candidates, and zero network calls across the whole render path.');
