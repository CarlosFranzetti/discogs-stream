-- Phase 3: Discogs OAuth Diff-Sync
-- D-01: user_tokens keyed by Discogs username (no auth.users FK)
-- D-12: rescan_log for weekly youtube link-health scan

create table if not exists public.user_tokens (
  username text primary key,
  discogs_token text not null,
  discogs_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_rescan_at timestamptz
);

alter table public.user_tokens enable row level security;

-- Deny all client access; service-role (edge functions) bypasses RLS.
-- Client never touches this table directly — only via the discogs-auth /
-- discogs-api edge functions which authenticate via signed session token.
drop policy if exists "user_tokens_no_client_access" on public.user_tokens;
create policy "user_tokens_no_client_access" on public.user_tokens
  for all
  using (false)
  with check (false);

create index if not exists user_tokens_last_sync_idx on public.user_tokens (last_sync_at);

create table if not exists public.rescan_log (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  tracks_checked integer not null default 0,
  links_updated integer not null default 0,
  status_flipped_working integer not null default 0,
  status_flipped_non_working integer not null default 0,
  errors integer not null default 0,
  note text
);

alter table public.rescan_log enable row level security;

drop policy if exists "rescan_log_read_anon" on public.rescan_log;
create policy "rescan_log_read_anon" on public.rescan_log
  for select
  using (true);

create index if not exists rescan_log_ran_at_idx on public.rescan_log (ran_at desc);
