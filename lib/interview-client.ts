import {flowCopy} from './flow-copy';

import {eventData} from './event-stream';
import {interviewResult,type InterviewResult} from './interview-result';
export async function readInterviewResponse(response:Response,onPreview:(text:string)=>void):Promise<InterviewResult>{
 if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'The interview could not continue. Your words are kept.');}
 if(!response.headers.get('Content-Type')?.includes('text/event-stream'))return interviewResult.parse(await response.json());
 if(!response.body)throw new Error('The interview connection closed. Your words are kept.');
 for await(const raw of eventData(response.body)){
  const event=JSON.parse(raw);
  if(event.type==='preview'&&typeof event.question==='string')onPreview(event.question.slice(0,600));
  if(event.type==='error')throw new Error(typeof event.error==='string'?event.error:'The reply did not finish. Your words are kept.');
  if(event.type==='complete')return interviewResult.parse(event.result);
 }
 throw new Error('The reply was interrupted. Your words are kept; try again.');
}

// A fetch-level failure (offline, DNS, connection reset) surfaces as a
// TypeError; server error responses and cancellations pass through untouched.
export function networkFailure(error: unknown): boolean { return error instanceof TypeError; }

// Maps a thrown interview error to reader copy: network failures have no
// server text, so the story's language carries the reassurance; everything
// else arrives with its own reader message.
export function interviewProblemText(error: unknown, language: keyof typeof flowCopy): string {
 return networkFailure(error) ? flowCopy[language].offline : (error as Error).message;
}