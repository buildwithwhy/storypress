// Keep generated art small enough to save alongside an uploaded photograph.
export async function compactImage(data:string,maximum=300000):Promise<string>{
 if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data)||data.length>12000000)throw new Error('The illustration could not be opened. Your story is kept.');
 const image=new Image();
 await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Could not prepare this illustration. Your story is kept.'));image.src=data;});
 if(!image.width||!image.height||image.width*image.height>20000000)throw new Error('This illustration is too large. Your story is kept.');
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('Could not prepare the illustration.');
 for(const size of [1200,960,720]){
  const scale=Math.min(1,size/Math.max(image.width,image.height));canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
  ctx.fillStyle='#fffdf5';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  for(const quality of [.82,.68,.52,.4]){const output=canvas.toDataURL('image/jpeg',quality);if(output.length<=maximum)return output;}
 }
 throw new Error('This story has too much photo or text data to add artwork. Your existing story is kept.');
}
