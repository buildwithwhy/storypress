// Paywall client-gate checks (paywall §5): renders StoryStart's three locked
// states (sample-disabled, needs-sign-in, limit-reached) in every language and
// asserts the pure gate helper matches what the server's reserve RPC would
// decide. React renders server-side with everything mocked — no network, no
// billing lookups from the client bundle.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {StoryStart} from './app/story-start.tsx';
import {freeStoryLimitReached} from './lib/billing.ts';
export const render=props=>renderToStaticMarkup(React.createElement(StoryStart,props));
export {freeStoryLimitReached};
`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',packages:'external'});
// Resolve React from this repository while importing the generated check.
import fs from 'node:fs/promises';
const path=new URL('../work/paywall-check.mjs',import.meta.url);await fs.mkdir(new URL('../work/',import.meta.url),{recursive:true});await fs.writeFile(path,bundle.outputFiles[0].text);
const {render,freeStoryLimitReached}=await import(path.href);

const base={disabled:false,hasDraft:false,needsSignIn:false,fromShared:false,freeLimit:3,onUpgrade:()=>{},onStart:()=>{},onContinue:()=>{},children:null};

// Gate helper truth table: configured + free plan + counter at the allowance.
assert.equal(freeStoryLimitReached({configured:true,plan:'free',addons:[],storiesCreated:3,freeStoryLimit:3}),true,'a free account at the cap is limit-reached');
assert.equal(freeStoryLimitReached({configured:true,plan:'free',addons:[],storiesCreated:2,freeStoryLimit:3}),false,'a free account under the cap may start stories');
assert.equal(freeStoryLimitReached({configured:false,plan:'free',addons:[],storiesCreated:99,freeStoryLimit:3}),false,'dormant billing never blocks a writer');
assert.equal(freeStoryLimitReached({configured:true,plan:'subscription',addons:[],storiesCreated:99,freeStoryLimit:3}),false,'an active subscription is never limit-reached');
assert.equal(freeStoryLimitReached({configured:true,plan:'lifetime',addons:[],storiesCreated:99,freeStoryLimit:3}),false,'a lifetime unlock is never limit-reached');
assert.equal(freeStoryLimitReached({configured:true,plan:'free',addons:[],storiesCreated:0,freeStoryLimit:0}),true,'a zero-allowance deployment gates immediately');

// Dormant default: start choices enabled, no limit block, no dead end.
const open=render({...base,language:'en'});
assert.ok(!open.includes('start-limit'),'the limit block must stay hidden while under the cap');
assert.equal((open.match(/disabled/g)||[]).length,0,'no control is disabled for a free account under the cap');

// Limit-reached state: localized copy with the real allowance, upgrade CTA,
// and start choices locked. The resume banner (continue an existing story)
// stays available — existing stories are free forever.
for(const language of ['en','zh','es']){
 const titles={en:'You have used all 3 free stories',zh:'你已经用完 3 个免费故事',es:'Has usado tus 3 historias gratis'}[language];
 const ctas={en:'Upgrade',zh:'升级',es:'Mejorar'}[language];
 const limited=render({...base,language,limitReached:true,hasDraft:true});
 assert.ok(limited.includes('start-limit'),'the limit block renders (paywall §5)');
 assert.ok(limited.includes('role="status"'),'the limit state is announced to assistive technology');
 assert.ok(limited.includes(titles),`the limit title interpolates the real allowance in ${language}`);
 assert.ok(limited.includes(ctas),`the upgrade CTA renders in ${language}`);
 assert.equal((limited.match(/disabled/g)||[]).length,3,'the three start choices are locked at the cap');
 const resume=limited.slice(limited.indexOf('resume-story'),limited.indexOf('resume-story')+300);
 assert.ok(!resume.includes('disabled'),'continuing an existing story stays available at the cap');
}

// The other two locked states keep their own meaning, without the limit block.
const sample=render({...base,language:'en',disabled:true});
assert.ok(!sample.includes('start-limit'),'the sample lock is not the limit state');
assert.equal((sample.match(/disabled/g)||[]).length,3,'the sample lock disables the start choices');
const guest=render({...base,language:'en',needsSignIn:true,limitReached:true});
assert.ok(guest.includes('start-limit')&&guest.includes('start-auth-note'),'a signed-out render keeps the sign-in note beside the limit state');

console.log('Passed paywall client gates: freeStoryLimitReached truth table (dormancy, free cap, paid plans, zero allowance), StoryStart limitReached state with upgrade CTA in en/zh/es, resume stays free, sample lock and sign-in note unchanged. React rendered server-side; no network calls.');
