# Activate Supabase accounts and story links

Use a dedicated Supabase project for Storypress. The React site and its Worker remain on the frontend host; Supabase supplies Auth and Postgres. No Storage bucket is needed for this first version: compressed photographs are saved inside private story JSON and copied into an approved edition. Raw recordings are not uploaded to the database.

1. Create the project and apply `supabase/migrations/202610110001_storypress.sql` in its SQL editor. The migration creates new namespaced tables, RLS and one server-only quota function. It is a first-run migration, not a repeatable reset. Never run it against unrelated production tables. Later additive migrations apply the same way, never editing an applied file: `202610300001_contributions.sql` (invites and contributions) and `202610300002_billing.sql` (billing entitlements, story counters, webhook idempotency, and the `storypress_reserve_story` server-only quota RPC). The billing migration ships dormant — nothing in the app reads those tables until Stripe is configured in the host environment.
2. Fill the ignored `.dev.vars` file and the host's server environment with:
   - `SUPABASE_URL`: the project HTTPS URL.
   - `SUPABASE_PUBLISHABLE_KEY`: its publishable key beginning with `sb_publishable_`.
   - `SUPABASE_SECRET_KEY`: its secret key beginning with `sb_secret_`; server-only, never browser code. Do not use a legacy JWT key.
   - `STORYPRESS_PUBLIC_SHARING=false`: keep false while the frontend is owner-private.
3. Configure Google sign-in as described below. Email links remain available as a fallback; enable email sign-in. Leave the default magic-link template in place. Set Auth Site URL to the frontend URL and add the exact localhost and production redirect URLs, each ending in `/`. Configure production SMTP before inviting external users; Supabase's default email sender is limited. Never commit SMTP credentials.
4. Restart the local server, sign in through **My stories**, save a fictional story, reload and reopen it. Sign into a second test account and verify the first account's story is inaccessible. Run the migration/integration checks against this actual project before opening the app publicly. The configured Storypress project passed live migration, identity, isolation, sharing and quota checks on October 11, 2026; rerun these checks when changing projects.
5. Once the owner explicitly chooses to open the frontend to visitors, enable its public audience and set `STORYPRESS_PUBLIC_SHARING=true`. A private frontend's login gate also blocks its `/s/...` links. Do not advertise anonymous sharing before this is verified in a signed-out browser.
6. Approve a fictional newspaper, create its link, read it signed out, then turn the link off and verify the same URL becomes unavailable. Saving edits privately leaves the shared edition unchanged; **Update shared edition** explicitly replaces it. A revoked link is discarded, so creating another link later produces a new token.

## Privacy and account behavior

All stories start private. Worker requests verify Supabase tokens against `/auth/v1/user`; client user IDs are never trusted. Server database requests include the verified owner ID. RLS additionally restricts authenticated direct reads to the owner, and anonymous reads and all direct client writes are denied. The secret key stays in server environment variables and travels only in the `apikey` header. A signed-in user’s JWT travels in `Authorization` when verifying that user. The modern secret key still resolves to the Postgres `service_role` role, so the SQL grants keep that role name.

Sharing creates a separate approved snapshot containing only the newspaper, photograph/caption and selected published source details. Interview turns, unfinished text and researcher questions are removed. Public routes fetch only this edition field and return no-store/noindex headers. Anyone holding the URL can read it. Link revocation cannot recall downloaded copies.

Device drafts are scoped to account ID. Signing out clears the current account's device draft after a warning; save it first. The signed-out device draft can be imported explicitly. Local drafts are convenience storage, not encrypted storage for shared devices. Saved story deletion also removes its link. Account deletion and full account data export remain future work; individual story exports are available now.

## Cost limits

The Supabase quota function atomically reserves both a 40-unit daily account allowance and a 400-unit daily project allowance, resetting at midnight UTC. Interviewing, photograph assistance, transcription and writing use one unit each; historical discovery uses three (two model requests and one search). Attempts count even when a provider fails. These are request allowances, not dollar budgets. Input/output sizes are bounded, but provider billing alerts and quotas remain useful controls. No payments or paid plan are enabled.

Before Supabase is configured, the existing owner-private pilot continues to use Sites identity and does not have a durable daily quota. Do not make the frontend public in that mode. Once a Supabase URL is present, AI requests require Supabase authentication and a successful quota reservation; failures do not fall back to the pilot.

## Validation commands

`npm run typecheck`

`npm run build`

`node scripts/check-worker.mjs`

`node scripts/check-voice.mjs`

`node scripts/check-sharing.mjs`

## Why the server key is used

The publishable key plus a user session is enough for basic Supabase sign-in and operations allowed by RLS. This backend deliberately reserves story writes, publication snapshots and quota mutations for the trusted server. Its anonymous share route reads only the approved edition selected by a valid share token. These operations use `SUPABASE_SECRET_KEY` after the app’s authorization checks (or capability-token check for a shared edition).

A different design could expose narrowly scoped database functions and use only user/anonymous credentials, but that is not the current implementation. Do not simply remove the server key or loosen table permissions. Secret keys bypass RLS; owner filters, approval checks and server-side quotas remain necessary.

Current key guidance: https://supabase.com/docs/guides/getting-started/api-keys
Migration guidance: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys

## Google sign-in

The sign-in panel offers **Continue with Google** in English, Chinese and Spanish. It uses Supabase OAuth, returns to the same frontend origin and preserves a draft in the originating browser tab. A pending Google draft transfer expires after 15 minutes and becomes bound to the authenticated account after it is consumed.

1. In Google Cloud project `storyteller-511316`, configure Google Auth Platform branding and audience for Storypress, then create a **Web application** OAuth client. For public access, use an external audience in production; testing mode only permits listed test users.
2. Add these authorized JavaScript origins:
   - `https://storypress-app.vercel.app`
   - `https://storypress-memories.coppermango10.chatgpt.site`
3. Add this authorized redirect URI: `https://ciciuohgtvsdkeakfiht.supabase.co/auth/v1/callback`.
4. In the Storypress Supabase project, open **Authentication → Sign In / Providers → Google**. Enable Google and enter the OAuth Client ID and Client Secret there. Leave nonce checks enabled and “Allow users without an email” disabled. These credentials belong in Supabase, not Vercel or frontend source. A Gemini/Vertex API key is not an OAuth client credential.
5. Ensure Supabase's redirect allowlist contains both frontend origins with a trailing `/`. The app uses the origin where sign-in started.
6. Verify a signed-out Google login, return to the same host, preservation of unfinished text/photo, and access to that user's own stories. Google login does not send a Supabase login email; the email-link fallback still uses the project's email allowance.

Reference: https://supabase.com/docs/guides/auth/social-login/auth-google
