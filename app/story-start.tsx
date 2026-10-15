import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowRight,BookOpen,ImagePlus,Lock,Sparkles,X} from 'lucide-react';
import {startCopy} from '../lib/start-copy';
import type {Story} from '../lib/story';

export function StoryStart({language,disabled,hasDraft,needsSignIn,fromShared,onStart,onContinue,children}:{
 language:Story['language'];disabled:boolean;hasDraft:boolean;needsSignIn:boolean;fromShared:boolean;
 onStart:(withPhoto?:boolean,prompt?:string)=>void;onContinue:()=>void;children:ReactNode;
}) {
 const c=startCopy[language];
 const [showPrompts,setShowPrompts]=useState(false);
 return <div className="start-card story-start">
  {fromShared&&<p className="reader-welcome">{c.welcome}</p>}
  {hasDraft&&<div className="resume-story"><div><strong>{c.resume}</strong><p>{c.resumeHelp}</p></div><button className="secondary wide" disabled={disabled} onClick={onContinue}>{language==='zh'?'继续我的故事':language==='es'?'Continuar mi historia':'Continue my story'}<ArrowRight size={18}/></button></div>}
  <h2>{c.title}</h2><p className="start-time">{c.time}</p>
  <button className="primary wide" disabled={disabled} onClick={()=>onStart()}><BookOpen size={18}/>{c.memory}<ArrowRight size={18}/></button>
  <div className="start-alternatives">
   <button className="secondary" disabled={disabled} onClick={()=>onStart(true)}><ImagePlus size={18}/>{c.photo}</button>
   <button className="secondary" disabled={disabled} aria-expanded={showPrompts} aria-controls="story-prompts" onClick={()=>setShowPrompts(!showPrompts)}><Sparkles size={18}/>{c.help}</button>
  </div>
  {showPrompts&&<div id="story-prompts" className="story-prompts"><p>{c.promptTitle}</p>{c.prompts.map(prompt=><button key={prompt.label} disabled={disabled} onClick={()=>onStart(false,prompt.question)}><span>{prompt.label}</span><ArrowRight size={16}/></button>)}</div>}
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
