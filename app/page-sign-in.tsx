import {useState} from 'react';
import {signInWithGoogle} from '../lib/account-client';
import {purchaseCopy} from '../lib/purchase-copy';
import {sharingCopy} from '../lib/sharing-copy';
import {type Story} from '../lib/story';
import {EmailSignIn} from './email-sign-in';

// The signed-out guard for direct visits to /stories and /billing: the same
// sign-in surface the account modal shows, but inline on the page — and with
// returnTo pointing back at the visited route (PR #82 pattern generalized),
// so the round trip lands where the visitor started.
export function PageSignIn({language,context,returnTo,onPrepareSignIn}:{language:Story['language'];context:'story'|'account';returnTo:string;onPrepareSignIn:(email?:string)=>()=>void;}){
 const c={...sharingCopy[language],...purchaseCopy[language]};
 const [pending,setPending]=useState(false),[emailPending,setEmailPending]=useState(false);
 return <section className="stories-page page-sign-in">
  <p className="account-note">{context==='account'?c.accountSignInHelp:c.googleHelp}</p>
  <p className="account-note">{c.accountMadeForYou}</p>
  <button type="button" className="secondary wide google-sign-in" disabled={pending||emailPending} onClick={()=>void (async()=>{const cancelHandoff=onPrepareSignIn();try{await signInWithGoogle(returnTo);}catch(problem){cancelHandoff();throw problem;}})}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>{c.googleLogin}</button>
  <EmailSignIn language={language} disabled={pending} onPrepareSignIn={onPrepareSignIn} onPending={setEmailPending}/>
 </section>;
}
