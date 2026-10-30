// Contributor invitations: the owner mints expiring, revocable capability
// links; guests answer the personal question; nothing mutates the story until
// the owner approves a contribution. Guests never hold accounts and the token
// reveals only the question — never the story blob, transcript or keepsake.
import {z} from 'zod';
import {type Story} from '../lib/story';
import {ServiceError} from '../lib/providers';
import {identity,db,sameOrigin,type Bindings} from './storage';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const token=z.string().regex(/^[a-f0-9]{64}$/);
const uuid=z.string().uuid();
const languages={en:1,zh:1,es:1} as const;

export function inviteLink(origin:string,tokenValue:string,contributorName?:string){return `${origin}/i/${tokenValue}${contributorName?`#${encodeURIComponent(contributorName)}`:''}`;}

type InviteContext={status:'open'|'expired'|'revoked'|'unknown';question?:string;expiresAt?:string;language?:Story['language'];occasion?:Story['occasion']};
export async function inviteContext(env:Bindings,tokenValue:string):Promise<InviteContext>{
 const [row]=await db(env,`storypress_invites?token=eq.${tokenValue}&select=id,story_id,question,expires_at,status`) as {id:string;story_id:string;question:string;expires_at:string;status:string}[];
 if(!row)return {status:'unknown'};
 if(row.status!=='open')return {status:row.status==='revoked'?'revoked':'expired'};
 if(new Date(row.expires_at).getTime()<=Date.now())return {status:'expired'};
 // Story context only: the language and occasion guide the guest interview.
 const [story]=await db(env,`storypress_stories?id=eq.${row.story_id}&select=language:data->>language,occasion:data->>occasion`) as {language?:string;occasion?:string}[];
 return {status:'open',question:row.question,expiresAt:row.expires_at,
  language:story?.language&&story.language in languages?story.language as Story['language']:'en',
  occasion:story?.occasion==='wedding'||story?.occasion==='graduation'?story.occasion:'life'};
}

async function ownStory(env:Bindings,userId:string,storyId:string){
 const [row]=await db(env,`storypress_stories?id=eq.${storyId}&owner_id=eq.${userId}&select=id`) as {id:string}[];
 if(!row)throw new ServiceError('That story is not in your account.',404);
}

const inviteShape=z.enum(['open','expired','revoked']);
export async function ownedInvites(env:Bindings,userId:string,storyId:string){
 await ownStory(env,userId,storyId);
 const invites=await db(env,`storypress_invites?story_id=eq.${storyId}&select=id,question,status,expires_at,created_at&order=created_at.desc`) as {id:string;question:string;status:string;expires_at:string;created_at:string}[];
 const contributions=await db(env,`storypress_contributions?story_id=eq.${storyId}&select=id,invite_id,author_label,contributor_user_id,turns,status,created_at,reviewed_at&order=created_at.desc`) as {id:string;invite_id:string|null;author_label:string;contributor_user_id:string|null;turns:unknown;status:string;created_at:string;reviewed_at:string|null}[];
 const now=Date.now();
 return {
  invites:(invites||[]).map(i=>({id:i.id,question:i.question,
   status:i.status==='open'&&new Date(i.expires_at).getTime()<=now?'expired':inviteShape.parse(i.status),
   expiresAt:i.expires_at,createdAt:i.created_at})),
  contributions:(contributions||[]).map(c=>({id:c.id,inviteId:c.invite_id,authorLabel:c.author_label,
   contributorUserId:c.contributor_user_id,turns:c.turns,status:c.status,createdAt:c.created_at,reviewedAt:c.reviewed_at})),
 };
}

const createInput=z.object({action:z.literal('create'),storyId:uuid,question:z.string().trim().min(1).max(600),
 contributorName:z.string().trim().max(80).optional()}).transform(v=>({...v,contributorName:v.contributorName||undefined}));

export async function invitesApi(request:Request,env:Bindings){
 if(request.method!=='GET'&&request.method!=='POST')return json({error:'Method not allowed'},405);
 const url=new URL(request.url);
 try{
  if(request.method==='GET'){
   const tokenValue=url.searchParams.get('token');
   if(tokenValue)return json(await inviteContext(env,token.parse(tokenValue)));
   const user=await identity(request,env);
   if(!user)return json({error:'Sign in to manage invitations.'},401);
   return json(await ownedInvites(env,user.id,uuid.parse(url.searchParams.get('story_id')||'')));
  }
  sameOrigin(request);
  const body=JSON.parse(await request.text()) as Record<string,unknown>;
  if(body.action==='create'){
   const user=await identity(request,env);
   if(!user)return json({error:'Sign in to manage invitations.'},401);
   const input=createInput.parse(body);
   await ownStory(env,user.id,input.storyId);
   const tokenValue=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
   const [row]=await db(env,'storypress_invites','POST',{story_id:input.storyId,token:tokenValue,question:input.question,created_by:user.id}) as {id:string;expires_at:string;question:string}[];
   return json({id:row!.id,token:tokenValue,url:inviteLink(url.origin,tokenValue,input.contributorName),expiresAt:row!.expires_at,question:row!.question});
  }
  if(body.action==='revoke'){
   const user=await identity(request,env);
   if(!user)return json({error:'Sign in to manage invitations.'},401);
   const inviteId=uuid.parse(body.inviteId);
   const [invite]=await db(env,`storypress_invites?id=eq.${inviteId}&select=story_id`) as {story_id:string}[];
   if(!invite)throw new ServiceError('That invitation is gone already.',404);
   await ownStory(env,user.id,invite.story_id);
   await db(env,`storypress_invites?id=eq.${inviteId}&status=eq.open`,'PATCH',{status:'revoked'});
   return json({revoked:true});
  }
  return json({error:'Unknown action.'},400);
 }catch(error){
  if(error instanceof ServiceError)return json({error:error.message,code:error.code},error.status);
  if(error instanceof z.ZodError||error instanceof SyntaxError)return json({error:'That request could not be read. Please refresh and try again.'},400);
  return json({error:'That step did not finish. Please try again.'},500);
 }
}
