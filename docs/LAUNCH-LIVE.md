# Going live with Stripe — launch morning runbook

This is the founder's checklist for switching billing from dormant to live on
**ours.hopperlace.ai**, in order, in one sitting. Every step is
founder-executed — the code needs nothing, and no step assumes anyone else
has access to Stripe or Vercel. Ground rules from the audit and
[Stripe setup](STRIPE-SETUP.md):

- Billing is dormant until `STRIPE_SECRET_KEY` exists in Production. Turning
  it on is an environment change, never a code change — and removing it (plus
  a redeploy) returns the app to the same dormant state.
- **Never paste a test-mode key into Production.** With a test
  `STRIPE_SECRET_KEY` live, anyone could buy a plan free with Stripe's test
  card. Before finishing step 4, look at the value: it must start `sk_live_`.
- The four price amounts live in Stripe products, nowhere in the repo — see
  the product table in [Stripe setup](STRIPE-SETUP.md), "Products and
  prices". The wave-8 pricing spec (Nov 6, 2026) fixed them there.

Budget roughly an hour, plus whatever Stripe's business-verification review
takes (see step 1).

---

## 1. Activate Stripe live mode

1. Sign in at dashboard.stripe.com. If the dashboard shows a "Test mode"
   toggle, the account already exists — turn **Test mode off**. If not,
   create the live account for **HOPPERLACE LTD** and select it.
2. Complete the business profile: legal entity name (HOPPERLACE LTD), address,
   tax ID, bank account for payouts, and the responsible-person details Stripe
   asks for. Live mode stays restricted until this is confirmed.
3. Expect Stripe to review the details before payouts enable. Checkout and
   webhooks can be set up (steps 2–4) while the review runs; do the real-card
   purchase in step 5 only after live payments are accepted.

## 2. Create the four live prices (same amounts as test mode)

In the Stripe Dashboard, in **live mode**, create four products — monthly,
annual, small pack, large pack — with exactly the test-mode amounts:

| Product | Billing | Amount |
| --- | --- | --- |
| Subscription | Monthly recurring | **$9.99 / month** (USD) |
| Subscription | Yearly recurring | **$59 / year** (USD) |
| 30-credit pack | One-time | **$12** (USD) |
| 100-credit pack | One-time | **$29** (USD) |

Where the amounts come from: the product table in
[`docs/STRIPE-SETUP.md`](STRIPE-SETUP.md) ("Products and prices"), which
records the wave-8 pricing spec of November 6, 2026. Compare each live price
against the corresponding test-mode product in the Stripe Dashboard (switch
the test-mode toggle back on to read them) before creating.

Copy the four live `price_...` IDs — step 4 consumes them. All four must be
USD: the pricing page labels everything with the subscription's currency.

## 3. Create the live webhook endpoint

1. In the Stripe Dashboard (live mode), open **Webhooks** and create an event
   destination of type **Webhook endpoint** with the **Snapshot** payload
   format — the classic event shape the handler parses.
2. Endpoint URL: `https://ours.hopperlace.ai/api/stripe-webhook`
   (exactly the path the worker mounts).
3. Subscribe to exactly the five events the handler acts on
   (`server/billing.ts`, `effectForEvent`):
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
4. Reveal the signing secret (`whsec_...`) and keep it for step 4. This is a
   **different secret from the test endpoint's** — the test one does not work.
5. If Vercel Deployment Protection is on for production domains, allow Stripe
   through (protection bypass header, or exclude the path) — otherwise the
   handler never receives events and fails closed with 503 while Stripe
   retries.

## 4. Set the Production environment variables, then redeploy

Vercel → storypress-app → Settings → Environment Variables, scope
**Production**. Six new values, all live-mode:

| Variable | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | Live secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from step 3 (`whsec_...`) |
| `STRIPE_PRICE_SUBSCRIPTION_MONTHLY` | Live monthly price ID (`price_...`) |
| `STRIPE_PRICE_SUBSCRIPTION_ANNUAL` | Live annual price ID (`price_...`) |
| `STRIPE_PRICE_PACK_30` | Live 30-pack price ID (`price_...`) |
| `STRIPE_PRICE_PACK_100` | Live 100-pack price ID (`price_...`) |

Notes:

- **`STRIPE_PUBLISHABLE_KEY` is not needed** — checkout is a server-minted
  redirect; the client never loads Stripe.js.
- The optional quota variables (`STORYPRESS_FREE_STORIES`,
  `STORYPRESS_SUBSCRIPTION_MONTHLY_CAP`, `STORYPRESS_PACK_30_CREDITS`,
  `STORYPRESS_PACK_100_CREDITS`) may stay unset — defaults are 3 / 50 / 30 /
  100.
- **Redeploy after saving** — env changes take effect only on a new
  deployment.
- Before you finish: eyes on `STRIPE_SECRET_KEY` — it must read `sk_live_...`,
  never `sk_test_...`.

## 5. One real purchase and one full refund

Use a real card and your own account. Do both checks before announcing.

**Purchase (recommend the 30-credit pack — smallest real spend):**

1. Buy on ours.hopperlace.ai, complete payment with a real card.
2. In Stripe: the payment appears, and the webhook event for the checkout
   shows HTTP 2xx in the Dashboard.
3. In the app: the account panel shows the credit balance up by 30 (or the
   plan active, for a subscription purchase), and a capped/locked account can
   create stories again.
4. In Supabase: exactly one new pack-grant row for the checkout session, and
   one new ledger/billing-event entry. A redelivered event must not create a
   second grant — if you want to prove it, resend the event from the Stripe
   Dashboard and re-check the balance.
5. **Refund it in full** from the Stripe payment detail page. Then check:
   the refund shows in Stripe, and nothing in the app breaks — the ledger
   keeps the original grant (refunds are not clawed back by design; confirm
   the account still reads correctly and no error appears).

**If you bought a subscription instead:** cancel at period end in step 6's
portal (or Stripe) and confirm the plan returns to free while every story
stays readable.

## 6. Customer Portal check (conditional)

Conditional: this applies only if the billing-portal PR merges — the audit
found **no portal code today** (no `portal` action in the billing API, no
manage-billing link). If it has not merged, skip this step and note that
cancellations and card changes run through you in the Stripe Dashboard.

1. In Stripe (live mode), open **Customer portal** settings and configure:
   customers may **cancel at period end**, **update their card**, and **view
   invoices**. Nothing else needs enabling.
2. In the app, open the account panel and use the Manage-billing link: it
   must open the Stripe Customer Portal on your subscription.

---

## Rollback

Remove `STRIPE_SECRET_KEY` from the Production environment variables and
redeploy. Billing returns to the exact dormant state: no gating, no checkout
(503 with a clean message), webhook fails closed. The four price IDs and the
webhook secret can stay set — only the secret key's presence is the switch.
Live customers are unaffected in Stripe itself; any purchase made before the
rollback keeps its grant.

## Post-launch cleanup (once live is verified)

- **Verify PR #56 is closed.** It was already closed on November 11 — confirm
  on GitHub, do not reopen it.
- Optionally delete the branch `chore/preview-stripe-live-test` — it has
  served its purpose.
- Delete the **Vercel Protection Bypass secret** (Settings → Deployment
  Protection): it existed so the test webhook could reach protected previews,
  and it should not outlive test mode.
- Delete the **Preview-only Stripe environment variables** (`sk_test_...`
  secret key, test webhook secret, test price IDs) once live is verified and
  no more test-mode checking is planned — test keys have no business in any
  shared environment.
