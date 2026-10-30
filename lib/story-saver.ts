import {type Story} from './story';
export type SavedStory={id:string;revision:number;share_token?:string|null};
export type SaveStatus='idle'|'waiting'|'saving'|'saved'|'error';
// code carries typed API refusals (e.g. story_limit) so callers can localize them.
export function hasStoryContent(story:Story){return !story.sample&&!!(story.draft?.trim()||story.photo||story.paper||story.turns.some(turn=>turn.role==='user'&&turn.text.trim()));}
export function createStorySaver(options:{save:(story:Story,saved:SavedStory|null,derivative?:boolean)=>Promise<SavedStory>;changeSharing:(action:'share'|'private',saved:SavedStory)=>Promise<SavedStory>;remove:(id:string)=>Promise<void>;onSaved:(saved:SavedStory|null)=>void;onStatus:(status:SaveStatus,error?:string,code?:string)=>void}){
 let current:Story|null=null,identity:SavedStory|null=null,clean:string|null=null,tail:Promise<unknown>=Promise.resolve(),closed=false;
 function status(value:SaveStatus,error?:string,code?:string){if(!closed)options.onStatus(value,error,code);}
 function replace(story:Story,saved:SavedStory|null,alreadySaved=false){current=story;identity=saved;clean=alreadySaved?JSON.stringify(story):null;options.onSaved(identity);status(hasStoryContent(story)?alreadySaved?'saved':'waiting':'idle');}
 function update(story:Story){current=story;if(hasStoryContent(story)&&JSON.stringify(story)!==clean)status('waiting');}
 async function drain(){
  while(!closed&&current&&hasStoryContent(current)){
   const serialized=JSON.stringify(current);if(serialized===clean)break;
   status('saving');const saved=await options.save(JSON.parse(serialized),identity);
   identity=saved;clean=serialized;if(!closed)options.onSaved(identity);
  }
  if(!closed)status(current&&hasStoryContent(current)?'saved':'idle');return identity;
 }
 function enqueue<T>(job:()=>Promise<T>):Promise<T>{const result=tail.then(async()=>{if(closed)throw new Error('This story is no longer open.');try{return await job();}catch(error){const typed=error as Error & {code?:string};status('error',typed.message,typed.code);throw error;}});tail=result.catch(()=>{});return result;}
 return {
  update,replace,
  flush:()=>enqueue(drain),
  saveAsNew:()=>enqueue(async()=>{
   if(!current||!hasStoryContent(current))throw new Error('Tell a little of your story before saving a copy.');
   const serialized=JSON.stringify(current);status('saving');
   // Preserve both versions when a stale revision cannot update the original.
   // Adopt the new identity only after creation succeeds; later edits drain there.
   // derivative:true — a copy of a story the user already owns never consumes
   // the free-story meter (the server skips the reserve for derivative saves).
   const saved=await options.save(JSON.parse(serialized),null,true);
   identity=saved;clean=serialized;if(!closed)options.onSaved(identity);
   return drain();
  }),
  saveCopy:(story:Story)=>enqueue(async()=>{
   await drain();status('saving');
   // derivative:true — translated keepsakes and copies insert freely (paywall §2).
   const next=await options.save(story,null,true);
   // A failed create leaves the original identity and draft active.
   replace(story,next,true);return next;
  }),
  switchTo:(story:Story,saved:SavedStory|null,alreadySaved=false)=>enqueue(async()=>{await drain();replace(story,saved,alreadySaved);}),
  changeSharing:(action:'share'|'private')=>enqueue(async()=>{const saved=await drain();if(!saved)throw new Error('Tell a little of your story before sharing.');const next=await options.changeSharing(action,saved);identity=next;if(!closed)options.onSaved(next);return next;}),
  remove:(id:string)=>enqueue(async()=>{await drain();await options.remove(id);const wasCurrent=identity?.id===id;if(wasCurrent){current=null;identity=null;clean=null;if(!closed)options.onSaved(null);status('idle');}return wasCurrent;}),
  dispose:()=>{closed=true;},
 };
}
