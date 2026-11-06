// Wave 6 invite copy: every owner-facing invite string in en/zh/es uses
// neutral 'Invite collaborator' phrasing — no family/relative terms anywhere
// in the invite surfaces (share group, invite panel, suggested questions,
// server transcript-full error). Source-level assertion on the copy modules.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const groups=readFileSync('lib/share-groups-copy.ts','utf8');
const invite=readFileSync('lib/invite-copy.ts','utf8');
const server=readFileSync('server/invites.ts','utf8');

// Family/relative terms in the locales the copy ships in. Comment lines are
// stripped first so prose like "the invited relative" in a comment does not
// count against the strings.
const strip=s=>s.split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');
const banned=[
 // en
 'family','relative','aunt','uncle','grandmother','grandfather',
 // zh
 '家人','亲属','亲戚','阿姨','叔叔','奶奶','爷爷',
 // es
 'familia','familiar','tía','tío','abuela','abuelo',
];

for(const [name,text] of [['share-groups-copy.ts',strip(groups)],['invite-copy.ts',strip(invite)],['server/invites.ts',strip(server)]]) {
 for(const term of banned) assert(!text.includes(term),`${name} still contains '${term}' in the invite copy`);
}

// The neutral phrasing is actually present in all three locales, not just
// family terms deleted.
assert(groups.includes("inviteTitle:'Invite a collaborator to contribute'"));
assert(groups.includes("inviteTitle:'邀请协作者参与创作'"));
assert(groups.includes("inviteTitle:'Invita a un colaborador a participar'"));
assert(invite.includes("title:'Invite a collaborator'"));
assert(invite.includes("title:'邀请协作者'"));
assert(invite.includes("title:'Invitar a un colaborador'"));
console.log('check-invite-copy: all invite strings use neutral collaborator phrasing in en/zh/es');
