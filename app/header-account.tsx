import {useRef} from 'react';
import {ChevronDown} from 'lucide-react';
import {purchaseCopy} from '../lib/purchase-copy';
import {sharingCopy} from '../lib/sharing-copy';
import {type Story} from '../lib/story';

// The header's account entry (§D3, revision A; follow-up): signed out, a
// Sign in button beside "New story"; signed in, an "Account" trigger with a
// chevron so it reads as a menu, with the three destinations — "My stories"
// first, then the plan and billing view, then sign-out. A native
// details/summary popover, matching the sheet-modal language of the rest of
// the app; each selection closes the menu first.
export function HeaderAccount({language,signedIn,onSignIn,onAccount,onPlanAndBilling,onSignOut}:{language:Story['language'];signedIn:boolean;onSignIn?:()=>void;onAccount:()=>void;onPlanAndBilling:()=>void;onSignOut:()=>void;}){
 const c=sharingCopy[language];
 const pc=purchaseCopy[language];
 const menu=useRef<HTMLDetailsElement>(null);
 function close(){menu.current?.removeAttribute('open');}
 if(!signedIn)return onSignIn?<button type="button" className="text-button sign-in" onClick={onSignIn}>{pc.signIn}</button>:null;
 return <details className="account-menu" ref={menu}>
  <summary className="text-button account-nav" aria-label={c.accountMenuHint}>{c.accountMenu}<ChevronDown size={14} aria-hidden={true}/></summary>
  <div className="account-menu-items">
   <button type="button" onClick={()=>{close();onAccount();}}>{c.account}</button>
   <button type="button" onClick={()=>{close();onPlanAndBilling();}}>{pc.planAndBilling}</button>
   <button type="button" onClick={()=>{close();onSignOut();}}>{c.logout}</button>
  </div>
 </details>;
}
