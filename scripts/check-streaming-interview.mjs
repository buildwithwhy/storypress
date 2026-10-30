import assert from 'node:assert/strict';
import {build} from 'esbuild';
const client=await build({stdin:{contents:"export {readInterviewResponse} from './lib/interview-client.ts';export {spokenSentencesLength} from './lib/interview-result.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {readInterviewResponse,spokenSentencesLength}=await import('data:text/javascript;base64,'+Buffer.from(client.outputFiles[0].text).toString('base64'));
const voice=await build({stdin:{contents:"export {createVoiceSession} from './lib/voice-session.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {createVoiceSession}=await import('data:text/javascript;base64,'+Buffer.from(voice.outputFiles[0].text).toString('base64'));
// Browser speech mocked: every speak() records the utterance and the moment it started.
const utterances=[];
globalThis.window={speechSynthesis:{cancel(){},resume(){},getVoices:()=>[{lang:'en-US',localService:true},{lang:'zh-CN',localService:true}],speak(u){utterances.push(u);u.onstart?.();}}};
globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
const drain=()=>{for(let i=0;i<utterances.length;i++)utterances[i].onend?.();};
try{
 // Sentence splitting stays sentence-safe: decimals and abbreviations never
 // split, and the helper returns the boundary of the LAST complete sentence —
 // the complete-sentence prefix length the TTS queue can safely speak.
 assert.equal(spokenSentencesLength('Hi there. How are you doing?'),28);
 assert.equal(spokenSentencesLength('Hi there. How are you'),9);
 assert.equal(spokenSentencesLength('Hi there'),0);
 assert.equal(spokenSentencesLength('It cost 3.5 dollars. Then we left.'),34);
 assert.equal(spokenSentencesLength('A question? Yes!'),16);

 // The voice session speaks each queued chunk as one utterance and starts the
 // next as the previous finishes — the caller (the preview wiring below)
 // supplies the sentence boundaries, so queue one sentence at a time.
 const problems=[];const session=createVoiceSession({phase:()=>{},elapsed:()=>{},problem:x=>problems.push(x),clip:()=>{},transcript:()=>{},transcribe:async()=>'A childhood memory.'});
 session.queueSpeak('Hi there.','en');
 session.queueSpeak('How are you doing?','en');
 drain();
 assert.deepEqual(utterances.map(u=>u.text),['Hi there.','How are you doing?']);
 assert.equal(problems.length,0);
 utterances.length=0;

 // A scripted streamed reply: the first sentence's preview event at ~30ms,
 // more question text at ~110ms, the validated completion at ~190ms.
 const script=[{at:30,payload:{type:'preview',question:'Hi there.'}},{at:110,payload:{type:'preview',question:'Hi there. How are you doing?'}},{at:190,payload:{type:'complete',result:{question:'Hi there. How are you doing?',acknowledgement:'Thank you.',readyToWrite:false}}}];
 const sse=events=>{let i=0;const body=new ReadableStream({start(controller){const next=()=>{if(i>=events.length)return controller.close();const step=events[i++];setTimeout(()=>{controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(step.payload)}\n\n`));next();},step.at);};next();}});return new Response(body,{headers:{'Content-Type':'text/event-stream'}});};

 // Exactly the wiring app/storypress.tsx uses: completed preview sentences
 // queue for speech as they arrive; the tail and acknowledgement speak only
 // after the validated result.
 const started=performance.now();let spoken='',firstSentenceAt=0;
 const result=await readInterviewResponse(sse(script),text=>{
  const fresh=text.slice(spoken.length),take=spokenSentencesLength(fresh);
  if(take>0){const sentence=fresh.slice(0,take);spoken+=sentence;if(!firstSentenceAt)firstSentenceAt=performance.now()-started;session.queueSpeak(sentence,'en');}
 });
 const completionAt=performance.now()-started;
 if(result.question.startsWith(spoken))session.queueSpeak([result.question.slice(spoken.length),result.acknowledgement].filter(Boolean).join(' ').trim(),'en');
 drain();
 assert.deepEqual(utterances.map(u=>u.text),['Hi there.',' How are you doing?','Thank you.']);
 assert.ok(firstSentenceAt>0&&firstSentenceAt<100,`The first sentence must be queued from the early preview event, not the completion (got ${firstSentenceAt.toFixed(1)}ms)`);
 assert.ok(completionAt>=180,`The validated completion must wait for the full scripted reply (got ${completionAt.toFixed(1)}ms)`);
 assert.ok(firstSentenceAt<completionAt,'Sentence-level TTS must start before the full reply is validated');
 console.log(`First-sentence TTS at ~${firstSentenceAt.toFixed(0)}ms; validated completion at ~${completionAt.toFixed(0)}ms — legacy whole-text TTS would have started at ~${completionAt.toFixed(0)}ms.`);
 assert.equal(result.question,'Hi there. How are you doing?');
 assert.equal(result.acknowledgement,'Thank you.');
 utterances.length=0;

 // A malformed or interrupted stream persists nothing and speaks nothing new:
 // only a fully validated result is ever returned to the caller.
 const persisted=[];
 const failures=[
  ['an invalid complete result',sse([{at:5,payload:{type:'preview',question:'Hi'}},{at:10,payload:{type:'complete',result:{question:''}}}])],
  ['a complete event without a result',sse([{at:5,payload:{type:'complete'}}])],
  ['a provider error event',sse([{at:5,payload:{type:'error',error:'The story editor hit a provider problem.'}}])],
  ['a stream cut off before completion',sse([{at:5,payload:{type:'preview',question:'Hi'}}])],
 ];
 for(const [label,response] of failures){
  const beforeUtterances=utterances.length;
  await assert.rejects(()=>readInterviewResponse(response,()=>{}),undefined,`${label} must reject`);
  assert.equal(persisted.length,0,`${label}: nothing may persist from a malformed stream`);
  assert.equal(utterances.length,beforeUtterances,`${label}: no speech may start from a malformed stream`);
 }

 // The non-streaming JSON path still validates the full result before returning it.
 const direct=await readInterviewResponse(Response.json({question:'One good question?',readyToWrite:false}),()=>{});
 assert.equal(direct.question,'One good question?');
 await assert.rejects(()=>readInterviewResponse(Response.json({question:''}),()=>{}),undefined,'An unvalidated JSON reply must reject');
 assert.equal(problems.length,0);
 console.log('Passed streaming interview checks: sentence splitting stays sentence-safe, the voice queue speaks each sentence as it arrives, first-sentence TTS beats the validated completion, and malformed or truncated streams persist and speak nothing. Provider and browser speech mocked.');
}catch(e){console.error(e);process.exitCode=1;}
console.log('check-streaming-interview complete.');
