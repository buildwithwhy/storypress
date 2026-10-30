-- Contributor invites and pending contributions (see docs/PRODUCT-BRIEF.md).
-- Additive only: no existing table, column, or type changes.
-- Guests never touch these tables: invite tokens are capabilities honored by the
-- trusted backend (service_role); no RLS grants exist for anon or authenticated guests.
begin;

create table public.storypress_invites (
 id uuid primary key default gen_random_uuid(),
 story_id uuid not null references public.storypress_stories(id) on delete cascade,
 token text not null unique check (token ~ '^[a-f0-9]{64}$'),
 question text not null,
 status text not null default 'open' check (status in ('open','revoked','expired')),
 created_by uuid not null references auth.users(id),
 expires_at timestamptz not null default now() + interval '30 days',
 created_at timestamptz not null default now()
);
create index storypress_invites_story on public.storypress_invites(story_id, status);
alter table public.storypress_invites enable row level security;
revoke all on public.storypress_invites from public, anon, authenticated;
grant all on public.storypress_invites to service_role;

create table public.storypress_contributions (
 id uuid primary key default gen_random_uuid(),
 story_id uuid not null references public.storypress_stories(id) on delete cascade,
 invite_id uuid references public.storypress_invites(id),
 author_label text not null,
 contributor_user_id uuid references auth.users(id),
 turns jsonb not null check (octet_length(turns::text) <= 50000),
 status text not null default 'pending' check (status in ('pending','approved','declined')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz
);
create index storypress_contributions_story on public.storypress_contributions(story_id, status);
alter table public.storypress_contributions enable row level security;
revoke all on public.storypress_contributions from public, anon, authenticated;
grant all on public.storypress_contributions to service_role;

commit;
