import {useEffect,useState} from 'react';
import {paywallCopy} from '../lib/paywall-copy';
import {purchaseCopy} from '../lib/purchase-copy';
import {legalCopy} from '../lib/legal-copy';
import {type CheckoutPlan} from '../lib/billing-client';
import {annualSavePercent,formatPrice,type BillingStatus,type Pricing} from '../lib/billing';
import {readPendingPurchase,clearPendingPurchase} from '../lib/purchase-intent';
import {PurchaseSheet} from './purchase-sheet';
import {type Story} from '../lib/story';

// The dedicated pricing surface (wave 6 §3, reworked wave 8 §3, purchase
// sheet §D1/D5): presentational and props-driven. While billing is
// configured, every amount comes from the server's Stripe-cached pricing
// payload; when that payload is unavailable the page hides amounts and pay
// buttons rather than inventing numbers. While dormant, the labeled fallback
// copy in paywallCopy shows and every pay button stays hidden. Monthly and
// annual fold into an aria-pressed cadence selection; the two story packs are
// always-visible one-time cards ("one-time, never expire"). Every paid
// option opens the purchase sheet — no plan card, buy button, or cadence
// toggle is ever disabled by consent or signed-out state; consent lives only
// inside the sheet. A signed-in visitor sees their current plan and credits
// at the top (§D5), and the Free card carries a start-a-free-story CTA. No
// video add-on: there is no checkout mode or entitlement write for it.
export function PricingPanel({billing,pricing,language,signedIn=false,onPrepareSignIn=()=>()=>{},onStartFreeStory,initialSheet=null}:{billing:BillingStatus;pricing:Pricing|null;language:Story['language'];signedIn?:boolean;onPrepareSignIn?:(email?:string)=>()=>void;onStartFreeStory?:()=>void;initialSheet?:CheckoutPlan|null;}){
 const c=paywallCopy[language];
 const pc=purchaseCopy[language];
 const [cadence,setCadence]=useState<'monthly'|'annual'>('monthly');
 const [sheetPlan,setSheetPlan]=useState<CheckoutPlan|null>(initialSheet);
 const [consented,setConsented]=useState(false);
 // §D2: a fresh pending purchase (stored before the Google redirect) reopens
 // the sheet at the consent step with the chosen plan remembered. Runs when
 // sign-in resolves — including the return-to-/pricing boot. A closed sheet
 // clears the hint; only the post-Stripe confirmation consumes it otherwise.
 useEffect(()=>{
  if(!signedIn)return;
  const storage=globalThis.localStorage;
  if(!storage)return;
  const pending=readPendingPurchase(storage,Date.now());
  if(pending){setSheetPlan(pending.plan);setConsented(false);}
 },[signedIn]);
 function closeSheet(){setSheetPlan(null);setConsented(false);const storage=globalThis.localStorage;if(storage)clearPendingPurchase(storage);}
 const dormant=!billing.configured;
 const free=billing.plan==='free';
 const canPay=!dormant&&free&&!!pricing;
 const savePercent=pricing?annualSavePercent(pricing.monthly.amount,pricing.annual.amount):null;
 // Amount resolution: Stripe payload when configured; dormant fallback copy
 // when dormant; nothing (hide) when configured but the payload is
 // unavailable — that third state is the drift-hazard guard.
 const amountFor=(fromPayload:()=>string,fallbackCopy:string):string|null=>pricing?fromPayload():dormant?fallbackCopy:null;
 const monthlyAmount=amountFor(()=>formatPrice(pricing!.monthly.amount,pricing!.currency),c.priceMonthly);
 const annualAmount=amountFor(()=>formatPrice(pricing!.annual.amount,pricing!.currency),c.priceAnnual);
 const pack30Amount=amountFor(()=>formatPrice(pricing!.pack30.amount,pricing!.currency),c.pricePack30);
 const pack100Amount=amountFor(()=>formatPrice(pricing!.pack100.amount,pricing!.currency),c.pricePack100);
 const planLabel=(plan:CheckoutPlan):string=>plan==='monthly'?c.monthly:plan==='annual'?c.annual:c.packTitle.replace('{size}',String(plan==='pack30'?billing.pack30Credits:billing.pack100Credits));
 const planAmount=(plan:CheckoutPlan):string|null=>plan==='monthly'?monthlyAmount:plan==='annual'?annualAmount:plan==='pack30'?pack30Amount:pack100Amount;
 return <div className="pricing-panel">
  {/* §D5: the plan/credits line, from data the panel already receives. An
      entitled owner always sees their plan state; the usage detail lines need
      a signed-in account. */}
  {(!free||signedIn)&&<div className="pricing-usage" role="status">
   <p className="upgrade-plan">{free?c.freeUsage.replace('{used}',String(billing.storiesCreated)).replace('{limit}',String(billing.freeStoryLimit)):c.entitledActive}</p>
   {signedIn&&!free&&<p className="upgrade-plan upgrade-usage">{c.monthlyUsage.replace('{used}',String(billing.subscriptionStoriesThisMonth)).replace('{cap}',String(billing.subscriptionMonthlyCap))}</p>}
   {signedIn&&billing.packCreditsRemaining>0&&<p className="upgrade-plan upgrade-usage">{c.packCredits.replace('{size}',String(billing.packCreditsRemaining))}</p>}
  </div>}
  <section className="pricing-card">
   <h3>{c.freeName}</h3><p className="pricing-amount">{c.freePrice}</p>
   <ul className="pricing-includes">
    <li>{c.freeAllowance.replace('{limit}',String(billing.freeStoryLimit))}</li>
    <li>{c.limitBody}</li>
   </ul>
   {onStartFreeStory&&<button className="secondary start-free-story" onClick={onStartFreeStory}>{pc.startFreeStory}</button>}
  </section>
  {free?<>
   <section className="pricing-card">
    <h3>{c.subscriptionName}</h3>
    <div className="upgrade-cadence pricing-cadence" role="group" aria-label={c.planHeading}>
     <button className={cadence==='monthly'?'secondary selected':'secondary'} aria-pressed={cadence==='monthly'} onClick={()=>setCadence('monthly')}><span>{c.monthly}</span>{monthlyAmount&&<span className="pricing-amount">{monthlyAmount}</span>}</button>
     <button className={cadence==='annual'?'secondary selected':'secondary'} aria-pressed={cadence==='annual'} onClick={()=>setCadence('annual')}><span>{c.annual}</span>{annualAmount&&<span className="pricing-amount">{annualAmount}</span>}{savePercent!=null&&<span className="pricing-badge">{c.saveBadge.replace('{percent}',String(savePercent))}</span>}</button>
    </div>
    <p className="pricing-note">{c.capAllowance.replace('{cap}',String(billing.subscriptionMonthlyCap))}</p>
    {canPay&&<div className="pricing-pay"><button className="primary" onClick={()=>{setConsented(false);setSheetPlan(cadence);}}>{c.checkout}</button></div>}
   </section>
   <section className="pricing-card">
    <h3>{c.packTitle.replace('{size}',String(billing.pack30Credits))}</h3>
    {pack30Amount&&<p className="pricing-amount">{pack30Amount}</p>}
    <p className="pricing-note">{c.packNote}</p>
    {canPay&&<button className="secondary" onClick={()=>{setConsented(false);setSheetPlan('pack30');}}>{c.packBuy.replace('{size}',String(billing.pack30Credits))}</button>}
   </section>
   <section className="pricing-card">
    <h3>{c.packTitle.replace('{size}',String(billing.pack100Credits))}</h3>
    {pack100Amount&&<p className="pricing-amount">{pack100Amount}</p>}
    <p className="pricing-note">{c.packNote}</p>
    {canPay&&<button className="secondary" onClick={()=>{setConsented(false);setSheetPlan('pack100');}}>{c.packBuy.replace('{size}',String(billing.pack100Credits))}</button>}
   </section>
  </>:null}
  {dormant&&<p className="quiet left">{c.dormant}</p>}
  {!dormant&&!pricing&&<p className="quiet left" role="status">{c.pricesUnavailable}</p>}
  {sheetPlan&&<PurchaseSheet language={language} plan={sheetPlan} planLabel={planLabel(sheetPlan)} amount={planAmount(sheetPlan)} signedIn={signedIn} consented={consented} onConsent={setConsented} onClose={closeSheet} onPrepareSignIn={onPrepareSignIn}/>}
 </div>;
}
