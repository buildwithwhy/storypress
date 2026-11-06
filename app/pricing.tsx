import {useState} from 'react';
import {paywallCopy} from '../lib/paywall-copy';
import {startCheckout} from '../lib/billing-client';
import {type BillingStatus} from '../lib/billing';
import {type Story} from '../lib/story';

// The dedicated pricing surface (wave 6 §3): presentational and props-driven.
// Amounts live in paywallCopy — never fetched — so the page renders fully in a
// dormant deployment, where the honest dormant line replaces every pay button
// (mirroring UpgradePanel). The monthly/annual pair folds the account modal's
// cadence toggle into the page as an aria-pressed selection; the single
// subscription CTA pays the selected cadence, and lifetime stays its own
// one-payment option. Entitled owners see their plan state instead of checkout.
// No video add-on: there is no checkout mode or entitlement write for it.
export function PricingPanel({billing,language}:{billing:BillingStatus;language:Story['language']}){
 const c=paywallCopy[language];
 const [cadence,setCadence]=useState<'monthly'|'annual'>('monthly');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function pay(plan:'monthly'|'annual'|'lifetime'){setBusy(true);setError('');try{location.assign(await startCheckout(plan));}catch(problem){setError((problem as Error).message);setBusy(false);}}
 const canPay=billing.configured&&billing.plan==='free';
 return <div className="pricing-panel">
  <section className="pricing-card">
   <h3>{c.freeName}</h3><p className="pricing-amount">{c.freePrice}</p>
   <ul className="pricing-includes">
    <li>{c.freeAllowance.replace('{limit}',String(billing.freeStoryLimit))}</li>
    <li>{c.limitBody}</li>
   </ul>
  </section>
  {billing.plan==='free'?<>
   <div className="upgrade-cadence pricing-cadence" role="group" aria-label={c.planHeading}>
    <button className={cadence==='monthly'?'secondary selected':'secondary'} aria-pressed={cadence==='monthly'} disabled={busy} onClick={()=>setCadence('monthly')}><span>{c.monthly}</span><span className="pricing-amount">{c.priceMonthly}</span></button>
    <button className={cadence==='annual'?'secondary selected':'secondary'} aria-pressed={cadence==='annual'} disabled={busy} onClick={()=>setCadence('annual')}><span>{c.annual}</span><span className="pricing-amount">{c.priceAnnual}</span></button>
   </div>
   {canPay&&<div className="pricing-pay"><button className="primary" disabled={busy} onClick={()=>void pay(cadence)}>{c.checkout}</button>{busy&&<p className="quiet left" role="status">{c.checkoutBusy}</p>}</div>}
   <section className="pricing-card">
    <h3>{c.lifetimeName}</h3><p className="pricing-amount">{c.priceLifetime}</p><p className="pricing-note">{c.lifetimeNote}</p>
    {canPay&&<button className="secondary" disabled={busy} onClick={()=>void pay('lifetime')}>{c.lifetime}</button>}
   </section>
  </>:<p className="upgrade-plan" role="status">{billing.plan==='subscription'?c.subscriptionActive:c.lifetimeActive}</p>}
  {!billing.configured&&<p className="quiet left">{c.dormant}</p>}
  {error&&<p className="quiet left" role="alert">{error}</p>}
 </div>;
}
