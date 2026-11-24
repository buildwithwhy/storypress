import {type CheckoutPlan} from './billing-client';

// The chosen plan travels with the buyer (purchase sheet §D2): a single
// localStorage entry, overwritten on each new selection, read on the Google
// sign-in return to /pricing (the sheet reopens at the consent step) and on
// the post-Stripe return (§D6, the confirmation names what was bought). The
// stored intent is a client HINT, never proof — no entitlement is granted or
// denied from it; the server verifies every payment exactly as before.
const PENDING_PURCHASE_KEY='storypress_pending_purchase';
const PENDING_PURCHASE_TTL_MS=24*60*60*1000;
export const PENDING_PURCHASE_TTL=PENDING_PURCHASE_TTL_MS;
export interface PendingPurchase{plan:CheckoutPlan;at:number}
// Storage and clock are injected: pure enough to assert without a browser,
// and the Node check scripts have neither localStorage nor a real clock.
export function storePendingPurchase(storage:Storage,plan:CheckoutPlan,now:number):void{
 try{storage.setItem(PENDING_PURCHASE_KEY,JSON.stringify({plan,at:now}));}
 catch{/* localStorage can refuse (private mode, quota) — the intent is a
   convenience hint, so a failed write only means no plan memory: the generic
   banner and the plain signed-in sheet still work. Nothing to surface. */}
}
export function readPendingPurchase(storage:Storage,now:number):PendingPurchase|null{
 try{
  const raw=storage.getItem(PENDING_PURCHASE_KEY);
  if(!raw)return null;
  const parsed=JSON.parse(raw) as {plan?:unknown;at?:unknown};
  const plan=parsed.plan,at=parsed.at;
  if(plan!=='monthly'&&plan!=='annual'&&plan!=='pack30'&&plan!=='pack100')return null;
  if(typeof at!=='number'||!Number.isFinite(at))return null;
  if(now-at>PENDING_PURCHASE_TTL_MS||now<at)return null;
  return {plan,at};
 }catch{return null;}
}
export function clearPendingPurchase(storage:Storage):void{
 try{storage.removeItem(PENDING_PURCHASE_KEY);}catch{/* as above — a hint, not a record */}
}
// The Google redirect comes back to the page the buyer (or visitor) started
// from — the /pricing precedent generalized (founder UX round): the sign-in
// entries on /stories and /billing pass their own path so the round trip
// lands on the same page, and /pricing keeps reopening the sheet.
export function pageReturnTo(origin:string,path:string):string{
 return `${origin}${path}`;
}
