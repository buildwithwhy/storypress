import assert from 'node:assert/strict';
import {build} from 'esbuild';
const built=await build({entryPoints:['lib/voice-session.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {createVoiceSession}=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
let getMedia, lastRecorder, lastUtterance, cancelledSpeech=0;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>getMedia()}}});
globalThis.window={speechSynthesis:{cancel(){cancelledSpeech++},resume(){},getVoices:()=>[{lang:'zh-CN',localService:true}],speak(u){lastUtterance=u;u.onstart?.()}}};
globalThis.SpeechSynthesisUtterance=class {constructor(text){this.text=text}};
globalThis.MediaRecorder=class {
 static isTypeSupported(mime){return mime==='audio/mp4'}
 constructor(stream,options){this.stream=stream;this.mimeType=options.mimeType;this.state='inactive';lastRecorder=this}
 start(){this.state='recording'}
 stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['fixture'])});this.onstop?.()})}
};
function fixture(transcribe=async()=> 'A childhood memory.'){
 const events={phases:[],problems:[],transcripts:[],clips:[],calls:0};
 const session=createVoiceSession({phase:x=>events.phases.push(x),elapsed:()=>{},problem:x=>events.problems.push(x),clip:x=>events.clips.push(x),transcript:x=>events.transcripts.push(x),transcribe:async(b,s)=>{events.calls++;return transcribe(b,s)}});
 return {events,session};
}
function microphone(){let stopped=0;return {getTracks:()=>[{stop:()=>stopped++}],get stopped(){return stopped}}}

// A permission request can resolve after the user has cancelled or navigated away.
let grant;const acquired=microphone();getMedia=()=>new Promise(resolve=>grant=resolve);
let f=fixture();const pending=f.session.record();f.session.cancel();grant(acquired);await pending;
assert.equal(acquired.stopped,1);assert.equal(f.events.calls,0);assert.deepEqual(f.events.transcripts,[]);

// Finish turns off the microphone, preserves the playable clip, and transcribes once.
const mic=microphone();getMedia=async()=>mic;f=fixture();await f.session.record();f.session.finish();await tick();
assert.equal(mic.stopped,1);assert.equal(f.events.calls,1);assert.equal(f.events.clips[0].type,'audio/mp4');assert.deepEqual(f.events.transcripts,['A childhood memory.']);f.session.cancel();

// Cancel discards a recording without transmitting it.
getMedia=async()=>microphone();f=fixture();await f.session.record();f.session.cancel();await tick();assert.equal(f.events.calls,0);

// A late transcription cannot populate another mode/story after cancellation.
let respond, signal;getMedia=async()=>microphone();f=fixture((blob,s)=>{signal=s;return new Promise(resolve=>respond=resolve)});
await f.session.record();f.session.finish();await tick();f.session.cancel();assert.equal(signal.aborted,true);respond('Late words');await tick();assert.deepEqual(f.events.transcripts,[]);

// Silence is not added as an answer; denied permissions recover to idle.
f=fixture(async()=> '  ');await f.session.record();f.session.finish();await tick();assert.deepEqual(f.events.transcripts,[]);assert.deepEqual(f.events.problems,['empty']);f.session.cancel();
getMedia=async()=>{throw new DOMException('Denied','NotAllowedError')};f=fixture();await f.session.record();assert.deepEqual(f.events.problems,['microphone']);assert.equal(f.events.phases.at(-1),'idle');

// The speaking turn uses the selected language and cannot change recording state after interruption.
getMedia=async()=>microphone();f=fixture();f.session.speak('那天发生了什么？','zh');assert.equal(lastUtterance.lang,'zh-CN');assert.equal(lastUtterance.voice.lang,'zh-CN');
const oldUtterance=lastUtterance;await f.session.record();oldUtterance.onend();assert.equal(f.events.phases.at(-1),'recording');assert.ok(cancelledSpeech>0);f.session.cancel();
console.log('Passed voice lifecycle checks: late permissions, finish, discard, cancelled transcription, silence, denied microphone, language selection and interrupted speech. Browser audio devices are mocked.');
