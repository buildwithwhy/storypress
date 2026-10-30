import type {Story} from '../lib/story';
import {languages} from '../lib/story';
import {ServiceError} from '../lib/providers';
import {configured,identity,reserveAi,type Bindings} from './storage';
import {interviewBehavior,interviewContext} from '../lib/interview-behavior';
export const LIVE_SECONDS=600;
// Narrator pacing → end-of-speech window. The patient default protects slow,
// elderly narrators; after two consecutive brisk turns the window tightens
// toward 700 ms. Bounds are fixed at 600–1500 ms and the mapping stays
// server-owned: a client hint can never push past either bound.
export function adaptiveSilenceMs(quickTurns:number){
 const ms=quickTurns>=2?700:1200;
 return Math.min(1500,Math.max(600,ms));
}
export async function liveAccess(request:Request,env:Bindings){
 if(!configured(env)||env.STORYPRESS_LIVE_VOICE!=='gemini'||!env.GEMINI_API_KEY||!env.GEMINI_LIVE_MODEL)return false;
 const user=await identity(request,env);
 return !!user?.id;
}
export async function liveToken(request:Request,env:Bindings,userId:string,story:Story,pacing?:unknown){
 if(!await liveAccess(request,env))throw new ServiceError('Live voice is unavailable. Sign in to try again, or use a voice message or type.',503);
 const model=env.GEMINI_LIVE_MODEL!;
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model))throw new ServiceError('The live voice model needs configuration.',503);
 if(story.sample||story.turns.length>54)throw new ServiceError('Make this keepsake before starting another chapter.',400,'chapter_limit');
 const context=JSON.stringify(interviewContext(story));
 if(context.length>50000)throw new ServiceError('This interview is getting long. Finish this keepsake before starting another.',400,'chapter_limit');
 // An unusable pacing hint degrades to the patient default; it never fails the request.
 const hint=pacing&&typeof pacing==='object'?((pacing as {quickTurns?:unknown}).quickTurns):undefined;
 const silenceMs=adaptiveSilenceMs(typeof hint==='number'&&Number.isInteger(hint)?Math.min(99,Math.max(0,hint)):0);
 // Reserve three existing AI units before provisioning; tokens cannot renew themselves.
 await reserveAi(userId,env,'discover');
 const expiresAt=new Date(Date.now()+LIVE_SECONDS*1000).toISOString();
 const setup={model:`models/${model}`,generationConfig:{responseModalities:['AUDIO'],maxOutputTokens:1024},inputAudioTranscription:{},outputAudioTranscription:{},realtimeInputConfig:{automaticActivityDetection:{endOfSpeechSensitivity:'END_SENSITIVITY_LOW',silenceDurationMs:silenceMs},activityHandling:'START_OF_ACTIVITY_INTERRUPTS'},systemInstruction:{parts:[{text:`You are Once & Ours, a patient oral-history interviewer. Speak ${languages[story.language]} unless the narrator changes language.\n${interviewBehavior}\nKeep spoken replies brief and natural, usually one or two sentences and one question at a time. Output speech only: no beeps, sound effects, music, or imitation notification sounds. Do not recite JSON, technical settings or the transcript. Continue the latest thread in the saved conversation; do not restart the interview. You cannot search the web or generate a keepsake from this live connection. Do not claim to have done either. When the narrator finishes, tell them they can end the session and make their draft, without asking another question. Historical context supplied below is the selected context available when this session began.\n${context}`}]}};
 const unavailable='Live voice could not connect. Your story is kept; try a voice message or typing.';
 let response:Response;
 // An unreachable network (not an HTTP status) is the failure to degrade from:
 // name it in reader copy and keep the narrator's session.
 try{response=await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY!},body:JSON.stringify({uses:1,expireTime:expiresAt,newSessionExpireTime:new Date(Date.now()+60000).toISOString(),bidiGenerateContentSetup:setup}),signal:AbortSignal.timeout(15000)});}
 catch{throw new ServiceError(unavailable,503,'voice_unavailable');}
 if(!response.ok)throw new ServiceError(unavailable,response.status===429?429:503,response.status===429?'voice_busy':'voice_unavailable');
 const data=await response.json() as {name?:string};
 if(!data.name)throw new ServiceError('Live voice did not return a session. Please try again.',502);
 return Response.json({token:data.name,model,expiresAt,maxSeconds:LIVE_SECONDS,provider:'gemini'},{headers:{'Cache-Control':'no-store'}});
}
