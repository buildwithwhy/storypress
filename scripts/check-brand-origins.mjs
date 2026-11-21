#!/usr/bin/env node
// Brand-origin checker for the Once & Ours rebrand sweep.
//
// Asserts four invariants:
//   (a) every remaining case-sensitive 'Storypress' hit sits in the documented
//       internal allowlist below (internal names, the server User-Agent,
//       React component names, check scripts, Supabase-project and Stripe
//       catalog references);
//   (b) zero 'buildwithwhy.com' and zero 'storypress-app.vercel.app' outside
//       docs/ and the two known test fixtures;
//   (c) zero og:url meta tags and zero rel="canonical" link tags anywhere in
//       the repo (sharing editions must be request-origin-relative, never a
//       hardcoded brand domain);
//   (d) 'ours.hopperlace.ai' is present in the four setup docs that name the
//       canonical production origin.
//
// Excluded from all scans: node_modules/, dist/, the generated worker bundle
// (worker/index.js mirrors the app/, lib/ and server/ sources), and this
// script itself (it is the source of the allowlist strings).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.git']);
const EXCLUDED_FILES = new Set(['worker/index.js', 'scripts/check-brand-origins.mjs']);

// Documented internal allowlist for remaining case-sensitive 'Storypress' hits.
// Each entry must state why the reference is internal and stays.
const STORYPRESS_ALLOWLIST = [
  // React component names and their imports — internal identifiers, not copy.
  { file: 'app/client.tsx', reason: 'React component name/import' },
  { file: 'app/storypress.tsx', reason: 'React component name' },
  { file: 'app/mobile-action-bar.tsx', reason: 'code comment referencing the component' },
  { file: 'app/sharing.tsx', reason: 'code comment' },
  // The User-Agent header the server sends to Supabase (server/storage.ts:46).
  { file: 'server/storage.ts', reason: "User-Agent 'Storypress-Server/1.0' header" },
  // Check scripts: fixtures and assertions, not user-facing copy.
  { file: 'scripts/check-reader.mjs', reason: 'check-script fixture' },
  { file: 'scripts/check-sharing.mjs', reason: "check-script asserting the 'Storypress-Server/1.0' User-Agent" },
  { file: 'scripts/check-draft-privacy.mjs', reason: 'check-script comment' },
  // Repo-internal editorial skill packages (bundled instructions, not product copy).
  { file: 'skills/interview-memories/SKILL.md', reason: 'repo-internal editorial instructions' },
  { file: 'skills/interview-memories/references/interviewer.txt', reason: 'repo-internal editorial instructions (interviewer persona)' },
  { file: 'skills/interview-memories/references/practice-notes.md', reason: 'repo-internal editorial reference notes' },
  { file: 'skills/research-story-context/references/source-judgment.md', reason: 'repo-internal editorial reference notes' },
  { file: 'skills/review-and-share-edition/SKILL.md', reason: 'repo-internal editorial instructions' },
  { file: 'skills/review-and-share-edition/references/edition-boundaries.md', reason: 'repo-internal editorial reference notes' },
  // Internal design/history docs kept for provenance.
  { file: 'docs/BUILD-DECISIONS.md', reason: 'internal build-history doc' },
  { file: 'docs/DEVELOPMENT.md', reason: 'internal development doc' },
  { file: 'docs/EDITORIAL-SKILLS.md', reason: 'internal editorial doc' },
  { file: 'docs/PRODUCT-BRIEF.md', reason: 'internal product-history doc' },
  // The Supabase project is literally named Storypress; these references stay.
  { file: 'docs/SUPABASE-SETUP.md', reason: 'Supabase-project references (project named Storypress)' },
  { file: 'docs/EMAIL-SIGN-IN.md', reason: 'Supabase-project references (dashboard and configured email subject)' },
  // Stripe catalog product names as created in the Stripe dashboard.
  { file: 'docs/STRIPE-SETUP.md', reason: 'Stripe catalog product names (dashboard-configured)' },
];

// Where old-domain mentions are still legitimate: user-facing docs, plus the
// two check-script fixtures that assert against them.
const DOMAIN_ALLOWED = (rel) =>
  rel.startsWith('docs/') ||
  rel === 'scripts/check-social-share.mjs' || // fixture: share-link credit host
  rel === 'scripts/check-dev-server-loopback.mjs'; // fixture: loopback host allowlist

const OLD_DOMAIN_RE = /buildwithwhy\.com|storypress-app\.vercel\.app/;
const OG_URL_RE = /(?:property|name)\s*=\s*["']og:url["']/i;
const CANONICAL_LINK_RE = /rel\s*=\s*["']canonical["']/i;

const CANONICAL_ORIGIN_DOCS = [
  'docs/STRIPE-SETUP.md',
  'docs/VERCEL-SETUP.md',
  'docs/SUPABASE-SETUP.md',
  'docs/LIVE-VOICE-SETUP.md',
];

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(repoRoot, full).split(sep).join('/');
    if (statSync(full).isDirectory()) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      walk(full, acc);
    } else if (!EXCLUDED_FILES.has(rel)) {
      acc.push(rel);
    }
  }
  return acc;
}

const failures = [];
const files = walk(repoRoot);
const storypressAllow = new Map(STORYPRESS_ALLOWLIST.map((a) => [a.file, a.reason]));
const storypressHitsByFile = new Map();

for (const rel of files) {
  const text = readFileSync(join(repoRoot, rel), 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    if (line.includes('Storypress')) {
      if (!storypressHitsByFile.has(rel)) storypressHitsByFile.set(rel, []);
      storypressHitsByFile.get(rel).push(i + 1);
    }
    if (OLD_DOMAIN_RE.test(line) && !DOMAIN_ALLOWED(rel)) {
      failures.push(`(b) old domain in ${rel}:${i + 1} — old domains may appear only in docs/ and the two known fixtures`);
    }
    if (OG_URL_RE.test(line) || CANONICAL_LINK_RE.test(line)) {
      failures.push(`(c) og:url/canonical-link tag in ${rel}:${i + 1}`);
    }
  });
}

for (const [rel, lines] of storypressHitsByFile) {
  if (!storypressAllow.has(rel)) {
    failures.push(`(a) 'Storypress' in ${rel}:${lines.join(',')} — not in the allowlist`);
  }
}
for (const [file, reason] of storypressAllow) {
  if (!storypressHitsByFile.has(file)) {
    console.log(`note: allowlisted file no longer contains 'Storypress': ${file} (${reason})`);
  }
}

for (const rel of CANONICAL_ORIGIN_DOCS) {
  const text = readFileSync(join(repoRoot, rel), 'utf8');
  if (!text.includes('ours.hopperlace.ai')) {
    failures.push(`(d) 'ours.hopperlace.ai' missing from ${rel}`);
  }
}

const storypressCount = [...storypressHitsByFile.values()].reduce((n, l) => n + l.length, 0);
console.log(`brand-origin check: scanned ${files.length} files`);
console.log(`  'Storypress' hits: ${storypressCount} across ${storypressHitsByFile.size} allowlisted files`);
console.log(`  old-domain hits outside docs/fixtures: ${failures.filter((f) => f.startsWith('(b)')).length}`);
console.log(`  og:url/canonical tags: ${failures.filter((f) => f.startsWith('(c)')).length}`);

if (failures.length > 0) {
  console.error(`\nFAIL (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('brand-origin check: OK');
