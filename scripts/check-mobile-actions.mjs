// Mobile action bar composition: the tell stage's bar must always show an honest
// primary action — "Make my newspaper" only when the story can be finished, otherwise
// "Send answer" with a one-line reason — plus skip, and never a dead enabled CTA.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export * from './lib/mobile-actions.ts'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {tellStageActions,mobileActionCopy}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const copy=mobileActionCopy.en;
const state=over=>({canFinish:false,canSend:false,isSample:false,busy:false,liveVoice:false,...over});

// Eligible story: "Make my newspaper" is the primary and it is enabled; skip rides along.
{
 const actions=tellStageActions(state({canFinish:true}),copy);
 assert.equal(actions.length,2);
 const finish=actions.find(a=>a.id==='finish'),skip=actions.find(a=>a.id==='skip');
 assert.equal(finish.kind,'primary');assert.equal(finish.enabled,true);assert.equal(finish.hint,undefined);
 assert.equal(skip.kind,'secondary');assert.equal(skip.enabled,true);
 assert.equal(actions.filter(a=>a.kind==='primary').length,1,'At most one primary action');
 assert.equal(new Set(actions.map(a=>a.id)).size,actions.length,'No duplicated actions on the bar');
}

// Busy while eligible: the CTA disables but stays honest (no misleading hint needed mid-flight).
{
 const [finish]=tellStageActions(state({canFinish:true,busy:true}),copy);
 assert.equal(finish.id,'finish');assert.equal(finish.enabled,false);
}

// Nothing to finish and nothing typed: primary is "Send answer", disabled, with a reason —
// never an enabled-but-dead "Make my newspaper".
{
 const actions=tellStageActions(state(),copy);
 assert.equal(actions.length,2);
 const send=actions.find(a=>a.id==='send');
 assert.equal(send.kind,'primary');assert.equal(send.enabled,false);
 assert.equal(typeof send.hint,'string');assert.ok(send.hint.length>0,'A disabled CTA explains itself in one line');
 assert.equal(actions.find(a=>a.id==='finish'),undefined,'No finish CTA when the story cannot be finished');
 assert.equal(actions.find(a=>a.id==='skip').kind,'secondary');
}

// Live conversation: same honest structure, different reason.
{
 const [send]=tellStageActions(state({liveVoice:true}),copy);
 assert.equal(send.id,'send');assert.equal(send.enabled,false);assert.ok(send.hint&&send.hint!==copy.answerFirst);
}

// Typed text present but no sent words yet: the story can already be finished
// (an unsent draft belongs to the keepsake), so finish outranks send.
{
 const actions=tellStageActions(state({canFinish:true,canSend:true}),copy);
 assert.equal(actions.find(a=>a.id==='finish').kind,'primary');
 assert.equal(actions.find(a=>a.id==='send'),undefined,'The bar never duplicates a competing primary action');
}

// Sample previews get no bar at all: the page already explains preview mode.
assert.deepEqual(tellStageActions(state({isSample:true,canFinish:true}),copy),[]);

// Every language ships every hint, and no hint is a placeholder.
for(const language of ['en','zh','es']){
 const labels=mobileActionCopy[language];
 for(const key of ['finishFirst','answerFirst','talkFirst'])assert.ok(labels[key]&&labels[key].length>4,`${language}.${key} is a real sentence`);
 const empty=tellStageActions(state(),labels),live=tellStageActions(state({liveVoice:true}),labels);
 assert.notEqual(empty.find(a=>a.id==='send').hint,live.find(a=>a.id==='send').hint,`${language}: live mode explains itself differently`);
}

// An enabled primary CTA never carries a hint — hints are only for disabled CTAs.
{
 const [send]=tellStageActions(state({canSend:true}),copy); // canSend without canFinish is unreachable in the app, but must stay honest if it ever happens
 assert.equal(send.kind,'primary');assert.equal(send.enabled,true);assert.equal(send.hint,undefined);
}
console.log('Passed: mobile action bar composition — honest primary CTA, single primary, skip secondary, sample suppression, trilingual hints.');
