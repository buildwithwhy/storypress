import type {Turn} from './story';
export type LivePhase='idle'|'connecting'|'listening'|'speaking';
export type LiveGrant={token:string;model:string;expiresAt:string;maxSeconds:number};
export type LiveMetrics={provider:'gemini';model:string;durationSeconds:number;firstAudioMs:number|null;usage:Record<string,unknown>[]};
type Events={phase:(phase:LivePhase)=>void;caption:(text:string)=>void;turn:(turn:Turn)=>void;problem:(error:Error)=>void;recording:(blob:Blob)=>void;metrics:(metrics:LiveMetrics)=>void};
export function pcm16(samples:Float32Array,rate:number){
 const length=Math.floor(samples.length*16000/rate),out=new Int16Array(length);
 for(let i=0;i<length;i++){const start=Math.floor(i*rate/16000),end=Math.max(start+1,Math.floor((i+1)*rate/16000));let sum=0;for(let j=start;j<end&&j<samples.length;j++)sum+=samples[j];const value=Math.max(-1,Math.min(1,sum/(end-start)));out[i]=value<0?value*32768:value*32767;}
 return out;
}
function encoded(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
export function createLiveVoice(events:Events){
 let generation=0,ws:WebSocket|undefined,stream:MediaStream|undefined,context:AudioContext|undefined,processor:AudioWorkletNode|undefined,recorder:MediaRecorder|undefined;
 let limit:ReturnType<typeof setTimeout>|undefined,connectingTimer:ReturnType<typeof setTimeout>|undefined;
 let playing:AudioBufferSourceNode[]=[],playAt=0,userText='',assistantText='',started=0,firstAudioMs:number|null=null,model='',usage:Record<string,unknown>[]=[],active=false;
 function emitTurns(){if(userText.trim())events.turn({role:'user',text:userText.trim().slice(0,12000)});if(assistantText.trim())events.turn({role:'assistant',text:assistantText.trim().slice(0,12000)});userText='';assistantText='';events.caption('');}
 function silence(){for(const source of playing){try{source.stop();}catch{}}playing=[];playAt=0;}
 async function stop(){
  generation++;clearTimeout(limit);clearTimeout(connectingTimer);emitTurns();silence();
  ws?.close();ws=undefined;processor?.disconnect();processor=undefined;
  if(recorder?.state==='recording')recorder.stop();recorder=undefined;
  stream?.getTracks().forEach(t=>t.stop());stream=undefined;
  const old=context;context=undefined;if(old&&old.state!=='closed')await old.close().catch(()=>{});
  if(active){events.metrics({provider:'gemini',model,durationSeconds:Math.round((performance.now()-started)/1000),firstAudioMs,usage});active=false;}
  events.phase('idle');
 }
 async function start(grant:()=>Promise<LiveGrant>){
  await stop();const id=generation;events.phase('connecting');started=performance.now();firstAudioMs=null;usage=[];
  try{
   if(!navigator.mediaDevices?.getUserMedia||typeof AudioContext==='undefined'||typeof MediaRecorder==='undefined')throw new Error('Live voice is unavailable in this browser. Use a voice message or type.');
   // Resume from the initiating click; acquire permission before spending a session token.
   const audio=new AudioContext();context=audio;await audio.resume();
   const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   if(id!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
   stream=acquired;
   const permission=await grant();if(id!==generation)return;model=permission.model;
   const url=URL.createObjectURL(new Blob([`class Capture extends AudioWorkletProcessor{constructor(){super();this.buffer=[];}process(inputs){const x=inputs[0]?.[0];if(x){this.buffer.push(...x);if(this.buffer.length>=2048){const data=new Float32Array(this.buffer);this.port.postMessage(data,[data.buffer]);this.buffer=[];}}return true;}}registerProcessor('storypress-capture',Capture);`],{type:'text/javascript'}));
   try{await audio.audioWorklet.addModule(url);}finally{URL.revokeObjectURL(url);}
   if(id!==generation)return;
   const socket=new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(permission.token)}`);ws=socket;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m));
   const rec=new MediaRecorder(acquired,{audioBitsPerSecond:48000,...(mime?{mimeType:mime}:{})}),chunks:Blob[]=[];recorder=rec;
   rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.onstop=()=>{const blob=new Blob(chunks,{type:rec.mimeType||mime||'audio/webm'});if(blob.size)events.recording(blob);};
   rec.onerror=()=>{if(id===generation){events.problem(new Error('The recording stopped unexpectedly. Your transcript is kept.'));void stop();}};
   connectingTimer=setTimeout(()=>{if(id===generation){events.problem(new Error('Live voice took too long to connect. Try again, or use a voice message.'));void stop();}},20000);
   socket.onopen=()=>{if(id===generation)socket.send(JSON.stringify({setup:{model:`models/${permission.model}`}}));};
   socket.onmessage=async event=>{
    try{
     const data=JSON.parse(typeof event.data==='string'?event.data:await event.data.text());if(id!==generation)return;
     if(data.error)throw new Error('The live session ended unexpectedly. Your transcript is kept.');
     if(data.setupComplete){
      clearTimeout(connectingTimer);active=true;rec.start(1000);
      processor=new AudioWorkletNode(audio,'storypress-capture');const source=audio.createMediaStreamSource(acquired),mute=audio.createGain();mute.gain.value=0;source.connect(processor);processor.connect(mute);mute.connect(audio.destination);
      processor.port.onmessage=e=>{if(id!==generation||socket.readyState!==WebSocket.OPEN)return;if(socket.bufferedAmount>256000){events.problem(new Error('The connection cannot keep up with live audio. Your words are kept.'));void stop();return;}const pcm=pcm16(e.data,audio.sampleRate);socket.send(JSON.stringify({realtimeInput:{audio:{data:encoded(new Uint8Array(pcm.buffer)),mimeType:'audio/pcm;rate=16000'}}}));};
      events.phase('listening');
      socket.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:'Please begin with one gentle question, or continue the latest thread in our saved conversation.'}]}],turnComplete:true}}));
      limit=setTimeout(()=>{if(id===generation){events.problem(new Error('This live session has finished. You can continue in another session; your story is kept.'));void stop();}},Math.max(0,Math.min(permission.maxSeconds*1000,Date.parse(permission.expiresAt)-Date.now())));
     }
     if(data.usageMetadata&&usage.length<100)usage.push(data.usageMetadata);
     const content=data.serverContent;
     if(content){
      if(content.inputTranscription?.text)userText+=content.inputTranscription.text;
      if(content.outputTranscription?.text)assistantText+=content.outputTranscription.text;
      events.caption(userText||assistantText);
      if(content.interrupted){silence();emitTurns();events.phase('listening');}
      else for(const part of content.modelTurn?.parts||[]){const inline=part.inlineData;if(!inline?.data||!inline.mimeType?.startsWith('audio/pcm'))continue;
       if(firstAudioMs===null)firstAudioMs=Math.round(performance.now()-started);
       const bytes=Uint8Array.from(atob(inline.data),(c:string)=>c.charCodeAt(0)),view=new DataView(bytes.buffer),rate=Number(/rate=(\d+)/.exec(inline.mimeType)?.[1]||24000);
       const buffer=audio.createBuffer(1,Math.floor(bytes.length/2),rate),channel=buffer.getChannelData(0);for(let i=0;i<channel.length;i++)channel[i]=view.getInt16(i*2,true)/32768;
       const source=audio.createBufferSource();source.buffer=buffer;source.connect(audio.destination);playAt=Math.max(audio.currentTime,playAt);source.start(playAt);playAt+=buffer.duration;playing.push(source);events.phase('speaking');source.onended=()=>{playing=playing.filter(s=>s!==source);if(!playing.length&&id===generation)events.phase('listening');};
      }
      if(content.turnComplete)emitTurns();
     }
     if(data.goAway){events.problem(new Error('The voice connection is ending. Your transcript is kept; reconnect to continue.'));void stop();}
    }catch(error){if(id===generation){events.problem(error instanceof Error?error:new Error('Live voice could not continue.'));void stop();}}
   };
   socket.onerror=()=>{if(id===generation){events.problem(new Error('Live voice could not connect. You can still record a message or type.'));void stop();}};
   socket.onclose=()=>{if(id===generation){events.problem(new Error('The voice connection closed. Your transcript is kept.'));void stop();}};
  }catch(error){if(id===generation){events.problem(error instanceof Error?error:new Error('Could not start live voice.'));await stop();}}
 }
 function text(value:string){if(!active||ws?.readyState!==WebSocket.OPEN||!value.trim())return false;silence();emitTurns();events.turn({role:'user',text:value.trim()});ws.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:value.trim()}]}],turnComplete:true}}));return true;}
 return {start,stop,text};
}
