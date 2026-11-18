// Illustrated, translated sample stories: verifies the curated bundled
// illustration, the fully-wired sample editions (picker rebuild covers every
// turn, source and paper), unchanged non-sample picker behavior, and the
// asset's web weight. Samples never hit AI paths — that invariant is
// asserted by check-artwork.mjs and the sample branch renders only static data.
import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = '/tmp/storypress-check-sample-bundle.mjs';
await esbuild.build({
  entryPoints: ['scripts/check-sample-entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
});
const mod = await import(pathToFileURL(out).href);
const { sampleEditions, storyForLanguage, presentation, createSampleStory, sampleArtworkPath, keepsakeMarkup, initialStory, startCopy } = mod;

let failed = 0;
function check(name, ok, detail = '') {
  if (!ok) { failed++; console.error(`FAIL ${name}${detail ? ' — ' + detail : ''}`); }
  else console.log(`ok   ${name}`);
}

// tc-3: switching language inside the sample switches everything.
const languages = ['en', 'zh', 'es'];
for (const language of languages) {
  const rebuilt = storyForLanguage(createSampleStory('en'), language);
  const expected = createSampleStory(language);
  const edition = sampleEditions[language];
  check(`tc-3 sample rebuild (${language}): turns`, JSON.stringify(rebuilt.turns) === JSON.stringify(expected.turns));
  check(`tc-3 sample rebuild (${language}): language`, rebuilt.language === language);
  check(`tc-3 sample rebuild (${language}): stage-safe fields kept`, rebuilt.sample === true && rebuilt.name === edition.name);
}
// Curated editions themselves ship complete turns + paper + source copy.
for (const language of languages) {
  const edition = sampleEditions[language];
  check(`tc-3 edition (${language}): complete`, Boolean(edition.name && edition.memory && edition.followup && edition.paper?.headline && edition.paper?.paragraphs?.length && edition.source?.title));
}

// tc-4: non-sample stories keep the existing behavior — untouched opening
// question swaps, everything else only changes language.
const opening = startCopy.en.prompts[0].question;
const untouched = { ...initialStory, turns: [{ role: 'assistant', text: opening }] };
const swapped = storyForLanguage(untouched, 'es');
check('tc-4 non-sample: language moves', swapped.language === 'es');
check('tc-4 non-sample: untouched opening swapped', swapped.turns.length === 1 && swapped.turns[0].role === 'assistant' && swapped.turns[0].text !== opening);
check('tc-4 non-sample: still not a sample', swapped.sample !== true);
// An answered conversation is never rewritten.
const answered = { ...initialStory, turns: [{ role: 'assistant', text: opening }, { role: 'user', text: 'My answer.' }] };
const preserved = storyForLanguage(answered, 'zh');
check('tc-4 non-sample: answered turns untouched', JSON.stringify(preserved.turns) === JSON.stringify(answered.turns) && preserved.language === 'zh');

// tc-6: the bundled asset is web-weight WebP.
const assetPath = path.join('public', sampleArtworkPath.replace(/^\//, ''));
const bytes = await fs.readFile(assetPath);
check('tc-6 asset is webp', bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP', `magic ${bytes.subarray(8, 12).toString('ascii')}`);
check('tc-6 asset <= 300 KB', bytes.length <= 300 * 1024, `${bytes.length} bytes`);
const vercelCopy = await fs.readFile(path.join('dist-public', sampleArtworkPath.replace(/^\//, ''))).catch(() => null);
if (vercelCopy) check('tc-6 vercel copy matches source', Buffer.compare(bytes, vercelCopy) === 0);

// tc-1/tc-2: the sample renders the bundled figure with the localized caption
// and alt text — in the keepsake markup (full paper surface) and the
// presentation keys the miniature/paper share.
for (const language of languages) {
  const markup = keepsakeMarkup({ ...createSampleStory(language), paper: sampleEditions[language].paper, sources: [{ ...sampleEditions[language].source, selected: true }] });
  check(`tc-1 keepsake figure (${language})`, markup.includes('src="/artwork/sample-moon-night.webp"') && markup.includes('loading="lazy"') && markup.includes('width="1376"') && markup.includes('height="768"'));
  check(`tc-1 keepsake alt (${language})`, markup.includes(`alt="${presentation[language].sampleArtAlt}"`));
  check(`tc-1 keepsake caption (${language})`, markup.includes(presentation[language].illustration));
}
for (const language of languages) {
  check(`tc-1 alt key present (${language})`, typeof presentation[language].sampleArtAlt === 'string' && presentation[language].sampleArtAlt.length > 20);
}

// tc-5: the sample surface renders only static data — no provider calls are
// reachable from the sample-branch modules this spec touches.
const storypress = await fs.readFile('app/storypress.tsx', 'utf8');
const sampleBranch = storypress.split('story.sample ?').pop()?.split(': art&&artKey')[0] ?? '';
check('tc-5 sample branch renders no API fetch', !sampleBranch.includes('fetch(') && !sampleBranch.includes('/api/'));
check('tc-5 sample branch uses the bundled asset', sampleBranch.includes('sampleArtworkPath'));

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nAll sample checks passed.');
