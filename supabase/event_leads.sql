create extension if not exists pgcrypto;

-- Dedicated intake table for in-person event lead capture (QR code -> form).
-- Kept separate from public.callback_requests and public.contacts so a busy
-- event booth can never affect CRM data or the website callback pipeline.
create table if not exists public.event_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  normalized_phone text not null,
  company text not null,
  position text not null,
  event_name text not null default 'Sales Growth Academy',
  source_page text,
  user_agent text,
  raw_payload jsonb not null,
  sync_status text not null default 'pending',
  submitted_at timestamptz not null default timezone('utc', now()),
  constraint event_leads_sync_status_check
    check (sync_status in ('pending', 'reviewed', 'synced', 'ignored'))
);

create index if not exists idx_event_leads_submitted_at
  on public.event_leads (submitted_at desc);

create index if not exists idx_event_leads_event_name
  on public.event_leads (event_name);

alter table public.event_leads enable row level security;

-- Only the Edge Function (using the service role key) can read or write.
-- No anon/authenticated policies are created, matching callback_requests.
revoke all on table public.event_leads from anon, authenticated;

-- Reuses the existing public.bump_callback_rate_limit(...) function and its
-- public.callback_request_rate_limits table (see callback_requests.sql) for
-- basic abuse protection, with a distinct bucket prefix ("event-lead-...").
-- No new rate-limit infrastructure is needed.
