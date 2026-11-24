import {useState} from 'react';
import {type Story} from '../lib/story';
import {type BillingStatus,type Pricing} from '../lib/billing';
import {type CheckoutPlan as Plan,startBillingPortal} from '../lib/billing-client';
import {planLabel,planAmount} from '../lib/plan-amounts';
import {paywallCopy} from '../lib/paywall-copy';
import {sharingCopy} from '../lib/sharing-copy';
import {legalCopy,supportEmail} from '../lib/legal-copy';
import {accountPagesCopy} from '../lib/account-pages-copy';
import {PurchaseSheet} from './purchase-sheet';

// The Plan and billing page (/billing, founder UX round): designed as a page,
// not a lifted panel. Six sections — plan, stories left, get more, daily AI
// allowance, account, help. Purchase history is deliberately absent: the
// billing payload has no history yet (PR #81 parked), so nothing renders —
// no placeholder, no empty state. Renewal/end dates are likewise omitted
// honestly: the payload carries no cadence or period end to read.
export function BillingPage({billing,pricing,language,email,returnTo,onSignOut,onOpenLegal,onPrepareSignIn}:{billing:BillingStatus;pricing:Pricing|null;language:Story['language'];email?:string;returnTo:string;onSignOut:()=>void;onOpenLegal:(page:'terms'|'privacy'|'refunds')=>void;onPrepareSignIn:(email?:string)=>()=>void;}){
 const c=paywallCopy[language];
 const p=accountPagesCopy[language];
 const l=legalCopy[language];
 const sh=sharingCopy[language];
 const [cadence,setCadence]=useState<'monthly'|'annual'>('monthly');
 const [sheetPlan,setSheetPlan]=useState<Plan|null>(null);
 const [consented,setConsented]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const free=billing.plan==='free';
 const dormant=!billing.configured;
 const canPay=!dormant&&free&&!!pricing;
 const sheetAmount=(plan:Plan):string|null=>pricing?planAmount(pricing,plan):null;
 async function manage(){
  setBusy(true);setError('');
  try{location.assign(await startBillingPortal());}
  catch(problem){setError((problem as Error).message);setBusy(false);}
 }
 return <section className="billing-page" aria-label={sh.account}>
  <h1>{c.planHeading}</h1>
  <section className="billing-section">
   <h2>{c.planHeading}</h2>
   <p className="upgrade-plan" role="status">{free?c.freeName:c.subscriptionName}</p>
   {!free&&<button type="button" className="secondary manage-billing" disabled={busy} onClick={()=>void manage()}>{c.manageBilling}</button>}
  </section>
  <section className="billing-section">
   <h2>{p.storiesLeftHeading}</h2>
   {free
    ?<p className="upgrade-plan" role="status">{c.freeUsage.replace('{used}',String(billing.storiesCreated)).replace('{limit}',String(billing.freeStoryLimit))}</p>
    :<p className="upgrade-plan" role="status">{c.monthlyUsage.replace('{used}',String(billing.subscriptionStoriesThisMonth)).replace('{cap}',String(billing.subscriptionMonthlyCap))}</p>}
   {billing.packCreditsRemaining>0&&<p className="upgrade-plan upgrade-usage" role="status">{c.packCredits.replace('{size}',String(billing.packCreditsRemaining))}</p>}
  </section>
  {free&&<section className="billing-section">
   <h2>{p.getMore}</h2>
   {canPay&&<>
    <div className="upgrade-cadence" role="group" aria-label={c.planHeading}>
     <button type="button" className={cadence==='monthly'?'upgrade-cadence-option is-active':'upgrade-cadence-option'} onClick={()=>setCadence('monthly')}>{c.monthly} · {planAmount(pricing!,'monthly')}</button>
     <button type="button" className={cadence==='annual'?'upgrade-cadence-option is-active':'upgrade-cadence-option'} onClick={()=>setCadence('annual')}>{c.annual} · {planAmount(pricing!,'annual')}</button>
    </div>
    <div className="sharing-actions">
     <button type="button" className="primary" onClick={()=>{setConsented(false);setSheetPlan(cadence);}}>{c.checkout}</button>
    </div>
    <div className="pack-options">
     <button type="button" className="secondary" onClick={()=>{setConsented(false);setSheetPlan('pack30');}}>{c.packBuy.replace('{size}',String(billing.pack30Credits))}</button>
     <button type="button" className="secondary" onClick={()=>{setConsented(false);setSheetPlan('pack100');}}>{c.packBuy.replace('{size}',String(billing.pack100Credits))}</button>
    </div>
   </>}
   {dormant&&<p className="quiet left">{c.dormant}</p>}
   {!dormant&&!pricing&&<p className="quiet left" role="status">{c.pricesUnavailable}</p>}
  </section>}
  <section className="billing-section">
   <h2>{p.allowanceHeading}</h2>
   <p className="quiet left">{sh.allowance}</p>
  </section>
  <section className="billing-section">
   <h2>{p.accountHeading}</h2>
   {email&&<p className="account-email">{email}</p>}
   <button type="button" className="text-button" onClick={onSignOut}>{sh.logout}</button>
   <p className="quiet left">{p.deleteAccount.replace('{email}',supportEmail)}</p>
  </section>
  <section className="billing-section">
   <h2>{p.helpHeading}</h2>
   <p className="quiet left">{p.helpBlurb} <a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>
   <div className="billing-legal-links">
    {(['terms','privacy','refunds'] as const).map(page=><button type="button" key={page} className="text-button" onClick={()=>onOpenLegal(page)}>{l.links[page]}</button>)}
   </div>
  </section>
  {error&&<p className="quiet left" role="alert">{error}</p>}
  {sheetPlan&&<PurchaseSheet language={language} plan={sheetPlan} planLabel={planLabel(language,billing,sheetPlan)} amount={sheetAmount(sheetPlan)} signedIn={true} consented={consented} onConsent={setConsented} onClose={()=>{setSheetPlan(null);setConsented(false);}} onPrepareSignIn={onPrepareSignIn} returnTo={returnTo}/>}
 </section>;
}
