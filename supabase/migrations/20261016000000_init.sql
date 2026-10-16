-- CyberQUA schema
--
-- Design
-- * All data lives in the `cq_private` schema, which is NOT exposed through the
--   Supabase Data API. Clients (anon / authenticated) cannot read or write it.
-- * The Next.js server talks to Postgres only through SECURITY DEFINER functions
--   in `public` named `cq_*`. Every function first checks a server-only app
--   secret (CYBERQUA_DB_SECRET); only its SHA-256 hash is stored in the database.
--   This lets the app use the Supabase publishable key without ever holding a
--   database-wide secret key, and keeps it isolated from other apps that share
--   the same project.
-- * User ids are Clerk user ids (text, "user_...").
-- * Rate limiting, monthly quotas and short-lived caches are also stored here.
--
-- After applying, set the secret (once):
--   insert into cq_private.config (key, value)
--   values ('app_secret_sha256', encode(extensions.digest('<CYBERQUA_DB_SECRET>', 'sha256'), 'hex'))
--   on conflict (key) do update set value = excluded.value;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists cq_private;
revoke all on schema cq_private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists cq_private.config (
  key   text primary key,
  value text not null
);

create table if not exists cq_private.profiles (
  id            text primary key check (char_length(id) between 1 and 64),
  display_name  text check (display_name is null or char_length(display_name) <= 120),
  plan          text not null default 'free' check (plan in ('free', 'pro')),
  locale        text not null default 'tr' check (locale in ('tr', 'en')),
  created_at    timestamptz not null default now()
);

-- Only the SHA-256 hash and a 12 character display prefix of each key are stored.
create table if not exists cq_private.api_keys (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null references cq_private.profiles(id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 50),
  type             text not null check (type in ('secret', 'publishable')),
  key_prefix       text not null check (char_length(key_prefix) = 12),
  key_hash         text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  allowed_origins  text[] not null default '{}',
  created_at       timestamptz not null default now(),
  last_used_at     timestamptz,
  revoked_at       timestamptz
);
create index if not exists cq_api_keys_user_idx on cq_private.api_keys (user_id, created_at desc);

-- Never stores request bodies, IPs or queried values.
create table if not exists cq_private.usage_logs (
  id           bigint generated always as identity primary key,
  user_id      text not null references cq_private.profiles(id) on delete cascade,
  api_key_id   uuid references cq_private.api_keys(id) on delete set null,
  endpoint     text not null check (char_length(endpoint) <= 64),
  status_code  smallint not null,
  latency_ms   integer not null check (latency_ms >= 0),
  created_at   timestamptz not null default now()
);
create index if not exists cq_usage_logs_user_created_idx on cq_private.usage_logs (user_id, created_at desc);

create table if not exists cq_private.quotas (
  user_id  text not null,
  month    text not null,
  used     integer not null default 0,
  primary key (user_id, month)
);

-- Sliding-window rate limit buckets (fixed windows weighted by overlap).
create table if not exists cq_private.rate_limits (
  bucket        text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (bucket, window_start)
);

create table if not exists cq_private.cache (
  key         text primary key,
  value       jsonb not null,
  expires_at  timestamptz not null
);
create index if not exists cq_cache_expires_idx on cq_private.cache (expires_at);

alter table cq_private.config      enable row level security;
alter table cq_private.profiles    enable row level security;
alter table cq_private.api_keys    enable row level security;
alter table cq_private.usage_logs  enable row level security;
alter table cq_private.quotas      enable row level security;
alter table cq_private.rate_limits enable row level security;
alter table cq_private.cache       enable row level security;

-- ---------------------------------------------------------------------------
-- Secret check
-- ---------------------------------------------------------------------------
create or replace function cq_private.assert_secret(p_secret text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  expected text;
begin
  select value into expected from cq_private.config where key = 'app_secret_sha256';
  if expected is null or p_secret is null
     or encode(extensions.digest(p_secret, 'sha256'), 'hex') <> expected then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;
revoke all on function cq_private.assert_secret(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- API key lookup / profiles
-- ---------------------------------------------------------------------------
create or replace function public.cq_find_key(p_secret text, p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform cq_private.assert_secret(p_secret);
  return (
    select jsonb_build_object(
      'id', k.id, 'user_id', k.user_id, 'type', k.type, 'allowed_origins', to_jsonb(k.allowed_origins),
      'revoked', k.revoked_at is not null, 'plan', p.plan)
    from cq_private.api_keys k join cq_private.profiles p on p.id = k.user_id
    where k.key_hash = p_hash
  );
end; $$;

create or replace function public.cq_ensure_profile(p_secret text, p_user text, p_display_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r cq_private.profiles;
begin
  perform cq_private.assert_secret(p_secret);
  insert into cq_private.profiles (id, display_name) values (p_user, left(p_display_name, 120))
  on conflict (id) do update set display_name = coalesce(cq_private.profiles.display_name, excluded.display_name)
  returning * into r;
  return to_jsonb(r);
end; $$;

create or replace function public.cq_set_locale(p_secret text, p_user text, p_locale text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform cq_private.assert_secret(p_secret);
  update cq_private.profiles set locale = p_locale where id = p_user;
end; $$;

create or replace function public.cq_delete_account(p_secret text, p_user text)
returns text[] language plpgsql security definer set search_path = '' as $$
declare hashes text[];
begin
  perform cq_private.assert_secret(p_secret);
  select coalesce(array_agg(key_hash), '{}') into hashes from cq_private.api_keys where user_id = p_user;
  update cq_private.cache set expires_at = now() - interval '1 second'
  where key = any (select 'apikey:' || h from unnest(hashes) h);
  -- profiles cascade to api_keys and usage_logs
  delete from cq_private.profiles where id = p_user;
  delete from cq_private.quotas where user_id = p_user;
  return hashes;
end; $$;

-- ---------------------------------------------------------------------------
-- API keys management
-- ---------------------------------------------------------------------------
create or replace function public.cq_list_keys(p_secret text, p_user text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform cq_private.assert_secret(p_secret);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'type', type, 'key_prefix', key_prefix, 'allowed_origins', to_jsonb(allowed_origins),
      'created_at', created_at, 'last_used_at', last_used_at, 'revoked_at', revoked_at) order by created_at desc)
    from cq_private.api_keys where user_id = p_user), '[]'::jsonb);
end; $$;

create or replace function public.cq_create_key(
  p_secret text, p_user text, p_name text, p_type text, p_prefix text, p_hash text, p_origins text[], p_max_active int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r cq_private.api_keys;
begin
  perform cq_private.assert_secret(p_secret);
  perform pg_advisory_xact_lock(hashtext('cq_keys:' || p_user));
  if (select count(*) from cq_private.api_keys where user_id = p_user and revoked_at is null) >= p_max_active then
    return jsonb_build_object('error', 'key_limit_reached');
  end if;
  insert into cq_private.api_keys (user_id, name, type, key_prefix, key_hash, allowed_origins)
  values (p_user, p_name, p_type, p_prefix, p_hash, coalesce(p_origins, '{}'))
  returning * into r;
  return jsonb_build_object('record', jsonb_build_object(
    'id', r.id, 'name', r.name, 'type', r.type, 'key_prefix', r.key_prefix, 'allowed_origins', to_jsonb(r.allowed_origins),
    'created_at', r.created_at, 'last_used_at', r.last_used_at, 'revoked_at', r.revoked_at));
end; $$;

create or replace function public.cq_revoke_key(p_secret text, p_user text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare h text;
begin
  perform cq_private.assert_secret(p_secret);
  update cq_private.api_keys set revoked_at = coalesce(revoked_at, now())
  where id = p_id and user_id = p_user
  returning key_hash into h;
  if h is null then return jsonb_build_object('found', false); end if;
  -- Revocation is immediate: expire the cached key record.
  update cq_private.cache set expires_at = now() - interval '1 second' where key = 'apikey:' || h;
  return jsonb_build_object('found', true);
end; $$;

-- ---------------------------------------------------------------------------
-- Rate limit, quota, usage
-- ---------------------------------------------------------------------------
create or replace function public.cq_rate_limit(p_secret text, p_bucket text, p_limit int, p_window_seconds int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  win interval := make_interval(secs => p_window_seconds);
  now_ts timestamptz := clock_timestamp();
  cur_start timestamptz := to_timestamp(floor(extract(epoch from now_ts) / p_window_seconds) * p_window_seconds);
  prev_hits int;
  cur_hits int;
  weight double precision;
  estimate double precision;
begin
  perform cq_private.assert_secret(p_secret);
  select hits into prev_hits from cq_private.rate_limits where bucket = p_bucket and window_start = cur_start - win;
  select hits into cur_hits from cq_private.rate_limits where bucket = p_bucket and window_start = cur_start;
  weight := 1 - extract(epoch from (now_ts - cur_start)) / p_window_seconds;
  estimate := coalesce(prev_hits, 0) * weight + coalesce(cur_hits, 0);
  if estimate >= p_limit then
    return jsonb_build_object('success', false, 'limit', p_limit, 'remaining', 0,
      'reset', floor(extract(epoch from cur_start + win) * 1000));
  end if;
  insert into cq_private.rate_limits (bucket, window_start, hits) values (p_bucket, cur_start, 1)
  on conflict (bucket, window_start) do update set hits = cq_private.rate_limits.hits + 1
  returning hits into cur_hits;
  return jsonb_build_object('success', true, 'limit', p_limit,
    'remaining', greatest(0, floor(p_limit - (coalesce(prev_hits, 0) * weight + cur_hits))),
    'reset', floor(extract(epoch from cur_start + win) * 1000));
end; $$;

create or replace function public.cq_increment_quota(p_secret text, p_user text, p_month text, p_limit int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u int;
begin
  perform cq_private.assert_secret(p_secret);
  insert into cq_private.quotas (user_id, month, used) values (p_user, p_month, 1)
  on conflict (user_id, month) do update set used = cq_private.quotas.used + 1
  where cq_private.quotas.used < p_limit
  returning used into u;
  if u is null then
    return jsonb_build_object('allowed', false, 'used', p_limit);
  end if;
  return jsonb_build_object('allowed', true, 'used', u);
end; $$;

create or replace function public.cq_monthly_usage(p_secret text, p_user text, p_month text)
returns int language plpgsql security definer set search_path = '' as $$
begin
  perform cq_private.assert_secret(p_secret);
  return coalesce((select used from cq_private.quotas where user_id = p_user and month = p_month), 0);
end; $$;

create or replace function public.cq_log_usage(
  p_secret text, p_user text, p_key uuid, p_endpoint text, p_status int, p_latency int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform cq_private.assert_secret(p_secret);
  insert into cq_private.usage_logs (user_id, api_key_id, endpoint, status_code, latency_ms)
  values (p_user, p_key, left(p_endpoint, 64), p_status, greatest(p_latency, 0));
  -- last_used_at is updated at most once per minute and not for rejected (401) requests.
  if p_key is not null and p_status <> 401 then
    update cq_private.api_keys set last_used_at = now()
    where id = p_key and (last_used_at is null or last_used_at < now() - interval '1 minute');
  end if;
end; $$;

create or replace function public.cq_usage_summary(p_secret text, p_user text, p_days int default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare start_day timestamptz := date_trunc('day', now()) - make_interval(days => greatest(p_days, 1) - 1);
begin
  perform cq_private.assert_secret(p_secret);
  return (
    with recent as (
      select endpoint, status_code, latency_ms, created_at from cq_private.usage_logs
      where user_id = p_user and created_at >= start_day
    ), days as (
      select generate_series(start_day, date_trunc('day', now()), interval '1 day') as day
    )
    select jsonb_build_object(
      'daily', coalesce((select jsonb_agg(jsonb_build_object(
          'day', to_char(d.day, 'YYYY-MM-DD'),
          'requests', (select count(*) from recent r where date_trunc('day', r.created_at) = d.day),
          'errors', (select count(*) from recent r where date_trunc('day', r.created_at) = d.day and r.status_code >= 400)
        ) order by d.day) from days d), '[]'::jsonb),
      'endpoints', coalesce((select jsonb_agg(jsonb_build_object('endpoint', e.endpoint, 'requests', e.c) order by e.c desc)
        from (select endpoint, count(*) c from recent group by endpoint) e), '[]'::jsonb),
      'total', (select count(*) from recent),
      'errors', (select count(*) from recent where status_code >= 400),
      'avg_latency_ms', (select coalesce(round(avg(latency_ms)), 0) from recent)
    )
  );
end; $$;

create or replace function public.cq_list_logs(
  p_secret text, p_user text, p_endpoint text, p_status_min int, p_status_max int, p_offset int, p_limit int)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform cq_private.assert_secret(p_secret);
  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc) from (
      select l.id, l.endpoint, l.status_code, l.latency_ms, l.created_at, l.api_key_id,
             k.name as key_name, k.key_prefix
      from cq_private.usage_logs l left join cq_private.api_keys k on k.id = l.api_key_id
      where l.user_id = p_user
        and (p_endpoint is null or l.endpoint = p_endpoint)
        and (p_status_min is null or l.status_code >= p_status_min)
        and (p_status_max is null or l.status_code < p_status_max)
      order by l.created_at desc
      offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 101)
    ) x), '[]'::jsonb);
end; $$;

-- ---------------------------------------------------------------------------
-- Cache
-- ---------------------------------------------------------------------------
create or replace function public.cq_cache_get(p_secret text, p_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform cq_private.assert_secret(p_secret);
  return (select value from cq_private.cache where key = p_key and expires_at > now());
end; $$;

create or replace function public.cq_cache_set(p_secret text, p_key text, p_value jsonb, p_ttl_seconds int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform cq_private.assert_secret(p_secret);
  insert into cq_private.cache (key, value, expires_at) values (p_key, p_value, now() + make_interval(secs => p_ttl_seconds))
  on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at;
end; $$;

create or replace function public.cq_cache_del(p_secret text, p_keys text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform cq_private.assert_secret(p_secret);
  update cq_private.cache set expires_at = now() - interval '1 second' where key = any (p_keys);
end; $$;

-- ---------------------------------------------------------------------------
-- Tor exit list (stored as a cached JSON array)
-- ---------------------------------------------------------------------------
create or replace function public.cq_tor_status(p_secret text, p_ip text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare list jsonb; updated text;
begin
  perform cq_private.assert_secret(p_secret);
  select value into list from cq_private.cache where key = 'tor:exits';
  select value into updated from cq_private.config where key = 'tor_updated_at';
  return jsonb_build_object(
    'updated_at', updated,
    'has_list', list is not null and jsonb_array_length(list) > 0,
    'member', coalesce(list ? p_ip, false));
end; $$;

create or replace function public.cq_tor_replace(p_secret text, p_ips text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform cq_private.assert_secret(p_secret);
  if coalesce(array_length(p_ips, 1), 0) = 0 then return; end if;
  insert into cq_private.cache (key, value, expires_at) values ('tor:exits', to_jsonb(p_ips), now() + interval '7 days')
  on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at;
  insert into cq_private.config (key, value) values ('tor_updated_at', extract(epoch from now())::bigint::text)
  on conflict (key) do update set value = excluded.value;
end; $$;

-- ---------------------------------------------------------------------------
-- Function privileges: only the server (holding the app secret) can do anything
-- useful, but PostgREST needs EXECUTE for the publishable (anon) key.
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'cq\_%'
  loop
    execute format('revoke all on function %s from public', f.sig);
    execute format('grant execute on function %s to anon, authenticated, service_role', f.sig);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Housekeeping (pg_cron): 90-day log retention, expired cache, old buckets
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cyberqua-housekeeping') then
    perform cron.unschedule('cyberqua-housekeeping');
  end if;
  perform cron.schedule(
    'cyberqua-housekeeping',
    '17 * * * *',
    $cron$
      delete from cq_private.usage_logs where created_at < now() - interval '90 days';
      delete from cq_private.cache where expires_at < now();
      delete from cq_private.rate_limits where window_start < now() - interval '2 days';
      delete from cq_private.quotas where month < to_char(now() - interval '3 months', 'YYYY-MM');
    $cron$
  );
end;
$$;
