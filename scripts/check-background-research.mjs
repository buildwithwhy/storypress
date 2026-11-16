#!/usr/bin/env node
// Background discovery (spec art_GaoPsELF): pins the auto-fire truth table
// (tc-2), the silent background-failure path with the 429 daily_allowance
// day-disable (tc-3), the localized observation chip and its suppression
// while a question streams or live voice is active (tc-4), and the
// public-clues-only planner rule (tc-8). Pure logic is bundled and executed;
// wiring is asserted against the real sources.
// Run: node scripts/check-background-research.mjs
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));

// 1. The pure guard: every condition and boundary of shouldAutoDiscover.
const tmp=path.join(os.tmpdir(),'background-research-check-'+process.pid);
await fs.mkdir(tmp,{recursive:true});
const bundled=await build({entryPoints:[root+'lib/background-research.ts'],bundle:true,write:false,format:'esm'});
await fs.writeFile(path.join(tmp,'background-research.mjs'),bundled.outputFiles[0].text);
const {shouldAutoDiscover,remainingDailyAiUnits,DISCOVER_COST_UNITS,WRITE_RESERVE_UNITS,ILLUSTRATE_RESERVE_UNITS,TOTAL_RESERVE_UNITS,MAX_AUTO_ATTEMPTS,MIN_NARRATOR_TURNS}=await import(path.join(tmp,'background-research.mjs'));
assert.equal(DISCOVER_COST_UNITS,3,'discover reserves 3 units');
assert.equal(WRITE_RESERVE_UNITS,1,'write reserves 1 unit');
assert.equal(ILLUSTRATE_RESERVE_UNITS,3,'one metered illustration reserves 3 units (reserveAi discover action on the illustrate path)');
assert.equal(TOTAL_RESERVE_UNITS,7,'the total reserve is 3 + 1 + 3');
assert.equal(MAX_AUTO_ATTEMPTS,3,'at most 3 automatic attempts per draft');
assert.equal(MIN_NARRATOR_TURNS,2,'at least 2 narrator turns before firing');

const fire={isSample:false,canUseAi:true,researching:false,searched:false,narratorWords:2,attemptsSoFar:0,newWordsSinceLastAttempt:true,remainingAiUnits:7};
assert.equal(shouldAutoDiscover(fire),true,'the firing boundary is exactly 7 remaining units');
const no=(over,why)=>assert.equal(shouldAutoDiscover({...fire,...over}),false,why);
no({isSample:true},'never on sample stories');
no({canUseAi:false},'never when AI is unavailable');
no({researching:true},'never twice in flight');
no({searched:true},'never after a search has settled');
no({narratorWords:1},'not before 2 narrator turns');
assert.equal(shouldAutoDiscover({...fire,attemptsSoFar:2}),true,'a third attempt still fires');
no({attemptsSoFar:3},'hard-capped at 3 automatic attempts');
no({newWordsSinceLastAttempt:false},'re-armed only by new narrator words');
no({remainingAiUnits:null},'unknown remaining units fail closed');
no({remainingAiUnits:6},'remaining below the 7-unit reserve never fires');
assert.equal(shouldAutoDiscover({...fire,remainingAiUnits:8}),true,'remaining above the boundary fires');
assert.equal(shouldAutoDiscover({...fire,narratorWords:1,attemptsSoFar:3,remainingAiUnits:null}),false,'every condition holds at once');

// 2. remainingDailyAiUnits: the additive account field against the 40/day cap;
//    absent field (pilot mode) or absent block reads as unknown.
assert.equal(remainingDailyAiUnits({dailyAiUnitsUsed:33}),7,'33 used leaves the 7-unit reserve');
assert.equal(remainingDailyAiUnits({dailyAiUnitsUsed:34}),6,'34 used drops below the reserve');
assert.equal(remainingDailyAiUnits({dailyAiUnitsUsed:0}),40,'a fresh day has the full cap');
assert.equal(remainingDailyAiUnits({}),null,'an absent usage field fails closed');
assert.equal(remainingDailyAiUnits(undefined),null,'an absent billing block fails closed');

// 3. The caller: background failures stay silent, the 429 day-disable latches,
//    and the chip suppresses while a question streams or live voice is active.
const app=await fs.readFile(root+'app/storypress.tsx','utf8');
assert.ok(app.includes(`void runDiscover({interactive:false})`),'the auto effect fires the background caller');
assert.ok(app.includes(`if(interactive?!canUseAi():!aiEligible())return;`),'the background path uses the side-effect-free eligibility check');
const silentCatch=`if(interactive){if(!controller.signal.aborted&&generation===storyGeneration.current)setError(problemText(e));}
   else if((e as {code?:unknown}).code==='daily_allowance')autoResearchBlocked.current=true;`;
assert.ok(app.includes(silentCatch),'only the interactive caller may surface an error; the auto path latches the 429 day-disable');
assert.ok(app.includes(`if(!interactive&&result.sources.length)setDiscoveryNotice(true);`),'a merged background result raises the observation chip');
assert.ok(app.includes(`autoResearchBlocked.current?null:remainingDailyAiUnits(account.billing)`),'a latched 429 reads as unknown capacity — fail-closed for the day');
assert.ok(app.includes(`setDiscoveryNotice(false)`),'the chip clears with the research teardown (story switch, language change, new story)');
assert.ok(app.includes(`discoveryNotice&&!streamingQuestion&&!liveActive`),'the chip is suppressed while a question streams or live voice is active');
for(const lang of ['en','zh','es']){
  const start=app.indexOf(` ${lang}: { tell:`),block=app.slice(start,app.indexOf('} },',start));
  assert.ok(block.includes('looking: "')&&block.includes('notice: "'),`copy.${lang} carries the looking line and the notice chip`);
}

// 4. The planner prompt (tc-8, two-directional): the must-only public-clues
//    rule scoped to the narrator's OWN people, generic collective historical
//    phrasing explicitly preserved, and the soft "avoid" wording gone — auto
//    and manual searches share this prompt.
const planner=await fs.readFile(root+'skills/research-story-context/references/search-planner.txt','utf8');
assert.ok(planner.includes('may contain ONLY public context'),'the planner states the must-only rule');
assert.ok(planner.includes("the narrator's own people")&&planner.includes('first-person family or relationship words in any narrator language'),'the planner forbids the narrator\'s own people: names and first-person family words in every narrator language');
assert.ok(planner.includes('Generic collective historical phrasing stays allowed')&&planner.includes('must not be over-blocked'),'the planner preserves generic collective historical phrasing (the Queens-class query survives)');
assert.ok(planner.includes('private details'),'the planner forbids private details from the narrator memories');
assert.ok(planner.includes('every search, automatic or one the narrator reviews'),'the rule applies to auto and manual discovery alike');
assert.ok(!planner.includes('Avoid private names'),'the soft avoid wording is gone');

await fs.rm(tmp,{recursive:true,force:true});
console.log('check-background-research: OK — truth table, silent failures, 429 day-disable, chip suppression, public-clues-only planner');
