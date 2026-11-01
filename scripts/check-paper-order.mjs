// Paper stage order (fix for PR #9's mobile reversal): on phones the keepsake
// must come before share/collaborate actions — same as desktop. That means no
// CSS `order:` reordering of .keepsake-share-actions or .paper-toolbar anywhere
// (the ≤800px media query used to hoist them), and the keepsake element must
// precede the share actions in the DOM, which every viewport then inherits.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync('app/globals.css','utf8');

// No CSS reordering of the keepsake page's blocks — at any viewport.
for(const selector of ['.keepsake-share-actions','.paper-toolbar']){
  assert.ok(!new RegExp(String.raw`[^{}]*${selector}\s*\{[^}]*\border\s*:`).test(css),
    `${selector} must not be reordered with CSS \`order:\` — DOM order leads with the keepsake`);
}

// The ≤800px media query keeps the mobile action bar and workspace padding,
// but touches nothing on the paper page's order.
const media=[...css.matchAll(/@media\(max-width:800px\)\{([\s\S]*?)\n\}/g)].map(m=>m[1]);
const paperMedia=media.find(block=>block.includes('keepsake-share-actions')||block.includes('paper-page'));
assert.ok(paperMedia,'mobile paper-stage media query still exists');
assert.ok(media.some(block=>block.includes('.mobile-action-bar'))&&media.some(block=>block.includes('.workspace{padding-bottom')),
  'mobile action bar and workspace padding survive the fix');
assert.ok(!/\border\s*:/.test(paperMedia),'no CSS order overrides at ≤800px');

// DOM: inside the paper page, the keepsake view renders before the share/collaborate actions.
const tsx=readFileSync('app/storypress.tsx','utf8');
const page=tsx.match(/className="paper-page"[\s\S]*/)?.[0];
assert.ok(page,'paper page JSX exists');
const keepsake=page.indexOf('<KeepsakeView'),share=page.indexOf('keepsake-share-actions');
assert.ok(keepsake>-1&&share>-1,'keepsake view and share actions both render on the paper page');
assert.ok(keepsake<share,'keepsake must precede share actions in the DOM');

console.log('Passed: paper stage order — keepsake before share/collaborate actions at every viewport, no CSS order overrides, mobile action bar intact.');
