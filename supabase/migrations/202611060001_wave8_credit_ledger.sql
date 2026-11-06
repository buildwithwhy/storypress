-- Wave 8 pricing §1: capped-subscription window ledger and pack credit ledger,
-- plus the superseding reserve RPC with the founder-fixed draw order:
-- subscription within the calendar-month cap → free quota → pack credits.
-- Additive only: new tables, and the RPC is replaced by a three-argument
-- version (the old two-argument signature is dropped below). The
-- entitlements CHECK keeps allowing 'lifetime' so legacy rows stay readable
-- and entitled — no constraint surgery, no grandfather flags. Only the
-- trusted backend may read or write (service_role); no RLS grants exist for
-- anon or authenticated users.
begin;

-- One row per owner per UTC calendar month: how many new stories the
-- subscription allowance has drawn. The window resets itself when a new
-- month's row is created — no scheduled job, no reset webhook. This ledger
-- meters only the subscription pool; the free counter keeps its own semantics.
create table public.storypress_subscription_draws (
  owner_id uuid not null references auth.users(id) on delete cascade,
  period_month date not null,
  stories_created integer not null default 0 check (stories_created >= 0),
  primary key (owner_id, period_month)
);
alter table public.storypress_subscription_draws enable row level security;
revoke all on public.storypress_subscription_draws from public, anon, authenticated;
grant all on public.storypress_subscription_draws to service_role;

-- Pack purchases: one row per paid checkout session. checkout_session_id is
-- the primary key — Stripe can emit several event ids for the same session
-- (checkout.session.completed plus async_payment_succeeded, and redeliveries
-- of each), so the grant must be exactly-once per session, not per event.
-- Credits never expire: no expiry columns.
create table public.storypress_pack_grants (
  owner_id uuid not null references auth.users(id) on delete cascade,
  checkout_session_id text not null primary key,
  credits integer not null check (credits > 0),
  granted_at timestamptz not null default now()
);
alter table public.storypress_pack_grants enable row level security;
revoke all on public.storypress_pack_grants from public, anon, authenticated;
grant all on public.storypress_pack_grants to service_role;

-- Pack consumption: one row per credit a reserve draw consumed, written in
-- the same advisory-locked transaction as the draw itself, so the balance
-- (granted credits minus these rows) can never go negative under parallelism.
create table public.storypress_pack_draws (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  drawn_at timestamptz not null default now()
);
alter table public.storypress_pack_draws enable row level security;
revoke all on public.storypress_pack_draws from public, anon, authenticated;
grant all on public.storypress_pack_draws to service_role;

-- Race-safe story reservation v2 (supersedes the two-argument wave-7 version,
-- dropped below). Mirrors the original's conventions: security definer,
-- locked search_path, the same per-transaction advisory lock, input
-- validation, service_role-only execution. The free allowance and the
-- subscription cap are parameters (defaults 3 and 50) so the server passes
-- its env values per call — tuning never needs a migration. Draw order is
-- founder-fixed: subscription within the monthly cap, then the free quota
-- (the lifetime-3 counter, the same pool for every plan), then pack credits.
-- Refusals return a distinct reason and consume nothing. Entitlement is read
-- from plan alone: past_due keeps grace access (capped), cancellation flips
-- plan to 'free' at period end, and legacy 'lifetime' rows stay unlimited.
create or replace function public.storypress_reserve_story(p_user uuid,p_limit integer default 3,p_cap integer default 50)
returns table(ok boolean,reason text) language plpgsql security definer set search_path = '' as $$
begin
 if p_user is null or p_limit is null or p_limit<0 or p_cap is null or p_cap<0 then raise exception 'Invalid reservation'; end if;
 if not exists(select 1 from auth.users where id=p_user) then raise exception 'Unknown account'; end if;
 perform pg_catalog.pg_advisory_xact_lock(1937010529);
 insert into public.storypress_story_counts(owner_id,stories_created) values(p_user,0) on conflict(owner_id) do nothing;
 -- Legacy lifetime rows keep their entitled treatment: unlimited, outside the
 -- window ledger (grandfathered; the CHECK constraint still allows the value).
 if exists(select 1 from public.storypress_entitlements where owner_id=p_user and plan='lifetime') then
  update public.storypress_story_counts set stories_created=stories_created+1 where owner_id=p_user;
  return query select true,'entitled';
  return;
 end if;
 -- 1. Active subscription draws within the UTC calendar-month cap. A window
 -- draw touches only the window: each ledger meters its own pool.
 if exists(select 1 from public.storypress_entitlements where owner_id=p_user and plan='subscription') then
  if coalesce((select stories_created from public.storypress_subscription_draws where owner_id=p_user and period_month=pg_catalog.date_trunc('month',pg_catalog.now() at time zone 'utc')::date),0)<p_cap then
   insert into public.storypress_subscription_draws(owner_id,period_month,stories_created) values(p_user,pg_catalog.date_trunc('month',pg_catalog.now() at time zone 'utc')::date,1)
    on conflict(owner_id,period_month) do update set stories_created=public.storypress_subscription_draws.stories_created+1;
   return query select true,'subscription';
   return;
  end if;
 end if;
 -- 2. Free quota: the lifetime-3 counter, unchanged semantics — a
 -- cap-exhausted subscriber can still spend their unused free stories.
 if (select stories_created from public.storypress_story_counts where owner_id=p_user)<p_limit then
  update public.storypress_story_counts set stories_created=stories_created+1 where owner_id=p_user;
  return query select true,'free';
  return;
 end if;
 -- 3. Pack credits: granted minus consumed, the draw row landing in this same
 -- locked transaction; credits never expire.
 if (select coalesce(sum(credits),0) from public.storypress_pack_grants where owner_id=p_user)>(select count(*) from public.storypress_pack_draws where owner_id=p_user) then
  insert into public.storypress_pack_draws(owner_id) values(p_user);
  return query select true,'pack';
  return;
 end if;
 -- Blocked: distinct reasons, nothing consumed. A subscriber's binding
 -- constraint is the monthly cap (a pack is the upsell); a pack holder out
 -- of draws is out of credits; anyone else is out of free stories.
 if exists(select 1 from public.storypress_entitlements where owner_id=p_user and plan='subscription') then
  return query select false,'cap';
 elsif exists(select 1 from public.storypress_pack_grants where owner_id=p_user) then
  return query select false,'no_credits';
 else
  return query select false,'limit';
 end if;
end $$;
revoke all on function public.storypress_reserve_story(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.storypress_reserve_story(uuid,integer,integer) to service_role;
drop function public.storypress_reserve_story(uuid,integer);
commit;
