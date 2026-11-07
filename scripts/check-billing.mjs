// Billing schema and reserve-RPC checks against a real, throwaway Postgres cluster.
// Provisions initdb/pg_ctl in a temp dir (no root, no Docker), stubs the Supabase
// environment (auth.users, anon/authenticated/service_role roles), applies every
// migration in order, then asserts schema shape, ACLs, RPC behavior, parallel-race
// semantics, counter monotonicity, and the PR-1 dormancy rule. Requires a local
// PostgreSQL install (apt-get install postgresql) providing initdb/psql.
import assert from 'node:assert/strict';
import {execFileSync, spawn, spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const port = Number(process.env.CHECK_BILLING_PORT || 55432);
const binDir = process.env.PGBIN || (existsSync('/usr/lib/postgresql')
  ? readdirSync('/usr/lib/postgresql').map(v => join('/usr/lib/postgresql', v, 'bin')).find(d => existsSync(join(d, 'initdb')))
  : undefined);
assert.ok(binDir && existsSync(join(binDir, 'initdb')), 'Local PostgreSQL is required for check-billing: install it (apt-get install postgresql) or set PGBIN to its bin directory');
const bin = name => join(binDir, name);
const work = mkdtempSync(join(tmpdir(), 'storypress-billing-'));
const socket = work, log = join(work, 'pg.log');
const user = '11111111-1111-4111-8111-111111111111', mate = '22222222-2222-4222-8222-222222222222';
const free = '33333333-3333-4333-8333-333333333333', paid = '44444444-4444-4444-8444-444444444444', addon = '55555555-5555-4555-8555-555555555555';
const sub = '66666666-6666-4666-8666-666666666666', pack = '77777777-7777-4777-8777-777777777777';
const sub2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', pack2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let down = false;
const stop = () => { if (!down) { down = true; try { execFileSync(bin('pg_ctl'), ['-D', join(work, 'pgdata'), '-o', `-p ${port} -k ${socket}`, 'stop', '-m', 'fast'], {stdio: 'ignore'}); } catch {} rmSync(work, {recursive: true, force: true}); } };
process.on('exit', stop); process.on('SIGINT', () => process.exit(1)); process.on('SIGTERM', () => process.exit(1));
try {
  execFileSync(bin('initdb'), ['-A', 'trust', '-U', 'postgres', '-D', join(work, 'pgdata')], {stdio: 'ignore'});
  execFileSync(bin('pg_ctl'), ['-D', join(work, 'pgdata'), '-o', `-p ${port} -k ${socket}`, '-l', log, '-w', 'start'], {stdio: 'ignore'});
  const psql = (sql, ...args) => execFileSync(bin('psql'), ['-h', socket, '-p', String(port), '-U', 'postgres', '-d', 'billtest', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], ...args).toString().trim();
  const failing = sql => { const run = spawnSync(bin('psql'), ['-h', socket, '-p', String(port), '-U', 'postgres', '-d', 'billtest', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], {encoding: 'utf8'}); if (run.status !== 0) return run.stderr; throw new Error(`Expected failure, statement succeeded: ${sql}`); };
  const rows = sql => psql(sql).toString().split('\n').filter(Boolean);

  // Fresh database with the Supabase-shaped stubs the migrations assume.
  execFileSync(bin('psql'), ['-h', socket, '-p', String(port), '-U', 'postgres', '-c', 'drop database if exists billtest;', '-c', 'create database billtest;'], {stdio: 'ignore'});
  psql(`do $$ begin
    if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin; end if;
  end $$;`);
  psql(`create schema if not exists auth; create table if not exists auth.users(id uuid primary key, email text);
    create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
  for (const file of ['202610110001_storypress.sql', '202610300001_contributions.sql', '202610300002_billing.sql', '202611060001_wave8_credit_ledger.sql'])
    execFileSync(bin('psql'), ['-h', socket, '-p', String(port), '-U', 'postgres', '-d', 'billtest', '-v', 'ON_ERROR_STOP=1', '-q', '-f', join('supabase', 'migrations', file)], {stdio: 'pipe'});
  psql(`insert into auth.users(id) values('${user}'),('${mate}'),('${free}'),('${paid}'),('${addon}'),('${sub}'),('${pack}'),('${sub2}'),('${pack2}');`);

  // Schema shape: RLS everywhere, zero policies, service-role-only access.
  for (const table of ['storypress_entitlements', 'storypress_story_counts', 'storypress_billing_events', 'storypress_subscription_draws', 'storypress_pack_grants', 'storypress_pack_draws']) {
    assert.equal(psql(`select relrowsecurity from pg_class where relname='${table}'`), 't', `${table} must enable RLS`);
    assert.equal(psql(`select count(*) from pg_policies where schemaname='public' and tablename='${table}'`), '0', `${table} must have no policies`);
    assert.equal(psql(`select has_table_privilege('authenticated','public.${table}','select')`), 'f', `authenticated must not read ${table}`);
    assert.equal(psql(`select has_table_privilege('authenticated','public.${table}','insert')`), 'f', `authenticated must not write ${table}`);
    assert.equal(psql(`select has_table_privilege('service_role','public.${table}','insert')`), 't', `service_role must write ${table}`);
  }
  assert.equal(psql(`select column_default from information_schema.columns where table_name='storypress_entitlements' and column_name='addons'`), `'[]'::text`, 'addons defaults to an empty JSON array');
  assert.ok(failing(`insert into public.storypress_entitlements(owner_id,plan) values('${user}','pro')`).includes('violates check constraint'), 'plan is constrained to free|subscription|lifetime');
  assert.ok(failing(`insert into public.storypress_story_counts(owner_id,stories_created) values('${user}',-1)`).includes('violates check constraint'), 'counter cannot go negative');
  psql(`insert into public.storypress_billing_events(event_id) values('evt_1');`);
  assert.ok(failing(`insert into public.storypress_billing_events(event_id) values('evt_1')`).includes('duplicate key'), 'event_id is a primary key so webhook redeliveries collide');
  psql(`delete from public.storypress_billing_events where event_id='evt_1';`);

  // Wave 8 pack ledger shape: checkout_session_id is the grant's primary key
  // (Stripe can emit several event ids for one paid session, so session-level
  // uniqueness is the exactly-once guarantee), and a pack always carries at
  // least one credit — credits never expire, so there is no expiry column.
  psql(`insert into public.storypress_pack_grants(owner_id,checkout_session_id,credits) values('${pack}','cs_shape',30);`);
  assert.ok(failing(`insert into public.storypress_pack_grants(owner_id,checkout_session_id,credits) values('${pack}','cs_shape',30)`).includes('duplicate key'), 'checkout_session_id is unique so a reprocessed session cannot double-grant');
  assert.ok(failing(`insert into public.storypress_pack_grants(owner_id,checkout_session_id,credits) values('${pack}','cs_shape_zero',0)`).includes('violates check constraint'), 'a pack grant carries at least one credit');
  assert.ok(failing(`insert into public.storypress_subscription_draws(owner_id,period_month,stories_created) values('${pack}',pg_catalog.date_trunc('month',pg_catalog.now() at time zone 'utc')::date,-1)`).includes('violates check constraint'), 'the window ledger cannot go negative');
  psql(`delete from public.storypress_pack_grants where checkout_session_id='cs_shape';`);

  // Video add-on hook (paywall §6): the addons column accepts a JSON array
  // like ["video"] with no schema change, and a plan upsert — the exact write
  // shape applyEntitlement issues, which never touches the addons column —
  // leaves a granted add-on intact. A future one-time video unlock therefore
  // needs zero migration.
  psql(`insert into public.storypress_entitlements(owner_id,plan,addons) values('${addon}','free','["video"]');`);
  assert.equal(psql(`select addons from public.storypress_entitlements where owner_id='${addon}'`), '["video"]', 'addons round-trips a video unlock with no schema change');
  psql(`insert into public.storypress_entitlements(owner_id,plan,addons) values('${addon}','lifetime','[]') on conflict (owner_id) do update set plan='lifetime';`);
  assert.equal(psql(`select addons from public.storypress_entitlements where owner_id='${addon}'`), '["video"]', 'a plan upsert must not erase granted addons');

  // RPC surface: security definer, locked search_path, service_role-only
  // execution — and exactly one signature: the three-argument wave-8 version
  // supersedes the two-argument one, so no PostgREST call can land on the
  // uncapped draw order by resolving a stale overload.
  assert.equal(psql(`select prosecdef from pg_proc where proname='storypress_reserve_story'`), 't', 'reserve RPC must be security definer');
  assert.ok(psql(`select coalesce(array_to_string(proconfig,','),'') from pg_proc where proname='storypress_reserve_story'`).includes(`search_path=""`), 'reserve RPC must lock its search_path');
  assert.equal(psql(`select has_function_privilege('anon','public.storypress_reserve_story(uuid,integer,integer)','execute')`), 'f');
  assert.equal(psql(`select has_function_privilege('authenticated','public.storypress_reserve_story(uuid,integer,integer)','execute')`), 'f');
  assert.equal(psql(`select has_function_privilege('service_role','public.storypress_reserve_story(uuid,integer,integer)','execute')`), 't');
  assert.equal(psql(`select count(*) from pg_proc where proname='storypress_reserve_story'`), '1', 'the two-argument wave-7 RPC is dropped — exactly one signature remains');

  // Behavior: three free stories, then refusal; refusal never consumes a slot.
  const reserve = (uid, limit = 3, cap = 50) => rows(`select ok||'|'||reason from public.storypress_reserve_story('${uid}',${limit},${cap});`).join('\n');
  assert.deepEqual([reserve(user), reserve(user), reserve(user)], ['true|free', 'true|free', 'true|free'], 'three free stories succeed');
  assert.deepEqual([reserve(user), reserve(user)], ['false|limit', 'false|limit'], 'fourth and fifth refusals return ok=false reason=limit in one row');
  assert.equal(psql(`select stories_created from public.storypress_story_counts where owner_id='${user}'`), '3', 'refusals must not consume slots');

  // Monotonic and delete-proof: deleting stories never frees the counter.
  psql(`insert into public.storypress_stories(id,owner_id,title,data) values(gen_random_uuid(),'${user}','x','{}'::jsonb);`);
  psql(`delete from public.storypress_stories where owner_id='${user}';`);
  assert.equal(psql(`select stories_created from public.storypress_story_counts where owner_id='${user}'`), '3', 'story deletion must not decrement the counter');

  // Entitled plans at the DB layer only: a legacy lifetime row (the CHECK still
  // permits the value) stays unlimited-entitled in the RPC, while the account
  // payload fails any such row back to the free tier — no payload carries the
  // value. A subscription draws from the calendar-month window (past_due keeps
  // grace access, capped).
  for (const [uid, plan] of [[mate, 'lifetime'], [paid, 'subscription']]) psql(`insert into public.storypress_entitlements(owner_id,plan,subscription_status) values('${uid}','${plan}','past_due');`);
  assert.deepEqual(Array.from({length: 5}, () => reserve(mate)), Array(5).fill('true|entitled'), 'lifetime passes past the cap');
  assert.deepEqual(Array.from({length: 5}, () => reserve(paid)), Array(5).fill('true|subscription'), 'past_due subscription keeps grace access within the cap');
  assert.equal(psql(`select stories_created from public.storypress_story_counts where owner_id='${mate}'`), '5', 'entitled successes increment the counter too');
  assert.equal(psql(`select stories_created from public.storypress_story_counts where owner_id='${paid}'`), '0', 'subscription window draws leave the free counter untouched — each ledger meters its own pool');
  assert.equal(psql(`select stories_created from public.storypress_subscription_draws where owner_id='${paid}'`), '5', 'subscription draws land in the monthly window');
  assert.equal(psql(`select period_month = pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'utc')::date from public.storypress_subscription_draws where owner_id='${paid}'`), 't', 'the window is the UTC calendar month');

  // Downgrade: entitlement removed → the cap applies again from the monotonic counter.
  psql(`delete from public.storypress_entitlements where owner_id='${mate}';`);
  assert.equal(reserve(mate), 'false|limit', 'downgraded owner re-meters on new creations');

  // Wave 8 cap boundary and waterfall (spec §1 draw order): a subscriber
  // draws exactly the cap from the window, then falls to the free quota, then
  // pack credits, then a distinct refusal — nothing consumed on the way out.
  psql(`insert into public.storypress_entitlements(owner_id,plan,subscription_status) values('${sub}','subscription','active');`);
  assert.deepEqual([reserve(sub, 3, 2), reserve(sub, 3, 2)], ['true|subscription', 'true|subscription'], 'subscription draws inside the cap come from the window');
  assert.deepEqual([reserve(sub, 3, 2), reserve(sub, 3, 2), reserve(sub, 3, 2)], ['true|free', 'true|free', 'true|free'], 'a cap-exhausted subscriber falls back to the free quota');
  assert.equal(reserve(sub, 3, 2), 'false|cap', 'with the cap hit and the free quota spent, a subscriber refuses as cap');
  assert.equal(psql(`select stories_created from public.storypress_subscription_draws where owner_id='${sub}'`), '2', 'refusals never consume window slots');
  assert.equal(psql(`select stories_created from public.storypress_story_counts where owner_id='${sub}'`), '3', 'refusals never consume free slots');

  // Month rollover: the window is keyed on the UTC month, so last month's
  // consumption cannot bind this month — the new month's row simply starts
  // fresh (last month simulated by backdating the existing row).
  psql(`update public.storypress_subscription_draws set period_month = (period_month - interval '1 month')::date where owner_id='${sub}';`);
  assert.equal(reserve(sub, 3, 2), 'true|subscription', 'a new month draws from a fresh window');
  assert.equal(psql(`select count(*) from public.storypress_subscription_draws where owner_id='${sub}'`), '2', 'last month’s row is preserved for the audit trail');
  assert.equal(psql(`select stories_created from public.storypress_subscription_draws where owner_id='${sub}' and period_month = pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'utc')::date`), '1', 'the new month’s window starts at one draw');

  // Pack credits: drawn only after the free quota, one ledger row per credit,
  // and a pack holder out of balance refuses distinctly from a free-tier user.
  psql(`insert into public.storypress_story_counts(owner_id,stories_created) values('${pack}',3);`);
  psql(`insert into public.storypress_pack_grants(owner_id,checkout_session_id,credits) values('${pack}','cs_pack_30',2);`);
  assert.deepEqual([reserve(pack), reserve(pack), reserve(pack)], ['true|pack', 'true|pack', 'false|no_credits'], 'pack draws exhaust exactly the granted balance, then refuse as no_credits');
  assert.equal(psql(`select count(*) from public.storypress_pack_draws where owner_id='${pack}'`), '2', 'each pack draw records exactly one consumption row');
  assert.equal(psql(`select stories_created from public.storypress_story_counts where owner_id='${pack}'`), '3', 'pack successes leave the free counter untouched too');

  // Guard rails: unknown account and bad limits raise instead of reserving.
  assert.ok(failing(`select public.storypress_reserve_story('99999999-9999-4999-8999-999999999999',3)`).includes('Unknown account'), 'unknown account raises');
  assert.ok(failing(`select public.storypress_reserve_story('${user}',-1)`).includes('Invalid reservation'), 'negative limit raises');
  assert.ok(failing(`select public.storypress_reserve_story(null,3)`).includes('Invalid reservation'), 'null user raises');
  assert.ok(failing(`select public.storypress_reserve_story('${user}',3,-1)`).includes('Invalid reservation'), 'negative cap raises');

  // Race: parallel reserves with one slot left admit exactly one; entitled calls never lose an increment.
  const race = async (uid, n, limit = 3, cap = 50) => (await Promise.all(Array.from({length: n}, () => new Promise(resolve => {
    const child = spawn(bin('psql'), ['-h', socket, '-p', String(port), '-U', 'postgres', '-d', 'billtest', '-qAt', '-c', `select ok||'|'||reason from public.storypress_reserve_story('${uid}',${limit},${cap});`]);
    let out = ''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d);
    child.on('close', () => resolve(out.trim().split('\n').filter(Boolean).join(' ')));
  })))).flat();
  psql(`insert into public.storypress_story_counts(owner_id,stories_created) values('${free}',2);`);
  const freeRace = (await race(free, 10)).filter(line => line === 'true|free');
  assert.equal(freeRace.length, 1, `parallel reserves with one slot left must admit exactly one, got ${freeRace.length}`);
  assert.equal(psql(`select stories_created from public.storypress_story_counts where owner_id='${free}'`), '3', 'race must not over-admit');
  psql(`insert into public.storypress_entitlements(owner_id,plan) values('${paid}','lifetime') on conflict(owner_id) do update set plan='lifetime';`);
  const paidRace = await race(paid, 12);
  assert.equal(paidRace.filter(line => line === 'true|entitled').length, 12, 'all parallel entitled reserves succeed');
  // The 12 earlier subscription window draws never touched the counter (each
  // ledger meters its own pool), so the lifetime race's 12 wins are the whole count.
  assert.equal(psql(`select stories_created from public.storypress_story_counts where owner_id='${paid}'`), '12', 'advisory lock leaves no lost increments');

  // Pack race: one credit left admits exactly one pack draw; losers refuse as
  // no_credits and nothing over-consumes the ledger.
  psql(`insert into public.storypress_story_counts(owner_id,stories_created) values('${pack2}',3);`);
  psql(`insert into public.storypress_pack_grants(owner_id,checkout_session_id,credits) values('${pack2}','cs_pack_race',1);`);
  const packRace = await race(pack2, 10);
  assert.equal(packRace.filter(line => line === 'true|pack').length, 1, 'parallel reserves with one pack credit left must admit exactly one pack draw');
  assert.equal(packRace.filter(line => line === 'false|no_credits').length, 9, 'pack race losers refuse as no_credits');
  assert.equal(psql(`select count(*) from public.storypress_pack_draws where owner_id='${pack2}'`), '1', 'the pack race records exactly one consumption row');

  // Cap race: one window slot left admits exactly one subscription draw; the
  // losers' free quota is already spent, so they refuse as cap without
  // over-admitting the window.
  psql(`insert into public.storypress_entitlements(owner_id,plan,subscription_status) values('${sub2}','subscription','active');`);
  psql(`insert into public.storypress_subscription_draws(owner_id,period_month,stories_created) values('${sub2}',pg_catalog.date_trunc('month',pg_catalog.now() at time zone 'utc')::date,1);`);
  psql(`insert into public.storypress_story_counts(owner_id,stories_created) values('${sub2}',3);`);
  const capRace = await race(sub2, 10, 3, 2);
  assert.equal(capRace.filter(line => line === 'true|subscription').length, 1, 'parallel reserves with one window slot left must admit exactly one subscription draw');
  assert.equal(capRace.filter(line => line === 'false|cap').length, 9, 'cap race losers refuse as cap');
  assert.equal(psql(`select stories_created from public.storypress_subscription_draws where owner_id='${sub2}'`), '2', 'the cap race must not over-admit the window');

  // Monotonicity lint: no decrement path anywhere in the migrations.
  for (const migration of ['202610300002_billing.sql', '202611060001_wave8_credit_ledger.sql'])
    assert.ok(!/stories_created\s*-\s*1/.test(readFileSync(join('supabase', 'migrations', migration), 'utf8')), `${migration} must contain no counter decrement`);

  // Governance lint: the billing tables and RPC are referenced only by the
  // sanctioned server surfaces — PR #16's metering and status (server/
  // storage.ts) and the money path (server/billing.ts, api wrappers) plus
  // their built bundle. Any other product code referencing them is a
  // regression, and client code must never touch billing directly.
  const sanctioned=new Set(['server/storage.ts','server/billing.ts','worker/index.js','api/billing.mjs','api/stripe-webhook.mjs']);
  const dormant = (() => { try { return execFileSync('git', ['grep', '-l', '-E', 'storypress_entitlements|storypress_story_counts|storypress_billing_events|storypress_subscription_draws|storypress_pack_grants|storypress_pack_draws|storypress_reserve_story', '--', 'app', 'server', 'lib', 'worker', 'api']).toString().trim().split('\n').filter(Boolean); } catch (error) { if (error.status === 1) return []; throw error; } })();
  assert.deepEqual(dormant.filter(path => !sanctioned.has(path)), [], `billing tables referenced outside sanctioned server code: ${dormant}`);

  console.log('Passed: billing schema shape, RLS/policy/ACL isolation, service-role-only reserve RPC (security definer, locked search_path, single superseding signature), free cap + refusal semantics, monotonic delete-proof counter, entitled grace, wave-8 draw order (subscription window cap, month rollover, free-quota fallback, pack decrement, distinct cap/limit/no_credits refusals that consume nothing), parallel races on all three pools, no decrement path, the video add-on hook (addons accepts ["video"] with no schema change and plan upserts never erase it), and the sanctioned-reader governance lint. Verified against a real throwaway PostgreSQL cluster with Supabase role/schema stubs; live Supabase activation still required.');
} finally {
  stop();
}
