import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export * from './lib/edition.ts';export * from './lib/artwork-data.ts';export * from './lib/artwork.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {editionHtml,editionSnapshot,editionArtwork,chosenArtwork}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
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
assert.equal(editionSnapshot({...story,generatedArt:generated}).generatedArt,undefined,'Unselected generated artwork must stay private');
assert.throws(()=>editionSnapshot({...story,approved:false}));
for(const key of [undefined,'memories','together','journey']){const photo={...story,artwork:key,photo:'data:image/jpeg;base64,/9j/'};assert.equal(chosenArtwork(photo),'memories');assert.ok(editionHtml(photo).includes('<img src="'+photo.photo+'"')); }
assert.equal(editionArtwork({...story,artwork:'generated',generatedArt:generated}),generated.data);
console.log('Passed: legacy stock-art removal in every format and export, private art directions, generated artwork, text-only/photo precedence, approval gate and private interview/research exclusion.');
