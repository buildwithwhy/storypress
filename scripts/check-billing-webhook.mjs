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
 STRIPE_PRICE_LIFETIME:'mock-price-lifetime',
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
  // Lifetime checkout flips to the terminal lifetime plan.
  queue=[claimInsert,entitlementUpsert({owner_id:user,plan:'lifetime',subscription_status:'active'})];
  const body=subscriptionEvent('evt_lifetime_1','checkout.session.completed',{mode:'payment',payment_status:'paid',metadata:{userId:user}});
  const response=await worker.fetch(webhookRequest(body,sign(body)),stripeEnv);
  assert.equal(response.status,200);
  assert.equal(queue.length,0);
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
  ['payment','monthly',stripeEnv.STRIPE_PRICE_LIFETIME],
 ]){
  queue=[auth(),{data:{id:'cs_mock',url:'https://checkout.stripe.com/pay/mock'},check:(url,init)=>{
   assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');
   assert.equal(init.headers.Authorization,`Bearer ${stripeEnv.STRIPE_SECRET_KEY}`);
   const form=new URLSearchParams(init.body);
   assert.equal(form.get('mode'),mode);
   assert.equal(form.get('line_items[0][price]'),price);
   assert.equal(form.get('metadata[userId]'),user,'checkout must carry the owner id in metadata');
   assert.equal(form.get('client_reference_id'),user);
   assert.equal(form.get('success_url'),`${base}/`);
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
  // Webhook-lag rescue: a paid session for this owner, verified server-side,
  // flips the plan and the returned status reflects it.
  const session={id:'cs_mock',mode:'subscription',payment_status:'paid',customer:'cus_mock',metadata:{userId:user}};
  queue=[auth(),
   {data:session,check:url=>{assert.ok(url.endsWith('/v1/checkout/sessions/cs_mock'),`session lookup expected, got ${url}`);}},
   entitlementUpsert({owner_id:user,plan:'subscription',subscription_status:'active'}),
   {data:[{plan:'subscription',addons:'[]'}]},
   {data:[{stories_created:3}]}];
  const response=await worker.fetch(billingRequest({action:'status',sessionId:'cs_mock'},authorized),stripeEnv);
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).billing,{configured:true,plan:'subscription',addons:[],storiesCreated:3,freeStoryLimit:3});
  assert.equal(queue.length,0);
 }
 {
  // Someone else's session must not flip this owner's plan.
  const session={id:'cs_mock',mode:'subscription',payment_status:'paid',metadata:{userId:other}};
  queue=[auth(),{data:session},
   {data:[{plan:'free',addons:'[]'}]},
   {data:[{stories_created:3}]}];
  const response=await worker.fetch(billingRequest({action:'status',sessionId:'cs_mock'},authorized),stripeEnv);
  assert.equal(response.status,200);
  assert.equal((await response.json()).billing.plan,'free');
  assert.equal(queue.length,0,'a foreign session must write nothing');
 }
 {
  // An unpaid session grants nothing.
  const session={id:'cs_mock',mode:'subscription',payment_status:'unpaid',metadata:{userId:user}};
  queue=[auth(),{data:session},{data:[{plan:'free',addons:'[]'}]},{data:[{stories_created:3}]}];
  const response=await worker.fetch(billingRequest({action:'status',sessionId:'cs_mock'},authorized),stripeEnv);
  assert.equal(response.status,200);
  assert.equal((await response.json()).billing.plan,'free');
  assert.equal(queue.length,0);
 }
 {
  // Dormant status: free tier reported without Stripe env.
  queue=[auth(),
   {data:[]},
   {data:[]}];
  const response=await worker.fetch(billingRequest({action:'status',sessionId:'cs_mock'},authorized),{...stripeEnv,STRIPE_SECRET_KEY:undefined});
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).billing,{configured:false,plan:'free',addons:[],storiesCreated:0,freeStoryLimit:3});
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

 console.log('Passed: signature enforcement (tampered, missing, stale, wrong-secret, fail-closed dormancy), verify-before-parse order, signed checkout and lifetime flips, replay no-op with a released claim on failure, downgrades that never touch stories, owner resolution via subscription/customer/email, checkout identity and price variants, webhook-lag rescue with foreign-session and unpaid-session refusal, and full dormancy. Stripe and Supabase mocked; no network calls.');
 process.exitCode=0;
}catch(error){
 // Full object — a failing check must show its stack and location.
 console.error(error);
 process.exitCode=1;
}finally{
 globalThis.fetch=originalFetch;
}
