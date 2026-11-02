import {type Story} from './story';
// Legacy keys still parse saved stories, but no longer select generic stock art.
export type Artwork='none'|'memories'|'together'|'journey'|'generated';
// Artwork resolution (spec item 4): 'none' is the explicit text-only opt-out;
// an absent choice is "no decision yet" and defaults to illustrated — once an
// illustration exists it is the keepsake's artwork unless the storyteller
// picked a photograph or opted out. Before an illustration exists, an absent
// choice degrades to the photograph, else text-only.
export function chosenArtwork(story:Story):Artwork{
 if(story.artwork==='none')return 'none';
 if(story.generatedArt&&(story.artwork===undefined||story.artwork==='generated'))return 'generated';
 return story.photo?'memories':'none';
}
export function artworkPath(story:Story){return chosenArtwork(story)==='generated'?story.generatedArt?.data:undefined;}
// Client-side storage headroom for adding generated artwork: the guard the
// manual buttons and the default-illustration auto-run share. The image
// schema caps a single illustration at 300,000 chars; the device draft
// budget keeps ~2.18M chars free of the 2.5M localStorage cap.
export const ART_HEADROOM_MIN=50000;
export function artHeadroom(story:Story){return Math.min(300000,2180000-new TextEncoder().encode(JSON.stringify({...story,generatedArt:undefined})).length);}
export const artworkCopy={
 en:{choose:'Artwork',hint:'Use your own photo or create an illustration from your story below.',none:'Text only',photo:'Use my photograph',module:'Illustration'},
 zh:{choose:'故事画面',hint:'使用你自己的照片，或在下方根据故事创作插画。',none:'纯文字',photo:'使用上传的照片',module:'插画'},
 es:{choose:'Imágenes',hint:'Usa tu propia foto o crea una ilustración de tu historia abajo.',none:'Solo texto',photo:'Usar mi fotografía',module:'Ilustración'}
};
export function artworkCaption(story:Story){return chosenArtwork(story)==='generated'?{en:'AI illustration inspired by your story · an artistic interpretation',zh:'根据你的故事创作的 AI 插画 · 艺术化呈现',es:'Ilustración de IA inspirada en tu historia · interpretación artística'}[story.language]:story.photoCaption||'';}
export function artworkAlt(story:Story){return chosenArtwork(story)==='generated'?{en:story.generatedArt?.style==='comic'?'A three-panel illustrated interpretation of this story.':'An illustration inspired by this story.',zh:story.generatedArt?.style==='comic'?'根据这段故事创作的三格漫画。':'根据这段故事创作的插画。',es:story.generatedArt?.style==='comic'?'Una interpretación de esta historia en tres viñetas.':'Una ilustración inspirada en esta historia.'}[story.language]:story.photoCaption||'';}
