# Storypress: October 15 build

This replaces the earlier implementation defaults after interactive product discovery. The work is on `codex/independent-sharing-flow` (draft PR #2), not production main. Existing Supabase/Vercel hosting remains.

## Confirmed product direction

- One independent creation path, whether arriving organically or through a friend's shared work. Optional collaboration comes later.
- A patient interviewer: begin gently, adapt to how much the storyteller says, and allow time to remember.
- Live conversation is the primary voice experience, with recorded messages and typing sharing the story history.
- The first result is a beautiful editable keepsake draft. No mandatory plain-text approval screen before the reveal.
- A small format family: newspaper, mini booklet, letter/card. Letters may preserve a memory or directly address someone. Keep story content separate from presentation.
- Mobile reading links and readable social/message images; the reading page also offers download and print.
- Ask at the end whether the narrator wants to retain the full original recording. Sharing selected clips is a distinct action.
- Measure quality and actual cost before choosing a cost target or permanent provider. English, Mandarin and Spanish need separate evaluation.
- October 15 follow-up: build with Google first; compare the interviewing itself as well as speech, writing and cost. Detailed scenarios and separate scoring dimensions are in INTERVIEW-EVALUATION.md.
- Experience value before sign-in is the desired direction. A full first draft before sign-in is the recommendation; a shorter trial remains an acceptable fallback. Neither trial limit nor billing offer is finalized.

## Implemented in this branch

- Existing independent start, safe sample dialog and approved-snapshot sharing retained.
- Three localized layout selectors in optional setup, sample preview and draft editing. Setup controls do not overwrite an existing draft's intention or layout.
- Memory/message intention and optional addressee inform opening questions and editorial prompts.
- Versioned `presentation` and `intention` fields in the existing story JSON; legacy stories default to newspaper. No database migration for these fields.
- Shared renderer for the actual draft, downloaded document and public reading page. Layout changes preserve text exactly and invalidate publication approval.
- Booklet cover and story leaves, letter layout, responsive newspaper; printable styles for all three.
- PNG cards generated locally from approved content, including CJK wrapping and multiple cards for long stories. Download individual cards; native file sharing where supported. These are readable story cards, not screenshots of the selected print layout. Context/source sections remain in the full edition.
- The public reading page has save-copy and print/PDF controls. Downloaded HTML is self-contained and includes no acquisition CTA or private interview/audio.
- Historical discovery is independently cancellable background work. Appended answers and source selections survive results; corrected testimony, changed language or another story invalidates stale results. Public query review remains.
- Original recordings can be kept in IndexedDB on the current device, downloaded, or discarded. UI explicitly says device-only, not cloud backup. Retention IDs and audio never enter the approved snapshot.
- Opt-in Gemini Live prototype: short-lived single-use constrained credentials, tester allowlist, existing server quota reservation, PCM input/output, interruption playback cancellation, typed turns, transcript capture, hidden-tab microphone stop and temporary original microphone recording.
- Chat and Live share adaptive interview guidance and context preparation, including story focus, message intention, corrections, selected historical references and clearly separated unverified photo clues. Live context is a session-start snapshot; new research is not streamed into the active connection. Live cannot itself search or produce a draft.
- Live measurements download contains duration, time to first audio from connection start, and raw provider usage events, not story text. It is a prototype instrument, not verified dollar accounting or a completed benchmark.

- An unconfigured Vercel preview exposes only a sample-mode account capability; the format explorer remains usable while AI and storage endpoints still fail closed. The existing variables were subsequently enabled for both Production and Preview with owner approval. The exact preview URL is allowlisted for Supabase login; production code remains unchanged.

## Activation, verification and remaining work

See LIVE-VOICE-SETUP.md. Live voice is off unless configured and the signed-in account is allowlisted. The implementation is behind a pilot gate because no real paid provider/microphone call has been made. Provider and account boundaries have mocked tests. Token protocol, model access, billing, actual interruptions and multilingual quality still require a hosted microphone trial.

The existing account-before-AI boundary remains until we implement a durable anonymous trial with server-owned budgets and recovery. Do not advertise an anonymous full-draft trial yet. Existing quota checks are not bypassed.

Private recording cloud backup, selected published clips, transcription streaming, ElevenLabs comparison, per-task text-provider benchmarks, guest trials, multi-story books and collaboration remain subsequent slices. This build does not claim to deliver them.

## Validation

TypeScript, Worker build, Vercel build, keepsake/escaping/private-snapshot tests, recording lifecycle tests, account draft handoff, autosave, model routing, historical research, artwork and Vercel boundary checks. Provider calls are mocked. Browser QA uses an isolated local fixture with no credentials: mobile sample format switching, first draft, format changes and approval, PNG generation/download, Chinese shared reader, and reader-to-creator link. Real authentication and audio are not exercised by that fixture.

Hosted verification: Preview redeployed with the existing service settings; account setup loads and Gemini/Vertex and Nimble report configured. Google sign-in reaches a passkey verification that the owner must complete. Actual authenticated AI calls, saved-story access and Live audio still need a session test. Vercel protection remains on, so outside recipients cannot yet test preview sharing anonymously.
