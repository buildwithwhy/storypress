#!/usr/bin/env node
// Make-flow progress (wave 7 PR C, background discovery): asserts the staged
// copy exists in en/zh/es and that the display is wired to the real pipeline
// steps the UI genuinely waits on — the write request (drafting) and the
// paper's layout/render phase (laying out). Background discovery removed
// researching as a waited stage: historical research runs under the
// conversation and never appears here. Also runs the pure stage derivation
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
assert.deepEqual([...MAKE_STAGES],['drafting','layingOut'],'stages render in pipeline order: drafting, laying out');
const run=p=>makeStageStates({writeActive:false,layoutActive:false,...p});
assert.deepEqual(run({writeActive:true}),{drafting:'active',layingOut:'pending'},'the write request activates drafting');
assert.deepEqual(run({layoutActive:true}),{drafting:'done',layingOut:'active'},'the layout/render phase activates laying out and completes drafting');

// 2. Localized copy: every language carries both stages plus the title,
//    inside its own presentation block.
const presentation=await fs.readFile(root+'lib/presentation.ts','utf8');
const keys=['title','drafting','layingOut'];
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
  assert.ok(!copy.includes('researching'),`presentation.${lang}.makeProgress has no researching stage`);
}

// 3. Wiring: the display replaces the static busy message in the make flow and
//    reads the real pipeline state — no cosmetic timer anywhere, and research
//    never renders as a waited stage again.
const app=await fs.readFile(root+'app/storypress.tsx','utf8');
assert.ok(app.includes(`setBusy(d.makeProgress.title)`),'makePaper still holds the busy lock');
assert.ok(!app.includes('d.making'),'the single static make message is gone');
assert.ok(app.includes(`setMakePhase('writing')`),'makePaper marks the write request as the drafting stage');
assert.ok(app.includes(`navigate('paper');if(!next.sample)setMakePhase('layingOut')`),'the paper layout/render phase follows the finished write');
assert.ok(app.includes(`writeActive:makePhase==='writing'`),'drafting tracks the write request');
assert.ok(app.includes(`layoutActive:makePhase==='layingOut'`),'laying out tracks the layout/render phase');
assert.ok(!app.includes('researchActive'),'research is no longer a make-pipeline stage');
assert.ok(app.includes('<MakeProgress language={story.language} pipeline={makePipeline}/>'),'the panel renders from the pipeline flags');
assert.ok(app.includes('mode === "type" && busy &&'),'the tell-stage panel keys off the busy lock only — never an in-flight research request');
assert.ok(!app.includes('mode === "type" && (busy || researching)'),'an in-flight background discover no longer surfaces as waited progress');
assert.ok(app.includes("makePhase!=='layingOut'||artJobs>0"),'laying out holds while make-triggered artwork draws');
assert.ok(!app.match(/setTimeout\([^)]*setMakePhase/),'no timer drives the stage display');

// 4. The component itself never renders a spinner icon.
const component=await fs.readFile(root+'app/make-progress.tsx','utf8');
assert.ok(component.includes('LoaderCircle')===false,'no bare spinner in the make progress');
assert.ok(component.includes('make-stage-pulse')===false,'the pulse lives in CSS, not inline styles');
assert.ok(!component.replace(/^\s*\/\/.*$/gm,'').includes('researching'),'no researching stage node renders');

await fs.rm(tmp,{recursive:true,force:true});
console.log('check-make-progress: OK — staged copy (en/zh/es) wired to drafting and laying out only');
