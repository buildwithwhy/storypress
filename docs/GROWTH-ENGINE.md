# Growth engine events

Once & Ours can report its funnel to the Hopperlace Growth Engine, which
compares ad spend with what visitors actually do. This is **off by default**.
Nothing is loaded and nothing is sent until the founder sets the environment
variables below herself. Removing them and redeploying turns it off again.

## What is sent, and when

| Step | Engine stage | Where it fires | Sent by |
| --- | --- | --- | --- |
| `landing_view` | view | The SDK's own automatic view, when a visitor lands on `/` or `/pricing` (a fresh landing, not a return from Stripe, Google or an email sign-in link) | Browser SDK |
| `signup` | start | An account's first sign-in (`lib/account-client.ts`: page load after a Google or email-link return, or the in-page email code) | Browser SDK |
| `story_completed` | activate | A newspaper is written from the narrator's own words (not the sample) (`app/storypress.tsx`, `makePaper`) | Browser SDK |
| `checkout_opened` | checkout | Stripe has created the Checkout Session, just before the redirect (`lib/billing-client.ts`, `startCheckout`) | Browser SDK |
| `purchase` | purchase | Verified webhook: the first subscription checkout, or an account's first story pack | Server (`server/growth.ts`) |
| `renewal` | repeat | Verified webhook: `invoice.paid` with `billing_reason=subscription_cycle`, or a second (or later) story pack | Server (`server/growth.ts`) |

Browser steps are sent at most once per step, per tab, per day, so re-renders
and a second story on the same day do not inflate the counts.

Money events never come from the browser. `purchase` and `renewal` are sent
only from `POST /api/stripe-webhook`, after the Stripe signature has been
verified, the event has been claimed (a redelivery sends nothing), the
terms-of-service gate has passed, and the entitlement or pack grant has been
written. The first invoice of a new subscription (`subscription_create`) is
not sent, because its checkout has already counted the purchase. Subscription
updates and cancellations are not money events.

### The server event

One event per webhook, sent as a JSON batch to the engine's `POST /v1/events`:

```json
[{
  "event_id": "evt_... (the Stripe event id, so retries are idempotent)",
  "client": "once-and-ours",
  "stage": "purchase",
  "step": "purchase",
  "occurred_at": "Stripe's event time, ISO 8601",
  "value": { "amount_minor": 999, "currency": "USD" },
  "attribution": { "utm_source": "...", "utm_campaign": "..." },
  "source": "webhook"
}]
```

- `value` is Stripe's `amount_total` (checkout) or `amount_paid` (invoice) in
  minor units, with Stripe's currency upper-cased. It is left out if Stripe
  did not report one; nothing is estimated.
- `attribution` is included only when the checkout carried UTMs (below).
- The body is signed with HMAC-SHA256 over the exact bytes sent, in the
  header `X-Growth-Signature: sha256=<hex>`, the scheme the engine verifies.

### Attribution

When the growth engine is configured, the browser remembers the landing
page's `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`,
`utm_id`, `platform` and `placement` in that tab's `sessionStorage`.
`startCheckout` sends them with the checkout request, and the server copies
the cleaned values into the Checkout Session's `metadata` (and, for a
subscription, `subscription_data.metadata`, so renewal invoices keep them).
Only those eight keys are kept: values are trimmed and capped at 200
characters, and any value containing `@` is dropped. Without the growth
engine the checkout request is unchanged.

## Privacy

- No cookies and no third-party pixels. The SDK is the engine's own
  first-party script. It keeps a random session id, rotated daily, in
  `sessionStorage`, and the engine stores only a salted hash of it.
- No personal data. Browser events carry only the step name. Server events
  carry only the fields shown above. Never an email, name, phone, user id,
  Stripe customer id, story content or IP. The engine also refuses any
  payload with such fields.
- The owner id is used on the server only to look up earlier pack grants (to
  tell a first pack from a second one). It is never sent.
- Failure logs carry the Stripe event id and an HTTP status only.
- **Consent:** the app has no analytics consent banner today, so there is no
  existing consent setting for the SDK to follow. It loads whenever
  `GROWTH_SDK_URL` is set. Review the privacy page wording, and decide
  whether a consent step is needed, before you turn it on.

## Reliability

The webhook's answer to Stripe never depends on the engine. The send happens
only after the billing effect has been written. Every error is caught and
logged. The engine request times out after 2.5 seconds, and the webhook waits
at most 3 seconds for it before answering. It waits briefly rather than
returning at once because serverless runtimes may freeze work that is still
running after the response. If the engine is down, refuses the event, or
hangs, the webhook still returns 200. That event is not retried: the engine
can be reconciled against Stripe later.

## Environment variables

Set these in Vercel → Settings → Environment Variables (or the Sites secret
store), then **redeploy**. Never commit a value.

| Variable | Kind | Value |
| --- | --- | --- |
| `GROWTH_SDK_URL` | Config | `https://growth.hopperlace.ai/sdk.js`. This is the app's equivalent of a public variable: the server passes it to the browser through the `GET /api/story` services payload, the same way as the share-image credit URL. `?client=once-and-ours` is added automatically. Must be https. |
| `GROWTH_INGEST_URL` | Config | `https://growth.hopperlace.ai` (the `/v1/events` path is added; the full events URL also works). Must be https. |
| `GROWTH_INGEST_HMAC` | Secret | This client's ingest secret. It must equal the engine's `INGEST_HMAC_ONCE_AND_OURS` worker secret. Server-only: never use a browser-exposed prefix. |

The founder sets all three herself. Nothing is sent until they are set:

- No `GROWTH_SDK_URL`: no script is loaded, no browser event is sent, no UTMs
  are stored or added to checkout, and the services payload is unchanged.
- No `GROWTH_INGEST_URL` or no `GROWTH_INGEST_HMAC`: the webhook makes no
  extra request and behaves exactly as before.

The engine must also accept events for this client. In its
`clients/once-and-ours.json`, `ingest.mode` must not be `"none"` (with
`"none"` the engine answers 403 to everything). Its `stage_map` already
covers the six steps above.

## Verification

```sh
npm run build
node scripts/check-growth.mjs
```

The check re-implements the engine's signature verifier and personal-field
rejection and runs the webhook through the bundled worker with every upstream
mocked. It covers the signature, the purchase and renewal mapping, UTM
metadata at checkout, dormancy while unset, and a 200 from the webhook when
the engine is down, refusing or hanging. It does not prove a live round trip.
After setting the variables on a Preview deployment, make one test-mode
purchase and confirm the event appears in the engine's report for that day.
