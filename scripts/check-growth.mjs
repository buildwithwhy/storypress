// Growth engine checks (docs/GROWTH-ENGINE.md): the server-to-server money
// events and the browser module. Asserts that the HMAC signature verifies
// under a re-implementation of the engine's own verifier; that no personal
// field (or the owner id, email or Stripe customer id) ever enters a payload;
// that nothing is loaded or sent while the env is unset; that purchase and
// renewal map from verified Stripe events exactly as documented; that UTMs
// ride checkout metadata; and that the webhook still answers 200 when the
// engine is down, refusing, or hanging. Every upstream is mocked in-process:
// no network calls, and every secret below is an obviously fake string.
// Run after `npm run build` (it drives the bundled worker in dist/).
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import fs from 'node:fs/promises';
import {rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import worker from '../dist/server/index.js';

const bundle=await build({stdin:{contents:`
export * as client from './lib/growth.ts';
export * as server from './server/growth.ts';
`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
// Self-contained bundle in the OS temp dir: it includes server/storage.ts, whose
// internal User-Agent string must not land in the repo tree the brand check scans.
const workDir=await fs.mkdtemp(path.join(os.tmpdir(),'growth-check-'));
const modulePath=pathToFileURL(path.join(workDir,'growth-check.mjs'));
await fs.writeFile(modulePath,bundle.outputFiles[0].text);
process.on('exit',()=>{try{rmSync(workDir,{recursive:true,force:true});}catch{}});
// Each query string is a fresh module instance, so browser state starts clean.
const load=tag=>import(`${modulePath.href}?${tag}`);
const {client,server}=await load('pure');

// ---- The engine's verifier, re-implemented from its src/ingest/hmac.ts ----
// HMAC-SHA256 of the raw body under the per-client secret, header
// `X-Growth-Signature: sha256=<64 hex>`, constant-time byte comparison.
const ENGINE_SIGNATURE_HEADER='X-Growth-Signature';
async function engineVerify(secret,body,header){
 if(header===null||header===undefined)return false;
 const value=header.startsWith('sha256=')?header.slice(7):header;
 if(!/^[0-9a-fA-F]{64}$/.test(value))return false;
 const provided=Uint8Array.from(value.match(/../g),pair=>Number.parseInt(pair,16));
 const enc=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(body)));
 let diff=provided.length^expected.length;
 for(let i=0;i<Math.max(provided.length,expected.length);i++)diff|=(provided[i]??0)^(expected[i]??0);
 return diff===0;
}
// The engine's personal-field rejection (src/ingest/envelope.ts), any depth.
const PERSONAL_FIELD_KEYS=['email','name','phone','ip','user_agent','fbclid'];
function findPersonalFields(value,path='$'){
 if(value===null||typeof value!=='object')return [];
 if(Array.isArray(value))return value.flatMap((item,i)=>findPersonalFields(item,`${path}[${i}]`));
 return Object.entries(value).flatMap(([key,child])=>[...(PERSONAL_FIELD_KEYS.includes(key.toLowerCase())?[`${path}.${key}`]:[]),...findPersonalFields(child,`${path}.${key}`)]);
}
// The envelope rules the engine applies to a webhook money event, against
// clients/once-and-ours.json's stage_map.
const STAGE_MAP={landing_view:'view',signup:'start',story_completed:'activate',checkout_opened:'checkout',purchase:'purchase',renewal:'repeat'};
const CORE=['view','start','activate','checkout','purchase','repeat','custom'];
function assertEngineAccepts(batch){
 assert.ok(Array.isArray(batch)&&batch.length>=1&&batch.length<=100,'a batch of 1..100 events');
 for(const e of batch){
  assert.equal(typeof e.event_id,'string');assert.ok(e.event_id.length>0);
  assert.equal(e.client,'once-and-ours','one client per batch, the engine config id');
  const stage=CORE.includes(e.stage)?e.stage:STAGE_MAP[e.stage];
  assert.ok(stage,`stage ${e.stage} must be a core stage or in the stage_map`);
  if('step' in e)assert.ok(typeof e.step==='string'&&e.step.length>0,'step is optional but never null or empty');
  assert.match(e.occurred_at,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,'occurred_at is an ISO datetime with offset');
  assert.equal(e.source,'webhook');
  if(e.value!==undefined){
   assert.ok(stage==='purchase'||stage==='repeat','value only on purchase/repeat');
   assert.ok(Number.isInteger(e.value.amount_minor)&&e.value.amount_minor>=0);
   assert.match(e.value.currency,/^[A-Z]{3}$/);
  }
  for(const value of Object.values(e.attribution??{}))assert.ok(typeof value==='string'&&value.length>0);
 }
 assert.deepEqual(findPersonalFields(batch),[],'no personal field anywhere in the payload');
}

// ---- 1. Signature: matches the engine's verifier ----
{
 const secret='fake-growth-secret-for-tests';
 const body=JSON.stringify([{event_id:'evt_fixture',client:'once-and-ours',stage:'purchase',step:'purchase',occurred_at:'2026-11-24T00:00:00.000Z',source:'webhook'}]);
 const header=await server.growthSignature(secret,body);
 assert.equal(server.GROWTH_SIGNATURE_HEADER,ENGINE_SIGNATURE_HEADER);
 assert.match(header,/^sha256=[0-9a-f]{64}$/);
 assert.equal(header,'sha256='+createHmac('sha256',secret).update(body).digest('hex'),'same digest as a node:crypto HMAC');
 assert.equal(await engineVerify(secret,body,header),true,'the engine verifier accepts the signature');
 assert.equal(await engineVerify(secret,body+' ',header),false,'a changed body fails');
 assert.equal(await engineVerify('another-secret',body,header),false,'a different secret fails');
}

// ---- 2. Pure helpers ----
{
 assert.equal(server.growthIngest({}),null,'unset env is dormant');
 assert.equal(server.growthIngest({GROWTH_INGEST_URL:'https://growth.example.test'}),null,'URL without secret is dormant');
 assert.equal(server.growthIngest({GROWTH_INGEST_HMAC:'x'}),null,'secret without URL is dormant');
 assert.equal(server.growthIngest({GROWTH_INGEST_URL:'http://growth.example.test',GROWTH_INGEST_HMAC:'x'}),null,'plain http is refused');
 assert.deepEqual(server.growthIngest({GROWTH_INGEST_URL:'https://growth.example.test',GROWTH_INGEST_HMAC:'x'}),{url:'https://growth.example.test/v1/events',secret:'x'});
 assert.deepEqual(server.growthIngest({GROWTH_INGEST_URL:'https://growth.example.test/v1/events',GROWTH_INGEST_HMAC:'x'}).url,'https://growth.example.test/v1/events','a full events URL is accepted too');
 assert.deepEqual(server.growthClientConfig({}),{},'no SDK key in the services payload while unset');
 assert.deepEqual(server.growthClientConfig({GROWTH_SDK_URL:'https://growth.example.test/sdk.js'}),{growth:{sdkUrl:'https://growth.example.test/sdk.js'}});

 assert.equal(client.sdkScriptUrl(undefined),null);
 assert.equal(client.sdkScriptUrl(''),null);
 assert.equal(client.sdkScriptUrl('http://growth.example.test/sdk.js'),null,'only https loads');
 assert.equal(client.sdkScriptUrl('https://growth.example.test/sdk.js'),'https://growth.example.test/sdk.js?client=once-and-ours','the engine serves the SDK per ?client=');
 assert.equal(client.sdkScriptUrl('https://growth.example.test/sdk.js?client=x'),'https://growth.example.test/sdk.js?client=x');

 const entry=(pathname,search='',hash='')=>client.isEntryLocation({pathname,search,hash});
 assert.equal(entry('/','?utm_source=instagram'),true);
 assert.equal(entry('/pricing'),true);
 assert.equal(entry('/terms'),false);
 assert.equal(entry('/','?billing_checkout=cs_test_abcdefgh'),false,'a Stripe return is not a landing');
 assert.equal(entry('/','?code=abc'),false,'an OAuth return is not a landing');
 assert.equal(entry('/','','#access_token=abc&type=magiclink'),false,'an email-link return is not a landing');

 const now=Date.parse('2026-11-24T12:00:00Z');
 assert.equal(client.isFreshSignup({created_at:'2026-11-24T11:58:00Z',email_confirmed_at:'2026-11-24T11:59:50Z',last_sign_in_at:'2026-11-24T11:59:50Z'},now),true,'first sign-in');
 assert.equal(client.isFreshSignup({created_at:'2026-10-01T00:00:00Z',email_confirmed_at:'2026-10-01T00:00:10Z',last_sign_in_at:'2026-11-24T11:59:50Z'},now),false,'returning sign-in');
 assert.equal(client.isFreshSignup({created_at:'2026-11-24T10:00:00Z',email_confirmed_at:'2026-11-24T10:00:01Z',last_sign_in_at:'2026-11-24T10:00:01Z'},now),false,'an old restored session is not a fresh signup');
 assert.equal(client.isFreshSignup(null,now),false);

 assert.deepEqual(client.attributionFromSearch('?utm_source=instagram&utm_content=120200&placement=stories&email=a%40b.c&utm_term=x%40y.z&utm_medium='),{utm_source:'instagram',utm_content:'120200',placement:'stories'},'only known keys; empty or address-like values are dropped');
 assert.deepEqual(client.cleanAttribution({utm_campaign:'a'.repeat(201),utm_id:'ok',name:'Fictional Person'}),{utm_id:'ok'});
}

// ---- 3. Browser module: unset loads nothing; set loads the SDK and tracks ----
function fakeBrowser(search='?utm_source=instagram&utm_campaign=launch'){
 const appended=[],tracked=[],store=new Map();
 globalThis.location={pathname:'/',search,hash:''};
 globalThis.sessionStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 globalThis.window=globalThis;
 delete globalThis.growth;
 globalThis.document={head:{appendChild:script=>{appended.push(script.src);globalThis.growth={track:(stage,step,extra)=>tracked.push({stage,step,extra})};queueMicrotask(()=>script.onload?.());}},createElement:()=>({})};
 return {appended,tracked,store};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
{
 const browser=fakeBrowser();
 const g=(await load('unset')).client;
 g.captureGrowthEntry();
 g.trackGrowth('signup');
 g.configureGrowth(undefined);
 g.trackGrowth('story_completed');g.trackGrowth('checkout_opened');
 await tick();
 assert.deepEqual(browser.appended,[],'unset SDK URL: no script is ever loaded');
 assert.deepEqual(browser.tracked,[],'unset SDK URL: nothing is tracked');
 assert.equal(g.checkoutAttribution(),undefined,'unset: checkout carries no attribution');
 assert.equal(browser.store.size,0,'unset: nothing is written to storage');
}
{
 const browser=fakeBrowser();
 const g=(await load('set')).client;
 g.captureGrowthEntry();
 g.trackGrowth('signup');// before the services payload arrives: queued
 g.configureGrowth('https://growth.example.test/sdk.js');
 await tick();
 assert.deepEqual(browser.appended,['https://growth.example.test/sdk.js?client=once-and-ours'],'one first-party script on an entry page');
 g.trackGrowth('story_completed');g.trackGrowth('story_completed');g.trackGrowth('checkout_opened');
 await tick();
 assert.deepEqual(browser.tracked.map(t=>[t.stage,t.step]),[['signup','signup'],['story_completed','story_completed'],['checkout_opened','checkout_opened']],'each step once per tab per day, with an explicit step');
 for(const t of browser.tracked)assert.equal(t.extra,undefined,'no extra context is attached');
 assert.deepEqual(g.checkoutAttribution(),{utm_source:'instagram',utm_campaign:'launch'},'landing UTMs are kept for checkout');
 assert.equal(browser.appended.length,1,'the script loads once');
}
{
 // A Stripe return is not an entry page: nothing loads until a step needs it.
 const browser=fakeBrowser('?billing_checkout=cs_test_abcdefgh');
 const g=(await load('return')).client;
 g.captureGrowthEntry();
 g.configureGrowth('https://growth.example.test/sdk.js');
 await tick();
 assert.deepEqual(browser.appended,[],'no eager load (and so no view) on a return');
}
for(const key of ['location','sessionStorage','document','growth'])delete globalThis[key];
delete globalThis.window;

// ---- 4. Webhooks through the bundled worker ----
const user='11111111-1111-4111-8111-111111111111';
const email='fictional@example.invalid';
const base='https://story.test';
const engineUrl='https://growth.example.test/v1/events';
const growthSecret='fake-growth-secret-for-tests';
const stripeEnv={
 SUPABASE_URL:'https://storypress-test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock',SUPABASE_SECRET_KEY:'sb_secret_mock',
 STRIPE_SECRET_KEY:'mock-stripe-secret',STRIPE_WEBHOOK_SECRET:'mock-webhook-secret',
 STRIPE_PRICE_SUBSCRIPTION_MONTHLY:'mock-price-monthly',STRIPE_PRICE_SUBSCRIPTION_ANNUAL:'mock-price-annual',STRIPE_PRICE_PACK_30:'mock-price-pack-30',STRIPE_PRICE_PACK_100:'mock-price-pack-100',
};
const growthEnv={...stripeEnv,GROWTH_INGEST_URL:'https://growth.example.test',GROWTH_INGEST_HMAC:growthSecret};

let queue=[];
globalThis.fetch=async(url,init)=>{
 const next=queue.shift();
 assert.ok(next,`Unexpected upstream call: ${String(url)}`);
 if(next.check)await next.check(String(url),init||{});
 if(next.throws)throw next.throws;
 if(next.hang)return new Promise(()=>{});
 return Response.json(next.data??null,{status:next.status||200});
};
const sign=raw=>{const t=Math.floor(Date.now()/1000);return `t=${t},v1=${createHmac('sha256',stripeEnv.STRIPE_WEBHOOK_SECRET).update(`${t}.${raw}`).digest('hex')}`;};
const webhook=(event,env)=>{const raw=JSON.stringify(event);return worker.fetch(new Request(`${base}/api/stripe-webhook`,{method:'POST',headers:{'Content-Type':'application/json','stripe-signature':sign(raw)},body:raw}),env);};
const ok=(fragment,data=[{}])=>({data,check:url=>assert.ok(url.includes(fragment),`expected ${fragment}, got ${url}`)});
const created=1795000000;
const subscriptionCheckout=(id,extra={})=>({id,type:'checkout.session.completed',created,data:{object:{id:'cs_sub',mode:'subscription',payment_status:'paid',amount_total:999,currency:'usd',customer:'cus_private',customer_details:{email,name:'Fictional Person'},metadata:{userId:user,utm_source:'instagram',utm_medium:'paid',utm_campaign:'launch',utm_content:'120200',utm_term:'120201',utm_id:'120202',placement:'instagram_stories'},consent:{terms_of_service:'accepted'},...extra}}});
const packCheckout=(id,session)=>({id,type:'checkout.session.completed',created,data:{object:{id:session,mode:'payment',payment_status:'paid',amount_total:1200,currency:'usd',customer:'cus_private',customer_details:{email},metadata:{userId:user},consent:{terms_of_service:'accepted'}}}});
const invoice=(id,billing_reason)=>({id,type:'invoice.paid',created,data:{object:{id:'in_mock',billing_reason,subscription:'sub_mock',customer:'cus_private',customer_email:email,amount_paid:999,currency:'usd',metadata:{userId:user},subscription_details:{metadata:{utm_source:'instagram',utm_campaign:'launch'}},lines:{data:[{period:{end:created+2592000}}]}}}});
const subscriptionWrites=[ok('storypress_billing_events?on_conflict=event_id'),ok('storypress_tos_agreements?on_conflict=checkout_session_id'),ok('storypress_entitlements?on_conflict=owner_id')];
const packWrites=session=>[ok('storypress_billing_events?on_conflict=event_id'),ok('storypress_tos_agreements?on_conflict=checkout_session_id'),{data:{data:[{price:{id:'mock-price-pack-30'}}]},check:url=>assert.ok(url.includes(`/v1/checkout/sessions/${session}/line_items`))},ok('storypress_pack_grants?on_conflict=checkout_session_id',[{checkout_session_id:session}])];
let sent=[];
const engineAccepts=(status=200)=>({status,data:{received:1,accepted:1,duplicates:0},check:async(url,init)=>{
 assert.equal(url,engineUrl,'server-to-server POST to the engine events endpoint');
 assert.equal(init.method,'POST');
 assert.ok(init.signal,'the engine request carries a timeout signal');
 const header=init.headers[ENGINE_SIGNATURE_HEADER];
 assert.equal(await engineVerify(growthSecret,init.body,header),true,'the engine verifier accepts the webhook signature');
 for(const secret of [user,email,'cus_private','Fictional Person','sub_mock','cs_test','mock-webhook-secret',growthSecret])assert.ok(!init.body.includes(secret),`payload must not contain ${secret}`);
 const batch=JSON.parse(init.body);assertEngineAccepts(batch);sent.push(...batch);
}});

const logs=[];const originalError=console.error;console.error=(...args)=>{logs.push(args.join(' '));};
try{
 {
  // Env unset: identical upstream sequence to today, nothing sent.
  queue=[...subscriptionWrites];
  const response=await webhook(subscriptionCheckout('evt_unset'),stripeEnv);
  assert.equal(response.status,200);assert.equal(queue.length,0,'no extra upstream call while the growth env is unset');
  queue=[...subscriptionWrites];
  assert.equal((await webhook(subscriptionCheckout('evt_half'),{...stripeEnv,GROWTH_INGEST_URL:'https://growth.example.test'})).status,200);
  assert.equal(queue.length,0,'URL without the secret sends nothing');
 }
 {
  // First subscription → purchase, with Stripe's amount and the checkout UTMs.
  sent=[];queue=[...subscriptionWrites,engineAccepts()];
  const response=await webhook(subscriptionCheckout('evt_sub_1'),growthEnv);
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{received:true});assert.equal(queue.length,0);
  assert.deepEqual(sent,[{event_id:'evt_sub_1',client:'once-and-ours',stage:'purchase',step:'purchase',occurred_at:new Date(created*1000).toISOString(),value:{amount_minor:999,currency:'USD'},attribution:{utm_source:'instagram',utm_medium:'paid',utm_campaign:'launch',utm_content:'120200',utm_term:'120201',utm_id:'120202',placement:'instagram_stories'},source:'webhook'}]);
 }
 {
  // A checkout without UTMs sends no attribution block at all.
  sent=[];queue=[...subscriptionWrites,engineAccepts()];
  await webhook(subscriptionCheckout('evt_sub_plain',{metadata:{userId:user}}),growthEnv);
  assert.equal(sent[0].attribution,undefined);
 }
 {
  // First pack → purchase; a second pack → renewal.
  sent=[];queue=[...packWrites('cs_pack_a'),ok('storypress_pack_grants?owner_id=eq.',[{checkout_session_id:'cs_pack_a'}]),engineAccepts()];
  assert.equal((await webhook(packCheckout('evt_pack_1','cs_pack_a'),growthEnv)).status,200);assert.equal(queue.length,0);
  queue=[...packWrites('cs_pack_b'),ok('storypress_pack_grants?owner_id=eq.',[{checkout_session_id:'cs_pack_a'},{checkout_session_id:'cs_pack_b'}]),engineAccepts()];
  assert.equal((await webhook(packCheckout('evt_pack_2','cs_pack_b'),growthEnv)).status,200);assert.equal(queue.length,0);
  assert.deepEqual(sent.map(e=>[e.event_id,e.stage,e.value]),[['evt_pack_1','purchase',{amount_minor:1200,currency:'USD'}],['evt_pack_2','renewal',{amount_minor:1200,currency:'USD'}]]);
 }
 {
  // Subscription cycle invoice → renewal; the first invoice is not re-sent.
  sent=[];queue=[ok('storypress_billing_events?on_conflict=event_id'),ok('storypress_entitlements?on_conflict=owner_id'),engineAccepts()];
  assert.equal((await webhook(invoice('evt_cycle','subscription_cycle'),growthEnv)).status,200);assert.equal(queue.length,0);
  assert.deepEqual(sent.map(e=>[e.stage,e.step,e.value,e.attribution]),[['renewal','renewal',{amount_minor:999,currency:'USD'},{utm_source:'instagram',utm_campaign:'launch'}]]);
  queue=[ok('storypress_billing_events?on_conflict=event_id'),ok('storypress_entitlements?on_conflict=owner_id')];
  assert.equal((await webhook(invoice('evt_create','subscription_create'),growthEnv)).status,200);assert.equal(queue.length,0,'subscription_create is counted by its checkout, not sent again');
 }
 {
  // Not verified or not applied: nothing sent.
  queue=[];
  const raw=JSON.stringify(subscriptionCheckout('evt_forged'));
  const forged=await worker.fetch(new Request(`${base}/api/stripe-webhook`,{method:'POST',headers:{'stripe-signature':'t=1,v1='+'0'.repeat(64)},body:raw}),growthEnv);
  assert.equal(forged.status,400,'a forged event is refused before anything is sent');
  queue=[ok('storypress_billing_events?on_conflict=event_id',[])];
  assert.deepEqual(await (await webhook(subscriptionCheckout('evt_dupe'),growthEnv)).json(),{received:true,duplicate:true});assert.equal(queue.length,0,'a redelivery sends nothing');
  queue=[ok('storypress_billing_events?on_conflict=event_id')];
  assert.equal((await webhook(subscriptionCheckout('evt_tos',{consent:{terms_of_service:'declined'}}),growthEnv)).status,200);assert.equal(queue.length,0,'a ToS-refused session sends nothing');
  queue=[ok('storypress_billing_events?on_conflict=event_id'),ok('storypress_entitlements?on_conflict=owner_id')];
  assert.equal((await webhook({id:'evt_upd',type:'customer.subscription.updated',created,data:{object:{status:'active',metadata:{userId:user}}}},growthEnv)).status,200);assert.equal(queue.length,0,'lifecycle updates are not money events');
 }
 {
  // Engine down, refusing, or hanging: the webhook still answers 200.
  logs.length=0;
  queue=[...subscriptionWrites,{throws:new TypeError('fetch failed')}];
  assert.equal((await webhook(subscriptionCheckout('evt_down'),growthEnv)).status,200,'engine unreachable');
  queue=[...subscriptionWrites,{status:500,data:{error:'boom'}}];
  assert.equal((await webhook(subscriptionCheckout('evt_500'),growthEnv)).status,200,'engine 5xx');
  queue=[...subscriptionWrites,{status:401,data:{error:'invalid_signature'}}];
  assert.equal((await webhook(subscriptionCheckout('evt_401'),growthEnv)).status,200,'engine 401');
  queue=[...packWrites('cs_pack_c'),{status:503,data:{message:'down'}}];
  assert.equal((await webhook(packCheckout('evt_ledger_down','cs_pack_c'),growthEnv)).status,200,'a failed ledger read only skips the growth event');
  queue=[...subscriptionWrites,{hang:true}];
  const started=Date.now();
  const hung=await webhook(subscriptionCheckout('evt_hang'),growthEnv);
  assert.equal(hung.status,200,'engine hanging');
  assert.ok(Date.now()-started<server.GROWTH_BUDGET_MS+1500,'the webhook waits only the bounded budget');
  const failures=logs.filter(line=>line.includes('growth_ingest_failed'));
  assert.ok(failures.length>=4,'each failure is logged');
  for(const line of failures)for(const secret of [user,email,'cus_private'])assert.ok(!line.includes(secret),`failure logs carry no customer data (${line})`);
 }
 {
  // Checkout: cleaned UTMs ride the session (and the subscription) metadata.
  const authorized={Authorization:'Bearer mock-session-token'};
  for(const [mode,plan,price] of [['subscription','monthly','mock-price-monthly'],['payment','pack30','mock-price-pack-30']]){
   queue=[{data:{id:user,email},check:url=>assert.ok(url.includes('/auth/v1/user'))},{data:{url:'https://checkout.stripe.com/pay/mock'},check:(url,init)=>{
    assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');
    const form=new URLSearchParams(init.body);
    assert.equal(form.get('line_items[0][price]'),price);
    assert.equal(form.get('metadata[utm_source]'),'instagram');
    assert.equal(form.get('metadata[utm_content]'),'120200');
    assert.equal(form.get('metadata[utm_term]'),null,'an address-like value is dropped');
    assert.equal(form.get('metadata[email]'),null,'unknown keys are dropped');
    assert.equal(form.get('subscription_data[metadata][utm_source]'),mode==='subscription'?'instagram':null,'subscriptions carry UTMs for their renewals');
   }}];
   const response=await worker.fetch(new Request(`${base}/api/billing`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...authorized},body:JSON.stringify({action:'checkout',mode,plan,language:'en',attribution:{utm_source:'instagram',utm_content:'120200',utm_term:'x@y.z',email}})}),growthEnv);
   assert.equal(response.status,200);assert.equal(queue.length,0);
  }
 }
 {
  // Services payload: the SDK URL appears only when configured.
  const plain=await (await worker.fetch(new Request(`${base}/api/story`),{})).json();
  assert.equal('growth' in plain,false,'unset: the services payload is unchanged');
  const configured=await (await worker.fetch(new Request(`${base}/api/story`),{GROWTH_SDK_URL:'https://growth.example.test/sdk.js'})).json();
  assert.deepEqual(configured.growth,{sdkUrl:'https://growth.example.test/sdk.js'});
 }
}finally{console.error=originalError;}
console.log('check-growth: ok (engine HMAC verifies, no personal fields, dormant when unset, purchase/renewal mapping, UTMs to checkout metadata, webhook 200 when the engine is down)');
