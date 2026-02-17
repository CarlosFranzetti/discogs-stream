# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Discogs Vinyl Collection Streamer - A web app that streams your Discogs vinyl collection using YouTube and Bandcamp as playback providers. Users can import their collection/wantlist via CSV (no login required) or connect a Discogs account via Settings. Tracks are resolved through a failsafe audio chain (yt-dlp → Invidious → YouTube API) and metadata is persisted to a Supabase database for instant loads on return visits.

## Development Commands

```bash
# Install dependencies
npm i

# Start development server (localhost:8080)
npm run dev

# Build for production
npm run build

# Build for development mode
npm run build:dev

# Run linter
npm run lint

# Run all tests
npm test

# Preview production build
npm preview
```

## Architecture Overview

### Core Data Flow

1. **Authentication**: OAuth1 flow with Discogs via Supabase edge function (`discogs-auth`). OAuth is accessed through the Settings panel (gear icon) only — not the title screen.
2. **Collection Fetching**: Discogs API calls proxied through Supabase edge function (`discogs-api`) to avoid CORS and maintain credentials. CSV import is the primary path — no OAuth required.
3. **Media Resolution**: Multi-tier resolution system for finding playback sources:
   - First: Check Supabase database for saved track-to-media mappings (`track-media` edge function)
   - Second: Extract YouTube video IDs from Discogs release `videos` field (quota-free)
   - Third: `youtube-search` edge function → yt-dlp (primary) → Invidious (fallback) → Official YouTube API (last resort, no quota guard blocking this chain)
4. **Direct Audio Extraction**: Once YouTube ID is found, extract direct audio URL:
   - First: Try yt-dlp (`yt-dlp-audio` edge function) - most reliable
   - Second: Fallback to Invidious API (`invidious-audio` edge function) - quota-free, multiple instance failover
   - Third: Final fallback to YouTube IFrame Player API
5. **Playback**: HTML5 `<audio>` element for direct streams, or YouTube IFrame API / Bandcamp embeds as fallback

### Key Architectural Patterns

**Media Resolution Strategy** (`useTrackMediaResolver`):
- Caches both Discogs release data and Supabase media mappings at the release level
- Uses deduplication to prevent duplicate API calls for same release
- Implements scoring algorithm to match YouTube videos to specific tracks by title/artist similarity
- Supports preferring different YouTube IDs when refreshing (to find alternative sources)

**Track Expansion** (`useDiscogsData`):
- Converts Discogs releases (collection/wantlist items) into individual tracks
- Fetches full release details including tracklist to create per-track entries
- Batches API calls with controlled concurrency (3 concurrent requests) to avoid rate limits

**Player State** (`usePlayer`):
- Manages YouTube player instance via `playerRef`
- Filters out disliked tracks dynamically
- `isShuffle` (default: `true`): when OFF, playlist is sorted by artist → album → year → track position (`sortSequential`); when ON, playlist is shuffled
- Toggling shuffle OFF restores the sorted sequential order; toggling ON randomizes from the current state
- Appends new verified tracks (with resolved media) to existing playlist without disrupting playback
- Uses interval-based time updates for progress tracking

**CSV Import System** (`useCSVCollection`, `csvParser`):
- Primary path for loading a collection — no Discogs OAuth required
- Parses Discogs CSV format and converts to Track objects
- On import: immediately writes all tracks to `discogs_track_cache` table via `upsertTracks`
- On return visit: loads cached tracks (with resolved YouTube IDs and cover art) from DB before background verifier starts
- Persists to localStorage for offline-first fallback
- `triggerImmediate()` from `useBackgroundVerifier` is called after import to start resolving the first track without waiting for the polling interval

**Cover Art Scraping** (`useCoverArtScraper`):
- Two-phase loading: instant (database cache) + background (Discogs API scraping)
- Batch loads cached covers from `release_cover_art` table on mount
- Rate-limited background scraping (1 request/second) for missing covers
- Stores scraped covers in database to avoid re-fetching
- Uses `discogs-public` edge function to fetch release data without authentication

**Background Verification** (`useBackgroundVerifier`):
- Automatically resolves media for tracks in background without blocking playback
- Priority queue: (1) current track, (2) next 3 upcoming tracks, (3) all pending tracks, (4) `non_working` tracks (retry at lower priority so transient failures self-heal)
- The `isQuotaExceeded` flag is NOT a guard for calling the edge function — it is used only for toast notifications. The `youtube-search` edge function handles quota internally and still runs yt-dlp → Invidious even after YouTube quota is exceeded
- Exposes `triggerImmediate()` to force an immediate resolution cycle (called after CSV import)
- Post-processing delay: 500ms (down from 2000ms; slow searches self-throttle via their own timeouts)

**Direct Audio Playback** (`useDirectAudio`, `DirectAudioPlayer`):
- Extracts direct audio stream URLs from YouTube to avoid iframe embedding
- Primary method: yt-dlp (reliable YouTube audio extraction)
- Fallback method: Invidious API (public instances with automatic failover)
- Uses HTML5 `<audio>` element for true background playback
- Completely quota-free and works without YouTube IFrame Player API
- Auto-falls back to YouTube iframe if both extraction methods fail

**Dimmed Track UX** (`PlaylistSidebar`, `MobilePlaylistSheet`):
- `working` tracks: full opacity, click to play
- `pending` tracks (no YouTube ID yet): `opacity-75`, will resolve soon
- `non_working` tracks: `opacity-50`, click once to trigger silent background retry + show spinner badge on cover art; click again to play if resolved
- `retryingId` local state + `retriedOnce` ref per component tracks retry lifecycle
- No status text overlaid on cover art — small icon badge only (⊘ for non_working, spinner for retrying)

**Playlist Search** (`MobilePlaylistSheet`, `PlaylistSidebar`):
- Search bar at the top of the playlist panel filters by title or artist in real time
- Filtering is display-only; the real playlist indices are preserved for correct `onSelectTrack` calls

### Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn-ui components (auto-generated)
│   ├── Player.tsx      # Desktop player component (secondary, via /library route)
│   ├── MobilePlayer.tsx # Mobile-optimized player (primary, via / route)
│   ├── MobilePlaylistSheet.tsx # Slide-in playlist panel with search + retry UX
│   ├── MobileTitleScreen.tsx   # Title/import screen (CSV upload, Start Listening)
│   ├── PlaylistSidebar.tsx     # Desktop playlist panel with search + retry UX
│   ├── SettingsDialog.tsx      # Settings panel (themes, CSV import/export, Discogs OAuth)
│   ├── YouTubePlayer.tsx # YouTube IFrame wrapper
│   ├── DirectAudioPlayer.tsx # HTML5 audio player for direct streams
│   └── BandcampPlayer.tsx # Bandcamp embed wrapper
├── pages/              # Route components
│   ├── Auth.tsx        # Discogs OAuth login
│   ├── Library.tsx     # Desktop player view (/library)
│   └── Index.tsx       # Landing page → MobilePlayer (/)
├── hooks/              # Custom React hooks
│   ├── useDiscogsAuth.ts        # OAuth flow management
│   ├── useDiscogsData.ts        # Collection/wantlist fetching
│   ├── useTrackMediaResolver.ts # Media source resolution
│   ├── usePlayer.ts             # Player state + shuffle/sequential logic
│   ├── useBackgroundVerifier.ts # Background media resolution with priority queue
│   ├── useTrackCache.ts         # Supabase discogs_track_cache CRUD
│   ├── useYouTubeSearch.ts      # YouTube API search (+ yt-dlp/Invidious chain)
│   ├── useDirectAudio.ts        # yt-dlp/Invidious audio URL extraction
│   ├── useCoverArtScraper.ts    # Cover art scraping + DB cache
│   ├── useCSVCollection.ts      # CSV import state management
│   └── useTrackPreferences.ts   # Like/dislike persistence
├── lib/                # Utilities
│   ├── discogs.ts      # Discogs data parsing
│   ├── youtube.ts      # YouTube URL extraction
│   └── utils.ts        # cn() helper
├── types/              # TypeScript types
│   ├── track.ts        # Track interface (includes workingStatus, discogsTrackPosition)
│   └── youtube.d.ts    # YouTube IFrame API types
├── data/               # Static/mock data
│   ├── mockTracks.ts   # Development mock data + shuffleTracks()
│   └── discogsCache.ts # Discogs API caching utilities
└── integrations/
    └── supabase/       # Supabase client setup
```

### Supabase Edge Functions

Located in `supabase/functions/`:
- `discogs-auth`: OAuth1 token exchange
- `discogs-api`: Proxies Discogs API calls (collection, wantlist, release details)
- `discogs-public`: Fetches release data from Discogs without authentication (used for CSV imports and cover art)
- `youtube-search`: YouTube search with failsafe chain (yt-dlp → Invidious → YouTube API)
- `track-media`: CRUD for saved track-to-media mappings (stores YouTube IDs or Bandcamp embeds per release/track)
- `invidious-audio`: Extracts direct audio stream URLs from YouTube via Invidious API (quota-free, multiple instance failover)
- `yt-dlp-audio`: Extracts audio URLs using yt-dlp (primary direct audio method)
- `track-cache`: CRUD for `discogs_track_cache` table (persists track metadata across sessions)
- `run-migration`: Database migration runner

### Database Tables

- `release_cover_art` - Caches Discogs cover art URLs to avoid re-scraping
- `discogs_track_cache` - Persists full track metadata (artist, title, album, genre, label, year, cover URLs, YouTube IDs, working_status) keyed by `owner_key + track_id`
- `track_media_links` - Saved track-to-media mappings (YouTube IDs / Bandcamp embeds per release/track position)

### Environment Variables

Required in `.env`:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key

Supabase edge functions require:
- `DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET` - OAuth credentials
- `YOUTUBE_API_KEY` - For YouTube search fallback (yt-dlp/Invidious run regardless)

### Important Implementation Details

**Track Identity**: Track IDs combine source, release ID, and position: `${source}-${releaseId}-${position}`. This allows the same release to appear in both collection and wantlist with distinct IDs.

**Media Provider Selection**: Tracks can have both `youtubeId` and `bandcampEmbedSrc`. The `playbackProvider` field determines which is used. Bandcamp is preferred when available (from saved mappings).

**YouTube Player Integration**: The app loads the YouTube IFrame API script dynamically and waits for the global `YT` object. Player instances are managed via refs to avoid recreation on re-renders.

**Caching Strategy**: `useTrackMediaResolver` caches at the release level (not track level) because Discogs release data and Supabase media mappings are stored per-release. This reduces API calls when playing multiple tracks from the same album. `useTrackCache` persists at the individual track level to the `discogs_track_cache` table.

**Content Security Policy**: Strict CSP in `vercel.json` allows YouTube/Bandcamp embeds while blocking other iframes. Media sources are explicitly whitelisted. `.vercelignore` uses `/supabase` (with leading slash) to exclude only the root supabase edge functions directory — not `src/integrations/supabase/`.

**Keyboard Shortcuts**: Desktop player supports keyboard controls (Space = play/pause, `,` = previous track, `.` = next track). Event listeners ignore keypresses when focus is on input/textarea elements.

**isUsingMockData**: Initialized as `!initialTracks || initialTracks.length === 0` so mock tracks only appear when there is genuinely no real data. On return visits with CSV data in localStorage, mock tracks never load.

**3-Second Auto-Skip**: When a track starts playing with no YouTube ID, a 3-second timeout fires `skipNext()` and marks the track `non_working`. The background verifier retries it later.

**Start Listening Sync**: When the user taps Start Listening, if `currentVideoId` is already preloaded for a track other than `playlist[currentIndex]`, the player syncs `currentIndex` to the preloaded track before showing the player view. This prevents displaying the wrong track name.

**LocalStorage Persistence**: CSV collections, wantlist, and track preferences (likes/dislikes) are stored in localStorage as offline-first fallback. Cloud persistence via `discogs_track_cache` is the primary layer for resolved metadata.

## Testing

Tests use Vitest + jsdom. Example test file: `src/hooks/useYouTubeSearch.test.ts`

Run specific test file:
```bash
npm test -- useYouTubeSearch.test.ts
```

## Deployment

Configured for Vercel deployment via `vercel.json`:
- SPA rewrites to `/index.html`
- Aggressive caching for `/assets/*` (immutable)
- Security headers (CSP, HSTS, X-Frame-Options, etc.)

Deploy with Vercel CLI:
```bash
vercel --prod --yes
```
