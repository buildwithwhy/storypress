import {z} from 'zod';
import {db,identity,sameOrigin,billingConfigured,billingStatus,supabase,json,type Bindings} from './storage';
import {ServiceError} from '../lib/providers';

// Paywall §3 — the money path: checkout sessions, the webhook-lag status
// rescue, and signature-verified idempotent webhooks. Everything here stays
// dormant until STRIPE_SECRET_KEY exists: checkout refuses cleanly, status
// reports the free tier, and the webhook verifies against a configured
// STRIPE_WEBHOOK_SECRET (absent secret → fail closed, Stripe keeps retrying).
// Price amounts live in Stripe products; the repo reads price IDs from env.

const STRIPE_API='https://api.stripe.com';
const uuid=z.string().uuid();
// The entitlement columns a webhook or rescue may write. The upsert below
// never touches the addons column: add-ons arrive as separate one-time
// unlocks and a plan change must not erase them.
export type EntitlementWrite={plan:'free'|'subscription'|'lifetime';subscription_status?:string;current_period_end?:string|null;stripe_customer_id?:string|null};

async function applyEntitlement(env:Bindings,ownerId:string,write:EntitlementWrite){
 await db(env,'storypress_entitlements?on_conflict=owner_id','POST',{owner_id:ownerId,...write},{prefer:'return=representation, resolution=merge-duplicates'});
}

// ---- Checkout sessions ----

const checkoutInput=z.object({action:z.literal('checkout'),mode:z.enum(['subscription','payment']),plan:z.enum(['monthly','annual']).default('monthly')});
const statusInput=z.object({action:z.literal('status'),sessionId:z.string().trim().min(1).max(200)});
const billingInput=z.union([checkoutInput,statusInput]);

function priceFor(env:Bindings,mode:'subscription'|'payment',plan:'monthly'|'annual'){
 const price=mode==='payment'?env.STRIPE_PRICE_LIFETIME:plan==='annual'?env.STRIPE_PRICE_SUBSCRIPTION_ANNUAL:env.STRIPE_PRICE_SUBSCRIPTION_MONTHLY;
 if(!price?.trim())throw new ServiceError('Online checkout is not set up yet. Please try again soon.',503);
 return price.trim();
}

async function createCheckoutSession(env:Bindings,userId:string,email:string,mode:'subscription'|'payment',plan:'monthly'|'annual',origin:string){
 // Stripe accepts form-encoded parameters; no stripe-node SDK — the worker
 // bundle targets platform:'browser'. The success return carries Stripe's
 // {CHECKOUT_SESSION_ID} template so the client can trigger the §5 rescue;
 // cancel returns plain, and both mirror the email sign-in return.
 const form=new URLSearchParams({mode,'line_items[0][price]':priceFor(env,mode,plan),'line_items[0][quantity]':'1',success_url:`${origin}/?billing_checkout={CHECKOUT_SESSION_ID}`,cancel_url:origin+'/',client_reference_id:userId,'metadata[userId]':userId});
 if(email)form.set('customer_email',email);
 const response=await fetch(`${STRIPE_API}/v1/checkout/sessions`,{method:'POST',headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY!}`,'Content-Type':'application/x-www-form-urlencoded'},body:form.toString(),signal:AbortSignal.timeout(15000)});
 const session=await response.json().catch(()=>null) as {url?:string}|null;
 if(!response.ok||!session?.url)throw new ServiceError('Payment could not be started. Please try again shortly.',502);
 return session.url;
}

// ---- Status rescue (§5): the webhook-lag path ----

const checkoutSessionShape=z.object({id:z.string(),mode:z.enum(['subscription','payment']),payment_status:z.string(),customer:z.string().nullable().optional(),metadata:z.record(z.string()).nullable().optional()});

async function retrieveCheckoutSession(env:Bindings,sessionId:string){
 const response=await fetch(`${STRIPE_API}/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,{headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY!}`},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new ServiceError('Payment could not be verified. Please try again shortly.',502);
 return checkoutSessionShape.parse(await response.json().catch(()=>null));
}

function sessionToWrite(session:{mode:'subscription'|'payment';customer?:string|null}):EntitlementWrite{
 return {plan:session.mode==='subscription'?'subscription':'lifetime',subscription_status:'active',...(session.customer?{stripe_customer_id:session.customer}:{})};
}

export async function billingApi(request:Request,env:Bindings){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  sameOrigin(request);
  const user=await identity(request,env);
  if(!user)return json({error:'Sign in to manage your plan.'},401);
  const input=billingInput.parse(JSON.parse(await request.text()));
  if(!billingConfigured(env)){
   // Dormancy (§2): without Stripe env nothing blocks and nothing crashes —
   // checkout refuses cleanly and status reports the free tier.
   if(input.action==='checkout')throw new ServiceError('Online payment is not connected yet. Your stories remain fully available.',503);
   return json({billing:await billingStatus(env,user.id)});
  }
  if(input.action==='checkout')return json({url:await createCheckoutSession(env,user.id,user.email,input.mode,input.plan,new URL(request.url).origin)});
  // The rescue verifies the session server-side; a paid session belonging to
  // this owner flips the plan immediately. The browser's report of success is
  // never trusted — only what Stripe itself confirms here.
  const session=await retrieveCheckoutSession(env,input.sessionId);
  const sessionOwner=uuid.safeParse(session.metadata?.userId);
  if(session.payment_status==='paid'&&sessionOwner.success&&sessionOwner.data===user.id)await applyEntitlement(env,user.id,sessionToWrite(session));
  return json({billing:await billingStatus(env,user.id)});
 }catch(error){
  if(error instanceof ServiceError)return json({error:error.message,code:error.code},error.status);
  if(error instanceof z.ZodError||error instanceof SyntaxError)return json({error:'That request could not be read. Please refresh and try again.'},400);
  return json({error:'That step did not finish. Please try again.'},500);
 }
}

// ---- Webhooks: raw-body signature verification and idempotent effects ----

// Stripe's scheme: HMAC-SHA256 over `${timestamp}.${rawBody}`, hex-encoded in
// the stripe-signature header (t=<ts>,v1=<sig>). WebCrypto is used instead of
// node:crypto because the worker bundle targets platform:'browser', which does
// not resolve Node builtins — subtle provides the identical scheme on Node,
// Cloudflare Workers and Vercel. The digest covers the raw body read before
// any parsing; a tampered or missing signature changes no state.
const SIGNATURE_TOLERANCE_SECONDS=300;
const encoder=new TextEncoder();
async function hmacSha256Hex(key:string,payload:string){
 const cryptoKey=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=await crypto.subtle.sign('HMAC',cryptoKey,encoder.encode(payload));
 return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
// Constant-time content comparison; length differs only between distinct
// hex lengths, which the 64-hex shape check already filters out.
function timingSafeEqual(left:string,right:string){
 const a=encoder.encode(left),b=encoder.encode(right);
 if(a.length!==b.length)return false;
 let diff=0;
 for(let i=0;i<a.length;i++)diff|=a[i]!^b[i]!;
 return diff===0;
}
export async function verifyStripeSignature(raw:string,header:string|null,secret:string|undefined){
 if(!secret)throw new ServiceError('Payment webhooks are not configured yet. Nothing was processed.',503,'webhook_unconfigured');
 if(!header)throw new ServiceError('The webhook was not signed. Nothing was processed.',400,'webhook_invalid');
 const entries=header.split(',').map(part=>part.trim()).filter(Boolean).map(part=>{const eq=part.indexOf('=');return eq<0?[part,'']:[part.slice(0,eq).trim(),part.slice(eq+1).trim()];});
 const seconds=Number(entries.find(([key])=>key==='t')?.[1]);
 const provided=entries.filter(([key])=>key==='v1').map(([,value])=>value);
 if(!Number.isInteger(seconds)||Math.abs(Date.now()/1000-seconds)>SIGNATURE_TOLERANCE_SECONDS)throw new ServiceError('The webhook signature is outside the trusted window. Nothing was processed.',400,'webhook_invalid');
 if(!provided.length)throw new ServiceError('The webhook was not signed. Nothing was processed.',400,'webhook_invalid');
 const expected=await hmacSha256Hex(secret,`${seconds}.${raw}`);
 if(!provided.some(signature=>/^[0-9a-f]{64}$/i.test(signature)&&timingSafeEqual(signature.toLowerCase(),expected)))throw new ServiceError('The webhook signature could not be verified. Nothing was processed.',400,'webhook_invalid');
}

const webhookEvent=z.object({id:z.string().min(1).max(500),type:z.string().min(1).max(200),data:z.object({object:z.record(z.unknown())})});
const checkoutSessionObject=z.object({mode:z.enum(['subscription','payment']),payment_status:z.string(),customer:z.string().nullable().optional(),customer_details:z.object({email:z.string().nullable().optional()}).nullable().optional(),metadata:z.record(z.string()).nullable().optional(),subscription:z.string().nullable().optional()});
const subscriptionObject=z.object({status:z.string(),current_period_end:z.number().optional(),customer:z.string().nullable().optional(),metadata:z.record(z.string()).nullable().optional(),items:z.object({data:z.array(z.object({current_period_end:z.number().optional()}))}).nullable().optional()});
const invoiceObject=z.object({subscription:z.string().nullable().optional(),customer:z.string().nullable().optional(),customer_email:z.string().nullable().optional(),lines:z.object({data:z.array(z.object({period:z.object({end:z.number().optional()}).optional(),current_period:z.object({end:z.number().optional()}).optional()}))}).nullable().optional()});
// Statuses that end access; everything else stays a subscription in good
// standing (past_due rides its grace period per the spec's lifecycle table).
const CLOSING_STATUSES=['canceled','unpaid','incomplete_expired'];
const stripeTime=(seconds:number)=>new Date(seconds*1000).toISOString();

// Pure mapping from a webhook event to the entitlement columns it writes —
// null means the event has no entitlement effect (unknown types, sessions
// still unpaid). Never touches stories: the write targets storypress_
// entitlements only, so a downgrade cannot delete or lock anything.
function entitlementWriteFor(type:string,obj:Record<string,unknown>):EntitlementWrite|null{
 if(type==='checkout.session.completed'||type==='checkout.session.async_payment_succeeded'){
  const session=checkoutSessionObject.parse(obj);
  if(session.payment_status!=='paid'&&session.payment_status!=='no_payment_required')return null;
  return {plan:session.mode==='subscription'?'subscription':'lifetime',subscription_status:'active',...(session.customer?{stripe_customer_id:session.customer}:{})};
 }
 if(type==='customer.subscription.updated'){
  const subscription=subscriptionObject.parse(obj);
  const periodEnd=subscription.current_period_end??subscription.items?.data?.[0]?.current_period_end;
  return {plan:CLOSING_STATUSES.includes(subscription.status)?'free':'subscription',subscription_status:subscription.status,...(periodEnd!==undefined?{current_period_end:stripeTime(periodEnd)}:{})};
 }
 if(type==='customer.subscription.deleted')return {plan:'free',subscription_status:'canceled',current_period_end:null};
 if(type==='invoice.paid'){
  const invoice=invoiceObject.parse(obj);
  if(!invoice.subscription)return null;
  const period=invoice.lines?.data?.[0]?.period?.end??invoice.lines?.data?.[0]?.current_period?.end;
  return {plan:'subscription',subscription_status:'active',...(period!==undefined?{current_period_end:stripeTime(period)}:{})};
 }
 return null;
}

async function retrieveStripeJson(env:Bindings,path:string):Promise<Record<string,unknown>|null>{
 const response=await fetch(`${STRIPE_API}/v1/${path}`,{headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY!}`},signal:AbortSignal.timeout(15000)});
 if(response.status===404)return null;
 if(!response.ok)throw new ServiceError('Payment could not be verified. Please try again shortly.',502);
 return await response.json().catch(()=>null) as Record<string,unknown>|null;
}

async function emailOwner(env:Bindings,email:string):Promise<string|null>{
 // Supabase admin lookup, service-role authenticated. An unmatched email is a
 // legitimate null; a failed lookup throws so Stripe retries while the
 // platform recovers. Last resort only — the app's sessions always carry
 // metadata.userId.
 const response=await fetch(`${supabase(env)}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,{headers:{apikey:env.SUPABASE_SECRET_KEY!,Authorization:`Bearer ${env.SUPABASE_SECRET_KEY!}`},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new ServiceError('The account for this payment could not be looked up. Please try again shortly.',503);
 const users=await response.json().catch(()=>null) as {users?:{id?:unknown;email?:unknown}[]}|null;
 const match=users?.users?.find(entry=>typeof entry.email==='string'&&entry.email.toLowerCase()===email.toLowerCase());
 return match&&typeof match.id==='string'&&uuid.safeParse(match.id).success?match.id:null;
}

async function customerOwner(env:Bindings,customer:unknown):Promise<string|null>{
 if(typeof customer!=='string'||!customer.startsWith('cus_'))return null;
 const data=await retrieveStripeJson(env,`customers/${encodeURIComponent(customer)}`);
 return typeof data?.email==='string'?emailOwner(env,data.email):null;
}

async function resolveEventOwner(env:Bindings,obj:Record<string,unknown>):Promise<string|null>{
 // 1. metadata.userId — how every session this app creates identifies its owner.
 const direct=uuid.safeParse((obj.metadata as {userId?:unknown}|null|undefined)?.userId);
 if(direct.success)return direct.data;
 // 2. Invoices carry no session metadata; the subscription object may.
 if(typeof obj.subscription==='string'&&obj.subscription.startsWith('sub_')){
  const subscription=await retrieveStripeJson(env,`subscriptions/${encodeURIComponent(obj.subscription)}`);
  const indirect=uuid.safeParse((subscription?.metadata as {userId?:unknown}|null|undefined)?.userId);
  if(indirect.success)return indirect.data;
  return customerOwner(env,subscription?.customer);
 }
 // 3. Last resort: an email on the event or its customer.
 const details=(obj.customer_details??null) as {email?:unknown}|null;
 const eventEmail=[obj.customer_email,details?.email].find(candidate=>typeof candidate==='string'&&candidate.includes('@')) as string|undefined;
 if(eventEmail)return emailOwner(env,eventEmail);
 return customerOwner(env,obj.customer);
}

export async function stripeWebhook(request:Request,env:Bindings){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  // Invariant order (§3): raw body first, signature over `${t}.${raw}`, then
  // and only then JSON.parse. Nothing below can act on an unverified payload.
  const raw=await request.text();
  if(raw.length>1000000)return json({error:'This webhook payload is too large.'},413);
  await verifyStripeSignature(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET);
  const event=webhookEvent.parse(JSON.parse(raw));
  const write=entitlementWriteFor(event.type,event.data.object);
  if(!write)return json({received:true,ignored:event.type});
  // Idempotency claim: the insert conflicts on event_id for redeliveries, so
  // a replay consumes nothing and writes nothing (§ acceptance: single
  // entitlement write per event).
  const claimed=await db(env,'storypress_billing_events?on_conflict=event_id','POST',{event_id:event.id},{prefer:'return=representation, resolution=ignore-conflicts'}) as unknown[]|null;
  if(!Array.isArray(claimed)||!claimed.length)return json({received:true,duplicate:true});
  try{
   const owner=await resolveEventOwner(env,event.data.object);
   // An owner that cannot be resolved is final (transient lookups throw
   // instead) — acknowledge without effects and keep the claim.
   if(!owner)return json({received:true,unmatched:true});
   await applyEntitlement(env,owner,write);
  }catch(error){
   // Release the claim so Stripe's redelivery reprocesses instead of
   // skipping. Best-effort: if the release itself fails the checkout status
   // rescue still repairs the dominant money path.
   try{await db(env,`storypress_billing_events?event_id=eq.${encodeURIComponent(event.id)}`,'DELETE');}
   catch{/* claim release failed; the primary error below still returns 5xx */}
   throw error;
  }
  return json({received:true});
 }catch(error){
  if(error instanceof ServiceError)return json({error:error.message,code:error.code},error.status);
  if(error instanceof z.ZodError||error instanceof SyntaxError)return json({error:'The webhook payload could not be read.',code:'webhook_payload'},400);
  return json({error:'The webhook did not finish. Nothing was acknowledged.'},500);
 }
}

