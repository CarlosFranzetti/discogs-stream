# Cover Art Scraping - Deployment & Testing Guide

## Overview

The cover art scraping system is now fully implemented and ready to test. It will:
- ✅ Load cover art immediately from database (if previously scraped)
- ✅ Scrape missing cover art in background from Discogs API
- ✅ Update player and playlist in real-time as covers load
- ✅ Cache all scraped covers in database for future use

## Required Setup Steps

### 1. Deploy Edge Function

Deploy the new `discogs-public` edge function to Supabase:

```bash
# Login to Supabase CLI (if not already logged in)
npx supabase login

# Link to your project
npx supabase link --project-ref pjosnahvpsgtcxwbxtci

# Deploy the discogs-public function
npx supabase functions deploy discogs-public

# Verify deployment
curl -X POST https://pjosnahvpsgtcxwbxtci.supabase.co/functions/v1/discogs-public \
  -H "Content-Type: application/json" \
  -d '{"release_id": 178127}'
```

Expected response:
```json
{
  "id": 178127,
  "title": "The Dark Side Of The Moon",
  "thumb": "https://...",
  "cover_image": "https://...",
  "artists": [...],
  "year": 1973,
  "genres": [...]
}
```

### 2. Create Database Table

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/pjosnahvpsgtcxwbxtci)
2. Navigate to **SQL Editor**
3. Run the migration from `MIGRATION_INSTRUCTIONS.md`

Or use the migration runner (if service role key is available):
```bash
# Set environment variable
export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Run migration via edge function
curl -X POST https://pjosnahvpsgtcxwbxtci.supabase.co/functions/v1/run-migration
```

### 3. Set Environment Variables

Ensure these are set in Supabase Functions configuration:
- `DISCOGS_CONSUMER_KEY` - Your Discogs API consumer key
- `DISCOGS_CONSUMER_SECRET` - Your Discogs API consumer secret

## Testing the Cover Art Scraping

### Test File Included

A test CSV file is included: `test-collection.csv`

It contains 3 classic albums:
- Pink Floyd - The Dark Side of the Moon (release_id: 178127)
- The Beatles - Abbey Road (release_id: 24047)
- Led Zeppelin - Led Zeppelin IV (release_id: 1543269)

### Testing Steps

1. **Start the app**:
   ```bash
   npm run dev
   ```

2. **Open the app**: http://localhost:8080

3. **Upload test CSV**:
   - Click "Upload Collection CSV"
   - Select `test-collection.csv`

4. **Watch for toast notifications**:
   - "Loaded 3 collection items from CSV"
   - "Loaded X covers from database" (if any were cached)
   - "Fetching remaining cover art..."
   - "Cover art loaded for 3 tracks"

5. **Verify cover art appears**:
   - ✅ Cover art should appear immediately for cached releases
   - ✅ Cover art should progressively appear as they're scraped (1 per second)
   - ✅ Player should show the current track's cover
   - ✅ Playlist (Menu → Up Next) should show all covers

6. **Check console logs**:
   ```
   Cover art found in DB for release 178127
   Cover art fetched and stored for release 24047
   Loaded 1 cover arts from database
   Starting cover art scraping for 2 tracks
   Cover art scraping completed: 2/2 covers found
   ```

### Testing Database Caching

1. **First upload**: Should scrape all covers from Discogs (slow, 1/sec)
2. **Clear data**: Settings → Clear Data
3. **Second upload**: Should load instantly from database (fast)

### Verify Database Storage

Run this SQL in Supabase SQL Editor:
```sql
SELECT release_id, cover_url, created_at
FROM release_cover_art
ORDER BY created_at DESC
LIMIT 10;
```

You should see the scraped cover art URLs stored with timestamps.

## Troubleshooting

### Issue: "Fetching cover art in background..." but no covers appear

**Check:**
1. Edge function deployed? Test with curl command above
2. DISCOGS_CONSUMER_KEY set in Supabase? Check Function settings
3. Console errors? Open browser DevTools → Console

### Issue: "Table does not exist" errors

**Solution:**
- Run the migration SQL from `MIGRATION_INSTRUCTIONS.md`
- The app will still work without the table (just no caching)

### Issue: Rate limit errors

**Cause:** Discogs API limits to 60 requests/minute
**Solution:** The scraper rate-limits to 1 request/second (safe)

### Issue: Covers don't update in player/playlist

**Check:**
1. Open DevTools → Console
2. Look for: "Cover art fetched and stored for release X"
3. Verify updateTrack is being called
4. Check if playlist is re-rendering (should see playlist effect logs)

## What's Happening Behind the Scenes

### Data Flow:

```
CSV Upload
  ↓
Parse tracks with release IDs
  ↓
[IMMEDIATE] Batch load cached covers from DB
  ↓
updateTrack() for each cached cover
  ↓
UI updates with cached covers
  ↓
[BACKGROUND] Start scraping missing covers
  ↓
For each release:
  - Check DB (might be cached now)
  - If not cached, fetch from Discogs API
  - Store in DB
  - updateTrack()
  - UI updates
  - Wait 1 second (rate limit)
  ↓
All covers loaded!
```

### Reactive Update Chain:

```
updateTrack()
  → useCSVCollection state updates
  → allTracks updates (memoized)
  → csvAllTracks effect runs
  → discogsTracks updates
  → verifiedTracks updates
  → filteredTracks updates (memoized)
  → playlist updates
  → Player/Playlist UI re-renders
```

## Performance Notes

- **First load**: ~3 seconds for 3 tracks (1 per second scraping)
- **Subsequent loads**: Instant (from database)
- **Database queries**: Single batch query for all releases (efficient)
- **API calls**: Only for uncached releases (minimal)

## Success Criteria

✅ Cover art appears immediately for cached releases
✅ Cover art progressively loads for new releases
✅ Player shows current track cover art
✅ Playlist shows all track cover art
✅ Database stores scraped covers
✅ No errors in console
✅ Toast notifications guide user

Enjoy your fully-functional cover art scraping system! 🎨✨
