import type {Story,Turn} from './story';
import {createPcm16Encoder,createLivePlayback,type PlaybackMetrics} from './live-audio';
export type LivePhase='idle'|'connecting'|'listening'|'speaking'|'paused';
export type LiveEndReason='time-limit'|'provider-ending'|'disconnected';
export type LiveTiming={endsAt:number;reason:'time-limit'|'provider-ending'};
export type LiveGrant={token:string;model:string;expiresAt:string;maxSeconds:number};
export type LiveMetrics={provider:'gemini';model:string;durationSeconds:number;firstAudioMs:number|null;usage:Record<string,unknown>[];playback:PlaybackMetrics};
type Events={timing?:(timing:LiveTiming)=>void;ended?:(reason:LiveEndReason)=>void;phase:(phase:LivePhase)=>void;caption:(text:string)=>void;turn:(turn:Turn)=>void;problem:(error:Error)=>void;recording:(blob:Blob)=>void;metrics:(metrics:LiveMetrics)=>void};
export function pcm16(samples:Float32Array,rate:number){return createPcm16Encoder(rate).encode(samples);}
function encoded(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}

// The live-voice seam: the server names the provider on each grant (provider
// field) and the client connects through the matching implementation.
// Gemini Live is the only implementation today; a future provider adds one
// object with the same shape.
export interface LiveVoiceProvider { id: string; socketUrl(grant: LiveGrant): string; }
export const geminiLiveVoice: LiveVoiceProvider = {
  id: 'gemini',
  socketUrl: grant => `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(grant.token)}`,
};

// Connection problems carry a stable code so the UI can speak the reader's
// language; the message text stays as the English fallback.
export type LiveProblemCode='connect_failed'|'connect_timeout'|'network';
export class LiveVoiceProblem extends Error { constructor(message:string,public code:LiveProblemCode){super(message);} }
const liveProblemCopy:Record<Story['language'],Record<LiveProblemCode,string>>={
 en:{connect_failed:'Live voice could not connect. Your words are kept — record a message or type instead.',connect_timeout:'Live voice took too long to connect. Your words are kept — try again, or use a voice message.',network:'The live connection is unavailable. Your words are kept — record a message or type instead.'},
 zh:{connect_failed:'实时对话无法连接。你的原话已保留，可以录音或打字继续。',connect_timeout:'实时对话连接超时。你的原话已保留，请重试，或用录音或打字继续。',network:'实时连接暂时不可用。你的原话已保留，可以录音或打字继续。'},
 es:{connect_failed:'La voz en directo no pudo conectar. Tus palabras se conservan; graba un mensaje o escribe.',connect_timeout:'La voz en directo tardó demasiado en conectar. Tus palabras se conservan; inténtalo de nuevo, o graba un mensaje o escribe.',network:'La conexión en directo no está disponible ahora. Tus palabras se conservan; graba un mensaje o escribe.'}
};
// Renders a live-voice problem for the reader; messages without a connection
// code (server copy, provider limits) pass through unchanged.
export function liveProblemMessage(message:string,code:string|undefined,language:Story['language']):string{
 if(code==='connect_failed'||code==='connect_timeout'||code==='network')return liveProblemCopy[language][code];
 return message;
}
export function createLiveVoice(events:Events,provider:LiveVoiceProvider=geminiLiveVoice){
 let generation=0,ws:WebSocket|undefined,stream:MediaStream|undefined,context:AudioContext|undefined,processor:AudioWorkletNode|undefined,recorder:MediaRecorder|undefined;
 let deadline=0,endReason:LiveTiming['reason']='time-limit';
 let limit:ReturnType<typeof setTimeout>|undefined,connectingTimer:ReturnType<typeof setTimeout>|undefined;
 let playback:ReturnType<typeof createLivePlayback>|undefined,encoder:ReturnType<typeof createPcm16Encoder>|undefined;
 let userText='',assistantText='',started=0,firstAudioMs:number|null=null,model='',usage:Record<string,unknown>[]=[],active=false,paused=false;
 function emitTurns(){if(userText.trim())events.turn({role:'user',text:userText.trim().slice(0,12000)});if(assistantText.trim())events.turn({role:'assistant',text:assistantText.trim().slice(0,12000)});userText='';assistantText='';events.caption('');}
 function silence(){playback?.clear();}
 async function stop(){
  generation++;clearTimeout(limit);clearTimeout(connectingTimer);emitTurns();playback?.clear(false);
  const measurements=playback?.metrics;playback=undefined;encoder=undefined;
  if(active){events.metrics({provider:'gemini',model,durationSeconds:Math.round((performance.now()-started)/1000),firstAudioMs,usage,playback:measurements!});active=false;}
  ws?.close();ws=undefined;processor?.disconnect();processor=undefined;
  if(recorder&&recorder.state!=='inactive')recorder.stop();recorder=undefined;paused=false;
  stream?.getTracks().forEach(t=>t.stop());stream=undefined;
  const old=context;context=undefined;if(old&&old.state!=='closed')await old.close().catch(()=>{});
  events.phase('idle');
 }
 async function start(grant:()=>Promise<LiveGrant>){
  await stop();const id=generation;deadline=0;endReason='time-limit';events.phase('connecting');started=performance.now();firstAudioMs=null;usage=[];
  function scheduleEnd(endsAt:number,reason:LiveTiming['reason']){
   if(deadline&&endsAt>=deadline)return;deadline=endsAt;endReason=reason;clearTimeout(limit);events.timing?.({endsAt,reason});
   limit=setTimeout(()=>{if(id===generation){events.ended?.(endReason);void stop();}},Math.max(0,endsAt-Date.now()));
  }
  try{
   if(!navigator.mediaDevices?.getUserMedia||typeof AudioContext==='undefined'||typeof MediaRecorder==='undefined')throw new Error('Live voice is unavailable in this browser. Use a voice message or type.');
   // Resume from the initiating click; acquire permission before spending a session token.
   const audio=new AudioContext();context=audio;await audio.resume();
   if(id!==generation)return;
   encoder=createPcm16Encoder(audio.sampleRate);
   playback=createLivePlayback(audio,()=>{if(id===generation)events.phase(paused?'paused':'listening');});
   const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   if(id!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
   stream=acquired;
   const permission=await grant();if(id!==generation)return;model=permission.model;
   const url=URL.createObjectURL(new Blob([`class Capture extends AudioWorkletProcessor{constructor(){super();this.buffer=new Float32Array(Math.round(sampleRate*.04));this.offset=0;}process(inputs){const x=inputs[0]?.[0];if(x)for(let i=0;i<x.length;i++){this.buffer[this.offset++]=x[i];if(this.offset===this.buffer.length){this.port.postMessage(this.buffer,[this.buffer.buffer]);this.buffer=new Float32Array(Math.round(sampleRate*.04));this.offset=0;}}return true;}}registerProcessor('storypress-capture',Capture);`],{type:'text/javascript'}));
   try{await audio.audioWorklet.addModule(url);}finally{URL.revokeObjectURL(url);}
   if(id!==generation)return;
   const socket=new WebSocket(provider.socketUrl(permission));ws=socket;socket.binaryType='arraybuffer';
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m));
   const rec=new MediaRecorder(acquired,{audioBitsPerSecond:48000,...(mime?{mimeType:mime}:{})}),chunks:Blob[]=[];recorder=rec;
   rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.onstop=()=>{const blob=new Blob(chunks,{type:rec.mimeType||mime||'audio/webm'});if(blob.size)events.recording(blob);};
   rec.onerror=()=>{if(id===generation){events.problem(new Error('The recording stopped unexpectedly. Your transcript is kept.'));void stop();}};
   connectingTimer=setTimeout(()=>{if(id===generation){events.problem(new LiveVoiceProblem('Live voice took too long to connect. Try again, or use a voice message.','connect_timeout'));void stop();}},20000);
   socket.onopen=()=>{if(id===generation)socket.send(JSON.stringify({setup:{model:`models/${permission.model}`}}));};
   // Frames apply strictly in server order, but decoding never queues behind
   // the previous frame: string and binary frames decode inline on arrival,
   // and a slow legacy Blob decode parks later frames briefly (order still
   // preserved) instead of serializing the whole pipeline behind one await.
   const decoder=new TextDecoder();
   let arrival=0,appliedSeq=0;const parked=new Map<number,string>(),reporters=new Map<number,()=>void>();
   const apply=(raw:string,seq:number,report:()=>void)=>{
    if(seq!==appliedSeq+1){parked.set(seq,raw);reporters.set(seq,report);return;}
    appliedSeq=seq;
    try{
     const data=JSON.parse(raw);if(id!==generation)return;
     if(data.error)throw new Error('The live session ended unexpectedly. Your transcript is kept.');
     if(data.setupComplete&&!active){
      clearTimeout(connectingTimer);active=true;rec.start(1000);
      processor=new AudioWorkletNode(audio,'storypress-capture');const source=audio.createMediaStreamSource(acquired),mute=audio.createGain();mute.gain.value=0;source.connect(processor);processor.connect(mute);mute.connect(audio.destination);
      processor.port.onmessage=e=>{if(id!==generation||paused||socket.readyState!==WebSocket.OPEN)return;if(socket.bufferedAmount>256000){events.problem(new Error('The connection cannot keep up with live audio. Your words are kept.'));void stop();return;}const pcm=encoder!.encode(e.data);if(!pcm.length)return;socket.send(JSON.stringify({realtimeInput:{audio:{data:encoded(new Uint8Array(pcm.buffer)),mimeType:'audio/pcm;rate=16000'}}}));};
      events.phase('listening');
      socket.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:'Please begin with one gentle question, or continue the latest thread in our saved conversation.'}]}],turnComplete:true}}));
      scheduleEnd(Math.min(Date.now()+permission.maxSeconds*1000,Date.parse(permission.expiresAt)),'time-limit');
     }
     if(data.usageMetadata&&usage.length<100)usage.push(data.usageMetadata);
     const content=data.serverContent;
     if(content){
      if(content.inputTranscription?.text)userText+=content.inputTranscription.text;
      if(content.outputTranscription?.text)assistantText+=content.outputTranscription.text;
      events.caption(userText||assistantText);
      if(content.interrupted){playback?.interrupt();emitTurns();events.phase(paused?'paused':'listening');}
      else for(const part of content.modelTurn?.parts||[]){const inline=part.inlineData;if(!inline?.data||!inline.mimeType?.startsWith('audio/pcm'))continue;
       if(paused)continue;
       if(firstAudioMs===null)firstAudioMs=Math.round(performance.now()-started);
       const bytes=Uint8Array.from(atob(inline.data),(c:string)=>c.charCodeAt(0)),rate=Number(/rate=(\d+)/.exec(inline.mimeType)?.[1]||24000);
       playback!.push(bytes,rate);events.phase('speaking');
      }
      if(content.turnComplete){playback?.endTurn();emitTurns();}
     }
     if(data.goAway){
      const seconds=typeof data.goAway.timeLeft==='string'&&/^\d+(?:\.\d+)?s$/.test(data.goAway.timeLeft)?parseFloat(data.goAway.timeLeft):0;
      if(seconds>0)scheduleEnd(Date.now()+seconds*1000,'provider-ending');
      else{events.ended?.('provider-ending');void stop();}
     }
    }catch(error){if(id===generation){events.problem(error instanceof Error?error:new Error('Live voice could not continue.'));void stop();}}
    finally{report();}
    // Frames decoded while an earlier frame was still applying go now, in order.
    const nextRaw=parked.get(appliedSeq+1);
    if(nextRaw!==undefined){parked.delete(appliedSeq+1);const nextReport=reporters.get(appliedSeq+1);reporters.delete(appliedSeq+1);if(nextReport)apply(nextRaw,appliedSeq+1,nextReport);}
   };
   socket.onmessage=(event:MessageEvent)=>{
    if(id!==generation)return Promise.resolve();
    const seq=++arrival;let report!:()=>void;const applied=new Promise<void>(resolve=>report=resolve);
    if(typeof event.data==='string')apply(event.data,seq,report);
    else if(event.data instanceof ArrayBuffer)apply(decoder.decode(event.data),seq,report);
    else void event.data.text().then((raw:string)=>{if(id===generation)apply(raw,seq,report);else report();}).catch((error:unknown)=>{report();if(id===generation){events.problem(error instanceof Error?error:new Error('Live voice could not continue.'));void stop();}});
    return applied;
   };
   socket.onerror=()=>{if(id===generation){if(active)events.ended?.('disconnected');else events.problem(new LiveVoiceProblem('Live voice could not connect. You can still record a message or type.','connect_failed'));void stop();}};
   socket.onclose=()=>{if(id===generation){if(active)events.ended?.(endReason==='provider-ending'||deadline&&Date.now()>=deadline-1000?endReason:'disconnected');else events.problem(new LiveVoiceProblem('Live voice could not connect. Please try again.','connect_failed'));void stop();}};
  }catch(error){if(id===generation){events.problem(error instanceof TypeError?new LiveVoiceProblem('Live voice could not connect. You can still record a message or type.','network'):error instanceof Error?error:new Error('Could not start live voice.'));await stop();}}
 }
 function text(value:string){if(!active||ws?.readyState!==WebSocket.OPEN||!value.trim())return false;silence();emitTurns();events.turn({role:'user',text:value.trim()});ws.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:value.trim()}]}],turnComplete:true}}));return true;}
 function pause(){if(!active||paused||ws?.readyState!==WebSocket.OPEN)return;paused=true;silence();encoder?.reset();stream?.getAudioTracks().forEach(track=>{track.enabled=false;});if(recorder?.state==='recording')recorder.pause();ws.send(JSON.stringify({realtimeInput:{audioStreamEnd:true}}));events.phase('paused');}
 function resume(){if(!active||!paused)return;paused=false;stream?.getAudioTracks().forEach(track=>{track.enabled=true;});if(recorder?.state==='paused')recorder.resume();events.phase('listening');}
 return {start,stop,text,pause,resume};
}
