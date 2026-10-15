# Independent creation and sharing: build decisions

October 15, 2026. Recommended defaults for the first implementation; they do not replace the confirmed requirements in PRODUCT-BRIEF.md. No hosting migration, new paid service, or public deployment is included.

## The experience we are building

The first useful unit is one memory made into one keepsake. Someone should not need to plan a book, invite a relative, or pick a model to get there. Completing something privately is a valid success.

| Screen | Main action | Design and recovery behavior |
| --- | --- | --- |
| Discover / return | Start a memory | Show a real example, a 5–10 minute expectation, and three starts: a memory, a photo, or a suggested question. Show an existing draft prominently. Name and occasion are optional details. |
| Tell | Speak or type an answer | One conversational focus; allow mode changes, corrections and pauses. Preserve an unfinished answer through Google sign-in. Useful historical context belongs here, with its source and an easy dismissal. |
| Shape | Review my story | Offer a draft when there is enough substance, without a compulsory number of questions. Preserve first-person voice and uncertainty. Ask for missing facts; never manufacture them to fill a layout. |
| Keep | Finish the keepsake | Start with the existing newspaper; add a short memoir booklet next. Choose visual treatment after content exists. Reviewing text and approving an edition are distinct actions. |
| Share | Create a reading link | Private by default. Explain that anyone with the link can read and forward it. Publish an approved snapshot; later private edits do not silently alter it. Permit explicit update and link revocation. Keep download/print available. |
| Read | Enjoy the story | No login, editing controls or collaborator permissions. A restrained “Make your own story” opens the independent start screen, in the edition's language, without transferring its contents. Preserve any reader's existing draft. |

Sample viewing must never replace, save over, or become the user's story. A sample opens as a separate read-only preview. Returning to a draft and deliberately starting another story remain separate actions.

For the initial build, keep Google's existing authentication before the first paid AI operation. Let a visitor explore a sample, pick a starting question and write an answer beforehand. Explain that boundary before starting, rather than surprising them with a login after promising unrestricted guest AI. A genuinely anonymous AI trial needs a server-owned session, recovery and abuse budget; it is a later change, not a client-side bypass.

Public social posting is later. Today sharing means an unlisted reading link, the device's native share sheet when supported, copying a link, and existing printable/downloadable output. No recipient address is required. A shared link is not access restricted to named recipients. Turning it off cannot recall downloaded files or screenshots. Generic social metadata avoids deliberately adding story excerpts to link previews, but is not a confidentiality guarantee.

## Technical choices

| Area | Decision for this build | Reason / later boundary |
| --- | --- | --- |
| Hosting and app | Keep React, TypeScript, Vercel and existing build scripts | Production already works. No framework or hosting migration is necessary for this flow. |
| Identity and storage | Keep Supabase Google auth, owner-filtered storage and revision checks | Preserve OAuth draft handoff and conflict handling. Never expose the server secret to the browser. |
| Story representation | Keep the existing story JSON for this slice | Entry and sharing changes need no database migration. Transcript, editable draft and approved edition remain distinct concepts. |
| Publication | Keep the approved edition snapshot and revocable random token | A read-only token grants access to the edition only, never the interview or account. Public readers must query only the edition. |
| Formats | Add a versioned presentation field to an edition when implementing the booklet | Newspaper and booklet should render the same approved content. Use deliberate page layouts and print CSS, not one image of text. A single-story booklet precedes multi-story books. |
| Conversation | Add a streaming interview adapter next | Stream useful text early, retain cancellation and persist accepted turns. Track time to first response and completion separately. |
| Voice | Use a direct real-time voice provider behind a session adapter | First prototype the already-used Gemini ecosystem; compare ElevenLabs on actual English, Mandarin and Spanish recordings before committing. The browser receives short-lived session credentials, never provider secrets. A Vercel function should not proxy a long-lived audio connection. Verify each provider's session/auth API before implementation. |
| Text models | Keep the existing Gemini path for this UI slice; make task-specific adapters next | Compare interview and editorial writing independently. OpenRouter is an optional text transport; it need not carry real-time voice. Do not choose language routes on price alone or switch providers silently mid-conversation. |
| Research | Separate cancellable background work from conversation busy state in the next conversation slice | Track story identity, transcript revision and request ID. Merge results only into the originating story, ignore stale responses, and never overwrite a later answer. User approval is required before sending a public search query containing memory details. |
| Audio / media | Keep current behavior until private media storage is implemented | The latest temporary recording is not a durable clip library. Future selected clips require private originals, consent, timestamps, explicit publication derivatives and revocation-aware access. |
| Future collaboration | Add contributions and memberships later, enforced server-side | Do not prematurely give a share token editing rights or add collaboration tables to the independent flow. Keep authorship and publication authority distinct. |
| Cost and offers | Retain existing server allowance for now | Do not display “five free” before its unit and budget are agreed. Record task/model usage and cost before deciding a permanent offer. No paid benchmark is part of this slice. |

## Implementation order

1. **This slice:** independent entry, local question starters, optional setup details, safe sample preview, clearer approved-link sharing, native link sending, localized reader-to-creator action and language continuity. Preserve guest/account draft boundaries. No schema changes.
2. **Conversation:** streaming text, cancellable research, recoverable voice session prototype, mobile interruption and silence handling. Benchmark real conversations before choosing a new default voice provider. Define a capped test budget first.
3. **Keepsake:** one-story memoir booklet, photo placement, honest page-length choices, print/PDF quality; later selected original voice clips.
4. **Return and expansion:** collections and ordering stories into a book, then scoped collaborators and invitation handoff.

## Verification and acceptance

- Starting with a suggested question changes the actual opening question, in the chosen language.
- A sample can be opened and closed without changing the active draft, its approval, saved identity or unsent answer.
- The first AI login preserves the draft through existing OAuth handoff.
- Creating/updating a link still requires server-verified ownership, current revision and an approved edition. Disabling a link invalidates future requests.
- Shared HTML contains no private interview or unfinished answer; user text is escaped. Reader acquisition parameters contain only source and language, never a story token or copied memory.
- Downloads remain self-contained. The online reader's acquisition controls do not print and do not appear as broken root-relative links in an offline file.
- Check desktop and narrow-screen entry, sample dialog and reader page; run type/build checks and the existing sharing, saving, OAuth-handoff and Vercel contract checks with mocked providers.
- Production authentication, real provider latency, native mobile share-sheet behavior and hosted deployment require their own live checks; local tests do not establish them.

## First slice implemented locally

The independent start card, localized question starters, optional details, separate sample dialog, primary approved-link action, native link sending with copy fallback, publication explanation, generic social metadata and localized reader-to-creator link are implemented. Existing draft restoration takes precedence over an incoming language parameter so following a shared story cannot change another story's language or content.

Verification completed: TypeScript, both builds, sharing contracts (including EN/ZH/ES reader links), Vercel adapter contracts, draft/OAuth handoff and serialized story saving. Provider and database responses were mocked. Browser checks covered the desktop entry, 390px entry and reader, a starter opening the matching question, retaining an unsent answer through sample viewing, and the reader action returning to the creation screen. No paid provider requests or live database writes were made.

The first slice intentionally retains the current newspaper format, voice implementation and authentication policy. Live hosted sign-in, actual native share sheets, streaming text, real-time voice, booklet output and retained voice clips are not verified or implemented by these changes. The build regenerates `worker/index.js`; source is authoritative for Vercel's `build:vercel` command.
