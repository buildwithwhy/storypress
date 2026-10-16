import {type Story} from './story';
// Legacy keys still parse saved stories, but no longer select generic stock art.
export type Artwork='none'|'memories'|'together'|'journey'|'generated';
export function chosenArtwork(story:Story):Artwork{
 if(story.artwork==='none')return 'none';
 if(story.artwork==='generated'&&story.generatedArt)return 'generated';
 return story.photo?'memories':'none';
}
export function artworkPath(story:Story){return chosenArtwork(story)==='generated'?story.generatedArt?.data:undefined;}
export const artworkCopy={
 en:{choose:'Artwork',hint:'Use your own photo or create an illustration from your story below.',none:'Text only',photo:'Use my photograph'},
 zh:{choose:'故事画面',hint:'使用你自己的照片，或在下方根据故事创作插画。',none:'纯文字',photo:'使用上传的照片'},
 es:{choose:'Imágenes',hint:'Usa tu propia foto o crea una ilustración de tu historia abajo.',none:'Solo texto',photo:'Usar mi fotografía'}
};
export function artworkCaption(story:Story){return chosenArtwork(story)==='generated'?{en:'AI illustration inspired by your story · an artistic interpretation',zh:'根据你的故事创作的 AI 插画 · 艺术化呈现',es:'Ilustración de IA inspirada en tu historia · interpretación artística'}[story.language]:story.photoCaption||'';}
export function artworkAlt(story:Story){return chosenArtwork(story)==='generated'?{en:story.generatedArt?.style==='comic'?'A three-panel illustrated interpretation of this story.':'An illustration inspired by this story.',zh:story.generatedArt?.style==='comic'?'根据这段故事创作的三格漫画。':'根据这段故事创作的插画。',es:story.generatedArt?.style==='comic'?'Una interpretación de esta historia en tres viñetas.':'Una ilustración inspirada en esta historia.'}[story.language]:story.photoCaption||'';}
