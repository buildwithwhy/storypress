import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export * from './lib/story-saver.ts'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {createStorySaver,hasStoryContent}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const base={name:'Fictional narrator',language:'en',occasion:'life',turns:[],sources:[],sample:false,approved:false};
const first={...base,draft:'An unfinished first answer'},second={...first,draft:'A longer answer that arrived during saving',paper:{headline:'A memory',standfirst:'A fictional scene.',paragraphs:['A full story.'],quote:''}};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(){let count=0,active=0,maxActive=0,block=null,fail=false;const calls=[],rows=new Map(),identities=[],statuses=[];
 const saver=createStorySaver({save:async(story,identity)=>{active++;maxActive=Math.max(maxActive,active);calls.push({kind:'save',story,identity});try{if(block)await block;if(fail){fail=false;throw new Error('Offline');}const id=identity?.id||'row-'+(++count),old=rows.get(id);assert.equal(identity?.revision||0,old?.revision||0);const next={id,revision:(old?.revision||0)+1,share_token:old?.share_token||null};rows.set(id,{...next,story});return next;}finally{active--;}},changeSharing:async(action,identity)=>{active++;maxActive=Math.max(maxActive,active);try{calls.push({kind:action,identity});const old=rows.get(identity.id);assert.equal(identity.revision,old.revision);const next={id:identity.id,revision:identity.revision+1,share_token:action==='share'?'link':null};rows.set(identity.id,{...old,...next});return next;}finally{active--;}},remove:async id=>{rows.delete(id);},onSaved:value=>identities.push(value),onStatus:(value,error)=>statuses.push({value,error})});
 return {saver,calls,rows,identities,statuses,get maxActive(){return maxActive;},hold(){let release;block=new Promise(resolve=>release=resolve);return()=>{block=null;release();};},fail(){fail=true;}};
}
assert.equal(hasStoryContent(base),false);assert.equal(hasStoryContent({...base,turns:[{role:'assistant',text:'Welcome'}]}),false);assert.equal(hasStoryContent({...first,sample:true}),false);assert.equal(hasStoryContent(first),true);
{
 const f=fixture();f.saver.replace(first,null);const release=f.hold(),auto=f.saver.flush();await tick();f.saver.update(second);const manual=f.saver.flush(),sharing=f.saver.changeSharing('share');release();await Promise.all([auto,manual,sharing]);
 assert.equal(f.rows.size,1,'Autosave and manual save must not create duplicate stories');assert.equal(f.rows.get('row-1').story.paper.headline,'A memory');assert.equal(f.rows.get('row-1').story.draft,second.draft,'Save the newer unsent answer');assert.deepEqual(f.calls.map(call=>call.kind),['save','save','share']);assert.equal(f.maxActive,1,'Save/share operations never overlap');assert.equal(f.rows.get('row-1').revision,3);
 f.saver.update({...second,approved:true});await f.saver.flush();assert.equal(f.rows.get('row-1').revision,4,'Autosave uses the revision returned by sharing');
}
{
 const f=fixture();f.saver.replace(first,null);const release=f.hold(),saving=f.saver.flush();await tick();const switching=f.saver.switchTo({...first,draft:'Second story'},null);release();await saving;await switching;await f.saver.flush();assert.equal(f.rows.size,2);assert.equal(f.rows.get('row-1').story.draft,first.draft);assert.equal(f.rows.get('row-2').story.draft,'Second story','Starting a new story gets a new identity');
}
{
 const f=fixture();f.saver.replace(first,null);f.fail();await assert.rejects(f.saver.switchTo({...first,draft:'New story'},null),/Offline/);await f.saver.flush();assert.equal(f.rows.get('row-1').story.draft,first.draft,'Failed save prevents switching away from the original');assert.ok(f.statuses.some(status=>status.value==='error'));
}
{
 const f=fixture();f.saver.replace(first,null);await f.saver.flush();const firstRow=f.rows.get('row-1');await f.saver.switchTo({...first,draft:'A different saved memory'},null);await f.saver.flush();const secondRow=f.rows.get('row-2');
 await f.saver.switchTo(firstRow.story,firstRow,true);f.saver.update(second);const release=f.hold(),saving=f.saver.flush();await tick();const opening=f.saver.switchTo(secondRow.story,secondRow,true);release();await Promise.all([saving,opening]);await f.saver.flush();
 assert.equal(f.rows.get('row-1').story.draft,second.draft,'Old-story save completes on its own identity');assert.equal(f.rows.get('row-2').story.draft,'A different saved memory','Opening another saved story never overwrites it with the old one');assert.equal(f.identities.at(-1).id,'row-2','No late callback reactivates the old story');
}
{
 const f=fixture();f.saver.replace(first,null);f.fail();await assert.rejects(f.saver.flush(),/Offline/);assert.equal(f.statuses.at(-1).value,'error','Failure must remain visibly failed, not saved');assert.equal(f.rows.size,0);assert.equal(f.identities.at(-1),null,'Do not invent a saved identity on failure');
}
{
 const f=fixture();f.saver.replace(first,null);await f.saver.flush();const loaded=f.rows.get('row-1');await f.saver.switchTo(loaded.story,loaded,true);await f.saver.flush();assert.equal(f.calls.length,1,'Opening an unchanged saved story does not rewrite it');await f.saver.remove('row-1');await f.saver.flush();assert.equal(f.rows.size,0,'Deleting the active story must not resurrect it');
}
{
 const f=fixture();f.saver.replace({...first,sample:true},null);await f.saver.flush();f.saver.replace(base,null);await f.saver.flush();assert.equal(f.calls.length,0,'Empty and sample stories do not reach account storage');
 f.saver.replace(second,null);await f.saver.flush();assert.equal(f.rows.size,1,'A recovered local newspaper autosaves without another AI request');
}
console.log('Passed: serialized autosave/manual/share, newest unsent text and paper, identity/revision ordering, safe new-story switch, failure retention, loaded drafts, deletion, and sample exclusion.');
