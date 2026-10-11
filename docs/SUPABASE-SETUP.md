# Activate Supabase accounts and story links

Use a dedicated Supabase project for Storypress. The React site and its Worker remain on the frontend host; Supabase supplies Auth and Postgres. No Storage bucket is needed for this first version: compressed photographs are saved inside private story JSON and copied into an approved edition. Raw recordings are not uploaded to the database.

1. Create the project and apply `supabase/migrations/202610110001_storypress.sql` in its SQL editor. The migration creates new namespaced tables, RLS and one server-only quota function. It is a first-run migration, not a repeatable reset. Never run it against unrelated production tables.
2. Fill the ignored `.dev.vars` file and the host's server environment with:
   - `SUPABASE_URL`: the project HTTPS URL.
   - `SUPABASE_PUBLISHABLE_KEY`: its publishable key (or legacy anon key).
   - `SUPABASE_SERVICE_ROLE_KEY`: legacy service_role JWT; server secret, never browser code.
   - `STORYPRESS_PUBLIC_SHARING=false`: keep false while the frontend is owner-private.
3. Enable email sign-in. Leave the default magic-link template in place. Set Auth Site URL to the frontend URL and add the exact localhost and production redirect URLs, each ending in `/`. Configure production SMTP before inviting external users; Supabase's default email sender is limited. Never commit SMTP credentials.
4. Restart the local server, sign in through **My stories**, save a fictional story, reload and reopen it. Sign into a second test account and verify the first account's story is inaccessible. Run the migration/integration checks against this actual project before opening the app publicly. Automated tests currently mock Supabase responses and do not prove a live database deployment.
5. Once the owner explicitly chooses to open the frontend to visitors, enable its public audience and set `STORYPRESS_PUBLIC_SHARING=true`. A private frontend's login gate also blocks its `/s/...` links. Do not advertise anonymous sharing before this is verified in a signed-out browser.
6. Approve a fictional newspaper, create its link, read it signed out, then turn the link off and verify the same URL becomes unavailable. Saving edits privately leaves the shared edition unchanged; **Update shared edition** explicitly replaces it. A revoked link is discarded, so creating another link later produces a new token.

## Privacy and account behavior

All stories start private. Worker requests verify Supabase tokens against `/auth/v1/user`; client user IDs are never trusted. Server database requests include the verified owner ID. RLS additionally restricts authenticated direct reads to the owner, and anonymous reads and all direct client writes are denied. The service-role secret stays in server environment variables.

Sharing creates a separate approved snapshot containing only the newspaper, photograph/caption and selected published source details. Interview turns, unfinished text and researcher questions are removed. Public routes fetch only this edition field and return no-store/noindex headers. Anyone holding the URL can read it. Link revocation cannot recall downloaded copies.

Device drafts are scoped to account ID. Signing out clears the current account's device draft after a warning; save it first. The signed-out device draft can be imported explicitly. Local drafts are convenience storage, not encrypted storage for shared devices. Saved story deletion also removes its link. Account deletion and full account data export remain future work; individual story exports are available now.

## Cost limits

The Supabase quota function atomically reserves both a 40-unit daily account allowance and a 400-unit daily project allowance, resetting at midnight UTC. Interviewing, transcription and writing use one unit each; historical discovery uses three (two model requests and one search). Attempts count even when a provider fails. These are request allowances, not dollar budgets. Input/output sizes are bounded, but provider billing alerts and quotas remain useful controls. No payments or paid plan are enabled.

Before Supabase is configured, the existing owner-private pilot continues to use Sites identity and does not have a durable daily quota. Do not make the frontend public in that mode. Once a Supabase URL is present, AI requests require Supabase authentication and a successful quota reservation; failures do not fall back to the pilot.

## Validation commands

`npm run typecheck`

`npm run build`

`node scripts/check-worker.mjs`

`node scripts/check-voice.mjs`

`node scripts/check-sharing.mjs`
