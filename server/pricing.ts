import {z} from 'zod';
import {pricingSchema,type Pricing} from '../lib/billing';
import type {Bindings} from './storage';

// Wave 8 §3 — the pricing payload the server vouches for. The /pricing page
// must never show a number nobody stands behind: while billing is configured
// the four option amounts come from the Stripe price objects themselves
// (minor units + currency), fetched here and cached in module scope for a few
// minutes so each server instance hits Stripe at most once per TTL window.
// Dormancy is handled by the caller (the payload only asks when
// billingConfigured), so this module assumes a secret key exists.
//
// Failure discipline (the drift hazard is the point of this module):
// - a fresh cache answers without touching Stripe;
// - a failed refetch serves the last good cache, however stale;
// - with no cache at all the payload is null and the UI hides amounts rather
//   than inventing them.
// Missing price-ID env vars are a configuration hole, not a fetch failure:
// an unpriced option must never render a number, so the payload is null
// (checkout would 503 for that option anyway).

const STRIPE_API='https://api.stripe.com';
const PRICE_TTL_MS=5*60_000;

const stripePriceShape=z.object({currency:z.string().trim().length(3),unit_amount:z.number().int().min(0).nullable().optional()});

type Cache={pricing:Pricing;fetchedAt:number}|null;
let cache:Cache=null;

async function fetchPrice(env:Bindings,slot:'monthly'|'annual'|'pack30'|'pack100',priceId:string){
 const response=await fetch(`${STRIPE_API}/v1/prices/${encodeURIComponent(priceId)}`,{headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY!}`},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`price ${slot} HTTP ${response.status}`);
 const parsed=stripePriceShape.safeParse(await response.json().catch(()=>null));
 if(!parsed.success||parsed.data.unit_amount==null)throw new Error(`price ${slot} unusable shape`);
 return parsed.data;
}

export async function stripePricing(env:Bindings):Promise<Pricing|null>{
 if(!env.STRIPE_SECRET_KEY?.trim())return null;
 const ids={monthly:env.STRIPE_PRICE_SUBSCRIPTION_MONTHLY?.trim()||'',annual:env.STRIPE_PRICE_SUBSCRIPTION_ANNUAL?.trim()||'',pack30:env.STRIPE_PRICE_PACK_30?.trim()||'',pack100:env.STRIPE_PRICE_PACK_100?.trim()||''};
 if(!ids.monthly||!ids.annual||!ids.pack30||!ids.pack100)return null;
 if(cache&&Date.now()-cache.fetchedAt<PRICE_TTL_MS)return cache.pricing;
 try{
  const [monthly,annual,pack30,pack100]=await Promise.all([
   fetchPrice(env,'monthly',ids.monthly),
   fetchPrice(env,'annual',ids.annual),
   fetchPrice(env,'pack30',ids.pack30),
   fetchPrice(env,'pack100',ids.pack100)
  ]);
  const pricing=pricingSchema.parse({
   currency:monthly.currency,
   monthly:{amount:monthly.unit_amount!},
   annual:{amount:annual.unit_amount!},
   pack30:{amount:pack30.unit_amount!},
   pack100:{amount:pack100.unit_amount!}
  });
  cache={pricing,fetchedAt:Date.now()};
  return pricing;
 }catch(error){
  // Refusals and malformed answers hide amounts instead of freezing stale
  // copy in; the last good cache still serves while Stripe is down.
  console.error(JSON.stringify({event:'stripe_price_fetch_failed',message:error instanceof Error?error.message:String(error)}));
  return cache?.pricing??null;
 }
}
