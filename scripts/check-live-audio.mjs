import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['lib/live-audio.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {createPcm16Encoder,createLivePlayback}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
for(const rate of [16000,44100,48000]){
 const samples=Float32Array.from({length:rate*3},(_,i)=>Math.sin(i*.07)*.7);
 const whole=createPcm16Encoder(rate).encode(samples),encoder=createPcm16Encoder(rate),parts=[];
 for(let offset=0;offset<samples.length;offset+=2048)parts.push(...encoder.encode(samples.subarray(offset,offset+2048)));
 assert.equal(whole.length,48000,'Three seconds must remain three seconds across microphone chunks');
 assert.deepEqual(parts,[...whole],'Chunk boundaries must not alter the waveform');
 encoder.encode(new Float32Array([1]));encoder.reset();assert.deepEqual(encoder.encode(new Float32Array(2048)),createPcm16Encoder(rate).encode(new Float32Array(2048)));
}
class Param{value=1;ramps=[];cancelScheduledValues(){}setValueAtTime(value,time){this.value=value;this.ramps.push([value,time]);}linearRampToValueAtTime(value,time){this.ramps.push([value,time]);}}
class Node{disconnected=0;gain=new Param();connect(){}disconnect(){this.disconnected++;}start(time){this.started=time;}stop(time){this.stopped=time;}end(){this.onended?.();}}
const sources=[],gains=[];
const context={currentTime:0,destination:{},createBuffer:(n,length,rate)=>({duration:length/rate,getChannelData:()=>new Float32Array(length)}),createBufferSource(){const node=new Node();sources.push(node);return node;},createGain(){const node=new Node();gains.push(node);return node;}};
let idle=0;const playback=createLivePlayback(context,()=>idle++),second=new Uint8Array(48000);
playback.push(second,24000);playback.push(second,24000);
assert.equal(sources[0].started,.06);assert.equal(sources[1].started,1.06,'Consecutive chunks must remain contiguous');
assert.equal(playback.metrics.maxQueuedMs,2060);context.currentTime=.5;playback.interrupt();
assert.equal(sources[0].stopped,.508,'An interruption gently fades active audio');assert.equal(sources[1].stopped,.5,'Future speech must be cancelled immediately');
playback.push(second,24000);assert.equal(sources[2].started,.56,'New replies must not wait behind interrupted speech');
sources[0].end();sources[1].end();assert.equal(idle,0,'Old nodes must not change the current phase');sources[2].end();assert.equal(idle,1);
assert.ok(sources.every(s=>s.disconnected===1));assert.ok(gains.every(s=>s.disconnected===1));
playback.endTurn();
for(let turn=0;turn<40;turn++){
 context.currentTime+=2;playback.push(second,24000);assert.equal(sources.at(-1).started,context.currentTime+.06);playback.endTurn();sources.at(-1).end();
}
assert.equal(playback.metrics.underruns,0,'Normal pauses between turns are not playback underruns');
context.currentTime+=2;playback.push(second,24000);sources.at(-1).end();context.currentTime+=2;playback.push(second,24000);assert.equal(playback.metrics.underruns,1);
assert.throws(()=>playback.push(new Uint8Array(24000*2*31),24000),/fell behind/);
assert.throws(()=>playback.push(new Uint8Array(3),24000),/unreadable/);
playback.clear(false);assert.ok(sources.every(s=>s.disconnected===1));
console.log('Passed: continuous 16/44.1/48 kHz capture, playback preroll, ordered chunks, interruption fade, queue reset over 40 turns, node disposal, underrun metrics and bounded playback. No provider calls.');
