import {useEffect,useState} from 'react';
import {Check,Share2,Users} from 'lucide-react';
import {type Story} from '../lib/story';
import {type SavedStory} from '../lib/story-saver';
import {inviteApi} from '../lib/invite-client';
import {inviteCopy,suggestedQuestion,formatEndDate} from '../lib/invite-copy';

type InviteRow={id:string;question:string;status:'open'|'expired'|'revoked';expiresAt:string;createdAt:string};

// Owner side of contributor invitations: mint a personal-question link,
// share it through the same navigator.share path as keepsake links, and
// revoke it. Review of guest contributions mounts in this panel too.
export function Invites({language,occasion,storyName,saved,onSave}:{language:Story['language'];occasion:Story['occasion'];storyName?:string;saved:SavedStory;onSave:()=>Promise<SavedStory|null>;}){
 const c=inviteCopy[language];
 const [invites,setInvites]=useState<InviteRow[]>([]);
 const [question,setQuestion]=useState(()=>suggestedQuestion(language,occasion,storyName));
 const [name,setName]=useState(''),[link,setLink]=useState(''),[expires,setExpires]=useState('');
 const [pending,setPending]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 async function run(fn:()=>Promise<void>){setPending(true);setNotice('');setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{setPending(false);}}
 async function refresh(){const data=await inviteApi(undefined,`story_id=${encodeURIComponent(saved.id)}`) as {invites:InviteRow[]};setInvites(data.invites);}
 useEffect(()=>{void run(refresh);},[saved.id]);
 async function create(){const data=await inviteApi({action:'create',storyId:saved.id,question:question.trim(),contributorName:name.trim()||undefined}) as {url:string;expiresAt:string};setLink(data.url);setExpires(data.expiresAt);setName('');await refresh();}
 async function copyLink(){try{await navigator.clipboard.writeText(link);setNotice(c.copied);}catch{setError(c.guestError);}}
 async function shareLink(){if(navigator.share)await navigator.share({url:link,title:c.title});else await copyLink();}
 const statusLabel=(status:InviteRow['status'])=>status==='open'?c.statusOpen:status==='expired'?c.statusExpired:c.statusRevoked;
 return <section className="sharing-panel no-print invite-panel" aria-label={c.title}>
  <p className="eyebrow">ONCE &amp; OURS</p><h2>{c.title}</h2><p>{c.help}</p>
  <div className="sharing-actions">
   <label>{c.questionLabel}<textarea className="invite-question-input" value={question} maxLength={600} onChange={e=>setQuestion(e.target.value)}/></label>
   <label>{c.contributorLabel}<input value={name} maxLength={80} placeholder={c.contributorPlaceholder} onChange={e=>setName(e.target.value)}/></label>
  </div>
  <div className="sharing-actions">
   <button className="primary" disabled={pending||!question.trim()} onClick={()=>void run(create)}><Users size={17}/>{pending?c.creating:c.create}</button>
  </div>
  {link&&<div className="share-link"><p>{c.ready}</p><input type="url" value={link} readOnly spellCheck={false} dir="ltr" aria-label={c.ready} onFocus={e=>e.currentTarget.select()}/><small>{c.readyEnds} {formatEndDate(language,expires)}</small>
   <div className="sharing-actions"><button className="primary" disabled={pending} onClick={()=>void run(shareLink)}><Share2 size={17}/>{c.share}</button><button className="secondary" disabled={pending} onClick={()=>void run(copyLink)}>{c.copy}</button></div></div>}
  <details className="invite-open-list" open>
   <summary className="text-button">{c.openTitle}</summary>
   {invites.length?<div className="invite-list">{invites.map(row=><div className="invite-row" key={row.id}><strong>{row.question}</strong><span className={'invite-status'+(row.status==='open'?'':' closed')}>{statusLabel(row.status)}</span><small>{c.ends} {formatEndDate(language,row.expiresAt)}</small>
    <button className="text-button" disabled={pending||row.status!=='open'} onClick={()=>void run(async()=>{if(!confirm(c.revokeConfirm))return;await inviteApi({action:'revoke',inviteId:row.id});setNotice(c.revoked);await refresh();})}>{c.revoke}</button></div>)}</div>:<p className="quiet left">{c.none}</p>}
  </details>
  {notice&&<p role="status" className="sharing-notice"><Check size={16}/>{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
 </section>;
}
