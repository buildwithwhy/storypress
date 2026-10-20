import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export * from './lib/translation';export * from './lib/story';export * from './lib/story-saver';export * from './lib/edition';export * from './lib/keepsake';export * from './server/api';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',loader:{'.txt':'text','.jpg':'dataurl'}});
const {translationInput,translatedStory,validateTranslation,storySchema,initialStory,editionSnapshot,editionHtml,keepsakeMarkup,createStorySaver,handleApi}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const story={...initialStory,name:'Lin',approved:true,presentation:{version:1,format:'booklet'},paper:{headline:'Grandma’s kitchen',standfirst:'A place for all of us.',paragraphs:['Grandma made dumplings.','I always wanted another.'],quote:''},photo:'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==',photoCaption:'Our kitchen',artwork:'memories',turns:[{role:'user',text:'PRIVATE_INTERVIEW'}],draft:'PRIVATE_UNSENT',artInstructions:'PRIVATE_DIRECTIONS',sources:[{id:'keep',title:'Market',description:'The market opened in 1960.',date:'June 1960',url:'https://example.org/archive',publisher:'Archive',selected:true,connection:'PRIVATE_CONNECTION',question:'PRIVATE_QUESTION'},{id:'omit',title:'PRIVATE_UNSELECTED',description:'PRIVATE_UNSELECTED',date:'',url:'https://example.org/other',publisher:'Archive',selected:false,connection:'',question:''}]};
const result={paper:{headline:'外婆的厨房',standfirst:'属于我们所有人的地方。',paragraphs:['外婆包饺子。','我总想再吃一个。'],quote:''},photoCaption:'我们的厨房',context:[{title:'集市',description:'集市于1960年开业。',date:'1960年6月'}]};
const input=translationInput(story,'zh'),before=structuredClone(story);
assert.ok(!JSON.stringify(input).includes('PRIVATE_'));assert.ok(!JSON.stringify(input).includes('base64'));assert.ok(!JSON.stringify(input).includes('https:'));
const translated=translatedStory(story,'zh',result);assert.deepEqual(story,before);assert.equal(translated.language,'en');assert.equal(translated.paperLanguage,'zh');assert.equal(translated.approved,false);assert.equal(translated.photo,story.photo);assert.deepEqual(translated.presentation,story.presentation);assert.equal(translated.sources[0].url,story.sources[0].url);assert.equal(translated.sources[0].description,result.context[0].description);assert.deepEqual(translated.turns,story.turns);assert.equal(translated.draft,'');assert.equal(storySchema.parse(translated).paperLanguage,'zh');
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
// API boundary: auth, quota and one existing Cloud writer call; no private context.
const userId='c60a25ef-f588-4df5-a89f-dcb1ea1a6470';
const env={GEMINI_BACKEND:'vertex',GOOGLE_CLOUD_PROJECT:'fixture',VERTEX_API_KEY:'mock-cloud',GEMINI_WRITING_MODEL:'gemini-test-writing',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'mock-public',SUPABASE_SECRET_KEY:'mock-secret'};
const request=(translation=input,signedIn=true)=>new Request('https://story.test/api/story',{method:'POST',headers:{Origin:'https://story.test',...(signedIn?{Authorization:'Bearer fixture'}:{})},body:JSON.stringify({action:'translate',translation,story})});
const originalFetch=globalThis.fetch;let queue=[],calls=[];
globalThis.fetch=async(url,options)=>{const next=queue.shift();assert.ok(next,'Unexpected external call');const call={url:String(url),body:options.body?JSON.parse(options.body):undefined};calls.push(call);next.check?.(call);return Response.json(next.body,{status:next.status||200});};
const auth=()=>({body:{id:userId}}),quota=allowed=>({check:c=>assert.deepEqual(c.body,{p_user:userId,p_action:'write'}),body:allowed}),provider=(output=result)=>({check:c=>{assert.ok(c.url.endsWith('/models/gemini-test-writing:generateContent'));assert.ok(!JSON.stringify(c.body).includes('PRIVATE_'));assert.deepEqual(JSON.parse(c.body.contents[0].parts[0].text),input);},body:{candidates:[{content:{parts:[{text:JSON.stringify(output)}]},finishReason:'STOP'}]}});
try{
 assert.equal((await handleApi(request(input,false),env)).status,401);assert.equal(calls.length,0);
 for(const invalid of [{...input,targetLanguage:'unknown'},{...input,targetLanguage:'en'},{...input,paper:undefined}]){queue=[auth()];assert.equal((await handleApi(request(invalid),env)).status,400);assert.equal(queue.length,0);}
 queue=[auth(),quota(false)];assert.equal((await handleApi(request(),env)).status,429);assert.equal(queue.length,0);
 queue=[auth(),quota(true),provider()];const response=await handleApi(request(),env);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{translation:result});assert.equal(queue.length,0);
 queue=[auth(),quota(true),provider({...result,context:[]})];assert.equal((await handleApi(request(),env)).status,502);assert.equal(queue.length,0);
 queue=[auth(),quota(true),{status:500,body:{error:'PRIVATE_PROVIDER_ERROR'}}];const failed=await handleApi(request(),env);assert.equal(failed.status,502);assert.ok(!(await failed.text()).includes('PRIVATE_PROVIDER_ERROR'));assert.equal(queue.length,0);assert.deepEqual(story,before);
}finally{globalThis.fetch=originalFetch;}
console.log('Passed: translation data minimization, validation, separate private copies, failed-save retention, original preservation, all three formats, translated reader/download language, auth, quota, Cloud writer routing, and upstream failures.');
