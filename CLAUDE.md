# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Discogs Vinyl Collection Streamer - A web app that streams your Discogs vinyl collection using YouTube and Bandcamp as playback providers. Users authenticate with Discogs OAuth, browse their collection/wantlist, and play tracks resolved from Discogs release data.

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

1. **Authentication**: OAuth1 flow with Discogs via Supabase edge function (`discogs-auth`)
2. **Collection Fetching**: Discogs API calls proxied through Supabase edge function (`discogs-api`) to avoid CORS and maintain credentials
3. **Media Resolution**: Multi-tier resolution system for finding playback sources:
   - First: Check Supabase database for saved track-to-media mappings (`track-media` edge function)
   - Second: Extract YouTube video IDs from Discogs release `videos` field
   - Third: Fallback to YouTube search API if needed
4. **Direct Audio Extraction**: Once YouTube ID is found, extract direct audio URL:
   - First: Try Invidious API (`invidious-audio` edge function) - no quota, fast
   - Second: Fallback to yt-dlp (`yt-dlp-audio` edge function) - reliable extraction
   - Third: Final fallback to YouTube IFrame Player API
5. **Playback**: HTML5 audio element for direct streams, or YouTube IFrame API / Bandcamp embeds as fallback

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
- Appends new verified tracks (with resolved media) to existing playlist without disrupting playback
- Uses interval-based time updates for progress tracking

**CSV Import System** (`useCSVCollection`, `csvParser`):
- Allows users to upload Discogs collection/wantlist CSV exports without OAuth authentication
- Parses Discogs CSV format and converts to Track objects
- Persists imported data to localStorage for offline-first experience
- Supports updating tracks with resolved media (YouTube IDs, cover art) and persisting changes
- Tracks are cached locally so re-opening the app loads instantly

**Cover Art Scraping** (`useCoverArtScraper`):
- Two-phase loading: instant (database cache) + background (Discogs API scraping)
- Batch loads cached covers from `release_cover_art` table on mount
- Rate-limited background scraping (1 request/second) for missing covers
- Stores scraped covers in database to avoid re-fetching
- Uses `discogs-public` edge function to fetch release data without authentication

**Background Verification** (`useBackgroundVerifier`):
- Automatically resolves media for tracks in background without blocking playback
- Prioritizes currently playing track and upcoming tracks
- Auto-skips tracks without playable media
- Quota-free verification using Discogs release `videos` field before falling back to YouTube search

**Direct Audio Playback** (`useDirectAudio`, `DirectAudioPlayer`):
- Extracts direct audio stream URLs from YouTube to avoid iframe embedding
- Primary method: Invidious API (public instances with automatic failover)
- Fallback method: yt-dlp (reliable YouTube audio extraction)
- Uses HTML5 `<audio>` element for true background playback
- Completely quota-free and works without YouTube IFrame Player API
- Auto-falls back to YouTube iframe if both extraction methods fail

### Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn-ui components (auto-generated)
│   ├── Player.tsx      # Desktop player component
│   ├── MobilePlayer.tsx # Mobile-optimized player
│   ├── YouTubePlayer.tsx # YouTube IFrame wrapper
│   ├── DirectAudioPlayer.tsx # HTML5 audio player for direct streams
│   └── BandcampPlayer.tsx # Bandcamp embed wrapper
├── pages/              # Route components
│   ├── Auth.tsx        # Discogs OAuth login
│   ├── Library.tsx     # Main player view
│   └── Index.tsx       # Landing page
├── hooks/              # Custom React hooks
│   ├── useDiscogsAuth.ts      # OAuth flow management
│   ├── useDiscogsData.ts      # Collection/wantlist fetching
│   ├── useTrackMediaResolver.ts # Media source resolution
│   ├── usePlayer.ts           # Player state management
│   ├── useYouTubeSearch.ts    # YouTube API search
│   ├── useDirectAudio.ts      # Invidious/yt-dlp audio URL extraction
│   └── useTrackPreferences.ts # Like/dislike persistence
├── lib/                # Utilities
│   ├── discogs.ts      # Discogs data parsing
│   ├── youtube.ts      # YouTube URL extraction
│   └── utils.ts        # cn() helper
├── types/              # TypeScript types
│   ├── track.ts        # Track interface
│   └── youtube.d.ts    # YouTube IFrame API types
├── data/               # Static/mock data
│   ├── mockTracks.ts   # Development mock data
│   └── discogsCache.ts # Discogs API caching utilities
└── integrations/
    └── supabase/       # Supabase client setup
```

### Supabase Edge Functions

Located in `supabase/functions/`:
- `discogs-auth`: OAuth1 token exchange
- `discogs-api`: Proxies Discogs API calls (collection, wantlist, release details)
- `discogs-public`: Fetches release data from Discogs without authentication (used for CSV imports)
- `youtube-search`: YouTube Data API v3 search wrapper
- `track-media`: CRUD for saved track-to-media mappings (stores YouTube IDs or Bandcamp embeds per release/track)
- `invidious-audio`: Extracts direct audio stream URLs from YouTube via Invidious API (quota-free, multiple instance failover)
- `yt-dlp-audio`: Extracts audio URLs using yt-dlp as fallback (requires yt-dlp binary on server)
- `run-migration`: Database migration runner

### Environment Variables

Required in `.env`:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key

Supabase edge functions require:
- `DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET` - OAuth credentials
- `YOUTUBE_API_KEY` - For YouTube search fallback

Supabase database tables:
- `release_cover_art` - Caches Discogs cover art URLs to avoid re-scraping (see `supabase/migrations/`)

### Important Implementation Details

**Track Identity**: Track IDs combine source, release ID, and position: `${source}-${releaseId}-${position}`. This allows the same release to appear in both collection and wantlist with distinct IDs.

**Media Provider Selection**: Tracks can have both `youtubeId` and `bandcampEmbedSrc`. The `playbackProvider` field determines which is used. Bandcamp is preferred when available (from saved mappings).

**YouTube Player Integration**: The app loads the YouTube IFrame API script dynamically and waits for the global `YT` object. Player instances are managed via refs to avoid recreation on re-renders.

**Caching Strategy**: `useTrackMediaResolver` caches at the release level (not track level) because Discogs release data and Supabase media mappings are stored per-release. This reduces API calls when playing multiple tracks from the same album.

**Content Security Policy**: Strict CSP in `vercel.json` allows YouTube/Bandcamp embeds while blocking other iframes. Media sources are explicitly whitelisted.

**Keyboard Shortcuts**: Desktop player supports keyboard controls (Space = play/pause, , = previous track, . = next track). Event listeners ignore keypresses when focus is on input/textarea elements.

**LocalStorage Persistence**: CSV collections, wantlist, and track preferences (likes/dislikes) are stored in localStorage. This creates an offline-first experience where CSV imports remain available across sessions without re-uploading.

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
