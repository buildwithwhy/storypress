import {type Story} from '../lib/story';
import {type Artwork} from '../lib/artwork';
import {ArtworkPicker} from './artwork-picker';
import {StoryArt} from './story-art';

// The illustration studio's content (wave 3 fix 2): the artwork choice
// (photograph / text-only) and the generation studio — generate, redraw,
// art-direction notes and a ~200px thumbnail. The pull-up panel around it —
// the labeled entry button, the open state, self-opening while an
// illustration draws, and print-hiding — is owned by the paper page
// (storypress.tsx), like the translation panel.
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
 return <div className="art-studio-body">
  <ArtworkPicker story={story} disabled={busy} onChange={onArtwork}/>
  <StoryArt story={story} busy={busy} drawing={drawing} onGenerate={onGenerate} onInstructions={onInstructions} onSelect={onSelect} onRemove={onRemove}/>
 </div>;
}
