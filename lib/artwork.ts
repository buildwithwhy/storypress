import {type Story} from './story';
export const artworkKeys=['none','memories','together','journey'] as const;
export type Artwork=typeof artworkKeys[number]|'generated';
export function chosenArtwork(story:Story):Artwork{
 if(story.artwork==='generated'&&!story.generatedArt)return story.photo?'memories':'none';
 return story.artwork??(story.occasion==='wedding'?'together':story.occasion==='graduation'?'journey':'memories');
}
export function artworkPath(story:Story){const art=chosenArtwork(story);if(art==='generated')return story.generatedArt?.data;return story.photo||art==='none'?undefined:`/artwork/${art}.jpg`;}
export const artworkCopy={
 en:{choose:'Choose the artwork',hint:'Included in your keepsake, download and print.',memories:'Little memories',together:'Together',journey:'A new chapter',none:'Text only',caption:'Editorial illustration · not a photograph of this memory',alt:{memories:'A print illustration of an open book, a cup, leaves and a letter.',together:'A print illustration of two cups, flowers and a flowing ribbon.',journey:'A print illustration of a paper boat, an open book and a sun.'}},
 zh:{choose:'选择插画',hint:'插画会保留在作品、下载和打印版本中。',memories:'点滴回忆',together:'在一起',journey:'新的篇章',none:'纯文字',caption:'装饰插画 · 并非这段回忆的真实照片',alt:{memories:'版画风格插画：展开的书、杯子、树叶和信件。',together:'版画风格插画：两个杯子、鲜花和飘动的丝带。',journey:'版画风格插画：纸船、展开的书和太阳。'}},
 es:{choose:'Elige la ilustración',hint:'Aparecerá en el recuerdo, la descarga y la impresión.',memories:'Pequeños recuerdos',together:'Juntos',journey:'Un nuevo capítulo',none:'Solo texto',caption:'Ilustración editorial · no es una fotografía de este recuerdo',alt:{memories:'Ilustración de un libro abierto, una taza, hojas y una carta.',together:'Ilustración de dos tazas, flores y una cinta.',journey:'Ilustración de un barco de papel, un libro abierto y un sol.'}}
};

export function artworkCaption(story:Story){return chosenArtwork(story)==='generated'?{en:'AI illustration inspired by your story · an artistic interpretation',zh:'根据你的故事创作的 AI 插画 · 艺术化呈现',es:'Ilustración de IA inspirada en tu historia · interpretación artística'}[story.language]:artworkCopy[story.language].caption;}
export function artworkAlt(story:Story){const key=chosenArtwork(story);return key==='none'?'':key==='generated'?{en:story.generatedArt?.style==='comic'?'A three-panel illustrated interpretation of this story.':'An illustration inspired by this story.',zh:story.generatedArt?.style==='comic'?'根据这段故事创作的三格漫画。':'根据这段故事创作的插画。',es:story.generatedArt?.style==='comic'?'Una interpretación de esta historia en tres viñetas.':'Una ilustración inspirada en esta historia.'}[story.language]:artworkCopy[story.language].alt[key];}
