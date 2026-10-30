import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';

// Provider-seam guard: call sites resolve through the typed interfaces, the
// connection URL lives in the provider implementation, config selects the
// implementation, and network failures degrade to in-language reader copy.
// Draft preservation itself is covered by check-draft-handoff.mjs.

// Part 1 — seam shape in source.
const sources={
 providers:readFileSync('lib/providers.ts','utf8'),
 liveVoice:readFileSync('lib/live-voice.ts','utf8'),
 api:readFileSync('server/api.ts','utf8'),
 live:readFileSync('server/live.ts','utf8'),
 storypress:readFileSync('app/storypress.tsx','utf8'),
};
assert.match(sources.providers,/export interface TextProvider/,'lib/providers.ts must export the TextProvider interface');
assert.match(sources.providers,/export interface ResearchResult/,'research results must be typed at the seam');
assert.match(sources.providers,/export function createProviders\(env: Record<string, string \| undefined>, language: Language = "en"\): TextProvider/,'the factory must return the interface, routed by language');
assert.match(sources.api,/const providers: TextProvider = createProviders/,'server/api.ts must consume the named interface');
assert.match(sources.liveVoice,/export interface LiveVoiceProvider/,'live-voice must export the provider interface');
assert.match(sources.liveVoice,/export const geminiLiveVoice: LiveVoiceProvider/,'gemini must be a typed implementation');
const withoutGeminiImpl=sources.liveVoice.replace(/export const geminiLiveVoice[\s\S]*?\n};/,'');
assert.ok(!withoutGeminiImpl.includes('generativelanguage.googleapis.com'),'websocket URLs live in the provider implementation, not the session logic');
assert.match(sources.live,/provider:'gemini'/,'the live grant must name its provider');
assert.match(sources.storypress,/interviewProblemText\(problem, latest.current.story.language\)/,'interview surfaces must map failures through the shared pure function');
assert.match(sources.storypress,/turns: \[\.\.\.current\.turns, \{ role: "user", text: value\.trim\(\) \}\]/,'the narrator\'s words join the story before the network call, so a failed send cannot lose them');
assert.match(sources.storypress,/setError\(problemText\(e\)\)/,'failure paths must surface the mapped message');

// Part 2 — runtime seam behavior on the real modules.
const bundle=await build({stdin:{contents:"export {createProviders} from './lib/providers.ts';export {geminiLiveVoice,createLiveVoice,LiveVoiceProblem,liveProblemMessage} from './lib/live-voice.ts';export {networkFailure,interviewProblemText} from './lib/interview-client.ts';export {flowCopy} from './lib/flow-copy.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {createProviders,geminiLiveVoice,createLiveVoice,LiveVoiceProblem,liveProblemMessage,networkFailure,interviewProblemText,flowCopy}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const providers=createProviders({GEMINI_BACKEND:'vertex',GOOGLE_CLOUD_PROJECT:'fixture',VERTEX_API_KEY:'k'});
for(const member of ['setting','backend','modelConfigured','modelFor','gemini','nimble','parseJson','interviewStream'])assert.equal(typeof providers[member],'function',`TextProvider.${member} must exist`);
assert.equal(providers.backend(),'vertex','config must select behavior through the interface');

assert.equal(geminiLiveVoice.id,'gemini');
assert.equal(geminiLiveVoice.socketUrl({token:'fixture token'}),'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=fixture%20token','the gemini implementation owns the exact connection URL');

// A foreign provider is used as-is: the session connects to its URL.
let microphone=()=>{const mic={stopped:0},track={enabled:true,stop:()=>mic.stopped++};return Object.assign(mic,{getTracks:()=>[track],getAudioTracks:()=>[track]});};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>microphone()}}});
class Context{state='running';sampleRate=48000;currentTime=0;destination={};audioWorklet={addModule:async()=>{}};async resume(){}async close(){this.state='closed';}createMediaStreamSource(){return {connect(){}};}createGain(){return {gain:{value:1,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}createBuffer(n,length,rate){return {duration:length/rate,getChannelData:()=>new Float32Array(length)};}createBufferSource(){return {connect(){},disconnect(){},start(){},stop(){},onended:null};}}
class Worklet{port={};connect(){}disconnect(){}}
class Recorder{static isTypeSupported(){return true;}state='inactive';mimeType='audio/webm';start(){}pause(){}resume(){}stop(){}}
const sockets=[];
class Socket{static OPEN=1;readyState=1;constructor(url){this.url=url;sockets.push(this);}send(){}close(){this.readyState=3;}}
Object.assign(globalThis,{AudioContext:Context,AudioWorkletNode:Worklet,MediaRecorder:Recorder,WebSocket:Socket});
const fixture=provider=>{const events={errors:[]};const session=createLiveVoice({phase:()=>{},caption:()=>{},turn:()=>{},recording:()=>{},metrics:()=>{},timing:()=>{},ended:()=>{},problem:error=>events.errors.push(error)},provider);return {events,session};};
const grant=async()=>({token:'fixture token',model:'live-test',expiresAt:new Date(Date.now()+600000).toISOString(),maxSeconds:600});

const custom=fixture({id:'fixture',socketUrl:g=>`wss://fixture.example/ws?token=${g.token}`});
await custom.session.start(grant);
assert.equal(sockets.at(-1).url,'wss://fixture.example/ws?token=fixture token','the session must connect through the injected provider');
await custom.session.stop();await tick();

// An unreachable network at grant time degrades with a stable code.
const offline=fixture();
await offline.session.start(async()=>{throw new TypeError('Failed to fetch');});await tick();
assert.equal(offline.events.errors.at(-1)?.code,'network','a fetch-level TypeError must surface the network code');

// A silent socket fails the connecting timer with the timeout code.
const realSetTimeout=globalThis.setTimeout,realClearTimeout=globalThis.clearTimeout;
const realTick=()=>new Promise(resolve=>realSetTimeout(resolve,0));
const timers=new Map();let timerId=0;
globalThis.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};
globalThis.clearTimeout=id=>timers.delete(id);
try{
 const slow=fixture();
 await slow.session.start(grant);await realTick();
 for(const {fn,ms} of timers.values())if(ms===20000)fn();
 await realTick();
 assert.equal(slow.events.errors.at(-1)?.code,'connect_timeout','the 20s connecting timer must surface the timeout code');
 await slow.session.stop();
}finally{globalThis.setTimeout=realSetTimeout;globalThis.clearTimeout=realClearTimeout;}

// An early socket error carries the connect-failed code.
const refused=fixture();
await refused.session.start(grant);await tick();
sockets.at(-1).onerror?.();await tick();
assert.equal(refused.events.errors.at(-1)?.code,'connect_failed','an early socket error must surface the connect-failed code');
await refused.session.stop();await tick();

// Part 3 — failure mapping: in-language copy, honest pass-through.
assert.equal(networkFailure(new TypeError('Failed to fetch')),true);
assert.equal(networkFailure(new Error('server copy')),false,'server error responses are not network failures');
assert.equal(networkFailure(new DOMException('Cancelled','AbortError')),false,'cancellations are not network failures');
for(const language of ['en','zh','es']){
 assert.equal(interviewProblemText(new TypeError('Failed to fetch'),language),flowCopy[language].offline,'a network failure must map to the in-language interview copy');
 assert.equal(interviewProblemText(new Error('The interview could not continue. Your words are kept.'),language),'The interview could not continue. Your words are kept.','server reader copy passes through untouched');
}
assert.equal(liveProblemMessage('ignored','connect_failed','en'),'Live voice could not connect. Your words are kept — record a message or type instead.');
assert.equal(liveProblemMessage('ignored','connect_failed','zh'),'实时对话无法连接。你的原话已保留，可以录音或打字继续。');
assert.equal(liveProblemMessage('ignored','connect_failed','es'),'La voz en directo no pudo conectar. Tus palabras se conservan; graba un mensaje o escribe.');
assert.equal(liveProblemMessage('ignored','connect_timeout','en'),'Live voice took too long to connect. Your words are kept — try again, or use a voice message.');
assert.equal(liveProblemMessage('ignored','connect_timeout','zh'),'实时对话连接超时。你的原话已保留，请重试，或用录音或打字继续。');
assert.equal(liveProblemMessage('ignored','connect_timeout','es'),'La voz en directo tardó demasiado en conectar. Tus palabras se conservan; inténtalo de nuevo, o graba un mensaje o escribe.');
assert.equal(liveProblemMessage('ignored','network','en'),'The live connection is unavailable. Your words are kept — record a message or type instead.');
assert.equal(liveProblemMessage('ignored','network','zh'),'实时连接暂时不可用。你的原话已保留，可以录音或打字继续。');
assert.equal(liveProblemMessage('ignored','network','es'),'La conexión en directo no está disponible ahora. Tus palabras se conservan; graba un mensaje o escribe.');
assert.equal(liveProblemMessage('Provider quota exceeded.','daily_allowance','en'),'Provider quota exceeded.','server copy without a connection code passes through');
assert.equal(liveProblemMessage('Something specific.',undefined,'zh'),'Something specific.','missing codes pass through');
assert.ok(new LiveVoiceProblem('test','network') instanceof Error,'LiveVoiceProblem stays an Error for existing handlers');
console.log('check-provider-seam: PASS');
