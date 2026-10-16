import type {Story} from '../lib/story';
import {languages} from '../lib/story';
import {ServiceError} from '../lib/providers';
import {configured,identity,reserveAi,type Bindings} from './storage';
import {interviewBehavior,interviewContext} from '../lib/interview-behavior';
export const LIVE_SECONDS=600;
export async function liveAccess(request:Request,env:Bindings){
 if(!configured(env)||env.STORYPRESS_LIVE_VOICE!=='gemini'||!env.GEMINI_API_KEY||!env.GEMINI_LIVE_MODEL)return false;
 const user=await identity(request,env);
 return !!user?.id;
}
export async function liveToken(request:Request,env:Bindings,userId:string,story:Story){
 if(!await liveAccess(request,env))throw new ServiceError('Live voice is unavailable. Sign in to try again, or use a voice message or type.',503);
 const model=env.GEMINI_LIVE_MODEL!;
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model))throw new ServiceError('The live voice model needs configuration.',503);
 if(story.sample||story.turns.length>54)throw new ServiceError('Save this story before starting another live session.',400);
 const context=JSON.stringify(interviewContext(story));
 if(context.length>50000)throw new ServiceError('This interview is getting long. Finish this keepsake before starting another.',400);
 // Reserve three existing AI units before provisioning; tokens cannot renew themselves.
 await reserveAi(userId,env,'discover');
 const expiresAt=new Date(Date.now()+LIVE_SECONDS*1000).toISOString();
 const setup={model:`models/${model}`,generationConfig:{responseModalities:['AUDIO'],maxOutputTokens:1024},inputAudioTranscription:{},outputAudioTranscription:{},realtimeInputConfig:{automaticActivityDetection:{endOfSpeechSensitivity:'END_SENSITIVITY_LOW',silenceDurationMs:1200},activityHandling:'START_OF_ACTIVITY_INTERRUPTS'},systemInstruction:{parts:[{text:`You are Storypress, a patient oral-history interviewer. Speak ${languages[story.language]} unless the narrator changes language.\n${interviewBehavior}\nKeep spoken replies brief and natural, usually one or two sentences and one question at a time. Output speech only: no beeps, sound effects, music, or imitation notification sounds. Do not recite JSON, technical settings or the transcript. Continue the latest thread in the saved conversation; do not restart the interview. You cannot search the web or generate a keepsake from this live connection. Do not claim to have done either. When the narrator finishes, tell them they can end the session and make their draft, without asking another question. Historical context supplied below is the selected context available when this session began.\n${context}`}]}};
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY!},body:JSON.stringify({uses:1,expireTime:expiresAt,newSessionExpireTime:new Date(Date.now()+60000).toISOString(),bidiGenerateContentSetup:setup}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new ServiceError('Live voice could not connect. Your story is kept; try a voice message or typing.',response.status===429?429:503);
 const data=await response.json() as {name?:string};
 if(!data.name)throw new ServiceError('Live voice did not return a session. Please try again.',502);
 return Response.json({token:data.name,model,expiresAt,maxSeconds:LIVE_SECONDS},{headers:{'Cache-Control':'no-store'}});
}
