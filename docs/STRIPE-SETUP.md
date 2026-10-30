# Stripe billing setup

Storypress ships as freemium: three self-started stories per account, then a
recurring subscription (monthly or annual) or a one-time lifetime unlock —
per the approved paywall spec (October 30, 2026). Billing is **dormant by
default**: without `STRIPE_SECRET_KEY` nothing is gated, charged or verified,
and enabling it is an environment change, never a code change. This runbook
takes a founder with no context from an empty Stripe account to a green
test-mode checkout.

International cards only in v1: checkout needs an international card, so
mainland-China-local payment rails are out of scope. The entitlement schema
is payment-provider-agnostic, so a China-friendly rail could slot in later
without schema churn.

## Before you start

1. Apply the billing migration if the Supabase project predates it:
   `supabase/migrations/202610300002_billing.sql` creates the entitlement,
   story-count and billing-event tables (additive, service-role only). On an
   existing database, check migration state first and **do not rerun an
   already-applied migration** — see [Supabase setup](SUPABASE-SETUP.md) and
   [Vercel setup](VERCEL-SETUP.md).
2. A Stripe account. Work in **test mode** first; keys never enter the
   repository — server environment variables only.
3. The deployment's canonical origin. The webhook endpoint and the checkout
   return URL are both derived from it.

## Products and prices

Price **amounts live in Stripe products** and nowhere in the repository — the
code reads only price IDs from environment variables. Create the three
products in the Stripe Dashboard (test mode first):

| Product | Billing | Price ID consumed by |
| --- | --- | --- |
| Storypress subscription | Monthly recurring | `STRIPE_PRICE_SUBSCRIPTION_MONTHLY` |
| Storypress subscription | Yearly recurring | `STRIPE_PRICE_SUBSCRIPTION_ANNUAL` |
| Storypress lifetime unlock | One-time | `STRIPE_PRICE_LIFETIME` |

Copy the three `price_...` IDs; the configuration step below consumes them.

## Required configuration

Vercel → storypress-app → Settings → Environment Variables. These are
server-only: never use a browser-exposed prefix and do not commit keys. On a
Sites/Cloudflare deployment, set the same variables in that platform's secret
store instead. **Redeploy after changing a value.**

| Variable | Kind | Value |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Secret | Stripe secret key (`sk_test_...` in test mode). Its presence is the dormancy switch: billing is live exactly when this is set. |
| `STRIPE_WEBHOOK_SECRET` | Secret | Signing secret (`whsec_...`) from the webhook endpoint below. |
| `STRIPE_PRICE_SUBSCRIPTION_MONTHLY` | Config | Monthly price ID (`price_...`). |
| `STRIPE_PRICE_SUBSCRIPTION_ANNUAL` | Config | Annual price ID (`price_...`). |
| `STRIPE_PRICE_LIFETIME` | Config | Lifetime one-time price ID (`price_...`). |
| `STORYPRESS_FREE_STORIES` | Config | Optional, default `3`. Self-started original stories ever per account; deletes never refund it, while translations and save-as-copies stay free. |

Dormant behavior while `STRIPE_SECRET_KEY` is absent:

- No story creation is gated and no checkout exists — a founder setup step
  must never block a writer.
- Checkout requests refuse cleanly (503, "Online payment is not connected
  yet. Your stories remain fully available.").
- The webhook fails closed: without a signing secret nothing is processed,
  and Stripe keeps retrying.

Removing `STRIPE_SECRET_KEY` and redeploying returns the deployment to the
same dormant state.

## Webhook endpoint

The worker verifies signatures itself (HMAC-SHA256 over
`<timestamp>.<raw body>`, constant-time compare, five-minute tolerance) and
writes entitlements idempotently — a redelivered event is acknowledged once
and changes nothing twice.

1. In the Stripe Dashboard, open **Webhooks** (Workbench) and create an event
   destination of type **Webhook endpoint**, choosing the **Snapshot** payload
   format — the classic event shape the handler parses.
2. Endpoint URL: `https://YOUR_DEPLOYMENT/api/stripe-webhook`.
3. Subscribe to exactly the events the handler reads:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
4. Reveal the signing secret (`whsec_...`), set it as
   `STRIPE_WEBHOOK_SECRET`, and redeploy.

There is no self-serve billing portal in v1: plan changes and cancellations
happen through you, in the Stripe Dashboard.

## What stays free

No entitlement code may touch these — on any plan, including after a downgrade:

- Every existing story: read, edit, revise, translate (in-studio, no new
  story row), download/print/export, share, delete.
- The `/s/<token>` shared reader and the `/i/<token>` guest tree end to end.
- Translated keepsakes and save-as-copies: derivatives never consume a story
  slot.
- The counter never decreases; deleting stories does not refund the
  allowance (verified by `scripts/check-billing.mjs`).

## Test-mode checkout round-trip

Sign in on the deployed URL and open the account modal. The upgrade panel
shows the plan state and "N of 3 free stories used".

1. **Gate before content:** on a free account at the cap, starting a new
   story shows the limit state with an Upgrade action — not a dead end —
   and everything already written stays fully usable.
2. **Subscription:** pay with a Stripe test card (for example
   `4242 4242 4242 4242`, any future expiry and CVC), once for monthly and
   once for annual. After each: the webhook event shows HTTP 2xx in the
   Dashboard, `storypress_entitlements` in Supabase has
   `plan='subscription'`, and the panel shows the active plan.
3. **Lifetime:** buy the one-time lifetime price; the plan flips to
   `lifetime` with no renewal.
4. **Webhook lag:** disable the webhook endpoint, pay, and return to the
   app. The banner must read as pending — never as a payment failure — and
   the app verifies the session server-side and flips the plan without the
   webhook. Re-enable the endpoint afterwards.
5. **Cancel:** cancel the test subscription in Stripe. At period end the
   plan returns to `free`, every story stays readable, editable, shareable
   and exportable, and only new creations re-meter.
6. **Past due:** use a card that declines on renewal (or a test clock) so
   the subscription turns `past_due`. Access continues in grace while
   Stripe retries the payment.
7. **Idempotency:** resend a delivered webhook event from the Dashboard;
   the entitlement row must not change twice.
8. **Languages:** repeat step 2 signed in under 中文 and Español — the limit
   state, upgrade panel and return banner are localized.

When the test-mode round-trip is green, switch the five Stripe variables to
live values and repeat steps 2, 3 and 5 on a real card before announcing the
paywall.

## Future video add-on (hook, not v1)

The entitlement `addons` column is a JSON array (default `'[]'`) reserved for
future one-time add-on unlocks — a video add-on would grant `["video"]`. No
schema change is needed: `scripts/check-billing.mjs` asserts the column
accepts `["video"]` and that a plan change never erases it. Selling it later
means one more one-time price in Stripe and granting the addon in the webhook
write — not a migration.

Honest limitation: today's client-side memory video (hidden behind
`STORYPRESS_VIDEO`, see [video](video.md)) is UI-gated only — a bypassed gate
costs nothing but the user's own render time. The server-enforceable parts of
a paid video tier are narration (a server AI step) and any storage; the
entitlement check belongs exactly there when a video delivery PR lands.

## Verification

```sh
npm ci
npm run typecheck
npm run build
node scripts/check-billing.mjs
node scripts/check-billing-webhook.mjs
node scripts/check-paywall.mjs
npm run build:vercel
npm run check:vercel
```

These cover the billing schema and reserve RPC against a real throwaway
PostgreSQL cluster, the webhook signature/idempotency path, and the rendered
client gates. They do not prove a live Stripe round-trip; run the test-mode
checklist above after connecting.

### Final gate run on the merged stack

Full suite recorded October 30, 2026 at the code state of `0ba57d5` on
`feat/paywall-operator-docs` (merged stack through PR #20; this commit adds
documentation only; sandbox Node 20.20.2, PostgreSQL 17):
`npm run typecheck`, `npm run build` (no worker-bundle drift), **every**
`scripts/check-*.mjs`, and `npm run check:vercel` after
`npm run build:vercel`. All green except:

- `check-email-auth` — known environmental failure, identical on clean
  main: supabase-js needs Node 22 native WebSocket and the sandbox runs
  Node 20. Environmental, not a regression; document and move on.
- `check-reader` — one transient failure on its very first invocation,
  then 22 consecutive passes including a full ordered re-run of the suite.
  Not reproducible; treated as a one-off on a reused sandbox.

Official references checked October 30, 2026:
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/checkout
