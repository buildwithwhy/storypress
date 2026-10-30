// Paywall client-gate checks (paywall §5): renders StoryStart's three locked
// states (sample-disabled, needs-sign-in, limit-reached) and the UpgradePanel
// (plan state, dormant, entitled, owner-tree guard) in every language, and
// asserts the pure gate helper matches what the server's reserve RPC would
// decide. React renders server-side with everything mocked — no network, no
// billing lookups from the client bundle.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {StoryStart} from './app/story-start.tsx';
import {UpgradePanel} from './app/sharing.tsx';
import {freeStoryLimitReached} from './lib/billing.ts';
import {checkoutReturnId,startCheckout,confirmCheckout} from './lib/billing-client.ts';
import {paywallCopy} from './lib/paywall-copy.ts';
export const render=props=>renderToStaticMarkup(React.createElement(StoryStart,props));
export const renderPanel=props=>renderToStaticMarkup(React.createElement(UpgradePanel,props));
export {freeStoryLimitReached,checkoutReturnId,startCheckout,confirmCheckout,paywallCopy};
`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',packages:'external'});
// Resolve React from this repository while importing the generated check.
import fs from 'node:fs/promises';
const path=new URL('../work/paywall-check.mjs',import.meta.url);await fs.mkdir(new URL('../work/',import.meta.url),{recursive:true});await fs.writeFile(path,bundle.outputFiles[0].text);
const {render,renderPanel,freeStoryLimitReached,checkoutReturnId,startCheckout,confirmCheckout,paywallCopy}=await import(path.href);

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

// ---- UpgradePanel (paywall §5): plan state, cadence + lifetime, guard ----
const panelBase={language:'en',ownerTree:true};
const freeUnder={configured:true,plan:'free',addons:[],storiesCreated:1,freeStoryLimit:3};
const freeAtCap={configured:true,plan:'free',addons:[],storiesCreated:3,freeStoryLimit:3};
const dormant={configured:false,plan:'free',addons:[],storiesCreated:3,freeStoryLimit:3};
const entitled={configured:true,plan:'subscription',addons:[],storiesCreated:9,freeStoryLimit:3};

const under=renderPanel({...panelBase,billing:freeUnder});
assert.ok(under.includes('1 of 3 free stories used'),'the usage line reflects the billing payload, never a hard-coded count');
assert.ok(under.includes('Monthly')&&under.includes('Annual')&&under.includes('Lifetime — one payment'),'the cadence toggle and lifetime option render together');
assert.ok(under.includes('Continue to checkout'),'the checkout CTA renders when billing is configured');
assert.ok(!under.includes('payment is not connected yet'),'no dormant note while configured');

const atCap=renderPanel({...panelBase,billing:freeAtCap,language:'zh'});
assert.ok(atCap.includes('已使用 3/3 个免费故事'),'the zh usage line interpolates both counters');
assert.ok(atCap.includes('按月')&&atCap.includes('终身——一次付清'),'the zh panel carries the pay options');

const dormantPanel=renderPanel({...panelBase,billing:dormant,language:'zh'});
assert.ok(dormantPanel.includes('已使用 3/3 个免费故事'),'the limit stays legible while billing is dormant');
assert.ok(dormantPanel.includes('在线支付尚未开通'),'the dormant note explains the missing pay options');
assert.ok(!dormantPanel.includes('按月')&&!dormantPanel.includes('前往结账'),'a dormant panel never shows a pay button that would only error');

const entitledPanel=renderPanel({...panelBase,billing:entitled,language:'es'});
assert.ok(entitledPanel.includes('Historias ilimitadas — suscripción activa'),'the entitled plan line renders');
assert.ok(!entitledPanel.includes('Ir al pago')&&!entitledPanel.includes('Mensual'),'an entitled owner is not offered checkout again');

assert.equal(renderPanel({...panelBase,billing:freeUnder,ownerTree:false}),'','the guard renders nothing outside the owner tree');

// ---- Checkout return parsing and the server-verified rescue ----
assert.equal(checkoutReturnId('?billing_checkout=cs_test_a1b2C3d4'),'cs_test_a1b2C3d4','a well-shaped session id is returned');
assert.equal(checkoutReturnId(''),undefined,'an empty search has no return id');
assert.equal(checkoutReturnId('?billing_checkout=<script>alert(1)</script>'),undefined,'a non-session-id value is rejected before any server call');
assert.equal(checkoutReturnId('?billing_checkout=cs_short'),undefined,'a too-short id is rejected');
assert.equal(checkoutReturnId('?other=param'),undefined,'a search without the return key has no id');

// startCheckout + confirmCheckout against a mocked same-origin API.
const originalFetch=globalThis.fetch;
let requestBody,requests=0;
globalThis.fetch=async(url,init)=>{
 requests++;requestBody=JSON.parse(init.body);
 assert.equal(url,'/api/billing','billing requests stay same-origin');
 return {ok:true,status:200,json:async()=>requestBody.action==='checkout'
  ?{url:'https://checkout.stripe.com/pay/mock'}
  :{billing:{configured:true,plan:'lifetime',addons:[],storiesCreated:4,freeStoryLimit:3}}};
};
assert.equal(await startCheckout('annual'),'https://checkout.stripe.com/pay/mock');
assert.deepEqual(requestBody,{action:'checkout',mode:'subscription',plan:'annual'},'the checkout request names the cadence');
const rescued=await confirmCheckout('cs_test_a1b2C3d4');
assert.deepEqual(rescued,{configured:true,plan:'lifetime',addons:[],storiesCreated:4,freeStoryLimit:3},'the rescue parses the server-verified billing block');
assert.deepEqual(requestBody,{action:'status',sessionId:'cs_test_a1b2C3d4'},'the rescue asks the server to verify the session');
globalThis.fetch=originalFetch;

// ---- paywall copy module: shape, placeholders, and language coverage ----
const expectedKeys=['limitTitle','limitBody','limitCta','planHeading','freeUsage','subscriptionActive','lifetimeActive','monthly','annual','lifetime','checkout','checkoutBusy','dormant','checkoutConfirmed','checkoutPending'].sort();
for(const language of ['en','zh','es']){
 const copy=paywallCopy[language];
 assert.deepEqual(Object.keys(copy).sort(),expectedKeys,`${language} carries exactly the paywall copy keys`);
 for(const [key,value] of Object.entries(copy))assert.ok(value.trim().length>0,`${language}.${key} is never empty`);
 assert.ok(copy.limitTitle.includes('{limit}')&&copy.freeUsage.includes('{used}')&&copy.freeUsage.includes('{limit}'),`${language} interpolation placeholders survive the module extraction`);
}
assert.notEqual(paywallCopy.en.limitCta,paywallCopy.zh.limitCta,'translations are distinct, not copy-pasted');
assert.notEqual(paywallCopy.en.checkoutPending,paywallCopy.es.checkoutPending,'es copy is its own translation');

console.log('Passed paywall client gates: paywallCopy shape/placeholders/coverage across en/zh/es, freeStoryLimitReached truth table (dormancy, free cap, paid plans, zero allowance), StoryStart limitReached state with upgrade CTA in en/zh/es, resume stays free, UpgradePanel plan state/dormant/entitled/owner-tree guard, checkout return-id shape checks, and the server-verified status rescue. React rendered server-side; no network calls.');
