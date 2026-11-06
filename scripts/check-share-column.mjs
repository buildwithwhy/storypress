// Wave 6 share column: the paper page's sharing panel renders EXACTLY three
// stacked full-width actions — Create keepsake cards, Share keepsake, Share
// link — and zero standing paragraph blocks. The share-link label is one
// localized string that never flips on url presence. Rendered here through
// ReactDOMServer (the check-video-action pattern) so the assertions see the
// real DOM, not a source scan.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const bundlePath='/tmp/storypress-share-column-bundle.cjs';
const bundled=await build({stdin:{contents:"export {Sharing} from './app/sharing.tsx';export * as React from 'react';export * as ReactDOMServer from 'react-dom/server';export {initialStory} from './lib/story';export {sharingCopy} from './lib/sharing-copy';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',loader:{'.jpg':'dataurl','.txt':'text'}});
writeFileSync(bundlePath,bundled.outputFiles[0].text);
const {Sharing,React,ReactDOMServer,initialStory,sharingCopy}=createRequire(import.meta.url)(bundlePath);

// Sharing reads location.origin for the published /s/ url; the server render
// runs in Node, where the component never runs in production.
globalThis.location=new URL('https://storypress.test/');

const story={...initialStory,name:'Mei',language:'en',approved:true,paper:{headline:'The garden',standfirst:'Rows of tomatoes.',paragraphs:['Summer in the garden.'],quote:''}};
const config={user:{id:'u1',email:'mei@example.com'},supabase:{url:'https://storypress-test.supabase.co',key:'test-only'},storage:true,linkSharing:true,dailyUnits:null,billing:{configured:false,plan:'free',addons:[],storiesCreated:0,freeStoryLimit:3}};
const noop=async()=>{};
const handlers={onSave:noop,onSaveSeparate:async()=>{},onChangeSharing:noop,onLoad:async()=>{},onNew:async()=>{},onDelete:async()=>{},storageKey:'k',onPrepareSignIn:()=>()=>{}};
const h=(type,props,...kids)=>React.createElement(type,props,...kids);
const render=(language,saved)=>ReactDOMServer.renderToStaticMarkup(h(Sharing,{...handlers,story:{...story,language},config,saved,cardsTrigger:h('button',null,'Create keepsake cards')}));

// The stack column: exactly three buttons, led by the card trigger.
const saved={id:'s1',revision:1,share_token:'a'.repeat(64)};
const markup=render('en',saved);
const stack=markup.match(/<div class="sharing-actions sharing-actions--stack">([\s\S]*?)<\/div>/);
assert.ok(stack,'the sharing panel renders the stacked share column');
const buttons=[...stack[1].matchAll(/<button/g)];
assert.equal(buttons.length,3,'the share column renders exactly three stacked buttons');
assert.ok(stack[1].indexOf('Create keepsake cards')>-1&&stack[1].indexOf('Share keepsake')>-1&&stack[1].indexOf('Share link')>-1,
  'the column holds Create keepsake cards, Share keepsake, and Share link in that order');
assert.ok(stack[1].indexOf('Create keepsake cards')<stack[1].indexOf('Share keepsake')&&stack[1].indexOf('Share keepsake')<stack[1].indexOf('Share link'),'the column order is cards, keepsake, link');

// Zero standing paragraph blocks: every removed standing copy string is gone
// from the rendered panel (transient notices render only after an action).
const removed=[
  sharingCopy.en.private,'Review and approve your keepsake','Online sharing is not open yet',
  'Anyone with this link can read','last published edition','Recipients can read, save and print',
  'Saving or sharing from an app?','Turning a link off stops future access',
  'Send a copy','Download keepsake','Update shared edition','Send link','Copy link','Post your keepsake, or send a reading link',
];
for(const text of removed)assert.ok(!markup.includes(text),`the standing paragraph must be gone from the share group: "${text}"`);

// Share link never flips: identical label with and without an existing token.
const withoutLink=render('en',null);
assert.ok(withoutLink.includes('Share link'),'the Share link button renders before a link exists');
assert.ok(withoutLink.includes('Share link')===markup.includes('Share link'),'the Share link label never flips on url presence');
const sharingSrc=readFileSync('app/sharing.tsx','utf8');
assert.ok(!sharingSrc.includes('c.update')&&!sharingSrc.includes('c.web'),'the share-link label logic no longer reads url presence');

// The published link surface keeps the manual fallbacks: the readonly input
// (select-on-focus), the reading-page preview, and Turn link off.
assert.ok(markup.includes('id="published-story-link"'),'the readonly link input stays for the manual copy fallback');
assert.ok(markup.includes('Preview reading page'),'the reading-page preview anchor stays');
assert.ok(markup.includes('Turn link off'),'Turn link off stays');

// Localized labels for en/zh/es.
assert.match(render('zh',null),/分享作品/);
assert.match(render('zh',null),/分享链接/);
assert.match(render('es',null),/Compartir recuerdo/);
assert.match(render('es',null),/Compartir enlace/);
for(const language of ['en','zh','es']){
  for(const key of ['send','download','web','update','copy','link','linkWait','approve','offNote']){
    assert.ok(!(key in sharingCopy[language]),`sharingCopy.${language}.${key} is deleted (merged or paragraph)`);
  }
}

// Post-generation PNG card sharing stays attached to the card preview, not
// the column: the keepsake-studio preview owns the per-card save and share.
const studioSrc=readFileSync('app/keepsake-studio.tsx','utf8');
assert.ok(studioSrc.includes('download={`storypress-${index+1}.png`}')&&studioSrc.includes('share-image-preview'),'the per-card save/share stay on the preview block');
assert.ok(!stack[1].includes('storypress-1.png'),'the column carries no per-card actions');

// Wave 6 rework: the paper share panel's heading is ONE small brand eyebrow —
// no h2, no paragraphs — above the three stacked actions.
assert.ok(markup.includes('ONCE &amp; OURS'),'the paper share panel renders the brand eyebrow line');
assert.ok(!/<h2>/.test(markup),'the paper share panel renders no heading above the column');
assert.ok(!markup.includes(sharingCopy.en.title),'the Keep-it heading left the paper share panel');
const stackIndex=markup.indexOf('<div class="sharing-actions sharing-actions--stack">');
assert.ok(markup.slice(0,stackIndex).includes('ONCE &amp; OURS'),'the brand eyebrow renders above the stacked column');

// Wave 6 rework: the account modal has no explicit save button — signed-in
// stories auto-save (700ms debounced flush, pagehide flush, save-on-navigate)
// and failures surface in the error banner with Retry. View plans moved into
// the usage box via onViewPlans.
const modal=ReactDOMServer.renderToStaticMarkup(h(Sharing,{...handlers,onClose:()=>{},onViewPlans:()=>{},story:{...story,language:'en'},config,saved,accountOnly:true}));
assert.ok(!modal.includes('Save privately to my account'),'the explicit save-privately button is gone from the account modal');
assert.ok(modal.includes('mei@example.com'),'the account email still renders in the modal');
const usageAt=modal.indexOf('0 of 3 free stories used'),plansAt=modal.indexOf('View plans');
assert.ok(usageAt>-1,'the usage box renders in the account modal');
assert.ok(plansAt>usageAt,'View plans renders inside/under the usage box');
assert.ok(modal.slice(plansAt-200,plansAt).includes('view-plans'),'the View plans entry is the larger view-plans variant');

console.log('Passed: wave 6 share column — exactly three stacked full-width buttons (cards, keepsake, link), zero standing paragraph blocks, a Share link label that never flips and always PATCHes first, localized en/zh/es labels, and per-card sharing still attached to the card preview.');
