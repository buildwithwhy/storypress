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

-- Race-safe story reservation: the server calls this once per new self-started
-- story (never for translations, save-as-copies, revisions, or deletes) and
-- refuses past the free allowance. Mirrors storypress_reserve_ai: security
-- definer, transaction advisory lock, input validation, service_role-only
-- execution. The free allowance is a parameter (default 3) so the server can
-- pass its STORYPRESS_FREE_STORIES env without schema churn. Entitlement is
-- read from plan alone: past_due keeps grace access, cancellation flips plan
-- to 'free' at period end. The counter increments on every success, entitled
-- or not, and never decrements.
create function public.storypress_reserve_story(p_user uuid,p_limit integer default 3)
returns table(ok boolean,reason text) language plpgsql security definer set search_path = '' as $$
begin
 if p_user is null or p_limit is null or p_limit<0 then raise exception 'Invalid reservation'; end if;
 if not exists(select 1 from auth.users where id=p_user) then raise exception 'Unknown account'; end if;
 perform pg_catalog.pg_advisory_xact_lock(1937010529);
 insert into public.storypress_story_counts(owner_id,stories_created) values(p_user,0) on conflict(owner_id) do nothing;
 if exists(select 1 from public.storypress_entitlements where owner_id=p_user and plan in ('subscription','lifetime')) then
  update public.storypress_story_counts set stories_created=stories_created+1 where owner_id=p_user;
  return query select true,'entitled';
 elsif (select stories_created from public.storypress_story_counts where owner_id=p_user)>=p_limit then
  return query select false,'limit';
 else
  update public.storypress_story_counts set stories_created=stories_created+1 where owner_id=p_user;
  return query select true,'free';
 end if;
end $$;
revoke all on function public.storypress_reserve_story(uuid,integer) from public,anon,authenticated;
grant execute on function public.storypress_reserve_story(uuid,integer) to service_role;
commit;
