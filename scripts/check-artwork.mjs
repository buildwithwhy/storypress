import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import worker from '../dist/server/index.js';
const bundled=await build({entryPoints:['lib/edition.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {editionHtml,editionSnapshot}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const story={name:'Fictional narrator',language:'en',occasion:'life',turns:[{role:'user',text:'PRIVATE_WORDS'}],draft:'PRIVATE_DRAFT',researchSuggestion:{query:'PRIVATE_QUERY',reason:'PRIVATE_REASON'},researchQueries:['PRIVATE_HISTORY'],sources:[],sample:false,approved:true,paper:{headline:'A small memory',standfirst:'A keepsake.',paragraphs:['We made tea.'],quote:''}};
for(const key of ['memories','together','journey']){
 const response=await worker.fetch(new Request('https://example.test/artwork/'+key+'.jpg'),{});
 assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/jpeg');
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes[0],255);assert.equal(bytes[1],216);
 assert.deepEqual(bytes,await fs.readFile('public/artwork/'+key+'.jpg'));
 const snapshot=editionSnapshot({...story,artwork:key});assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_'));
 const html=editionHtml(snapshot,'data:image/jpeg;base64,'+bytes.toString('base64'));
 assert.ok(html.includes('data:image/jpeg;base64,'));assert.ok(!html.includes('src="/artwork/'));
 assert.match(html,/not a photograph of this memory/);
}
assert.ok(!editionHtml({...story,artwork:'none'}).includes('<figure'));
assert.ok(!editionHtml({...story,photo:'data:image/jpeg;base64,/9j/'}).includes('class="editorial-art"'));
const generated={data:'data:image/jpeg;base64,/9j/',style:'comic',model:'fixture',sourceKey:'fixture'};
const illustrated=editionSnapshot({...story,artwork:'generated',generatedArt:generated,photo:'data:image/jpeg;base64,PRIVATE_PHOTO'});
assert.equal(illustrated.photo,undefined);assert.equal(illustrated.generatedArt.data,generated.data);assert.match(editionHtml(illustrated),/story-generated-art/);assert.match(editionHtml(illustrated),/AI illustration inspired by your story/);
assert.equal(editionSnapshot({...story,generatedArt:generated}).generatedArt,undefined,'Unselected generated artwork must stay private');
assert.throws(()=>editionSnapshot({...story,approved:false}));
assert.equal((await worker.fetch(new Request('https://example.test/artwork/unknown.jpg'),{})).status,404);
console.log('Passed: served artwork matches files, self-contained illustrated edition, text-only/photo precedence, approval gate and private interview/research exclusion.');
