import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export * from './lib/story';export * from './lib/edition';export * from './lib/keepsake';export * from './lib/translation';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',loader:{'.jpg':'dataurl','.txt':'text'}});
const {multilingualSnapshot,editionSnapshot,editionHtml,initialStory}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const base={...initialStory,name:'Mei',language:'en',paperLanguage:'en',approved:true,presentation:{version:1,format:'newspaper'},turns:[{role:'user',text:'The garden story.'}],sources:[],draft:'',artwork:'none',paper:{headline:'The garden',standfirst:'Rows of tomatoes.',paragraphs:['Summer in the garden.'],quote:''}};
const translated=(language,paper)=>({...base,originStoryId:'story-base',paperLanguage:language,approved:true,paper});
const zh=translated('zh',{headline:'菜园',standfirst:'一排排番茄。',paragraphs:['花园里的夏天。'],quote:''});
const es=translated('es',{headline:'El huerto',standfirst:'Hileras de tomates.',paragraphs:['Verano en el huerto.'],quote:''});
const zhUnapproved={...zh,approved:false};
// Bundling: approved translations join; unapproved ones never do; single-language shares stay legacy-shaped.
const single=multilingualSnapshot(base,[]);
assert.equal(single.editions,undefined);assert.equal(single.defaultLanguage,undefined);assert.deepEqual(single.turns,[]);
const bundle=multilingualSnapshot(base,[zh,es]);
assert.equal(bundle.defaultLanguage,'en');assert.deepEqual(Object.keys(bundle.editions).sort(),['es','zh']);
assert.equal(bundle.editions.zh.paper.headline,'菜园');assert.equal(bundle.editions.zh.language,'zh');assert.deepEqual(bundle.editions.zh.turns,[]);
const partial=multilingualSnapshot(base,[zhUnapproved,es]);
assert.deepEqual(Object.keys(partial.editions),['es'],'Unapproved translations are never bundled');
// Interview turns join only with the transcript opt-in, and only into the matching edition.
const zhTurns=[{role:'user',text:'菜园的故事。'}];
const withTranscript=multilingualSnapshot({...base,transcriptTranslations:{zh:zhTurns}},[zh,es]);
assert.deepEqual(withTranscript.turns,base.turns);assert.deepEqual(withTranscript.editions.zh.turns,zhTurns);assert.deepEqual(withTranscript.editions.es.turns,[]);
// Shared page: switcher and read-both only when more than one edition exists.
const web=editionHtml(bundle,undefined,{webReader:true});
assert.match(web,/id="reader-lang"/);assert.match(web,/id="reader-both"/);
assert.ok(web.includes('>English<')&&web.includes('>Chinese<')&&web.includes('>Spanish<'),'The switcher lists every edition');
for(const key of ['data-reader-lang="en"','data-reader-lang="zh"','data-reader-lang="es"','data-reader-pair="en+es"','data-reader-pair="en+zh"','data-reader-pair="es+zh"'])assert.ok(web.includes(key),key);
// No-JS default render: only the default language is visible, and it owns the document language.
assert.match(web,/<html lang="en">/);assert.match(web,/<div data-reader-lang="en">/);
assert.match(web,/data-reader-lang="zh" hidden/);assert.match(web,/data-reader-pair="en\+zh" hidden/);
assert.match(web,/<title>A memory, kept with Once &amp; Ours · /,'Web readers keep the generic title; link previews never leak the headline');
assert.match(web,/storypress-reader-view/,'Reader preference persistence key');
const singleHtml=editionHtml(single,undefined,{webReader:true});
assert.ok(!singleHtml.includes('id="reader-lang"')&&!singleHtml.includes('id="reader-both"'));assert.ok(!singleHtml.includes('data-reader-pair="'),'No pair sections without a second edition');
assert.match(singleHtml,/data-reader-lang="en">/);
const offline=editionHtml(bundle);
assert.ok(offline.includes('id="reader-lang"'));assert.ok(!offline.includes('location.origin'),'Offline copies stay host-independent');
assert.match(offline,/<title>The garden · /,'The offline copy titles with the primary headline');
// Side-by-side pair: both headlines server-rendered with per-cell language tags.
const pairStart=web.indexOf('data-reader-pair="en+zh"'),pairHtml=web.slice(pairStart,pairStart+3000);
assert.ok(pairHtml.includes('keepsake-pair'));assert.ok(pairHtml.includes('The garden'));assert.ok(pairHtml.includes('菜园'));
assert.ok(pairHtml.includes('lang="en"')&&pairHtml.includes('lang="zh"'));
// Transcript section appears exactly where turns exist (base + zh here), nowhere else.
const sharedHtml=editionHtml(withTranscript,undefined,{webReader:true});
assert.match(sharedHtml,/keepsake-transcript/);assert.match(sharedHtml,/菜园的故事。/);
assert.equal((sharedHtml.match(/<details class="keepsake-transcript/g)||[]).length,2);
assert.ok(!editionHtml(bundle).includes('<details class="keepsake-transcript'),'No transcript section without the opt-in');
// Legacy snapshots (no editions map) parse and render as a single edition.
const legacy=editionSnapshot(base);
assert.equal(legacy.editions,undefined);
const legacyHtml=editionHtml(legacy,undefined,{webReader:true});
assert.ok(!legacyHtml.includes('id="reader-lang"'));assert.match(legacyHtml,/<html lang="en">/);assert.match(legacyHtml,/data-reader-lang="en">/);
console.log('Passed: multilingual share bundles, switcher presence and absence, side-by-side pairs, transcript opt-in, legacy compatibility, and no-JS default render.');
