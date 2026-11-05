import assert from 'node:assert/strict';
import http from 'node:http';
import {build} from 'esbuild';
import worker from '../dist/server/index.js';

// Wave 5 change 3 fixture (art_VetIBa76): a Supabase-shaped rejection. The
// upstream answers HTTP 404 with the PostgREST body of an unapplied migration —
// the exact live signature of the recurring red collaboration error. The old
// db() collapsed this into one opaque 503 and dropped the diagnostics; the
// fixture proves the new path logs them and hands the client a machine code.
const upstream=http.createServer((request,response)=>{
 const path=request.url||'';
 if(path.startsWith('/auth/v1/user')){
  response.setHeader('Content-Type','application/json');
  response.end(JSON.stringify({id:'11111111-1111-4111-8111-111111111111',email:'founder@example.invalid'}));
  return;
 }
 response.setHeader('Content-Type','application/json');
 response.statusCode=404;
 response.end(JSON.stringify({code:'PGRST205',message:"Could not find the table 'public.storypress_invites' in the schema cache",hint:'Perhaps you want to make sure the schema is loaded?'}));
});
await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
const port=upstream.address().port;
const base='https://app.test';
const env={SUPABASE_URL:`http://127.0.0.1:${port}`,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test-only',SUPABASE_SECRET_KEY:'sb_secret_test-only'};
const storyId='22222222-2222-4222-8222-222222222222';
const req=(path,body,auth=true)=>new Request(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:base,...(auth?{Authorization:'Bearer test-user-token'}:{})},body:body?JSON.stringify(body):undefined});

// 1. Server: the failure carries the machine code and the log carries the
// status, path, and PostgREST code/message/hint the old code threw away.
const errors=[];const originalError=console.error;
console.error=(...args)=>{errors.push(args.map(String).join(' '));};
let data;
try{
 const response=await worker.fetch(req('/api/invites',{action:'create',storyId,question:'What did your grandmother cook?'}),env);
 assert.equal(response.status,503);
 data=await response.json();
}finally{console.error=originalError;}
assert.equal(data.code,'SCHEMA_MISSING');
assert.equal(data.error,'Your account storage isn’t set up for this yet. Your device draft is kept.');
const log=errors.join('\n');
assert.ok(log.includes('"event":"storage_upstream_error"'),'the server log carries the structured storage event');
assert.ok(log.includes('"status":404'),'the server log carries the upstream status');
assert.ok(log.includes('PGRST205'),'the server log carries the PostgREST code');
assert.ok(log.includes('schema cache'),'the server log carries the PostgREST message');
assert.ok(log.includes('storypress_stories'),'the server log carries the failing path');

// 2. Copy module: the machine code picks localized copy (en/zh/es) and is
// appended so one screenshot settles the cause; other codes annotate the
// server message; the paywall's story_limit path stays untouched.
const copyBundle=await build({stdin:{contents:"export * from './lib/storage-copy.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {storageSetupCopy,storageErrorText}=await import('data:text/javascript;base64,'+Buffer.from(copyBundle.outputFiles[0].text).toString('base64'));
assert.equal(storageErrorText('en','SCHEMA_MISSING','generic'),`${storageSetupCopy('en')} (code: SCHEMA_MISSING)`,'en picks the storage-setup copy with the code');
assert.ok(storageSetupCopy('en').includes('isn’t set up for this yet'),'en copy is the storage-setup message');
assert.ok(storageSetupCopy('zh').includes('尚未设置'),'zh copy is localized');
assert.ok(storageSetupCopy('es').includes('aún no está configurado'),'es copy is localized');
assert.equal(storageErrorText('zh','SCHEMA_MISSING','generic'),`${storageSetupCopy('zh')} (code: SCHEMA_MISSING)`,'zh keeps the code annotation');
assert.equal(storageErrorText('es','SCHEMA_MISSING','generic'),`${storageSetupCopy('es')} (code: SCHEMA_MISSING)`,'es keeps the code annotation');
assert.equal(storageErrorText('en','UNKNOWN','generic'),'generic (code: UNKNOWN)','unknown codes annotate the server message');
assert.equal(storageErrorText('en','RESERVE_EMPTY','generic'),'generic (code: RESERVE_EMPTY)','the reserve-empty code annotates too');
assert.equal(storageErrorText('en',undefined,'generic'),'generic','codeless errors keep the server message verbatim');
assert.equal(storageErrorText('en','story_limit','generic'),'generic','story_limit stays on the paywall copy path');

// 3. Invite panel render: a rejected panel call with a machine code shows the
// localized storage-setup copy plus the code in its alert — the owner-side
// surface from the founder's reports.
const throwNet={name:'throw-net',setup(b){b.onLoad({filter:/lib\/(invite-client|account-client)\.ts$/},()=>({contents:`
 export const inviteApi=async()=>{const error=new Error('Your account storage could not complete that step. Your device draft is kept.');(error as any).code='SCHEMA_MISSING';throw error;};
 export const accountRequest=async()=>null;export const accountHeaders=async()=>({});
 export const parseInviteToken=()=>null;export const inviteDraftKey=()=>'draft';export const inviteSentKey=()=>'sent';
 export const GUEST_TURNS_OCTET_LIMIT=40000;export const guestTurnsOctets=()=>0;`,loader:'ts'}));}};
const panelBundle=await build({stdin:{contents:"import {Invites} from './app/invites.tsx';export {Invites};",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',packages:'external',plugins:[throwNet]});
const panelPath=new URL('../work/storage-error-panel.mjs',import.meta.url);
const fs=await import('node:fs/promises');
await fs.mkdir(new URL('../work/',import.meta.url),{recursive:true});
await fs.writeFile(panelPath,panelBundle.outputFiles[0].text);
const panelModule=await import(panelPath.href);
const {default:React}=await import('react');
const {default:TestRenderer,act}=await import('react-test-renderer');
let tr;
await act(async()=>{tr=TestRenderer.create(React.createElement(panelModule.Invites,{language:'en',occasion:'life',storyName:'Wei',saved:{id:storyId,revision:2,share_token:null},onSave:async()=>null,onLoad:async()=>{}}));});
const alert=tr.root.findAll(node=>node.type==='p').find(node=>node.props.role==='alert');
assert.ok(alert,'a rejected panel call renders an alert');
assert.ok(alert.props.children.includes(storageSetupCopy('en')),'the panel alert shows the localized storage-setup copy');
assert.ok(alert.props.children.includes('code: SCHEMA_MISSING'),'the panel alert surfaces the machine code');
tr.unmount();

await new Promise(resolve=>upstream.close(resolve));
console.log('Passed: a Supabase-shaped 404 becomes a coded 503 with the PostgREST diagnostics in the server log, the storage-setup copy localizes en/zh/es with the machine code appended, and the invite panel alert surfaces both.');
