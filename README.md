# Storypress

A web app built at AI Engineer MLH hackathon: tell a memory, discover a relevant piece of history, and create an editable personal newspaper. Built with React and a self-contained Cloudflare Worker. Private by default.

## Run

Install the pinned dependencies with `npm install`, then `npm run dev`. `npm run build` bundles the client and API into the supported Sites Worker ESM artifact. The first build used verified dependencies from the local npm cache because this session could not reach npm. `node node_modules/typescript/bin/tsc --noEmit` checks types.

## Connect providers

Hosted credentials belong in Sites environment settings. For local development use an ignored `.dev.vars` file; never commit it. Optional `GEMINI_MODEL` defaults to `gemini-3.8-flash` per the Google docs consulted October 11, 2026. Verify availability for your account.

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

Without keys, guided writing preserves the person's exact input. The clearly labeled fictional Alex sample includes a curated NASA source; it never claims to have run a live search. With Gemini but no Nimble, interviews and newspaper generation work and research shows its unavailable state.

## First version

- English, Chinese and Spanish input/UI; Gemini questions and drafts use the selected language. The home preview, sample newspaper and newspaper presentation are localized, including Chinese newspaper typography. Some interview and discovery explanations remain English.
- Voice recording in browsers with MediaRecorder; review transcript before submitting. Original recording can be downloaded before refreshing. Two-minute recording limit.
- Photograph upload, local draft persistence, original-text export and full-story JSON export.
- Candidate historical discoveries with citations, recognition feedback and explicit selection.
- Editable newspaper; narrator review enables browser Print / Save as PDF.
- Four runtime editorial Skills in `lib/editorial.ts`, with source notes in `docs/EDITORIAL-SKILLS.md`.

## Boundaries and next steps

Drafts and photographs currently live in browser localStorage, not cross-device storage. Recordings are temporary in memory. Photos are added to the newspaper but are not analyzed by the model. The newspaper can be exported; hosting remains owner-private until explicitly changed. No public contribution links, cloud archive, comic generation, or book production yet. Sentry is not integrated. Live Gemini and Nimble connection checks passed; the complete narrator and voice flow still needs testing. Editorial prompts are safeguards, not proof of fidelity: test with narrators and bilingual readers.

## Demo

Choose Explore a sample. Save another memory, find the curated historical connection, mark recognition, include it, return to the interview or make the newspaper. Edit, compare original words, approve and print. The sample's personal story is fictional; its source is NASA's retrospective account of Apollo 11.

## Verification in this session

Build and TypeScript checks passed. `node scripts/check-worker.mjs` covers authentication, origin checks, missing credentials, exact-quote protection, source-URL enforcement, Cloud routing, text/audio conversion and rejection of incomplete responses. These provider responses are mocked. Live Nimble search and Gemini 3.8 Flash through the project-specific Google Cloud endpoint both succeeded on October 11, 2026. A dedicated Cloud key is configured as a server secret, restricted to the Agent Platform API. Browser verification of the hosted app requires the owner's ChatGPT sign-in. The registered private Site ID remains in `.openai/hosting.json`; reuse it, do not create another.

## Source control

Keep project code, editorial prompts, public-source references and fictional demo content in the private source repository. API keys, local environment files, recordings, photographs and exported personal stories are not project source and must not be committed. Future approved code updates should also be pushed to the connected GitHub repository once it is available; the Site source and deployment remain managed by the Sites workflow.

The supplied `Storypress-preview.html` is a standalone interactive preview. Open it directly in your browser; it runs the sample and guided writing mode, without a server. Full AI features require running the app server and configuring the keys.
