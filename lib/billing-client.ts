import {billingStatusSchema,type BillingStatus} from './billing';
import {accountHeaders} from './account-client';

// Wave 8: the two subscriptions plus the two one-time story packs. 'lifetime'
// is gone from the checkout surface entirely (its archived Stripe product stays
// archived; legacy entitlement ROWS still read as entitled through the billing
// status schema).
export type CheckoutPlan='monthly'|'annual'|'pack30'|'pack100';

// POSTs to the same-origin billing API with the owner's identity headers —
// no external host ever enters the client bundle (the check-client-hosts
// allowlist holds). Typed refusals carry the API error code, mirroring
// accountRequest.
async function billingRequest<T>(body:unknown):Promise<T>{
 const response=await fetch('/api/billing',{method:'POST',headers:{'Content-Type':'application/json',...await accountHeaders()},body:JSON.stringify(body)});
 const data=await response.json() as {error?:string;code?:string};
 if(!response.ok)throw Object.assign(new Error(data.error||'That step did not finish. Please try again.'),{code:data.code});
 return data as T;
}

// The checkout return lands on `/?billing_checkout=<session id>` — the mirror
// of the email sign-in return (location.origin + '/'). Stripe session ids are
// cs_test_/cs_live_ plus base62; the shape is checked before the id is ever
// sent back for server-side verification (the server re-verifies regardless).
export function checkoutReturnId(search:string):string|undefined{
 const id=new URLSearchParams(search).get('billing_checkout');
 return id&&/^cs_(?:test|live)_[A-Za-z0-9]{8,}$/.test(id)?id:undefined;
}

// Opens Stripe checkout and returns the session URL; the component navigates.
// Dormant deployments refuse from the server (503) and the panel says so.
export async function startCheckout(plan:CheckoutPlan):Promise<string>{
 return (await billingRequest<{url:string}>({action:'checkout',mode:plan==='monthly'||plan==='annual'?'subscription':'payment',plan})).url;
}

// Webhook-lag rescue (paywall §5): the session is verified SERVER-side before
// any entitlement change — the browser's report of success is never trusted.
// While a webhook may still be in flight a stale billing block reads as
// pending, never as a payment failure.
export async function confirmCheckout(sessionId:string):Promise<BillingStatus>{
 const data=await billingRequest<{billing:unknown}>({action:'status',sessionId});
 return billingStatusSchema.parse(data.billing);
}
