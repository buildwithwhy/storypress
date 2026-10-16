import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Mail} from 'lucide-react';
import {signIn,verifyEmailCode} from '../lib/account-client';
import {emailSignInCopy} from '../lib/email-sign-in-copy';
import type {Story} from '../lib/story';

export function EmailSignIn({language,disabled,onPrepareSignIn,onPending}:{language:Story['language'];disabled:boolean;onPrepareSignIn:(email:string)=>()=>void;onPending:(pending:boolean)=>void}){
 const c=emailSignInCopy[language];
 const [email,setEmail]=useState(''),[sentTo,setSentTo]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState<'send'|'verify'|null>(null),[error,setError]=useState(''),[retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now());
 const inFlight=useRef(false),retrySeconds=Math.max(0,Math.ceil((retryAt-now)/1000));
 useEffect(()=>{if(!retryAt)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[retryAt]);
 function message(problem:unknown){const e=problem as {code?:string;status?:number};if(e.code==='invalid_code')return c.codeHelp;if(e.code==='otp_expired'||e.code==='otp_disabled'||e.status===403)return c.invalid;if(e.status===429||e.code==='over_email_send_rate_limit'||e.code==='over_request_rate_limit')return c.limited;if(e.code==='email_address_not_authorized'||e.code==='email_provider_disabled'||(e.status||0)>=500)return c.unavailable;return c.failed;}
 async function run(action:'send'|'verify'){
  if(inFlight.current||disabled||(action==='send'&&Date.now()<retryAt))return;
  inFlight.current=true;setBusy(action);onPending(true);setError('');
  let cancel:(()=>void)|undefined;
  try{
   const address=(sentTo||email).trim().toLowerCase();
   // Snapshot again at verification so returning to this form cannot import stale words.
   cancel=onPrepareSignIn(address);
   if(action==='send'){await signIn(address);setSentTo(address);setCode('');setNow(Date.now());setRetryAt(Date.now()+60000);}
   else await verifyEmailCode(address,code);
  }catch(problem){cancel?.();setError(message(problem));if((problem as {status?:number}).status===429){setNow(Date.now());setRetryAt(Date.now()+60000);}}
  finally{inFlight.current=false;setBusy(null);onPending(false);}
 }
 return <section className="email-sign-in" aria-labelledby="email-sign-in-title">
  <p className="auth-divider"><span>{c.or}</span></p>
  <h3 id="email-sign-in-title">{c.title}</h3>
  {!sentTo?<form onSubmit={e=>{e.preventDefault();void run('send');}}>
   <p>{c.help}</p><label>{c.email}<input type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required disabled={disabled||!!busy} value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label>
   <button className="secondary wide" disabled={disabled||!!busy||!!retrySeconds}><Mail size={18}/>{busy==='send'?c.sending:retrySeconds?`${c.wait} ${retrySeconds} ${c.seconds}`:c.send}</button>
  </form>:<>
   <div role="status" className="email-code-notice"><strong>{c.sent}</strong><p>{c.sentTo} <b>{sentTo}</b>.</p><p>{c.inbox}</p></div>
   <form onSubmit={e=>{e.preventDefault();void run('verify');}}><label>{c.code}<input autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" spellCheck={false} required pattern="[0-9 ]{6,12}" minLength={6} maxLength={12} aria-invalid={!!error} aria-describedby={error?'email-sign-in-error':undefined} disabled={disabled||!!busy} value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9 ]/g,''))}/></label><button className="primary wide" disabled={disabled||!!busy||code.replace(/\s/g,'').length<6}>{busy==='verify'?c.verifying:c.verify}<ArrowRight size={18}/></button></form>
   <div className="email-code-actions"><button type="button" className="text-button" disabled={disabled||!!busy||!!retrySeconds} onClick={()=>void run('send')}>{retrySeconds?`${c.wait} ${retrySeconds} ${c.seconds}`:c.resend}</button><button type="button" className="text-button" disabled={disabled||!!busy} onClick={()=>{setSentTo('');setCode('');setError('');}}>{c.change}</button></div>
  </>}
  {error&&<p id="email-sign-in-error" role="alert" className="error">{error}</p>}
 </section>;
}
