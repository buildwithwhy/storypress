import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export * from './lib/story';export * from './lib/edition';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',loader:{'.txt':'text','.jpg':'dataurl'}});
const {storySchema,turnSchema,turnAuthorSchema,initialStory,editionSnapshot}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const paper={headline:'Grandma’s kitchen',standfirst:'A place for all of us.',paragraphs:['Grandma made dumplings.'],quote:''};
const base={...initialStory,name:'Lin',paper,turns:[{role:'user',text:'Grandma made dumplings every Sunday.'}]};

// Legacy payloads: stories saved before this migration still parse byte-identically.
const legacy=storySchema.parse(structuredClone(base));
assert.deepEqual(legacy,structuredClone(base));
assert.equal(legacy.turns[0].author,undefined);
assert.deepEqual(storySchema.parse(structuredClone(initialStory)),initialStory,'Legacy initial story round-trips');

// Turn authorship: label required, optional sign-in link, bounded.
const authored=structuredClone(base);
authored.turns[0].author={label:'Mei (aunt)'};
assert.deepEqual(storySchema.parse(authored).turns[0].author,{label:'Mei (aunt)'});
const linked=structuredClone(authored);
linked.turns[0].author={label:'Mei (aunt)',userId:'c60a25ef-f588-4df5-a89f-dcb1ea1a6470'};
assert.equal(storySchema.parse(linked).turns[0].author.userId,'c60a25ef-f588-4df5-a89f-dcb1ea1a6470');
for(const bad of [{label:''},{label:'x'.repeat(81)},{label:'Mei',userId:'not-a-uuid'},{label:5},null,{}]){assert.throws(()=>turnAuthorSchema.parse(bad),`turnAuthorSchema must reject ${JSON.stringify(bad)}`);}
assert.throws(()=>turnSchema.parse({role:'user',text:'hi',author:{label:'Mei',userId:'not-a-uuid'}}));

// Transcript translations: keyed by the three product languages, validated as turns.
const transcripted=structuredClone(base);
transcripted.transcriptTranslations={zh:[{role:'user',text:'外婆每个周日都包饺子。'}]};
assert.deepEqual(storySchema.parse(transcripted).transcriptTranslations.zh,[{role:'user',text:'外婆每个周日都包饺子。'}]);
assert.throws(()=>storySchema.parse({...structuredClone(base),transcriptTranslations:{fr:[]}}),'Unknown languages are rejected');
assert.throws(()=>storySchema.parse({...structuredClone(base),transcriptTranslations:{zh:[{role:'user',text:'x'.repeat(12001)}]}}),'Turn limits still apply to translations');

// Edition map for multilingual share bundles: approved snapshots keyed by language, never nested.
const approved={...structuredClone(base),approved:true};
const bundledStory=storySchema.parse({...base,editions:{en:approved,zh:approved},defaultLanguage:'en'});
assert.deepEqual(bundledStory.editions.en,approved);assert.equal(bundledStory.defaultLanguage,'en');
// Bundles never nest and unknown edition keys never persist: Zod strips them.
const nested=storySchema.parse({...base,editions:{en:{...approved,editions:{zh:approved}}}});
assert.equal(nested.editions.en.editions,undefined,'Edition values cannot carry their own editions');
assert.deepEqual(storySchema.parse({...base,editions:{de:approved}}).editions,{},'Edition keys stay in en/zh/es');
assert.throws(()=>storySchema.parse({...base,defaultLanguage:'fr'}),'defaultLanguage stays in en/zh/es');
// Legacy share snapshots (single edition) remain valid, edition-map-free payloads.
const legacySnapshot=storySchema.parse(editionSnapshot(approved));
assert.equal(legacySnapshot.editions,undefined,'Legacy snapshots carry no editions map');

// The migration is additive and follows the storage discipline of the first migration.
const migration=readFileSync('supabase/migrations/202610300001_contributions.sql','utf8');
const prior=readFileSync('supabase/migrations/202610110001_storypress.sql','utf8');
for(const [table,columns] of [
 ['storypress_invites',['story_id','token','question','status','created_by','expires_at','created_at']],
 ['storypress_contributions',['story_id','invite_id','author_label','contributor_user_id','turns','status','created_at','reviewed_at']]]){
 assert.ok(new RegExp(`create table public\\.${table} \\(`).test(migration),`${table} is created`);
 for(const column of columns)assert.ok(new RegExp(`\\n ${column} `).test(migration),`${table}.${column} exists`);
}
assert.ok(/token text not null unique check \(token ~ '\^\[a-f0-9\]\{64\}\$'\)/.test(migration),'Invite tokens are 64-hex capabilities');
assert.ok(/status in \('open','revoked','expired'\)/.test(migration),'Invite lifecycle is open/revoked/expired');
assert.ok(/status in \('pending','approved','declined'\)/.test(migration),'Contribution lifecycle is pending/approved/declined');
assert.ok(/octet_length\(turns::text\) <= 50000/.test(migration),'Contribution turns are size-capped like the story blob');
assert.ok(/default now\(\) \+ interval '30 days'/.test(migration),'Invites default to a 30-day expiry');
assert.ok(/references public\.storypress_stories\(id\) on delete cascade/.test(migration),'Contributions cascade with their story');
assert.ok(/author_label text not null/.test(migration),'Attribution is required, not optional');
assert.equal(/drop |alter table public\.storypress_stories/.test(migration),false,'Nothing existing is dropped or retyped');
for(const table of ['storypress_invites','storypress_contributions']){
 const section=migration.slice(migration.indexOf(`create table public.${table}`));
 assert.ok(/enable row level security/.test(section),`${table} has RLS enabled`);
 assert.ok(!new RegExp(`grant [^\\n]* on public\\.${table} to (public|anon|authenticated)`).test(section),`${table} grants nothing to guests — the trusted server owns every path`);
}
for(const existing of ['storypress_stories','storypress_ai_usage'])assert.ok(prior.includes(existing)&&[...migration.matchAll(new RegExp(existing,'g'))].every(m=>/references/.test(migration.slice(Math.max(0,m.index-40),m.index))),'Existing tables are only referenced as foreign keys');
console.log('Passed: contributions schema round-trip, legacy-payload compatibility, turn-author validation, transcript translations, edition maps, and additive SQL discipline.');
