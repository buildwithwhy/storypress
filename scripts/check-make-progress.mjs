#!/usr/bin/env node
// Make-flow progress (wave 7 PR C): asserts the three-stage copy exists in
// en/zh/es and that the display is wired to the real pipeline steps the UI
// already knows — a discover request in flight (researching), the write
// request (drafting), and the paper's layout/render phase including
// make-triggered artwork (laying out). Also runs the pure stage derivation
// against every pipeline combination that can occur.
// Run: npm run build && node scripts/check-make-progress.mjs
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));

// 1. The pure derivation: each stage reflects only the real pipeline step.
const tmp=path.join(os.tmpdir(),'make-progress-check-'+process.pid);
await fs.mkdir(tmp,{recursive:true});
const bundled=await build({entryPoints:[root+'lib/make-progress.ts'],bundle:true,write:false,format:'esm'});
await fs.writeFile(path.join(tmp,'make-progress.mjs'),bundled.outputFiles[0].text);
const {MAKE_STAGES,makeStageStates}=await import(path.join(tmp,'make-progress.mjs'));
assert.deepEqual([...MAKE_STAGES],['researching','drafting','layingOut'],'stages render in pipeline order: researching, drafting, laying out');
const run=p=>makeStageStates({researchActive:false,researchDone:false,writeActive:false,layoutActive:false,...p});
assert.deepEqual(run({researchActive:true}),{researching:'active',drafting:'pending',layingOut:'pending'},'a discover request in flight activates researching');
assert.deepEqual(run({researchDone:true,writeActive:true}),{researching:'done',drafting:'active',layingOut:'pending'},'finished research shows done and the write request activates drafting');
assert.deepEqual(run({writeActive:true}),{researching:'skipped',drafting:'active',layingOut:'pending'},'research that never ran shows skipped, never a fake done');
assert.deepEqual(run({layoutActive:true}),{researching:'skipped',drafting:'done',layingOut:'active'},'the layout/render phase activates laying out and completes drafting');

// 2. Localized copy: every language carries all three stages plus the title
//    and the skipped note, inside its own presentation block.
const presentation=await fs.readFile(root+'lib/presentation.ts','utf8');
const keys=['title','researching','drafting','layingOut','researchSkipped'];
const presentationStart=presentation.indexOf('export const presentation = {');
assert.ok(presentationStart>0,'presentation export exists');
for(const lang of ['en','zh','es']){
  const start=presentation.indexOf(`  ${lang}: {`,presentationStart);
  assert.ok(start>0,`presentation.${lang} exists`);
  const end=presentation.indexOf('  },',start);
  const block=presentation.slice(start,end);
  const copyStart=block.indexOf('makeProgress: {');
  assert.ok(copyStart>0,`presentation.${lang}.makeProgress exists`);
  const copy=block.slice(copyStart,block.indexOf('} },',copyStart));
  for(const key of keys)assert.ok(copy.includes(`${key}: "`),`presentation.${lang}.makeProgress.${key} is set`);
}

// 3. Wiring: the display replaces the static busy message in the make flow and
//    reads the real pipeline state — no cosmetic timer anywhere.
const app=await fs.readFile(root+'app/storypress.tsx','utf8');
assert.ok(app.includes(`setBusy(d.makeProgress.title)`),'makePaper still holds the busy lock');
assert.ok(!app.includes('d.making'),'the single static make message is gone');
assert.ok(app.includes(`setMakePhase('writing')`),'makePaper marks the write request as the drafting stage');
assert.ok(app.includes(`navigate('paper');if(!next.sample)setMakePhase('layingOut')`),'the paper layout/render phase follows the finished write');
assert.ok(app.includes(`researchActive:researching`),'researching reads the live discover-request state');
assert.ok(app.includes(`researchDone:searched||story.sources.length>0`),'researching completes only from real settled research');
assert.ok(app.includes(`writeActive:makePhase==='writing'`),'drafting tracks the write request');
assert.ok(app.includes(`layoutActive:makePhase==='layingOut'`),'laying out tracks the layout/render phase');
assert.ok(app.includes('<MakeProgress language={story.language} pipeline={makePipeline}/>'),'the panel renders from the pipeline flags');
assert.ok(app.includes('mode === "type" && (busy || researching)'),'a live discover request surfaces in the tell-stage panel, not just make phases');
assert.ok(app.includes("makePhase!=='layingOut'||artJobs>0"),'laying out holds while make-triggered artwork draws');
assert.ok(!app.match(/setTimeout\([^)]*setMakePhase/),'no timer drives the stage display');

// 4. The component itself never renders a spinner icon.
const component=await fs.readFile(root+'app/make-progress.tsx','utf8');
assert.ok(component.includes('LoaderCircle')===false,'no bare spinner in the make progress');
assert.ok(component.includes('make-stage-pulse')===false,'the pulse lives in CSS, not inline styles');

await fs.rm(tmp,{recursive:true,force:true});
console.log('check-make-progress: OK — three-stage copy (en/zh/es) wired to the real pipeline steps');
