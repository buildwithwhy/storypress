import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import type {BillingStatus,Pricing} from './billing';
export type Account={id:string;email?:string};
// pricing: the server's Stripe-cached price payload (wave 8 §3) — null while
// dormant or when Stripe is unreachable with no cache; the pricing page hides
// amounts rather than inventing numbers.
export type AccountConfig={user:Account|null;supabase:{url:string;key:string}|null;storage:boolean;linkSharing:boolean;dailyUnits:number|null;sampleOnly?:boolean;billing:BillingStatus;pricing:Pricing|null};
let client:SupabaseClient|null=null;
export async function setupAccount(onUser:(user:Account|null,config?:AccountConfig)=>void){
 const response=await fetch('/api/account');if(!response.ok)throw new Error('Account connection unavailable. Reload to try again.');
 let config=await response.json() as AccountConfig;
 if(config.supabase){
  client=createClient(config.supabase.url,config.supabase.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data}=await client.auth.getSession();config.user=data.session?.user||null;
  // The boot fetch above is necessarily anonymous — the Supabase client does
  // not exist yet when the app needs its config — so the server answered it
  // with the signed-out free-tier defaults (todo_dotc5MdR: a restored session
  // rendered the usage panel as "0 of 3 free stories used" even with a paid
  // plan and reserved stories). With a session on hand, re-read the payload
  // with the owner's bearer so plan, counter, draws, and pack balance are
  // real. A failed re-read keeps the boot config rather than blocking sign-in.
  if(data.session)config=await signedInAccountConfig({id:data.session.user.id,email:data.session.user.email||''})??config;
  // A sign-in after boot (email code, Google, checkout return) needs the same
  // re-read: the listener receives the refreshed config so the panel's plan
  // and usage match the newly signed-in owner. Token refreshes never refetch.
  const {data:subscription}=client.auth.onAuthStateChange((event,session)=>{
   const user=session?{id:session.user.id,email:session.user.email||''}:null;
   onUser(user);
   if(event==='SIGNED_IN'&&user)void signedInAccountConfig(user).then(next=>{if(next)onUser(user,next);});
  });
  return {config,dispose:()=>subscription.subscription.unsubscribe()};
 }
 return {config,dispose:()=>{}};
}
// Re-reads the account payload with the owner's bearer (the anonymous boot
// fetch cannot carry it) and stamps the session user onto the result — the
// server reports user:null for the re-read since it sees only the bearer.
// Returns null when the re-read fails; the caller then keeps the boot config
// (billing degrades to the signed-out defaults, the same behavior a signed-out
// visitor gets) instead of failing sign-in over a panel detail.
async function signedInAccountConfig(user:Account):Promise<AccountConfig|null>{
 try{
  const response=await fetch('/api/account',{headers:await accountHeaders()});
  if(!response.ok)return null;
  return {...await response.json() as AccountConfig,user};
 }catch(error){console.error(JSON.stringify({event:'account_refresh_failed',message:error instanceof Error?error.message:String(error)}));return null;}
}
export async function accountHeaders(){const {data}=client?await client.auth.getSession():{data:{session:null}};return data.session?{Authorization:`Bearer ${data.session.access_token}`} as Record<string,string>:{};}
export async function accountRequest(body?:unknown,id?:string){
 const response=await fetch(`/api/stories${id?'?id='+encodeURIComponent(id):''}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...await accountHeaders()},body:body?JSON.stringify(body):undefined});
 const data=await response.json();
 // Mirror verifyEmailCode's {code} annotation so callers can localize typed
 // refusals (e.g. story_limit) instead of the server's English text.
 if(!response.ok)throw Object.assign(new Error(data.error||'That change could not be saved.'),{code:data.code});return data;
}
export async function signIn(email:string){if(!client)throw new Error('Accounts are not connected yet.');const {error}=await client.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{emailRedirectTo:location.origin+'/'}});if(error)throw error;}
export async function verifyEmailCode(email:string,code:string){
 if(!client)throw new Error('Accounts are not connected yet.');
 const token=code.replace(/\s/g,'');
 if(!/^\d{6,10}$/.test(token))throw Object.assign(new Error('Enter the code from your email.'),{code:'invalid_code'});
 const {data,error}=await client.auth.verifyOtp({email:email.trim().toLowerCase(),token,type:'email'});
 if(error)throw error;
 if(!data.session)throw new Error('Sign-in could not be completed. Please try again.');
}
export async function signInWithGoogle(returnTo?:string){
 if(!client)throw new Error('Accounts are not connected yet.');
 // Guests on /i/<token> return to their invite, owners to the app.
 const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:returnTo||location.origin+'/'}});
 if(error)throw error;
}
export async function signOut(){const {error}=await client!.auth.signOut({scope:'local'});if(error)throw error;}
