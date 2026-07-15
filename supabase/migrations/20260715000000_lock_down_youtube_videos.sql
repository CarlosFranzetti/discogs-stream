-- Security hardening (2026-07-15 audit): youtube_videos was created without RLS,
-- leaving it fully readable AND writable by anyone holding the public anon key —
-- a cache-poisoning vector (attacker rewrites video_id for an artist/title pair
-- and every user resolving that track plays the attacker's video).
--
-- Only the youtube-search edge function (service role) touches this table, so a
-- service-role-only policy matches the search_cache pattern and breaks nothing.

alter table public.youtube_videos enable row level security;

drop policy if exists "Service role full access" on public.youtube_videos;
create policy "Service role full access" on public.youtube_videos
  for all
  to service_role
  using (true)
  with check (true);
