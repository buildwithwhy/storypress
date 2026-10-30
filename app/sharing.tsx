import {useEffect,useRef,useState} from 'react';
import {Download,Share2,Link,Lock,Check,X} from 'lucide-react';
import {type Story,storySchema} from '../lib/story';
import {downloadableEdition} from '../lib/edition-download';
import {accountRequest,signInWithGoogle,signOut,type AccountConfig} from '../lib/account-client';
import {sharingCopy} from '../lib/sharing-copy';
import {shareFlowCopy} from '../lib/share-flow-copy';
import {clearAccountDraft} from '../lib/draft-handoff';
import {type SavedStory} from '../lib/story-saver';
import {saveCopy} from '../lib/save-copy';
import {startCheckout} from '../lib/billing-client';
import {type BillingStatus} from '../lib/billing';
import {paywallCopy} from '../lib/paywall-copy';
import {EmailSignIn} from './email-sign-in';
import {readerCopy} from '../lib/reader';
import {artifactSharePayload,shareSheetAvailable} from '../lib/share-payload';
export function Sharing({story,config,saved,onSave,onSaveSeparate,onChangeSharing,onLoad,onNew,onDelete,storageKey,onPrepareSignIn,onRestoreEarlier,accountError,accountOnly=false,onClose}:{story:Story;config:AccountConfig;saved:SavedStory|null;onSave:()=>Promise<SavedStory|null>;onSaveSeparate:()=>Promise<void>;onChangeSharing:(action:'share'|'private')=>Promise<SavedStory>;onLoad:(s:Story,saved:SavedStory|null)=>Promise<void>;onNew:()=>Promise<void>;onDelete:(id:string)=>Promise<void>;storageKey:string;onPrepareSignIn:(email?:string)=>()=>void;onRestoreEarlier?:()=>void;accountError?:string;accountOnly?:boolean;onClose?:()=>void}){
 const c={...sharingCopy[story.language],...shareFlowCopy[story.language]},sc=saveCopy[story.language];const [pending,setPending]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[emailPending,setEmailPending]=useState(false),[rows,setRows]=useState<{id:string;title:string}[]>([]);
 const user=config.supabase?config.user:null,linkField=useRef<HTMLInputElement>(null);
 const url=saved?.share_token?`${location.origin}/s/${saved.share_token}`:'';
 async function run(fn:()=>Promise<void>){setPending(true);setNotice('');setError('');try{await fn();}catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message);}finally{setPending(false);}}
 async function refresh(){if(user){const data=await accountRequest();setRows(data.stories);}}
 useEffect(()=>{if(accountOnly)void run(refresh);},[user?.id,accountOnly]);
 async function save(){const next=await onSave();if(!next)throw new Error(sc.empty);return next;}
 async function newspaperFile(){return new File([await downloadableEdition(story)],'storypress-keepsake.html',{type:'text/html'});}
 async function download(){const file=await newspaperFile(),href=URL.createObjectURL(file),a=document.createElement('a');a.href=href;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);setNotice(c.fileSaved);}
 async function send(){const file=await newspaperFile();if(shareSheetAvailable([file]))await navigator.share(artifactSharePayload([file],story.paper!.headline));else await download();}
 async function copyLink(){try{await navigator.clipboard.writeText(url);setNotice(c.copied);}catch{linkField.current?.focus();linkField.current?.select();setNotice(c.copyManual);}}
 async function sendLink(){try{if(navigator.share)await navigator.share({url,title:story.paper?.headline||c.sharedTitle});else await copyLink();}catch(e){if((e as Error).name!=='AbortError')await copyLink();}}
 return <section className="sharing-panel no-print" aria-label={c.account}>
 {onClose&&<button className="icon-button close" onClick={onClose} aria-label={c.close}><X size={21}/></button>}
 <p className="eyebrow">{accountOnly?c.account:'ONCE & OURS'}</p><h2>{c.title}</h2><p>{c.private}</p>
 {!accountOnly&&<><div className="sharing-actions">{user&&config.linkSharing&&<button className="primary" disabled={!story.approved||pending} onClick={()=>void run(async()=>{await onChangeSharing('share');setNotice(c.linkReady);})}><Link size={17}/>{url?c.update:c.web}</button>}<button className="secondary" disabled={!story.approved||pending} onClick={()=>void run(download)}><Download size={17}/>{c.download}</button><button className="secondary" disabled={!story.approved||pending} onClick={()=>void run(send)}><Share2 size={17}/>{c.send}</button></div>{!story.approved&&<p className="quiet left">{c.approve}</p>}</>}
 {!config.storage?<p className="account-note">{c.notReady}</p>:!user?<><p className="account-note">{c.googleHelp}</p><button type="button" className="secondary wide google-sign-in" disabled={pending||emailPending} onClick={()=>void run(async()=>{const cancelHandoff=onPrepareSignIn();try{await signInWithGoogle();}catch(problem){cancelHandoff();throw problem;}})}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>{c.googleLogin}</button><EmailSignIn language={story.language} disabled={pending} onPrepareSignIn={onPrepareSignIn} onPending={setEmailPending}/></>:<>
 <p className="account-email"><Lock size={15}/>{user.email}</p><div className="sharing-actions"><button className="secondary" disabled={pending} onClick={()=>void run(async()=>{await save();setNotice(c.saved);if(accountOnly)await refresh();})}><Lock size={16}/>{c.save}</button>
 </div>
 {!accountOnly&&!config.linkSharing&&<p className="quiet left">{c.linkWait}</p>}
 {!accountOnly&&url&&<div className="share-link"><p>{c.link}</p><label className="sr-only" htmlFor="published-story-link">{readerCopy[story.language].link}</label><input id="published-story-link" ref={linkField} type="url" value={url} readOnly spellCheck={false} dir="ltr" onFocus={e=>e.currentTarget.select()}/><p className="share-snapshot-note">{c.snapshot}</p><div className="sharing-actions"><button className="primary" disabled={pending} onClick={()=>void run(sendLink)}><Share2 size={17}/>{c.sendLink}</button><button className="secondary" disabled={pending} onClick={()=>void run(copyLink)}>{c.copy}</button><a className="secondary" href={url} target="_blank" rel="noreferrer">{c.openReader}</a></div><p className="share-snapshot-note">{c.readerHelp}</p><details className="share-app-help"><summary>{readerCopy[story.language].help}</summary><p>{readerCopy[story.language].helpText}</p></details><button className="text-button" disabled={pending} onClick={()=>void run(async()=>{await onChangeSharing('private');})}>{c.off}</button><small>{c.offNote}</small></div>}
 {accountOnly&&<><p className="account-note">{sc.listHelp}</p><button className="primary" disabled={pending} onClick={()=>void run(onNew)}>{sc.startNew}</button><p className="quiet left">{c.allowance}</p><UpgradePanel billing={config.billing} language={story.language} ownerTree/><div className="saved-stories">{rows.length?rows.map(row=><div className="saved-story" key={row.id}><strong>{row.title}</strong><button className="text-button" disabled={pending} onClick={()=>{void run(async()=>{await onSave();const data=await accountRequest(undefined,row.id);await onLoad(storySchema.parse(data.data),data);onClose?.();});}}>{c.open}</button><button className="text-button" disabled={pending} onClick={()=>{if(!confirm(c.confirmDelete))return;void run(async()=>{await onDelete(row.id);await refresh();});}}>{c.delete}</button></div>):<p>{sc.empty}</p>}</div>
 <div className="sharing-actions">{onRestoreEarlier&&<button className="text-button" disabled={pending} onClick={onRestoreEarlier}>{c.earlierDraft}</button>}<button className="text-button" disabled={pending} onClick={()=>void run(async()=>{if(!confirm(c.importConfirm))return;const raw=localStorage.getItem('storypress-draft-v1:guest')||localStorage.getItem('storypress-draft-v1');if(!raw)return;const parsed=JSON.parse(raw);await onLoad(storySchema.parse(parsed.story||parsed),null);onClose?.();})}>{c.import}</button><button className="text-button" disabled={pending} onClick={()=>{if(!confirm(c.confirmLogout))return;void run(async()=>{await onSave();await signOut();clearAccountDraft(localStorage,storageKey,user.id);});}}>{c.logout}</button></div></>}
 </>}
 {accountError&&<div><p role="alert" className="error">{sc.error} {accountError}</p>{user&&<><p>{sc.separateHelp}</p><button className="secondary" disabled={pending} onClick={()=>void run(async()=>{await onSaveSeparate();await refresh();setNotice(c.saved);})}>{sc.saveSeparate}</button></>}</div>}
 {notice&&<p role="status" className="sharing-notice"><Check size={16}/>{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
 </section>;
}


// The upgrade surface (paywall §5): plan state first, then — only when Stripe
// is configured and the owner is on the free plan — the subscription cadence
// toggle and the lifetime unlock side by side. Dormant deployments keep the
// limit legible but never show a pay button that would only error. The guard
// is the free-forever invariant: outside the owner's Storypress tree the
// panel renders nothing.
export function UpgradePanel({billing,language,ownerTree}:{billing:BillingStatus;language:Story['language'];ownerTree:boolean}){
 const c=paywallCopy[language];
 const [cadence,setCadence]=useState<'monthly'|'annual'>('monthly');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 if(!ownerTree)return null;
 const planLine=billing.plan==='free'?c.freeUsage.replace('{used}',String(billing.storiesCreated)).replace('{limit}',String(billing.freeStoryLimit)):billing.plan==='subscription'?c.subscriptionActive:c.lifetimeActive;
 async function pay(plan:'monthly'|'annual'|'lifetime'){setBusy(true);setError('');try{location.assign(await startCheckout(plan));}catch(problem){setError((problem as Error).message);setBusy(false);}}
 return <div className="upgrade-panel">
  <p className="upgrade-plan" role="status">{planLine}</p>
  {billing.configured&&billing.plan==='free'&&<><div className="upgrade-cadence" role="group" aria-label={c.planHeading}>
   <button className={cadence==='monthly'?'secondary selected':'secondary'} aria-pressed={cadence==='monthly'} disabled={busy} onClick={()=>setCadence('monthly')}>{c.monthly}</button>
   <button className={cadence==='annual'?'secondary selected':'secondary'} aria-pressed={cadence==='annual'} disabled={busy} onClick={()=>setCadence('annual')}>{c.annual}</button>
  </div>
  <div className="sharing-actions">
   <button className="primary" disabled={busy} onClick={()=>void pay(cadence)}>{c.checkout}</button>
   <button className="secondary" disabled={busy} onClick={()=>void pay('lifetime')}>{c.lifetime}</button>
  </div>
  {busy&&<p className="quiet left" role="status">{c.checkoutBusy}</p>}</>}
  {!billing.configured&&<p className="quiet left">{c.dormant}</p>}
  {error&&<p className="quiet left" role="alert">{error}</p>}
 </div>;
}
