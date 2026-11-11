// Account re-read regression checks (todo_dotc5MdR): the boot /api/account
// fetch is necessarily anonymous — the Supabase client does not exist yet —
// so the server answers it with the signed-out free-tier defaults, and a
// restored session used to render the usage panel as "0 of 3 free stories
// used" even with a paid plan and reserved stories. These checks pin the fix:
// with a session on hand, setupAccount re-reads the payload with the owner's
// bearer so the billing block reflects the signed-in owner (N reserved
// stories, the paid plan, the pack balance); a sign-in after boot delivers
// the same refreshed config through the listener; token refreshes never
// refetch; and a failed re-read degrades to the boot config without blocking
// sign-in. The Supabase client is stubbed and fetch is mocked — no network.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';

// Minimal Supabase client stub: a restorable session plus a captured
// onAuthStateChange handler — exactly the surface setupAccount touches. The
// stub runs in its own bundled module, so the test reaches it through the
// exported mutable `state` object.
const supabaseStub={name:'supabase-stub',setup(b){
 b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'stub',namespace:'supabase-stub'}));
 b.onLoad({filter:/.*/,namespace:'supabase-stub'},()=>({contents:`
  export const state={session:null,handler:null,unsubscribed:0};
  export function createClient(){
   return {auth:{
    getSession:()=>Promise.resolve({data:{session:state.session}}),
    onAuthStateChange:handler=>{state.handler=(event,session)=>{state.session=session;handler(event,session);};return {data:{subscription:{unsubscribe(){state.unsubscribed+=1;}}}};}
   }};
  }`,loader:'js'}));
}};
const bundle=await build({stdin:{contents:`
import {setupAccount} from './lib/account-client.ts';
import {state} from '@supabase/supabase-js';
export {setupAccount,state};
`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[supabaseStub]});
const modulePath=new URL('../work/account-refresh-check.mjs',import.meta.url);await fs.mkdir(new URL('../work/',import.meta.url),{recursive:true});await fs.writeFile(modulePath,bundle.outputFiles[0].text);
const {setupAccount,state:authState}=await import(modulePath.href);
const restoredSession=()=>authState.session;
const changeHandler=()=>authState.handler;

// The anonymous boot payload (the server's signed-out free-tier defaults) and
// the same owner's real payload — 12 reserved stories, a live subscription,
// 9 draws against the 50 cap, and 27 pack credits left of a 30-pack.
const uid='4cf18fac-e4e2-4a91-b3ac-c1b04fb9088e';
const anonymous={user:null,supabase:{url:'https://storypress-test.supabase.co',key:'publishable_test'},storage:true,linkSharing:false,dailyUnits:40,
 billing:{configured:true,plan:'free',addons:[],storiesCreated:0,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:0,packCreditsRemaining:0},pricing:null};
const signedInOwner={...anonymous,billing:{configured:true,plan:'subscription',addons:[],storiesCreated:12,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:9,packCreditsRemaining:27},pricing:null};
let calls=[];
const originalFetch=globalThis.fetch;
const record=(url,init)=>{const entry={url:String(url),headers:{...(init?.headers??{})}};calls.push(entry);return entry;};
const tick=async(turns=25)=>{for(let index=0;index<turns;index++)await Promise.resolve();};
const session=(token='restored-token')=>({access_token:token,user:{id:uid,email:'founder@example.invalid'}});
globalThis.fetch=async(url,init)=>{
 const entry=record(url,init);
 assert.equal(entry.url,'/api/account','the client only re-reads the same-origin account route');
 if(!entry.headers.Authorization)return {ok:true,status:200,json:async()=>anonymous};
 assert.equal(entry.headers.Authorization,'Bearer restored-token','the re-read carries the owner bearer');
 return {ok:true,status:200,json:async()=>signedInOwner};
};

// ---- Scenario A: session restored at boot (the QA repro) ----
authState.session=session();
let delivered=[];
const booted=await setupAccount((user,config)=>delivered.push({user,config}));
assert.equal(calls.length,2,'a restored session triggers exactly one authenticated re-read after the anonymous boot fetch');
assert.deepEqual(calls[0].headers,{},'the boot fetch carries no Authorization — it cannot, and the server answers with signed-out defaults');
assert.deepEqual(calls[1].headers,{Authorization:'Bearer restored-token'},'the re-read is authenticated');
assert.equal(booted.config.user?.id,uid,'the restored session user is reported');
assert.deepEqual(booted.config.billing,{configured:true,plan:'subscription',addons:[],storiesCreated:12,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:9,packCreditsRemaining:27},'the account payload reflects the signed-in owner\'s reserved stories, plan, draws, and pack balance — not the anonymous zeros');
booted.dispose();
assert.equal(authState.unsubscribed,1,'dispose unsubscribes the auth listener');

// ---- Scenario B: sign-in after boot delivers the refreshed config ----
authState.session=null;calls=[];delivered=[];
const guest=await setupAccount((user,config)=>delivered.push({user,config}));
assert.equal(calls.length,1,'no session at boot — no re-read, exactly the old signed-out behavior');
await changeHandler()('SIGNED_IN',session());
await tick();
assert.equal(calls.length,2,'a live sign-in re-reads the account payload with the owner bearer');
const configDelivery=delivered.find(entry=>entry.config);
assert.ok(configDelivery,'the sign-in re-read delivers the refreshed config through the listener');
assert.equal(configDelivery.config.user?.id,uid,'the delivered config carries the signed-in user');
assert.equal(configDelivery.config.billing.storiesCreated,12,'the delivered billing block reflects the owner, not the anonymous zeros');
assert.equal(configDelivery.user?.id,uid,'the listener still receives the plain user update first');
calls=[];
await changeHandler()('TOKEN_REFRESHED',session());
await tick();
assert.equal(calls.length,0,'token refreshes never refetch the account payload');
guest.dispose();

// ---- Scenario C: a failed re-read degrades without blocking sign-in ----
authState.session=session('broken-token');calls=[];
globalThis.fetch=async(url,init)=>{
 const entry=record(url,init);
 if(entry.headers.Authorization)return {ok:false,status:503,json:async()=>({error:'account storage unavailable'})};
 return {ok:true,status:200,json:async()=>anonymous};
};
const degraded=await setupAccount(()=>{});
assert.equal(degraded.config.user?.id,uid,'a failed re-read still reports the signed-in user');
assert.equal(degraded.config.billing.storiesCreated,0,'a failed re-read keeps the boot billing block instead of crashing sign-in');
degraded.dispose();
await changeHandler()('SIGNED_IN',session('broken-token'));
await tick();

globalThis.fetch=originalFetch;
console.log('Passed account re-read regression: anonymous boot fetch restored-session re-read (owner plan, 12 reserved stories, draws, pack balance), live sign-in re-read delivered through the listener, token-refresh no-op, and failed-re-read degradation. Supabase client stubbed; fetch mocked — no network.');
