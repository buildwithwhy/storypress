import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export * from './lib/edition.ts';export * from './lib/artwork-data.ts';export * from './lib/artwork.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {editionHtml,editionSnapshot,editionArtwork,chosenArtwork,artHeadroom,ART_HEADROOM_MIN}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
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
console.log('Passed: legacy stock-art removal in every format and export, private art directions, generated artwork, default-illustrated resolution with silent degradation, text-only/photo precedence, approval gate, storage headroom, and private interview/research exclusion.');
