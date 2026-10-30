# Deploy Storypress from GitHub to Vercel

The repository supports both Sites/Cloudflare and Vercel. The Vercel entry points call the same bundled API as the Worker; prompts, provider behavior, quotas, saved stories and edition rendering are shared. This adapter has local build and mocked request checks, but has not been deployed to Vercel yet.

1. Import your Storypress GitHub repository into Vercel. The GitHub repository can stay private even when the website is public.
2. Use framework **Other**, repository root, Node **22.x**, and Fluid Compute. `vercel.json` sets `npm ci`, `npm run build:vercel`, the `dist-public` output directory and a 300-second function limit.
3. Set these **server environment variables** for the intended deployment environment. Do not use a browser-exposed prefix or commit keys:

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

Optional billing variables enable checkout and webhooks. The paywall ships dormant: without `STRIPE_SECRET_KEY` nothing is gated, charged or verified, and enabling billing is an environment change, never a code change. Price **amounts** live in Stripe products; only price IDs appear here.

```env
STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_SUBSCRIPTION_MONTHLY=YOUR_STRIPE_PRICE_ID
STRIPE_PRICE_SUBSCRIPTION_ANNUAL=YOUR_STRIPE_PRICE_ID
STRIPE_PRICE_LIFETIME=YOUR_STRIPE_PRICE_ID
STORYPRESS_FREE_STORIES=3
```

`STORYPRESS_FREE_STORIES` is optional (default 3) and counts self-started original stories ever per account — deletes never refund it, while translations and save-as-copies stay free. In the Stripe dashboard, point a webhook at `https://YOUR_DEPLOYMENT/api/stripe-webhook` subscribed to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.paid`, and copy its signing secret into `STRIPE_WEBHOOK_SECRET`. Redeploy after changing variables. The full connect runbook — products and prices, webhook configuration, and a test-mode checkout checklist — is in [Stripe setup](STRIPE-SETUP.md).

`GEMINI_MODEL` is optional. The current default is `gemini-3.8-flash`. `NIMBLE_API_KEY` is optional; without it, research is unavailable. Vercel does not inherit local `.dev.vars` or Sites secrets. Redeploy after changing variables. The adapter refuses API access when Supabase is incomplete and never accepts a visitor-supplied Sites identity header.

4. In Supabase Authentication URL Configuration, set Site URL to the chosen canonical production origin and allow its exact redirect URL with a trailing `/`. Keep any other deployment origins you still use. Avoid wildcard redirects for untrusted domains. For a new database, follow [Supabase setup](SUPABASE-SETUP.md). On an existing database, check migration state and **do not rerun an already-applied migration**.
5. Configure a production SMTP provider in Supabase before opening sign-up to visitors. The default sender is limited to project-team addresses and a very small sending allowance. Storypress uses email magic links; hosting the page publicly does not remove this requirement.
6. Test sign-in on the deployed URL, a multi-turn interview, newspaper creation and private saving. A ChatGPT login on the old host is not a Storypress/Supabase login. Device-only drafts remain on their old browser origin: save them to the account before moving, or export them. Saved account stories use the same Supabase project on either host.
7. When ready for anonymous newspaper links, set `STORYPRESS_PUBLIC_SHARING=true` on the public Vercel deployment and redeploy. Test `/s/<token>` signed out and then revoke it. Website access and story publication are separate: stories stay private until their owner approves and shares an edition. Only the approved newspaper, photo/caption and selected sources appear in a shared snapshot. Vercel Deployment Protection must allow the intended audience, including anonymous recipients for share links.

## Upload and audio limits

Photos are resized/re-encoded before upload and capped at 1.8 MB of encoded image data. Voice answers are capped at two minutes and 3 MB of raw audio (about 4 MB after base64), with a requested 48 kbps audio bitrate. This fits Vercel's 4.5 MB function payload ceiling. Browsers may choose a different bitrate; an oversized recording asks the narrator to record a shorter answer. Speech playback uses browser voices and still needs testing on physical iOS/Android devices.

The existing per-user and project AI allowances remain enforced in Supabase. Payment collection stays dormant until the Stripe environment variables above are set; without them, no story creation is gated and no checkout exists.

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
