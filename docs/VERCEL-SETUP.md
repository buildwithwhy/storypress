# Deploy Storypress from GitHub to Vercel

The repository supports both Sites/Cloudflare and Vercel. The Vercel entry points call the same bundled API as the Worker; prompts, provider behavior, quotas, saved stories and edition rendering are shared. This adapter has local build and mocked request checks, but has not been deployed to Vercel yet.

1. Import the private `buildwithwhy/storypress` repository into Vercel. The GitHub repository can stay private even when the website is public.
2. Use framework **Other**, repository root, Node **22.x**, and Fluid Compute. `vercel.json` sets `npm ci`, `npm run build:vercel`, the `dist-public` output directory and a 300-second function limit.
3. Set these **server environment variables** for the intended deployment environment. Do not use a browser-exposed prefix or commit keys:

```env
GEMINI_BACKEND=vertex
GOOGLE_CLOUD_PROJECT=storyteller-511316
GOOGLE_CLOUD_LOCATION=global
VERTEX_API_KEY=<existing Cloud API key>
NIMBLE_API_KEY=<existing Nimble key, optional>
SUPABASE_URL=https://ciciuohgtvsdkeakfiht.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SECRET_KEY=<server secret key>
STORYPRESS_PUBLIC_SHARING=false
```

`GEMINI_MODEL` is optional. The current default is `gemini-3.8-flash`. Vercel does not inherit local `.dev.vars` or Sites secrets. Redeploy after changing variables. The adapter refuses API access when Supabase is incomplete and never accepts a visitor-supplied Sites identity header.

4. In Supabase Authentication URL Configuration, set Site URL to the chosen canonical production origin and allow its exact redirect URL with a trailing `/`. Keep the current Sites URL if you still use it. Avoid wildcard redirects for untrusted domains. The existing Storypress database migration is already applied; **do not rerun it**.
5. Configure a production SMTP provider in Supabase before opening sign-up to visitors. The default sender is limited to project-team addresses and a very small sending allowance. Storypress uses email magic links; hosting the page publicly does not remove this requirement.
6. Test sign-in on the deployed URL, a multi-turn interview, newspaper creation and private saving. A ChatGPT login on the old host is not a Storypress/Supabase login. Device-only drafts remain on their old browser origin: save them to the account before moving, or export them. Saved account stories use the same Supabase project on either host.
7. When ready for anonymous newspaper links, set `STORYPRESS_PUBLIC_SHARING=true` on the public Vercel deployment and redeploy. Test `/s/<token>` signed out and then revoke it. Website access and story publication are separate: stories stay private until their owner approves and shares an edition. Only the approved newspaper, photo/caption and selected sources appear in a shared snapshot. Vercel Deployment Protection must allow the intended audience, including anonymous recipients for share links.

## Upload and audio limits

Photos are resized/re-encoded before upload and capped at 1.8 MB of encoded image data. Voice answers are capped at two minutes and 3 MB of raw audio (about 4 MB after base64), with a requested 48 kbps audio bitrate. This fits Vercel's 4.5 MB function payload ceiling. Browsers may choose a different bitrate; an oversized recording asks the narrator to record a shorter answer. Speech playback uses browser voices and still needs testing on physical iOS/Android devices.

The existing per-user and project AI allowances remain enforced in Supabase. No payment collection is implemented.

## Verification

```sh
npm ci
npm run typecheck
npm run build:vercel
npm run check:vercel
```

These checks cover static assets, missing environment configuration, identity-header spoofing, Supabase auth, origin checking and both shared-edition URL forms. They do not prove Vercel routing, email delivery, microphone compatibility or live provider configuration; verify those after the first deployment.

Official references checked October 11, 2026:
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/functions/limitations
- https://supabase.com/docs/guides/auth/auth-smtp
