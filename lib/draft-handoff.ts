import {storySchema,type Story} from './story';

export const DRAFT_PREFIX='storypress-draft-v1';
export const GUEST_DRAFT_KEY=DRAFT_PREFIX+':guest';
export const HANDOFF_KEY='storypress-sign-in-handoff-v1';
export const HANDOFF_TTL=24*60*60*1000;
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type DraftSnapshot={story:Story;saved:{id:string;revision:number;share_token?:string|null}|null;stage?:'home'|'tell'|'discover'|'paper';mode?:'type'|'dictate'|'voice'};
type Intent={id:string;email:string;createdAt:number;status:'pending'|'consumed';userId?:string};
export type DraftLoad={key:string;snapshot:DraftSnapshot|null;resumed:boolean;failed:boolean};
export const accountDraftKey=(id:string)=>DRAFT_PREFIX+':'+id;
const activeKey=(id:string)=>DRAFT_PREFIX+':active:'+id;
const normalizeEmail=(email:string)=>email.trim().toLowerCase();
function readIntent(store:Store):Intent|null {
 try{const value=JSON.parse(store.getItem(HANDOFF_KEY)||'null');return value&&typeof value.id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(value.id)&&typeof value.email==='string'&&Number.isFinite(value.createdAt)&&['pending','consumed'].includes(value.status)?value:null;}catch{return null;}
}
export function readDraft(store:Store,key:string):DraftSnapshot|null {
 try{const value=JSON.parse(store.getItem(key)||'null');if(!value)return null;const parsed=storySchema.safeParse(value.story||value);if(!parsed.success)return null;const saved=value.saved&&typeof value.saved.id==='string'&&Number.isInteger(value.saved.revision)?value.saved:null;return {story:parsed.data,saved,stage:['home','tell','discover','paper'].includes(value.stage)?value.stage:undefined,mode:['type','dictate','voice'].includes(value.mode)?value.mode:undefined};}catch{return null;}
}
export function writeDraft(store:Store,key:string,snapshot:DraftSnapshot,userId?:string){
 store.setItem(key,JSON.stringify(snapshot));
 if(userId&&key!==accountDraftKey(userId))store.setItem(activeKey(userId),key);
}
export function writeChangedDraft(store:Store,key:string,snapshot:DraftSnapshot,lastWritten:string|null,userId?:string){
 const serialized=JSON.stringify(snapshot);
 // Auth is broadcast to every tab. A quiet, older tab must not flush its stale
 // copy over the more recent answer in the tab that requested sign-in.
 if(serialized!==lastWritten)writeDraft(store,key,snapshot,userId);
 return serialized;
}
// An email link carries only Supabase's auth token. Personal content stays in this browser.
export function prepareGuestHandoff(store:Store,email:string,snapshot:DraftSnapshot,now=Date.now(),id=crypto.randomUUID()){
 const normalized=normalizeEmail(email);if(!normalized)throw new Error('Email required.');
 writeDraft(store,GUEST_DRAFT_KEY,{...snapshot,saved:null});
 store.setItem(HANDOFF_KEY,JSON.stringify({id,email:normalized,createdAt:now,status:'pending'} satisfies Intent));
 return ()=>{const current=readIntent(store);if(current?.id===id&&current.status==='pending')store.removeItem(HANDOFF_KEY);};
}
function preferredDraft(store:Store,userId:string):DraftLoad{
 const base=accountDraftKey(userId);let key=base;
 try{const active=store.getItem(activeKey(userId));if(active?.startsWith(base+':handoff:')&&readDraft(store,active))key=active;}catch{}
 return {key,snapshot:readDraft(store,key),resumed:false,failed:false};
}
export function resumeGuestHandoff(store:Store,user:{id:string;email?:string},now=Date.now()):DraftLoad{
 const fallback=preferredDraft(store,user.id),intent=readIntent(store);
 if(!intent||normalizeEmail(user.email||'')!==intent.email||now<intent.createdAt||now-intent.createdAt>HANDOFF_TTL)return fallback;
 const key=accountDraftKey(user.id)+':handoff:'+intent.id;
 if(intent.status==='consumed')return intent.userId===user.id&&fallback.key===key?{...fallback,resumed:true}:fallback;
 const guest=readDraft(store,GUEST_DRAFT_KEY);if(!guest)return fallback;
 // A dedicated slot preserves any earlier account draft. Its deterministic name also
 // makes retrying after a crash safe, without replacing edits made in another tab.
 const snapshot=readDraft(store,key)||{...guest,saved:null};
 try{
  writeDraft(store,key,snapshot,user.id);
  store.setItem(HANDOFF_KEY,JSON.stringify({...intent,status:'consumed',userId:user.id}));
  return {key,snapshot,resumed:true,failed:false};
 }catch{return {key,snapshot,resumed:true,failed:true};}
}
export function restoreAccountDraft(store:Store,userId:string){
 const snapshot=readDraft(store,accountDraftKey(userId));if(snapshot)store.removeItem(activeKey(userId));return snapshot;
}
export function clearAccountDraft(store:Store,key:string,userId:string){
 store.removeItem(key);if(store.getItem(activeKey(userId))===key)store.removeItem(activeKey(userId));
}
