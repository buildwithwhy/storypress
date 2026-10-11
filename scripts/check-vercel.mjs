import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {serveVercel} from '../server/vercel.mjs';
import shared from '../api/shared.mjs';
const origin='https://storypress.example';
const env={SUPABASE_URL:'https://supabase.example',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_SECRET_KEY:'sb_secret_fixture',GEMINI_API_KEY:'fixture',STORYPRESS_PUBLIC_SHARING:'true'};
const request=(path,body)=>new Request(origin+path,{method:body?'POST':'GET',headers:{'oai-authenticated-user-id':'spoofed-owner','Content-Type':'application/json',Origin:origin},...(body?{body:JSON.stringify(body)}:{})});
const originalFetch=globalThis.fetch;
let calls=[];
globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});throw Error('Unexpected request');};
try{
  const config=JSON.parse(await fs.readFile('vercel.json','utf8'));
  assert.equal(config.outputDirectory,'dist-public');
  assert.match(await fs.readFile('dist-public/index.html','utf8'),/id="root"/);
  assert.ok((await fs.stat('dist-public/app.js')).size>10000);
  assert.equal((await serveVercel(request('/api/story',{action:'interview'}),'/api/story',{})).status,503);
  assert.equal((await serveVercel(request('/api/story',{action:'interview'}),'/api/story',env)).status,401);
  assert.equal((await serveVercel(request('/api/stories'),'/api/stories',env)).status,401);
  const account=await(await serveVercel(request('/api/account'),'/api/account',env)).json();
  assert.equal(account.user,null);
  assert.equal(account.supabase.key,env.SUPABASE_PUBLISHABLE_KEY);
  assert.ok(!JSON.stringify(account).includes(env.SUPABASE_SECRET_KEY));
  assert.equal(calls.length,0,'An untrusted Sites header must not grant AI or storage access');
  const id='11111111-1111-4111-8111-111111111111';
  globalThis.fetch=async(url,init)=>{
    if(String(url)==='https://supabase.example/auth/v1/user')return Response.json({id});
    assert.match(String(url),new RegExp('owner_id=eq.'+id));
    return Response.json([]);
  };
  const authed=new Request(origin+'/api/stories',{headers:{Authorization:'Bearer fixture-jwt'}});
  assert.equal((await serveVercel(authed,'/api/stories',env)).status,200);
  const crossSite=new Request(origin+'/api/story',{method:'POST',headers:{Authorization:'Bearer fixture-jwt',Origin:'https://other.example'},body:'{}'});
  assert.equal((await serveVercel(crossSite,'/api/story',env)).status,403);
  const token='a'.repeat(64);
  const edition={name:'Test',language:'en',occasion:'life',turns:[],sources:[],sample:false,approved:true,paper:{headline:'A saved memory',standfirst:'A fictional test.',paragraphs:['The kitchen was warm.'],quote:''}};
  globalThis.fetch=async(url)=>{assert.ok(String(url).includes('share_token=eq.'+token));return Response.json([{edition}]);};
  const savedEnv=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
  try{
    Object.assign(process.env,env);
    for(const path of ['/s/'+token,'/api/shared?token='+token]){
      const response=await shared.fetch(new Request(origin+path));
      assert.equal(response.status,200);assert.match(await response.text(),/A saved memory/);
      assert.equal(response.headers.get('Cache-Control'),'no-store');
    }
    process.env.STORYPRESS_PUBLIC_SHARING='false';
    assert.equal((await shared.fetch(new Request(origin+'/s/'+token))).status,404);
  }finally{for(const [k,v]of Object.entries(savedEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
  assert.equal((await shared.fetch(new Request(origin+'/api/shared?token=invalid'))).status,404);
  console.log('Passed: Vercel build assets, missing-config refusal, spoofed-header rejection, Supabase identity, origin checks, shared edition paths and sharing disabled. Provider calls mocked; hosted Vercel deployment still needs verification.');
}finally{globalThis.fetch=originalFetch;}
