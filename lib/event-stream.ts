// Read bounded server-sent events across arbitrary network/UTF-8 boundaries.
export async function* eventData(body:ReadableStream<Uint8Array>,maxBytes=262144){
 const reader=body.getReader(),decoder=new TextDecoder();let pending='',data:string[]=[],bytes=0;
 const line=(value:string)=>{if(value.endsWith('\r'))value=value.slice(0,-1);if(value.startsWith('data:'))data.push(value.slice(5).replace(/^ /,''));else if(value===''){const event=data.join('\n');data=[];return event||undefined;}};
 try{
  while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>maxBytes)throw new Error('The response was too large. Your words are kept.');pending+=decoder.decode(part.value,{stream:true});let newline;
   while((newline=pending.indexOf('\n'))>=0){const event=line(pending.slice(0,newline));pending=pending.slice(newline+1);if(event!==undefined)yield event;}
  }
  pending+=decoder.decode();if(pending)line(pending);const last=line('');if(last!==undefined)yield last;
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
