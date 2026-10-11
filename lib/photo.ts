import {z} from 'zod';

// No remote URLs, SVGs, file metadata or original filenames are sent to the model.
export function photoPart(value: unknown) {
 const uri=z.string().max(1800000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/).parse(value);
 const [header,data]=uri.split(',');
 const mime=header.slice(5,header.indexOf(';'));
 let signature='';
 try {signature=atob(data.slice(0,24));} catch {throw new Error('Invalid photo');}
 const matches=mime==='image/jpeg'?signature.startsWith('\xff\xd8\xff'):mime==='image/png'?signature.startsWith('\x89PNG\r\n\x1a\n'):signature.startsWith('RIFF')&&signature.slice(8,12)==='WEBP';
 if(!matches||data.length%4!==0)throw new Error('Invalid photo');
 return {type:'image' as const,data,mime_type:mime};
}
