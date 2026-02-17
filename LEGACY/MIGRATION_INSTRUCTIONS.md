# Database Migration Instructions

## Apply Cover Art Table Migration

To enable cover art caching, you need to create the `release_cover_art` table in your Supabase database.

### Steps:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/pjosnahvpsgtcxwbxtci

2. Navigate to **SQL Editor** (in the left sidebar)

3. Click **New Query**

4. Copy and paste the following SQL:

```sql
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
```

5. Click **Run** (or press Ctrl/Cmd + Enter)

6. You should see a success message

### Verification

To verify the table was created successfully, run:

```sql
SELECT * FROM release_cover_art LIMIT 1;
```

It should return no rows (table is empty) without errors.

## What This Enables

- **Cover art caching**: Once scraped from Discogs, cover art URLs are stored in the database
- **Faster loading**: Subsequent CSV uploads will load cover art instantly from the database
- **API efficiency**: Reduces calls to Discogs API by reusing previously scraped data
