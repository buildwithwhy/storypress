import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
import fs from 'node:fs/promises';
const bundle=await build({stdin:{contents:"export * from './lib/story.ts';export * from './lib/edition.ts';export * from './lib/reader.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {initialStory,samplePaper,editionHtml,editionSnapshot,readerCopy}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const token='a'.repeat(64),url='https://story.test/s/'+token;
for(const language of ['en','zh','es']){
 const story={...initialStory,language,approved:true,turns:[{role:'user',text:'PRIVATE NOTES'}],artInstructions:'PRIVATE ART',paper:{...samplePaper,headline:'A <script>bad()</script> memory'}};
 const snapshot=editionSnapshot(story),html=editionHtml(snapshot,undefined,{webReader:true}),offline=editionHtml(snapshot);
 assert.ok(!html.includes('PRIVATE'));
 assert.ok(!html.includes('<script>bad()</script>'));
 assert.ok(html.includes('<h1 class="keepsake-title">A &lt;script&gt;bad()&lt;/script&gt; memory</h1>'));
 assert.ok(html.includes(readerCopy[language].noLogin));
 assert.ok(!/<(?:script|link|img)[^>]+(?:src|href)="https?:/i.test(html),'Reader must not load external assets');
 assert.ok(!offline.includes('id="reader-share"')&&!offline.includes('location.origin'),'Offline copies must not depend on the publishing host');
 assert.ok(!html.split('</head>')[0].includes('A &lt;script&gt;'),'Story text stays out of social metadata');
 const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 function context(navigator){
  const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{hidden:true,value:'',textContent:'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn;},focus(){this.focused=true;},select(){this.selected=true;}});return elements.get(id);};
  const state={document:{querySelectorAll:()=>['reader-share','reader-copy','reader-print'].map(get),getElementById:get,title:'Storypress'},navigator,location:{origin:'https://story.test',pathname:'/s/'+token,search:'?download=0',hash:'#test'},window:{print(){state.printed=true;}}};
  vm.runInNewContext(source,state);return {state,get};
 }
 let shared;const native=context({share:async value=>{shared=value;}});await native.get('reader-share').listeners.click();assert.equal(shared.url,url);assert.equal(native.get('reader-link').hidden,true);
 const cancelled=context({share:async()=>{throw {name:'AbortError'};}});await cancelled.get('reader-share').listeners.click();assert.equal(cancelled.get('reader-link').hidden,true,'Cancel does not become an error or copy action');
 let copied;const copy=context({clipboard:{writeText:async value=>{copied=value;}}});await copy.get('reader-share').listeners.click();assert.equal(copied,url);assert.equal(copy.get('reader-status').textContent,readerCopy[language].copied);
 const denied=context({clipboard:{writeText:async()=>{throw Error('Denied');}}});await denied.get('reader-copy').listeners.click();assert.equal(denied.get('reader-link').hidden,false);assert.equal(denied.get('reader-address').value,url);assert.ok(denied.get('reader-address').selected);assert.equal(denied.get('reader-status').textContent,readerCopy[language].manual);
 const unavailable=context({share:async()=>{throw {name:'NotAllowedError'};}});await unavailable.get('reader-share').listeners.click();assert.equal(unavailable.get('reader-link').hidden,false);
 await native.get('reader-print').listeners.click();assert.ok(native.state.printed);
}
const css=await fs.readFile('dist-public/app.css','utf8');assert.ok(!css.includes('fonts.googleapis.com')&&!css.includes('fonts.gstatic.com'));assert.ok(css.includes('data:font/woff2;base64,'));
console.log('Passed reader checks: three languages, no external assets, private-data and metadata boundaries, offline independence, native sharing, cancellation, clipboard denial and manual fallback, print action, bundled fonts.');
