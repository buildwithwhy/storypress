-- Wave 9 §: refund adjustments ledger and the superseding reserve RPC (v3).
-- A charge.refunded webhook removes a refunded pack grant's UNUSED credits and
-- records the removal here as one negative-credit row per Stripe refund.
--
-- Owner-level clamp rule: pack draws are one row per consumed credit and are
-- NOT attributed to individual grants, so "unused credits of the refunded
-- pack" is not directly computable per grant. The removal is therefore clamped
-- at the owner level: credits_removed = min(refund_amount_in_credits, owner's
-- unused balance) where owner's unused balance = max(0, sum(pack_grants.credits)
-- - count(pack_draws)). An owner who already spent the whole purchase records
-- a removal of zero — nothing is written and usage history stays honest.
--
-- Partial-refund pro-rata rule: Stripe emits one charge.refunded event per
-- partial refund (amount_refunded < amount, refunded=false). A partial refund
-- of a grant removes floor(grant.credits x amount_refunded / charge.amount),
-- then clamped by the owner-level balance above. Each partial refund keys its
-- row on the Stripe refund id (re_...), so re-emitted events and
-- refunded-again charges can never double-remove: refund_id is the primary key
-- and the webhook inserts with on_conflict=refund_id / ignore-duplicates.
--
-- Additive only: a new table and a create-or-replace of the three-argument
-- reserve RPC (the wave-8 v2 signature is kept — its pack-pool gate now
-- subtracts adjustments so refunded credits stop being spendable at
-- reservation time, not just in the display). Only the trusted backend may
-- read or write (service_role); no RLS policies exist for anon or
-- authenticated users.
begin;

create table public.storypress_pack_adjustments (
  refund_id text not null primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  checkout_session_id text not null,
  credits integer not null check (credits < 0),
  adjusted_at timestamptz not null default now()
);
alter table public.storypress_pack_adjustments enable row level security;
revoke all on public.storypress_pack_adjustments from public, anon, authenticated;
grant all on public.storypress_pack_adjustments to service_role;

-- Race-safe story reservation v3 (supersedes the wave-8 v2 body in place —
-- same signature, same conventions: security definer, locked search_path, the
-- same per-transaction advisory lock, input validation, service_role-only
-- execution, founder-fixed draw order: subscription within the monthly cap,
-- then the free quota, then pack credits. Refusals keep their distinct
-- reasons (cap / limit / no_credits) and consume nothing. The only change is
-- step 3's pool: granted credits plus refund adjustments (negative) minus
-- consumed draws must be strictly positive for a pack draw to land.
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
 -- 3. Pack credits: granted plus refund adjustments (negative rows) minus
 -- consumed, the draw row landing in this same locked transaction; credits
 -- never expire. Adjustments join the gate here so a refunded credit cannot
 -- still be spent at reservation time.
 if (select coalesce(sum(credits),0) from public.storypress_pack_grants where owner_id=p_user)
   +(select coalesce(sum(credits),0) from public.storypress_pack_adjustments where owner_id=p_user)
   >(select count(*) from public.storypress_pack_draws where owner_id=p_user) then
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
commit;
