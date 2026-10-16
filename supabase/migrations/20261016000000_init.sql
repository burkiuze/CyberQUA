-- CyberQUA initial schema
-- Authentication is handled by Clerk. User ids are Clerk user ids (text, e.g. "user_2abc...").
-- The application talks to Postgres exclusively from the server with the Supabase secret key.
-- RLS is still enabled everywhere as defence in depth; the policies below match the Clerk
-- session JWT (`sub` claim) if you enable Clerk as a third-party auth provider in Supabase.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            text primary key check (char_length(id) between 1 and 64),
  display_name  text check (display_name is null or char_length(display_name) <= 120),
  plan          text not null default 'free' check (plan in ('free', 'pro')),
  locale        text not null default 'tr' check (locale in ('tr', 'en')),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- api_keys — only the SHA-256 hash and a 12 character display prefix are stored
-- ---------------------------------------------------------------------------
create table if not exists public.api_keys (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null references public.profiles(id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 50),
  type             text not null check (type in ('secret', 'publishable')),
  key_prefix       text not null check (char_length(key_prefix) = 12),
  key_hash         text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  allowed_origins  text[] not null default '{}',
  created_at       timestamptz not null default now(),
  last_used_at     timestamptz,
  revoked_at       timestamptz
);

create index if not exists api_keys_user_id_idx on public.api_keys (user_id, created_at desc);

-- At most 5 active keys per user, enforced in the database as well (race-safe).
create or replace function public.enforce_active_key_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.user_id));
  if (select count(*) from public.api_keys where user_id = new.user_id and revoked_at is null) >= 5 then
    raise exception 'active_key_limit' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists api_keys_active_limit on public.api_keys;
create trigger api_keys_active_limit
  before insert on public.api_keys
  for each row execute function public.enforce_active_key_limit();

-- ---------------------------------------------------------------------------
-- usage_logs — never stores request bodies, IPs or queried values
-- ---------------------------------------------------------------------------
create table if not exists public.usage_logs (
  id           bigint generated always as identity primary key,
  user_id      text not null references public.profiles(id) on delete cascade,
  api_key_id   uuid references public.api_keys(id) on delete set null,
  endpoint     text not null check (char_length(endpoint) <= 64),
  status_code  smallint not null,
  latency_ms   integer not null check (latency_ms >= 0),
  created_at   timestamptz not null default now()
);

create index if not exists usage_logs_user_created_idx on public.usage_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.api_keys   enable row level security;
alter table public.usage_logs enable row level security;

alter table public.profiles   force row level security;
alter table public.api_keys   force row level security;
alter table public.usage_logs force row level security;

-- Users may only see their own rows (Clerk JWT `sub` claim).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.jwt() ->> 'sub') = id);

drop policy if exists "api_keys_select_own" on public.api_keys;
create policy "api_keys_select_own" on public.api_keys
  for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "usage_logs_select_own" on public.usage_logs;
create policy "usage_logs_select_own" on public.usage_logs
  for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);

-- No insert/update/delete policies: key creation and revocation only happen in
-- server routes after a session check, using the secret key.

-- Column-level privileges: key_hash is never readable by API clients.
revoke all on public.profiles, public.api_keys, public.usage_logs from anon, authenticated;
grant select (id, display_name, plan, locale, created_at) on public.profiles to authenticated;
grant select (id, user_id, name, type, key_prefix, allowed_origins, created_at, last_used_at, revoked_at)
  on public.api_keys to authenticated;
grant select (id, user_id, api_key_id, endpoint, status_code, latency_ms, created_at)
  on public.usage_logs to authenticated;

-- Safe view for key listings (security_invoker → RLS of the caller applies).
create or replace view public.api_keys_safe
with (security_invoker = true) as
  select id, user_id, name, type, key_prefix, allowed_origins, created_at, last_used_at, revoked_at
  from public.api_keys;

revoke all on public.api_keys_safe from anon;
grant select on public.api_keys_safe to authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard aggregation (server-side only)
-- ---------------------------------------------------------------------------
create or replace function public.usage_summary(p_user_id text, p_days integer default 30)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with recent as (
    select endpoint, status_code, latency_ms, created_at
    from public.usage_logs
    where user_id = p_user_id
      and created_at >= date_trunc('day', now()) - make_interval(days => greatest(p_days, 1) - 1)
  ),
  days as (
    select generate_series(
      date_trunc('day', now()) - make_interval(days => greatest(p_days, 1) - 1),
      date_trunc('day', now()),
      interval '1 day'
    ) as day
  )
  select jsonb_build_object(
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', to_char(d.day, 'YYYY-MM-DD'),
        'requests', (select count(*) from recent r where date_trunc('day', r.created_at) = d.day),
        'errors', (select count(*) from recent r where date_trunc('day', r.created_at) = d.day and r.status_code >= 400)
      ) order by d.day)
      from days d
    ), '[]'::jsonb),
    'endpoints', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', e.endpoint, 'requests', e.c) order by e.c desc)
      from (select endpoint, count(*) as c from recent group by endpoint) e
    ), '[]'::jsonb),
    'total', (select count(*) from recent),
    'errors', (select count(*) from recent where status_code >= 400),
    'avg_latency_ms', (select coalesce(round(avg(latency_ms)), 0) from recent)
  );
$$;

revoke all on function public.usage_summary(text, integer) from public, anon, authenticated;
grant execute on function public.usage_summary(text, integer) to service_role;

revoke all on function public.enforce_active_key_limit() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retention: delete usage logs older than 90 days (pg_cron)
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cyberqua-purge-usage-logs') then
    perform cron.unschedule('cyberqua-purge-usage-logs');
  end if;
  perform cron.schedule(
    'cyberqua-purge-usage-logs',
    '17 3 * * *',
    $cron$delete from public.usage_logs where created_at < now() - interval '90 days'$cron$
  );
end;
$$;
