create table if not exists track_media_links (
  id uuid default gen_random_uuid() primary key,
  discogs_username text not null,
  discogs_release_id integer not null,
  track_position text not null,
  track_title text,
  artist text,
  album text,
  provider text not null check (provider in ('youtube', 'bandcamp')),
  youtube_id text,
  bandcamp_embed_src text,
  bandcamp_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(discogs_username, discogs_release_id, track_position, provider)
);

create index if not exists idx_track_media_links_lookup
  on track_media_links(discogs_username, discogs_release_id, track_position);

alter table track_media_links enable row level security;

create policy "Service role full access" on track_media_links
  for all
  to service_role
  using (true)
  with check (true);

