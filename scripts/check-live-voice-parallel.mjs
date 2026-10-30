import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export {createLiveVoice} from './lib/live-voice.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {createLiveVoice}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
let microphone=()=>{const mic={stopped:0},track={enabled:true,stop:()=>mic.stopped++};return Object.assign(mic,{getTracks:()=>[track],getAudioTracks:()=>[track]});},getMedia=async()=>microphone(),sockets=[],worklets=[],recorders=[],playbacks=0;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>getMedia()}}});
class Context{state='running';sampleRate=48000;currentTime=0;destination={};audioWorklet={addModule:async()=>{}};async resume(){}async close(){this.state='closed';}createMediaStreamSource(){return {connect(){}};}createGain(){return {gain:{value:1,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}createBuffer(n,length,rate){return {duration:length/rate,getChannelData:()=>new Float32Array(length)};}createBufferSource(){return {connect(){},disconnect(){},start(){playbacks++;},stop(){},onended:null};}}
class Worklet{port={};constructor(){worklets.push(this);}connect(){}disconnect(){}}
class Recorder{static isTypeSupported(){return true;}state='inactive';mimeType='audio/webm';constructor(){recorders.push(this);}start(){this.state='recording';}pause(){this.state='paused';}resume(){this.state='recording';}stop(){this.state='inactive';}}
class Socket{static OPEN=1;readyState=1;bufferedAmount=0;sent=[];constructor(url){this.url=url;sockets.push(this);}send(text){this.sent.push(JSON.parse(text));}close(){this.readyState=3;}async event(data){await this.onmessage({data:JSON.stringify(data)});}}
Object.assign(globalThis,{AudioContext:Context,AudioWorkletNode:Worklet,MediaRecorder:Recorder,WebSocket:Socket});
function fixture(){const events={phases:[],turns:[],errors:[],timings:[],pacings:[]};const session=createLiveVoice({timing:x=>events.timings.push(x),ended:()=>{},phase:x=>events.phases.push(x),caption:()=>{},turn:x=>events.turns.push(x),recording:()=>{},metrics:()=>{},problem:x=>events.errors.push(x),pacing:x=>events.pacings.push(x)});live.push(session);return {events,session};}
const live=[];
const stopAll=async()=>{for(const session of live)await session.stop();await tick();};
const grant=async()=>({token:'fixture',model:'live-test',expiresAt:new Date(Date.now()+600000).toISOString(),maxSeconds:600});
const delayed=(payload,ms)=>({data:{text:()=>{decoded++;return new Promise(resolve=>setTimeout(()=>resolve(JSON.stringify(payload)),ms));}}});
let decoded=0;
try{
 // A live session with an open socket.
 let f=fixture();await f.session.start(grant);let socket=sockets.at(-1);socket.onopen();await socket.event({setupComplete:{}});
 // Back-to-back frames all start decoding on arrival: the slow legacy Blob
 // decode of the first frame must not delay decoding of the frames behind it.
 decoded=0;
 const first=socket.onmessage(delayed({serverContent:{inputTranscription:{text:'one '}}},15));
 const second=socket.onmessage({data:new TextEncoder().encode(JSON.stringify({serverContent:{inputTranscription:{text:'two '}}})).buffer});
 const third=socket.onmessage(delayed({serverContent:{inputTranscription:{text:'three '},turnComplete:true}},5));
 assert.equal(decoded,2,'Blob frames must start decoding on arrival, never behind the previous frame');
 await Promise.all([first,second,third]);await tick();
 // Order is preserved across the parallel decodes: one user turn in server order
 // (emitTurns trims, so the trailing space is gone).
 assert.deepEqual(f.events.turns,[{role:'user',text:'one two three'}]);
 assert.equal(f.events.errors.length,0);

 // A control frame behind a slow content frame applies after it, in server order.
 const beforeTimings=f.events.timings.length;
 const gated=socket.onmessage(delayed({serverContent:{inputTranscription:{text:'more '}}},15));
 const notice=socket.onmessage({data:JSON.stringify({goAway:{timeLeft:'30s'}})});
 await Promise.all([gated,notice]);await tick();
 assert.equal(f.events.timings.length,beforeTimings+1,'The goAway notice must apply exactly once, after the frames before it');
 assert.equal(f.events.timings.at(-1).reason,'provider-ending');
 assert.ok(f.events.timings.at(-1).endsAt<=Date.now()+30500);
 assert.equal(f.events.errors.length,0);
 await f.session.stop();await tick();

 // Narrator pacing is measured from transcription timing: a brisk turn counts
 // when the agent starts replying; a hesitant mid-turn gap neither counts nor
 // resets the accumulated count; two brisk turns reach the server's threshold.
 f=fixture();await f.session.start(grant);socket=sockets.at(-1);socket.onopen();await socket.event({setupComplete:{}});
 await socket.event({serverContent:{inputTranscription:{text:'quick answer.'}}});
 await socket.event({serverContent:{modelTurn:{parts:[{inlineData:{data:'AAAAAA==',mimeType:'audio/pcm;rate=24000'}}]}}});
 assert.equal(f.events.pacings.at(-1),1,'A first brisk turn reports a count of one');
 await socket.event({serverContent:{inputTranscription:{text:'starts '}}});
 await new Promise(resolve=>setTimeout(resolve,900));
 await socket.event({serverContent:{inputTranscription:{text:'after a think.'}}});
 await socket.event({serverContent:{modelTurn:{parts:[{inlineData:{data:'AAAAAA==',mimeType:'audio/pcm;rate=24000'}}]}}});
 assert.equal(f.events.pacings.length,2,'The hesitant turn is still measured when the agent replies');
 assert.equal(f.events.pacings.at(-1),1,'A hesitant turn neither increments nor resets the accumulated count');
 f.session.text('A typed turn instead.');await tick();
 await socket.event({serverContent:{inputTranscription:{text:'brisk again.'}}});
 await socket.event({serverContent:{modelTurn:{parts:[{inlineData:{data:'AAAAAA==',mimeType:'audio/pcm;rate=24000'}}]}}});
 assert.equal(f.events.pacings.at(-1),2,'Two consecutive brisk turns reach the tightening threshold');
 assert.equal(f.events.errors.length,0);
 await stopAll();
 console.log('Passed parallel live-voice frame handling: decodes start on arrival, server order preserved for transcript and control frames, and narrator pacing is measured from transcription timing. Browser/provider mocked.');
}catch(e){console.error(e);process.exitCode=1;await stopAll();}
console.log('check-live-voice-parallel complete.');
