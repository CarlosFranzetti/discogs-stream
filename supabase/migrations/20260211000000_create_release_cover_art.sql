-- Create table for storing Discogs release cover art URLs
CREATE TABLE IF NOT EXISTS release_cover_art (
  release_id BIGINT PRIMARY KEY,
  cover_url TEXT,
  thumb_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE release_cover_art ENABLE ROW LEVEL SECURITY;

-- Allow all users to read cover art (it's public data)
CREATE POLICY "Anyone can read cover art" ON release_cover_art
  FOR SELECT
  USING (true);

-- Allow all authenticated users to insert/update (for scraping)
CREATE POLICY "Anyone can insert cover art" ON release_cover_art
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update cover art" ON release_cover_art
  FOR UPDATE
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_release_cover_art_release_id ON release_cover_art(release_id);
