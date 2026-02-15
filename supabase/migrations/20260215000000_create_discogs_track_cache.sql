create table if not exists discogs_track_cache (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  source text not null check (source in ('collection', 'wantlist', 'similar')),
  track_id text not null,
  release_id bigint,
  track_position text,
  artist text not null,
  title text not null,
  album text,
  genre text,
  label text,
  year integer,
  country text,
  cover1 text,
  cover2 text,
  cover3 text,
  cover4 text,
  youtube1 text,
  youtube2 text,
  working_status text not null default 'pending' check (working_status in ('working', 'non_working', 'pending')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(owner_key, track_id)
);

create index if not exists idx_discogs_track_cache_owner_source
  on discogs_track_cache(owner_key, source);

create index if not exists idx_discogs_track_cache_owner_release
  on discogs_track_cache(owner_key, release_id);

alter table discogs_track_cache enable row level security;

create policy "Service role full access on track cache" on discogs_track_cache
  for all
  to service_role
  using (true)
  with check (true);
