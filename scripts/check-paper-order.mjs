// Paper stage order: the keepsake leads the paper page at every viewport.
// Above it sit only the slim toolbar, the edition switcher, and ONE compact
// action row (wave 4: format icons + Illustrate + Translate); the editor form
// replaces the keepsake while editing (one slot, mutually exclusive); below
// it the art/translation panels and share/collaborate actions. That
// means no CSS `order:` reordering of .keepsake-share-actions or .paper-toolbar
// anywhere (the ≤800px media query used to hoist them), and the keepsake
// element must precede those blocks in the DOM, which every viewport inherits.
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

// One compact action row (wave 4 change 2): above the keepsake sit only the
// slim toolbar, the edition switcher, and ONE compact row holding the compact
// format picker plus the Illustrate and Translate entries. The keepsake still
// precedes the art/translation panels and the share actions.
// DOM order only — no CSS `order:` anywhere.
const row=page.indexOf('keepsake-actions');
assert.ok(row>-1&&row<keepsake,'one compact action row (formats + Illustrate + Translate) sits above the keepsake');
const rowBlock=page.slice(row,keepsake);
assert.ok(page.includes('<FormatPicker story={story} compact'),'the paper page renders the compact format-picker variant');
assert.ok(rowBlock.includes('<FormatPicker story={story} compact')&&rowBlock.includes('className="secondary art-entry no-print"')&&rowBlock.includes('className="secondary translation-entry no-print"'),'the compact row holds the format icons and the Illustrate and Translate entries');
assert.ok(rowBlock.includes('disabled={interactionBusy||editing}'),'the row keeps the busy/editing disabled semantics');
assert.ok(page.indexOf('<FormatPicker',keepsake)===-1,'no format picker renders below the keepsake');
const above=page.slice(0,keepsake);
assert.ok(above.includes('paper-toolbar')&&above.includes('edition-switcher'),'the toolbar and edition switcher keep their lines above the keepsake');
for(const below of ['modal-backdrop','<ArtStudio','<TranslationStudio','keepsake-share-actions']){
  assert.ok(!above.includes(below),`${below} must render below the keepsake`);
}
assert.ok(keepsake<page.indexOf('keepsake-share-actions'),'keepsake precedes the share actions');

// Implicit approval (wave 4 change 3): the review bar and its approval
// checkbox are gone; the editor form replaces the keepsake while editing and
// the compare link lives inside it, below the quote field.
assert.ok(!page.includes('review-bar')&&!page.includes('c.review'),'the review bar and its approval checkbox are gone (approval is implicit)');
assert.ok(page.includes('{editing ? <section className="editor-form no-print">')&&page.includes(': <KeepsakeView story={story}/>'),'the editor form and the keepsake share one slot (editing replaces the view)');
const keepsakeSlot=page.indexOf(': <KeepsakeView story={story}/>'),compare=page.indexOf('d.compare');
assert.ok(compare>page.indexOf('d.quote')&&compare<keepsakeSlot,'the compare link renders inside the editor form, below the quote field');
assert.ok(keepsake<page.indexOf('art-backdrop')&&keepsake<page.indexOf('translation-backdrop'),'keepsake precedes the art and translation panels');

// Wave 6 share column: the share group stacks its three actions in one
// full-width column and carries no standing help paragraphs (the removed
// share-group-help/invite-group-help blocks and their aria-describedby ids).
const sharingTsx=readFileSync('app/sharing.tsx','utf8');
assert.ok(sharingTsx.includes('sharing-actions--stack'),'the share group stacks its actions in one column');
assert.ok(!page.includes('share-group-help')&&!page.includes('invite-group-help'),'the share and invite groups render no standing help paragraph');

// Pull-up illustration panel (wave 3 fix 2): the paper page renders a labeled
// entry button and the ArtStudio content inside a modal panel that renders
// after the keepsake/editor slot and before share/collaborate actions, closed
// by default, print-hidden, and never reordered with CSS.
const artStudio=page.indexOf('<ArtStudio');
assert.ok(artStudio>-1,'the compact art module renders on the paper page');
assert.ok(artStudio>keepsakeSlot,'the art module follows the keepsake slot');
assert.ok(artStudio<page.indexOf('keepsake-share-actions'),'the art module must precede share actions in the DOM');
assert.ok(page.includes('className="secondary art-entry no-print"'),'the art panel opens from a labeled, print-hidden entry button');
assert.ok(/const \[artOpen,setArtOpen\]=useState\(false\)/.test(tsx),'the art panel is closed by default (open state owned by the paper page)');
const studioTsx=readFileSync('app/art-studio.tsx','utf8');
assert.ok(!/useState\(/.test(studioTsx),'the art studio is content-only (open state lives on the page)');
const artCss=readFileSync('app/story-art.css','utf8');
const panelCss=readFileSync('app/keepsake-studio.css','utf8');
assert.ok(/@media print\{\.art-panel,\.story-art\{display:none\}\}/.test(artCss),'the art module is print-hidden alongside the studio');
assert.ok(/\.art-panel \.story-art-result img\{max-height:200px\}/.test(artCss),'the module result is a thumbnail (200px cap) at every viewport');
assert.ok(!new RegExp(String.raw`[^{}]*\.art-panel\s*\{[^}]*\border\s*:`).test(artCss),'the art module is never reordered with CSS `order:`');
assert.ok(!new RegExp(String.raw`[^{}]*\.art-entry\s*\{[^}]*\border\s*:`).test(panelCss),'the art module is never reordered with CSS `order:`');
assert.ok(/\.art-entry\s*\{[^}]*max-width:900px/.test(panelCss),'the art module keeps the paper page\'s module width');

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

console.log('Passed: paper stage order — slim icon toolbar, edition switcher, and one compact action row above the keepsake; review bar gone (implicit approval) with the compare link inside the editor form; keepsake before the art/translation panels and share/collaborate actions at every viewport; art studio content-only; panel closed by default and print-hidden; no CSS order overrides.');
