import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export * from './lib/draft-handoff.ts'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {DRAFT_PREFIX,GUEST_DRAFT_KEY,HANDOFF_KEY,HANDOFF_TTL,GOOGLE_HANDOFF_KEY,GOOGLE_HANDOFF_TTL,accountDraftKey,readDraft,writeDraft,writeChangedDraft,prepareGuestHandoff,prepareGoogleHandoff,resumeGuestHandoff,restoreAccountDraft}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
class Store{
 values=new Map();failKey=null;
 getItem(key){return this.values.get(key)||null;}
 setItem(key,value){if(key===this.failKey){this.failKey=null;throw new Error('Storage full');}this.values.set(key,value);}
 removeItem(key){this.values.delete(key);}
}
const now=1800000000000,user={id:'account-a',email:'storyteller@example.test'};
const guest={story:{name:'阿丽',language:'zh',occasion:'life',turns:[{role:'assistant',text:'你记得什么？'}],sources:[],draft:'我和妈妈一起做饭，还没有打完',photo:'data:image/jpeg;base64,fixture',photoCaption:'厨房里的旧照片',sample:false,approved:false},saved:null,stage:'tell',mode:'type'};
const earlier={...guest,story:{...guest.story,name:'Earlier story',draft:'An unrelated account draft'},saved:{id:'existing-cloud-story',revision:9}};
const newer={...guest,story:{...guest.story,draft:guest.story.draft+'，然后妈妈笑了。'}};
{
 const store=new Store();const quietTabSnapshot=guest,quietTabWritten=writeChangedDraft(store,GUEST_DRAFT_KEY,quietTabSnapshot,null);
 prepareGuestHandoff(store,user.email,guest,now,'two-tabs');
 writeChangedDraft(store,GUEST_DRAFT_KEY,newer,JSON.stringify(guest)); // Active tab continues typing.
 writeChangedDraft(store,GUEST_DRAFT_KEY,quietTabSnapshot,quietTabWritten); // Auth broadcast flushes the older tab.
 assert.deepEqual(resumeGuestHandoff(store,user,now+1).snapshot,newer,'A quiet older tab cannot overwrite newer guest text when auth broadcasts');
}
{
 const store=new Store();writeDraft(store,accountDraftKey(user.id),earlier);const original=store.getItem(accountDraftKey(user.id));
 prepareGuestHandoff(store,'  STORYTELLER@example.test  ',guest,now,'one');
 writeDraft(store,GUEST_DRAFT_KEY,newer); // More typing after requesting the email.
 const resumed=resumeGuestHandoff(store,user,now+5000);
 assert.equal(resumed.resumed,true);assert.equal(resumed.failed,false);assert.notEqual(resumed.key,accountDraftKey(user.id));
 assert.deepEqual(resumed.snapshot,newer,'Resume unsent text, photograph, name, language and position');
 assert.equal(store.getItem(accountDraftKey(user.id)),original,'An existing account draft and cloud id must remain untouched');
 assert.deepEqual(readDraft(store,GUEST_DRAFT_KEY),newer,'Keep the guest backup');
 const continued={...newer,story:{...newer.story,draft:'More words after signing in'}};
 writeDraft(store,resumed.key,continued,user.id);
 assert.deepEqual(resumeGuestHandoff(store,user,now+10000).snapshot,continued,'One-time handoff must not replay older guest words over account edits');
 assert.deepEqual(restoreAccountDraft(store,user.id),earlier,'Earlier draft is recoverable');
 assert.deepEqual(resumeGuestHandoff(store,user,now+12000).snapshot,earlier,'Restoring earlier draft must not trigger re-import');
}
{
 const store=new Store();writeDraft(store,accountDraftKey(user.id),earlier);prepareGuestHandoff(store,'another@example.test',guest,now,'two');
 const result=resumeGuestHandoff(store,user,now+1);assert.equal(result.resumed,false);assert.deepEqual(result.snapshot,earlier);
 assert.equal(JSON.parse(store.getItem(HANDOFF_KEY)).status,'pending','Wrong account cannot consume the handoff');
}
{
 const store=new Store();prepareGuestHandoff(store,user.email,guest,now,'three');
 assert.equal(resumeGuestHandoff(store,user,now+HANDOFF_TTL+1).resumed,false,'Expired handoff cannot import');
 assert.equal(resumeGuestHandoff(store,user,now-1).resumed,false,'A future-dated intent is not trusted');
 assert.deepEqual(readDraft(store,GUEST_DRAFT_KEY),guest,'Expiry does not discard the draft');
}
for(const failure of ['draft','pointer','consume']){
 const store=new Store(),id='crash-'+failure,key=accountDraftKey(user.id)+':handoff:'+id;
 writeDraft(store,accountDraftKey(user.id),earlier);prepareGuestHandoff(store,user.email,guest,now,id);
 store.failKey=failure==='draft'?key:failure==='pointer'?DRAFT_PREFIX+':active:'+user.id:HANDOFF_KEY;
 const interrupted=resumeGuestHandoff(store,user,now+1);
 assert.equal(interrupted.failed,true);assert.deepEqual(interrupted.snapshot,guest,'Keep an in-memory copy when persistence fails');
 assert.deepEqual(readDraft(store,GUEST_DRAFT_KEY),guest);assert.deepEqual(readDraft(store,accountDraftKey(user.id)),earlier);
 const retry=resumeGuestHandoff(store,user,now+2);assert.equal(retry.failed,false);assert.deepEqual(retry.snapshot,guest,'Retry completes without losing either draft');
}
{
 const store=new Store();prepareGuestHandoff(store,user.email,guest,now,'crash-edits');store.failKey=HANDOFF_KEY;
 const interrupted=resumeGuestHandoff(store,user,now+1);writeDraft(store,interrupted.key,newer,user.id);
 assert.deepEqual(resumeGuestHandoff(store,user,now+2).snapshot,newer,'Crash recovery preserves newer edits to the destination');
}
{
 const store=new Store();store.failKey=HANDOFF_KEY;assert.throws(()=>prepareGuestHandoff(store,user.email,guest,now,'failed-email'));
 assert.deepEqual(readDraft(store,GUEST_DRAFT_KEY),guest,'Failure to prepare sign-in still keeps the guest draft');
 const cancel=prepareGuestHandoff(store,user.email,guest,now,'cancelled');cancel();assert.equal(store.getItem(HANDOFF_KEY),null);assert.deepEqual(readDraft(store,GUEST_DRAFT_KEY),guest);
}
console.log('Passed: guest sign-in, unsent/newer text, photo/language, separate account draft, email binding, expiry, one-time resume, and storage/crash recovery.');

{
 const store=new Store(),tab=new Store(),otherTab=new Store();
 writeDraft(store,accountDraftKey(user.id),earlier);
 prepareGoogleHandoff(store,tab,guest,now,'google-one');
 assert.equal(resumeGuestHandoff(store,user,now+1,otherTab).resumed,false,'Another tab cannot claim a pending Google draft');
 const result=resumeGuestHandoff(store,user,now+1,tab);
 assert.equal(result.resumed,true);assert.deepEqual(result.snapshot,guest);
 assert.deepEqual(readDraft(store,accountDraftKey(user.id)),earlier,'Google sign-in preserves an earlier account draft');
 assert.equal(resumeGuestHandoff(store,{id:'other-account',email:'other@example.test'},now+2,tab).resumed,false,'A consumed OAuth draft is bound to one account');
 writeDraft(store,result.key,newer,user.id);
 assert.deepEqual(resumeGuestHandoff(store,user,now+3,tab).snapshot,newer,'OAuth resume cannot replay stale guest text');
}
{
 const store=new Store(),tab=new Store();
 const cancel=prepareGoogleHandoff(store,tab,guest,now,'google-cancel');cancel();
 assert.equal(store.getItem(HANDOFF_KEY),null);assert.equal(tab.getItem(GOOGLE_HANDOFF_KEY),null);
 assert.deepEqual(readDraft(store,GUEST_DRAFT_KEY),guest,'An OAuth failure keeps the guest backup');
 prepareGoogleHandoff(store,tab,guest,now,'google-expire');
 assert.equal(resumeGuestHandoff(store,user,now+GOOGLE_HANDOFF_TTL+1,tab).resumed,false,'An abandoned OAuth attempt expires');
}
console.log('Passed: Google draft handoff, tab binding, account binding, cancellation, expiry and preservation of earlier drafts.');
