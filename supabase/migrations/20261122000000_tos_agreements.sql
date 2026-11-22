-- Wave 9 (founder order, Nov 22): durable record of each buyer's terms-of-
-- service agreement from Stripe Checkout consent_collection. One row per paid
-- checkout session — checkout_session_id is the primary key, so the webhook
-- and the status rescue (and redeliveries of either event type) converge on a
-- single row per session, the same idempotent ledger pattern as the pack
-- grants table. Only the accepted state is ever written: the server fails
-- closed on 'not_accepted' or absent consent and provisions nothing, so no
-- refusal row can exist. Additive only: a new table, no changes to existing
-- tables or constraints. Only the trusted backend may read or write
-- (service_role); no RLS grants exist for anon or authenticated users.
begin;

create table public.storypress_tos_agreements (
  owner_id uuid not null references auth.users(id) on delete cascade,
  checkout_session_id text not null primary key,
  terms_of_service text not null check (terms_of_service = 'accepted'),
  agreed_at timestamptz not null default now()
);
alter table public.storypress_tos_agreements enable row level security;
revoke all on public.storypress_tos_agreements from public, anon, authenticated;
grant all on public.storypress_tos_agreements to service_role;

commit;
