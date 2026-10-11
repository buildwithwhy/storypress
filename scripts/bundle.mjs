import { build } from 'esbuild';
import fs from 'node:fs/promises';
const client = await build({entryPoints:['app/client.tsx'],bundle:true,write:false,minify:true,format:'esm',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},target:['es2020']});
const javascript=client.outputFiles[0].text;
const css=(await fs.readFile('app/globals.css','utf8')).replace("@import 'tailwindcss';",'');
const icon=await fs.readFile('public/favicon.svg','utf8');
const html='<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Tell a memory, rediscover its world, and create a personal newspaper."><title>Storypress — Your stories, worth keeping</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><noscript>Storypress needs JavaScript to help you collect your story.</noscript><script type="module" src="/app.js"></script></body></html>';
await build({entryPoints:['worker/main.ts'],bundle:true,outfile:'worker/index.js',format:'esm',platform:'browser',target:['es2022'],minify:true,plugins:[{name:'storypress-assets',setup(b){b.onResolve({filter:/^virtual:storypress-assets$/},()=>({path:'assets',namespace:'storypress'}));b.onLoad({filter:/.*/,namespace:'storypress'},()=>({contents:'export const html='+JSON.stringify(html)+';export const css='+JSON.stringify(css)+';export const javascript='+JSON.stringify(javascript)+';export const icon='+JSON.stringify(icon)+';',loader:'js'}));}}]});
console.log('Bundled client and API into worker/index.js');
