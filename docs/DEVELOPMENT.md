# Developing Storypress

Storypress uses React and a shared Web API backend for Cloudflare Workers/Sites and Vercel. Supabase provides accounts, private story storage, and durable AI allowances. Gemini handles interviewing, writing, transcription, and photo interpretation; Nimble retrieves optional research. Browser speech synthesis reads interview questions aloud.

## Local development

Use Node 22 and the committed dependency lockfile.

```sh
npm ci
npm run dev
```

The development command builds the application before starting the local server. To check types or create a deployment artifact separately:

```sh
npm run typecheck
npm run build
```

## Server configuration

Store local credentials in an ignored `.dev.vars` file. Configure hosted credentials in the deployment's server environment settings; never commit keys or expose secret keys to the browser.

Example Google Cloud configuration:

```env
GEMINI_BACKEND=vertex
GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
GOOGLE_CLOUD_LOCATION=global
VERTEX_API_KEY=YOUR_CLOUD_API_KEY
NIMBLE_API_KEY=YOUR_NIMBLE_API_KEY
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SERVER_SECRET_KEY
STORYPRESS_PUBLIC_SHARING=false
```

The Cloud credential must be authorized for the configured project's model API. An AI Studio key is not interchangeable with a Cloud credential. Cloud mode does not fall back to AI Studio after a configuration, billing, or permission error.

For the alternative AI Studio text backend, set `GEMINI_BACKEND=ai-studio` and `GEMINI_API_KEY`. Story-specific image generation requires the Cloud backend. Model defaults, per-task overrides, and illustration behavior are documented in [Models and media](MODELS.md); verify availability and current pricing before deployment.

Missing AI credentials produce an explicit unavailable state rather than a simulated interview. Without Nimble, interviewing and newspaper generation can still work, but research is unavailable. The fictional sample is separate from live provider behavior.

## Accounts, saving, and sharing

Follow [Supabase setup](SUPABASE-SETUP.md) for a new deployment. Check the database's migration state before applying migrations. Production email sign-in needs an appropriate SMTP configuration and exact redirect URLs for the intended origin.

Device drafts use browser storage. Signed-in drafts and completed newspapers save privately with ownership checks and revision conflict protection. Guest handoff is limited to the same browser and origin. Save to an account or export work before moving to another host. Audio recordings are temporary and are not part of saved stories.

Website access and story sharing are separate settings. Keep `STORYPRESS_PUBLIC_SHARING=false` until the deployment is ready for anonymous recipients. An unlisted link exposes an approved edition snapshot, not private interview notes or unfinished text. Owners can revoke links. AI allowances do not constitute payment collection; payment stays dormant until the Stripe environment keys are configured (see [Vercel setup](VERCEL-SETUP.md)).

## Editorial and media behavior

Canonical interview and writing instructions live in `skills/` and are loaded by `lib/editorial.ts`. See [Editorial skills](EDITORIAL-SKILLS.md) for their sources and evaluation notes. The application explicitly selects each step; this is not an autonomous agent loop.

Photo interpretation requires a narrator's choice. Search uses reviewed text, never the uploaded photograph. Research is optional, retrieved text is untrusted, and source context must remain distinct from personal testimony. Generated artwork is illustrative, not evidence of a memory. Narrators should review text and images before publishing or printing.

## Verification

Use the focused scripts relevant to a change, alongside type checking and the appropriate build:

```sh
node scripts/check-worker.mjs
node scripts/check-voice.mjs
node scripts/check-photo.mjs
node scripts/check-sharing.mjs
node scripts/check-social-share.mjs
node scripts/check-draft-handoff.mjs
node scripts/check-model-routing.mjs
```

Mocked provider and browser checks establish request handling and state behavior; they do not prove live provider access, email delivery, or physical-device microphone compatibility. Test those separately in the intended deployment. Use fictional stories for fixtures and remove temporary accounts and data afterward.

## Vercel

The repository includes a Vercel adapter using the same API implementation as the Worker. Follow [Vercel setup](VERCEL-SETUP.md), supplying the destination environment's own configuration.

```sh
npm run build:vercel
npm run check:vercel
```

The adapter has local build and mocked request checks; a live Vercel deployment still needs end-to-end verification.

## Repository hygiene

Commit application code, editorial instructions, and fictional fixtures. Do not commit credentials, recordings, uploaded photographs, or exported personal stories. Keep deployment identifiers and infrastructure state out of product-facing documentation. The older `Storypress-preview.html` is a visual prototype, not the current application or an AI integration test.
