import {useState} from 'react';
import {X} from 'lucide-react';
import {type CheckoutPlan,startCheckout} from '../lib/billing-client';
import {signInWithGoogle} from '../lib/account-client';
import {purchaseCopy} from '../lib/purchase-copy';
import {legalCopy} from '../lib/legal-copy';
import {paywallCopy} from '../lib/paywall-copy';
import {sharingCopy} from '../lib/sharing-copy';
import {storePendingPurchase,clearPendingPurchase,pricingReturnTo} from '../lib/purchase-intent';
import {EmailSignIn} from './email-sign-in';
import {type Story} from '../lib/story';

// The purchase sheet (§D1): every paid option opens here instead of jumping
// straight to Stripe, so a signed-out buyer is offered sign-in first and the
// consent acknowledgement lives above the checkout CTA. A small state machine
// with no dead ends: signed out → sign-in step; signed in (or right after the
// email-code sign-in, which never leaves the page) → consent step → Stripe.
// The same modal pattern as the account modal (modal-backdrop + dialog,
// backdrop-click close, X icon-button); no new auth code — the Google button
// and the email-code flow are the existing ones under pricing-context copy.
export function PurchaseSheet({language,plan,planLabel,amount,signedIn,consented,onConsent,onClose,onPrepareSignIn}:{language:Story['language'];plan:CheckoutPlan;planLabel:string;amount:string|null;signedIn:boolean;consented:boolean;onConsent:(consented:boolean)=>void;onClose:()=>void;onPrepareSignIn:(email?:string)=>()=>void;}){
 const c=purchaseCopy[language];
 const l=legalCopy[language];
 const pw=paywallCopy[language];
 const [authPending,setAuthPending]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 // §D2: the chosen plan is stored before the Google redirect so the return
 // to /pricing reopens the sheet at the consent step. The draft handoff
 // (onPrepareSignIn) snapshots the story words exactly as the account modal's
 // Google button does.
 async function googleSignIn(){
  const cancelHandoff=onPrepareSignIn();
  storePendingPurchase(localStorage,plan,Date.now());
  try{await signInWithGoogle(pricingReturnTo(location.origin));}
  catch(problem){cancelHandoff();clearPendingPurchase(localStorage);throw problem;}
 }
 async function checkout(){
  setBusy(true);setError('');
  storePendingPurchase(localStorage,plan,Date.now());
  try{location.assign(await startCheckout(plan,language));}
  catch(problem){setError((problem as Error).message);setBusy(false);}
 }
 return <div className="modal-backdrop purchase-backdrop no-print" onClick={onClose}>
  <section className="modal purchase-sheet" role="dialog" aria-modal="true" aria-label={c.sheetTitle} onClick={e=>e.stopPropagation()}>
   <button className="icon-button close" onClick={onClose} aria-label={sharingCopy[language].close}><X size={21}/></button>
   <p className="eyebrow"><span/>Once &amp; Ours</p>
   <h2>{c.sheetTitle}</h2>
   <p className="purchase-plan-line"><strong>{planLabel}</strong>{amount&&<span className="pricing-amount">{amount}</span>}</p>
   {!signedIn?<>
    <p className="account-note">{c.purchaseSignInHelp}</p>
    <p className="account-note">{c.accountMadeForYou}</p>
    <button type="button" className="secondary wide google-sign-in" disabled={authPending} onClick={()=>void googleSignIn().catch(problem=>setError((problem as Error).message))}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>{sharingCopy[language].googleLogin}</button>
    <EmailSignIn language={language} disabled={authPending} onPrepareSignIn={onPrepareSignIn} onPending={setAuthPending}/>
   </>:<>
    {/* §D1 step 2: the consent acknowledgement moves in here — the only
        consent checkbox in the buy path, and the unticked box disables only
        this CTA. Nothing on the page behind the sheet is ever gated. */}
    <label className="pricing-consent checkbox">
     <input type="checkbox" checked={consented} onChange={e=>onConsent(e.target.checked)}/>
     {l.checkoutConsentLabel}
    </label>
    <div className="sharing-actions"><button className="primary" disabled={!consented||busy} onClick={()=>void checkout()}>{c.continueToSecureCheckout}</button></div>
    {busy&&<p className="quiet left" role="status">{pw.checkoutBusy}</p>}
   </>}
   {error&&<p className="quiet left" role="alert">{error}</p>}
  </section>
 </div>;
}
