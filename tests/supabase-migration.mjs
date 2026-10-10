import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Disposable in-memory PostgreSQL: no network or production credentials.
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create schema storage;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(bucket_id text,name text);
  alter table storage.objects enable row level security;
  grant usage on schema auth,storage to authenticated;
  grant select,insert,delete on storage.objects to authenticated;
`);
await db.exec(await readFile(new URL('../supabase/migrations/202609230001_peakh.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/202609250001_allow_empty_board.sql', import.meta.url), 'utf8'));
assert.equal((await db.query(`select peakh_private.valid_state('{"sample":false,"activities":[],"friends":[]}'::jsonb) as valid`)).rows[0].valid, true);
const alice = '10000000-0000-4000-8000-000000000001';
const bob = '10000000-0000-4000-8000-000000000002';
const stranger = '10000000-0000-4000-8000-000000000003';
await db.query('insert into auth.users values ($1),($2),($3)', [alice,bob,stranger]);
async function call(user, action, payload={}) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user || '']);
  await db.exec('set role authenticated');
  try { return (await db.query('select public.peakh_api($1,$2::jsonb) as result',[action,JSON.stringify(payload)])).rows[0].result; }
  finally { await db.exec('reset role'); }
}
await assert.rejects(call(null,'board_get'), /Authentication required/);
const a = await call(alice,'profile_get'), b = await call(bob,'profile_get');
const board = await call(alice,'board_get'), state = JSON.parse(board.state);
state.activities[0].entries.push({id:'effort-1',date:'2026-09-01',value:1234});
const saved = await call(alice,'board_save',{state,expected:board.updated_at});
assert.equal(saved.saved,true);
assert.equal((await call(alice,'board_save',{state,expected:board.updated_at})).saved,false);
assert.equal(JSON.parse((await call(alice,'board_get')).state).activities[0].entries[0].value,1234);
assert.equal(JSON.parse((await call(bob,'board_get')).state).activities[0].entries.length,0);
await assert.rejects(call(alice,'board_save',{state:{sample:false,activities:[{}],friends:[]},expected:saved.version}),/Invalid records/);
assert.equal(await call(bob,'friend_get',{id:a.id}),null);
assert.equal((await call(alice,'request_friend',{code:b.code})).status,201);
assert.equal((await call(alice,'request_friend',{code:b.code})).status,409);
const pending = (await call(bob,'social_get')).peers[0];
assert.equal(pending.state,null);
assert.equal((await call(alice,'social_action',{action:'accept',id:pending.connection_id})).saved,false);
assert.equal((await call(stranger,'social_action',{action:'accept',id:pending.connection_id})).saved,false);
assert.equal((await call(bob,'social_action',{action:'accept',id:pending.connection_id})).saved,true);
assert.equal((await call(bob,'friend_get',{id:a.id})).state.activities[0].entries.length,1);
assert.equal(await call(stranger,'friend_get',{id:a.id}),null);
await db.query('insert into storage.objects values ($1,$2)',['peakh-photos',alice+'/photo.jpg']);
await call(alice,'photo_set',{key:alice+'/photo.jpg'});
await assert.rejects(call(bob,'photo_set',{key:alice+'/photo.jpg'}),/Invalid photo/);
async function visiblePhotos(user) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  await db.exec('set role authenticated');
  try { return (await db.query('select * from storage.objects')).rows; }
  finally { await db.exec('reset role'); }
}
assert.equal((await visiblePhotos(bob)).length,1);
assert.equal((await visiblePhotos(stranger)).length,0);
assert.equal((await call(alice,'social_action',{action:'remove',id:b.id})).saved,true);
assert.equal(await call(bob,'friend_get',{id:a.id}),null);
assert.equal((await visiblePhotos(bob)).length,0);
await db.exec('set role authenticated');
await assert.rejects(db.query('select * from peakh_private.record_boards'),/permission denied/);
await db.exec('reset role');
const beforeEmpty = await call(alice, 'board_get');
assert.equal((await call(alice, 'board_save', { state: { sample: false, activities: [], friends: [] }, expected: beforeEmpty.updated_at })).saved, true);
assert.deepEqual(JSON.parse((await call(alice, 'board_get')).state).activities, []);
const invalidIdState = JSON.parse(beforeEmpty.state);
invalidIdState.activities[0].id = '';
assert.equal((await db.query('select peakh_private.valid_state($1::jsonb) as valid', [JSON.stringify(invalidIdState)])).rows[0].valid, false);
await db.close();
console.log('PASS: PostgreSQL migration, validated saves, stale-save protection, account isolation, consent, private photos and revocation.');
