import http from 'node:http';
import fs from 'node:fs';
import worker from '../dist/server/index.js';
const env={};
try {for(const line of fs.readFileSync('.dev.vars','utf8').split('\n')){const m=line.match(/^([A-Z_]+)\s*=\s*(.*)$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,'');}}catch{}
for(const name of ['GEMINI_API_KEY','NIMBLE_API_KEY','GEMINI_MODEL','GEMINI_IMAGE_MODEL','GEMINI_INTERVIEW_MODEL','GEMINI_WRITING_MODEL','GEMINI_PHOTO_MODEL','GEMINI_TRANSCRIPTION_MODEL','GEMINI_RESEARCH_MODEL','GEMINI_BACKEND','VERTEX_API_KEY','GOOGLE_CLOUD_PROJECT','GOOGLE_CLOUD_LOCATION']) if(process.env[name]) env[name]=process.env[name];
const port=Number(process.env.STORYPRESS_PORT||4173);
http.createServer(async(req,res)=>{try{const chunks=[];for await (const chunk of req){chunks.push(chunk);if(chunks.reduce((n,c)=>n+c.length,0)>11000000){res.writeHead(413);res.end('Too large');return;}}const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);headers.set('oai-authenticated-user-id','local-preview');const request=new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const out=await worker.fetch(request,env,{});res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));}catch{res.writeHead(500);res.end('Preview error');}}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
