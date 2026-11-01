import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export * from './lib/translation';export * from './lib/story';export * from './lib/story-saver';export * from './lib/edition';export * from './lib/keepsake';export * from './lib/editions';export * from './server/api';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',loader:{'.txt':'text','.jpg':'dataurl'}});
const {translationInput,translatedStory,validateTranslation,transcriptInput,validateTranscript,applyTranscriptTranslation,storySchema,initialStory,editionSnapshot,editionHtml,keepsakeMarkup,createStorySaver,handleApi,parseStoryRows,editionTargets,editionButtonLabel,editionRowNote,translationOriginId}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const story={...initialStory,name:'Lin',approved:true,presentation:{version:1,format:'booklet'},paper:{headline:'Grandma’s kitchen',standfirst:'A place for all of us.',paragraphs:['Grandma made dumplings.','I always wanted another.'],quote:''},photo:'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==',photoCaption:'Our kitchen',artwork:'memories',turns:[{role:'user',text:'PRIVATE_INTERVIEW'}],draft:'PRIVATE_UNSENT',artInstructions:'PRIVATE_DIRECTIONS',sources:[{id:'keep',title:'Market',description:'The market opened in 1960.',date:'June 1960',url:'https://example.org/archive',publisher:'Archive',selected:true,connection:'PRIVATE_CONNECTION',question:'PRIVATE_QUESTION'},{id:'omit',title:'PRIVATE_UNSELECTED',description:'PRIVATE_UNSELECTED',date:'',url:'https://example.org/other',publisher:'Archive',selected:false,connection:'',question:''}]};
const result={sourceLanguage:'en',paper:{headline:'外婆的厨房',standfirst:'属于我们所有人的地方。',paragraphs:['外婆包饺子。','我总想再吃一个。'],quote:''},photoCaption:'我们的厨房',context:[{title:'集市',description:'集市于1960年开业。',date:'1960年6月'}]};
const input=translationInput(story,'zh'),before=structuredClone(story);
assert.ok(!JSON.stringify(input).includes('PRIVATE_'));assert.ok(!JSON.stringify(input).includes('base64'));assert.ok(!JSON.stringify(input).includes('https:'));
assert.equal(translationInput({...story,language:'zh'},'zh').sourceLanguage,undefined,'Legacy UI language must not masquerade as the text language');
const translated=translatedStory(story,'zh',result);assert.equal(translated.translation.sourceLanguage,'en');assert.deepEqual(story,before);assert.equal(translated.language,'en');assert.equal(translated.paperLanguage,'zh');assert.equal(translated.approved,false);assert.equal(translated.photo,story.photo);assert.deepEqual(translated.presentation,story.presentation);assert.equal(translated.sources[0].url,story.sources[0].url);assert.equal(translated.sources[0].description,result.context[0].description);assert.deepEqual(translated.turns,story.turns);assert.equal(translated.draft,'');assert.equal(storySchema.parse(translated).paperLanguage,'zh');
assert.throws(()=>editionSnapshot(translated),/approve/);
assert.throws(()=>validateTranslation(input,{...result,paper:{...result.paper,paragraphs:['Missing paragraph']}}));
assert.throws(()=>validateTranslation(input,{...result,context:[]}));
assert.throws(()=>validateTranslation(input,{...result,paper:{...result.paper,quote:'An invented quotation'}}));
assert.throws(()=>validateTranslation(input,{...result,paper:{...result.paper,standfirst:''}}));
for(const format of ['newspaper','booklet','letter']){
 const approved={...translated,approved:true,presentation:{version:1,format}};
 const snapshot=editionSnapshot(approved);assert.equal(snapshot.language,'zh');assert.deepEqual(snapshot.turns,[]);assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_'));
 for(const html of [keepsakeMarkup(approved),editionHtml(snapshot),editionHtml(snapshot,undefined,{webReader:true})]){assert.match(html,/lang="zh"/);assert.match(html,/外婆的厨房/);assert.match(html,/我们的厨房/);assert.ok(!html.includes('Grandma’s kitchen'));assert.ok(!html.includes('PRIVATE_'));}
 assert.match(editionHtml(snapshot,undefined,{webReader:true}),/lang=zh/);
}
assert.match(editionHtml(editionSnapshot(story)),/lang="en"/,'Legacy stories still render in their language');
// Saved translations get a new private identity; originals and published snapshots survive failures.
let id=0,identity=null,fail=false;const rows=new Map();
const saver=createStorySaver({save:async(value,saved)=>{if(fail)throw new Error('Offline');const next={id:saved?.id||'story-'+(++id),revision:(saved?.revision||0)+1,share_token:saved?.share_token||null};rows.set(next.id,{...next,story:structuredClone(value)});return next;},changeSharing:async(_action,saved)=>({...saved,share_token:'original-public-token'}),remove:async()=>{},onSaved:next=>{identity=next;},onStatus:()=>{}});
saver.replace(story,null);await saver.flush();await saver.changeSharing('share');const originalIdentity=identity;fail=true;await assert.rejects(saver.saveCopy(translated),/Offline/);assert.deepEqual(identity,originalIdentity);assert.equal(rows.size,1);assert.deepEqual(rows.get(identity.id).story,story);
fail=false;await saver.saveCopy(translated);assert.equal(rows.size,2);assert.notEqual(identity.id,originalIdentity.id);assert.equal(identity.share_token,null);assert.deepEqual(rows.get(originalIdentity.id).story,story);assert.equal(rows.get(identity.id).story.paperLanguage,'zh');
// Edition clarity (translation fix §4): owner navigation between saved editions.
const originalRowId='3f9d6a58-1111-4b2e-9c31-0f2a7c8d5e10',zhCopyId='5b2e8c41-2222-4c9f-8d47-1a3b9d7c6f20',esSiblingId='7c4f9d52-3333-4d18-a6b8-2c4e0f9a7d31';
const copyWithOrigin=translatedStory(story,'zh',result,originalRowId);
assert.equal(translationOriginId(copyWithOrigin,zhCopyId),originalRowId,'A copy of a copy links to the original, never the intermediate');
assert.equal(translationOriginId(story,originalRowId),originalRowId);
const esResult={sourceLanguage:'zh',paper:{headline:'La cocina de la abuela',standfirst:'Un lugar para todos nosotros.',paragraphs:['La abuela hacía dumplings.','Siempre quise otro.'],quote:''},photoCaption:'Nuestra cocina',context:[{title:'Mercado',description:'El mercado abrió en 1960.',date:'Junio de 1960'}]};
const copyBefore=structuredClone(copyWithOrigin),originalBefore=structuredClone(story);
const copyOfCopy=translatedStory(copyWithOrigin,'es',esResult,translationOriginId(copyWithOrigin,zhCopyId));
assert.equal(copyOfCopy.originStoryId,originalRowId);
assert.deepEqual(copyWithOrigin,copyBefore);assert.deepEqual(story,originalBefore,'The original story is never mutated');
assert.deepEqual(copyOfCopy.turns,story.turns,'Interview turns stay in their own language');
assert.equal(copyOfCopy.turns[0].text,'PRIVATE_INTERVIEW');
const listRows=parseStoryRows([
 {id:originalRowId,title:'Grandma’s kitchen',revision:2,updated_at:'2026-11-01T00:00:00Z',origin_story_id:null,paper_language:'en'},
 {id:zhCopyId,title:'外婆的厨房',revision:1,updated_at:'2026-11-01T01:00:00Z',origin_story_id:originalRowId,paper_language:'zh'},
 {id:esSiblingId,title:'La cocina de la abuela',revision:1,updated_at:'2026-11-01T02:00:00Z',origin_story_id:originalRowId,paper_language:'es'}
]);
assert.equal(parseStoryRows('garbage').length,0);
const fromOriginal=editionTargets({id:originalRowId},listRows);
assert.equal(fromOriginal.original,undefined);
assert.deepEqual(fromOriginal.translations.map(row=>row.id),[zhCopyId,esSiblingId]);
const fromCopy=editionTargets({id:zhCopyId,originStoryId:originalRowId},listRows);
assert.equal(fromCopy.original?.id,originalRowId,'One tap from a copy to the original');
assert.deepEqual(fromCopy.translations.map(row=>row.id),[esSiblingId]);
// Switching resolves saved rows directly — never a re-translation — so the copy still carries the original-language interview turns.
assert.deepEqual(copyWithOrigin.turns,story.turns);
assert.equal(editionButtonLabel(listRows[1],'translation','en'),'Translation · Chinese');
assert.equal(editionButtonLabel(listRows[0],'original','zh'),'原作 · 英语');
assert.equal(editionRowNote(listRows[0],listRows,'en'),'');
const zhNote=editionRowNote(listRows[1],listRows,'en');
assert.ok(zhNote.includes('Chinese'),zhNote);assert.ok(zhNote.includes('translation of Grandma’s kitchen'),zhNote);
assert.ok(editionRowNote(listRows[2],listRows,'es').includes('traducción de Grandma’s kitchen'));
assert.ok(editionRowNote(listRows[1],listRows,'zh').includes('译自《Grandma’s kitchen》'));
assert.ok(editionRowNote({...listRows[1],origin_story_id:'9e9f8e8d-4444-4e2a-9b3c-5d6e7f8a9b0c'},listRows,'en').includes('Translation'),'A copy whose original is gone still shows its language');
// API boundary: auth, quota and one existing Cloud writer call; no private context.
const userId='c60a25ef-f588-4df5-a89f-dcb1ea1a6470';
const env={GEMINI_BACKEND:'vertex',GOOGLE_CLOUD_PROJECT:'fixture',VERTEX_API_KEY:'mock-cloud',GEMINI_WRITING_MODEL:'gemini-test-writing',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'mock-public',SUPABASE_SECRET_KEY:'mock-secret'};
const request=(translation=input,signedIn=true)=>new Request('https://story.test/api/story',{method:'POST',headers:{Origin:'https://story.test',...(signedIn?{Authorization:'Bearer fixture'}:{})},body:JSON.stringify({action:'translate',translation,story})});
const originalFetch=globalThis.fetch;let queue=[],calls=[];
globalThis.fetch=async(url,options)=>{const next=queue.shift();assert.ok(next,'Unexpected external call');const call={url:String(url),body:options.body?JSON.parse(options.body):undefined};calls.push(call);next.check?.(call);return Response.json(next.body,{status:next.status||200});};
const auth=()=>({body:{id:userId}}),quota=allowed=>({check:c=>assert.deepEqual(c.body,{p_user:userId,p_action:'write'}),body:allowed}),provider=(output=result)=>({check:c=>{assert.ok(c.url.endsWith('/models/gemini-test-writing:generateContent'));assert.ok(!JSON.stringify(c.body).includes('PRIVATE_'));assert.deepEqual(JSON.parse(c.body.contents[0].parts[0].text),JSON.parse(JSON.stringify(input)));},body:{candidates:[{content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}]}});
try{
 assert.equal((await handleApi(request(input,false),env)).status,401);assert.equal(calls.length,0);
 for(const invalid of [{...input,targetLanguage:'unknown'},{...input,paper:undefined}]){queue=[auth()];assert.equal((await handleApi(request(invalid),env)).status,400);assert.equal(queue.length,0);}
 queue=[auth(),quota(false)];assert.equal((await handleApi(request(),env)).status,429);assert.equal(queue.length,0);
 queue=[auth(),quota(true),provider()];const response=await handleApi(request(),env);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{translation:result});assert.equal(queue.length,0);
 queue=[auth(),quota(true),provider({...result,context:[]})];assert.equal((await handleApi(request(),env)).status,502);assert.equal(queue.length,0);
 queue=[auth(),quota(true),{status:500,body:{error:'PRIVATE_PROVIDER_ERROR'}}];const failed=await handleApi(request(),env);assert.equal(failed.status,502);assert.ok(!(await failed.text()).includes('PRIVATE_PROVIDER_ERROR'));assert.equal(queue.length,0);assert.deepEqual(story,before);
 // Transcript translation: explicit opt-in, minimal input, structure and roles preserved on this story.
 const interview={...story,turns:[{role:'user',text:'She made dumplings.'},{role:'assistant',text:'  '},{role:'user',text:'Every Sunday.'}]};
 const transcriptRequest=transcriptInput(interview,'zh');
 assert.ok(!JSON.stringify(transcriptRequest).includes('PRIVATE_'));assert.ok(!JSON.stringify(transcriptRequest).includes('base64'));
 assert.deepEqual(transcriptRequest,{turns:[{text:'She made dumplings.'},{text:'  '},{text:'Every Sunday.'}],targetLanguage:'zh'});
 assert.throws(()=>validateTranscript(transcriptRequest,{turns:[{text:'她包饺子。'},{text:'  '}]}));
 assert.throws(()=>validateTranscript(transcriptRequest,{turns:[{text:'她包饺子。'},{text:'好吃'},{text:'每个周日。'}]}),'An empty turn must stay empty');
 const transcriptResult={turns:[{text:'她包饺子。'},{text:'  '},{text:'每个周日。'}]};
 assert.deepEqual(validateTranscript(transcriptRequest,transcriptResult),['她包饺子。','  ','每个周日。']);
 const withTranscript=applyTranscriptTranslation(interview,'zh',transcriptResult);
 assert.deepEqual(withTranscript.transcriptTranslations.zh.map(t=>({role:t.role,text:t.text})),[{role:'user',text:'她包饺子。'},{role:'assistant',text:'  '},{role:'user',text:'每个周日。'}]);
 assert.equal(interview.transcriptTranslations,undefined,'The original story stays untouched');
 const transcriptApi=(transcript=transcriptRequest,signedIn=true)=>new Request('https://story.test/api/story',{method:'POST',headers:{Origin:'https://story.test',...(signedIn?{Authorization:'Bearer fixture'}:{})},body:JSON.stringify({action:'translate-transcript',transcript})});
 const providerTranscript=(output=transcriptResult)=>({check:c=>{assert.ok(c.url.endsWith('/models/gemini-test-writing:generateContent'));assert.ok(!JSON.stringify(c.body).includes('PRIVATE_'));assert.deepEqual(JSON.parse(c.body.contents[0].parts[0].text),JSON.parse(JSON.stringify(transcriptRequest)));},body:{candidates:[{content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}]}});
 assert.equal((await handleApi(transcriptApi(transcriptRequest,false),env)).status,401);
 queue=[auth(),quota(false)];assert.equal((await handleApi(transcriptApi(),env)).status,429);assert.equal(queue.length,0);
 queue=[auth(),quota(true),providerTranscript()];const transcriptResponse=await handleApi(transcriptApi(),env);assert.equal(transcriptResponse.status,200);assert.equal(transcriptResponse.headers.get('cache-control'),'no-store');assert.deepEqual(await transcriptResponse.json(),{turns:['她包饺子。','  ','每个周日。']});assert.equal(queue.length,0);
 queue=[auth(),quota(true),providerTranscript({...transcriptResult,turns:[{text:'她包饺子。'},{text:'  '}]})];assert.equal((await handleApi(transcriptApi(),env)).status,502);assert.equal(queue.length,0);
}finally{globalThis.fetch=originalFetch;}
console.log('Passed: translation data minimization, validation, separate private copies, failed-save retention, original preservation, all three formats, translated reader/download language, auth, quota, Cloud writer routing, upstream failures, transcript translation, edition switcher navigation, labeled list rows, and no copy-of-copy chains.');
