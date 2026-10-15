import {ServiceError} from '../lib/providers';
import {interviewResult,questionPreview} from '../lib/interview-result';

export function streamInterview(generate:(signal:AbortSignal)=>AsyncIterable<string>,signal:AbortSignal){
 const abort=new AbortController(),encoder=new TextEncoder();let cancelled=false;
 const cancel=()=>abort.abort();signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
 const body=new ReadableStream<Uint8Array>({
  async start(controller){
   const emit=(event:unknown)=>{if(!cancelled)controller.enqueue(encoder.encode('data: '+JSON.stringify(event)+'\n\n'));};
   try{
    let raw='',shown='';for await(const delta of generate(abort.signal)){
     if(abort.signal.aborted)throw new Error('Cancelled');raw+=delta;
     if(raw.length>24000)throw new ServiceError('The reply was too long. Your words are kept.',502);
     const preview=questionPreview(raw);if(preview&&preview!==shown){shown=preview;emit({type:'preview',question:preview});}
    }
    if(abort.signal.aborted)throw new Error('Cancelled');
    const result=interviewResult.parse(JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')));
    emit({type:'complete',result});
   }catch(error){if(!cancelled)emit({type:'error',error:error instanceof ServiceError?error.message:'The reply did not finish. Your words are kept; try again.'});}
   finally{signal.removeEventListener('abort',cancel);if(!cancelled)controller.close();}
  },cancel(){cancelled=true;abort.abort();},
 });
 return new Response(body,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'}});
}
