import {storySchema,type Story} from './story';

export const DRAFT_PREFIX='storypress-draft-v1';
export const GUEST_DRAFT_KEY=DRAFT_PREFIX+':guest';
export const HANDOFF_KEY='storypress-sign-in-handoff-v1';
export const GOOGLE_HANDOFF_KEY='storypress-google-handoff-v1';
export const GOOGLE_HANDOFF_TTL=15*60*1000;
export const HANDOFF_TTL=24*60*60*1000;
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
// Ownership is additive metadata on the snapshot payload — never a storage-key
// migration: readDraft tolerates its absence so legacy drafts keep loading.
export type DraftOwner={userId:string;email?:string;at:number};
export type DraftSnapshot={story:Story;saved:{id:string;revision:number;share_token?:string|null}|null;stage?:'home'|'tell'|'discover'|'paper';mode?:'type'|'dictate'|'voice';owner?:DraftOwner;imported?:true;savedAt?:number};
type Intent={id:string;email:string;provider?:'google';createdAt:number;status:'pending'|'consumed';userId?:string};
export type DraftOffer={intentId:string;key:string;snapshot:DraftSnapshot};
export type DraftLoad={key:string;snapshot:DraftSnapshot|null;resumed:boolean;failed:boolean;offer?:DraftOffer};
export const accountDraftKey=(id:string)=>DRAFT_PREFIX+':'+id;
const activeKey=(id:string)=>DRAFT_PREFIX+':active:'+id;
const normalizeEmail=(email:string)=>email.trim().toLowerCase();
function readIntent(store:Store):Intent|null {
 try{const value=JSON.parse(store.getItem(HANDOFF_KEY)||'null');return value&&typeof value.id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(value.id)&&typeof value.email==='string'&&Number.isFinite(value.createdAt)&&['pending','consumed'].includes(value.status)?value:null;}catch{return null;}
}
export function readDraft(store:Store,key:string):DraftSnapshot|null {
 try{const value=JSON.parse(store.getItem(key)||'null');if(!value)return null;const parsed=storySchema.safeParse(value.story||value);if(!parsed.success)return null;const saved=value.saved&&typeof value.saved.id==='string'&&Number.isInteger(value.saved.revision)?value.saved:null;
  const snapshot:DraftSnapshot={story:parsed.data,saved,stage:['home','tell','discover','paper'].includes(value.stage)?value.stage:undefined,mode:['type','dictate','voice'].includes(value.mode)?value.mode:undefined};
  if(value.owner&&typeof value.owner.userId==='string'){const owner:DraftOwner={userId:value.owner.userId,at:Number.isFinite(value.owner.at)?value.owner.at:0};if(typeof value.owner.email==='string')owner.email=value.owner.email;snapshot.owner=owner;}
  if(Number.isFinite(value.savedAt))snapshot.savedAt=value.savedAt;
  if(value.imported===true)snapshot.imported=true;
  return snapshot;
 }catch{return null;}
}
// The signed-out landing shows only anonymous drafts. An owned draft is
// invisible there — to everyone but its owner — not merely un-imported.
export function readOwnerlessDraft(store:Store,key:string):DraftSnapshot|null{
 const snapshot=readDraft(store,key);return snapshot?.owner?null:snapshot;
}
// The explicit device-draft import in My stories (account modal and the
// /stories page, device-draft privacy art_ZdXAkIsg): the guest key's draft is
// offered only when it exists and is not stamped with another account's id —
// a stranger's words stay invisible, never merely un-imported. The legacy
// pre-snapshot format (a bare story under DRAFT_PREFIX) still reads.
export function readImportableDraft(store:Store,userId?:string):DraftSnapshot|null{
 let device:DraftSnapshot|null=readDraft(store,GUEST_DRAFT_KEY);
 if(!device){
  const raw=store.getItem(DRAFT_PREFIX);
  if(raw){try{const parsed=JSON.parse(raw) as DraftSnapshot|{story:unknown};device={story:storySchema.parse('story' in parsed?parsed.story:parsed),saved:null};}catch{return null;}}
 }
 if(!device||(device.owner&&device.owner.userId!==userId))return null;
 return device;
}
export function writeDraft(store:Store,key:string,snapshot:DraftSnapshot,userId?:string,now=Date.now()){
 let stamped:DraftSnapshot=snapshot;
 // Account keys (and their handoff slots) always carry their owner; the guest
 // key stays anonymous — a signed-out author is anonymous by definition.
 if(userId&&(key===accountDraftKey(userId)||key.startsWith(accountDraftKey(userId)+':')))stamped={...snapshot,owner:{userId,at:now}};
 store.setItem(key,JSON.stringify({...stamped,savedAt:now}));
 if(userId&&key!==accountDraftKey(userId))store.setItem(activeKey(userId),key);
}
export function writeChangedDraft(store:Store,key:string,snapshot:DraftSnapshot,lastWritten:string|null,userId?:string,now=Date.now()){
 const serialized=JSON.stringify(snapshot);
 // Auth is broadcast to every tab. A quiet, older tab must not flush its stale
 // copy over the more recent answer in the tab that requested sign-in.
 if(serialized!==lastWritten)writeDraft(store,key,snapshot,userId,now);
 return serialized;
}
// An email link carries only Supabase's auth token. Personal content stays in this browser.
export function prepareGuestHandoff(store:Store,email:string,snapshot:DraftSnapshot,now=Date.now(),id=crypto.randomUUID()) {
 // One consent, one journey: a draft that arrived by explicit consent never
 // re-exports itself into the next account's handoff.
 if(snapshot.imported)throw new Error('This draft was imported and will not be handed off again.');
 const normalized=normalizeEmail(email);if(!normalized)throw new Error('Email required.');
 // The guest copy is anonymous by definition: a handoff leaves ownership behind.
 writeDraft(store,GUEST_DRAFT_KEY,{...snapshot,owner:undefined,imported:undefined,saved:null},undefined,now);
 store.setItem(HANDOFF_KEY,JSON.stringify({id,email:normalized,createdAt:now,status:'pending'} satisfies Intent));
 return ()=>{const current=readIntent(store);if(current?.id===id&&current.status==='pending')store.removeItem(HANDOFF_KEY);};
}
// Google chooses the email after leaving this page. Bind the draft transfer to
// the tab that explicitly started OAuth, then bind it to the returned account.
export function prepareGoogleHandoff(store:Store,tabStore:Store,snapshot:DraftSnapshot,now=Date.now(),id=crypto.randomUUID()) {
 if(snapshot.imported)throw new Error('This draft was imported and will not be handed off again.');
 writeDraft(store,GUEST_DRAFT_KEY,{...snapshot,owner:undefined,imported:undefined,saved:null},undefined,now);
 tabStore.setItem(GOOGLE_HANDOFF_KEY,id);
 store.setItem(HANDOFF_KEY,JSON.stringify({id,email:'',provider:'google',createdAt:now,status:'pending'} satisfies Intent));
 return ()=>{const current=readIntent(store);if(current?.id===id&&current.status==='pending')store.removeItem(HANDOFF_KEY);if(tabStore.getItem(GOOGLE_HANDOFF_KEY)===id)tabStore.removeItem(GOOGLE_HANDOFF_KEY);};
}
function preferredDraft(store:Store,userId:string):DraftLoad{
 const base=accountDraftKey(userId);let key=base;
 try{const active=store.getItem(activeKey(userId));if(active?.startsWith(base+':handoff:')&&readDraft(store,active))key=active;}catch{}
 return {key,snapshot:readDraft(store,key),resumed:false,failed:false};
}
// An offer interrupts only an empty account. When the signing-in account
// already has its own draft (including the sign-out survivor), the owner's
// return must stay silent, and the explicit import in My stories covers any
// other draft on the device.
const draftHasContent=(snapshot:DraftSnapshot)=>!!(snapshot.story.draft?.trim()||snapshot.story.turns.some(t=>t.role==='user')||snapshot.story.paper);
function importGuest(store:Store,user:{id:string;email?:string},intent:Intent,guest:DraftSnapshot,now=Date.now()):DraftLoad{
 const key=accountDraftKey(user.id)+':handoff:'+intent.id;
 // A dedicated slot preserves any earlier account draft. Its deterministic name also
 // makes retrying after a crash safe, without replacing edits made in another tab.
 const snapshot={...(readDraft(store,key)||{...guest,saved:null}),imported:true as const};
 try{
  writeDraft(store,key,snapshot,user.id,now);
  store.setItem(HANDOFF_KEY,JSON.stringify({...intent,status:'consumed',userId:user.id}));
  return {key,snapshot,resumed:true,failed:false};
 }catch{return {key,snapshot,resumed:true,failed:true};}
}
export function resumeGuestHandoff(store:Store,user:{id:string;email?:string},now=Date.now(),tabStore?:Store):DraftLoad{
 const fallback=preferredDraft(store,user.id),intent=readIntent(store);
 if(!intent||now<intent.createdAt||now-intent.createdAt>(intent.provider==='google'?GOOGLE_HANDOFF_TTL:HANDOFF_TTL))return fallback;
 if(intent.provider==='google'){
  if(intent.status==='pending'&&tabStore?.getItem(GOOGLE_HANDOFF_KEY)!==intent.id)return fallback;
 }else if(normalizeEmail(user.email||'')!==intent.email)return fallback;
 if(intent.status==='consumed')return intent.userId===user.id&&fallback.key===accountDraftKey(user.id)+':handoff:'+intent.id?{...fallback,resumed:true}:fallback;
 const guest=readDraft(store,GUEST_DRAFT_KEY);if(!guest)return fallback;
 // Sign-in is a three-way decision on the guest draft's ownership:
 // owner match → silent resume; another account's draft → fully silent and
 // invisible (no dialog, no render, no write); ownerless → a consent offer,
 // never a silent import.
 if(guest.owner){
  if(guest.owner.userId!==user.id)return fallback;
  return importGuest(store,user,intent,guest,now);
 }
 if(fallback.snapshot||!draftHasContent(guest))return fallback;
 return {...fallback,offer:{intentId:intent.id,key:accountDraftKey(user.id)+':handoff:'+intent.id,snapshot:guest}};
}
// The consented half of the handoff: runs only after an explicit accept, and
// keeps the intent's bindings (TTL, and the originating tab for Google).
export function acceptGuestHandoff(store:Store,user:{id:string;email?:string},intentId:string,now=Date.now(),tabStore?:Store):DraftLoad{
 const fallback=preferredDraft(store,user.id),intent=readIntent(store);
 if(!intent||intent.id!==intentId||intent.status!=='pending'||now<intent.createdAt||now-intent.createdAt>(intent.provider==='google'?GOOGLE_HANDOFF_TTL:HANDOFF_TTL))return fallback;
 if(intent.provider==='google'&&tabStore?.getItem(GOOGLE_HANDOFF_KEY)!==intent.id)return fallback;
 const guest=readDraft(store,GUEST_DRAFT_KEY);if(!guest)return fallback;
 return importGuest(store,user,intent,guest,now);
}
export function restoreAccountDraft(store:Store,userId:string){
 const snapshot=readDraft(store,accountDraftKey(userId));if(snapshot)store.removeItem(activeKey(userId));return snapshot;
}
