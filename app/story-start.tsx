import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowRight,BookOpen,ImagePlus,Lock,Sparkles,X} from 'lucide-react';
import {startCopy} from '../lib/start-copy';
import type {Story} from '../lib/story';

// Inline until the paywall copy module lands (paywall §5); then these move to
// lib/paywall-copy.ts with the rest of the paywall strings.
const limitCopy={en:{limitTitle:'You have used all {limit} free stories',limitBody:'Everything you have made stays yours — read, print and share it any time. Upgrade to keep telling new stories.',limitUpgrade:'Upgrade'},zh:{limitTitle:'你已经用完 {limit} 个免费故事',limitBody:'你创作的一切都仍然属于你——随时可以阅读、打印和分享。升级后可以继续创作新故事。',limitUpgrade:'升级'},es:{limitTitle:'Has usado tus {limit} historias gratis',limitBody:'Todo lo que creaste sigue siendo tuyo: puedes leerlo, imprimirlo y compartirlo cuando quieras. Mejora tu plan para seguir creando historias nuevas.',limitUpgrade:'Mejorar'}};

export function StoryStart({language,disabled,hasDraft,needsSignIn,fromShared,limitReached,freeLimit,onUpgrade,onStart,onContinue,children}:{
 language:Story['language'];disabled:boolean;hasDraft:boolean;needsSignIn:boolean;fromShared:boolean;limitReached:boolean;freeLimit:number;onUpgrade:()=>void;
 onStart:(withPhoto?:boolean,prompt?:string)=>void;onContinue:()=>void;children:ReactNode;
}) {
 const c=startCopy[language];
 const [showPrompts,setShowPrompts]=useState(false);
 return <div className="start-card story-start">
  {hasDraft&&<div className="resume-story"><div><strong>{c.resume}</strong><p>{c.resumeHelp}</p></div><button className="secondary wide" disabled={disabled} onClick={onContinue}>{c.continueLast}<ArrowRight size={18}/></button></div>}
  <h2>{c.title}</h2><p className="start-time">{c.time}</p>
  {limitReached&&<div className="start-limit" role="status">
   <strong>{limitCopy[language].limitTitle.replace('{limit}',String(freeLimit))}</strong>
   <p>{limitCopy[language].limitBody}</p>
   <button className="primary" onClick={onUpgrade}>{limitCopy[language].limitUpgrade}</button>
  </div>}
  <div className="start-choices">
   <button className="secondary wide" disabled={disabled||limitReached} onClick={()=>onStart()}><BookOpen size={20}/><span>{c.memory}</span><ArrowRight size={18}/></button>
   <button className="secondary wide" disabled={disabled||limitReached} onClick={()=>onStart(true)}><ImagePlus size={20}/><span>{c.photo}</span><ArrowRight size={18}/></button>
   <button className="secondary wide" disabled={disabled||limitReached} aria-expanded={showPrompts} aria-controls="story-prompts" onClick={()=>setShowPrompts(!showPrompts)}><Sparkles size={20}/><span>{c.help}</span><ArrowRight size={18}/></button>
  </div>
  {showPrompts&&<div id="story-prompts" className="story-prompts"><p>{c.promptTitle}</p>{c.prompts.map(prompt=><button key={prompt.label} disabled={disabled||limitReached} onClick={()=>onStart(false,prompt.question)}><span>{prompt.label}</span><ArrowRight size={16}/></button>)}</div>}
  <details className="start-details"><summary>{c.details}</summary>{children}</details>
  <p className="start-privacy"><Lock size={13}/>{c.privacy}</p>
  {needsSignIn&&<p className="start-auth-note">{c.signIn}</p>}
 </div>;
}

export function SamplePreview({language,onClose,children}:{language:Story['language'];onClose:()=>void;children:ReactNode}) {
 const dialog=useRef<HTMLDialogElement>(null),c=startCopy[language];
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>{node?.close();};},[]);
 return <dialog ref={dialog} className="sample-dialog" aria-labelledby="sample-title" onCancel={event=>{event.preventDefault();onClose();}} onClose={onClose}>
  <div className="sample-dialog-toolbar"><div><h2 id="sample-title">{c.sample}</h2><p>{c.sampleNote}</p></div><button className="icon-button" autoFocus aria-label={c.close} onClick={onClose}><X size={22}/></button></div>
  <div className="sample-dialog-paper">{children}</div><button className="secondary sample-back" onClick={onClose}>{c.close}</button>
 </dialog>;
}
