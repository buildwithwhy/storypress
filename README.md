# Storypress

A web app built at AI Engineer MLH hackathon: tell a memory, discover a relevant piece of history, and create an editable personal newspaper. Built with React and a shared Web API backend for Cloudflare Workers and Vercel. Stories are private by default.

## Run

Install the pinned dependencies with `npm install`, then `npm run dev`. `npm run build` bundles the client and API into the supported Sites Worker ESM artifact. The first build used verified dependencies from the local npm cache because this session could not reach npm. `node node_modules/typescript/bin/tsc --noEmit` checks types.

## Connect providers

Hosted credentials belong in the server environment settings of Sites or Vercel. For local development use an ignored `.dev.vars` file; never commit it. Optional `GEMINI_MODEL` defaults to `gemini-3.8-flash` per the Google docs consulted October 11, 2026. Verify availability for your account.

To use Google Cloud trial billing, configure:

```env
GEMINI_BACKEND=vertex
GOOGLE_CLOUD_PROJECT=storyteller-511316
GOOGLE_CLOUD_LOCATION=global
VERTEX_API_KEY=
NIMBLE_API_KEY=
```

`VERTEX_API_KEY` must be a Google Cloud credential authorized for `aiplatform.googleapis.com` in the selected project. The AI Studio key is not automatically interchangeable. A project ID alone is not authentication. Cloud mode uses GenerateContent with JSON output and inline audio; it never falls back to AI Studio after a configuration, billing or permission error. Confirm trial eligibility and remaining balance in Cloud Billing; the application cannot certify which credit paid for a request.

The original AI Studio configuration remains available by setting `GEMINI_BACKEND=ai-studio` and the server secret `GEMINI_API_KEY`. That backend is the default if the selector is omitted. Google Cloud Welcome credits do not cover AI Studio Developer API usage.

The AI Studio backend uses the REST Interactions API (`store:false`); the Cloud backend uses the project-specific GenerateContent API. Both supply interview turns, transcription, search planning, contextual editing and newspaper drafting. Nimble uses its v2 Search API with current page content. Only source URLs actually returned by Nimble are accepted into candidate context. Retrieved text is treated as untrusted data.

Without keys, the app preserves typed words and reports that AI is unavailable; it does not simulate an interview. The clearly labeled fictional Alex sample includes a curated NASA source; it never claims to have run a live search. With Gemini but no Nimble, interviews and newspaper generation work and research shows its unavailable state.

## First version

- English, Chinese and Spanish input/UI; Gemini questions and drafts use the selected language. The home preview, sample newspaper and newspaper presentation are localized, including Chinese newspaper typography. Some interview and discovery explanations remain English.
- Three independent input choices share one story: typing (default), record-to-text (review then submit), and voice interview (record an answer, finish, then hear the next question automatically). Voice mode also offers review before each answer, pause/replay, and correction of the latest transcript. Browser speech synthesis reads questions in the selected language; Gemini transcribes and generates follow-ups. Playback support and voice quality depend on the device and language. Recordings are limited to two minutes per answer; the latest recording can be downloaded before recording another or refreshing. The microphone opens only on an explicit tap, and stops on finish, cancel, navigation, or hiding the page.
- Optional photograph assistance: Gemini reads a compressed photo only after an explicit choice, offers a grounded opening question, and separates observations from tentative clues. Clues are editable. Historical search is a separate action using reviewed text only. Photos are never sent to Nimble. Local draft persistence, original-text export and full-story JSON export.
- Candidate historical discoveries with citations, recognition feedback and explicit selection.
- Editable newspaper; narrator review enables browser Print / Save as PDF.
- Private Agent Skills packages in `skills/`, with canonical model instructions imported by `lib/editorial.ts` and source notes in `docs/EDITORIAL-SKILLS.md`. The application selects each step explicitly.

## Boundaries and next steps

Device drafts use browser localStorage; signed-in narrators can save private stories and compressed photos to Supabase for cross-device access. Recordings are temporary in memory. The newspaper can be exported; hosting remains owner-private until explicitly changed. No public contribution links, comic generation, or book production yet. Sentry is not integrated. Live Gemini and Nimble connection checks passed. Phone layouts and mode switching are checked in a browser viewport; actual iPhone/Android microphone, audio playback, permissions, and narrator experience still need testing. Editorial prompts are safeguards, not proof of fidelity: test with narrators and bilingual readers.

## Demo

Choose Explore a sample to open a clearly labeled fictional newspaper preview. Choose Try your own for a live interview. Once you have a memory, Make my newspaper is available beside the answer; you need not finish a question list. The interviewer is instructed to use previous answers and stop when asked. The sample's personal story is fictional; its source is NASA's retrospective account of Apollo 11.

## Verification in this session

Build and TypeScript checks passed. `node scripts/check-worker.mjs` covers authentication, origin checks, missing credentials, exact-quote protection, source-URL enforcement, Cloud routing, text/audio conversion and rejection of incomplete responses. These provider responses are mocked. Live Nimble search and Gemini 3.8 Flash through the project-specific Google Cloud endpoint both succeeded on October 11, 2026. A dedicated Cloud key is configured as a server secret, restricted to the Agent Platform API. Browser verification of the hosted app requires the owner's ChatGPT sign-in. The registered private Site ID remains in `.openai/hosting.json`; reuse it, do not create another.

## Source control

Keep project code, editorial prompts, public-source references and fictional demo content in the private source repository. API keys, local environment files, recordings, photographs and exported personal stories are not project source and must not be committed. Future approved code updates should also be pushed to the connected GitHub repository once it is available; the Site source and deployment remain managed by the Sites workflow.

The supplied `Storypress-preview.html` is an older standalone visual prototype, not the current application or an AI test. Full AI features require running the app server and configuring the keys.

`node scripts/check-voice.mjs` checks recording cleanup, cancellation during permissions/transcription, empty audio, microphone denial, language selection and interrupted speech with mocked browser devices. These checks do not establish physical-device compatibility.

## Supabase accounts and sharing

Supabase Auth and Postgres are active for the private pilot. The migration and live account/isolation/quota checks passed. Follow [the setup guide](docs/SUPABASE-SETUP.md) when deploying elsewhere; do not rerun the initial migration on this project. Accounts use an emailed sign-in link; stories are saved privately with owner checks and revision conflict protection. An approved edition can have a revocable, unlisted link once the frontend is opened and sharing enabled. Shared snapshots exclude interview notes and unfinished text. Downloads and supported native file sharing work without a Supabase account; downloaded HTML includes print/PDF controls.

Durable AI request allowances activate with Supabase; no payment collection is enabled. Run `node scripts/check-sharing.mjs` for mocked identity, ownership, sharing, escaping and quota-refusal checks. Live Supabase/RLS, two-account isolation, saved-story, revocation and quota checks passed against the configured project. Public sign-up still needs custom SMTP.

## Vercel deployment

Import this private repository into Vercel with framework **Other**. `vercel.json` supplies the build/output settings and API routes; use Node 22 with Fluid Compute. Follow [the Vercel guide](docs/VERCEL-SETUP.md) for server keys, Supabase redirects, email and public story links. `npm run build:vercel && npm run check:vercel` verifies the adapter locally. A live Vercel deployment has not yet been tested. The existing Sites publication stays private.

## Latest verification

Real Gemini multi-turn interviewing followed a fictional pancake-making memory across answers, stopped on an explicit finish request and generated a newspaper. A real public sample photo produced visible food details and an appropriate opening question. `node scripts/check-photo.mjs` verifies consent, image validation, exact approved search wording and exclusion of visual guesses from biography/research. Chrome's automated file upload was blocked by its extension setting; actual end-user photo selection still needs a manual check.
