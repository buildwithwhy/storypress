-- Billing entitlements, story counters, and webhook idempotency (paywall spec §1).
-- Additive only: no existing table, column, or type changes.
-- Ships dormant: nothing reads these tables until Stripe is configured; enforcement
-- wiring lands in a later billing PR. Only the trusted backend may read or write
-- (service_role); no RLS grants exist for anon or authenticated users.
begin;

-- One entitlement row per owner. The plan column is the lifecycle state machine the
-- server reads: 'free' meters against the story counter, 'subscription' and 'lifetime'
-- are unlimited. subscription_status ('active'|'past_due'|'canceled'|'incomplete') is
-- advisory bookkeeping written by webhooks; past_due keeps access as a grace period.
create table public.storypress_entitlements (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','subscription','lifetime')),
  stripe_customer_id text unique,
  subscription_status text,
  current_period_end timestamptz,
  addons text not null default '[]',
  updated_at timestamptz not null default now()
);
alter table public.storypress_entitlements enable row level security;
revoke all on public.storypress_entitlements from public, anon, authenticated;
grant all on public.storypress_entitlements to service_role;

-- Lifetime creation counter per owner. Monotonic: the only mutation is increment;
-- deletes of stories never decrement it, so delete-then-recreate cannot reset the cap.
create table public.storypress_story_counts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  stories_created integer not null default 0 check (stories_created >= 0)
);
alter table public.storypress_story_counts enable row level security;
revoke all on public.storypress_story_counts from public, anon, authenticated;
grant all on public.storypress_story_counts to service_role;

-- Stripe webhook idempotency: event.id primary key makes redeliveries no-ops.
create table public.storypress_billing_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);
alter table public.storypress_billing_events enable row level security;
revoke all on public.storypress_billing_events from public, anon, authenticated;
grant all on public.storypress_billing_events to service_role;

commit;
