import {type Story} from './story';
import {editionHtml,editionSnapshot} from './edition';
import {artworkPath} from './artwork';

// The download stays self-contained, including its illustration when opened offline.
export async function downloadableEdition(story:Story){
 const edition=editionSnapshot(story),path=artworkPath(edition);
 let data:string|undefined;
 if(path?.startsWith('data:'))data=path;
 else if(path){
  const response=await fetch(path);
  if(!response.ok)throw new Error('The illustration could not be downloaded. Please try again.');
  const blob=await response.blob();
  if(blob.size>1500000||!blob.type.startsWith('image/'))throw new Error('The illustration could not be opened. Please try again.');
  data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not prepare your newspaper.'));reader.readAsDataURL(blob);});
 }
 return editionHtml(edition,data);
}
