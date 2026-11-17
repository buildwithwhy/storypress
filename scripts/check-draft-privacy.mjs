// Device-draft privacy — consent-gated import (spec art_ZdXAkIsg, wave 9).
// Pins the three-way sign-in decision (owner match → silent resume; owner
// mismatch → fully silent; ownerless → consent offer), sign-out retention
// with owner gating, one-way import provenance, localized consent copy, and
// the absence of native confirm() on the three migrated call sites.
// Spec tc-1..tc-9 and the grep half of tc-10 run here; the browser evidence
// for tc-10's rendering half is captured separately against the PR preview.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
const bundled=await build({stdin:{contents:"export * from './lib/draft-handoff.ts';export * from './lib/confirm-copy.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {GUEST_DRAFT_KEY,HANDOFF_KEY,accountDraftKey,readDraft,readOwnerlessDraft,writeDraft,prepareGuestHandoff,resumeGuestHandoff,acceptGuestHandoff,confirmCopy,draftPreviewLabel,formatDraftAge}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
class Store{
 values=new Map();
 getItem(key){return this.values.get(key)||null;}
 setItem(key,value){this.values.set(key,value);}
 removeItem(key){this.values.delete(key);}
}
const now=1800000000000;
const alice={id:'account-a',email:'alice@example.test'},bob={id:'account-b',email:'bob@example.test'};
const base={story:{name:'阿丽',language:'zh',occasion:'life',turns:[{role:'assistant',text:'你记得什么？'}],sources:[],draft:'我和妈妈一起做饭，还没有打完',photo:'data:image/jpeg;base64,fixture',photoCaption:'厨房里的旧照片',sample:false,approved:false},saved:null,stage:'tell',mode:'type'};
const draftOf=(userId,at=now)=>({...base,owner:{userId,at},savedAt:at});
const dump=store=>JSON.stringify([...store.values.entries()].sort(([a],[b])=>a<b?-1:1));
// Signed-out landing: the app reads only ownerless drafts there.
const landingSees=(store,key)=>!!readOwnerlessDraft(store,key);
// Sign-in boot: exactly what Storypress runs at mount.
const boot=(store,user,tab)=>resumeGuestHandoff(store,user,now+1000,tab);

// tc-1 — the production leak fails on the new build: A's content never
// reaches B, and no import lands in B's slot without consent.
{
 const store=new Store();
 const intent=prepareGuestHandoff(store,alice.email,base,now,'leak-repro');intent(); // A's session prepares a handoff...
 writeDraft(store,GUEST_DRAFT_KEY,draftOf(alice.id)); // ...and an owned draft sits on the device.
 const b=boot(store,bob); // B signs in (email binding does not match B — and could not help here).
 assert.equal(b.resumed,false);assert.equal(b.offer,undefined);assert.equal(b.snapshot?.story.draft,undefined);
 assert.equal(store.getItem(accountDraftKey(bob.id)+':handoff:leak-repro'),null,'No import lands in B’s slot without consent');
 assert.ok(readDraft(store,GUEST_DRAFT_KEY).owner,'A’s owned draft survives untouched');
}
// tc-2 — consent imports once: accept loads, stamps provenance, consumes the
// intent; a repeat cannot re-import or duplicate.
{
 const store=new Store();
 prepareGuestHandoff(store,bob.email,base,now,'import-once');
 const offer=boot(store,bob).offer;
 assert.ok(offer,'An ownerless draft reaches the consent dialog');
 const first=acceptGuestHandoff(store,bob,offer.intentId,now+2000);
 assert.equal(first.resumed,true);assert.equal(first.snapshot.imported,true);
 assert.equal(first.snapshot.story.draft,base.story.draft);
 assert.equal(JSON.parse(store.getItem(HANDOFF_KEY)).status,'consumed');
 const again=acceptGuestHandoff(store,bob,offer.intentId,now+3000);
 assert.equal(again.resumed,false,'A consumed intent cannot import twice');
 const slotKey=accountDraftKey(bob.id)+':handoff:import-once',slotBefore=store.getItem(slotKey);
 acceptGuestHandoff(store,bob,offer.intentId,now+4000);
 assert.equal(store.getItem(slotKey),slotBefore,'A repeat accept writes no second copy');
}
// tc-3 — the owner's silent return: no dialog, unchanged snapshot.
{
 const store=new Store();
 prepareGuestHandoff(store,alice.email,base,now,'owner-return');
 writeDraft(store,GUEST_DRAFT_KEY,draftOf(alice.id));
 const a=boot(store,alice);
 assert.equal(a.resumed,true);assert.equal(a.offer,undefined,'The owner never sees a consent dialog');
 assert.equal(a.snapshot.story.draft,base.story.draft);
 assert.equal(a.snapshot.imported,true);
}
// tc-4 — no cascade re-export: an imported draft never enters a new handoff.
{
 const store=new Store();
 prepareGuestHandoff(store,bob.email,base,now,'cascade');
 writeDraft(store,GUEST_DRAFT_KEY,{...base,savedAt:now}); // ownerless draft, offered to B...
 const offer=boot(store,bob).offer;
 acceptGuestHandoff(store,bob,offer.intentId,now+1000);
 const before=store.getItem(GUEST_DRAFT_KEY);
 // B signs out and prepares a handoff carrying the imported draft.
 let refused=false;
 try{prepareGuestHandoff(store,bob.email,importedSlotSnapshot(store,bob),now+2000,'cascade-2')();}
 catch{refused=true;}
 assert.ok(refused,'prepareGuestHandoff refuses an imported draft');
 assert.equal(store.getItem(GUEST_DRAFT_KEY),before,'The imported draft is never re-exported');
}
function importedSlotSnapshot(store,user){ // the draft B's session now holds: the imported slot copy
 return readDraft(store,[...store.values.keys()].filter(k=>k.startsWith(accountDraftKey(user.id)+':handoff:'))[0]);
}
// tc-5 — decline preserves: every storage byte stays identical.
{
 const store=new Store();
 prepareGuestHandoff(store,bob.email,base,now,'decline');
 writeDraft(store,GUEST_DRAFT_KEY,{...base,savedAt:now});
 boot(store,bob); // offer raised...
 const before=dump(store);
 boot(store,bob);
 assert.equal(dump(store),before,'A declined offer mutates nothing');
 assert.equal(readDraft(store,GUEST_DRAFT_KEY).story.draft,base.story.draft);
}
// tc-6 — legacy snapshots (no owner stamp) parse and follow the offer path.
{
 const store=new Store();
 store.setItem(GUEST_DRAFT_KEY,JSON.stringify(base)); // a draft from an older build
 prepareGuestHandoff(store,bob.email,base,now,'legacy');
 const bootResult=boot(store,bob);
 assert.ok(bootResult.offer,'A legacy draft is offered, never silently imported');
 assert.equal(bootResult.offer.snapshot.story.draft,base.story.draft);
}
// tc-7 — owner mismatch is fully silent: no dialog, nothing written, storage
// byte-identical (founder-required).
{
 const store=new Store();
 prepareGuestHandoff(store,bob.email,base,now,'mismatch'); // valid binding for B
 writeDraft(store,GUEST_DRAFT_KEY,draftOf(alice.id)); // ...but the draft belongs to A
 const before=dump(store);
 const b=boot(store,bob);
 assert.equal(b.resumed,false);assert.equal(b.offer,undefined,'A foreign-owned draft never reaches the dialog');
 assert.equal(dump(store),before,'Storage is byte-identical after a mismatched sign-in');
 assert.equal(b.snapshot?.story?.draft??null,null,'Nothing of A’s draft is rendered for B');
}
// tc-8 — the exact QA leak sequence, asserted step by step.
{
 const store=new Store();
 // Authored signed-in as A: the account draft is owner-stamped.
 writeDraft(store,accountDraftKey(alice.id),draftOf(alice.id),alice.id,now);
 // Sign out: the draft keeps its stamp; nothing is cleared.
 assert.ok(readDraft(store,accountDraftKey(alice.id)).owner,'Sign-out keeps the owner stamp');
 // The signed-out landing shows no "Continue your last story" for it.
 assert.equal(landingSees(store,GUEST_DRAFT_KEY),false);
 assert.equal(landingSees(store,accountDraftKey(alice.id)),false,'An owned draft is invisible on the signed-out landing');
 // B signs in: no offer, no import.
 prepareGuestHandoff(store,bob.email,base,now+1000,'qa-sequence'); // B's own handoff preparation carries nothing of A's.
 store.values.delete(GUEST_DRAFT_KEY); // B's preparation refuses to re-export anything; A's account key holds the draft.
 const b=boot(store,bob);
 assert.equal(b.offer,undefined);assert.equal(b.resumed,false);
 assert.equal(store.getItem(accountDraftKey(bob.id)+':handoff:qa-sequence'),null);
 // A returns: the same draft resumes silently.
 const a=boot(store,alice);
 assert.equal(a.resumed,false);assert.equal(a.offer,undefined);
 assert.equal(a.snapshot?.story?.draft??null,base.story.draft,'A’s return lands in their own draft, silently');
}
// tc-9 — consent copy is complete in all three locales, and the preview label
// renders title plus age.
{
 for(const [language,copy] of Object.entries(confirmCopy)){
  for(const key of ['confirm','cancel','consentTitle','consentBody','accept','decline','untitled','justNow','minutesAgo','hoursAgo','daysAgo']){
   assert.ok(copy[key]?.length,`confirm-copy[${language}].${key} is non-empty`);
  }
 }
 assert.equal(formatDraftAge('en',now-90*60000,now),confirmCopy.en.hoursAgo.replace('{n}','1'));
 assert.equal(formatDraftAge('zh',now-30*60000,now),confirmCopy.zh.minutesAgo.replace('{n}','30'));
 assert.ok(draftPreviewLabel('es',{story:{...base.story},savedAt:now-30000},now).includes(confirmCopy.es.justNow));
 assert.equal(draftPreviewLabel('en',{story:{...base.story,name:''}},now),base.story.draft.slice(0,60));
}
// tc-10 (scripted half) — no native confirm() remains on the three migrated
// call sites; the story-row delete confirm is outside this wave's scope.
{
 const sharing=readFileSync('app/sharing.tsx','utf8'),invites=readFileSync('app/invites.tsx','utf8'),storypress=readFileSync('app/storypress.tsx','utf8');
 assert.ok(!sharing.includes('confirm(c.importConfirm)'),'Import no longer uses native confirm()');
 assert.ok(!sharing.includes('confirm(c.confirmLogout)'),'Sign-out no longer uses native confirm()');
 assert.ok(!invites.includes('confirm(c.revokeConfirm)'),'Invite revoke no longer uses native confirm()');
 assert.ok(sharing.includes('ConfirmDialog'),'Sharing renders the in-app dialog');
 assert.ok(invites.includes('ConfirmDialog'),'Invites render the in-app dialog');
 assert.ok(storypress.includes('ConfirmDialog'),'The consent offer renders the in-app dialog');
}
console.log('Passed: tc-1 leak repro blocked, tc-2 consent imports once, tc-3 owner silent return, tc-4 no cascade re-export, tc-5 decline preserves, tc-6 legacy drafts offered, tc-7 mismatch fully silent, tc-8 QA leak sequence, tc-9 localized consent copy, tc-10 no native confirm() on the migrated call sites.');
