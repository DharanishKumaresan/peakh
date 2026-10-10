-- Peakh: private records and consent-based sharing. Safe to apply once.
begin;
create schema if not exists peakh_private;
revoke all on schema peakh_private from public, anon, authenticated;

create table peakh_private.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  name text not null default 'Athlete' check (length(name) between 1 and 50),
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  photo_key text,
  created_at timestamptz not null default now()
);
create table peakh_private.record_boards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at uuid not null default gen_random_uuid()
);
create table peakh_private.friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  requested_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key(user_a, user_b),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b))
);
create index peakh_friend_b on peakh_private.friendships(user_b);
alter table peakh_private.profiles enable row level security;
alter table peakh_private.record_boards enable row level security;
alter table peakh_private.friendships enable row level security;
revoke all on all tables in schema peakh_private from public, anon, authenticated;

create function peakh_private.shared_state(s jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('sample', false, 'friends', '[]'::jsonb, 'activities',
    coalesce((select jsonb_agg(a || jsonb_build_object('entries',
      coalesce((select jsonb_agg(e) from jsonb_array_elements(a->'entries') e
        where e->>'id' not like 'sample-%'), '[]'::jsonb)))
      from jsonb_array_elements(s->'activities') a), '[]'::jsonb))
$$;

-- Database validation is required because authenticated clients can call the RPC.
create function peakh_private.valid_state(s jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare a jsonb; e jsonb; ids text[] := '{}'; entry_ids text[];
begin
  if s is null or octet_length(s::text) > 2000000 or jsonb_typeof(s) <> 'object'
    or jsonb_typeof(s->'sample') is distinct from 'boolean'
    or jsonb_typeof(s->'activities') is distinct from 'array'
    or jsonb_typeof(s->'friends') is distinct from 'array' then return false; end if;
  if jsonb_array_length(s->'activities') not between 1 and 100 then return false; end if;
  for a in select * from jsonb_array_elements(s->'activities') loop
    if jsonb_typeof(a->'id') is distinct from 'string' or length(a->>'id') not between 1 and 100
      or (a->>'id') = any(ids)
      or jsonb_typeof(a->'name') is distinct from 'string' or length(trim(a->>'name')) not between 1 and 45
      or jsonb_typeof(a->'category') is distinct from 'string' or length(a->>'category') > 100
      or jsonb_typeof(a->'unit') is distinct from 'string' or a->>'unit' not in ('reps','kg','lb','min:sec','sec','km','m')
      or jsonb_typeof(a->'lower') is distinct from 'boolean'
      or jsonb_typeof(a->'goal') is distinct from 'number' or (a->>'goal')::numeric not between 0 and 1000000
      or jsonb_typeof(a->'entries') is distinct from 'array' then return false; end if;
    ids := array_append(ids, a->>'id'); entry_ids := '{}';
    if jsonb_array_length(a->'entries') > 10000 then return false; end if;
    for e in select * from jsonb_array_elements(a->'entries') loop
      if jsonb_typeof(e->'id') is distinct from 'string' or length(e->>'id') not between 1 and 100
        or (e->>'id') = any(entry_ids)
        or jsonb_typeof(e->'value') is distinct from 'number' or (e->>'value')::numeric <= 0 or (e->>'value')::numeric > 1000000
        or jsonb_typeof(e->'date') is distinct from 'string' or e->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        or to_char((e->>'date')::date, 'YYYY-MM-DD') <> e->>'date' then return false; end if;
      entry_ids := array_append(entry_ids, e->>'id');
    end loop;
  end loop;
  return true;
exception when others then return false;
end $$;

create function public.peakh_api(action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); p peakh_private.profiles; target peakh_private.profiles;
  result jsonb; seed jsonb; next_state jsonb; version uuid; changed integer;
  a uuid; b uuid; existing uuid; peer_count integer;
begin
  if u is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if octet_length(payload::text) > 2100000 then raise exception 'Request too large'; end if;
  insert into peakh_private.profiles(user_id) values(u) on conflict (user_id) do nothing;
  select * into p from peakh_private.profiles where user_id = u;

  if action = 'profile_get' then return to_jsonb(p);
  elsif action = 'board_get' then
    seed := '{"sample":false,"friends":[],"activities":[
      {"id":"run","name":"Running","category":"5 KM · TIME","unit":"min:sec","lower":true,"goal":1200,"entries":[]},
      {"id":"bench","name":"Bench press","category":"STRENGTH · 1 REP MAX","unit":"kg","lower":false,"goal":100,"entries":[]},
      {"id":"swim","name":"Swimming","category":"100 M · FREESTYLE","unit":"min:sec","lower":true,"goal":90,"entries":[]},
      {"id":"push","name":"Pushups","category":"BODYWEIGHT · UNBROKEN","unit":"reps","lower":false,"goal":60,"entries":[]},
      {"id":"pull","name":"Pullups","category":"BODYWEIGHT · UNBROKEN","unit":"reps","lower":false,"goal":20,"entries":[]}
    ]}'::jsonb;
    insert into peakh_private.record_boards(user_id, state) values(u, seed) on conflict (user_id) do nothing;
    select jsonb_build_object('state', state::text, 'updated_at', updated_at) into result from peakh_private.record_boards where user_id = u;
    return result;
  elsif action = 'board_save' then
    next_state := payload->'state';
    if not peakh_private.valid_state(next_state) then raise exception 'Invalid records'; end if;
    if exists (select 1 from jsonb_array_elements(next_state->'activities') x,
      jsonb_array_elements(x->'entries') e where (e->>'date')::date > current_date + 1) then raise exception 'Invalid date'; end if;
    version := gen_random_uuid();
    update peakh_private.record_boards set state = next_state || '{"friends":[]}'::jsonb, updated_at = version
      where user_id = u and updated_at::text = payload->>'expected';
    get diagnostics changed = row_count;
    return jsonb_build_object('saved', changed = 1, 'version', version);
  elsif action = 'social_get' then
    select coalesce(jsonb_agg(jsonb_build_object('connection_id', f.id, 'requested_by', f.requested_by,
      'status', f.status, 'id', other.id, 'name', other.name,
      'photo_key', case when f.status = 'accepted' then other.photo_key else null end,
      'state', case when f.status = 'accepted' then peakh_private.shared_state(board.state) else null end)
      order by f.created_at desc), '[]'::jsonb) into result
    from peakh_private.friendships f
    join peakh_private.profiles other on other.user_id = case when f.user_a = u then f.user_b else f.user_a end
    left join peakh_private.record_boards board on board.user_id = other.user_id
    where f.user_a = u or f.user_b = u;
    return jsonb_build_object('self', to_jsonb(p), 'peers', result);
  elsif action = 'request_friend' then
    if payload->>'code' is null or payload->>'code' !~ '^[A-F0-9]{16}$' then raise exception 'Invalid friend code'; end if;
    select * into target from peakh_private.profiles where code = payload->>'code';
    if not found then return jsonb_build_object('status',404,'error','No profile has that code. Check it with your friend.'); end if;
    if target.user_id = u then return jsonb_build_object('status',400,'error','That is your own friend code.'); end if;
    a := least(u, target.user_id); b := greatest(u, target.user_id);
    -- Serialize requests involving either user so concurrent requests cannot exceed the cap.
    perform 1 from peakh_private.profiles where user_id in (a,b) order by user_id for update;
    select count(*) into peer_count from peakh_private.friendships where user_a in (a,b) or user_b in (a,b);
    if peer_count >= 200 then return jsonb_build_object('status',400,'error','Friend request limit reached.'); end if;
    insert into peakh_private.friendships(user_a,user_b,requested_by) values(a,b,u)
      on conflict(user_a,user_b) do nothing returning id into existing;
    if existing is null then return jsonb_build_object('status',409,'error','You are already connected or have a pending request.'); end if;
    return jsonb_build_object('status',201);
  elsif action = 'social_action' then
    if payload->>'action' = 'rename' then
      if jsonb_typeof(payload->'name') is distinct from 'string' or length(trim(payload->>'name')) not between 1 and 50 then raise exception 'Invalid name'; end if;
      update peakh_private.profiles set name = trim(payload->>'name') where user_id = u;
    elsif payload->>'action' = 'accept' then
      update peakh_private.friendships set status = 'accepted' where id::text = payload->>'id'
        and status = 'pending' and requested_by <> u and u in (user_a,user_b);
    elsif payload->>'action' = 'dismiss' then
      delete from peakh_private.friendships where id::text = payload->>'id' and status = 'pending' and u in (user_a,user_b);
    elsif payload->>'action' = 'remove' then
      select * into target from peakh_private.profiles where id::text = payload->>'id';
      delete from peakh_private.friendships where status = 'accepted'
        and user_a = least(u,target.user_id) and user_b = greatest(u,target.user_id);
    else raise exception 'Invalid action';
    end if;
    get diagnostics changed = row_count;
    return jsonb_build_object('saved', changed = 1);
  elsif action = 'friend_get' then
    select jsonb_build_object('id', other.id, 'name', other.name, 'photo_key', other.photo_key,
      'state', peakh_private.shared_state(board.state)) into result
    from peakh_private.profiles other left join peakh_private.record_boards board on board.user_id = other.user_id
    where other.id::text = payload->>'id' and (other.user_id = u or exists(
      select 1 from peakh_private.friendships f where f.status = 'accepted'
        and f.user_a = least(u,other.user_id) and f.user_b = greatest(u,other.user_id)));
    return result;
  elsif action = 'photo_set' then
    if payload->>'key' is not null then
      if split_part(payload->>'key','/',1) <> u::text or length(payload->>'key') > 100
        or not exists(select 1 from storage.objects where bucket_id='peakh-photos' and name=payload->>'key') then raise exception 'Invalid photo'; end if;
    end if;
    update peakh_private.profiles set photo_key = payload->>'key' where user_id = u;
    return jsonb_build_object('saved',true);
  else raise exception 'Unknown operation';
  end if;
end $$;
revoke all on function public.peakh_api(text,jsonb) from public, anon;
grant execute on function public.peakh_api(text,jsonb) to authenticated;

create function public.peakh_can_view_photo(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from peakh_private.profiles p where p.photo_key = object_name and
      (p.user_id = auth.uid() or exists(select 1 from peakh_private.friendships f where f.status='accepted'
        and f.user_a=least(auth.uid(),p.user_id) and f.user_b=greatest(auth.uid(),p.user_id)))
  )
$$;
revoke all on function public.peakh_can_view_photo(text) from public, anon;
grant execute on function public.peakh_can_view_photo(text) to authenticated;
revoke all on all functions in schema peakh_private from public, anon, authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('peakh-photos','peakh-photos',false,524288,array['image/jpeg']);
create policy peakh_photo_read on storage.objects for select to authenticated
using(bucket_id='peakh-photos' and (split_part(name,'/',1)=auth.uid()::text or public.peakh_can_view_photo(name)));
create policy peakh_photo_insert on storage.objects for insert to authenticated
with check(bucket_id='peakh-photos' and split_part(name,'/',1)=auth.uid()::text);
create policy peakh_photo_delete on storage.objects for delete to authenticated
using(bucket_id='peakh-photos' and split_part(name,'/',1)=auth.uid()::text);
commit;
