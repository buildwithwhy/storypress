import {type Story} from '../lib/story';
import {artworkKeys,artworkCopy,chosenArtwork,type Artwork} from '../lib/artwork';
import {Check,FileText} from 'lucide-react';
export function ArtworkPicker({story,onChange,disabled=false}:{story:Story;disabled?:boolean;onChange:(artwork:Artwork)=>void}){
 const c=artworkCopy[story.language],selected=chosenArtwork(story);
 if(story.photo)return <fieldset className="artwork-picker no-print" disabled={disabled}><legend>{c.choose}</legend><button className="secondary" type="button" aria-pressed={selected!=='generated'&&selected!=='none'} onClick={()=>onChange('memories')}>{story.language==='zh'?'使用上传的照片':story.language==='es'?'Usar mi fotografía':'Use my photograph'}</button> <button className="text-button" type="button" aria-pressed={selected==='none'} onClick={()=>onChange('none')}>{c.none}</button></fieldset>;
 return <fieldset className="artwork-picker no-print" disabled={disabled}><legend>{c.choose}</legend><div className="artwork-options">{artworkKeys.map(key=><button key={key} type="button" aria-pressed={selected===key} onClick={()=>onChange(key)} className={selected===key?'selected':''}>{key==='none'?<span className="artwork-empty"><FileText size={23}/></span>:<img src={`/artwork/${key}.jpg`} alt="" loading="lazy"/>}<span>{c[key]}</span>{selected===key&&<Check size={16}/>}</button>)}</div><p>{c.hint}</p></fieldset>;
}
