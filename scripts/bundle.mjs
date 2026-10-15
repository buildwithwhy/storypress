import { build } from 'esbuild';
import fs from 'node:fs/promises';
const client = await build({entryPoints:['app/client.tsx'],bundle:true,write:false,minify:true,format:'esm',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},target:['es2020']});
const javascript=client.outputFiles[0].text;
const css=(await fs.readFile('app/globals.css','utf8')).replace("@import 'tailwindcss';",'')+'\n'+await fs.readFile('app/research-thread.css','utf8')+'\n'+await fs.readFile('app/story-art.css','utf8')+'\n'+await fs.readFile('app/start-flow.css','utf8');
const icon=await fs.readFile('public/favicon.svg','utf8');
const html='<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Tell a memory, rediscover its world, and create a personal newspaper."><title>Storypress — Your stories, worth keeping</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><noscript>Storypress needs JavaScript to help you collect your story.</noscript><script type="module" src="/app.js"></script></body></html>';
await build({entryPoints:['worker/main.ts'],bundle:true,outfile:'worker/index.js',loader:{'.txt':'text','.jpg':'dataurl'},format:'esm',platform:'browser',target:['es2022'],minify:true,plugins:[{name:'storypress-assets',setup(b){b.onResolve({filter:/^virtual:storypress-assets$/},()=>({path:'assets',namespace:'storypress'}));b.onLoad({filter:/.*/,namespace:'storypress'},()=>({contents:'export const html='+JSON.stringify(html)+';export const css='+JSON.stringify(css)+';export const javascript='+JSON.stringify(javascript)+';export const icon='+JSON.stringify(icon)+';',loader:'js'}));}}]});
console.log('Bundled client and API into worker/index.js');

// Vercel serves static assets separately; both hosts use the same bundled API.
if(process.argv.includes('--vercel')){
 await fs.rm('dist-public',{recursive:true,force:true});
 await fs.mkdir('dist-public',{recursive:true});
 await Promise.all(Object.entries({'index.html':html,'app.js':javascript,'app.css':css,'favicon.svg':icon}).map(([name,content])=>fs.writeFile('dist-public/'+name,content)));
 await fs.cp('public/artwork','dist-public/artwork',{recursive:true});
 console.log('Built Vercel static assets in dist-public');
}
