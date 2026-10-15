import type {Story} from './story';
import {editionSnapshot} from './edition';
import {artworkPath,chosenArtwork} from './artwork';
import {keepsakeCopy} from './keepsake';
// Canvas text is rendered locally. No story content goes to an image-generation service.
export function wrapLines(text:string,maxWidth:number,measure:(s:string)=>number):string[]{
 const lines:string[]=[];let line='';
 // Spaces are retained. CJK and long words break by code point rather than overflowing.
 for(const word of text.split(/(\s+)/)){
  if(word.includes('\n')){for(const [i,part] of word.split('\n').entries()){if(i){lines.push(line.trimEnd());line='';}line+=part;}continue;}
  if(measure(line+word)<=maxWidth){line+=word;continue;}
  if(line.trim()){lines.push(line.trimEnd());line='';}
  for(const ch of Array.from(word.trimStart())){if(line&&measure(line+ch)>maxWidth){lines.push(line);line='';}line+=ch;}
 }
 if(line.trim())lines.push(line.trimEnd());return lines;
}
export async function shareImages(story:Story):Promise<Blob[]>{
 const s=editionSnapshot(story),p=s.paper!,c=keepsakeCopy[s.language];
 await document.fonts?.ready;
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser could not prepare the images.');
 const src=chosenArtwork(s)==='none'?undefined:chosenArtwork(s)!=='generated'&&s.photo?s.photo:artworkPath(s);
 let art:HTMLImageElement|undefined;
 if(src){art=new Image();art.src=src;await new Promise<void>((resolve,reject)=>{art!.onload=()=>resolve();art!.onerror=()=>reject(new Error('The illustration could not load. Try again.'));if(art!.complete&&art!.naturalWidth)resolve();});}
 ctx.font='40px Georgia, "Songti SC", serif';
 const measure=(text:string)=>ctx.measureText(text).width;
 const prose=p.paragraphs.flatMap((text,i)=>[...wrapLines(text,900,measure),...(i<p.paragraphs.length-1?['']:[])]);
 const pages:string[][]=[];let first=true;
 while(prose.length){const count=first&&art?9:15;pages.push(prose.splice(0,count));first=false;}
 const blobs:Blob[]=[];
 for(const [index,lines]of pages.entries()){
  ctx.fillStyle='#fffaf0';ctx.fillRect(0,0,1080,1350);ctx.fillStyle='#294b3b';ctx.fillRect(0,0,1080,12);
  ctx.font='22px system-ui';ctx.fillText('STORYPRESS  /  '+c.page+' '+(index+1)+' · '+pages.length,90,75);
  ctx.font='54px Georgia, "Songti SC", serif';
  let title=wrapLines(p.headline,900,measure);let size=54;
  while(title.length>3&&size>28){size-=2;ctx.font=`${size}px Georgia, "Songti SC", serif`;title=wrapLines(p.headline,900,measure);}
  let y=145;for(const line of title){ctx.fillText(line,90,y);y+=size*1.2;}
  y=Math.max(y+25,350);
  if(index===0&&art){const height=240,ratio=Math.min(900/art.naturalWidth,height/art.naturalHeight);ctx.drawImage(art,90+(900-art.naturalWidth*ratio)/2,y,art.naturalWidth*ratio,art.naturalHeight*ratio);y+=height+35;}
  ctx.font='40px Georgia, "Songti SC", serif';ctx.fillStyle='#29382d';for(const line of lines){ctx.fillText(line,90,y);y+=53;}
  ctx.strokeStyle='#c8c5b2';ctx.beginPath();ctx.moveTo(90,1250);ctx.lineTo(990,1250);ctx.stroke();ctx.font='23px system-ui';ctx.fillStyle='#68725d';const footer=s.name?`${c.by} ${s.name}`:c.credit;let footerSize=23;while(ctx.measureText(footer).width>900&&footerSize>12){footerSize--;ctx.font=`${footerSize}px system-ui`;}ctx.fillText(footer,90,1295);
  blobs.push(await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Image export failed.')),'image/png')));
 }
 return blobs;
}
