import {createClient,type SupabaseClient} from '@supabase/supabase-js';
export type Account={id:string;email?:string};
export type AccountConfig={user:Account|null;supabase:{url:string;key:string}|null;storage:boolean;linkSharing:boolean;dailyUnits:number|null};
let client:SupabaseClient|null=null;
export async function setupAccount(onUser:(user:Account|null)=>void){
 const response=await fetch('/api/account');if(!response.ok)throw new Error('Account connection unavailable. Reload to try again.');
 const config=await response.json() as AccountConfig;
 if(config.supabase){
  client=createClient(config.supabase.url,config.supabase.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data}=await client.auth.getSession();config.user=data.session?.user||null;
  const {data:subscription}=client.auth.onAuthStateChange((_event,session)=>onUser(session?.user||null));
  return {config,dispose:()=>subscription.subscription.unsubscribe()};
 }
 return {config,dispose:()=>{}};
}
export async function accountHeaders(){const {data}=client?await client.auth.getSession():{data:{session:null}};return data.session?{Authorization:`Bearer ${data.session.access_token}`} as Record<string,string>:{};}
export async function accountRequest(body?:unknown,id?:string){
 const response=await fetch(`/api/stories${id?'?id='+encodeURIComponent(id):''}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...await accountHeaders()},body:body?JSON.stringify(body):undefined});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'That change could not be saved.');return data;
}
export async function signIn(email:string){if(!client)throw new Error('Accounts are not connected yet.');const {error}=await client.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{emailRedirectTo:location.origin+'/'}});if(error)throw error;}
export async function signOut(){const {error}=await client!.auth.signOut({scope:'local'});if(error)throw error;}
