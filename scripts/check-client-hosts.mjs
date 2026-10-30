// China groundwork: guard against new external font/CDN/analytics hosts in client code.
// The cheap wins already shipped (fonts inlined as data URIs, zero CDN/analytics deps);
// this check keeps them shipped. It scans client-reachable source (app/, lib/, public/,
// index.html) for http(s) URLs and fails on any host not on the allowlist below.
// Run: node scripts/check-client-hosts.mjs [--self-test]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Allowlist: every host the client legitimately references today.
// - generativelanguage.googleapis.com: Gemini Live websocket + provider seam (lib/providers.ts)
// - sdk.nimbleway.com: Nimble historical search (server-side lib/providers.ts)
// - www.nasa.gov: sample story fixture data (lib/story.ts)
// - w3.org: SVG/XML namespace identifiers, not network hosts
// - github.com, reactjs.org, aistudio.google.com, console.cloud.google.com: comments/docs only
const ALLOWED_HOSTS = new Set([
  'generativelanguage.googleapis.com',
  'sdk.nimbleway.com',
  'online.nimbleway.com', // dashboard help link in the setup dialog (app/storypress.tsx)
  'www.nasa.gov',
  'w3.org',
  'www.w3.org',
  'github.com',
  'reactjs.org',
  'aistudio.google.com',
  'console.cloud.google.com',
  'localhost',
]);

const SCAN_ROOTS = ['app', 'lib', 'public', 'index.html'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.html', '.json']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-public']);
const URL_RE = /https?:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}/g;

export async function findDisallowedHosts(root = process.cwd()) {
  const offenders = [];
  const walk = async dir => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(full);
      } else if (EXTENSIONS.has(path.extname(entry.name))) {
        const text = await fs.readFile(full, 'utf8');
        for (const match of text.matchAll(URL_RE)) {
          const host = new URL(match[0]).host;
          if (!ALLOWED_HOSTS.has(host)) offenders.push({ file: path.relative(root, full), host, url: match[0] });
        }
      }
    }
  };
  // Top-level SCAN_ROOTS entries may be files (index.html) or directories (app/, lib/, public/).
  for (const rel of SCAN_ROOTS) {
    const full = path.join(root, rel);
    let stat;
    try { stat = await fs.stat(full); } catch { continue; }
    if (stat.isDirectory()) await walk(full);
    else {
      const text = await fs.readFile(full, 'utf8');
      for (const match of text.matchAll(URL_RE)) {
        const host = new URL(match[0]).host;
        if (!ALLOWED_HOSTS.has(host)) offenders.push({ file: rel, host, url: match[0] });
      }
    }
  }
  return offenders;
}

// Self-test: prove the guard fails on a fixture that introduces a foreign host.
export async function selfTest() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'client-hosts-fixture-'));
  try {
    await fs.mkdir(path.join(dir, 'app'));
    await fs.writeFile(path.join(dir, 'app', 'fixture.tsx'), 'const p = "https://cdn.example-analytics.io/pixel.js";\n');
    const offenders = await findDisallowedHosts(dir);
    assert.ok(offenders.some(o => o.host === 'cdn.example-analytics.io'), 'fixture host must be flagged');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

// Suite entry: prove the guard fails on a foreign-host fixture, then check the real tree.
await selfTest();
const offenders = await findDisallowedHosts();
assert.deepEqual(offenders, [], `Unapproved external host(s) in client code:\n${offenders.map(o => `  ${o.file}: ${o.host}`).join('\n')}`);
console.log('check-client-hosts: ok (allowlist holds, self-test passed)');
