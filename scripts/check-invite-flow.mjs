import assert from 'node:assert/strict';
import {build} from 'esbuild';
import worker from '../dist/server/index.js';

// Keepsake bylines credit approved contributors in the owner's language.
const bylineBundle=await build({stdin:{contents:"export * from './lib/story.ts';export * from './lib/keepsake.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',loader:{'.jpg':'dataurl'}});
const {initialStory,storySchema,keepsakeMarkup}=await import('data:text/javascript;base64,'+Buffer.from(bylineBundle.outputFiles[0].text).toString('base64'));
const paper={headline:'Sunday dumplings',standfirst:'A family table.',paragraphs:['Grandma made dumplings.'],quote:''};
const attributed=storySchema.parse({...initialStory,name:'Wei',language:'en',paper,turns:[
 {role:'user',text:'I remember her kitchen.',author:{label:'Mei (aunt)'}},
 {role:'user',text:'Me too, every Sunday.',author:{label:'Mei (aunt)'}}]});
const byHtml=keepsakeMarkup(attributed);
const bylineParagraph=byHtml.match(/<p class="keepsake-by">.*?<\/p>/)?.[0]||'';
assert.ok(bylineParagraph.includes('A story by Wei with Mei (aunt)'),'Byline credits approved contributors');
assert.equal(bylineParagraph.split('Mei (aunt)').length-1,1,'A contributor is credited once despite repeated turns');
const guestOnly=storySchema.parse({...initialStory,language:'en',paper,turns:[{role:'user',text:'I remember.',author:{label:'Mei (aunt)'}}]});
assert.ok(keepsakeMarkup(guestOnly).includes('A story by Mei (aunt)'),'Contributors lead the byline when the narrator is unnamed');
assert.ok(!keepsakeMarkup(storySchema.parse({...initialStory,name:'Wei',language:'en',paper,turns:[{role:'user',text:'I remember.'}]})).includes('Mei'),'Only attributed turns are credited');

// Invite flow: create → contribute → approve/decline against a mocked Supabase.
const user='11111111-1111-4111-8111-111111111111',someoneElse='55555555-5555-4555-8555-555555555555';
const storyId='22222222-2222-4222-8222-222222222222',contributionId='33333333-3333-4333-8333-333333333333',inviteId='44444444-4444-4444-8444-444444444444';
const token='a'.repeat(64),base='https://story.test',day=new Date().toISOString().slice(0,10);
const env={SUPABASE_URL:'https://storypress-test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test-only',SUPABASE_SECRET_KEY:'sb_secret_test-only',GEMINI_API_KEY:'provider-test-key'};
const future=new Date(Date.now()+86400000).toISOString(),past=new Date(Date.now()-86400000).toISOString(),ts=new Date().toISOString();
const question='What did your grandmother cook?';
const inviteRow={id:inviteId,story_id:storyId,question,expires_at:future,status:'open'};
const guestTurns=[{role:'user',text:'She made dumplings every Sunday.'},{role:'assistant',text:'Who else was at that table?'}];
const ownerBlob=storySchema.parse({...initialStory,name:'Wei',language:'en',turns:[{role:'user',text:'I remember her kitchen.'}],draft:'PRIVATE_DRAFT',paper,approved:true});
const req=(path,body,auth=true)=>new Request(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:base,...(auth?{Authorization:'Bearer test-user-token'}:{})},body:body?JSON.stringify(body):undefined});
const original=globalThis.fetch;let queue=[];
globalThis.fetch=async(url,init)=>{
 const next=queue.shift();assert.ok(next,'Unexpected upstream call to '+String(url).slice(0,140));
 next.check?.(String(url),init);return Response.json(next.data,{status:next.status||200});
};
const authenticated=()=>({data:{id:user,email:'fictional@example.invalid'},check:(url,init)=>{assert.ok(url.endsWith('/auth/v1/user'));assert.equal(init.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);assert.equal(init.headers.Authorization,'Bearer test-user-token');}});
// The guest context reads the invite row plus two story columns — never the blob.
const contextCalls=(row=inviteRow)=>[{data:[row],check:url=>{assert.ok(url.includes('/rest/v1/storypress_invites?token=eq.'+token));assert.ok(url.includes('select=id,story_id,question,expires_at,status'));assert.ok(!url.includes('select=data')&&!url.includes('select=*'));}},
 {data:[{language:'en',occasion:'life'}],check:url=>{assert.ok(url.includes('storypress_stories?id=eq.'+storyId));assert.ok(url.includes('select=language:data->>language,occasion:data->>occasion'));assert.ok(!url.includes('select=data'));}}];
const usage=(scope)=>({data:[],check:(url,init)=>{assert.ok(url.endsWith('/rest/v1/storypress_ai_usage'));assert.deepEqual(JSON.parse(init.body),{scope,units:1});}});
const provider=(text)=>({data:{output_text:text},check:url=>{assert.ok(url.startsWith('https://generativelanguage.googleapis.com/v1beta/interactions'));}});

// 1. Owner mints an invite: 64-hex token, share URL, database defaults untouched.
let createdToken='';
queue=[authenticated(),{data:[{id:storyId}],check:url=>{assert.ok(url.includes('owner_id=eq.'+user));}},
 {data:[{id:inviteId,expires_at:future,question}],check:(url,init)=>{assert.ok(url.endsWith('/rest/v1/storypress_invites'));const row=JSON.parse(init.body);assert.equal(row.story_id,storyId);assert.equal(row.question,question);assert.equal(row.created_by,user);assert.match(row.token,/^[a-f0-9]{64}$/);createdToken=row.token;assert.ok(!('status' in row)&&!('expires_at' in row),'Database defaults stay in the database');}}];
const created=await(await worker.fetch(req('/api/invites',{action:'create',storyId,question,contributorName:'Mei (aunt)'}),env)).json();
assert.equal(created.token,createdToken);assert.equal(created.url,`${base}/i/${createdToken}#Mei%20(aunt)`);assert.equal(created.expiresAt,future);
assert.equal(queue.length,0);

// 2. Guest context: exactly the question fields — no story blob, no transcript.
queue=contextCalls();
const context=await(await worker.fetch(req(`/api/invites?token=${token}`,undefined,false),env)).json();
assert.deepEqual(context,{status:'open',question,expiresAt:future,language:'en',occasion:'life'});
assert.equal(queue.length,0);

// 3. Expiry, revocation and unknown tokens fail closed with status only.
queue=[{data:[{...inviteRow,expires_at:past}]}];assert.deepEqual(await(await worker.fetch(req(`/api/invites?token=${token}`,undefined,false),env)).json(),{status:'expired'});
queue=[{data:[{...inviteRow,status:'revoked'}]}];assert.deepEqual(await(await worker.fetch(req(`/api/invites?token=${token}`,undefined,false),env)).json(),{status:'revoked'});
queue=[{data:[]}];assert.deepEqual(await(await worker.fetch(req(`/api/invites?token=${'c'.repeat(64)}`,undefined,false),env)).json(),{status:'unknown'});
queue=[{data:[{...inviteRow,expires_at:past}]}];assert.equal((await worker.fetch(req('/api/invites',{action:'contribute',token,turns:[{role:'user',text:'Late.'}],authorLabel:'Mei (aunt)'},false),env)).status,410,'Expired links end mid-session');
assert.equal(queue.length,0);

// 4. Guest AI follow-up: invite-scoped usage reservation, question-grounded prompt.
const followUp={acknowledgement:'What a lovely memory.',question:'Who else was at that table?',readyToWrite:false};
queue=[...contextCalls(),{data:[{id:inviteId,story_id:storyId}]},{data:[],check:url=>{assert.ok(url.includes('scope=in.'));}},
 usage('site:'+day),usage('invite:'+inviteId+':'+day),
 provider(JSON.stringify(followUp))];
const interviewed=await(await worker.fetch(req('/api/invites',{action:'interview',token,turns:[{role:'user',text:'She made dumplings every Sunday.'}]},false),env)).json();
assert.deepEqual(interviewed,followUp);assert.equal(queue.length,0);

// 5. Guest contribution: pending row with attribution, no user fields, no review stamp.
queue=[...contextCalls(),{data:[{id:inviteId,story_id:storyId}]},
 {data:[{id:contributionId}],check:(url,init)=>{assert.ok(url.endsWith('/rest/v1/storypress_contributions'));const row=JSON.parse(init.body);assert.equal(row.story_id,storyId);assert.equal(row.invite_id,inviteId);assert.equal(row.author_label,'Mei (aunt)');assert.deepEqual(row.turns,[{role:'user',text:'She made dumplings every Sunday.'}]);assert.ok(!('contributor_user_id' in row)&&!('reviewed_at' in row)&&!('status' in row),'Review state belongs to the database defaults');}}];
assert.deepEqual(await(await worker.fetch(req('/api/invites',{action:'contribute',token,turns:[{role:'user',text:'She made dumplings every Sunday.'}],authorLabel:'Mei (aunt)'},false),env)).json(),{id:contributionId,submitted:true});
assert.equal(queue.length,0);
queue=[...contextCalls(),{data:[{id:inviteId,story_id:storyId}]}];assert.equal((await worker.fetch(req('/api/invites',{action:'contribute',token,turns:Array.from({length:61},()=>({role:'user',text:'x'})),authorLabel:'Mei (aunt)'},false),env)).status,400,'Bounded submissions');
assert.equal(queue.length,0);

// 6. Owner list: invites with live expiry, contributions with turns for review.
queue=[authenticated(),{data:[{id:storyId}]},
 {data:[{id:inviteId,question,status:'open',expires_at:future,created_at:ts}]},
 {data:[{id:contributionId,invite_id:inviteId,author_label:'Mei (aunt)',contributor_user_id:null,turns:guestTurns,status:'pending',created_at:ts,reviewed_at:null}]}];
const listed=await(await worker.fetch(req(`/api/invites?story_id=${storyId}`),env)).json();
assert.equal(listed.invites[0].status,'open');assert.equal(listed.contributions[0].status,'pending');
assert.deepEqual(listed.contributions[0].turns,guestTurns);assert.equal(queue.length,0);

// 7. Approve: the ONLY story-mutating path — attributed merge under a revision guard.
queue=[authenticated(),
 {data:[{id:contributionId,story_id:storyId,author_label:'Mei (aunt)',contributor_user_id:null,turns:guestTurns}],check:url=>{assert.ok(url.includes('status=eq.pending'));}},
 {data:[{id:storyId}],check:url=>{assert.ok(url.includes('owner_id=eq.'+user));}},
 {data:[{data:ownerBlob,revision:2}]},
 {data:[{id:storyId}],check:(url,init)=>{assert.ok(url.includes(`storypress_stories?id=eq.${storyId}&revision=eq.2`));const row=JSON.parse(init.body);assert.equal(row.revision,3);assert.equal(row.data.approved,false,'The keepsake needs review again');assert.equal(row.data.turns.length,3);assert.deepEqual(row.data.turns[1].author,{label:'Mei (aunt)'});assert.equal(row.data.turns[2].author,undefined,'Interviewer questions ride along unattributed');assert.equal(row.data.draft,'PRIVATE_DRAFT','Owner fields survive the merge');}},
 {data:[{id:contributionId}],check:(url,init)=>{assert.ok(url.includes('storypress_contributions?id=eq.'+contributionId+'&status=eq.pending'));assert.equal(JSON.parse(init.body).status,'approved');}}];
assert.deepEqual(await(await worker.fetch(req('/api/invites',{action:'review',contributionId,decision:'approve'}),env)).json(),{approved:true,mergedTurns:2});
assert.equal(queue.length,0);

// 8. A concurrent owner save makes the guarded PATCH miss; the merge retries on a fresh read.
queue=[authenticated(),{data:[{id:contributionId,story_id:storyId,author_label:'Mei (aunt)',contributor_user_id:null,turns:guestTurns}]},
 {data:[{id:storyId}]},{data:[{data:ownerBlob,revision:2}]},
 {data:[],check:(url,init)=>{assert.ok(url.includes('&revision=eq.2'));}},
 {data:[{data:{...ownerBlob,turns:[...ownerBlob.turns,{role:'user',text:'The kitchen was warm.'}]},revision:3}]},
 {data:[{id:storyId}],check:(url,init)=>{assert.ok(url.includes('&revision=eq.3'));const row=JSON.parse(init.body);assert.equal(row.revision,4);assert.equal(row.data.turns.length,4);assert.equal(row.data.turns[1].text,'The kitchen was warm.','Concurrent owner words survive');}},
 {data:[{id:contributionId}]}];
assert.deepEqual(await(await worker.fetch(req('/api/invites',{action:'review',contributionId,decision:'approve'}),env)).json(),{approved:true,mergedTurns:2});
assert.equal(queue.length,0);

// 9. Three lost races in a row refuse honestly instead of clobbering.
queue=[authenticated(),{data:[{id:contributionId,story_id:storyId,author_label:'Mei (aunt)',contributor_user_id:null,turns:guestTurns}]},
 {data:[{id:storyId}]},{data:[{data:ownerBlob,revision:2}]},{data:[]},
 {data:[{data:ownerBlob,revision:2}]},{data:[]},
 {data:[{data:ownerBlob,revision:2}]},{data:[]}];
const raced=await worker.fetch(req('/api/invites',{action:'review',contributionId,decision:'approve'}),env);
assert.equal(raced.status,409);assert.equal(queue.length,0);

// 10. Sign-in upgraded attribution: the contributor user id rides onto the turns.
queue=[authenticated(),{data:[{id:contributionId,story_id:storyId,author_label:'Mei (aunt)',contributor_user_id:someoneElse,turns:guestTurns}]},
 {data:[{id:storyId}]},{data:[{data:ownerBlob,revision:2}]},
 {data:[{id:storyId}],check:(url,init)=>{assert.deepEqual(JSON.parse(init.body).data.turns[1].author,{label:'Mei (aunt)',userId:someoneElse});}},
 {data:[{id:contributionId}]}];
assert.deepEqual(await(await worker.fetch(req('/api/invites',{action:'review',contributionId,decision:'approve'}),env)).json(),{approved:true,mergedTurns:2});
assert.equal(queue.length,0);

// 11. Decline stamps the row and never reads or writes the story.
queue=[authenticated(),
 {data:[{id:contributionId,story_id:storyId,author_label:'Mei (aunt)',contributor_user_id:null,turns:guestTurns}]},
 {data:[{id:storyId}]},
 {data:[{id:contributionId}],check:(url,init)=>{assert.ok(url.includes('storypress_contributions?id=eq.'+contributionId+'&status=eq.pending'));assert.equal(JSON.parse(init.body).status,'declined');}}];
assert.deepEqual(await(await worker.fetch(req('/api/invites',{action:'review',contributionId,decision:'decline'}),env)).json(),{declined:true});
assert.equal(queue.length,0,'Declining must not touch the story');

// 12. Auth and ownership guard the review path.
queue=[];assert.equal((await worker.fetch(req('/api/invites',{action:'review',contributionId,decision:'approve'},false),env)).status,401,'Review needs an account');
assert.equal(queue.length,0,'An unauthenticated review makes no upstream calls');
queue=[authenticated(),{data:[{id:contributionId,story_id:storyId,author_label:'Mei (aunt)',contributor_user_id:null,turns:guestTurns}]},{data:[]}];
assert.equal((await worker.fetch(req('/api/invites',{action:'review',contributionId,decision:'approve'}),env)).status,404,'Another account\'s story is invisible');
assert.equal(queue.length,0);

// 13. The /i/ route serves a hardened static shell that never embeds the token.
queue=[];
const guestRoute=await worker.fetch(new Request(base+'/i/'+token),env);
assert.equal(guestRoute.status,200);assert.equal(guestRoute.headers.get('Cache-Control'),'no-store');
assert.equal(guestRoute.headers.get('X-Robots-Tag'),'noindex, nofollow');assert.equal(guestRoute.headers.get('Referrer-Policy'),'no-referrer');
assert.equal(guestRoute.headers.get('X-Content-Type-Options'),'nosniff');
const csp=guestRoute.headers.get('Content-Security-Policy')||'';
assert.ok(csp.includes("frame-ancestors 'none'"));assert.ok(csp.includes("font-src 'self' data:"));
assert.ok(!(await guestRoute.text()).includes(token),'The shell must not embed the capability token');
assert.equal((await worker.fetch(new Request(base+'/i/'+'g'.repeat(64)),env)).status,404,'Malformed tokens get no route');
assert.equal(queue.length,0);

globalThis.fetch=original;
console.log('Passed: invite creation with database defaults, token-shaped guest context (no blob reads), expiry/revocation dead ends, invite-scoped AI reservation, attributed pending contributions, revision-guarded approval retries, sign-in attribution upgrade, decline-without-story-writes, ownership guards, hardened /i/ shell and contributor bylines. Supabase responses mocked; live database activation still required.');
