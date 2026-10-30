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
  model can be slotted in later without touching call sites. Language routing now ships:
  Simplified-Chinese story text routes through Qwen via OpenRouter (`openrouter.ai`,
  server-side only — the browser never contacts it), degrading to Gemini when unconfigured.
- Live voice remains Gemini's browser websocket in every language. A Mandarin live path
  needs a realtime API OpenRouter does not carry and a server-side websocket relay
  (Vercel functions cannot terminate websockets) — net-new infrastructure, staged later.
- Graceful failure: when the live-voice websocket cannot connect or an AI call fails at the
  network layer, the UI explains what happened in the reader's language and preserves the
  draft (draft-handoff pattern).

## Blocker inventory

| Host / dependency | What it blocks | Classification |
|---|---|---|
| `generativelanguage.googleapis.com` (direct websocket from the browser) | Gemini Live real-time voice | Infrastructure (unreachable in mainland China); provider swap is code-only once procured |
| Gemini HTTP endpoints (AI Studio / Vertex, server side) | Interviewing, writing, transcription, translation, artwork | Infrastructure; reachable only via relay today |
| `openrouter.ai` (server side) | Mandarin story text (Qwen) | Infrastructure; same server-side reachability class as the Gemini HTTP endpoints |
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

## Staged Mandarin live-voice path

Mandarin **story text** routes today (Qwen via OpenRouter); **live voice** does not. When a
Mandarin live conversation becomes a product priority, the path is a backend relay, staged
as follows:

1. **Why a relay is unavoidable.** Qwen Omni Realtime — the realtime voice API for Mandarin
   live — is DashScope-only; OpenRouter carries no realtime voice API. It has no
   browser-safe ephemeral token: the API key must travel in the WebSocket handshake, so the
   browser can never hold it. `server/live.ts` plays exactly this role for Gemini today
   (server-side credential and config holder minting short-lived access); a Qwen path needs
   the same role served by a process that can terminate websockets.
2. **Why it is not built here yet.** The server runs as Vercel functions, which cap at
   300 seconds and cannot terminate websockets at all — the repo has no WebSocket surface.
   The leading candidate is a small Cloudflare Worker relay inheriting `server/live.ts`'s
   credential-and-config-holder role. On the client, the live-access grant's `provider`
   field exists but is currently ignored; wiring it up is part of that stage, after the
   in-flight voice-responsiveness work and a native-speaker Mandarin eval of the routed
   text path.
3. **What stays founder-owned** (per the decisions above): DashScope/Alibaba procurement
   and billing, the hosting surface for the relay, and ICP filing for any mainland domain.

### When DashScope direct replaces OpenRouter for text

The OpenAI-compatible adapter in `lib/providers.ts` speaks the contract both providers
share, so switching zh text to DashScope direct is an environment change (base URL, key,
model), not code. It earns its place when any of these turn real:

1. **Mandarin live voice** — its realtime API is DashScope-only (see above).
2. **A genuine mainland deployment** — DashScope Beijing region under a China Aliyun
   entity (real-name verification, CNY billing; lead time).
3. **Scale** — direct list pricing runs slightly under OpenRouter's spread; a rounding
   error at current volume, not a trigger on its own.

Until one of those fires, OpenRouter keeps Mandarin text working against the existing
prepaid balance with zero new accounts.
