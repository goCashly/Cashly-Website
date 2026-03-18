create extension if not exists pgcrypto;

create table if not exists public.callback_requests (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  normalized_phone text not null,
  message text not null,
  source_page text,
  user_agent text,
  raw_payload jsonb not null,
  sync_status text not null default 'pending',
  matched_contact_id text,
  synced_at timestamptz,
  sync_notes text,
  submitted_at timestamptz not null default timezone('utc', now()),
  constraint callback_requests_sync_status_check
    check (sync_status in ('pending', 'reviewed', 'synced', 'ignored'))
);

alter table public.callback_requests
  add column if not exists normalized_phone text,
  add column if not exists raw_payload jsonb,
  add column if not exists sync_status text default 'pending',
  add column if not exists matched_contact_id text,
  add column if not exists synced_at timestamptz,
  add column if not exists sync_notes text;

alter table public.callback_requests
  alter column sync_status set default 'pending';

update public.callback_requests
set normalized_phone = coalesce(normalized_phone, phone)
where normalized_phone is null;

update public.callback_requests
set raw_payload = coalesce(
  raw_payload,
  jsonb_build_object(
    'first_name', first_name,
    'last_name', last_name,
    'email', email,
    'phone', phone,
    'message', message,
    'source_page', source_page,
    'user_agent', user_agent
  )
)
where raw_payload is null;

update public.callback_requests
set sync_status = 'pending'
where sync_status is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'callback_requests_sync_status_check'
  ) then
    alter table public.callback_requests
      add constraint callback_requests_sync_status_check
      check (sync_status in ('pending', 'reviewed', 'synced', 'ignored'));
  end if;
end $$;

alter table public.callback_requests
  alter column raw_payload set not null,
  alter column normalized_phone set not null;

alter table public.callback_requests
  alter column sync_status set not null;

create index if not exists idx_callback_requests_submitted_at
  on public.callback_requests (submitted_at desc);

create index if not exists idx_callback_requests_sync_status
  on public.callback_requests (sync_status);

create index if not exists idx_callback_requests_normalized_phone
  on public.callback_requests (normalized_phone);

drop index if exists public.idx_callback_requests_dedupe_key;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'callback_requests'
      and column_name = 'dedupe_key'
  ) then
    alter table public.callback_requests
      alter column dedupe_key drop not null;
  end if;
end $$;

drop function if exists public.upsert_callback_request(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
);

create table if not exists public.callback_request_rate_limits (
  ip_hash text primary key,
  request_count integer not null default 0,
  window_started_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

-- Compatibility note: the primary key stores a hashed server-side rate-limit key.
-- The edge function uses bucket prefixes such as attempt: and submission:.

alter table public.callback_request_rate_limits
  add column if not exists request_count integer default 0,
  add column if not exists window_started_at timestamptz default timezone('utc', now()),
  add column if not exists last_seen_at timestamptz default timezone('utc', now());

update public.callback_request_rate_limits
set request_count = 0
where request_count is null;

update public.callback_request_rate_limits
set window_started_at = timezone('utc', now())
where window_started_at is null;

update public.callback_request_rate_limits
set last_seen_at = timezone('utc', now())
where last_seen_at is null;

alter table public.callback_request_rate_limits
  alter column request_count set default 0,
  alter column window_started_at set default timezone('utc', now()),
  alter column last_seen_at set default timezone('utc', now());

alter table public.callback_request_rate_limits enable row level security;

revoke all on table public.callback_request_rate_limits from anon, authenticated;

create or replace function public.bump_callback_rate_limit(
  p_ip_hash text,
  p_window_seconds integer default 900,
  p_limit integer default 5
)
returns table(
  allowed boolean,
  request_count integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_window interval := make_interval(secs => p_window_seconds);
  v_row public.callback_request_rate_limits%rowtype;
begin
  -- p_ip_hash is a backwards-compatible parameter name and may contain any
  -- hashed rate-limit key, not only a raw IP hash.
  insert into public.callback_request_rate_limits as rate_limits (
    ip_hash,
    request_count,
    window_started_at,
    last_seen_at
  )
  values (
    p_ip_hash,
    1,
    v_now,
    v_now
  )
  on conflict (ip_hash) do update
  set
    request_count = case
      when rate_limits.window_started_at <= v_now - v_window then 1
      else rate_limits.request_count + 1
    end,
    window_started_at = case
      when rate_limits.window_started_at <= v_now - v_window then v_now
      else rate_limits.window_started_at
    end,
    last_seen_at = v_now
  returning * into v_row;

  allowed := v_row.request_count <= p_limit;
  request_count := v_row.request_count;

  if allowed then
    retry_after_seconds := 0;
  else
    retry_after_seconds := greatest(
      1,
      ceil(extract(epoch from ((v_row.window_started_at + v_window) - v_now)))::integer
    );
  end if;

  return next;
end;
$$;

revoke all on function public.bump_callback_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.bump_callback_rate_limit(text, integer, integer) to service_role;

alter table public.callback_requests enable row level security;

revoke all on table public.callback_requests from anon, authenticated;

drop policy if exists "Allow public callback inserts" on public.callback_requests;
