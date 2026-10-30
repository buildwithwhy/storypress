import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
const user='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const env={SUPABASE_URL:'https://storypress-test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test-only',SUPABASE_SECRET_KEY:'sb_secret_test-only',STORYPRESS_PUBLIC_SHARING:'true',GEMINI_API_KEY:'provider-test-key'};
const token='a'.repeat(64),base='https://story.test';
const story={name:'Test narrator',language:'en',occasion:'life',turns:[{role:'user',text:'PRIVATE_INTERVIEW_SENTINEL'}],draft:'PRIVATE_DRAFT_SENTINEL',sources:[],paper:{headline:'A <script>alert(1)</script> memory',standfirst:'A family story.',paragraphs:['A remembered afternoon.'],quote:''},approved:true,sample:false};
const zhTranslation={...story,originStoryId:id,paperLanguage:'zh',paper:{headline:'一段被珍藏的回忆',standfirst:'一个家庭故事。',paragraphs:['一个难忘的下午。'],quote:''},approved:true};
const req=(path,body,auth=true)=>new Request(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:base,...(auth?{Authorization:'Bearer test-user-token'}:{'oai-authenticated-user-id':'spoofed'})},body:body?JSON.stringify(body):undefined});
const original=globalThis.fetch;let queue=[];
globalThis.fetch=async(url,init)=>{if(String(url).includes('/rest/v1/')){assert.equal(init.headers.apikey,env.SUPABASE_SECRET_KEY);assert.equal(init.headers.Authorization,undefined,'Secret key must not be sent as a bearer JWT');assert.equal(init.headers['User-Agent'],'Storypress-Server/1.0');}const next=queue.shift();assert.ok(next,'Unexpected upstream call');next.check?.(String(url),init);return Response.json(next.data,{status:next.status||200});};
const authenticated=()=>({data:{id:user,email:'fictional@example.invalid'},check:(url,init)=>{assert.ok(url.endsWith('/auth/v1/user'));assert.equal(init.headers.Authorization,'Bearer test-user-token');assert.equal(init.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);}});
assert.equal((await worker.fetch(req('/api/stories',undefined,false),env)).status,401,'Sites header must not bypass Supabase authentication');
queue=[{status:401,data:{error:'invalid'}}];assert.equal((await worker.fetch(req('/api/stories'),env)).status,401);
queue=[authenticated(),{data:[],check:(url)=>{assert.ok(url.includes('owner_id=eq.'+user));}}];assert.deepEqual((await(await worker.fetch(req('/api/stories'),env)).json()).stories,[]);
queue=[authenticated(),{data:[],check:(url)=>{assert.ok(url.includes('owner_id=eq.'+user));assert.ok(url.includes('revision=eq.1'));}}];assert.equal((await worker.fetch(req('/api/stories',{action:'save',id,revision:1,story}),env)).status,409);
queue=[authenticated(),{data:[{data:story,share_token:null}],check:url=>assert.ok(url.includes('owner_id=eq.'+user))},{data:[{data:zhTranslation}],check:url=>{assert.ok(url.includes('owner_id=eq.'+user),'Sibling translations stay owner-scoped');assert.ok(url.includes('data-%3E%3EoriginStoryId=eq.'+id)||url.includes('data->>originStoryId=eq.'+id));}},{data:[{id}],check:(url,init)=>{const change=JSON.parse(init.body);assert.ok(/^[a-f0-9]{64}$/.test(change.share_token));assert.deepEqual(change.edition.turns,[]);assert.equal(change.edition.draft,undefined);assert.ok(!JSON.stringify(change).includes('PRIVATE_'));assert.equal(change.revision,2);assert.equal(change.edition.defaultLanguage,'en','Multilingual bundles name the base language');assert.deepEqual(change.edition.editions.zh.paper,zhTranslation.paper,'Approved translated keepsakes join the bundle');assert.equal(change.edition.editions.zh.editions,undefined,'Bundles never nest');}}];
assert.equal((await worker.fetch(req('/api/stories',{action:'share',id,revision:1}),env)).status,200);
queue=[authenticated(),{data:[{data:{...story,approved:false}}]},{data:[]}];assert.equal((await worker.fetch(req('/api/stories',{action:'share',id,revision:1}),env)).status,400,'Unreviewed edition cannot be shared');
queue=[authenticated(),{data:[{data:story,share_token:token}]},{data:[{id}],check:(url,init)=>{assert.ok(url.includes('owner_id=eq.'+user));const change=JSON.parse(init.body);assert.equal(change.edition,null);assert.equal(change.share_token,null);}}];assert.equal((await worker.fetch(req('/api/stories',{action:'private',id,revision:1}),env)).status,200);
queue=[{data:[],check:url=>{assert.ok(url.includes('select=edition'));assert.ok(!url.includes('select=data'));}}];assert.equal((await worker.fetch(req('/s/'+token,undefined,false),env)).status,404);
queue=[{data:[{edition:{...story,turns:[],draft:undefined}}]}];const edition=await worker.fetch(req('/s/'+token,undefined,false),env);assert.equal(edition.status,200);assert.equal(edition.headers.get('Cache-Control'),'no-store');const html=await edition.text();assert.ok(!html.includes('PRIVATE_'));assert.ok(!html.includes('<script>alert(1)</script>'));assert.ok(html.includes('&lt;script&gt;'));
assert.match(html,/href="\/\?from=shared&amp;lang=en"/,'The reader can start an independent story without receiving the share token');
assert.ok(!html.includes(token),'The share token must not be embedded in the acquisition link');
assert.ok(!html.split('</head>')[0].includes('A family story.'),'Social metadata should not quote the story');
assert.match(html,/\.print,\.download,\.reader-actions,\.reader-next,\.keepsake-transcript\{display:none\}/,'Reader acquisition controls and transcripts should not print');
assert.equal(edition.headers.get('Referrer-Policy'),'no-referrer');
for(const [language,action] of [['zh','讲讲我自己的故事'],['es','Crear mi propia historia']]){
 queue=[{data:[{edition:{...story,language,turns:[],draft:undefined}}]}];
 const localized=await(await worker.fetch(req('/s/'+token,undefined,false),env)).text();
 assert.ok(localized.includes(`href="/?from=shared&amp;lang=${language}"`));
 assert.ok(localized.includes(action));
}
assert.equal((await worker.fetch(req('/s/'+token),{...env,STORYPRESS_PUBLIC_SHARING:'false'})).status,404);
queue=[authenticated(),{data:false,check:(url,init)=>{assert.ok(url.endsWith('/rpc/storypress_reserve_ai'));assert.deepEqual(JSON.parse(init.body),{p_user:user,p_action:'write'});}}];assert.equal((await worker.fetch(req('/api/story',{action:'write',story}),env)).status,429,'Quota refusal must stop before provider calls');
queue=[authenticated(),{data:[]},{data:[]}];const config=await(await worker.fetch(req('/api/account'),env)).text();assert.ok(!config.includes(env.SUPABASE_SECRET_KEY));assert.ok(!config.includes('provider-test-key'));assert.ok(!config.includes('sk_test'),'Billing config must not leak into the account payload');
assert.equal(queue.length,0);
// ---- Paywall metering (§2): with Stripe configured, the save-without-id seam
// reserves against the monotonic story counter before inserting a self-started
// original. The strict queue proves the reserve RPC fires exactly once per
// self-started create — and never for derivatives, revisions, or deletes.
const meteredEnv={...env,STRIPE_SECRET_KEY:'sk_test_mock'},insertedAt='2026-10-30T00:00:00.000Z',copyId='33333333-3333-4333-8333-333333333333';
const reserve=(ok,reason)=>({data:[{ok,reason}],check:(url,init)=>{assert.ok(url.endsWith('/rpc/storypress_reserve_story'));assert.deepEqual(JSON.parse(init.body),{p_user:user,p_limit:3},'The reserve RPC receives the owner and the default allowance');}});
const inserted=id=>({data:[{id,revision:1,share_token:null,updated_at:insertedAt}]});
queue=[authenticated(),reserve(false,'limit')];
const refused=await worker.fetch(req('/api/stories',{action:'save',story}),meteredEnv);
assert.equal(refused.status,402,'A free account at the cap cannot start a fourth story');
assert.equal((await refused.json()).code,'story_limit','The refusal carries the story_limit code for the client');
assert.equal(queue.length,0,'A refused save must not insert a story row');
queue=[authenticated(),reserve(true,'free'),inserted(id)];assert.equal((await worker.fetch(req('/api/stories',{action:'save',story}),meteredEnv)).status,200,'A free account under the cap saves normally');
queue=[authenticated(),reserve(true,'entitled'),inserted(id)];assert.equal((await worker.fetch(req('/api/stories',{action:'save',story}),meteredEnv)).status,200,'An entitled owner keeps creating past the free allowance');
queue=[authenticated(),inserted(id)];assert.equal((await worker.fetch(req('/api/stories',{action:'save',id,revision:1,story}),meteredEnv)).status,200,'Revising an existing story is never metered');
queue=[authenticated(),{data:null}];assert.equal((await worker.fetch(req('/api/stories',{action:'delete',id}),meteredEnv)).status,200,'Deleting an existing story is never metered');
queue=[authenticated(),inserted(copyId)];assert.equal((await worker.fetch(req('/api/stories',{action:'save',story:zhTranslation}),meteredEnv)).status,200,'A translated keepsake inserts without consuming the counter');
assert.equal(queue.length,0,'originStoryId-linked keepsakes must skip the reserve RPC');
queue=[authenticated(),inserted(copyId)];assert.equal((await worker.fetch(req('/api/stories',{action:'save',story,derivative:true}),meteredEnv)).status,200,'A save-as-copy inserts without consuming the counter');
assert.equal(queue.length,0,'The derivative marker must skip the reserve RPC');
// Monotonicity: the counter lives in the RPC, so the seam test replays a
// counting mock — two creations, a delete (which never touches the counter),
// a recreate, and only then the refusal.
let reservations=0;
const countingReserve=()=>({get data(){reservations+=1;return reservations>=4?[{ok:false,reason:'limit'}]:[{ok:true,reason:'free'}];},check:url=>{assert.ok(url.endsWith('/rpc/storypress_reserve_story'));}});
reservations=0;
queue=[authenticated(),countingReserve(),inserted(id),authenticated(),countingReserve(),inserted(id)];
assert.equal((await worker.fetch(req('/api/stories',{action:'save',story}),meteredEnv)).status,200);
assert.equal((await worker.fetch(req('/api/stories',{action:'save',story}),meteredEnv)).status,200,'Second self-started story is inside the free allowance');
queue=[authenticated(),{data:null}];assert.equal((await worker.fetch(req('/api/stories',{action:'delete',id}),meteredEnv)).status,200,'Deleting never refunds the counter');
queue=[authenticated(),countingReserve(),inserted(id)];assert.equal((await worker.fetch(req('/api/stories',{action:'save',story}),meteredEnv)).status,200,'Recreating after delete still reserves — the counter never reset');
queue=[authenticated(),countingReserve()];
const afterDelete=await worker.fetch(req('/api/stories',{action:'save',story}),meteredEnv);
assert.equal(afterDelete.status,402,'Delete-then-recreate cannot reset the cap');
assert.equal((await afterDelete.json()).code,'story_limit');
// ---- Dormancy (§2): with Stripe env absent, enforcement is skipped entirely —
// a founder setup step must never block a writer.
queue=[authenticated(),inserted(id)];
assert.equal((await worker.fetch(req('/api/stories',{action:'save',story}),env)).status,200,'Without Stripe env, story creation is never blocked');
assert.equal(queue.length,0,'The reserve RPC must not even be called while billing is dormant');
queue=[authenticated(),{data:[{plan:'subscription',addons:'["video"]'}]},{data:[{stories_created:7}]}];
const paid=await(await worker.fetch(req('/api/account'),meteredEnv)).json();
assert.deepEqual(paid.billing,{configured:true,plan:'subscription',addons:['video'],storiesCreated:7,freeStoryLimit:3},'The account payload reports the entitlement and monotonic counter');
queue=[authenticated(),{data:[]},{data:[]}];
const freeAccount=await(await worker.fetch(req('/api/account'),meteredEnv)).json();
assert.deepEqual(freeAccount.billing,{configured:true,plan:'free',addons:[],storiesCreated:0,freeStoryLimit:3},'Missing billing rows read as a free account');
queue=[authenticated(),{status:503,data:{error:'relation does not exist'}}];
const degraded=await(await worker.fetch(req('/api/account'),meteredEnv)).json();
assert.deepEqual(degraded.billing,{configured:true,plan:'free',addons:[],storiesCreated:0,freeStoryLimit:3},'A broken billing table must not take down the account payload');
queue=[authenticated(),{data:[]},{data:[]}];
const generous=await(await worker.fetch(req('/api/account'),{...meteredEnv,STORYPRESS_FREE_STORIES:'5'})).json();
assert.equal(generous.billing.freeStoryLimit,5,'STORYPRESS_FREE_STORIES raises the reported allowance');
queue=[authenticated(),{data:[]},{data:[]}];
assert.equal((await(await worker.fetch(req('/api/account'),{...meteredEnv,STORYPRESS_FREE_STORIES:'not-a-number'})).json()).billing.freeStoryLimit,3,'A malformed allowance env falls back to 3');
assert.equal(queue.length,0);

const incomplete={...env,SUPABASE_SECRET_KEY:''};
const account=await(await worker.fetch(req('/api/account',undefined,false),incomplete)).json();assert.equal(account.storage,false);assert.equal(account.supabase,null);
assert.equal((await worker.fetch(req('/api/story',{action:'write',story}),incomplete)).status,503,'Missing server key must fail closed before paid model calls');
assert.equal(queue.length,0);globalThis.fetch=original;
console.log('Passed: verified account identity, owner filters, stale-save rejection, approval gating, private-note exclusion, escaped HTML, link revocation, no-store responses, server-only keys, quota refusal, story metering with derivative exemptions, and billing dormancy. Supabase responses mocked; live database activation still required.');
