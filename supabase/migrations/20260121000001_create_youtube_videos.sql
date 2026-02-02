create table if not exists youtube_videos (
  id uuid default gen_random_uuid() primary key,
  artist text not null,
  title text not null,
  video_id text not null,
  channel_title text,
  thumbnail text,
  duration_iso text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(artist, title)
);

create index if not exists idx_youtube_videos_artist_title on youtube_videos(artist, title);
