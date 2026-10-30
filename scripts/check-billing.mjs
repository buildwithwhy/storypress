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
const free = '33333333-3333-4333-8333-333333333333', paid = '44444444-4444-4444-8444-444444444444';
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
  for (const file of ['202610110001_storypress.sql', '202610300001_contributions.sql', '202610300002_billing.sql'])
    execFileSync(bin('psql'), ['-h', socket, '-p', String(port), '-U', 'postgres', '-d', 'billtest', '-v', 'ON_ERROR_STOP=1', '-q', '-f', join('supabase', 'migrations', file)], {stdio: 'pipe'});
  psql(`insert into auth.users(id) values('${user}'),('${mate}'),('${free}'),('${paid}');`);

  // Schema shape: RLS everywhere, zero policies, service-role-only access.
  for (const table of ['storypress_entitlements', 'storypress_story_counts', 'storypress_billing_events']) {
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

  // RPC surface: security definer, locked search_path, service_role-only execution.
  assert.equal(psql(`select prosecdef from pg_proc where proname='storypress_reserve_story'`), 't', 'reserve RPC must be security definer');
  assert.ok(psql(`select coalesce(array_to_string(proconfig,','),'') from pg_proc where proname='storypress_reserve_story'`).includes(`search_path=""`), 'reserve RPC must lock its search_path');
  assert.equal(psql(`select has_function_privilege('anon','public.storypress_reserve_story(uuid,integer)','execute')`), 'f');
  assert.equal(psql(`select has_function_privilege('authenticated','public.storypress_reserve_story(uuid,integer)','execute')`), 'f');
  assert.equal(psql(`select has_function_privilege('service_role','public.storypress_reserve_story(uuid,integer)','execute')`), 't');

  // Behavior: three free stories, then refusal; refusal never consumes a slot.
  const reserve = (uid, limit = 3) => rows(`select ok||'|'||reason from public.storypress_reserve_story('${uid}',${limit});`).join('\n');
  assert.deepEqual([reserve(user), reserve(user), reserve(user)], ['true|free', 'true|free', 'true|free'], 'three free stories succeed');
  assert.deepEqual([reserve(user), reserve(user)], ['false|limit', 'false|limit'], 'fourth and fifth refusals return ok=false reason=limit in one row');
  assert.equal(psql(`select stories_created from public.storypress_story_counts where owner_id='${user}'`), '3', 'refusals must not consume slots');

  // Monotonic and delete-proof: deleting stories never frees the counter.
  psql(`insert into public.storypress_stories(id,owner_id,title,data) values(gen_random_uuid(),'${user}','x','{}'::jsonb);`);
  psql(`delete from public.storypress_stories where owner_id='${user}';`);
  assert.equal(psql(`select stories_created from public.storypress_story_counts where owner_id='${user}'`), '3', 'story deletion must not decrement the counter');

  // Entitled plans pass unlimited; both paid tiers; past_due keeps grace access.
  for (const [uid, plan] of [[mate, 'lifetime'], [paid, 'subscription']]) psql(`insert into public.storypress_entitlements(owner_id,plan,subscription_status) values('${uid}','${plan}','past_due');`);
  assert.deepEqual(Array.from({length: 5}, () => reserve(mate)), Array(5).fill('true|entitled'), 'lifetime passes past the cap');
  assert.deepEqual(Array.from({length: 5}, () => reserve(paid)), Array(5).fill('true|entitled'), 'past_due subscription keeps grace access');
  assert.equal(psql(`select stories_created from public.storypress_story_counts where owner_id='${mate}'`), '5', 'entitled successes increment the counter too');

  // Downgrade: entitlement removed → the cap applies again from the monotonic counter.
  psql(`delete from public.storypress_entitlements where owner_id='${mate}';`);
  assert.equal(reserve(mate), 'false|limit', 'downgraded owner re-meters on new creations');

  // Guard rails: unknown account and bad limits raise instead of reserving.
  assert.ok(failing(`select public.storypress_reserve_story('99999999-9999-4999-8999-999999999999',3)`).includes('Unknown account'), 'unknown account raises');
  assert.ok(failing(`select public.storypress_reserve_story('${user}',-1)`).includes('Invalid reservation'), 'negative limit raises');
  assert.ok(failing(`select public.storypress_reserve_story(null,3)`).includes('Invalid reservation'), 'null user raises');

  // Race: parallel reserves with one slot left admit exactly one; entitled calls never lose an increment.
  const race = async (uid, n) => (await Promise.all(Array.from({length: n}, () => new Promise(resolve => {
    const child = spawn(bin('psql'), ['-h', socket, '-p', String(port), '-U', 'postgres', '-d', 'billtest', '-qAt', '-c', `select ok||'|'||reason from public.storypress_reserve_story('${uid}',3);`]);
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
  assert.equal(psql(`select stories_created from public.storypress_story_counts where owner_id='${paid}'`), '17', 'advisory lock leaves no lost increments');

  // Monotonicity lint: no decrement path anywhere in the migration.
  const sql = readFileSync('supabase/migrations/202610300002_billing.sql', 'utf8');
  assert.ok(!/stories_created\s*-\s*1/.test(sql), 'the migration must contain no counter decrement');

  // Dormancy: no product code reads the billing tables or RPC yet (migration, docs and checks may).
  const dormant = (() => { try { return execFileSync('git', ['grep', '-l', '-E', 'storypress_entitlements|storypress_story_counts|storypress_billing_events|storypress_reserve_story', '--', 'app', 'server', 'lib', 'worker', 'api']).toString().trim(); } catch (error) { if (error.status === 1) return ''; throw error; } })();
  assert.equal(dormant, '', `billing must stay dormant — product code referenced it: ${dormant}`);

  console.log('Passed: billing schema shape, RLS/policy/ACL isolation, service-role-only reserve RPC (security definer, locked search_path), free cap + refusal semantics, monotonic delete-proof counter, entitled grace and downgrade re-metering, parallel race admits exactly the remaining slots, no decrement path, and PR-1 dormancy. Verified against a real throwaway PostgreSQL cluster with Supabase role/schema stubs; live Supabase activation still required.');
} finally {
  stop();
}
