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

// Keepsake-first (spec item 3 goal): above the keepsake sit only the slim top
// row and the edition switcher. The format picker, artwork picker and story-art
// studio render after the keepsake (with the review bar) so the top of the
// keepsake is visible in a 375px first viewport. DOM order only — no CSS
// `order:` anywhere.
const firstBelow=Math.min(...['<FormatPicker','<ArtworkPicker','<StoryArt','review-bar'].map(s=>page.indexOf(s)).filter(i=>i>-1));
assert.ok(keepsake<firstBelow,'keepsake (or editor) must precede the format/art modules and review bar in the DOM');

// Slim top row (spec item 3): the toolbar is one compact row of icon-button
// circles — back / edit / print, each with a localized aria-label and title —
// and the intro (eyebrow + single-line h1) shares that row so nothing sits
// above the keepsake but one slim line. The h1 stays in the DOM for the
// document outline; the description paragraph only renders in the editor state.
const toolbarBlock=page.match(/<div className="paper-toolbar no-print">[\s\S]*?paper-toolbar-actions[\s\S]*?<\/div><\/div>/)?.[0];
assert.ok(toolbarBlock,'paper toolbar renders as the paper page\'s first block, with the intro inside it');


const iconButtons=[...toolbarBlock.matchAll(/<button className="icon-button"[\s\S]*?<\/button>/g)];
assert.equal(iconButtons.length,3,'back/edit/print are exactly three icon-button circles');
for(const icon of iconButtons){
  assert.ok(icon[0].includes('aria-label=')&&icon[0].includes('title='),
    'every toolbar icon button carries a localized aria-label and title');
}
assert.ok(!/className="(?:primary|secondary|text-button)"/.test(toolbarBlock),'no labeled text buttons remain in the paper toolbar');
const introBlock=page.match(/<div className="paper-intro">[\s\S]*?<h1>/)?.[0];
assert.ok(introBlock,'the intro h1 stays in the DOM (document outline) inside the toolbar row');
assert.ok(page.includes('{editing&&<p>{k.draftHelp}</p>}'),'the description paragraph renders only in the editor state');

console.log('Passed: paper stage order — slim icon toolbar and one-line intro above the keepsake, keepsake before format/art modules and share/collaborate actions at every viewport, no CSS order overrides.');
