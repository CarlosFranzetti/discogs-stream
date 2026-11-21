# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Discogs Vinyl Collection Streamer - A web app that streams your Discogs vinyl collection using YouTube as the playback provider. Users can import their collection/wantlist via CSV (no login required), connect a Discogs account via Settings, or try a session-only electro/techno demo crate. Tracks are resolved through a failsafe search chain (yt-dlp → YouTube scrape → Invidious → Piped → YouTube API) and metadata is persisted to a Supabase database for instant loads on return visits. Playback uses two engines: the YouTube iframe plays immediately and a direct `<audio>` engine takes over when a stream resolves (direct audio is not verified in production; see `memorystate.md`). The Bandcamp embed component was removed as dead code; its edge functions and the `bandcampEmbedSrc` data field remain, with no UI.

**Where project docs live**: `memorystate.md` = current state and deployment facts (read first); `FUTURE.md` = backlog, decisions, roadmap, ideas; `docs/HISTORY.md` = append-only engineering log; `PRD.md` = product requirements; `docs/CODEBASE-FUNCTIONS.md` = function reference.

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
npm run preview
```

## Architecture Overview

### Core Data Flow

1. **Authentication**: OAuth1 flow with Discogs via Supabase edge function (`discogs-auth`). OAuth is accessed through the Settings panel (gear icon) only — not the title screen.
2. **Collection Fetching**: Discogs API calls proxied through Supabase edge function (`discogs-api`) to avoid CORS and maintain credentials. CSV import is the primary path — no OAuth required.
3. **Media Resolution**: Multi-tier resolution system for finding playback sources:
   - First: Check Supabase database for saved track-to-media mappings (`track-media` edge function)
   - Second: Extract YouTube video IDs from Discogs release `videos` field (quota-free)
   - Third: `youtube-search` edge function → yt-dlp → YouTube results-page scrape (quota-free, no third-party dependency; expected primary tier in production) → Invidious → Piped → Official YouTube API (strictly last — the only tier that burns quota)
4. **Playback**: dual engine in `MobilePlayer`. The YouTube IFrame Player API (`YouTubePlayer.tsx`, youtube-nocookie iframe) plays immediately. In parallel `useDirectAudio` asks `invidious-audio` and `yt-dlp-audio` for a direct stream (9s client race; disabled for the session after 3 consecutive failures). If one resolves, `DirectAudioPlayer.tsx` (an `<audio>` element) takes over at the elapsed position; if the direct stream fails mid-track the iframe resumes at the elapsed position. The pitch fader (`usePitch`) only works on the direct engine because YouTube's `setPlaybackRate` snaps to its fixed rate set. `useMediaSession` provides lock-screen metadata and transport.

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
- The initial playlist is shuffled, so playback starts on a different random track every app load
- Toggling shuffle OFF restores the sorted sequential order; toggling ON randomizes from the current state
- Ordered context: third argument `options.orderedContextKey` (the active user playlist id, or null). While non-null, "shuffle off" means the given order instead of `sortSequential`; entering a playlist starts at its first track with shuffle off; leaving restores the listener's shuffle setting and keeps the playing track. `playFromContext({ shuffle?, startTrackId? })` restarts the current context and `requestContextStart(key, start)` queues how the next context switch starts (`MobilePlayer.handlePlayPlaylist` uses both)
- Keeping the current track: when the playlist array changes, the current index is re-anchored to the same track id during render (React's "adjust state when a value changes" pattern, keyed on the previous playlist array), not in an effect. An effect-based version never worked because an earlier effect overwrote the remembered id in the same commit. Consequences: toggling shuffle, newly resolved tracks, dislikes, and playlist reorder/remove all keep playback on the right track (if the current track is removed, the next one slides in)
- Skipping (next/prev/release-jump/select) always autoplays; MobilePlayer enforces it with a ~3s retry loop that survives engine remounts (direct-audio → iframe)
- Appends new verified tracks (with resolved media) to existing playlist without disrupting playback
- Uses interval-based time updates for progress tracking

**CSV Import System** (`useCSVCollection`, `csvParser`):
- Primary path for loading a collection — no Discogs OAuth required
- Parses Discogs CSV format and converts to Track objects
- On import: immediately writes all tracks to `discogs_track_cache` table via `upsertTracks`
- On return visit: loads cached tracks (with resolved YouTube IDs and cover art) from DB before background verifier starts
- Persists to localStorage for offline-first fallback
- `triggerImmediate()` from `useBackgroundVerifier` is called after import to start resolving the first track without waiting for the polling interval

**Discogs Diff-Sync** (`useDiscogsSync`, `src/services/discogsSync.ts`):
- Remote Discogs is the source of truth for OAuth-connected users
- Releases removed on Discogs are SOFT-deleted (rows flipped to `working_status='non_working'`) — cached rows are never hard-deleted by sync
- Likes/dislikes (`user_track_preferences`) are read-only from sync's perspective
- Pages upsert incrementally, so a mid-sync drop leaves valid state
- Auto-sync fires only once the local cache is known to be empty; returning users load from cache instantly and re-sync on demand ("Re-sync now")

**Cover Art Scraping** (`useCoverArtScraper`):
- Two-phase loading: instant (database cache) + background (Discogs API scraping)
- Batch loads cached covers from `release_cover_art` table on mount
- Rate-limited background scraping (1 request/second) for missing covers
- Stores scraped covers in database to avoid re-fetching
- Uses `discogs-public` edge function to fetch release data without authentication

**Background Verification** (`useBackgroundVerifier`):
- Automatically resolves media for tracks in background without blocking playback
- Priority queue: (1) current track, (2) next 3 upcoming tracks, (3) all pending tracks, (4) `non_working` tracks (retry at lower priority so transient failures self-heal)
- The `isQuotaExceeded` flag is NOT a guard for calling the edge function — it is used only for the status banner. The `youtube-search` edge function handles quota internally and still runs the quota-free tiers (scrape → Invidious → Piped) even after YouTube API quota is exceeded
- Exposes `triggerImmediate()` to force an immediate resolution cycle (called after CSV import)
- Post-processing delay: 500ms (down from 2000ms; slow searches self-throttle via their own timeouts)

**Dimmed Track UX** (`MobilePlaylistSheet`):
- `working` tracks: full opacity, click to play
- `pending` tracks (no YouTube ID yet): `opacity-75`, will resolve soon
- `non_working` tracks: `opacity-50`, click once to trigger silent background retry + show spinner badge on cover art; click again to play if resolved
- `retryingId` local state + `retriedOnce` ref per component tracks retry lifecycle
- No status text overlaid on cover art — small icon badge only (⊘ for non_working, spinner for retrying)

**Playlist Search & Crate-Digging Filters** (`MobilePlaylistSheet`):
- Search bar at the top of the playlist panel filters by title or artist in real time
- Filters are "one rail, one picker". `FacetRail` is a single horizontally scrolling, never-wrapping row of chips: Sort, then each facet (genre / label / decade / country) that has two or more values in the queue or a selection, then the Collection / Wantlist toggles. Applied filters show as removable chips in a second row, with "Clear all" and a "Save N as playlist" chip. There is no separate style facet — Discogs styles fold into `genre` at ingest
- Tapping a facet chip opens `FacetPicker`, which replaces the panel body (no second sheet): draft selection, search field when a facet has more than 8 values, no cap on values (at most 50 listed without a search), and an apply button stating the result count. Counts are disjunctive (computed over tracks matching the search and every OTHER facet), so values that would return nothing are not offered; row order is fixed while the picker is open. Sort is a chip that opens the same picker (Queue order, Artist, Title, Genre, Year, Label). OR within a facet, AND across facets; header shows "X of Y tracks" + filtered runtime
- All matching logic is in the pure module `src/lib/facets.ts` (`filterTracks`, `facetOptions`, `matchesSearch`, `matchesFacets`, `formatRuntime`, ...); the panel, the facet picker and the add-tracks picker all use it
- All filtering (search + facets) is display-only; the real playlist indices are preserved for correct `onSelectTrack` calls

**Virtualized Playlist** (`MobilePlaylistSheet`):
- Rows are virtualized with `@tanstack/react-virtual` over a plain overflow container (not Radix ScrollArea), so only visible rows mount (1800 tracks mount about 22 rows)
- The scroll element is held in state via a callback ref, not a `useRef`: the Sheet content mounts through a portal after the parent's layout effect, and a plain ref made the virtualizer see `null` and render zero rows
- Search spans title/artist/album/label/year, multi-term (all terms must match), 150ms debounce

**User Playlists** (`useUserPlaylists`):
- localStorage-backed (`discogs_stream_user_playlists_v1`), stores track ids, not copies, so playlists never go stale against library metadata; ids that no longer resolve are skipped at read time, not pruned
- The shape (id / name / trackIds / timestamps) matches a future `user_playlists` table
- Playing a playlist narrows `filteredTracks` in `MobilePlayer` instead of calling `setPlaylist`: `usePlayer` re-merges its input tracks on every library update and would clobber a hand-set list. Deleting the active playlist falls back to the full library. While a playlist is active it is played in its own order (`orderedContextKey`, see Player State)
- Playlists resolve against the whole library (`libraryTracks` prop = `verifiedTracks`), not the queue, because while a playlist plays the queue is that playlist
- Tapping a playlist in the Playlists tab opens `PlaylistEditor` (the row's play button still plays immediately). Listen mode: tap to play from a track, running set length per row, "Play in order" / "Shuffle". Edit mode: rename field, remove control, row-number chip opening "Move to position…", handle-only drag reorder (`touch-action: none` on the handle only; auto-scroll near edges; arrow keys on the handle), "Add tracks from library" (`AddTracksPicker`), delete
- Undo (6 s) for remove, move and delete is an in-panel notice bar, not a toast: a toast outside a modal Radix sheet cannot be tapped and would dismiss the sheet. Delete does not use `confirm()`
- Hook API beyond create/rename/delete: `moveItem` (exported helper), `moveTrack`, `moveTrackById` (id-based, safe against unresolved ids), `setPlaylistTracks` (used by Undo), `restorePlaylist` (Undo for delete)
- The Queue tab has no per-row remove; its "Playing <name>" banner has Edit (opens the editor) and Library (back to the full library)

**Demo Crate** (`src/data/demoCrate.ts`):
- 25 electro/techno records; offered on the title screen only while the library is empty
- Ids start with `demo-` (`isDemoTrack`). Demo tracks are never written to `discogs_track_cache` or localStorage, and any real import or cloud load replaces them rather than merging
- No hardcoded YouTube ids (the search chain resolves them); covers are generated SVG data URIs
- `?demo` query param loads the crate directly (used by the `/links` page)

### Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn-ui components (auto-generated)
│   ├── MobilePlayer.tsx # The player (route /) — top-level orchestrator
│   ├── MobilePlaylistSheet.tsx # Virtualized slide-in panel: Queue/Playlists tabs, search, facet rail, retry UX
│   ├── playlist/       # Playlist panel pieces
│   │   ├── FacetRail.tsx      # One-row chip rail + applied-filter chips
│   │   ├── FacetPicker.tsx    # Per-facet / sort picker that replaces the panel body
│   │   ├── PlaylistEditor.tsx # Listen/Edit view of one playlist (reorder, move, undo)
│   │   └── AddTracksPicker.tsx # Virtualized, searchable add-from-library list
│   ├── DirectAudioPlayer.tsx   # <audio> engine that takes over from the iframe
│   ├── MobileTitleScreen.tsx   # Title/import screen (CSV upload, Start Listening)
│   ├── SettingsDialog.tsx      # Settings panel (themes, CSV import/export, Discogs OAuth)
│   └── YouTubePlayer.tsx # YouTube IFrame wrapper (only playback surface)
├── pages/              # Route components
│   ├── Auth.tsx        # Discogs OAuth login
│   ├── Library.tsx     # Desktop player view (/library)
│   └── Index.tsx       # Landing page → MobilePlayer (/)
│   # /links is NOT a React route: vercel.json rewrites it to public/links.html
├── hooks/              # Custom React hooks
│   ├── useDiscogsAuth.ts        # OAuth flow management
│   ├── useDiscogsData.ts        # Collection/wantlist fetching
│   ├── useDiscogsSync.ts        # Diff-sync orchestration (auto-sync gating, progress)
│   ├── useTrackMediaResolver.ts # Media source resolution
│   ├── useDirectAudio.ts        # Asks invidious-audio + yt-dlp-audio for a direct stream URL
│   ├── useMediaSession.ts       # Lock-screen metadata/artwork + transport handlers
│   ├── useWantlistPrices.ts     # Rate-limited (1 req/s) marketplace price lookups for wantlist rows
│   ├── useUserPlaylists.ts      # localStorage playlists of track ids
│   ├── usePlayer.ts             # Player state + shuffle/sequential/ordered-context logic
│   ├── useAudioController.ts    # Unified volume/mute across YT player + HTML5 audio
│   ├── useBackgroundVerifier.ts # Background media resolution with priority queue
│   ├── useTrackCache.ts         # Supabase discogs_track_cache CRUD
│   ├── useYouTubeSearch.ts      # YouTube API search (+ yt-dlp/Invidious chain)
│   ├── useCoverArtScraper.ts    # Cover art scraping + DB cache
│   ├── useCSVCollection.ts      # CSV import state management
│   ├── useCsvTrackExpander.ts   # Expands CSV rows into tracks via discogs-public
│   ├── useTrackPreferences.ts   # Like/dislike persistence
│   ├── useKeyboardShortcuts.ts  # Desktop keyboard controls
│   ├── useSettings.ts           # localStorage app settings + change event
│   ├── useTheme.ts              # Theme switching (see Theme Classes gotcha)
│   └── useAuth.ts               # Supabase auth session state
├── services/
│   └── discogsSync.ts  # OAuth diff-sync engine (soft-delete, incremental upserts)
├── lib/                # Utilities
│   ├── discogs.ts      # Discogs data parsing
│   ├── csvParser.ts    # Discogs CSV parsing
│   ├── facets.ts       # Pure search/facet/sort/runtime logic for the playlist panel
│   ├── youtube.ts      # YouTube URL extraction
│   └── utils.ts        # cn() helper
├── types/              # TypeScript types
│   ├── track.ts        # Track interface (includes workingStatus, discogsTrackPosition)
│   └── youtube.d.ts    # YouTube IFrame API types
├── data/               # Static/mock data
│   ├── mockTracks.ts   # Development mock data + shuffleTracks()
│   ├── demoCrate.ts    # Session-only electro/techno demo crate (isDemoTrack)
│   └── discogsCache.ts # Discogs API caching utilities
├── test/
│   └── setup.ts        # Vitest setup file
└── integrations/
    └── supabase/       # Supabase client setup
public/
└── links.html          # Static link-in-bio page, served at /links via a vercel.json rewrite
```

### Supabase Edge Functions

Located in `supabase/functions/`:
- `discogs-auth`: OAuth1 token exchange
- `discogs-api`: Proxies Discogs API calls (collection, wantlist, release details)
- `discogs-public`: Fetches release data from Discogs without authentication (used for CSV imports and cover art)
- `youtube-search`: YouTube search with failsafe chain (yt-dlp → YouTube scrape → Invidious → Piped → YouTube API). yt-dlp is an instant no-op in Supabase's edge runtime (no subprocesses) but kept first for self-hosted deployments; the results-page scrape is the reliable quota-free tier
- `track-media`: CRUD for saved track-to-media mappings (stores YouTube IDs or Bandcamp embeds per release/track)
- `invidious-audio`: Extracts direct audio stream URLs; races the vetted Invidious instances, then Piped (`/streams/{id}`), within about 8s and prefers m4a (quota-free). `verify_jwt = true`
- `yt-dlp-audio`: Extracts audio URLs using yt-dlp; returns 501 `yt_dlp_unavailable` immediately on Supabase (no subprocesses), works only if self-hosted. `verify_jwt = true`
- `track-cache`: CRUD for `discogs_track_cache` table (persists track metadata across sessions). Writes/deletes on username-keyed rows require a valid HMAC session; `csv-*` capability keys pass as-is. `get` pages internally in 1000-row batches with no total cap (PostgREST's 1000-row response cap used to truncate collections >1000 tracks); client upserts are chunked at 500 rows/request
- `youtube-rescan-weekly`: Weekly link-health rescan — walks `discogs_track_cache`, re-runs the `youtube-search` chain, updates youtube1/youtube2 and flips `working_status`; logs to `rescan_log`. Scheduled via pg_cron `0 4 * * 0` (after daily YouTube quota reset); paced at ~100 rows/min (600ms between calls). Manual trigger: POST `{ "limit": N }`
- `_shared/session.ts`: Shared session helpers used across functions

### Database Tables

- `release_cover_art` - Caches Discogs cover art URLs to avoid re-scraping
- `discogs_track_cache` - Persists full track metadata (artist, title, album, genre, label, year, cover URLs, YouTube IDs, working_status) keyed by `owner_key + track_id`
- `track_media_links` - Saved track-to-media mappings (YouTube IDs / Bandcamp embeds per release/track position)
- `search_cache` / `youtube_videos` - YouTube search result caching
- `user_tokens` - Discogs OAuth tokens (server-side, used by sync/rescan)
- `rescan_log` - Audit log of weekly rescan passes

### Environment Variables

Required in `.env`:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key

Supabase edge functions require:
- `DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET` - OAuth credentials
- `YOUTUBE_API_KEY` - For YouTube search fallback (yt-dlp/Invidious run regardless)

### Important Implementation Details

**Track Identity**: Track IDs combine source, release ID, and position: `${source}-${releaseId}-${position}`. This allows the same release to appear in both collection and wantlist with distinct IDs.

**Media Provider Selection**: Tracks can carry both `youtubeId` and `bandcampEmbedSrc` (from saved `track_media_links` mappings), but only YouTube playback is wired into the live UI — `bandcampEmbedSrc` is currently data-only (the Bandcamp embed component was removed as dead code).

**YouTube Player Integration**: The app loads the YouTube IFrame API script dynamically and waits for the global `YT` object. Player instances are managed via refs to avoid recreation on re-renders.

**Caching Strategy**: `useTrackMediaResolver` caches at the release level (not track level) because Discogs release data and Supabase media mappings are stored per-release. This reduces API calls when playing multiple tracks from the same album. `useTrackCache` persists at the individual track level to the `discogs_track_cache` table.

**Content Security Policy**: Strict CSP in `vercel.json` allows YouTube/Bandcamp embeds while blocking other iframes. Media sources are explicitly whitelisted; `font-src` allows `fonts.gstatic.com` (Space Grotesk/Playfair) and `media-src 'self' https:` allows direct audio streams — without these, production silently blocks fonts and direct streams. `.vercelignore` uses `/supabase` (with leading slash) to exclude only the root supabase edge functions directory — not `src/integrations/supabase/`.

**Keyboard Shortcuts** (`useKeyboardShortcuts`): Space = play/pause, ←/→ = prev/next track, ↑/↓ = next/prev release, +/− = volume, M = mute, P = playlist, S = shuffle, O = options. Listeners ignore keypresses when focus is on input/textarea elements.

**Theme Classes** (`useTheme`): `ALL_THEME_CLASSES` must include every theme class the app has ever applied to `<html>` — classes are cleared before reapplying, and any class missing from the list gets stuck when switching away (this was a real bug). Legacy stored theme names (`theme-vintage`, `theme-neon-yellow`) are migrated on read.

**isUsingMockData**: Initialized as `!initialTracks || initialTracks.length === 0` so mock tracks only appear when there is genuinely no real data. On return visits with CSV data in localStorage, mock tracks never load.

**3-Second Auto-Skip**: When a track starts playing with no YouTube ID, a 3-second timeout fires `skipNext()` and marks the track `non_working`. The background verifier retries it later.

**Start Listening Sync**: When the user taps Start Listening, if `currentVideoId` is already preloaded for a track other than `playlist[currentIndex]`, the player syncs `currentIndex` to the preloaded track before showing the player view. This prevents displaying the wrong track name.

**LocalStorage Persistence**: CSV collections, wantlist, and track preferences (likes/dislikes) are stored in localStorage as offline-first fallback. Cloud persistence via `discogs_track_cache` is the primary layer for resolved metadata.

## Testing

Tests use Vitest + jsdom (`globals: true`, setup in `src/test/setup.ts`). Test files: `src/hooks/useYouTubeSearch.test.ts`, `src/hooks/usePlayer.test.ts`, `src/hooks/useUserPlaylists.test.ts`, `src/lib/csvParser.test.ts`, `src/lib/facets.test.ts`

Run specific test file:
```bash
npm test -- useYouTubeSearch.test.ts
```

## Deployment

Configured for Vercel deployment via `vercel.json`:
- SPA rewrites to `/index.html`
- Aggressive caching for `/assets/*` (immutable)
- Security headers (CSP, HSTS, X-Frame-Options, etc.)

Pushes to master auto-deploy the frontend to production. Edge functions deploy through `.github/workflows/deploy-edge-functions.yml`, always by name (verify_jwt rule and other deployment gotchas: `memorystate.md`, "Deployment facts that bite").

Manual deploy with Vercel CLI:
```bash
vercel --prod --yes
```
