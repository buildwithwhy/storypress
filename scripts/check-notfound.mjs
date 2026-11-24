// Not-found route: unknown paths serve the app shell with a real 404 status
// (worker/main.ts route map) and the client renders the branded, localized
// not-found page (lib/notfound-copy.ts, app/storypress.tsx notfound stage)
// with the site header and language picker — instead of the platform's
// unbranded English-only error. Source-level copy parity follows the
// check-invite-copy precedent; worker-level asserts run on the built bundle.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../dist/server/index.js';

// Copy parity: the exact strings exist in all three locales, so no language
// silently falls back to another's copy or an empty block.
const copy=readFileSync('lib/notfound-copy.ts','utf8');
const expect={
 en:["This page isn't in the paper",'Start a new story','Back to the front page'],
 zh:['这一页不在报纸里','开始新的故事','回到首页'],
 es:['Esta página no está en el periódico','Empezar una historia nueva','Volver a la portada'],
};
for(const [lang,strings] of Object.entries(expect)) for(const s of strings) assert(copy.includes(s),`not-found copy missing ${lang} string '${s}'`);
assert(copy.includes("en:")&&copy.includes("zh:")&&copy.includes("es:"),'not-found copy must ship en/zh/es');

// Client wiring: unknown paths boot into the notfound stage instead of the
// silent home fallback, and the view renders from the copy module.
const app=readFileSync('app/storypress.tsx','utf8');
assert(app.includes('isKnownAppPath(location.pathname)'),'the app must route unknown paths through isKnownAppPath');
assert(app.includes('"notfound"'),'the app must have a notfound stage');
assert(app.includes('stage === "notfound"'),'the app must render the notfound stage');
assert(app.includes('notFoundCopy[story.language]'),'the notfound view must read its copy from notFoundCopy');

// Worker: unknown paths answer 404 with the app shell HTML, known paths stay 200.
const url='https://story.test';
const unknown=await worker.fetch(new Request(`${url}/definitely-not-a-page`),{});
assert.equal(unknown.status,404,'unknown paths must answer with a real 404 status');
assert.ok((unknown.headers.get('Content-Type')||'').includes('text/html'),'the 404 body must be the HTML app shell, not a plain-text error');
assert.ok((unknown.headers.get('X-Robots-Tag')||'').includes('noindex'),'unknown paths must not be indexed');
const body=await unknown.text();
assert.ok(body.includes('/app.js'),'the 404 body must serve the app shell so the branded localized page can render');
assert.equal((await worker.fetch(new Request(`${url}/no/such/deep/path`),{})).status,404,'deep unknown paths 404 the same way');
assert.equal((await worker.fetch(new Request(`${url}/`),{})).status,200,'home must stay 200');
for(const path of ['/pricing','/terms','/privacy','/refunds']) assert.equal((await worker.fetch(new Request(url+path),{})).status,200,`${path} must stay 200`);
assert.equal((await worker.fetch(new Request(`${url}/app.js`),{})).status,200,'known assets must stay 200');

// HEAD stays bodyless, like every other route.
const head=await worker.fetch(new Request(`${url}/definitely-not-a-page`,{method:'HEAD'}),{});
assert.equal(head.status,404);
assert.equal((await head.text()),'','HEAD must not carry a body');

console.log('check-notfound: unknown routes serve the branded localized 404 (en/zh/es copy parity) with status 404; known routes and assets stay 200');
