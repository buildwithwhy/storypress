import {useEffect,useState} from 'react';
import {Languages,LoaderCircle} from 'lucide-react';
import {artifactLanguage,languages,type Story} from '../lib/story';
import {translationCopy,languageNames} from '../lib/translation';
export function TranslationStudio({story,disabled,working,signedIn,onTranslate,onSignIn}:{story:Story;disabled:boolean;working:boolean;signedIn:boolean;onTranslate:(language:Story['language'])=>Promise<void>;onSignIn:()=>void}){
 const source=artifactLanguage(story),c=translationCopy[story.language],defaultTarget=story.paperLanguage?(source==='en'?'zh':'en'):story.language;
 const [target,setTarget]=useState<Story['language']>(defaultTarget),[error,setError]=useState('');
 useEffect(()=>{setTarget(defaultTarget);setError('');},[defaultTarget,story.paper]);
 async function translate(){setError('');try{await onTranslate(target);}catch(e){setError((e as Error).message);}}
 return <section className="translation-studio no-print" aria-labelledby="translation-title"><div className="translation-heading"><Languages size={23}/><h2 id="translation-title">{c.title}</h2></div><p>{c.help}</p>{story.translation&&<p className="translation-origin">{c.from} {languageNames[story.language][story.translation.sourceLanguage]} → {languageNames[story.language][source]}. {c.original}</p>}<div className="translation-controls"><label htmlFor="translation-language">{c.target}<select id="translation-language" value={target} disabled={disabled} onChange={e=>{setTarget(e.target.value as Story['language']);setError('');}}>{(Object.keys(languages) as Story['language'][]).filter(l=>!story.paperLanguage||l!==source).map(l=><option key={l} value={l}>{languages[l]}</option>)}</select></label><button className="secondary" disabled={disabled} onClick={()=>signedIn?void translate():onSignIn()}>{working?<LoaderCircle className="spin" size={17}/>:<Languages size={17}/>} {working?c.working:signedIn?c.action:c.signIn}</button></div><p className="translation-review">{c.review}</p>{error&&<p className="error" role="alert">{error}</p>}{working&&<p className="sr-only" role="status">{c.working}</p>}</section>;
}
