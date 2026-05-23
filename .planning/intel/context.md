# Context (DOC Intel)

Two DOC sources ingested:
- `/Users/carlosfranzetti/Documents/GITHUB/discogs-stream/CLAUDE.md` — project guidance for Claude Code
- `/Users/carlosfranzetti/Documents/GITHUB/discogs-stream/docs/superpowers/plans/2026-04-22-all-sprints.md` — task-by-task implementation plan

---

## Topic: Project Overview
- source: CLAUDE.md
- Discogs Vinyl Collection Streamer — web app that streams a Discogs vinyl collection via YouTube and Bandcamp.
- Users import via CSV (no login) OR connect Discogs OAuth via Settings.
- Tracks resolved via failsafe chain: yt-dlp → Invidious → YouTube API; metadata persisted to Supabase for instant return-visit loads.

## Topic: Dev Commands
- source: CLAUDE.md
- `npm i`, `npm run dev` (port 8080), `npm run build`, `npm run build:dev`, `npm run lint`, `npm test`, `npm preview`
- Run a specific test: `npm test -- useYouTubeSearch.test.ts`
- Deploy: `vercel --prod --yes`

## Topic: Data Flow (current implementation)
- source: CLAUDE.md
- Auth: OAuth1 via Supabase edge function `discogs-auth`
- Collection fetching: proxied via `discogs-api` edge function; CSV import is primary path (no OAuth)
- Media resolution tiers: (1) Supabase `track-media` lookup → (2) Discogs release `videos` → (3) `youtube-search` (yt-dlp → Invidious → YouTube API)
- Direct audio extraction: yt-dlp → Invidious → YouTube IFrame fallback
- Playback: HTML5 `<audio>` for direct streams; YouTube IFrame / Bandcamp embeds as fallback

## Topic: Architectural Patterns (current)
- source: CLAUDE.md
- Media resolver caches at release level (not track level)
- Track expansion: 3 concurrent requests max; Discogs rate limit respected
- Player state: `isShuffle` defaults `true`; sequential sort = artist → album → year → track position
- CSV import system: immediate DB write to `discogs_track_cache`; `triggerImmediate()` kicks off background verifier
- Background verifier priority: current → next 3 → all pending → non_working retries; 500 ms post-processing delay
- Cover art scraper: 2-phase (DB cache + background scrape at 1 req/s)
- 3-second auto-skip on missing YouTube ID
- Dimmed track UX: working = full opacity; pending = opacity-75; non_working = opacity-50 with retry-on-click
- Playlist search bar filters by title/artist; preserves real indices

## Topic: Keyboard Shortcuts (CURRENT — superseded)
- source: CLAUDE.md
- DESCRIBED CURRENT STATE: Space = play/pause, `,` = previous track, `.` = next track
- NOTE: This is superseded by the all-sprints-design SPEC which removes `,`/`.` and adopts arrow + +/- mapping. See `constraints.md` (CONSTRAINT-keyboard-shortcuts) and INGEST-CONFLICTS.md.

## Topic: Project Structure (current)
- source: CLAUDE.md
- src/components/, src/pages/, src/hooks/, src/lib/, src/types/, src/data/, src/integrations/supabase/
- Pages: Auth, Library (desktop /library), Index (mobile /)
- Mobile components are primary (`MobilePlayer`, `MobilePlaylistSheet`, `MobileTitleScreen`, etc.)

## Topic: Edge Functions (current)
- source: CLAUDE.md
- discogs-auth, discogs-api, discogs-public, youtube-search, track-media, invidious-audio, yt-dlp-audio, track-cache, run-migration

## Topic: DB Tables (current)
- source: CLAUDE.md
- release_cover_art, discogs_track_cache, track_media_links
- NOTE: TDD.md SPEC adds user_tokens and user_track_preferences as planned

## Topic: Env Vars
- source: CLAUDE.md
- `.env`: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
- Edge function env: DISCOGS_CONSUMER_KEY, DISCOGS_CONSUMER_SECRET, YOUTUBE_API_KEY

## Topic: Implementation Conventions
- source: CLAUDE.md
- Track ID = `{source}-{releaseId}-{position}`
- Playback provider chooser: Bandcamp preferred when available
- CSP strict in `vercel.json`; `.vercelignore` uses `/supabase` (leading slash) to exclude only the edge functions root
- `isUsingMockData` initialized so mock tracks never load on return visits with localStorage data
- 3-second auto-skip + background retry
- Start Listening sync: if `currentVideoId` is preloaded for a track ≠ `playlist[currentIndex]`, syncs `currentIndex` before showing player

## Topic: Testing
- source: CLAUDE.md
- Vitest + jsdom; example: `src/hooks/useYouTubeSearch.test.ts`

## Topic: Deployment
- source: CLAUDE.md
- Vercel via `vercel.json`: SPA rewrites to `/index.html`; immutable caching for `/assets/*`; security headers (CSP, HSTS, X-Frame-Options)
- Deploy: `vercel --prod --yes`

---

## Topic: All-Sprints Implementation Plan (task plan)
- source: docs/superpowers/plans/2026-04-22-all-sprints.md
- Task-by-task implementation plan covering four sub-projects (A: Foundation Fixes, B: Now Playing Panel, C: Discogs OAuth Sync, D: Tests + Security)
- Encodes the design SPEC into concrete file-by-file checklist tasks
- Sub-project A tasks:
  - Create `src/hooks/useAudioController.ts` (full source provided)
  - Update `src/hooks/useKeyboardShortcuts.ts` (full source provided)
  - Add `skipNextRelease`/`skipPrevRelease` to `usePlayer`
  - Wire shortcuts into `MobilePlayer` and `Player`
  - Reset bug fix: `setHasUserInteracted(false)` in `onClearData`
  - Console cleanup pass
- Sub-project B tasks:
  - Create `NowPlayingPanel.tsx`
  - Create `useNowPlayingData` hook
  - Extend `discogs-public` edge function (marketplace stats)
  - Wire panel into `MobileAlbumCover` tap target
- Sub-project C tasks:
  - Extend `discogs-api` edge function with `/collection/full`, `/wantlist/full`
  - Create `discogsSync` service + `useDiscogsSync` hook
  - Wire into `SettingsDialog` (last sync timestamp, manual re-sync)
  - Replace `confirm()` with `AlertDialog`
- Sub-project D tasks:
  - Vitest suites: useAudioController, resetState, useNowPlayingData
  - CSP additions for Invidious in `vercel.json`
  - CSV URL `https://` validation in `csvParser`
  - `useCoverArtScraper` dedup set
  - `MobilePlayer` memo/callback dep audit
- Goal: implement four sub-projects in order, no push/deploy from the plan itself.
