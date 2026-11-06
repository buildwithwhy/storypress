// Paywall client-gate checks (paywall §5): renders StoryStart's three locked
// states (sample-disabled, needs-sign-in, limit-reached), the UpgradePanel
// usage panel (plan state, this-month usage vs cap, remaining pack credits,
// dormant, entitled incl. legacy lifetime rows, owner-tree guard), and the
// wave-8 pricing page (four options; payload-asserted amounts when billing is
// configured, labeled dormant fallback copy when not, amounts hidden when the
// Stripe payload is unavailable) in every language, and asserts the pure gate
// helper matches what the server's reserve RPC would decide. React renders
// server-side with everything mocked — no network, no billing lookups from
// the client bundle.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {StoryStart} from './app/story-start.tsx';
import {UpgradePanel} from './app/sharing.tsx';
import {PricingPanel} from './app/pricing.tsx';
import {freeStoryLimitReached} from './lib/billing.ts';
import {checkoutReturnId,startCheckout,confirmCheckout} from './lib/billing-client.ts';
import {paywallCopy} from './lib/paywall-copy.ts';
export const render=props=>renderToStaticMarkup(React.createElement(StoryStart,props));
export const renderPanel=props=>renderToStaticMarkup(React.createElement(UpgradePanel,props));
export const renderPricing=props=>renderToStaticMarkup(React.createElement(PricingPanel,props));
export {freeStoryLimitReached,checkoutReturnId,startCheckout,confirmCheckout,paywallCopy};
`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',packages:'external'});
// Resolve React from this repository while importing the generated check.
import fs from 'node:fs/promises';
const path=new URL('../work/paywall-check.mjs',import.meta.url);await fs.mkdir(new URL('../work/',import.meta.url),{recursive:true});await fs.writeFile(path,bundle.outputFiles[0].text);
const {render,renderPanel,renderPricing,freeStoryLimitReached,checkoutReturnId,startCheckout,confirmCheckout,paywallCopy}=await import(path.href);

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

// ---- UpgradePanel (paywall §5): usage panel, cadence, guard ----
const panelBase={language:'en',ownerTree:true};
const freeUnder={configured:true,plan:'free',addons:[],storiesCreated:1,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:0,packCreditsRemaining:0};
const freeAtCap={configured:true,plan:'free',addons:[],storiesCreated:3,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:0,packCreditsRemaining:0};
const dormant={configured:false,plan:'free',addons:[],storiesCreated:3,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:0,packCreditsRemaining:0};
const entitled={configured:true,plan:'subscription',addons:[],storiesCreated:9,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:12,packCreditsRemaining:27};
const legacyLifetime={configured:true,plan:'lifetime',addons:[],storiesCreated:9,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:0,packCreditsRemaining:0};

const under=renderPanel({...panelBase,billing:freeUnder});
assert.ok(under.includes('1 of 3 free stories used'),'the usage line reflects the billing payload, never a hard-coded count');
assert.ok(under.includes('Monthly')&&under.includes('Annual'),'the cadence toggle renders');
assert.ok(!under.includes('Lifetime'),'lifetime is gone from the checkout surface (wave 8)');
assert.ok(under.includes('Continue to checkout'),'the checkout CTA renders when billing is configured');
assert.ok(!under.includes('payment is not connected yet'),'no dormant note while configured');

// Wave 6 rework: View plans lives inside the upgrade panel, directly under
// the usage line — larger than the old low text-button, one tap to /pricing.
const underWithPlans=renderPanel({...panelBase,billing:freeUnder,onViewPlans:()=>{}});
const planLineAt=underWithPlans.indexOf('1 of 3 free stories used'),plansAt=underWithPlans.indexOf('View plans');
assert.ok(plansAt>planLineAt,'View plans renders inside/under the usage line');
assert.ok(underWithPlans.includes('class="secondary view-plans"'),'View plans uses the larger view-plans variant');
assert.ok(!under.includes('View plans'),'no View plans entry without a handler');

const atCap=renderPanel({...panelBase,billing:freeAtCap,language:'zh'});
assert.ok(atCap.includes('已使用 3/3 个免费故事'),'the zh usage line interpolates both counters');
assert.ok(atCap.includes('按月')&&atCap.includes('按年'),'the zh panel carries the pay options');

const dormantPanel=renderPanel({...panelBase,billing:dormant,language:'zh'});
assert.ok(dormantPanel.includes('已使用 3/3 个免费故事'),'the limit stays legible while billing is dormant');
assert.ok(dormantPanel.includes('在线支付尚未开通'),'the dormant note explains the missing pay options');
assert.ok(!dormantPanel.includes('按月')&&!dormantPanel.includes('前往结账'),'a dormant panel never shows a pay button that would only error');

const entitledPanel=renderPanel({...panelBase,billing:entitled,language:'es'});
assert.ok(entitledPanel.includes('Historias ilimitadas — tu plan está activo'),'the entitled plan line renders');
assert.ok(entitledPanel.includes('12 de 50 historias este mes'),'the monthly usage line interpolates draws and cap');
assert.ok(entitledPanel.includes('Quedan 27 créditos de paquete'),'remaining pack credits render');
assert.ok(!entitledPanel.includes('Ir al pago')&&!entitledPanel.includes('Mensual'),'an entitled owner is not offered checkout again');

// Legacy 'lifetime' entitlement rows keep a sane entitled state (wave 8 §3):
// the plan line reads entitled and the usage panel still works.
const legacyPanel=renderPanel({...panelBase,billing:legacyLifetime});
assert.ok(legacyPanel.includes('Unlimited stories — your plan is active'),'a legacy lifetime row renders a sane entitled state');
assert.ok(legacyPanel.includes('0 of 50 stories this month'),'the usage panel works for a legacy lifetime row');
assert.ok(!legacyPanel.includes('Continue to checkout'),'a legacy lifetime owner is not offered checkout again');

assert.equal(renderPanel({...panelBase,billing:freeUnder,ownerTree:false}),'','the guard renders nothing outside the owner tree');

// ---- PricingPanel (wave 8 §3): four options; amounts the payload vouches for ----
const payload={currency:'usd',monthly:{amount:999},annual:{amount:5900},pack30:{amount:1200},pack100:{amount:2900}};
const priced=renderPricing({language:'en',billing:freeUnder,pricing:payload});
assert.ok(priced.includes('Free')&&priced.includes('Monthly')&&priced.includes('Annual')&&priced.includes('30 stories')&&priced.includes('100 stories'),'the pricing page lists all four options');
assert.ok(priced.includes('$9.99')&&priced.includes('$59')&&priced.includes('$12')&&priced.includes('$29'),'displayed amounts come from the Stripe-backed payload, never copy');
assert.ok(!priced.includes('$6 ')&&!priced.includes('$120'),'no legacy copy amounts survive on a configured page');
assert.ok(priced.includes('Save 51%'),'the saving badge is computed from the payload amounts');
assert.ok(priced.includes('Up to 50 stories a month'),'the cap line interpolates the payload cap');
assert.ok(priced.includes('One-time payment. Pack credits never expire.'),'packs read as one-time, never expire');
assert.ok(priced.includes('Buy the 30-story pack')&&priced.includes('Buy the 100-story pack'),'pack buy buttons interpolate payload sizes');
assert.ok(priced.includes('Continue to checkout'),'the subscription CTA renders when billing is configured');
assert.ok(priced.includes('aria-pressed="true"'),'the folded monthly/annual cadence selection is announced');
assert.ok(!priced.includes('Lifetime'),'lifetime is fully gone from the pricing page');

const zhPricing=renderPricing({language:'zh',billing:freeAtCap,pricing:payload});
assert.ok(zhPricing.includes('$9.99')&&zhPricing.includes('$59'),'zh renders payload amounts');
assert.ok(zhPricing.includes('省 51%'),'the zh saving badge computes the same percent');
assert.ok(zhPricing.includes('每月最多 50 个故事'),'the zh cap line interpolates the payload cap');
assert.ok(zhPricing.includes('一次付清。故事包点数永不过期。'),'the zh pack note carries its own translation');

const esPricing=renderPricing({language:'es',billing:freeUnder,pricing:payload});
assert.ok(esPricing.includes('Ahorra 51%')&&esPricing.includes('Hasta 50 historias al mes'),'es computes the badge and interpolates the cap from the payload');

// Dormant: labeled fallback copy amounts, honest dormant line, no pay buttons.
const dormantPricing=renderPricing({language:'en',billing:dormant});
assert.ok(dormantPricing.includes('$9.99 / month')&&dormantPricing.includes('$59 / year')&&dormantPricing.includes('$12')&&dormantPricing.includes('$29'),'a dormant deployment renders the labeled fallback copy amounts');
assert.ok(dormantPricing.includes('Online payment is not connected yet'),'the dormant note keeps the honest copy');
assert.ok(!dormantPricing.includes('Save 51%'),'the saving badge never computes from fallback copy');
assert.ok(!dormantPricing.includes('Continue to checkout')&&!dormantPricing.includes('Buy the 30-story pack'),'a dormant pricing page shows no pay buttons that would only error');

// Configured but the Stripe payload is unavailable: amounts hide, never invented.
const unpriced=renderPricing({language:'en',billing:freeUnder,pricing:null});
assert.ok(unpriced.includes('Plan amounts are unavailable right now'),'the unavailable-payload note renders');
assert.ok(!unpriced.includes('$9.99')&&!unpriced.includes('$12')&&!unpriced.includes('$29'),'amounts hide instead of falling back to copy while configured');
assert.ok(!unpriced.includes('Continue to checkout'),'no pay buttons without payload amounts');

const entitledPricing=renderPricing({language:'es',billing:entitled,pricing:payload});
assert.ok(entitledPricing.includes('Historias ilimitadas — tu plan está activo'),'an entitled owner sees their plan state');
assert.ok(!entitledPricing.includes('Ir al pago'),'an entitled owner is not offered checkout again');

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
  :{billing:{configured:true,plan:'subscription',addons:[],storiesCreated:4,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:0,packCreditsRemaining:0}}};
};
assert.equal(await startCheckout('annual'),'https://checkout.stripe.com/pay/mock');
assert.deepEqual(requestBody,{action:'checkout',mode:'subscription',plan:'annual'},'the checkout request names the cadence');
assert.equal(await startCheckout('pack30'),'https://checkout.stripe.com/pay/mock');
assert.deepEqual(requestBody,{action:'checkout',mode:'payment',plan:'pack30'},'a pack checkout is a one-time payment for the named pack');
const rescued=await confirmCheckout('cs_test_a1b2C3d4');
assert.deepEqual(rescued,{configured:true,plan:'subscription',addons:[],storiesCreated:4,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:0,packCreditsRemaining:0},'the rescue parses the server-verified billing block');
assert.deepEqual(requestBody,{action:'status',sessionId:'cs_test_a1b2C3d4'},'the rescue asks the server to verify the session');
globalThis.fetch=originalFetch;

// ---- paywall copy module: shape, placeholders, and language coverage ----
const expectedKeys=['limitTitle','limitBody','limitCta','planHeading','freeUsage','monthlyUsage','packCredits','entitledActive','monthly','annual','checkout','checkoutBusy','dormant','checkoutConfirmed','checkoutPending','pricingTitle','pricingIntro','viewPlans','freeName','freePrice','freeAllowance','subscriptionName','capAllowance','saveBadge','priceMonthly','priceAnnual','packTitle','packNote','packBuy','pricePack30','pricePack100','pricesUnavailable'].sort();
for(const language of ['en','zh','es']){
 const copy=paywallCopy[language];
 assert.deepEqual(Object.keys(copy).sort(),expectedKeys,`${language} carries exactly the paywall copy keys`);
 for(const [key,value] of Object.entries(copy))assert.ok(value.trim().length>0,`${language}.${key} is never empty`);
 assert.ok(copy.limitTitle.includes('{limit}')&&copy.freeUsage.includes('{used}')&&copy.freeUsage.includes('{limit}')&&copy.freeAllowance.includes('{limit}')&&copy.monthlyUsage.includes('{used}')&&copy.monthlyUsage.includes('{cap}')&&copy.packCredits.includes('{size}')&&copy.capAllowance.includes('{cap}')&&copy.saveBadge.includes('{percent}')&&copy.packTitle.includes('{size}')&&copy.packBuy.includes('{size}'),`${language} interpolation placeholders survive the module extraction`);
 assert.ok(!Object.values(copy).some(value=>value.includes('Lifetime')||value.includes('$120')),'no lifetime copy survives in the module');
}
assert.notEqual(paywallCopy.en.limitCta,paywallCopy.zh.limitCta,'translations are distinct, not copy-pasted');
assert.notEqual(paywallCopy.en.checkoutPending,paywallCopy.es.checkoutPending,'es copy is its own translation');

console.log('Passed paywall client gates: paywallCopy shape/placeholders/coverage across en/zh/es, freeStoryLimitReached truth table (dormancy, free cap, paid plans incl. legacy lifetime, zero allowance), StoryStart limitReached state with upgrade CTA in en/zh/es, resume stays free, UpgradePanel usage panel (plan line, monthly usage vs cap, pack credits, dormant, entitled, legacy lifetime entitled state, owner-tree guard), pricing page four options with payload-asserted amounts/dormant fallback copy/unavailable-hidden amounts, computed savings badge, interpolated cap and pack sizes, checkout return-id shape checks, pack checkout mapping, and the server-verified status rescue. React rendered server-side; no network calls.');
