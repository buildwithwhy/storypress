// Keep partial samples between microphone chunks: resetting at every chunk loses
// samples at 44.1/48 kHz and puts small discontinuities into the input stream.
export function createPcm16Encoder(rate:number){
 if(!Number.isFinite(rate)||rate<=0)throw new Error('Invalid microphone sample rate.');
 const width=rate/16000;let sum=0,weight=0;
 return {
  reset(){sum=0;weight=0;},
  encode(samples:Float32Array){
   const output:number[]=[];
   for(const sample of samples){
    let remaining=1;
    while(remaining>1e-9){
     const take=Math.min(remaining,width-weight);sum+=sample*take;weight+=take;remaining-=take;
     if(weight>=width-1e-9){const value=Math.max(-1,Math.min(1,sum/width));output.push(value<0?value*32768:value*32767);sum=0;weight=0;}
    }
   }
   return new Int16Array(output);
  }
 };
}

export type PlaybackMetrics={maxQueuedMs:number;underruns:number;interruptions:number;receivedAudioMs:number};
const PREROLL=.06,FADE=.008,MAX_QUEUE=30;
export function createLivePlayback(audio:AudioContext,onIdle:()=>void){
 type Playing={source:AudioBufferSourceNode;gain:GainNode;epoch:number;start:number};
 const nodes=new Set<Playing>();let playAt=0,epoch=0,turnOpen=false;
 const metrics:PlaybackMetrics={maxQueuedMs:0,underruns:0,interruptions:0,receivedAudioMs:0};
 function clear(fade=true){
  epoch++;playAt=0;turnOpen=false;
  for(const item of nodes){
   // Let the final few samples fade rather than cutting a non-zero waveform.
   const end=audio.currentTime+(fade&&item.start<=audio.currentTime?FADE:0);
   item.gain.gain.cancelScheduledValues(audio.currentTime);
   item.gain.gain.setValueAtTime(item.gain.gain.value,audio.currentTime);
   item.gain.gain.linearRampToValueAtTime(0,end);
   try{item.source.stop(end);}catch{}
   if(!fade){item.source.onended=null;item.source.disconnect();item.gain.disconnect();}
  }
  nodes.clear();
 }
 return {
  metrics,
  clear,
  interrupt(){metrics.interruptions++;clear();},
  endTurn(){turnOpen=false;},
  push(bytes:Uint8Array,rate:number){
   if(!bytes.length||bytes.length%2||!Number.isFinite(rate)||rate<8000||rate>96000)throw new Error('The voice service returned unreadable audio. Your transcript is kept.');
   const duration=bytes.length/2/rate,now=audio.currentTime;
   const newRun=playAt<=now;
   if(newRun&&turnOpen&&playAt>0)metrics.underruns++;
   const start=newRun?now+PREROLL:playAt;
   // Stop with the transcript intact instead of allowing an ever-growing delay.
   if(start+duration-now>MAX_QUEUE)throw new Error('Voice playback fell behind. End this session and reconnect to continue; your transcript is kept.');
   const buffer=audio.createBuffer(1,bytes.length/2,rate),channel=buffer.getChannelData(0),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
   for(let i=0;i<channel.length;i++)channel[i]=view.getInt16(i*2,true)/32768;
   const source=audio.createBufferSource(),gain=audio.createGain(),item={source,gain,epoch,start};
   source.buffer=buffer;source.connect(gain);gain.connect(audio.destination);
   if(newRun){gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(1,start+Math.min(FADE,duration));}
   source.onended=()=>{source.disconnect();gain.disconnect();nodes.delete(item);if(item.epoch===epoch&&!nodes.size)onIdle();};
   nodes.add(item);source.start(start);playAt=start+duration;turnOpen=true;
   metrics.maxQueuedMs=Math.max(metrics.maxQueuedMs,Math.round((playAt-now)*1000));metrics.receivedAudioMs+=duration*1000;
  }
 };
}
