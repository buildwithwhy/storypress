-- Apply to a dedicated Supabase project. Server-only writes; no public draft reads.
begin;
create table public.storypress_stories (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null,
 data jsonb not null check (octet_length(data::text) <= 2200000),
 revision integer not null default 1 check (revision > 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 share_token text unique check (share_token ~ '^[a-f0-9]{64}$'),
 edition jsonb,
 check ((share_token is null) = (edition is null))
);
create index storypress_stories_owner on public.storypress_stories(owner_id, updated_at desc);
alter table public.storypress_stories enable row level security;
revoke all on public.storypress_stories from public, anon, authenticated;
grant select on public.storypress_stories to authenticated;
create policy storypress_owner_read on public.storypress_stories for select to authenticated using ((select auth.uid()) = owner_id);
grant all on public.storypress_stories to service_role;

create table public.storypress_ai_usage (
 scope text primary key,
 units integer not null check (units >= 0)
);
alter table public.storypress_ai_usage enable row level security;
revoke all on public.storypress_ai_usage from public, anon, authenticated;
grant all on public.storypress_ai_usage to service_role;

-- Transaction + a shared advisory lock enforce both caps under concurrency.
-- Only the trusted backend may reserve; callers cannot choose another user or reset usage.
create function public.storypress_reserve_ai(p_user uuid,p_action text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
 day_key text := to_char(now() at time zone 'UTC','YYYY-MM-DD');
 site_key text; user_key text; cost integer; site_used integer; user_used integer;
begin
 if p_user is null or p_action is null or p_action not in ('interview','transcribe','discover','write') then raise exception 'Invalid reservation'; end if;
 if not exists(select 1 from auth.users where id=p_user) then raise exception 'Unknown account'; end if;
 cost := case when p_action='discover' then 3 else 1 end;
 site_key := 'site:'||day_key; user_key := 'user:'||p_user::text||':'||day_key;
 perform pg_catalog.pg_advisory_xact_lock(1937010528);
 select coalesce((select units from public.storypress_ai_usage where scope=site_key),0) into site_used;
 select coalesce((select units from public.storypress_ai_usage where scope=user_key),0) into user_used;
 if site_used+cost>400 or user_used+cost>40 then return false; end if;
 insert into public.storypress_ai_usage(scope,units) values(site_key,cost),(user_key,cost)
 on conflict(scope) do update set units=public.storypress_ai_usage.units+excluded.units;
 return true;
end $$;
revoke all on function public.storypress_reserve_ai(uuid,text) from public,anon,authenticated;
grant execute on function public.storypress_reserve_ai(uuid,text) to service_role;
commit;
