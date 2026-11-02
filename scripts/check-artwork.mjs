import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export * from './lib/edition.ts';export * from './lib/artwork-data.ts';export * from './lib/artwork.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {editionHtml,editionSnapshot,editionArtwork,chosenArtwork,artHeadroom,ART_HEADROOM_MIN,shouldAutoIllustrate}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const story={name:'Fictional narrator',language:'en',occasion:'life',turns:[{role:'user',text:'PRIVATE_WORDS'}],artInstructions:'PRIVATE_ART_DIRECTION',draft:'PRIVATE_DRAFT',researchSuggestion:{query:'PRIVATE_QUERY',reason:'PRIVATE_REASON'},researchQueries:['PRIVATE_HISTORY'],sources:[],sample:false,approved:true,paper:{headline:'A small memory',standfirst:'A keepsake.',paragraphs:['We made tea.'],quote:''}};
for(const key of [undefined,'memories','together','journey','none','generated'])for(const format of ['newspaper','booklet','letter']){
 const old={...story,artwork:key,presentation:{version:1,format}};
 assert.equal(chosenArtwork(old),'none');assert.equal(editionArtwork(old),undefined);
 const snapshot=editionSnapshot(old);assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_'));
 assert.equal(snapshot.artwork,'none');
 const html=editionHtml(snapshot,'data:image/jpeg;base64,OLD_STOCK_FALLBACK');
 assert.ok(!html.includes('<figure'));assert.ok(!html.includes('OLD_STOCK'));assert.ok(!html.includes('/artwork/'));assert.ok(!html.includes('not a photograph of this memory'));
}
assert.ok(!editionHtml({...story,artwork:'none'}).includes('<figure'));
assert.ok(!editionHtml({...story,photo:'data:image/jpeg;base64,/9j/'}).includes('class="editorial-art"'));
const generated={data:'data:image/jpeg;base64,/9j/',style:'comic',model:'fixture',sourceKey:'fixture'};
const illustrated=editionSnapshot({...story,artwork:'generated',generatedArt:generated,photo:'data:image/jpeg;base64,PRIVATE_PHOTO'});
assert.equal(illustrated.photo,undefined);assert.equal(illustrated.generatedArt.data,generated.data);assert.match(editionHtml(illustrated),/story-generated-art/);assert.match(editionHtml(illustrated),/AI illustration inspired by your story/);
assert.equal(editionSnapshot({...story,artwork:'none',generatedArt:generated}).generatedArt,undefined,'The explicit text-only opt-out keeps generated artwork private');
// Default illustration (spec item 4): an ABSENT artwork choice is "no decision
// yet" and defaults to illustrated — once an illustration exists it is the
// keepsake's artwork through the same snapshot boundary downloads and shared
// readers use. Before an illustration exists (generation refused or failed),
// resolution degrades to the photograph, else text-only.
const defaulted={...story,artwork:undefined,generatedArt:generated};
assert.equal(chosenArtwork(defaulted),'generated');
assert.equal(editionArtwork(defaulted),generated.data);
const defaultSnapshot=editionSnapshot(defaulted);
assert.equal(defaultSnapshot.photo,undefined);
assert.equal(defaultSnapshot.generatedArt.data,generated.data);
assert.ok(!JSON.stringify(defaultSnapshot).includes('PRIVATE_'));
assert.match(editionHtml(defaultSnapshot),/story-generated-art/);
assert.equal(chosenArtwork({...defaulted,generatedArt:undefined}),'none','Without artwork data the absent choice degrades to text-only');
assert.throws(()=>editionSnapshot({...story,approved:false}));
for(const key of [undefined,'memories','together','journey']){const photo={...story,artwork:key,photo:'data:image/jpeg;base64,/9j/'};assert.equal(chosenArtwork(photo),'memories');assert.ok(editionHtml(photo).includes('<img src="'+photo.photo+'"')); }
assert.equal(editionArtwork({...story,artwork:'generated',generatedArt:generated}),generated.data);
// Storage-headroom guard (spec item 4): shared by the manual buttons and the
// default-illustration auto-run. It must ignore any existing generated
// artwork bytes and refuse a story already over the draft budget.
assert.ok(artHeadroom(story)>ART_HEADROOM_MIN,'a small story has room for artwork');
assert.ok(artHeadroom(story)<=300000,'headroom never promises more than the image schema allows');
assert.equal(artHeadroom({...story,generatedArt:generated}),artHeadroom(story),'headroom ignores any existing generated artwork');
assert.ok(artHeadroom({...story,turns:[{role:'user',text:'x'.repeat(3000000)}]})<ART_HEADROOM_MIN,'a story over the draft budget refuses artwork');
// Default-illustration trigger (wave-3 fix 1): the page's auto-run calls this
// one pure predicate. A legacy story stored artwork:'none' as "nothing chosen
// yet" (no opt-out marker), so it default-illustrates once on its next paper
// entry; an explicit 'no illustration' choice records artworkOptedOut and
// never triggers. All wave-2 guardrails hold: only on the paper stage of a
// non-sample draft keepsake with words, signed in and under the daily limit,
// no artwork yet, not approved, not mid-request, and the once-per-story latch
// burns on dispatch so a refusal never loops.
const trigger={...story,approved:false,artwork:'none'};
const ctx={editing:false,busy:false,paper:true,eligible:true,tried:false};
assert.ok(shouldAutoIllustrate(trigger,ctx),'a legacy story (artwork none, no marker) default-illustrates once');
assert.ok(!shouldAutoIllustrate(trigger,{...ctx,tried:true}),'the once-per-story latch holds');
assert.ok(!shouldAutoIllustrate({...trigger,artworkOptedOut:true},ctx),'an explicit no-illustration choice never auto-illustrates');
assert.ok(!shouldAutoIllustrate({...trigger,artwork:'generated',generatedArt:generated},ctx),'a story with artwork never re-illustrates');
assert.ok(!shouldAutoIllustrate({...trigger,approved:true},ctx),'approved keepsakes are never re-illustrated');
assert.ok(!shouldAutoIllustrate({...trigger,sample:true},ctx),'samples never auto-illustrate');
assert.ok(!shouldAutoIllustrate(trigger,{...ctx,paper:false}),'no trigger off the paper stage');
assert.ok(!shouldAutoIllustrate({...trigger,turns:[]},ctx),'a keepsake with no words has nothing to illustrate');
assert.ok(!shouldAutoIllustrate(trigger,{...ctx,eligible:false}),'the daily-limit/eligibility gate holds');
assert.ok(!shouldAutoIllustrate(trigger,{...ctx,busy:true}),'no trigger while another request runs');
assert.ok(!shouldAutoIllustrate(trigger,{...ctx,editing:true}),'no trigger while editing the draft');
assert.equal(editionSnapshot({...trigger,artworkOptedOut:true,approved:true}).artworkOptedOut,undefined,'the opt-out marker never reaches shared editions');
console.log('Passed: legacy stock-art removal in every format and export, private art directions, generated artwork, default-illustrated resolution with silent degradation, text-only/photo precedence, approval gate, storage headroom, private interview/research exclusion, and the legacy default-illustration trigger.');
