# Storypress — Agent Guide

Storypress helps people turn memories into illustrated personal newspapers. React client + a shared Web API backend that deploys to Cloudflare Workers and Vercel; Supabase provides accounts and private story storage; Gemini handles interviewing/writing/art; Nimble is optional research.

## Stack

- **Runtime:** Node.js 22.x (engines field is strict — sandbox default is Node 20; use `/tmp/node22/bin` — see Local Dev)
- **Package manager:** npm (committed `package-lock.json`; ignore stray untracked `bun.lock`)
- **Client:** React 18, bundled by esbuild (`scripts/bundle.mjs`) into `worker/index.js`
- **Server:** shared worker-based Web API (`server/`) wrapped by Cloudflare Worker (`worker/`) and Vercel adapter (`server/vercel.mjs`, `api/` routes)
- **External services:** Supabase (hosted — no local DB needed), Gemini, Nimble — all optional at runtime; missing credentials produce an explicit "unavailable" state, never a simulated flow

## Commands

```sh
# Install (use Node 22 on PATH)
npm ci

# Build + start dev server (builds first, then serves)
npm run dev          # serves at http://127.0.0.1:4173 (port from startup output)

# Dev server only, after a build
npm run start

# Typecheck
npm run typecheck

# Production build (bundled worker artifact + validation)
npm run build

# Vercel adapter build/check
npm run build:vercel && npm run check:vercel
```

Port override: `STORYPRESS_PORT=<n> node scripts/dev-server.mjs`. Default is 4173 — parse the `Local: http://127.0.0.1:<port>` line from startup output rather than assuming.

## Environment / credentials

Local server credentials live in `.dev.vars` (gitignored) as `KEY=value` lines; process env also wins for `GEMINI_*`, `VERTEX_API_KEY`, `GOOGLE_CLOUD_*`, `NIMBLE_API_KEY`. Keys used: `GEMINI_API_KEY` (AI Studio backend), or `GEMINI_BACKEND=vertex` + `GOOGLE_CLOUD_PROJECT` + `GOOGLE_CLOUD_LOCATION` + `VERTEX_API_KEY` (Cloud backend; required for story image generation), `NIMBLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `STORYPRESS_PUBLIC_SHARING`. None are required to run locally — TODO(confirm) with the owner if you need live provider or Supabase behavior; request any real keys via the secure credentials flow.

## Codebase map

See [.obvious/codebase-map.md](./codebase-map.md).

## Local verification

- `npm run typecheck` — passes.
- Mocked provider/browser check scripts (per docs/DEVELOPMENT.md): `node scripts/check-worker.mjs`, `check-voice.mjs`, `check-photo.mjs`, `check-sharing.mjs`, `check-draft-handoff.mjs`, `check-model-routing.mjs`, and ~15 more `check-*.mjs` under `scripts/`.
- Known pre-existing failure: `check-worker.mjs` asserts the `GET /api/story` capability payload without the `liveVoice` key that `server/api.ts` now returns — the check script's expectation is stale, unrelated to environment.
- HTTP smoke test: `GET /` returns the app shell (200), `/app.js` and `/app.css` (200), `GET /api/stories` returns 503 without Supabase credentials (expected).

## Local Dev Setup (onboarding run)

- **Status:** healthy (2026-10-30). Snapshot `2sa7nz0icxpyd7dgweqt:default` captured 2026-10-30T15:22:55.698Z.
- Node 22.14.0 installed at `/tmp/node22` (sandbox ships Node 20; export `PATH=/tmp/node22/bin:$PATH` before npm/node commands).
- `node_modules` was pre-seeded root-owned and read-only; removed via `sudo rm -rf node_modules` before `npm ci`.
- Dev server runs detached (`nohup node scripts/dev-server.mjs > /tmp/storypress-dev.log 2>&1 &`); log at `/tmp/storypress-dev.log`.
