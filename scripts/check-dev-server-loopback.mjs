#!/usr/bin/env node
// Guards the dev server's loopback detection (scripts/dev-server.mjs). Its port group
// was once double-escaped as (:\\d+)?, which can never match, so loopback was always
// false for real Host headers (browsers always send host:port). The server then built
// https:// request URLs for plain http loopback traffic and sameOrigin
// (server/storage.ts) 403'd every browser POST from http://127.0.0.1:4173.
// Run: npm run build && node scripts/check-dev-server-loopback.mjs
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));

// 1. The regex as the dev server actually compiles it (not a copy that can drift).
const source=fs.readFileSync(root+'scripts/dev-server.mjs','utf8');
const extracted=source.match(/const loopback=(\/.+?\/)\.test\(host\)/);
assert.ok(extracted,'dev-server.mjs still derives loopback from a regex over host');
const loopback=new RegExp(extracted[1].slice(1,-1));
for(const host of ['127.0.0.1:4173','127.0.0.1','localhost:4173','localhost','[::1]:4173','[::1]'])
  assert.ok(loopback.test(host),`loopback host must be detected: ${host}`);
for(const host of ['storypress-preview.example.test:443','storypress-app.vercel.app','evil-127.0.0.1.evil.com','127.0.0.2:4173','0.0.0.0:4173'])
  assert.ok(!loopback.test(host),`non-loopback host must fail closed to https: ${host}`);

// 2. End-to-end repro: POST from loopback origins against the real dev server and
// require the sameOrigin check to pass (the request reaches the 401 sign-in gate,
// never the 403 "Please open Once & Ours directly.").
if(!fs.existsSync(root+'dist/server/index.js')){
  console.log('dist/server/index.js missing — building…');
  await new Promise((resolve,reject)=>{const p=spawn('npm',['run','build'],{cwd:root,stdio:'inherit'});p.on('exit',c=>c===0?resolve():reject(new Error('npm run build failed')));});
}
const freePort=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
const server=spawn('node',['scripts/dev-server.mjs'],{cwd:root,env:{...process.env,STORYPRESS_PORT:String(freePort)},stdio:['ignore','pipe','inherit']});
try{
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('dev server did not start')),30000);
    server.stdout.on('data',d=>{if(String(d).includes(`http://127.0.0.1:${freePort}`)){clearTimeout(timer);resolve();}});
    server.on('exit',c=>reject(new Error('dev server exited early with code '+c)));
  });
  const post=origin=>{const {hostname,port:originPort}=new URL(origin);return new Promise((resolve,reject)=>{
    // A browser sends Host matching the address bar, so it must match the Origin here.
    const req=http.request({host:hostname,port:originPort,path:'/api/billing',method:'POST',headers:{Host:`${hostname}:${originPort}`,Origin:origin,'Content-Type':'application/json'}},res=>{
      let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}));
    });
    req.on('error',reject);req.end(JSON.stringify({action:'status'}));
  });};
  const origin403='Please open Once & Ours directly.';
  // The failure mode this guards: a broken loopback match forces proto=https, so the
  // request URL origin mismatches the browser's http:// Origin and sameOrigin 403s
  // before anything else runs. Anything else (400/401/503…) means the check passed.
  for(const origin of [`http://127.0.0.1:${freePort}`,`http://localhost:${freePort}`]){
    const r=await post(origin);
    assert.ok(!r.body.includes(origin403),`loopback POST from ${origin} must pass the same-origin check (got ${r.status}: ${r.body})`);
  }
  const cross=await new Promise((resolve,reject)=>{
    // Same socket, forged Origin: only the header differs from the loopback probes.
    const req=http.request({host:'127.0.0.1',port:freePort,path:'/api/billing',method:'POST',headers:{Host:`127.0.0.1:${freePort}`,Origin:'https://evil.example','Content-Type':'application/json'}},res=>{
      let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}));
    });
    req.on('error',reject);req.end(JSON.stringify({action:'status'}));
  });
  assert.equal(cross.status,403,'cross-origin POST is still rejected');
  assert.ok(cross.body.includes(origin403),'cross-origin rejection uses the sameOrigin error');
  console.log('Passed loopback detection for 127.0.0.1/localhost/[::1] (with and without ports), http loopback POSTs pass the same-origin check, and cross-origin POSTs still fail closed.');
}finally{
  server.kill();
}
