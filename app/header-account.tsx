import {useEffect,useRef,useState} from 'react';
import {purchaseCopy} from '../lib/purchase-copy';
import {sharingCopy} from '../lib/sharing-copy';
import {type Story} from '../lib/story';

// The header's account entry (founder UX round): signed out, a quiet Sign in
// text link; signed in, a small round avatar with the account's initial — no
// "Account" label, "My stories" lives beside it as a top-level header entry —
// opening a menu with the email (muted), Plan and billing, and Sign out. A
// native details/summary popover, matching the sheet-modal language of the
// rest of the app; each selection closes the menu first.
export function HeaderAccount({language,signedIn,email,onSignIn,onPlanAndBilling,onSignOut}:{language:Story['language'];signedIn:boolean;email?:string;onSignIn?:()=>void;onPlanAndBilling:()=>void;onSignOut:()=>void;}){
 const pc=purchaseCopy[language];
 const c=sharingCopy[language];
 const menu=useRef<HTMLDetailsElement>(null);
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  const el=menu.current;
  if(!el)return;
  const sync=()=>setOpen(el.open);
  el.addEventListener('toggle',sync);
  return()=>el.removeEventListener('toggle',sync);
 },[]);
 function close(){menu.current?.removeAttribute('open');}
 if(!signedIn)return onSignIn?<button type="button" className="text-button sign-in" onClick={onSignIn}>{pc.signIn}</button>:null;
 const initial=email?.trim()?.[0]?.toUpperCase()||'✳';
 return <details className="account-menu" ref={menu}>
  <summary className="account-avatar" aria-label={c.accountMenuHint} aria-haspopup="menu" aria-expanded={open}><span className="account-avatar-initial" aria-hidden={true}>{initial}</span></summary>
  <div className="account-menu-items">
   {email&&<p className="account-menu-email">{email}</p>}
   <button type="button" onClick={()=>{close();onPlanAndBilling();}}>{pc.planAndBilling}</button>
   <button type="button" onClick={()=>{close();onSignOut();}}>{c.logout}</button>
  </div>
 </details>;
}
