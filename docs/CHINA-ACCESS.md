# China access — decision inventory

Mainland-China accessibility is currently blocked by **infrastructure, not code**. This
document records the blocker inventory (hosts, what each blocks, and whether it is a code
or infrastructure/regulatory matter) so the founder can act on hosting, auth, provider,
and ICP decisions whenever the business case justifies it.

## What code already ships

- Fonts inlined as data URIs (`app/fonts.css`) — no font CDN.
- Zero CDN, analytics, or tracking dependencies; `scripts/check-client-hosts.mjs` fails the
  build if a new external font/CDN/analytics host appears in client code.
- Strict CSP on shared editions; shared reading view is a static, noindex shell.
- The AI provider seam (`lib/providers.ts`) is a single typed point — a China-reachable
  model can be slotted in later without touching call sites.
- Graceful failure: when the live-voice websocket cannot connect or an AI call fails at the
  network layer, the UI explains what happened in the reader's language and preserves the
  draft (draft-handoff pattern).

## Blocker inventory

| Host / dependency | What it blocks | Classification |
|---|---|---|
| `generativelanguage.googleapis.com` (direct websocket from the browser) | Gemini Live real-time voice | Infrastructure (unreachable in mainland China); provider swap is code-only once procured |
| Gemini HTTP endpoints (AI Studio / Vertex, server side) | Interviewing, writing, transcription, translation, artwork | Infrastructure; reachable only via relay today |
| `accounts.google.com` (Google OAuth) | One of two sign-in paths | Infrastructure + regulatory; needs a domestic auth option |
| `*.supabase.co` | Auth, database, storage — the app's entire data plane | Infrastructure (slow/unreliable from China, not fully blocked) |
| Vercel hosting (`*.vercel.app` / custom domain edge) | Serving the app and API at all | Infrastructure; hosting migration is a founder decision |
| `sdk.nimbleway.com` / `online.nimbleway.com` (Nimble) | Historical photo research (optional feature) | Infrastructure; optional feature degrades gracefully without it |

## Founder decisions (explicitly out of scope for code)

1. **Hosting migration** — move off Vercel to a China-reachable host or CDN.
2. **Auth path** — add a domestic auth option alongside/instead of Google OAuth; a Supabase
   proxy or domestic data plane if reachability proves insufficient.
3. **AI provider procurement** — choose (and pay for) a China-reachable model to slot into
   `lib/providers.ts`; same for a live-voice replacement.
4. **ICP filing** — required for any domain served from mainland China.

Nothing in this codebase prevents any of these; none of them can be done in code alone.
Revisit each only on a founder decision.
