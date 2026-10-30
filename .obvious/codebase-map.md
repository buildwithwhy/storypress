# Codebase Map — Storypress

Depth-2 overview. Runtime flow: `app/` (React client, bundled by esbuild) talks to the shared Web API in `server/`, which is wrapped by the Cloudflare Worker in `worker/` (bundled artifact: `worker/index.js`) and the Vercel adapter (`server/vercel.mjs` + `api/` routes).

| Path | Kind | Purpose |
|---|---|---|
| `api/` | serverless routes | Vercel-compatible route adapters: `account.mjs`, `stories.mjs`, `story.mjs`; `shared.mjs` holds common wiring |
| `app/` | React client (TSX/CSS) | Screens and flows: `storypress.tsx` (root), `story-start.tsx`, `live-interview.tsx`, `photo-story.tsx`, `keepsake-studio.tsx`, `translation-studio.tsx`, `research-thread.tsx`, `sharing.tsx`, `recordings.tsx`, `email-sign-in.tsx`, plus flow CSS |
| `lib/` | shared TS logic | Client/server story domain: `story.ts`, `editorial.ts` (loads `skills/` prompts), `interview-*.ts`, `providers.ts`/`image-provider.ts`, `edition.ts`/`reader.ts`, `account-client.ts`, `event-stream.ts`, copy modules |
| `server/` | API implementation | `api.ts` (route dispatch, capability/health), `interview-stream.ts`, `live.ts` (live voice), `storage.ts` (Supabase persistence), `vercel.mjs` (adapter) |
| `worker/` | Cloudflare entry | `main.ts` (source) → bundled `index.js` (built artifact, exports `default.fetch`); served by `scripts/dev-server.mjs` locally |
| `scripts/` | build + verification | `bundle.mjs`, `build.sh`, `build-verified.sh`, `validate-artifact.mjs`, `dev-server.mjs`, `sites-env.sh`, install helpers, and ~20 `check-*.mjs` mocked provider/browser checks |
| `skills/` | editorial prompts | Canonical interview/writing instructions loaded by `lib/editorial.ts`: `interview-memories`, `research-story-context`, `write-personal-edition`, `review-and-share-edition` |
| `supabase/` | infra config | `migrations/` (DB schema), `templates/` (auth email templates) |
| `docs/` | documentation | `DEVELOPMENT.md` (start here), `PRODUCT-BRIEF.md`, `MODELS.md`, `SUPABASE-SETUP.md`, `VERCEL-SETUP.md`, `LIVE-VOICE-SETUP.md`, `EMAIL-SIGN-IN.md`, `BUILD-DECISIONS.md`, `EDITORIAL-SKILLS.md`, `NEXT-STEPS.md`, font licenses |
| `public/` | static assets | Artwork, favicon, misc svgs |
| `types.d.ts` | types | Ambient type declarations |
| `vercel.json` | config | Vercel deployment config |
| `.openai/` | config | `hosting.json` — hosting metadata |
