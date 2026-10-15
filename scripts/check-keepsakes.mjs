import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './lib/story.ts';export * from './lib/keepsake.ts';export * from './lib/edition.ts';export * from './lib/research-state.ts';export * from './lib/share-images.ts';export * from './lib/live-voice.ts';export * from './server/live.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',loader:{'.jpg':'dataurl'}});
const {initialStory,storySchema,editionSnapshot,editionHtml,keepsakeMarkup,storyPages,mergeResearch,wrapLines,pcm16,liveToken}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const paragraphs=['I remembered a quiet afternoon.','I said <script>not executable</script>.','妈妈说：慢慢来。'];
const base={...initialStory,name:'A & B',recordingCollectionId:'11111111-1111-4111-8111-111111111111',turns:[{role:'user',text:'PRIVATE ORIGINAL'}],draft:'PRIVATE DRAFT',paper:{headline:'A memory < & >',standfirst:'Our afternoon.',paragraphs,quote:''},approved:true};
for(const language of ['en','zh','es'])for(const format of ['newspaper','booklet','letter']){
 const story=storySchema.parse({...base,language,presentation:{version:1,format},intention:{kind:'message',recipient:'Mum <script>'}}),snapshot=editionSnapshot(story),html=editionHtml(snapshot);
 assert.ok(html.includes('keepsake-'+format));assert.ok(!html.includes('PRIVATE'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('recordingCollectionId'));
 assert.deepEqual(snapshot.paper.paragraphs,paragraphs);assert.equal(snapshot.recordingCollectionId,undefined);assert.equal(snapshot.intention?.recipient,format==='letter'?'Mum <script>':undefined);
 assert.ok(!html.includes('reader-next"><'));assert.ok(editionHtml(snapshot,undefined,{webReader:true}).includes('?download=1'));
}
assert.equal(storySchema.parse(base).presentation,undefined,'Legacy stories still parse');
assert.throws(()=>editionSnapshot({...base,approved:false}));
assert.deepEqual(storyPages(['a'.repeat(1000),'b'.repeat(1500),'short']).flat(),['a'.repeat(1000),'b'.repeat(1500),'short']);
assert.ok(!keepsakeMarkup({...base,presentation:{version:1,format:'letter'},intention:{kind:'memory',recipient:'Do not display'}}).includes('Do not display'));
const source={id:'x',title:'A place',url:'https://example.org',publisher:'Archive',description:'Context',connection:'',question:'',date:'',selected:false};
const continued={...base,turns:[...base.turns,{role:'user',text:'A new answer.'}],draft:'still typing'};
assert.deepEqual(mergeResearch(continued,base,[source],'a place').turns,continued.turns);assert.equal(mergeResearch(continued,base,[source],'a place').draft,'still typing');
const corrected={...base,turns:[{role:'user',text:'Correction'}]};assert.equal(mergeResearch(corrected,base,[source],'place'),corrected);
const chosen={...continued,sources:[{...source,selected:true}]};assert.equal(mergeResearch(chosen,base,[source],'place').sources[0].selected,true);
const sample='一个很长的故事abcdefghijk';assert.equal(wrapLines(sample,4,s=>Array.from(s).length).join(''),sample);
assert.deepEqual([...pcm16(new Float32Array([1,-1,0,.5]),16000)],[32767,-32768,0,16383]);
const originalFetch=globalThis.fetch,env={SUPABASE_URL:'https://fake.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SECRET_KEY:'secret-test',STORYPRESS_LIVE_VOICE:'gemini',STORYPRESS_LIVE_TEST_EMAILS:'test@example.invalid',GEMINI_API_KEY:'never-leak',GEMINI_LIVE_MODEL:'gemini-test-live'};
let calls=[];globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});if(String(url).endsWith('/auth/v1/user'))return Response.json({id:base.recordingCollectionId,email:'test@example.invalid'});if(String(url).includes('reserve_ai'))return Response.json(true);const body=JSON.parse(init.body);assert.equal(body.uses,1);assert.ok(body.bidiGenerateContentSetup.systemInstruction.parts[0].text.includes('PRIVATE ORIGINAL'));assert.equal(body.bidiGenerateContentSetup.model,'models/gemini-test-live');assert.equal(body.bidiGenerateContentSetup.generationConfig.maxOutputTokens,1024);assert.ok(Date.parse(body.expireTime)-Date.now()<=600000);assert.equal(init.headers['x-goog-api-key'],'never-leak');return Response.json({name:'ephemeral-test'});};
try{
 const request=new Request('https://story.test/api/story',{headers:{Authorization:'Bearer test'}});
 const response=await liveToken(request,env,base.recordingCollectionId,base);const data=await response.json();assert.equal(data.token,'ephemeral-test');assert.equal(response.headers.get('Cache-Control'),'no-store');assert.ok(!JSON.stringify(data).includes('never-leak'));assert.equal(calls.length,3);
 calls=[];await assert.rejects(()=>liveToken(request,{...env,STORYPRESS_LIVE_VOICE:''},base.recordingCollectionId,base));assert.equal(calls.length,0);
 calls=[];await assert.rejects(()=>liveToken(request,{...env,STORYPRESS_LIVE_TEST_EMAILS:'different@example.invalid'},base.recordingCollectionId,base));assert.equal(calls.length,1,'Unlisted accounts cannot reserve units or request a token');
}finally{globalThis.fetch=originalFetch;}
console.log('Passed keepsake formats, exact text preservation, escaping, private recording exclusion, share downloads, research merging, CJK wrapping, PCM encoding and live-token boundaries. Provider calls mocked.');
