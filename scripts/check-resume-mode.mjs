// Resume input mode: a resumed snapshot owns the mode it was saved with —
// live voice being enabled must not clobber it — and the typed editor must be
// visible (and therefore focusable) when a typed session resumes.
// Run: node scripts/check-resume-mode.mjs
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export * from './lib/story-modes.ts'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {bootInputMode,editorVisible}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));

// The reported bug: live voice on, snapshot saved in type mode — resume must
// stay in type, not jump to Talk live.
assert.equal(bootInputMode('type',true),'type','Resuming a typed snapshot with live voice on stays in type mode');
assert.equal(bootInputMode('dictate',true),'dictate','Resuming a dictate snapshot keeps dictate');
assert.equal(bootInputMode('voice',true),'voice','Resuming a voice snapshot keeps voice');

// Fresh sessions keep the existing voice-first default (and type without it).
assert.equal(bootInputMode(null,true),'voice','A fresh session with live voice still defaults to voice');
assert.equal(bootInputMode(null,false),'type','A fresh session without live voice types');

// A snapshot without a saved mode resumes as typing, never voice.
assert.equal(bootInputMode('type',false),'type','No live voice never overrides a restored mode');

// Editor visibility — the shared render/focus predicate. Focus may only land
// on the editor when it is actually on screen.
assert.equal(editorVisible('type',false,false,false,false),true,'Resumed typed session shows the editor');
assert.equal(editorVisible('voice',false,false,false,false),false,'Voice mode with no text hides the editor');
assert.equal(editorVisible('voice',false,false,true,false),true,'Voice mode with typed text keeps the editor');
assert.equal(editorVisible('voice',true,false,false,false),true,'Show-text reveals the editor in voice mode');
assert.equal(editorVisible('type',false,true,false,false),true,'Review mode reveals the editor');
assert.equal(editorVisible('type',false,false,false,true),false,'Correction mode hides the editor');

console.log('Passed: resume honors the snapshot input mode, fresh sessions keep the voice-first default, and editor visibility matches the focus eligibility.');
