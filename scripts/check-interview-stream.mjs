import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export {eventData} from './lib/event-stream';export {questionPreview} from './lib/interview-result';export {readInterviewResponse} from './lib/interview-client';export {streamInterview} from './server/interview-stream';export {createProviders} from './lib/providers';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {eventData,questionPreview,readInterviewResponse,streamInterview,createProviders}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const encoder=new TextEncoder(),collect=async iterator=>{const values=[];for await(const value of iterator)values.push(value);return values;};
function bytes(text,size=1){const buffer=encoder.encode(text);let offset=0;return new ReadableStream({pull(controller){if(offset>=buffer.length){controller.close();return;}controller.enqueue(buffer.slice(offset,offset+=size));}});}
assert.deepEqual(await collect(eventData(bytes(': ping\r\ndata: 你好\r\ndata: café\r\n\r\ndata: final'))),['你好\ncafé','final']);
await assert.rejects(()=>collect(eventData(bytes('data: too long\n\n'),4)),/too large/);
assert.equal(questionPreview('{"acknowledgement":"private","question":"Hello?"}'),'');
const question='她说 “hello” ☕️ 😀, did you say "yes"?\nThen what?',json=JSON.stringify({question,readyToWrite:true});
assert.equal(questionPreview(json),question);
assert.equal(questionPreview('{"question":"A\\uD83D'),'A');
assert.equal(questionPreview('{"question":"A\\uD83D\\uDE00'),'A😀');
assert.equal(questionPreview('{"question":"A\\'),'A');
const previews=[];
const response=streamInterview(async function*(){for(let i=0;i<json.length;i+=3)yield json.slice(i,i+3);},new AbortController().signal);
assert.equal(response.headers.get('Content-Type'),'text/event-stream; charset=utf-8');
assert.deepEqual(await readInterviewResponse(response,x=>previews.push(x)),{question,readyToWrite:true});
assert.ok(previews.length>2);assert.equal(previews.at(-1),question);assert.ok(previews.every(x=>!x.includes('readyToWrite')));
for(const raw of ['{"question":"Unfinished',JSON.stringify({question:'A valid-looking question?',readyToWrite:'yes'}),'provider detail with a secret']){
 const previews=[];await assert.rejects(()=>readInterviewResponse(streamInterview(async function*(){yield raw;},new AbortController().signal),x=>previews.push(x)),/did not finish/);
}
await assert.rejects(()=>readInterviewResponse(new Response(bytes('data: {"type":"preview","question":"Partial"}\n\n'),{headers:{'Content-Type':'text/event-stream'}}),()=>{}),/interrupted/);
assert.equal((await readInterviewResponse(Response.json({question:'Legacy response?'}),()=>{})).question,'Legacy response?');
let providerSignal,started;
const ready=new Promise(resolve=>started=resolve),abort=new AbortController();
const cancelled=streamInterview(async function*(signal){providerSignal=signal;yield '{"question":"Started';started();await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));},abort.signal);
const reading=readInterviewResponse(cancelled,()=>{});await ready;abort.abort();await assert.rejects(()=>reading,/did not finish/);assert.equal(providerSignal.aborted,true);
const originalFetch=globalThis.fetch,env={GEMINI_BACKEND:'vertex',GOOGLE_CLOUD_PROJECT:'fixture-project',VERTEX_API_KEY:'fixture-key'};let finish='STOP',fetches=0;
try{
 globalThis.fetch=async(url,init)=>{fetches++;assert.match(String(url),/^https:\/\/aiplatform.googleapis.com\/v1\/projects\/fixture-project\/locations\/global\/publishers\/google\/models\/gemini-test:streamGenerateContent\?alt=sse$/);assert.equal(init.headers['x-goog-api-key'],'fixture-key');assert.equal(JSON.parse(init.body).generationConfig.responseMimeType,'application/json');
  const events=[{candidates:[{content:{parts:[{text:'PRIVATE REASONING',thought:true},{text:'{"question":"How did '}]}}]},{candidates:[{content:{parts:[{text:'that feel?"}'}]},...(finish?{finishReason:finish}:{})}]}];
  return new Response(bytes(events.map(x=>'data: '+JSON.stringify(x)+'\n\n').join(''),7));
 };
 const generate=()=>createProviders(env).interviewStream('Question first','memory','gemini-test',new AbortController().signal);
 assert.equal((await collect(generate())).join(''),'{"question":"How did that feel?"}');
 finish='';await assert.rejects(()=>collect(generate()),/interrupted/);
 finish='MAX_TOKENS';await assert.rejects(()=>collect(generate()),/did not finish/);
 assert.equal(fetches,3,'Provider failures must not silently switch backend or credentials');
 globalThis.fetch=async()=>new Response('',{status:403});await assert.rejects(()=>collect(generate()),/connection needs attention/);
}finally{globalThis.fetch=originalFetch;}
// AI Studio streams the same GenerateContent SSE shape on the public endpoint —
// no credential switch, no call-site change.
try{
 globalThis.fetch=async(url,init)=>{assert.match(String(url),/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-test:streamGenerateContent\?alt=sse$/);assert.equal(init.headers['x-goog-api-key'],'fixture-key');assert.equal(JSON.parse(init.body).generationConfig.responseMimeType,'application/json');
  const events=[{candidates:[{content:{parts:[{text:'{"question":"What did '}]}}]},{candidates:[{content:{parts:[{text:'the garden look like?"}'}]},finishReason:'STOP'}]}];
  return new Response(bytes(events.map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')));
 };
 const generateStudio=()=>createProviders({GEMINI_BACKEND:'ai-studio',GEMINI_API_KEY:'fixture-key'}).interviewStream('Question first','memory','gemini-test',new AbortController().signal);
 assert.equal((await collect(generateStudio())).join(''),'{"question":"What did the garden look like?"}');
 globalThis.fetch=async()=>new Response('',{status:403});await assert.rejects(()=>collect(generateStudio()),/connection needs attention/);
}finally{globalThis.fetch=originalFetch;}
console.log('Passed streaming UTF-8 boundaries, JSON preview escapes, completed-only persistence, invalid/truncated response rejection, cancellation, Vertex routing, AI Studio streaming, thought exclusion and provider failure handling. Providers mocked.');
