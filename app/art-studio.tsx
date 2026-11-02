import {useEffect,useState} from 'react';
import {ImagePlus} from 'lucide-react';
import {type Story} from '../lib/story';
import {artworkCopy,type Artwork} from '../lib/artwork';
import {ArtworkPicker} from './artwork-picker';
import {StoryArt} from './story-art';

// The demoted illustration module (spec item 4): one collapsed card under the
// keepsake folding the artwork choice (photograph / text-only) and the
// generation studio — generate, redraw, art-direction notes and a
// thumbnail-height result. It opens by itself while an illustration is being
// drawn (the default-illustration auto-run included) so the progress is never
// hidden, and it stays print-hidden like every keepsake-first module.
type ArtStudioProps={
 story:Story;
 busy:boolean;
 drawing:boolean;
 onArtwork:(artwork:Artwork)=>void;
 onGenerate:(style:'illustration'|'comic')=>void;
 onInstructions:(value:string)=>void;
 onSelect:()=>void;
 onRemove:()=>void;
};
export function ArtStudio({story,busy,drawing,onArtwork,onGenerate,onInstructions,onSelect,onRemove}:ArtStudioProps){
 const c=artworkCopy[story.language];
 const [open,setOpen]=useState(false);
 useEffect(()=>{if(drawing)setOpen(true);},[drawing]);
 return <details className="art-studio no-print" open={open} onToggle={e=>setOpen((e.target as HTMLDetailsElement).open)}>
  <summary><ImagePlus size={17} aria-hidden="true"/><span>{c.module}</span></summary>
  <div className="art-studio-body">
   <ArtworkPicker story={story} disabled={busy} onChange={onArtwork}/>
   <StoryArt story={story} busy={busy} drawing={drawing} onGenerate={onGenerate} onInstructions={onInstructions} onSelect={onSelect} onRemove={onRemove}/>
  </div>
 </details>;
}
