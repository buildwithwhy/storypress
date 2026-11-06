# Stripe billing setup

Storypress ships as freemium: three self-started stories per account, then
either a capped subscription (monthly $9.99 or annual $59 — up to 50 new
stories per calendar month) or a one-time story pack (30 credits for $12 or
100 credits for $29, never expiring) — per the approved wave-8 pricing spec
(November 6, 2026). The earlier lifetime unlock is retired: its Stripe
product stays archived and is never reused. Billing is **dormant by
default**: without `STRIPE_SECRET_KEY` nothing is gated, charged or
verified, and enabling it is an environment change, never a code change.
This runbook takes a founder with no context from an empty Stripe account
to a green test-mode checkout.

International cards only in v1: checkout needs an international card, so
mainland-China-local payment rails are out of scope. The entitlement schema
is payment-provider-agnostic, so a China-friendly rail could slot in later
without schema churn.

## Before you start

1. Apply the billing migrations if the Supabase project predates them —
   they create the entitlement, story-count, billing-event, monthly-draw
   and pack-grant tables (additive, service-role only). On an existing
   database, check migration state first and **do not rerun an
   already-applied migration** — see [Supabase setup](SUPABASE-SETUP.md) and
   [Vercel setup](VERCEL-SETUP.md).
2. A Stripe account. Work in **test mode** first; keys never enter the
   repository — server environment variables only.
3. The deployment's canonical origin. The webhook endpoint and the checkout
   return URL are both derived from it.

### Where the checkout origin comes from

The deployed checkout origin is an environment fact, derived from the
incoming request at runtime — no domain is hardcoded in code. Point the
webhook endpoint at whichever origin the deployment actually serves, and
repoint it when that origin changes. (`storypress.buildwithwhy.com` is a
planned name whose DNS is not configured; nothing in the app depends on
it.)

## Products and prices

Price **amounts live in Stripe products** and nowhere in the repository —
the code reads only price IDs from environment variables. Create the four
products in the Stripe Dashboard (test mode first):

| Product | Billing | Price | Price ID consumed by |
| --- | --- | --- | --- |
| Storypress subscription | Monthly recurring | $9.99 / month | `STRIPE_PRICE_SUBSCRIPTION_MONTHLY` |
| Storypress subscription | Yearly recurring | $59 / year | `STRIPE_PRICE_SUBSCRIPTION_ANNUAL` |
| Storypress 30-credit pack | One-time | $12 | `STRIPE_PRICE_PACK_30` |
| Storypress 100-credit pack | One-time | $29 | `STRIPE_PRICE_PACK_100` |

Copy the four `price_...` IDs; the configuration step below consumes them.
Leave the archived lifetime product archived — do not reuse it for a pack.

## Required configuration

Vercel → storypress-app → Settings → Environment Variables. These are
server-only: never use a browser-exposed prefix and do not commit keys. On a
Sites/Cloudflare deployment, set the same variables in that platform's secret
store instead. **Redeploy after changing a value.**

| Variable | Kind | Value |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Secret | Stripe secret key (`sk_test_...` in test mode). Its presence is the dormancy switch: billing is live exactly when this is set. |
| `STRIPE_WEBHOOK_SECRET` | Secret | Signing secret (`whsec_...`) from the webhook endpoint below. |
| `STRIPE_PRICE_SUBSCRIPTION_MONTHLY` | Config | Monthly subscription price ID (`price_...`). |
| `STRIPE_PRICE_SUBSCRIPTION_ANNUAL` | Config | Annual subscription price ID (`price_...`). |
| `STRIPE_PRICE_PACK_30` | Config | 30-credit one-time pack price ID (`price_...`). |
| `STRIPE_PRICE_PACK_100` | Config | 100-credit one-time pack price ID (`price_...`). |
| `STORYPRESS_SUBSCRIPTION_MONTHLY_CAP` | Config | Optional, default `50`. New stories a subscriber may start per calendar month. |
| `STORYPRESS_PACK_30_CREDITS` | Config | Optional, default `30`. Credits granted by a 30-pack purchase. |
| `STORYPRESS_PACK_100_CREDITS` | Config | Optional, default `100`. Credits granted by a 100-pack purchase. |
| `STORYPRESS_FREE_STORIES` | Config | Optional, default `3`. Self-started original stories ever per account; deletes never refund it, while translations and save-as-copies stay free. This free quota is also the fallback a cap-exhausted subscriber draws on before pack credits. |

Repricing needs no code release: change the Stripe price, the cap, or a
pack-credit size, update the variable, redeploy. The webhook resolves pack
purchases through the price→credits mapping — `STRIPE_PRICE_PACK_30` maps
to `STORYPRESS_PACK_30_CREDITS` and `STRIPE_PRICE_PACK_100` to
`STORYPRESS_PACK_100_CREDITS` — so a pack grant always matches the price
actually paid, and a payment session matching neither pack price grants
nothing and never changes the plan.

### Cap semantics

A subscription entitles an account to up to `{cap}` (default 50) new
stories per **UTC calendar month**; the counter resets itself at each month
boundary. When the cap is reached, story creation falls back to the
account's unused free quota (3 lifetime stories), then to any pack credits;
pack credits never expire. A refused creation — cap hit, free quota gone,
no credits — consumes nothing: no counter moves, no credit is spent.
Refusals localize in the app by reason code, and the account panel shows
this month's usage against the cap and the remaining pack credits.

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
and changes nothing twice. Pack grants are idempotent per Checkout session,
so Stripe's two event IDs for one paid session
(`checkout.session.completed` and
`checkout.session.async_payment_succeeded`) still produce exactly one
grant.

1. In the Stripe Dashboard, open **Webhooks** (Workbench) and create an event
   destination of type **Webhook endpoint**, choosing the **Snapshot** payload
   format — the classic event shape the handler parses.
2. Endpoint URL: `https://YOUR_DEPLOYMENT/api/stripe-webhook` — the origin
   the deployment actually serves (see the origin note above).
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
  slot or a pack credit.
- The free counter never decreases; deleting stories does not refund the
  allowance (verified by `scripts/check-billing.mjs`).

## Safe testing: Preview environment only, never Production

Test keys must never enter the Production environment — with a test-mode
`STRIPE_SECRET_KEY` live there, anyone could buy a plan free with Stripe's
test card. Production stays dormant, uncharged and ungated: its
`STRIPE_SECRET_KEY` stays unset until you deliberately go live. All
payment testing happens on a Vercel Preview deployment:

1. **Get a stable preview URL.** Open the billing PR in GitHub and read the
   branch-preview URL from its Vercel check — it is stable across pushes of
   that branch. Never invent the URL; copy it from the check.
2. **Let Stripe reach the preview.** If Vercel Deployment Protection is on
   for previews, Stripe cannot pass the wall. In Vercel → Settings →
   Deployment Protection, enable **Protection Bypass for Automation**, copy
   the generated `x-vercel-protection-bypass` secret value, and give it to
   whoever configures the test webhook (or temporarily disable protection
   for previews).
3. **Paste test keys into the Preview environment only** (Vercel → Settings
   → Environment Variables, scope **Preview**, then redeploy the preview):
   - `STRIPE_SECRET_KEY` = `sk_test_...`
   - `STRIPE_WEBHOOK_SECRET` = the test webhook's `whsec_...`
   - The four `STRIPE_PRICE_...` IDs (same values as the Production config
     vars — price IDs are not secret).
4. **Point a test webhook at the preview.** In Stripe, create or repoint a
   test-mode webhook endpoint at `https://<preview-url>/api/stripe-webhook`
   with the five events listed above, supplying the
   `x-vercel-protection-bypass` header if protection bypass is in use.

### Test-mode checkout round-trip

Sign in on the preview URL and open the account modal. The upgrade panel
shows the plan state, this month's usage against the cap, and remaining
pack credits.

1. **Gate before content:** on a free account out of free stories, starting
   a new story shows the limit state with an Upgrade action — not a dead
   end — and everything already written stays fully usable.
2. **Subscription:** pay with a Stripe test card (for example
   `4242 4242 4242 4242`, any future expiry and CVC), once for monthly and
   once for annual. After each: the webhook event shows HTTP 2xx in the
   Dashboard, `storypress_entitlements` in Supabase has
   `plan='subscription'`, and the panel shows the active plan.
3. **Cap hit:** as a subscriber, create stories up to the monthly cap. The
   next attempt shows the localized cap message (pointing at packs) and
   consumes nothing; the account panel reads "used {cap} of {cap} this
   month". A new UTC calendar month resets the allowance.
4. **Free-quota fallback:** a cap-exhausted subscriber with unused free
   stories can still spend them before touching pack credits.
5. **Packs:** buy the 30-pack and the 100-pack. After each, the pack-grant
   row lands exactly once, the credit balance rises by the mapped size,
   the plan does not change, and a cap-exhausted account can create again
   — each creation decrementing the pack balance.
6. **Out of credits:** with cap, free quota and credits all exhausted, the
   blocked state shows the subscribe-or-pack message and nothing is
   consumed.
7. **Webhook lag:** disable the webhook endpoint, pay, and return to the
   app. The banner must read as pending — never as a payment failure — and
   the app verifies the session server-side and writes the entitlement or
   pack grant without the webhook. Re-enable the endpoint afterwards.
8. **Cancel:** cancel the test subscription in Stripe. At period end the
   plan returns to `free`, every story stays readable, editable, shareable
   and exportable, and only new creations re-meter.
9. **Past due:** use a card that declines on renewal (or a test clock) so
   the subscription turns `past_due`. Access continues in grace while
   Stripe retries the payment, capped at the same monthly allowance.
10. **Idempotent double-delivery:** resend a delivered webhook event from
    the Dashboard; the entitlement row and the pack balance must not
    change twice.
11. **Languages:** repeat the gate and purchase steps signed in under 中文
    and Español — the cap, out-of-credit and pack messages, upgrade panel
    and return banner are localized.

When the test-mode round-trip is green, switch the live variables in
Production (secret key, webhook secret, four price IDs) and repeat steps 2,
5 and 8 on a real card before announcing the paywall.

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

Official references checked November 6, 2026:
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/checkout
