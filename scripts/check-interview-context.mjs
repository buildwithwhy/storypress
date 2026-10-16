import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundle=await build({stdin:{contents:"export {handleApi} from './server/api.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',loader:{'.txt':'text','.jpg':'dataurl'}});
const {handleApi}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'mock-public',SUPABASE_SECRET_KEY:'mock-private',GEMINI_BACKEND:'vertex',GOOGLE_CLOUD_PROJECT:'fixture',VERTEX_API_KEY:'mock-vertex',GEMINI_API_KEY:'mock-studio',GEMINI_LIVE_MODEL:'gemini-test-live',STORYPRESS_LIVE_VOICE:'gemini'};
const reference={id:'selected',title:'Public archive',url:'https://example.org/archive',publisher:'Archive',date:'1982',description:'Public context, not a personal memory.',connection:'Possible connection',question:'Does this look familiar?',selected:true,reaction:'unsure'};
const originalFetch=globalThis.fetch;
let textContext,livePrompt,quotaReservations=0,providerCalls=0;
globalThis.fetch=async(url,init)=>{
 const target=String(url);
 if(target.endsWith('/auth/v1/user'))return Response.json({id:'11111111-1111-4111-8111-111111111111',email:'test@example.invalid'});
 if(target.includes('storypress_reserve_ai')){quotaReservations++;return Response.json(true);}
 const body=JSON.parse(init.body);providerCalls++;
 if(target.includes('aiplatform.googleapis.com')){
  textContext=JSON.parse(body.contents[0].parts[0].text);
  const result={candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({question:'What would you like them to know?'})}]}}]};
  return target.includes(':streamGenerateContent')?new Response('data: '+JSON.stringify(result)+'\n\n',{headers:{'Content-Type':'text/event-stream'}}):Response.json(result);
 }
 assert.equal(target,'https://generativelanguage.googleapis.com/v1beta/auth_tokens');
 livePrompt=body.bidiGenerateContentSetup.systemInstruction.parts[0].text;
 return Response.json({name:'ephemeral-fixture'});
};
const request=(action,story,stream=false)=>new Request('https://story.test/api/story',{method:'POST',headers:{Authorization:'Bearer fixture',Origin:'https://story.test','Content-Type':'application/json'},body:JSON.stringify({action,story,stream})});
try{
 for(const [language,correction] of [['en','It was my aunt, not my mother.'],['zh','不是妈妈，是阿姨。'],['es','Era mi tía, no mi madre.']]){
  const story={name:'Alex',language,occasion:'graduation',intention:{kind:'message',recipient:'Sam'},turns:[{role:'user',text:correction}],sources:[reference,{...reference,id:'unselected',title:'DO NOT SEND UNSELECTED',selected:false}],photo:'PRIVATE IMAGE BYTES',draft:'UNSENT DRAFT',photoAnalysis:{visibleDetails:['A red bag'],possibleContext:['Possibly a station'],question:'Unused question',searchQueries:['Unused search']},paper:{headline:'OLD GENERATED TITLE',standfirst:'Old draft',paragraphs:['Old words'],quote:''},sample:false,approved:false};
  assert.equal((await handleApi(request('interview',story),env)).status,200);
  const streamed=await handleApi(request('interview',story,true),env);assert.equal(streamed.status,200);assert.match(streamed.headers.get('Content-Type'),/text\/event-stream/);assert.match(await streamed.text(),/"type":"complete"/);
  assert.equal((await handleApi(request('live',story),env)).status,200);
  const liveContext=JSON.parse(livePrompt.slice(livePrompt.lastIndexOf('\n')+1));
  assert.deepEqual(liveContext,textContext,'Both interview modes receive the same evidence at session start');
  assert.equal(liveContext.storyFocus.label,'A new chapter');
  assert.deepEqual(liveContext.intention,story.intention);
  assert.deepEqual(liveContext.transcript,story.turns,'Corrections must remain in the evidence');
  assert.deepEqual(liveContext.historicalContext,[reference],'Only selected sources, including uncertainty, reach the interview');
  assert.deepEqual(liveContext.unverifiedPhotoClues,{visibleDetails:['A red bag'],possibleContext:['Possibly a station']});
  for(const excluded of ['PRIVATE IMAGE BYTES','UNSENT DRAFT','DO NOT SEND UNSELECTED','OLD GENERATED TITLE'])assert.ok(!JSON.stringify(liveContext).includes(excluded),`${excluded} must stay out of interview context`);
 }
 const beforeQuota=quotaReservations,beforeProvider=providerCalls;
 const oversized={name:'',language:'en',occasion:'life',turns:Array.from({length:5},()=>({role:'user',text:'x'.repeat(11000)})),sources:[],sample:false,approved:false};
 assert.equal((await handleApi(request('live',oversized),env)).status,400);
 assert.equal(quotaReservations,beforeQuota,'Oversized live context must fail before reserving a session');
 assert.equal(providerCalls,beforeProvider);
}finally{globalThis.fetch=originalFetch;}
console.log('Passed shared interview evidence, multilingual corrections, selected-source uncertainty, photo-clue separation, private-draft exclusion and live context limits. Providers mocked; interview quality is not assessed by this test.');
