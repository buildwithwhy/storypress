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
 // bundle targets platform:'browser'.
 const form=new URLSearchParams({mode,'line_items[0][price]':priceFor(env,mode,plan),'line_items[0][quantity]':'1',success_url:origin+'/',cancel_url:origin+'/',client_reference_id:userId,'metadata[userId]':userId});
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
