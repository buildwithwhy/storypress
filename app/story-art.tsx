import {BookOpen,Check,ImagePlus,LoaderCircle,Trash2} from 'lucide-react';
import {type Story} from '../lib/story';

const copy={
 en:{
  title:'Make art from your story',illustrate:'Illustrate my story',comic:'Make a comic',
  redrawIllustration:'Redraw illustration',redrawComic:'Redraw comic',
  hint:'Uses your story to create new artwork. Included in your daily AI allowance.',
  redrawHint:'Each redraw creates new artwork and uses your daily AI allowance.',
  interpretation:'An artistic interpretation of your story.',
  working:'Drawing your story…',wait:'This may take a minute. You can keep reading while it draws.',
  keep:'Keep this artwork',selected:'Included in your newspaper',remove:'Remove artwork',
  illustrationAlt:'An illustration inspired by your story',comicAlt:'A comic inspired by your story',
  sample:'Start your own story to create artwork for it.'
 },
 zh:{
  title:'把你的故事画出来',illustrate:'为我的故事画插画',comic:'把故事画成漫画',
  redrawIllustration:'重新画插画',redrawComic:'重新画漫画',
  hint:'根据你的故事创作画面，计入每日 AI 使用额度。',
  redrawHint:'每次重画都会创作新的画面，并使用每日 AI 额度。',
  interpretation:'这是对你故事的艺术呈现。',
  working:'正在把故事画出来……',wait:'可能需要一分钟，等待时可以继续阅读你的故事。',
  keep:'使用这幅画',selected:'已放进你的报纸',remove:'移除画面',
  illustrationAlt:'根据你的故事创作的插画',comicAlt:'根据你的故事创作的漫画',
  sample:'开始自己的故事后，就可以为它创作画面。'
 },
 es:{
  title:'Dale imágenes a tu historia',illustrate:'Ilustrar mi historia',comic:'Crear un cómic',
  redrawIllustration:'Redibujar la ilustración',redrawComic:'Redibujar el cómic',
  hint:'Usa tu historia para crear nuevas imágenes. Se incluye en tu límite diario de uso de IA.',
  redrawHint:'Cada nueva versión crea otras imágenes y utiliza tu límite diario de IA.',
  interpretation:'Una interpretación artística de tu historia.',
  working:'Dibujando tu historia…',wait:'Puede tardar un minuto. Puedes seguir leyendo mientras se dibuja.',
  keep:'Usar estas imágenes',selected:'Incluidas en tu periódico',remove:'Quitar las imágenes',
  illustrationAlt:'Una ilustración inspirada en tu historia',comicAlt:'Un cómic inspirado en tu historia',
  sample:'Empieza tu propia historia para crear imágenes para ella.'
 }
};

type StoryArtProps={
 story:Story;
 busy:boolean;
 onGenerate:(style:'illustration'|'comic')=>void;
 onSelect:()=>void;
 onRemove:()=>void;
};

export function StoryArt({story,busy,onGenerate,onSelect,onRemove}:StoryArtProps){
 const c=copy[story.language],art=story.generatedArt;
 const selected=story.artwork==='generated';
 const disabled=busy||story.sample;
 return <section className="story-art" lang={story.language} aria-label={c.title} aria-busy={busy}>
  <h2>{c.title}</h2>
  <p className="story-art-hint">{art?c.redrawHint:c.hint}</p>
  <div className="story-art-create">
   <button type="button" className="secondary" disabled={disabled} onClick={()=>onGenerate('illustration')}><ImagePlus size={19} aria-hidden="true"/>{art?c.redrawIllustration:c.illustrate}</button>
   <button type="button" className="secondary" disabled={disabled} onClick={()=>onGenerate('comic')}><BookOpen size={19} aria-hidden="true"/>{art?c.redrawComic:c.comic}</button>
  </div>
  {story.sample&&<p className="story-art-hint">{c.sample}</p>}
  {busy&&<div className="story-art-progress" role="status"><LoaderCircle size={20} aria-hidden="true"/><div><p>{c.working}</p><p className="story-art-hint">{c.wait}</p></div></div>}
  {art&&<div className="story-art-result">
   <figure><img src={art.data} alt={art.style==='comic'?c.comicAlt:c.illustrationAlt} decoding="async"/><figcaption>{c.interpretation}</figcaption></figure>
   <div className="story-art-actions">
    {selected?<p className="story-art-selected"><Check size={17} aria-hidden="true"/>{c.selected}</p>:<button type="button" className="secondary" disabled={disabled} onClick={onSelect}><Check size={17} aria-hidden="true"/>{c.keep}</button>}
    <button type="button" className="text-button" disabled={disabled} onClick={onRemove}><Trash2 size={15} aria-hidden="true"/>{c.remove}</button>
   </div>
  </div>}
 </section>;
}
