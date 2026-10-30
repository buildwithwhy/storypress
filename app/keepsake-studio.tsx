import {useEffect,useRef,useState} from 'react';
import {BookOpen,Newspaper,Mail,Download,Share2,LoaderCircle,Film} from 'lucide-react';
import type {Story} from '../lib/story';
import {artifactLanguage} from '../lib/story';
import {keepsakeCopy,keepsakeMarkup,keepsakeStyles,formatOf,type KeepsakeFormat} from '../lib/keepsake';
import {shareImages} from '../lib/share-images';
import {editionSnapshot} from '../lib/edition';
import {buildVideoManifest} from '../lib/video-storyboard';
import {encodeMemoryVideo,FULL_VIDEO_SIZE,VideoEncodeUnavailableError} from '../lib/video-encode';
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
 const signature=JSON.stringify([story.paper,story.photo,story.generatedArt,story.artwork,story.approved,story.name,story.language,story.paperLanguage,story.photoCaption]);
 useEffect(()=>{generation.current++;setCards([]);setIndex(0);setError('');setWorking(false);},[signature]);
 useEffect(()=>()=>cards.forEach(card=>URL.revokeObjectURL(card.url)),[cards]);
 async function prepare(){const id=++generation.current;setWorking(true);setError('');try{const blobs=await shareImages(story);if(id!==generation.current)return;setCards(blobs.map(blob=>({blob,url:URL.createObjectURL(blob)})));}catch(e){if(id===generation.current)setError((e as Error).message);}finally{if(id===generation.current)setWorking(false);}}
 async function share(){const files=cards.map((card,i)=>new File([card.blob],`storypress-${i+1}.png`,{type:'image/png'}));try{await navigator.share({files,title:story.paper?.headline});}catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message);}}
 const canShare=cards.length&&typeof navigator.canShare==='function'&&navigator.canShare({files:cards.map((card,i)=>new File([card.blob],`storypress-${i+1}.png`,{type:'image/png'}))});
 return <section className="share-images no-print"><h2>{c.images}</h2><p>{c.imageHelp}</p><button className="secondary" onClick={()=>void prepare()} disabled={!story.approved||working}>{working?<LoaderCircle className="spin" size={18}/>:<Download size={18}/>} {c.images}</button>{error&&<p role="alert">{error}</p>}{cards.length>0&&<div className="share-image-preview"><img src={cards[index]?.url} alt={`${c.page} ${index+1}`}/><div className="share-image-controls"><button className="secondary" disabled={index===0} onClick={()=>setIndex(index-1)}>{c.back}</button><span>{index+1} / {cards.length}</span><button className="secondary" disabled={index===cards.length-1} onClick={()=>setIndex(index+1)}>{c.next}</button></div><a className="primary" href={cards[index]?.url} download={`storypress-${index+1}.png`}><Download size={16}/>{c.saveImage}</a>{!!canShare&&<button className="secondary" onClick={()=>void share()}><Share2 size={16}/>{c.shareImages}</button>}</div>}</section>;
}
// Error copy for the video render: the typed exhausted-ladder refusal carries
// an English-only message, so it maps to the per-language line that still
// names the share-images last resort; everything else reports its own message.
const videoProblem=(e:unknown,c:(typeof keepsakeCopy)['en']):string=>e instanceof VideoEncodeUnavailableError?c.videoUnavailable:(e as Error).message||c.videoError;
// The memory-video action. Hidden twice over — the deployment's services flag
// AND this keepsake's approval; with either missing, the section does not
// render at all. That is the hidden-when-off property the rollout proof walks:
// no navigation entries, no other surface, anywhere.
type RenderedVideo={url:string;blob:Blob;mimeType:string;name:string;width:number;height:number;downgraded:boolean;webm:boolean};
export function ShareVideo({story,enabled}:{story:Story;enabled:boolean}){
 const c=keepsakeCopy[story.language];
 const [video,setVideo]=useState<RenderedVideo|null>(null),[working,setWorking]=useState(false),[progress,setProgress]=useState<number|null>(null),[error,setError]=useState('');
 const generation=useRef(0);
 const signature=JSON.stringify([story.paper,story.photo,story.generatedArt,story.artwork,story.approved,story.name,story.language,story.paperLanguage]);
 useEffect(()=>{generation.current++;setVideo(null);setProgress(null);setError('');setWorking(false);},[signature]);
 useEffect(()=>()=>{if(video)URL.revokeObjectURL(video.url);},[video]);
 if(!enabled||!story.approved)return null;
 async function render(){
  const id=++generation.current;setWorking(true);setError('');setVideo(null);setProgress(null);
  try{
   // editionSnapshot is the approved-content boundary: exactly what a video
   // may show, with the artwork choice resolved. The manifest language follows
   // the artifact, the same rule the editions follow. onProgress paints each
   // finished frame — the patient-defaults precedent: the render is offline
   // and abandonable, never a silent modal.
   const encoded=await encodeMemoryVideo(buildVideoManifest(editionSnapshot(story),artifactLanguage(story)),{onProgress:(done,total)=>{if(id===generation.current)setProgress(Math.round(done*100/total));}});
   if(id!==generation.current)return;
   setVideo({url:URL.createObjectURL(encoded.blob),blob:encoded.blob,mimeType:encoded.mimeType,name:`once-and-ours-memory.${encoded.mimeType.includes('webm')?'webm':'mp4'}`,width:encoded.width,height:encoded.height,downgraded:encoded.width<FULL_VIDEO_SIZE.width,webm:encoded.mimeType.includes('webm')});
  }catch(e){if(id===generation.current)setError(videoProblem(e,c));}finally{if(id===generation.current)setWorking(false);}
 }
 async function share(){if(!video)return;try{await navigator.share({files:[new File([video.blob],video.name,{type:video.mimeType})],title:story.paper?.headline});}catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message);}}
 const canShareVideo=!!video&&typeof navigator.canShare==='function'&&navigator.canShare({files:[new File([video.blob],video.name,{type:video.mimeType})]});
 return <section className="share-video no-print" aria-label={c.video}><h2>{c.video}</h2><p>{c.videoHelp}</p><button className="secondary" onClick={()=>void render()} disabled={working}>{working?<LoaderCircle className="spin" size={18}/>:<Film size={18}/>} {c.makeVideo}</button>{working&&<div role="status" aria-live="polite">{progress===null?c.videoPreparing:`${c.videoProgress} ${progress}%`}{progress!==null&&<progress max={100} value={progress} aria-label={c.videoProgress}/>}<p className="share-video-note">{c.videoPatience}</p></div>}{error&&<p role="alert">{error}</p>}{video&&<div className="share-video-preview"><video src={video.url} controls playsInline/>{video.downgraded&&<p className="share-video-note">{c.videoDowngraded}</p>}{video.webm&&<p className="share-video-note">{c.videoWebM}</p>}<div className="share-video-actions"><a className="primary" href={video.url} download={video.name}><Download size={16}/>{c.saveVideo}</a>{!!canShareVideo&&<button className="secondary" onClick={()=>void share()}><Share2 size={16}/>{c.shareVideo}</button>}</div></div>}</section>;
}
