import {useState} from 'react';
import {paywallCopy} from '../lib/paywall-copy';
import {startCheckout,type CheckoutPlan} from '../lib/billing-client';
import {annualSavePercent,formatPrice,type BillingStatus,type Pricing} from '../lib/billing';
import {type Story} from '../lib/story';

// The dedicated pricing surface (wave 6 §3, reworked wave 8 §3):
// presentational and props-driven. While billing is configured, every amount
// comes from the server's Stripe-cached pricing payload; when that payload is
// unavailable the page hides amounts and pay buttons rather than inventing
// numbers. While dormant, the labeled fallback copy in paywallCopy shows and
// every pay button stays hidden. Monthly and annual fold into an aria-pressed
// cadence selection whose single CTA pays the selected cadence; the two story
// packs are always-visible one-time cards ("one-time, never expire"). The
// saving badge and the {cap} allowance line are computed or interpolated from
// payload values — never literals, never translated numbers. Entitled owners
// (subscribers and legacy lifetime rows alike) see their plan state instead
// of checkout. No video add-on: there is no checkout mode or entitlement
// write for it.
export function PricingPanel({billing,pricing,language}:{billing:BillingStatus;pricing:Pricing|null;language:Story['language']}){
 const c=paywallCopy[language];
 const [cadence,setCadence]=useState<'monthly'|'annual'>('monthly');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function pay(plan:CheckoutPlan){setBusy(true);setError('');try{location.assign(await startCheckout(plan));}catch(problem){setError((problem as Error).message);setBusy(false);}}
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
 return <div className="pricing-panel">
  <section className="pricing-card">
   <h3>{c.freeName}</h3><p className="pricing-amount">{c.freePrice}</p>
   <ul className="pricing-includes">
    <li>{c.freeAllowance.replace('{limit}',String(billing.freeStoryLimit))}</li>
    <li>{c.limitBody}</li>
   </ul>
  </section>
  {free?<>
   <section className="pricing-card">
    <h3>{c.subscriptionName}</h3>
    <div className="upgrade-cadence pricing-cadence" role="group" aria-label={c.planHeading}>
     <button className={cadence==='monthly'?'secondary selected':'secondary'} aria-pressed={cadence==='monthly'} disabled={busy} onClick={()=>setCadence('monthly')}><span>{c.monthly}</span>{monthlyAmount&&<span className="pricing-amount">{monthlyAmount}</span>}</button>
     <button className={cadence==='annual'?'secondary selected':'secondary'} aria-pressed={cadence==='annual'} disabled={busy} onClick={()=>setCadence('annual')}><span>{c.annual}</span>{annualAmount&&<span className="pricing-amount">{annualAmount}</span>}{savePercent!=null&&<span className="pricing-badge">{c.saveBadge.replace('{percent}',String(savePercent))}</span>}</button>
    </div>
    <p className="pricing-note">{c.capAllowance.replace('{cap}',String(billing.subscriptionMonthlyCap))}</p>
    {canPay&&<div className="pricing-pay"><button className="primary" disabled={busy} onClick={()=>void pay(cadence)}>{c.checkout}</button>{busy&&<p className="quiet left" role="status">{c.checkoutBusy}</p>}</div>}
   </section>
   <section className="pricing-card">
    <h3>{c.packTitle.replace('{size}',String(billing.pack30Credits))}</h3>
    {pack30Amount&&<p className="pricing-amount">{pack30Amount}</p>}
    <p className="pricing-note">{c.packNote}</p>
    {canPay&&<button className="secondary" disabled={busy} onClick={()=>void pay('pack30')}>{c.packBuy.replace('{size}',String(billing.pack30Credits))}</button>}
   </section>
   <section className="pricing-card">
    <h3>{c.packTitle.replace('{size}',String(billing.pack100Credits))}</h3>
    {pack100Amount&&<p className="pricing-amount">{pack100Amount}</p>}
    <p className="pricing-note">{c.packNote}</p>
    {canPay&&<button className="secondary" disabled={busy} onClick={()=>void pay('pack100')}>{c.packBuy.replace('{size}',String(billing.pack100Credits))}</button>}
   </section>
  </>:<p className="upgrade-plan" role="status">{c.entitledActive}</p>}
  {dormant&&<p className="quiet left">{c.dormant}</p>}
  {!dormant&&!pricing&&<p className="quiet left" role="status">{c.pricesUnavailable}</p>}
  {error&&<p className="quiet left" role="alert">{error}</p>}
 </div>;
}
