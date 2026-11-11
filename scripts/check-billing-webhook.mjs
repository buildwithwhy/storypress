// Paywall §3 money path — check-billing-webhook: signature enforcement,
// idempotent entitlement writes, downgrade semantics, checkout identity and
// dormancy, all through the bundled worker's fetch. Every upstream (Supabase,
// Stripe) is mocked in-process: no network calls, no Stripe dependency, and
// no real or test Stripe secret anywhere here — the signing fixtures below
// are obviously-fake strings. The schema/RPC layer lives in check-billing.mjs
// (real throwaway Postgres); this file owns the HTTP money path.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import worker from '../dist/server/index.js';

const user='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const stripeEnv={
 SUPABASE_URL:'https://storypress-test.supabase.co',
 SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock',
 SUPABASE_SECRET_KEY:'sb_secret_mock',
 STRIPE_SECRET_KEY:'mock-stripe-secret',
 STRIPE_WEBHOOK_SECRET:'mock-webhook-secret',
 STRIPE_PRICE_SUBSCRIPTION_MONTHLY:'mock-price-monthly',
 STRIPE_PRICE_SUBSCRIPTION_ANNUAL:'mock-price-annual',
 STRIPE_PRICE_PACK_30:'mock-price-pack-30',
 STRIPE_PRICE_PACK_100:'mock-price-pack-100',
};
const base='https://story.test';

// Every upstream call the worker makes must be queued here in order; an
// unqueued call fails the run.
let queue=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 const next=queue.shift();
 assert.ok(next,`Unexpected upstream call: ${String(url)}`);
 if(next.check)next.check(String(url),init||{});
 return Response.json(next.data??null,{status:next.status||200});
};

const auth=()=>({data:{id:user,email:'fictional@example.invalid'},check:url=>{assert.ok(url.includes('/auth/v1/user'),`Identity call expected, got ${url}`);}});
const sign=(raw,t=Math.floor(Date.now()/1000))=>`t=${t},v1=${createHmac('sha256',stripeEnv.STRIPE_WEBHOOK_SECRET).update(`${t}.${raw}`).digest('hex')}`;
const webhookRequest=(raw,sig)=>new Request(`${base}/api/stripe-webhook`,{method:'POST',headers:{'Content-Type':'application/json',...(sig===undefined?{}:{'stripe-signature':sig})},body:raw});
const billingRequest=(body,headers={})=>new Request(`${base}/api/billing`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...headers},body:JSON.stringify(body)});
const claimInsert={data:[{event_id:'claimed'}],check:(url,init)=>{assert.ok(url.includes('storypress_billing_events?on_conflict=event_id'),`Claim insert expected, got ${url}`);assert.match(String(init.headers.Prefer),/ignore-conflicts/);}};
const entitlementUpsert=expected=>({data:[{owner_id:expected.owner_id}],check:(url,init)=>{
 assert.ok(url.includes('storypress_entitlements?on_conflict=owner_id'),`Entitlement upsert expected, got ${url}`);
 assert.match(String(init.headers.Prefer),/merge-duplicates/);
 const body=JSON.parse(init.body);
 for(const [key,value] of Object.entries(expected))assert.deepEqual(body[key],value,`Entitlement column ${key}`);
 assert.ok(!('addons'in body),`A plan write must never touch the addons column (got ${init.body})`);
 assert.ok(!url.includes('storypress_stories'),`A billing write must never touch stories (got ${url})`);
}});
// The session's line items as Stripe's dedicated endpoint returns them (the
// webhook path; the rescue fetch expands line items inline instead).
const lineItemsFor=(sessionId,price)=>({data:{object:'list',data:[{price:{id:price,object:'price'}}]},check:(url,init)=>{
 assert.ok(url.includes(`/v1/checkout/sessions/${sessionId}/line_items`),`line items lookup expected, got ${url}`);
 assert.equal(init.headers.Authorization,`Bearer ${stripeEnv.STRIPE_SECRET_KEY}`);
}});
// A pack grant insert: keyed on the checkout session, credits from the price
// mapping, and never an entitlement write. rows=[] models the unique-
// constraint conflict a sibling event (or redelivery) hits — the no-op.
const grantInsert=(sessionId,credits,rows=[{checkout_session_id:sessionId}])=>({data:rows,check:(url,init)=>{
 assert.ok(url.includes('storypress_pack_grants?on_conflict=checkout_session_id'),`Pack grant insert expected, got ${url}`);
 assert.match(String(init.headers.Prefer),/ignore-conflicts/);
 assert.deepEqual(JSON.parse(init.body),{owner_id:user,checkout_session_id:sessionId,credits});
 assert.ok(!url.includes('storypress_entitlements'),`A pack grant must never write the plan (got ${url})`);
 assert.ok(!url.includes('storypress_stories'),`A billing write must never touch stories (got ${url})`);
}});
// The five billing reads billingStatus performs for a signed-in owner, in its
// fixed order: entitlements, story counts, this month's draws, pack grants
// sum, pack draws count.
const ownerState=(state={})=>[
 {data:state.entitlements??[]},
 {data:state.counts??[]},
 {data:state.draws??[]},
 {data:state.grants??[]},
 {data:state.packDraws??[]}];
// The exact error shapes the live Supabase project returned for aggregate
// selects before the fix (reproduced with an owner JWT, Nov 11) — the guard
// per read must degrade the field, not zero the block.
const pgrstError=(code,message)=>({status:400,data:{code,message,hint:null,details:null}});
const checkoutEvent=(id,overrides={})=>({id,type:'checkout.session.completed',data:{object:{id:'cs_mock',mode:'subscription',payment_status:'paid',customer:'cus_mock',customer_details:{email:'fictional@example.invalid'},metadata:{userId:user},...overrides}}});

try{
 // --- Signature enforcement: nothing is parsed or changed on a bad signature ---
 for(const [label,sig,env] of [
  ['tampered signature',sign('tampered-body'),stripeEnv],
  ['missing signature header',undefined,stripeEnv],
  ['stale timestamp',sign('{}',Math.floor(Date.now()/1000)-3600),stripeEnv],
  ['wrong signing secret',createHmac('sha256','some-other-secret').update(`1.${'{}'}`).digest('hex'),stripeEnv],
 ]){
  queue=[];
  const response=await worker.fetch(webhookRequest('{}',sig),env);
  assert.equal(response.status,400,`${label}: expected 400`);
  assert.equal((await response.json()).code,'webhook_invalid',`${label}: refusal code`);
  assert.equal(queue.length,0,`${label}: refused before any upstream call`);
 }
 {
  // Fail-closed dormancy: no webhook secret configured → retryable 503, no parsing.
  queue=[];
  const response=await worker.fetch(webhookRequest('{}',sign('{}')),{...stripeEnv,STRIPE_WEBHOOK_SECRET:undefined});
  assert.equal(response.status,503,'unconfigured webhook secret: expected 503');
  assert.equal((await response.json()).code,'webhook_unconfigured');
  assert.equal(queue.length,0,'unconfigured webhook secret: no upstream calls');
 }
 {
  // Order invariant, part 1: a tampered signature over unparseable JSON must
  // report the SIGNATURE failure — proving verification precedes parsing.
  queue=[];
  const response=await worker.fetch(webhookRequest('not-json{',sign('other-body')),stripeEnv);
  assert.equal(response.status,400);
  assert.equal((await response.json()).code,'webhook_invalid','a tampered signature must be refused before parsing');
  // Order invariant, part 2: a valid signature over unparseable JSON reports
  // the payload failure — parsing happened only after verification passed.
  const valid=await worker.fetch(webhookRequest('not-json{',sign('not-json{')),stripeEnv);
  assert.equal(valid.status,400);
  assert.equal((await valid.json()).code,'webhook_payload');
  assert.equal(queue.length,0,'refusals change no state');
 }
 for(const method of ['GET','PUT']){
  const response=await worker.fetch(new Request(`${base}/api/stripe-webhook`,{method}),stripeEnv);
  assert.equal(response.status,405,`${method} webhook must be refused`);
 }

 // --- A signed checkout.session.completed flips the plan exactly once ---
 const signedBody=JSON.stringify(checkoutEvent('evt_checkout_1'));
 {
  queue=[claimInsert,entitlementUpsert({owner_id:user,plan:'subscription',subscription_status:'active',stripe_customer_id:'cus_mock'})];
  const response=await worker.fetch(webhookRequest(signedBody,sign(signedBody)),stripeEnv);
  assert.equal(response.status,200,'signed checkout.session.completed must be accepted');
  assert.deepEqual(await response.json(),{received:true});
  assert.equal(queue.length,0,'exactly one entitlement write on first delivery');
 }
 {
  // Redelivery of the same event id: conflict on the claim → no-op, and no
  // entitlement write is attempted (single write across both deliveries).
  queue=[{...claimInsert,data:[]}];
  const response=await worker.fetch(webhookRequest(signedBody,sign(signedBody)),stripeEnv);
  assert.equal(response.status,200,'redelivery must still be acknowledged');
  assert.deepEqual(await response.json(),{received:true,duplicate:true});
  assert.equal(queue.length,0,'replayed event must not write entitlements again');
 }

 // --- Downgrade semantics: plan flips to free; stories are never touched ---
 const subscriptionEvent=(id,type,object)=>JSON.stringify({id,type,data:{object}});
 {
  queue=[claimInsert,entitlementUpsert({owner_id:user,plan:'free',subscription_status:'canceled',current_period_end:null})];
  const body=subscriptionEvent('evt_deleted_1','customer.subscription.deleted',{status:'canceled',customer:'cus_mock',metadata:{userId:user},current_period_end:1767000000});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{received:true});
  assert.equal(queue.length,0,'downgrade writes entitlements only');
 }
 {
  // Past due rides its grace period: access continues, status recorded.
  queue=[claimInsert,entitlementUpsert({owner_id:user,plan:'subscription',subscription_status:'past_due'})];
  const body=subscriptionEvent('evt_pastdue_1','customer.subscription.updated',{status:'past_due',customer:'cus_mock',metadata:{userId:user},current_period_end:1767000000});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,200);
  assert.equal(queue.length,0);
 }
 {
  // A pack checkout grants credits exactly once per session and never touches
  // the plan: the price decides the effect, not the payment mode.
  queue=[claimInsert,lineItemsFor('cs_mock',stripeEnv.STRIPE_PRICE_PACK_30),grantInsert('cs_mock',30)];
  const body=subscriptionEvent('evt_pack_1','checkout.session.completed',{id:'cs_mock',mode:'payment',payment_status:'paid',metadata:{userId:user}});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{received:true});
  assert.equal(queue.length,0,'a pack grant must not write entitlements');
 }
 {
  // The 100-pack maps from its own price env, via the async event type.
  queue=[claimInsert,lineItemsFor('cs_mock',stripeEnv.STRIPE_PRICE_PACK_100),grantInsert('cs_mock',100)];
  const body=subscriptionEvent('evt_pack_2','checkout.session.async_payment_succeeded',{id:'cs_mock',mode:'payment',payment_status:'paid',metadata:{userId:user}});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,200);
  assert.equal(queue.length,0);
 }
 {
  // One session, two event ids (completed and async): both event claims land,
  // but the grants table's unique checkout_session_id makes the effect
  // exactly-once — the second insert reads back empty and nothing else is
  // written. The event-id claim alone cannot provide this: the two events
  // carry different ids.
  const session={id:'cs_dup',mode:'payment',payment_status:'paid',metadata:{userId:user}};
  const body1=subscriptionEvent('evt_pack_a','checkout.session.completed',session);
  const body2=subscriptionEvent('evt_pack_b','checkout.session.async_payment_succeeded',session);
  queue=[claimInsert,lineItemsFor('cs_dup',stripeEnv.STRIPE_PRICE_PACK_30),grantInsert('cs_dup',30),
         claimInsert,lineItemsFor('cs_dup',stripeEnv.STRIPE_PRICE_PACK_30),grantInsert('cs_dup',30,[])];
  const first=await worker.fetch(webhookRequest(body1,sign(body1)),stripeEnv);
  assert.equal(first.status,200);
  assert.deepEqual(await first.json(),{received:true});
  const second=await worker.fetch(webhookRequest(body2,sign(body2)),stripeEnv);
  assert.equal(second.status,200);
  assert.deepEqual(await second.json(),{received:true},'the sibling event is acknowledged, not failed');
  assert.equal(queue.length,0,'two event ids for one session must grant exactly once');
 }
 {
  // Redelivery of a pack event: the claim conflicts → no lookup, no grant.
  queue=[{...claimInsert,data:[]}];
  const body=subscriptionEvent('evt_pack_1','checkout.session.completed',{id:'cs_mock',mode:'payment',payment_status:'paid',metadata:{userId:user}});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{received:true,duplicate:true});
  assert.equal(queue.length,0,'a replayed pack event must not grant again');
 }
 {
  // A price that maps to no pack — the retired lifetime price lands here —
  // fails closed: a logged skip, no grant, and no entitlement write of any
  // kind. A payment-mode session can never flip the plan.
  queue=[claimInsert,lineItemsFor('cs_mock','mock-price-retired')];
  const body=subscriptionEvent('evt_pack_unknown_1','checkout.session.completed',{id:'cs_mock',mode:'payment',payment_status:'paid',metadata:{userId:user}});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{received:true});
  assert.equal(queue.length,0,'an unrecognized pack price must write nothing');
 }
 {
  // Line items that cannot be fetched (Stripe 404s) fail closed the same way.
  queue=[claimInsert,{status:404,data:null}];
  const body=subscriptionEvent('evt_pack_nolines_1','checkout.session.completed',{id:'cs_mock',mode:'payment',payment_status:'paid',metadata:{userId:user}});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{received:true});
  assert.equal(queue.length,0,'unresolvable line items must write nothing');
 }

 // --- Owner resolution beyond session metadata ---
 {
  // invoice.paid carries no session metadata; the subscription's own
  // metadata identifies the owner.
  queue=[claimInsert,
   {data:{id:'sub_mock',metadata:{userId:user}},check:(url,init)=>{assert.ok(url.endsWith('/v1/subscriptions/sub_mock'),`subscription lookup expected, got ${url}`);assert.equal(init.headers.Authorization,`Bearer ${stripeEnv.STRIPE_SECRET_KEY}`);}},
   entitlementUpsert({owner_id:user,plan:'subscription',subscription_status:'active'})];
  const body=subscriptionEvent('evt_invoice_1','invoice.paid',{subscription:'sub_mock',customer:'cus_mock'});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,200);
  assert.equal(queue.length,0);
 }
 {
  // Last resort: a session created outside the app carries no metadata — its
  // customer_details email is matched through the admin API with the
  // service-role key.
  queue=[claimInsert,
   {data:{users:[{id:user,email:'fictional@example.invalid'}]},check:(url,init)=>{assert.ok(url.includes('/auth/v1/admin/users?email='),`admin email lookup expected, got ${url}`);assert.equal(init.headers.apikey,stripeEnv.SUPABASE_SECRET_KEY,'email lookup must use the service-role key');}},
   entitlementUpsert({owner_id:user,plan:'subscription',subscription_status:'active',stripe_customer_id:'cus_mock'})];
  const body=subscriptionEvent('evt_email_1','checkout.session.completed',{id:'cs_mock',mode:'subscription',payment_status:'paid',customer:'cus_mock',metadata:null,customer_details:{email:'fictional@example.invalid'}});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,200);
  assert.equal(queue.length,0);
 }
 {
  // Customer record as the final fallback: cus_* → email → admin lookup.
  queue=[claimInsert,
   {data:{email:'fictional@example.invalid'},check:url=>{assert.ok(url.endsWith('/v1/customers/cus_mock'),`customer lookup expected, got ${url}`);}},
   {data:{users:[{id:user,email:'fictional@example.invalid'}]}},
   entitlementUpsert({owner_id:user,plan:'subscription',subscription_status:'active',stripe_customer_id:'cus_mock'})];
  const body=subscriptionEvent('evt_customer_1','checkout.session.completed',{id:'cs_mock',mode:'subscription',payment_status:'paid',metadata:null,customer_details:null,customer:'cus_mock'});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,200);
  assert.equal(queue.length,0);
 }
 {
  // An owner that cannot be resolved: acknowledged without effects, no write.
  queue=[claimInsert];
  const body=subscriptionEvent('evt_unmatched_1','checkout.session.completed',{id:'cs_mock',mode:'subscription',payment_status:'paid',metadata:{userId:'not-a-uuid'}});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{received:true,unmatched:true});
  assert.equal(queue.length,0,'unresolved owner must write nothing');
 }
 {
  // Unknown event type: acknowledged, no claim, no effects.
  queue=[];
  const body=subscriptionEvent('evt_unknown_1','customer.discount.created',{customer:'cus_mock'});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{received:true,ignored:'customer.discount.created'});
  assert.equal(queue.length,0);
 }
 {
  // A processing failure after the claim must release it, so Stripe's
  // redelivery reprocesses instead of skipping.
  queue=[claimInsert,
   {status:500,data:{message:'database unavailable'}},
   {data:null,check:url=>{assert.ok(url.includes('storypress_billing_events?event_id=eq.'),`claim release expected, got ${url}`);}}];
  const body=subscriptionEvent('evt_fail_1','checkout.session.completed',{id:'cs_mock',mode:'subscription',payment_status:'paid',metadata:{userId:user}});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,503,'a failed entitlement write must fail the delivery');
  assert.equal(queue.length,0,'the claim must be released for redelivery');
 }

 // --- /api/billing: identity, checkout, status rescue, dormancy ---
 {
  queue=[];
  const response=await worker.fetch(billingRequest({action:'checkout',mode:'subscription'}),stripeEnv);
  assert.equal(response.status,401,'checkout without identity must be refused');
  assert.equal(queue.length,0,'refused checkout makes no upstream calls');
 }
 const authorized={Authorization:'Bearer test-user-token'};
 for(const [mode,plan,price] of [
  ['subscription','monthly',stripeEnv.STRIPE_PRICE_SUBSCRIPTION_MONTHLY],
  ['subscription','annual',stripeEnv.STRIPE_PRICE_SUBSCRIPTION_ANNUAL],
  ['payment','pack30',stripeEnv.STRIPE_PRICE_PACK_30],
  ['payment','pack100',stripeEnv.STRIPE_PRICE_PACK_100],
 ]){
  queue=[auth(),{data:{id:'cs_mock',url:'https://checkout.stripe.com/pay/mock'},check:(url,init)=>{
   assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');
   assert.equal(init.headers.Authorization,`Bearer ${stripeEnv.STRIPE_SECRET_KEY}`);
   const form=new URLSearchParams(init.body);
   assert.equal(form.get('mode'),mode);
   assert.equal(form.get('line_items[0][price]'),price);
   assert.equal(form.get('metadata[userId]'),user,'checkout must carry the owner id in metadata');
   assert.equal(form.get('client_reference_id'),user);
   assert.equal(form.get('success_url'),`${base}/?billing_checkout={CHECKOUT_SESSION_ID}`,'the success return must carry the session template so the client can run the status rescue');
   assert.equal(form.get('cancel_url'),`${base}/`);
  }}];
  const response=await worker.fetch(billingRequest({action:'checkout',mode,plan},authorized),stripeEnv);
  assert.equal(response.status,200,`checkout ${mode}/${plan}`);
  assert.deepEqual(await response.json(),{url:'https://checkout.stripe.com/pay/mock'});
  assert.equal(queue.length,0);
 }
 {
  // Missing price env (e.g. annual unset) refuses cleanly.
  queue=[auth()];
  const response=await worker.fetch(billingRequest({action:'checkout',mode:'subscription',plan:'annual'},authorized),{...stripeEnv,STRIPE_PRICE_SUBSCRIPTION_ANNUAL:undefined});
  assert.equal(response.status,503,'missing price env must refuse checkout cleanly');
  assert.equal(queue.length,0);
 }
 {
  // The retired lifetime client shape (payment mode without a pack plan) is
  // refused before any Stripe call — there is no price to mis-grant with.
  queue=[auth()];
  const response=await worker.fetch(billingRequest({action:'checkout',mode:'payment',plan:'monthly'},authorized),stripeEnv);
  assert.equal(response.status,400,'a payment checkout without a pack plan must be refused');
  assert.equal(queue.length,0);
 }
 {
  // Webhook-lag rescue: a paid session for this owner, verified server-side,
  // flips the plan and the returned status reflects it — including the wave-8
  // owner state (this month's draws, remaining pack credits).
  const session={id:'cs_mock',mode:'subscription',payment_status:'paid',customer:'cus_mock',metadata:{userId:user}};
  queue=[auth(),
   {data:session,check:url=>{assert.ok(url.includes('/v1/checkout/sessions/cs_mock?expand[]=line_items'),`session lookup expected, got ${url}`);}},
   entitlementUpsert({owner_id:user,plan:'subscription',subscription_status:'active'}),
   ...ownerState({entitlements:[{plan:'subscription',addons:'[]'}],counts:[{stories_created:3}],draws:[{stories_created:2}],grants:[{credits:30}],packDraws:[{id:'draw_1'}]})];
  const response=await worker.fetch(billingRequest({action:'status',sessionId:'cs_mock'},authorized),stripeEnv);
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).billing,{configured:true,plan:'subscription',addons:[],storiesCreated:3,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:2,packCreditsRemaining:29});
  assert.equal(queue.length,0);
 }
 {
  // Regression (the Nov 11 zero panel): the live project's PostgREST rejected
  // the old aggregate selects — sum(credits) with PGRST200, count(*) with
  // PGRST100 — and the old single catch zeroed the entire billing block for
  // every signed-in account. Both pack reads fail here with those exact error
  // shapes: the pack balance degrades to zero while every other field keeps
  // the owner's real values, and all five reads are still attempted.
  const session={id:'cs_mock',mode:'subscription',payment_status:'paid',customer:'cus_mock',metadata:{userId:user}};
  queue=[auth(),
   {data:session,check:url=>{assert.ok(url.includes('/v1/checkout/sessions/cs_mock?expand[]=line_items'),`session lookup expected, got ${url}`);}},
   entitlementUpsert({owner_id:user,plan:'subscription',subscription_status:'active'}),
   {data:[{plan:'subscription',addons:'[]'}]},
   {data:[{stories_created:54}]},
   {data:[{stories_created:12}]},
   pgrstError('PGRST200','Could not find a relationship between \'storypress_pack_grants\' and \'sum\' in the schema cache'),
   pgrstError('PGRST100','failed to parse select parameter (* is not valid inside select)')];
  const response=await worker.fetch(billingRequest({action:'status',sessionId:'cs_mock'},authorized),stripeEnv);
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).billing,{configured:true,plan:'subscription',addons:[],storiesCreated:54,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:12,packCreditsRemaining:0},'two failed pack reads must degrade only the pack balance, never zero the whole billing block');
  assert.equal(queue.length,0,'all five billing reads were attempted despite two failing');
 }
 {
  // Positive: raw rows present on both pack tables — grants sum their credits
  // and draws count their rows in JS, so two packs (30 + 100) minus three
  // draws read as 127 remaining credits.
  const session={id:'cs_mock',mode:'subscription',payment_status:'paid',customer:'cus_mock',metadata:{userId:user}};
  queue=[auth(),
   {data:session,check:url=>{assert.ok(url.includes('/v1/checkout/sessions/cs_mock?expand[]=line_items'),`session lookup expected, got ${url}`);}},
   entitlementUpsert({owner_id:user,plan:'subscription',subscription_status:'active'}),
   ...ownerState({entitlements:[{plan:'subscription',addons:'[]'}],counts:[{stories_created:7}],draws:[{stories_created:5}],grants:[{credits:30},{credits:100}],packDraws:[{id:'d1'},{id:'d2'},{id:'d3'}]})];
  const response=await worker.fetch(billingRequest({action:'status',sessionId:'cs_mock'},authorized),stripeEnv);
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).billing,{configured:true,plan:'subscription',addons:[],storiesCreated:7,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:5,packCreditsRemaining:127},'grant and draw rows aggregate in JS to the real balances');
  assert.equal(queue.length,0);
 }
 {
  // Per-read resilience: the entitlement read fails (a revoked key 401s) but
  // the other four succeed — the plan degrades to free while the counter,
  // month draws, and pack balance stay real, instead of the block collapsing.
  const session={id:'cs_mock',mode:'subscription',payment_status:'paid',customer:'cus_mock',metadata:{userId:user}};
  queue=[auth(),
   {data:session,check:url=>{assert.ok(url.includes('/v1/checkout/sessions/cs_mock?expand[]=line_items'),`session lookup expected, got ${url}`);}},
   entitlementUpsert({owner_id:user,plan:'subscription',subscription_status:'active'}),
   {status:401,data:{code:'42501',message:'permission denied for table storypress_entitlements'}},
   {data:[{stories_created:9}]},
   {data:[{stories_created:4}]},
   {data:[{credits:30}]},
   {data:[{id:'d1'}]}];
  const response=await worker.fetch(billingRequest({action:'status',sessionId:'cs_mock'},authorized),stripeEnv);
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).billing,{configured:true,plan:'free',addons:[],storiesCreated:9,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:4,packCreditsRemaining:29},'one failed billing table must cost only its own field');
  assert.equal(queue.length,0);
 }
 {
  // The rescue grants packs identically: the expanded line items resolve the
  // price, the grant keys on the session id, and the plan never flips.
  const session={id:'cs_pack',mode:'payment',payment_status:'paid',customer:'cus_mock',metadata:{userId:user},line_items:{data:[{price:{id:stripeEnv.STRIPE_PRICE_PACK_30}}]}};
  queue=[auth(),
   {data:session,check:url=>{assert.ok(url.includes('/v1/checkout/sessions/cs_pack?expand[]=line_items'),`session lookup expected, got ${url}`);}},
   grantInsert('cs_pack',30),
   ...ownerState({entitlements:[{plan:'free',addons:'[]'}],counts:[{stories_created:3}],grants:[{credits:30}]})];
  const response=await worker.fetch(billingRequest({action:'status',sessionId:'cs_pack'},authorized),stripeEnv);
  assert.equal(response.status,200);
  assert.equal((await response.json()).billing.plan,'free','a pack grant must not flip the plan');
  assert.equal(queue.length,0,'the rescue must not write entitlements for a pack');
 }
 {
  // Fail closed on the rescue too: a payment-mode session whose price maps to
  // no pack grants and writes nothing (its inline price resolves, so no
  // line-items fetch happens).
  const session={id:'cs_retired',mode:'payment',payment_status:'paid',metadata:{userId:user},line_items:{data:[{price:'mock-price-retired'}]}};
  queue=[auth(),
   {data:session,check:url=>{assert.ok(url.includes('/v1/checkout/sessions/cs_retired?expand[]=line_items'),`session lookup expected, got ${url}`);}},
   ...ownerState()];
  const response=await worker.fetch(billingRequest({action:'status',sessionId:'cs_retired'},authorized),stripeEnv);
  assert.equal(response.status,200);
  assert.equal((await response.json()).billing.plan,'free');
  assert.equal(queue.length,0,'an unrecognized pack price must write nothing on the rescue path');
 }
 {
  // Someone else's session must not flip this owner's plan.
  const session={id:'cs_mock',mode:'subscription',payment_status:'paid',metadata:{userId:other}};
  queue=[auth(),{data:session},...ownerState({entitlements:[{plan:'free',addons:'[]'}],counts:[{stories_created:3}]})];
  const response=await worker.fetch(billingRequest({action:'status',sessionId:'cs_mock'},authorized),stripeEnv);
  assert.equal(response.status,200);
  assert.equal((await response.json()).billing.plan,'free');
  assert.equal(queue.length,0,'a foreign session must write nothing');
 }
 {
  // An unpaid session grants nothing.
  const session={id:'cs_mock',mode:'subscription',payment_status:'unpaid',metadata:{userId:user}};
  queue=[auth(),{data:session},...ownerState({entitlements:[{plan:'free',addons:'[]'}],counts:[{stories_created:3}]})];
  const response=await worker.fetch(billingRequest({action:'status',sessionId:'cs_mock'},authorized),stripeEnv);
  assert.equal(response.status,200);
  assert.equal((await response.json()).billing.plan,'free');
  assert.equal(queue.length,0);
 }
 {
  // Dormant status: free tier reported without Stripe env. Supabase reads
  // still happen (identity is live) — only the Stripe flag flips off.
  queue=[auth(),...ownerState()];
  const response=await worker.fetch(billingRequest({action:'status',sessionId:'cs_mock'},authorized),{...stripeEnv,STRIPE_SECRET_KEY:undefined});
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).billing,{configured:false,plan:'free',addons:[],storiesCreated:0,freeStoryLimit:3,subscriptionMonthlyCap:50,pack30Credits:30,pack100Credits:100,subscriptionStoriesThisMonth:0,packCreditsRemaining:0});
  assert.equal(queue.length,0);
 }
 {
  // Dormant checkout refuses cleanly; nothing crashes, nothing is charged.
  queue=[auth()];
  const response=await worker.fetch(billingRequest({action:'checkout',mode:'subscription'},authorized),{...stripeEnv,STRIPE_SECRET_KEY:undefined});
  assert.equal(response.status,503,'dormant checkout must refuse cleanly');
  assert.equal(queue.length,0);
 }
 {
  const response=await worker.fetch(new Request(`${base}/api/billing`,{method:'GET'}),stripeEnv);
  assert.equal(response.status,405,'GET /api/billing must be refused');
 }

 console.log('Passed: signature enforcement (tampered, missing, stale, wrong-secret, fail-closed dormancy), verify-before-parse order, signed checkout flips and price-mapped pack grants exactly-once per session across sibling events and redeliveries (fail-closed on unknown prices and missing line items), replay no-op with a released claim on failure, downgrades that never touch stories, owner resolution via subscription/customer/email, checkout identity and price variants (payment mode pack-only), webhook-lag rescue granting packs identically with foreign-session and unpaid-session refusal, and full dormancy. Stripe and Supabase mocked; no network calls.');
 process.exitCode=0;
}catch(error){
 // Full object — a failing check must show its stack and location.
 console.error(error);
 process.exitCode=1;
}finally{
 globalThis.fetch=originalFetch;
}
