import {useEffect,useRef,useState} from 'react';
import {BookOpen,Newspaper,Mail,Download,Share2,LoaderCircle} from 'lucide-react';
import type {Story} from '../lib/story';
import {keepsakeCopy,keepsakeMarkup,keepsakeStyles,formatOf,type KeepsakeFormat} from '../lib/keepsake';
import {shareImages} from '../lib/share-images';
export function KeepsakeView({story}:{story:Story}){return <><style>{keepsakeStyles}</style><div dangerouslySetInnerHTML={{__html:keepsakeMarkup(story)}}/></>;}
export function FormatPicker({story,onChange,disabled=false}:{story:Story;onChange:(format:KeepsakeFormat)=>void;disabled?:boolean}){
 const c=keepsakeCopy[story.language];
 return <section className="format-studio no-print" aria-label={c.choose}><div><h2>{c.title}</h2><p>{c.help}</p></div><div className="format-options">{(['newspaper','booklet','letter'] as const).map((format,i)=>{const Icon=[Newspaper,BookOpen,Mail][i];return <button key={format} disabled={disabled} aria-pressed={formatOf(story)===format} onClick={()=>onChange(format)}><span className={`format-thumbnail format-${format}`}><Icon size={30}/><span/><span/></span><strong>{c[format]}</strong><small>{c.descriptions[i]}</small></button>;})}</div></section>;
}
export function IntentionPicker({story,disabled,onChange}:{story:Story;disabled:boolean;onChange:(intention:NonNullable<Story['intention']>)=>void}){
 const c=keepsakeCopy[story.language],kind=story.intention?.kind||'memory';
 return <section className="intention-picker"><label htmlFor="story-intention">{c.intent}</label><select id="story-intention" value={kind} disabled={disabled} onChange={e=>onChange({kind:e.target.value as 'memory'|'message',recipient:story.intention?.recipient})}><option value="memory">{c.memory}</option><option value="message">{c.message}</option></select>{kind==='message'&&<><label htmlFor="story-recipient">{c.recipient}</label><input id="story-recipient" maxLength={80} value={story.intention?.recipient||''} placeholder={c.recipientPlaceholder} disabled={disabled} onChange={e=>onChange({kind,recipient:e.target.value})}/></>}</section>;
}
export function ShareImages({story}:{story:Story}){
 const c=keepsakeCopy[story.language];const [cards,setCards]=useState<{url:string;blob:Blob}[]>([]),[working,setWorking]=useState(false),[error,setError]=useState(''),[index,setIndex]=useState(0);
 const generation=useRef(0);
 const signature=JSON.stringify([story.paper,story.photo,story.generatedArt,story.artwork,story.approved,story.name,story.language]);
 useEffect(()=>{generation.current++;setCards([]);setIndex(0);setError('');setWorking(false);},[signature]);
 useEffect(()=>()=>cards.forEach(card=>URL.revokeObjectURL(card.url)),[cards]);
 async function prepare(){const id=++generation.current;setWorking(true);setError('');try{const blobs=await shareImages(story);if(id!==generation.current)return;setCards(blobs.map(blob=>({blob,url:URL.createObjectURL(blob)})));}catch(e){if(id===generation.current)setError((e as Error).message);}finally{if(id===generation.current)setWorking(false);}}
 async function share(){const files=cards.map((card,i)=>new File([card.blob],`storypress-${i+1}.png`,{type:'image/png'}));try{await navigator.share({files,title:story.paper?.headline});}catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message);}}
 const canShare=cards.length&&typeof navigator.canShare==='function'&&navigator.canShare({files:cards.map((card,i)=>new File([card.blob],`storypress-${i+1}.png`,{type:'image/png'}))});
 return <section className="share-images no-print"><h2>{c.images}</h2><p>{c.imageHelp}</p><button className="secondary" onClick={()=>void prepare()} disabled={!story.approved||working}>{working?<LoaderCircle className="spin" size={18}/>:<Download size={18}/>} {c.images}</button>{error&&<p role="alert">{error}</p>}{cards.length>0&&<div className="share-image-preview"><img src={cards[index]?.url} alt={`${c.page} ${index+1}`}/><div className="share-image-controls"><button className="secondary" disabled={index===0} onClick={()=>setIndex(index-1)}>{c.back}</button><span>{index+1} / {cards.length}</span><button className="secondary" disabled={index===cards.length-1} onClick={()=>setIndex(index+1)}>{c.next}</button></div><a className="primary" href={cards[index]?.url} download={`storypress-${index+1}.png`}><Download size={16}/>{c.saveImage}</a>{!!canShare&&<button className="secondary" onClick={()=>void share()}><Share2 size={16}/>{c.shareImages}</button>}</div>}</section>;
}
