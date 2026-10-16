import {type Story} from '../lib/story';
import {artworkCopy,chosenArtwork,type Artwork} from '../lib/artwork';
export function ArtworkPicker({story,onChange,disabled=false}:{story:Story;disabled?:boolean;onChange:(artwork:Artwork)=>void}){
 const c=artworkCopy[story.language],selected=chosenArtwork(story);
 return <fieldset className="artwork-picker no-print" disabled={disabled}><legend>{c.choose}</legend>
  {story.photo&&<button className="secondary" type="button" aria-pressed={selected==='memories'} onClick={()=>onChange('memories')}>{c.photo}</button>}{' '}
  <button className="secondary" type="button" aria-pressed={selected==='none'} onClick={()=>onChange('none')}>{c.none}</button>
  {!story.photo&&<p>{c.hint}</p>}
 </fieldset>;
}
