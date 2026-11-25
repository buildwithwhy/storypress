import {db,type Bindings} from './storage';
import {GROWTH_CLIENT_ID,cleanAttribution,type Attribution} from '../lib/growth';

// Growth engine, server side (docs/GROWTH-ENGINE.md): purchase and renewal
// events, sent server-to-server to the engine's POST /v1/events from VERIFIED
// Stripe webhooks only — the browser is never trusted for money.
//
// Dormant by default: without GROWTH_INGEST_URL and GROWTH_INGEST_HMAC
// nothing is read, built or sent. The send can never fail or hold up the
// webhook: every error is swallowed and logged (Stripe event id and status
// only — no customer data), the engine request has a short timeout, and the
// webhook waits at most GROWTH_BUDGET_MS before answering Stripe.
//
// The payload carries no personal data: never an email, name, owner id,
// Stripe customer id or story content — only the step, the Stripe event id
// (so redeliveries are idempotent at the engine), the amount and currency
// Stripe reports, and UTMs the checkout carried in its metadata.

export const GROWTH_SIGNATURE_HEADER='X-Growth-Signature';
export const GROWTH_TIMEOUT_MS=2500;
export const GROWTH_BUDGET_MS=3000;

export type GrowthWebhookEvent={id:string;type:string;created?:number;object:Record<string,unknown>};
export type GrowthMoneyStep='purchase'|'renewal';
export type GrowthPayloadEvent={event_id:string;client:string;stage:GrowthMoneyStep;step:GrowthMoneyStep;occurred_at:string;value?:{amount_minor:number;currency:string};attribution?:Attribution;source:'webhook'};

// The engine's events endpoint and this client's secret, or null (dormant).
export function growthIngest(env:Bindings):{url:string;secret:string}|null{
 const base=env.GROWTH_INGEST_URL?.trim(),secret=env.GROWTH_INGEST_HMAC?.trim();
 if(!base||!secret)return null;
 try{
  const url=new URL('/v1/events',base);
  return url.protocol==='https:'?{url:url.toString(),secret}:null;
 }catch{return null;}
}

// The browser half reads its SDK URL from the services payload. Unset adds
// nothing, so a dormant deployment's payload is unchanged.
export function growthClientConfig(env:Bindings):{growth?:{sdkUrl:string}}{
 const sdkUrl=env.GROWTH_SDK_URL?.trim();
 return sdkUrl?{growth:{sdkUrl}}:{};
}

// The engine's scheme (its src/ingest/hmac.ts): HMAC-SHA256 over the exact
// raw body bytes, hex, in `X-Growth-Signature: sha256=<hex>`.
export async function growthSignature(secret:string,body:string):Promise<string>{
 const encoder=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=await crypto.subtle.sign('HMAC',key,encoder.encode(body));
 return 'sha256='+[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

// Which money step a verified, applied webhook effect is: a subscription
// checkout is a purchase; a pack checkout is a purchase the first time and a
// renewal after that (decided by the caller from the grant ledger); an
// invoice paid for a subscription cycle is a renewal. The first invoice of a
// subscription (billing_reason subscription_create) is already counted by its
// checkout and is not sent again.
export function growthStepFor(event:GrowthWebhookEvent,effectKind:'entitlement'|'pack'):'subscription_purchase'|'pack'|'subscription_renewal'|null{
 if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded')return effectKind==='pack'?'pack':'subscription_purchase';
 if(event.type==='invoice.paid'&&event.object.billing_reason==='subscription_cycle')return 'subscription_renewal';
 return null;
}

function metadataOf(value:unknown):unknown{return value&&typeof value==='object'?(value as {metadata?:unknown}).metadata:undefined;}

// UTMs ride the checkout session's metadata; a renewal invoice reaches them
// through its subscription's metadata (subscription_details on older API
// versions, parent.subscription_details on newer ones).
function attributionFor(object:Record<string,unknown>):Attribution|undefined{
 const parent=object.parent as {subscription_details?:unknown}|null|undefined;
 // An invoice's own metadata exists but is normally empty: take the first
 // candidate that actually carries attribution.
 for(const source of [metadataOf(object),metadataOf(object.subscription_details),metadataOf(parent?.subscription_details)]){
  const attribution=cleanAttribution(source);
  if(Object.keys(attribution).length)return attribution;
 }
 return undefined;
}

function valueFor(object:Record<string,unknown>,field:'amount_total'|'amount_paid'){
 const amount=object[field],currency=typeof object.currency==='string'?object.currency.trim().toUpperCase():'';
 return typeof amount==='number'&&Number.isInteger(amount)&&amount>=0&&/^[A-Z]{3}$/.test(currency)?{amount_minor:amount,currency}:undefined;
}

// Builds the single-event batch. Only whitelisted fields are copied out of the
// Stripe object; nothing else can leak into the payload.
export function growthPayload(event:GrowthWebhookEvent,step:GrowthMoneyStep,now=new Date()):GrowthPayloadEvent[]{
 const value=valueFor(event.object,event.type==='invoice.paid'?'amount_paid':'amount_total');
 const attribution=attributionFor(event.object);
 const occurred=typeof event.created==='number'&&Number.isFinite(event.created)?new Date(event.created*1000):now;
 return [{event_id:event.id,client:GROWTH_CLIENT_ID,stage:step,step,occurred_at:occurred.toISOString(),...(value?{value}:{}),...(attribution?{attribution}:{}),source:'webhook'}];
}

function logFailure(eventId:string,reason:string,status?:number){
 console.error(JSON.stringify({event:'growth_ingest_failed',stripe_event:eventId,reason,...(status!==undefined?{status}:{})}));
}

// Packs already granted to this owner other than this session's. The owner id
// is used for this lookup only and never enters the payload.
async function otherPackGrants(env:Bindings,ownerId:string,sessionId:string):Promise<number>{
 const rows=await db(env,`storypress_pack_grants?owner_id=eq.${encodeURIComponent(ownerId)}&select=checkout_session_id`) as {checkout_session_id?:unknown}[]|null;
 return Array.isArray(rows)?rows.filter(row=>row?.checkout_session_id!==sessionId).length:0;
}

async function deliver(env:Bindings,target:{url:string;secret:string},event:GrowthWebhookEvent,effectKind:'entitlement'|'pack',ownerId:string){
 const kind=growthStepFor(event,effectKind);
 if(!kind)return;
 let step:GrowthMoneyStep;
 if(kind==='pack'){
  const sessionId=typeof event.object.id==='string'?event.object.id:'';
  step=(await otherPackGrants(env,ownerId,sessionId))>0?'renewal':'purchase';
 }else step=kind==='subscription_renewal'?'renewal':'purchase';
 const body=JSON.stringify(growthPayload(event,step));
 const response=await fetch(target.url,{method:'POST',headers:{'Content-Type':'application/json',[GROWTH_SIGNATURE_HEADER]:await growthSignature(target.secret,body)},body,signal:AbortSignal.timeout(GROWTH_TIMEOUT_MS)});
 if(!response.ok)logFailure(event.id,'engine_refused',response.status);
}

// Never throws and never waits longer than GROWTH_BUDGET_MS. Serverless
// runtimes may freeze work left running after the response, so the webhook
// gives the send a short, bounded wait instead of abandoning it outright.
export async function reportGrowthEvent(env:Bindings,event:GrowthWebhookEvent,effectKind:'entitlement'|'pack',ownerId:string):Promise<void>{
 const target=growthIngest(env);
 if(!target)return;
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const work=deliver(env,target,event,effectKind,ownerId).catch(error=>logFailure(event.id,error instanceof Error&&error.name==='TimeoutError'?'timeout':'unreachable'));
  await Promise.race([work,new Promise<void>(resolve=>{timer=setTimeout(()=>{logFailure(event.id,'budget_exceeded');resolve();},GROWTH_BUDGET_MS);})]);
 }catch{/* unreachable: work never rejects */}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
