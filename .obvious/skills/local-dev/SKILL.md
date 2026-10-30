---
name: local-dev
---

# Local Dev — Storypress

Record of the onboarding run that brought the stack up (2026-10-30, sandbox cmp_9nA5O89t).

## Toolchain gotcha

The sandbox image ships Node 20, but the repo's engines field requires Node 22.x. Node 22.14.0 was installed from the official tarball into `/tmp/node22` and is preserved in the sandbox snapshot. Prefix every node/npm command with:

```sh
export PATH=/tmp/node22/bin:$PATH
```

## Install

1. The sandbox pre-seeds `node_modules/` as **root-owned and read-only**, which makes `npm ci` fail with EACCES on `node_modules/.bin`. Fix: `sudo -n rm -rf node_modules` (the sandbox user is in the sudo group), then `npm ci --no-audit --no-fund` (~29 packages, fast, needs network access).
2. Ignore the untracked `bun.lock` at the repo root — the committed lockfile is `package-lock.json` (npm).

## Build + run

```sh
npm run build        # bundle.mjs + build.sh + validate-artifact.mjs → worker/index.js, dist/
npm run dev          # builds, then starts scripts/dev-server.mjs
```

The `dev` script is long-running and does not daemonize; run it detached to keep the tool session alive:

```sh
nohup node scripts/dev-server.mjs > /tmp/storypress-dev.log 2>&1 &
```

Startup output prints `Local: http://127.0.0.1:4173` — parse the port from the log (default 4173, override with `STORYPRESS_PORT`). No lock-file conflicts observed.

## Credentials

None required for a healthy local run. The server reads `.dev.vars` (KEY=value lines, gitignored); without AI/Supabase keys the app serves fine and affected features report an explicit unavailable state (e.g. `GET /api/stories` → 503). Do not fake credentials.

## Primary flow verification (evidence from this run)

- `GET /` → 200, serves the app shell (`Once & Ours`), `/app.js` and `/app.css` → 200.
- `GET /api/story` → capability JSON matching `server/api.ts` (gemini/nimble false, model list).
- `npm run typecheck` → clean.
- Mocked check scripts: `check-sharing`, `check-draft-handoff`, `check-model-routing`, `check-story-saver` all pass.
- Known pre-existing failure (not environmental): `scripts/check-worker.mjs` line 7 expects the `GET /api/story` payload without the `liveVoice` key that `server/api.ts` now returns — the script's expectation is stale relative to `server/`.
- No browser in the sandbox, so no screenshots; HTTP-level verification stands in for the browser flow.

## Snapshot

`2sa7nz0icxpyd7dgweqt:default` captured 2026-10-30T15:22:55.698Z with the dev server running on port 4173.
