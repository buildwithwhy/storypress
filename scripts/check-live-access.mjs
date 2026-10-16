import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export {handleApi} from './server/api.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',loader:{'.txt':'text'}});
const {handleApi}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const id='11111111-1111-4111-8111-111111111111';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'mock-public',SUPABASE_SECRET_KEY:'mock-private',GEMINI_BACKEND:'vertex',GOOGLE_CLOUD_PROJECT:'fixture',VERTEX_API_KEY:'mock-vertex',GEMINI_API_KEY:'mock-studio',GEMINI_LIVE_MODEL:'gemini-test-live',STORYPRESS_LIVE_VOICE:'gemini',STORYPRESS_LIVE_TEST_EMAILS:'previous-tester@example.invalid'};
const story={name:'Alex',language:'en',occasion:'life',turns:[{role:'user',text:'A fictional memory.'}],sources:[],sample:false,approved:false};
const request=(signed=true,method='GET')=>new Request('https://story.test/api/story',{method,headers:{...(signed?{Authorization:'Bearer fixture'}:{}),Origin:'https://story.test'},...(method==='POST'?{body:JSON.stringify({action:'live',story})}:{})});
let email='new-user@hotmail.com',valid=true,quotaAllowed=true,providerStatus=200,calls=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 const target=String(url);calls.push(target);
 if(target.endsWith('/auth/v1/user'))return Response.json(valid?{id,email}:{error:'expired'},{status:valid?200:401});
 if(target.includes('storypress_reserve_ai')){assert.deepEqual(JSON.parse(init.body),{p_user:id,p_action:'discover'});return Response.json(quotaAllowed);}
 assert.equal(target,'https://generativelanguage.googleapis.com/v1beta/auth_tokens');
 const grant=JSON.parse(init.body);assert.equal(grant.uses,1);assert.ok(Date.parse(grant.expireTime)-Date.now()<=600000);return Response.json(providerStatus===200?{name:'ephemeral-fixture'}:{error:'fixture'},{status:providerStatus});
};
try{
 for(const address of ['new-user@hotmail.com','another-user@gmail.com']){
  email=address;calls=[];
  assert.equal((await(await handleApi(request(),env)).json()).liveVoice,true,'Any verified account can discover live voice despite the old allowlist variable');
  const res=await handleApi(request(true,'POST'),env);assert.equal(res.status,200);assert.equal((await res.json()).token,'ephemeral-fixture');
  assert.equal(calls.filter(x=>x.includes('auth_tokens')).length,1);
 }
 calls=[];assert.equal((await(await handleApi(request(false),env)).json()).liveVoice,false);assert.equal((await handleApi(request(false,'POST'),env)).status,401);assert.equal(calls.length,0);
 valid=false;calls=[];assert.equal((await(await handleApi(request(),env)).json()).liveVoice,false);assert.equal((await handleApi(request(true,'POST'),env)).status,401);assert.ok(calls.every(x=>x.endsWith('/auth/v1/user')));
 valid=true;quotaAllowed=false;calls=[];const quotaResponse=await handleApi(request(true,'POST'),env);assert.equal(quotaResponse.status,429);assert.equal((await quotaResponse.json()).code,'daily_allowance');assert.ok(!calls.some(x=>x.includes('auth_tokens')),'Daily quota refusal must stop token provisioning');quotaAllowed=true;
 providerStatus=429;const busy=await handleApi(request(true,'POST'),env);assert.equal(busy.status,429);assert.equal((await busy.json()).code,'voice_busy','Provider congestion must not masquerade as a spent daily allowance');providerStatus=200;
 for(const config of [{...env,STORYPRESS_LIVE_VOICE:''},{...env,GEMINI_API_KEY:''},{...env,SUPABASE_SECRET_KEY:''},{...env,SUPABASE_URL:''}]){
  calls=[];assert.equal((await(await handleApi(request(),config)).json()).liveVoice,false);assert.equal(calls.length,0,'Unconfigured live voice cannot perform identity or provider requests');
 }
 console.log('Passed: new Hotmail/Google users, obsolete allowlist ignored, unauthenticated and expired sessions denied, durable daily quota and one-use ten-minute grants retained, missing configuration closed. Provider calls mocked.');
}finally{globalThis.fetch=originalFetch;}
