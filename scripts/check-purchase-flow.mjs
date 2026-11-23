// Purchase-flow checks (purchase sheet §D1–D6): the /pricing page must never
// dead-end. Asserts the signed-out page renders every buy control enabled
// with no page-level consent gate and no grey role="alert" error paragraph;
// that a buy click's sheet (seeded via initialSheet, the sheet-open state)
// shows the sign-in step for signed-out visitors and the consent step with a
// disabled-until-ticked CTA for signed-in ones; the signed-in usage lines and
// the Free-card CTA; the plan-intent helpers (24h pending purchase in
// injectable storage, /pricing returnTo); header copy keys; and en/zh/es
// parity for every new copy key. React renders server-side with everything
// mocked — no network, no billing lookups from the client bundle.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PricingPanel} from './app/pricing.tsx';
import {HeaderAccount} from './app/header-account.tsx';
import {UpgradePanel} from './app/sharing.tsx';
import {billingStatusSchema} from './lib/billing.ts';
import {purchaseCopy} from './lib/purchase-copy.ts';
import {sharingCopy} from './lib/sharing-copy.ts';
import {paywallCopy} from './lib/paywall-copy.ts';
import {storePendingPurchase,readPendingPurchase,clearPendingPurchase,pricingReturnTo} from './lib/purchase-intent.ts';
export const render=props=>renderToStaticMarkup(React.createElement(PricingPanel,props));
export const renderNode=el=>renderToStaticMarkup(el);
export {React as React,billingStatusSchema,purchaseCopy,sharingCopy,paywallCopy,HeaderAccount,UpgradePanel,storePendingPurchase,readPendingPurchase,clearPendingPurchase,pricingReturnTo};
`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',packages:'external'});
import fs from 'node:fs/promises';
const path=new URL('../work/purchase-flow-check.mjs',import.meta.url);await fs.mkdir(new URL('../work/',import.meta.url),{recursive:true});await fs.writeFile(path,bundle.outputFiles[0].text);
const {React,render,renderNode,billingStatusSchema,purchaseCopy,sharingCopy,paywallCopy,HeaderAccount,UpgradePanel,storePendingPurchase,readPendingPurchase,clearPendingPurchase,pricingReturnTo}=await import(path.href);

const billing={configured:true,plan:'free',addons:[],storiesCreated:1,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:0,packCreditsRemaining:0};
const pricing={currency:'usd',monthly:{amount:999},annual:{amount:5900},pack30:{amount:1200},pack100:{amount:2900}};
const base={billing,pricing,language:'en',onStartFreeStory:()=>{},onPrepareSignIn:()=>()=>{}};

assert.ok(billingStatusSchema.safeParse(billing).success,'the check fixture must parse against the real billing schema');

// Signed-out pricing: every control enabled, no consent gate, no error paragraph.
const signedOut=render(base);
assert.equal((signedOut.match(/disabled/g)||[]).length,0,'a signed-out visitor sees no disabled buy button, plan card, or cadence toggle (the 401 dead end is gone)');
assert.ok(signedOut.includes('Buy the 30-story pack')&&signedOut.includes('Continue to checkout'),'the pack buy buttons and the subscription CTA render for a signed-out visitor');
assert.ok(!signedOut.includes('I ask Once &amp; Ours'),'the page-level consent gate is gone — consent lives only inside the sheet');
assert.ok(!signedOut.includes('Sign in to manage your plan'),'the bare server-error paragraph never renders on the page');
assert.ok(signedOut.includes('start-free-story')&&signedOut.includes(purchaseCopy.en.startFreeStory),'the Free card carries a start-a-free-story CTA');

// Buy click (signed out): the sheet opens at the sign-in step — reachable
// from a buy click, with pricing-context copy, Google and email-code entry.
const sheetSignedOut=render({...base,initialSheet:'pack30'});
assert.ok(sheetSignedOut.includes('role="dialog"')&&sheetSignedOut.includes('purchase-sheet'),'a buy click opens the purchase sheet');
assert.ok(sheetSignedOut.includes(purchaseCopy.en.purchaseSignInHelp)&&sheetSignedOut.includes(purchaseCopy.en.accountMadeForYou),'the sign-in step carries pricing-context copy and the made-for-you sentence');
assert.ok(sheetSignedOut.includes('google-sign-in')&&sheetSignedOut.includes('email-sign-in'),'the sheet embeds the existing Google and email-code sign-in UI');
assert.ok(!sheetSignedOut.includes('I ask Once &amp; Ours')&&!sheetSignedOut.includes('Continue to secure checkout'),'a signed-out buyer never sees the consent step before signing in');
assert.ok(sheetSignedOut.includes('$12'),'the sheet shows the chosen plan\u2019s Stripe-backed amount');

// Buy click (signed in): straight to consent — the only disabled control in
// the buy path is the sheet CTA while the box is unticked.
const sheetSignedIn=render({...base,signedIn:true,initialSheet:'monthly'});
assert.ok(sheetSignedIn.includes('I ask Once &amp; Ours'),'the consent acknowledgement renders inside the sheet for a signed-in buyer');
assert.ok(sheetSignedIn.includes('Continue to secure checkout'),'the sheet CTA is the secure-checkout copy');
assert.ok(sheetSignedIn.includes('disabled')&&sheetSignedIn.includes('primary'),'the CTA is disabled until consent is ticked');
const disabledBits=sheetSignedIn.match(/<button[^>]*disabled[^>]*>/g)||[];
assert.equal(disabledBits.length,1,'exactly one disabled control in the buy path — the unticked-sheet CTA');
assert.ok(sheetSignedIn.includes('Monthly')&&sheetSignedIn.includes('$9.99'),'the sheet shows the chosen plan and amount');
assert.ok(!sheetSignedIn.includes('google-sign-in'),'a signed-in buyer skips the sign-in step');

// Consent never renders on the page behind the sheet, signed in or out.
for(const signedIn of [false,true]){
 const page=render({...base,signedIn});
 assert.ok(!page.includes('I ask Once &amp; Ours'),`the consent checkbox never renders on the page itself (signedIn=${signedIn})`);
}

// Signed-in pricing: plan + credits at the top, from data already in props.
const freeSignedIn=render({...base,signedIn:true});
assert.ok(freeSignedIn.includes('1 of 3 free stories used'),'a free owner sees their usage line');
assert.ok(freeSignedIn.includes('Continue to checkout'),'a signed-in free owner is the buyer — the subscription CTA stays present');
const owned=render({billing:{...billing,plan:'subscription',subscriptionStoriesThisMonth:12,packCreditsRemaining:30},pricing,language:'en',signedIn:true});
assert.ok(owned.includes('Unlimited stories — your plan is active'),'a subscriber sees the plan line');
assert.ok(owned.includes('12 of 50 stories this month')&&owned.includes('30 pack credits remaining'),'the credits lines render for a subscriber');

// Plan-intent helpers: stored before the Google redirect, fresh after, gone
// once stale or cleared, and the returnTo points at /pricing. A Storage-like
// shim stands in for localStorage (the helpers are typed against Storage).
const store=new Map();
const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>void store.set(k,v),removeItem:k=>void store.delete(k)};
const now=Date.now();
storePendingPurchase(storage,'pack100',now);
assert.deepEqual(readPendingPurchase(storage,now+1000),{plan:'pack100',at:now},'a stored plan intent reads back with its plan and timestamp');
assert.equal(readPendingPurchase(storage,now+25*3600*1000),null,'a plan intent older than ~24h is never honored');
storePendingPurchase(storage,'monthly',now+5);
assert.equal(readPendingPurchase(storage,now+1000)?.plan,'monthly','a new selection overwrites the previous intent');
clearPendingPurchase(storage);
assert.equal(readPendingPurchase(storage,now+1000),null,'a consumed or cancelled intent is cleared');
assert.equal(pricingReturnTo('https://onceandours.com'),'https://onceandours.com/pricing','the Google returnTo points at /pricing so the sheet can reopen');

// Copy parity: every purchase key exists in en, zh and es; placeholders stay
// interpolated and are asserted where they carry numbers.
const keys=Object.keys(purchaseCopy.en);
for(const key of ['signIn','purchaseSignInHelp','continueToSecureCheckout','startFreeStory','startNewStoryCta','accountMadeForYou','planAndBilling'])
 assert.ok(keys.includes(key),`purchaseCopy.en carries ${key}`);
for(const language of ['zh','es'])
 assert.deepEqual(Object.keys(purchaseCopy[language]).sort(),keys.sort(),`purchaseCopy.${language} has exactly the en key set`);
assert.ok(paywallCopy.en.packConfirmed.includes('{size}')&&paywallCopy.zh.packConfirmed.includes('{size}')&&paywallCopy.es.packConfirmed.includes('{size}'),'packConfirmed carries the {size} placeholder in every language');

// Header copy: the menu keys ride on purchaseCopy + sharingCopy.
for(const language of ['en','zh','es']){
 assert.ok(purchaseCopy[language].signIn&&purchaseCopy[language].planAndBilling,`header account-entry copy exists in ${language}`);
 assert.ok(sharingCopy[language].accountMenu&&sharingCopy[language].accountMenuHint,`Account trigger copy exists in ${language}`);
 assert.ok(typeof paywallCopy[language].packConfirmed==='string',`pack copy parity in ${language}`);
}

// Header trigger (account-menu follow-up): signed in, the trigger reads
// "Account" with a chevron — not "My stories" — while "My stories" stays the
// first item inside the menu and Plan and billing remains a distinct entry.
for(const language of ['en','zh','es']){
 const header=renderNode(React.createElement(HeaderAccount,{language,signedIn:true,onAccount:()=>{},onPlanAndBilling:()=>{},onSignOut:()=>{}}));
 assert.ok(header.includes(sharingCopy[language].accountMenu),`the signed-in trigger reads the Account label in ${language}`);
 assert.ok(header.includes('lucide-chevron-down'),`the trigger carries the chevron that signals a menu in ${language}`);
 assert.ok(header.includes(`aria-label="${sharingCopy[language].accountMenuHint}"`),`the trigger carries the chevron a11y label in ${language}`);
 assert.ok(header.includes(sharingCopy[language].account),`My stories stays inside the menu in ${language}`);
 assert.ok(header.includes(purchaseCopy[language].planAndBilling),`Plan and billing stays a distinct menu entry in ${language}`);
 assert.ok(!new RegExp(`<summary[^>]*>${sharingCopy[language].account}<`).test(header),`the trigger no longer reads My stories in ${language}`);
}
// Signed out, the header state is untouched: a plain Sign in button, no menu.
const signInHeader=renderNode(React.createElement(HeaderAccount,{language:'en',signedIn:false,onSignIn:()=>{},onAccount:()=>{},onPlanAndBilling:()=>{},onSignOut:()=>{}}));
assert.ok(signInHeader.includes(purchaseCopy.en.signIn)&&!signInHeader.includes('account-menu'),`the signed-out header keeps the Sign in button with no account menu`);

// Purchase history (follow-up, founder's D3 decision): no payload rows means
// no purchase-history block at all — the "No purchases yet" empty state is
// gone. Rows render once billing.history carries entries (the refund PR).
const panelNoHistory=renderNode(React.createElement(UpgradePanel,{billing,language:'en',ownerTree:true}));
assert.ok(!panelNoHistory.includes('purchase-history')&&!panelNoHistory.includes('No purchases yet'),'no purchase-history block renders when the payload carries no rows');
const panelWithHistory=renderNode(React.createElement(UpgradePanel,{billing:{...billing,history:[{description:'30-story pack',amount:'$12.00',date:'Nov 2026'}]},language:'en',ownerTree:true}));
assert.ok(panelWithHistory.includes('purchase-history')&&panelWithHistory.includes('30-story pack'),'history rows render once the payload carries them');

// Plan and billing deep-link: the entry's target — a focusable plan section
// heading the dialog can scroll to and focus — exists in every language.
for(const language of ['en','zh','es']){
 const panel=renderNode(React.createElement(UpgradePanel,{billing,language,ownerTree:true}));
 assert.ok(panel.includes('tabindex="-1"')&&panel.includes(paywallCopy[language].planHeading),`the plan section has a focusable heading for the deep-link in ${language}`);
}

console.log('check-purchase-flow: all assertions passed');
