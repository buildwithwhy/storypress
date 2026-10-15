import {z} from 'zod';
import {storySchema} from '../lib/story';
import {editionSnapshot, editionHtml} from '../lib/edition';
import {editionArtwork} from '../lib/artwork-data';
import {ServiceError} from '../lib/providers';
export type Bindings=Record<string,string|undefined>;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function configured(env:Bindings){return !!(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY&&env.SUPABASE_SECRET_KEY);}
function supabase(env:Bindings){if(!configured(env))throw new ServiceError('Account saving is not connected yet. Your device draft is kept.',503);return env.SUPABASE_URL!.replace(/\/$/,'');}
export async function identity(request:Request,env:Bindings){
 if(!env.SUPABASE_URL){const id=request.headers.get('oai-authenticated-user-id');return id?{id,email:''}:null;}
 const bearer=request.headers.get('authorization');if(!bearer?.startsWith('Bearer '))return null;
 const response=await fetch(`${supabase(env)}/auth/v1/user`,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY!,Authorization:bearer},signal:AbortSignal.timeout(10000)});
 if(!response.ok)return null;
 const user=await response.json() as {id?:string;email?:string};return user.id&&z.string().uuid().safeParse(user.id).success?{id:user.id,email:user.email||''}:null;
}
export async function owner(request:Request,env:Bindings){const user=await identity(request,env);if(!user)throw new ServiceError('Sign in to use AI or save your stories. You can still explore the sample.',401);return user.id;}
// Modern secret keys belong only in apikey; Authorization is reserved for user JWTs.
async function db(env:Bindings,path:string,method='GET',body?:unknown){
 const response=await fetch(`${supabase(env)}/rest/v1/${path}`,{method,headers:{apikey:env.SUPABASE_SECRET_KEY!,'User-Agent':'Storypress-Server/1.0','Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new ServiceError('Your account storage could not complete that step. Your device draft is kept.',503);
 return response.status===204?null:response.json();
}
function sameOrigin(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new ServiceError('Please open Storypress directly.',403);}
const uuid=z.string().uuid();
export async function accountApi(request:Request,env:Bindings){
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 try{return json({user:await identity(request,env),supabase:configured(env)?{url:env.SUPABASE_URL,key:env.SUPABASE_PUBLISHABLE_KEY}:null,storage:configured(env),linkSharing:env.STORYPRESS_PUBLIC_SHARING==='true',dailyUnits:configured(env)?40:null});}
 catch{return json({error:'Could not load your account.'},503)}
}
export async function storiesApi(request:Request,env:Bindings){
 try{
  const userId=await owner(request,env);supabase(env);const url=new URL(request.url);
  const own=`owner_id=eq.${userId}`;
  if(request.method==='GET'){
   const id=url.searchParams.get('id');
   if(id){uuid.parse(id);const [row]=await db(env,`storypress_stories?id=eq.${id}&${own}&select=id,data,revision,share_token,updated_at`);if(!row)return json({error:'Story not found.'},404);return json(row);}
   return json({stories:await db(env,`storypress_stories?${own}&select=id,title,revision,updated_at&order=updated_at.desc&limit=100`)});
  }
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  sameOrigin(request);const raw=await request.text();if(raw.length>2200000)return json({error:'This story is too large to save.'},413);
  const body=JSON.parse(raw);
  if(body.action==='save'){
   const story=storySchema.parse(body.story),id=body.id?uuid.parse(body.id):crypto.randomUUID(),now=new Date().toISOString();
   const opening=story.turns.find(turn=>turn.role==='user'&&turn.text.trim())?.text.trim()||story.draft?.trim();
   const title=story.paper?.headline||(opening?{en:'Draft · ',zh:'草稿 · ',es:'Borrador · '}[story.language]+opening.slice(0,80)+(opening.length>80?'…':''):story.name||{en:'My story',zh:'我的故事',es:'Mi historia'}[story.language]);
   let rows;
   if(body.id){const revision=z.number().int().positive().parse(body.revision);rows=await db(env,`storypress_stories?id=eq.${id}&${own}&revision=eq.${revision}`,'PATCH',{title,data:story,revision:revision+1,updated_at:now});}
   else rows=await db(env,'storypress_stories','POST',{id,owner_id:userId,title,data:story});
   if(!rows.length)return json({error:'This saved copy has changed. Open it before saving again; your device draft is kept.'},409);
   return json({id:rows[0].id,revision:rows[0].revision,share_token:rows[0].share_token,updated_at:rows[0].updated_at});
  }
  const id=uuid.parse(body.id);
  if(body.action==='delete'){await db(env,`storypress_stories?id=eq.${id}&${own}`,'DELETE');return json({deleted:true});}
  if(body.action==='share'||body.action==='private'){
   if(body.action==='share'&&env.STORYPRESS_PUBLIC_SHARING!=='true')throw new ServiceError('Web links are not enabled yet. Download or send a newspaper copy instead.',503);
   const revision=z.number().int().positive().parse(body.revision);
   const [row]=await db(env,`storypress_stories?id=eq.${id}&${own}&revision=eq.${revision}&select=data,share_token`);if(!row)return json({error:'Save your latest changes before sharing.'},409);
   const token=body.action==='share'?(row.share_token||crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')):null;
   const snapshot=body.action==='share'?editionSnapshot(storySchema.parse(row.data)):null;
   const rows=await db(env,`storypress_stories?id=eq.${id}&${own}&revision=eq.${revision}`,'PATCH',{share_token:token,edition:snapshot,revision:revision+1});
   if(!rows.length)return json({error:'This saved copy changed. Save again before sharing.'},409);
   return json({id,revision:revision+1,share_token:token,url:token?`${url.origin}/s/${token}`:null});
  }
  return json({error:'Unknown action.'},400);
 }catch(error){if(error instanceof ServiceError)return json({error:error.message},error.status);if(error instanceof z.ZodError||error instanceof SyntaxError)return json({error:'Please check this story and try again.'},400);return json({error:error instanceof Error&&error.message.includes('approve')?error.message:'Could not save this change. Your device draft is kept.'},400);}
}
export async function sharedEdition(request:Request,env:Bindings,token:string){
 if(env.STORYPRESS_PUBLIC_SHARING!=='true'||!/^[a-f0-9]{64}$/.test(token)||!['GET','HEAD'].includes(request.method))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 try{const [row]=await db(env,`storypress_stories?share_token=eq.${token}&select=edition`);if(!row?.edition)return new Response('This edition is private or the link has expired.',{status:404,headers:{'Cache-Control':'no-store'}});
 return new Response(request.method==='HEAD'?null:editionHtml(storySchema.parse(row.edition),editionArtwork(storySchema.parse(row.edition)),{webReader:true}),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
 }catch{return new Response('This edition is unavailable.',{status:503,headers:{'Cache-Control':'no-store'}})}
}
export async function reserveAi(userId:string,env:Bindings,action:string){
 // The existing owner-private pilot works before Supabase is configured.
 // Never enable public hosting until Supabase and its durable quota RPC are verified.
 if(!env.SUPABASE_URL)return;
 const allowed=await db(env,'rpc/storypress_reserve_ai','POST',{p_user:userId,p_action:action});
 if(allowed!==true)throw new ServiceError('The daily AI preview allowance has been reached. You can still edit, download and print. Please try again tomorrow.',429);
}
