import {useEffect,useState} from 'react';
import {Download,Share2,Link,Lock,Check,X} from 'lucide-react';
import {type Story,storySchema} from '../lib/story';
import {editionSnapshot,editionHtml} from '../lib/edition';
import {accountRequest,signIn,signOut,type AccountConfig} from '../lib/account-client';
import {sharingCopy} from '../lib/sharing-copy';
export type SavedStory={id:string;revision:number;share_token?:string|null};
export function Sharing({story,config,saved,onSaved,onLoad,storageKey,accountOnly=false,onClose}:{story:Story;config:AccountConfig;saved:SavedStory|null;onSaved:(s:SavedStory|null)=>void;onLoad:(s:Story)=>void;storageKey:string;accountOnly?:boolean;onClose?:()=>void}){
 const c=sharingCopy[story.language];const [pending,setPending]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[email,setEmail]=useState(''),[rows,setRows]=useState<{id:string;title:string}[]>([]);
 const user=config.supabase?config.user:null;
 const url=saved?.share_token?`${location.origin}/s/${saved.share_token}`:'';
 async function run(fn:()=>Promise<void>){setPending(true);setNotice('');setError('');try{await fn();}catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message);}finally{setPending(false);}}
 async function refresh(){if(user){const data=await accountRequest();setRows(data.stories);}}
 useEffect(()=>{if(accountOnly)void run(refresh);},[user?.id,accountOnly]);
 async function save(){const next=await accountRequest({action:'save',id:saved?.id,revision:saved?.revision,story});onSaved(next);return next as SavedStory;}
 function newspaperFile(){return new File([editionHtml(editionSnapshot(story))],'storypress-newspaper.html',{type:'text/html'});}
 function download(){const file=newspaperFile(),href=URL.createObjectURL(file),a=document.createElement('a');a.href=href;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);setNotice(c.fileSaved);}
 async function send(){const file=newspaperFile();if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:story.paper!.headline});else download();}
 return <section className="sharing-panel no-print" aria-label={c.account}>
 {onClose&&<button className="icon-button close" onClick={onClose} aria-label={c.close}><X size={21}/></button>}
 <p className="eyebrow">{accountOnly?c.account:'STORYPRESS'}</p><h2>{c.title}</h2><p>{c.private}</p>
 {!accountOnly&&<><div className="sharing-actions"><button className="secondary" disabled={!story.approved||pending} onClick={()=>void run(async()=>download())}><Download size={17}/>{c.download}</button><button className="primary" disabled={!story.approved||pending} onClick={()=>void run(send)}><Share2 size={17}/>{c.send}</button></div>{!story.approved&&<p className="quiet left">{c.approve}</p>}</>}
 {!config.storage?<p className="account-note">{c.notReady}</p>:!user?<form onSubmit={e=>{e.preventDefault();void run(async()=>{await signIn(email);setNotice(c.sent);});}}><label>{c.email}<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label><button className="secondary" disabled={pending}>{c.login}</button></form>:<>
 <p className="account-email"><Lock size={15}/>{user.email}</p><div className="sharing-actions"><button className="secondary" disabled={pending} onClick={()=>void run(async()=>{await save();setNotice(c.saved);if(accountOnly)await refresh();})}><Lock size={16}/>{c.save}</button>
 {!accountOnly&&<button className="secondary" disabled={!story.approved||pending||!config.linkSharing} onClick={()=>void run(async()=>{const current=await save();const next=await accountRequest({action:'share',id:current.id,revision:current.revision});onSaved(next);})}><Link size={17}/>{url?c.update:c.web}</button>}</div>
 {!accountOnly&&!config.linkSharing&&<p className="quiet left">{c.linkWait}</p>}
 {url&&<div className="share-link"><p>{c.link}</p><a href={url} target="_blank" rel="noreferrer">{url}</a><div className="sharing-actions"><button className="secondary" disabled={pending} onClick={()=>void run(async()=>{await navigator.clipboard.writeText(url);setNotice(c.copied);})}>{c.copy}</button><button className="text-button" disabled={pending} onClick={()=>void run(async()=>{onSaved(await accountRequest({action:'private',id:saved!.id,revision:saved!.revision}));})}>{c.off}</button></div><small>{c.offNote}</small></div>}
 {accountOnly&&<><p className="quiet left">{c.allowance}</p><div className="saved-stories">{rows.length?rows.map(row=><div className="saved-story" key={row.id}><strong>{row.title}</strong><button className="text-button" disabled={pending} onClick={()=>{if(!confirm(c.replace))return;void run(async()=>{const data=await accountRequest(undefined,row.id);onLoad(storySchema.parse(data.data));onSaved(data);onClose?.();});}}>{c.open}</button><button className="text-button" disabled={pending} onClick={()=>{if(!confirm(c.confirmDelete))return;void run(async()=>{await accountRequest({action:'delete',id:row.id});if(saved?.id===row.id)onSaved(null);await refresh();});}}>{c.delete}</button></div>):<p>{c.empty}</p>}</div>
 <div className="sharing-actions"><button className="text-button" disabled={pending} onClick={()=>void run(async()=>{if(!confirm(c.importConfirm))return;const raw=localStorage.getItem('storypress-draft-v1:guest')||localStorage.getItem('storypress-draft-v1');if(!raw)return;const parsed=JSON.parse(raw);onLoad(storySchema.parse(parsed.story||parsed));onSaved(null);onClose?.();})}>{c.import}</button><button className="text-button" disabled={pending} onClick={()=>{if(!confirm(c.confirmLogout))return;void run(async()=>{localStorage.removeItem(storageKey);await signOut();});}}>{c.logout}</button></div></>}
 </>}
 {notice&&<p role="status" className="sharing-notice"><Check size={16}/>{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
 </section>;
}
