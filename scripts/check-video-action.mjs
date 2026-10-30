// check-video-action: the hidden rollout proof for the memory-video UI — the
// flag-gated action on the paper stage, its approval gate, per-language copy,
// placement beside share images, and the walkthrough property that with the
// flag off nothing renders anywhere and no other surface mentions video.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';

// The graph includes a CJS dependency that requires a Node builtin ('stream'),
// so the bundle must land in a real file (where require works) instead of a
// data: URL module, whose scope has no require at all.
const bundlePath='/tmp/storypress-video-action-bundle.cjs';
const bundled=await build({stdin:{contents:"export {ShareImages,ShareVideo} from './app/keepsake-studio.tsx';export * as React from 'react';export * as ReactDOMServer from 'react-dom/server';export {initialStory} from './lib/story';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',loader:{'.jpg':'dataurl','.txt':'text'}});
writeFileSync(bundlePath,bundled.outputFiles[0].text);
const {ShareImages,ShareVideo,React,ReactDOMServer,initialStory}=createRequire(import.meta.url)(bundlePath);

const base={...initialStory,name:'Mei',language:'en',paperLanguage:'en',approved:true,presentation:{version:1,format:'newspaper'},turns:[{role:'user',text:'The garden story.'}],sources:[],draft:'',artwork:'none',paper:{headline:'The garden',standfirst:'Rows of tomatoes.',paragraphs:['Summer in the garden.'],quote:''}};
const h=(type,props,...kids)=>React.createElement(type,props,...kids);
const markup=(story,enabled)=>ReactDOMServer.renderToStaticMarkup(h(ShareVideo,{story,enabled}));

// Hidden when off: the section is absent, not disabled — empty markup either
// way, because both the deployment flag and this keepsake's approval gate it.
assert.equal(markup(base,false),'','Flag off must render nothing');
assert.equal(markup({...base,approved:false},false),'','Flag off and unapproved must render nothing');
assert.equal(markup({...base,approved:false},true),'','Unapproved hides the action even with the flag on');
// Flag on, approved: the action with its per-language copy, and no result yet.
const idle=markup(base,true);
assert.match(idle,/aria-label="Create memory video"/);
assert.match(idle,/Create video/);
assert.ok(!idle.includes('<video ')&&!idle.includes('Save video'),'Idle state shows no result yet');
// Language follows the artifact, the same rule the editions follow.
assert.match(markup({...base,language:'zh'},true),/制作回忆视频/);
assert.match(markup({...base,language:'es'},true),/Crear video de recuerdos/);
// Beside share images: both actions render, video placed after the images.
const both=ReactDOMServer.renderToStaticMarkup(h('div',null,h(ShareImages,{story:base}),h(ShareVideo,{story:base,enabled:true})));
const imagesAt=both.indexOf('share-images'),videoAt=both.indexOf('share-video');
assert.ok(imagesAt>-1&&videoAt>-1,'Both actions render together');
assert.ok(imagesAt<videoAt,'The video action sits beside share images');

// Walkthrough: the component is the only surface. storypress touches video
// only through the services state, the import, and the paper-stage action —
// any other mention (a navigation entry, a tell-stage surface) fails here.
const source=readFileSync('app/storypress.tsx','utf8');
for(const [index,line] of source.split('\n').entries()){
 if(!/video/i.test(line))continue;
 const accounted=line.includes('video:{enabled:false}')||line.includes('ShareVideo')||line.includes('services.video.enabled');
 assert.ok(accounted,`storypress.tsx line ${index+1} mentions video outside the paper-stage action: ${line.trim().slice(0,100)}`);
}
assert.match(source,/video:\{enabled:false\}/,'The client default keeps the flag off');
// The surface lives in exactly one component file.
for(const file of readdirSync('app')){
 if(!/\.tsx$/.test(file)||file==='storypress.tsx'||file==='keepsake-studio.tsx')continue;
 assert.ok(!/ShareVideo|share-video/i.test(readFileSync(`app/${file}`,'utf8')),`${file} must not surface the video action`);
}
// The UI layer makes no network calls — the local-only rule at the surface too
// (the whole render path is asserted fetch-free in check-video.mjs).
assert.ok(!readFileSync('app/keepsake-studio.tsx','utf8').includes('fetch('),'ShareVideo renders without network calls');
console.log('Passed: hidden-when-off rendering (flag off, unapproved), the approved-and-enabled gate, per-language copy (en/zh/es), placement beside share images, and the walkthrough property that no other surface or navigation entry mentions video.');
