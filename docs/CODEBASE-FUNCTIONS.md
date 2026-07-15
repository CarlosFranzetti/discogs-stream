# Codebase Functions Reference

Function-level documentation for `src/`. Reference material — see `CLAUDE.md` for architecture narrative.

Generated: 2026-05-20 · Last synced: 2026-07-15 (dead-code sweep) · Scope: `src/` excluding `test/` · UI primitives in appendix only

---

## Root

### `src/App.tsx`
- **`App`** — root component. No props. Wraps the app in `QueryClientProvider` + `BrowserRouter` + `ErrorBoundary` + `Toaster` + Vercel `Analytics`. Routes: `/` → `Index`, `/auth` → `Auth`, `/library` → `Library`, `*` → `NotFound`.

### `src/main.tsx`
- React strict-mode entry; renders `<App />` into `#root`.

---

## Pages

### `src/pages/Index.tsx`
- **`Index`** — renders `<MobilePlayer />`. Default route.

### `src/pages/Library.tsx`
- **`Library`** — desktop view with liked/disliked tabs. Uses `useAuth`, `useTrackPreferences`, `useNavigate`.
- **`TrackRow`** (internal) — props `{ track, onPlay, onRemove, isRemoving }`; renders cover + metadata + actions.

### `src/pages/Auth.tsx`
- **`Auth`** — sign in / sign up / reset password forms. Local state: `mode`, `email`, `password`, `error`, `successMessage`. Effects: redirect if `isAuthenticated`, handle `?reset=true`. Validation via `zod` (`emailSchema`, `passwordSchema`). Uses `useAuth.signIn / signUp / resetPassword`.

### `src/pages/NotFound.tsx`
- **`NotFound`** — 404 page; logs missing pathname to `console.error`.

---

## Hooks

### `src/hooks/usePlayer.ts`
- **`usePlayer(initialTracks?, dislikedTracks?)`**
  - **Returns** `{ playlist, currentTrack, currentIndex, isPlaying, currentTime, playerDuration, showVideo, playerRef, play, pause, togglePlay, skipNext, skipPrev, skipNextRelease, skipPrevRelease, seekTo, skipForward, skipBackward, selectTrack, toggleVideo, setCurrentIndex, setCurrentTime, setIsPlaying, setPlaylist, removeFromPlaylist, isShuffle, toggleShuffle }`
  - **State**: `playlist`, `currentIndex`, `isPlaying`, `currentTime`, `playerDuration`, `showVideo`, `isShuffle` (default true).
  - **Refs**: `playerRef` (YT.Player), `intervalRef` (time-update loop).
  - **Side effects**: rebuilds playlist when `initialTracks` or `dislikedTracks` change; sequential mode sorts by artist → album → year → position.
- **`sortSequential(tracks)`** (helper) — returns sorted copy.

### `src/hooks/useBackgroundVerifier.ts`
- **`useBackgroundVerifier({ tracks, currentTrack, isPlaying, searchForVideo, resolveMediaForTrack, updateTrack })`**
  - **Returns** `{ isVerifying, progress: { verified, total }, triggerImmediate() }`
  - **Priority queue**: current track → next 3 → pending → retry `non_working`.
  - **Side effects**: 3 s polling interval; 500 ms post-processing delay; in-place track updates via callback.

### `src/hooks/useTrackMediaResolver.ts`
- **`useTrackMediaResolver({ fetchRelease?, discogsUsername? })`**
  - **Returns** `{ resolveMediaForTrack(track, options?), prefetchForTracks(tracks) }`
  - **Caches (refs)**: `mediaByReleaseCache`, `pendingMediaFetch`, `releaseCache`, `pendingReleaseFetch` — all keyed by release id.
- **Internal**:
  - `getSavedMediaForRelease(releaseId)` → edge fn `track-media`.
  - `getRelease(releaseId)` → via injected `fetchRelease`.
  - `scoreVideoTitle(videoTitle, artist, trackTitle)` → Jaccard similarity.
- `resolveMediaForTrack` returns `{ provider, youtubeId?, youtubeCandidates?, bandcampEmbedSrc?, coverUrl?, coverUrls? }`. Precedence: saved mappings → Discogs release videos → cover images.

### `src/hooks/useCSVCollection.ts`
- **`useCSVCollection()`**
  - **Returns** `{ collection, wantlist, allTracks, hasCSVData, isLoading, error, loadCollectionCSV, loadWantlistCSV, clearCollection, clearWantlist, clearAll, updateTrack }`
  - **Storage**: `localStorage` keys `csv_collection`, `csv_wantlist`.
  - **Side effects**: `parseDiscogsCSV` per file; persists on each load/clear.

### `src/hooks/useCoverArtScraper.ts`
- **`useCoverArtScraper()`**
  - **Returns** `{ isScraping, progress: { completed, total, currentTrack }, scrapeCoverArt, batchLoadCoverArtFromDb, stopScraping }`
  - **Refs**: `abortControllerRef`, `isScrapingRef`.
- **Internal**:
  - `getCoverArtFromDb(releaseId)` → Supabase `release_cover_art`.
  - `batchLoadCoverArtFromDb(tracks, onTrackUpdate)` → batch select; per-hit callback.
  - `fetchCoverArt(releaseId)` → DB cache first, then edge fn `discogs-public`.
  - `storeCoverArtInDb(releaseId, coverUrl, thumbUrl?)` → upsert.
  - `scrapeCoverArt(tracks, onTrackUpdate, startFromFirst?)` → 1 req/s throttle; AbortController-cancellable.

### `src/hooks/useAuth.ts`
- **`useAuth()`**
  - **Returns** `{ user, session, isLoading, isAuthenticated, signIn, signUp, signOut, resetPassword }`
  - **Side effects**: Supabase `onAuthStateChange` listener; `getSession()` on mount.

### `src/hooks/useDiscogsAuth.ts`
- **`useDiscogsAuth()`**
  - **Returns** `{ credentials: { access_token, access_token_secret, username }?, isAuthenticated, isAuthenticating, error, startAuth(), logout() }`
  - **Storage**: `localStorage.discogs_credentials`, `sessionStorage.discogs_oauth_token_secret`.
  - **Flow**: `startAuth()` → edge fn `discogs-auth?action=request_token` → redirect to Discogs. On callback, exchanges `oauth_token` + `oauth_verifier` → fetches identity via `discogs-api?action=identity`.

### `src/hooks/useDiscogsData.ts`
- **`useDiscogsData(credentials?)`**
  - **Returns** `{ isLoading, error, fetchCollection, fetchWantlist, fetchPurchaseHistory, fetchAllTracks, fetchRelease }`
- **Internal**:
  - `callApi(action, params?)` → POST to edge fn `discogs-api`.
  - `releaseToTrack(release, source)` — placeholder cover + empty YouTube id.
  - `expandReleaseToTracks(release, source)` — fetches full release detail; expands tracklist (id, duration, position, cover from images).
  - `fetchAllTracks(maxPerSource)` — collection + wantlist with 3-concurrency; shuffles.

### `src/hooks/useYouTubeSearch.ts`
- **`useYouTubeSearch()`**
  - **Returns** `{ isSearching, isQuotaExceeded, searchForVideo, getSearchUrl, prefetchVideos, isTrackAvailability, verifyTracksAvailability, markAsUnavailable, clearCache }`
  - **Caches (in-memory)**: `videoCache` (Map), `unavailableCache` (Set).
  - **Refs**: `quotaExceededRef`, `pendingSearches`, `lastSearchTime` (500 ms throttle).
  - **`searchForVideo`** → edge fn `youtube-search` (yt-dlp → Invidious → API chain runs regardless of quota flag).
  - **`prefetchVideos(tracks)`** → 3-concurrency batches with 1 s delay between batches.
  - **`isTrackAvailable(track)`** → `true | false | null` (cached / has id / unknown).

### `src/hooks/useSettings.ts`
- **`useSettings()`**
  - **Returns** `{ settings: { pulseEnabled, rainbowPulse, playlistSize, showActivityMessages }, updateSetting(key, value) }`
  - **Storage**: `localStorage.app_settings`; emits custom event `app-settings-changed` for cross-hook sync.

### `src/hooks/useTheme.ts`
- **`useTheme()`**
  - **Returns** `{ theme, setTheme }`
  - **Themes**: `dark | theme-midnight | theme-neon-orange | theme-cyberpunk`. Migrates legacy `theme-vintage` → `theme-neon-orange` and `theme-neon-yellow` → `theme-cyberpunk`.
  - **Side effects**: writes `app_theme` to localStorage; toggles `documentElement.classList`.

### `src/hooks/useAudioController.ts`
- **`useAudioController()`** (NEW — Sub-project A)
  - **Returns** `{ volume, isMuted, setVolume, toggleMute, attachYTPlayer, attachAudioElement }`
  - **State**: `volume` (0–100), `isMuted`.
  - **Refs**: `ytPlayerRef`, `audioElRef`, `volumeRef`, `isMutedRef` (avoid stale-closure bugs in callbacks).
  - **`syncPlayers(vol, muted)`** — calls `mute/unMute + setVolume` on YT.Player, sets `.volume` + `.muted` on HTMLAudioElement.
  - `setVolume` clamps `[0, 100]` and unmutes; `toggleMute` preserves the prior volume level.

### `src/hooks/useTrackPreferences.ts`
- **`useTrackPreferences(userId?)`**
  - **Returns** `{ likedTracks, dislikedTracks, isLoading, likeTrack, dislikeTrack, isLiked, isDisliked, loadPreferences }`
  - **Side effects**: Supabase `track_preferences` table (select/upsert/delete by `user_id + track_id`).
  - **Mutual exclusion**: liking removes from disliked and vice versa.

### `src/hooks/useTrackCache.ts`
- **`useTrackCache()`**
  - **Returns** `{ upsertTracks, loadTracks, applyCachedMetadata, deleteTracks }`
  - **Helper**: `resolveOwnerKey(discogsUsername?)` → username or generated `csv-{uuid}`.
  - **`upsertTracks(ownerKey, tracks)`** → edge fn `track-cache?action=upsert` (caches `youtube1/2`, `cover1-4`, `working_status`).
  - **`loadTracks(ownerKey, source?)`** → returns `TrackCacheRow[]`.
  - **`applyCachedMetadata(tracks, rows)`** — merges cached covers, YouTube IDs, working status.
  - **`deleteTracks(ownerKey)`** → edge fn `track-cache?action=delete`.

### `src/hooks/useKeyboardShortcuts.ts`
- **`useKeyboardShortcuts({ onTogglePlay, onSkipPrev, onSkipNext, onTogglePlaylist?, onToggleShuffle?, onToggleOptions?, onVolumeUp?, onVolumeDown?, onToggleMute?, onSkipNextRelease?, onSkipPrevRelease? })`**
  - **Bindings**: Space, ←/→ (track), ↑/↓ (release), `+/-` (volume ±5), `M`, `P`, `S`, `O`.
  - **Side effects**: `window.addEventListener('keydown')` with cleanup; ignores `INPUT`/`TEXTAREA` targets.

### `src/hooks/useCsvTrackExpander.ts`
- **`useCsvTrackExpander()`**
  - **Returns** `{ expandRelease, expandAll }`
  - **`expandRelease(releasePlaceholder)`** → edge fn `discogs-public`; extracts tracklist + cover + release videos.
  - **`expandAll(releaseTracks, onProgress?)`** → 1 req/s throttle; deduplicates by release id.

### `src/hooks/use-mobile.tsx`
- **`useIsMobile()`** → `boolean` (`window.innerWidth < 768`); uses `matchMedia` listener.

### `src/hooks/use-toast.ts`
- Re-export of shadcn `useToast` hook.

### `src/hooks/useYouTubeSearch.test.ts`
- Vitest spec for the YouTube search hook (cache hits, throttle behavior, quota flag).

---

## Components

> Mobile components are the only player surface (`MobilePlayer` mounted at `/`). The legacy desktop player tree (`Player`, `PlaylistSidebar`, `AlbumArt`, `Timeline`, `TrackInfo`, `PlayerControls`, `BandcampPlayer`, `DirectAudioPlayer`) was removed 2026-07-15 as dead code; `/library` is the standalone `Library` page.

### `src/components/MobilePlayer.tsx`
- Top-level orchestrator for the mobile UI. Integrates every hook (`usePlayer`, `useDiscogsAuth`, `useDiscogsData`, `useCSVCollection`, `useYouTubeSearch`, `useBackgroundVerifier`, `useTrackMediaResolver`, `useCoverArtScraper`, `useAudioController`, `useTrackCache`, `useTrackPreferences`, `useKeyboardShortcuts`, `useTheme`, `useSettings`). Manages CSV import flow, title-screen → player transition, reset.

### `src/components/YouTubePlayer.tsx`
- **Props**: `{ videoId, searchQuery?, isPlaying, showVideo, playerRef, onStateChange, onError?, onReady }`
- Renders a `youtube-nocookie` iframe; lazy-loads the IFrame API script (`window.onYouTubeIframeAPIReady`).

### `src/components/MobileAlbumCover.tsx`
- Mobile cover with vinyl disc + dust particle effect. Click handler currently routes to play toggle (target for Sub-project B Now Playing trigger).

### `src/components/MobileTimeline.tsx`
- Seek bar + elapsed/remaining time display.

### `src/components/MobileTrackInfo.tsx`
- Artist · title · album · year display.

### `src/components/MobileTransportControls.tsx`
- Play/pause, skip, shuffle, volume, like/dislike.

### `src/components/MobilePlaylistSheet.tsx`
- Bottom-sheet playlist. Search-by-title/artist; renders dimmed `pending`/`non_working` tracks; per-track retry UX with spinner badge.

### `src/components/SourceFilters.tsx`
- **Type**: `SourceType = 'collection' | 'wantlist' | 'similar'`.
- **Props**: `{ selectedSources, onSourceChange }`.

### `src/components/QuotaBanner.tsx`
- Banner shown when `useYouTubeSearch.isQuotaExceeded` is true (UI-only signal; the chain still runs).

### `src/components/SettingsDialog.tsx`
- Theme picker, CSV import/export, Discogs OAuth, "Clear All Data". Currently uses native `confirm()` for destructive reset (Sub-project D will swap for shadcn `AlertDialog`).

### `src/components/MobileTitleScreen.tsx`
- Splash / CSV-upload screen; "Start Listening" CTA.

### `src/components/ErrorBoundary.tsx`
- Class component. **Props** `{ children }`. **State** `{ hasError, error }`. Renders error UI with reload / clear-cache options. Implements `getDerivedStateFromError` + `componentDidCatch`.

---

## Library

### `src/lib/discogs.ts`
- **`parseDiscogsDurationToSeconds(input)`** → `number | null`. Parses `MM:SS` and `H:MM:SS`.
- **`extractYouTubeIdsFromDiscogsRelease(release)`** → `string[]`. Scans `.videos[].uri`.
- **`extractYouTubeCandidatesFromDiscogsRelease(release)`** → `{ videoId, title? }[]`.

### `src/lib/youtube.ts`
- **`extractYouTubeVideoId(input)`** → `string | null`. Accepts full URL or raw 11-char id.

### `src/lib/csvParser.ts`
- **`parseDiscogsCSV(csvContent, source)`** → `Track[]`. Handles Discogs export CSV format.
- **`parseCSVLine(line)`** (helper) — quoted-field-aware splitter.

### `src/lib/utils.ts`
- **`cn(...inputs)`** → `string`. Tailwind-merge wrapper around `clsx`.
- **`calculateSimilarity(str1, str2)`** → `number` (Jaccard similarity, `[0, 1]`).

---

## Data

### `src/data/mockTracks.ts`
- **`mockTracks: Track[]`** — 20 sample tracks for dev/demo.
- **`shuffleTracks(tracks)`** — Fisher–Yates.

### `src/data/discogsCache.ts`
- **Type**: `DiscogsTracksCache = { discogsTracks, playableTracks, updatedAt }`.
- **`readDiscogsCache(username)`** → `DiscogsTracksCache | null` (30 min TTL).
- **`writeDiscogsCache(username, discogsTracks, playableTracks)`** → `void`.
- **`clearDiscogsCache(username)`** → `void`.

---

## Types

### `src/types/track.ts`
- **`Track`** — canonical shape across all hooks/components:
  - identifying: `id`, `source: 'collection' | 'wantlist' | 'similar'`, `discogsReleaseId?`, `discogsTrackPosition?`, `discogsTrackIndex?`
  - metadata: `title`, `artist`, `album`, `year`, `genre`, `label`, `country?`, `duration`
  - art: `coverUrl`, `coverUrls?`
  - playback: `youtubeId`, `youtubeCandidates?`, `bandcampEmbedSrc?`, `bandcampUrl?`, `playbackProvider?: 'youtube' | 'bandcamp'`
  - status: `workingStatus?: 'working' | 'non_working' | 'pending'`, `liked?`, `disliked?`
- **`Playlist`** — `{ id, name, tracks }`.

### `src/types/youtube.d.ts`
- Ambient declarations for the YouTube IFrame API global (`YT.Player`, `window.onYouTubeIframeAPIReady`).

---

## Integrations

### `src/integrations/supabase/client.ts`
- **`supabase`** — `createClient<Database>(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)`. Auth uses localStorage persistence + auto-refresh.

### `src/integrations/supabase/types.ts`
- Auto-generated `Database` interface. Tables: `release_cover_art`, `search_cache`, `track_media_links`, `track_preferences`, `youtube_videos`. (Note: `discogs_track_cache` is referenced via `track-cache` edge function rather than direct client queries.)
- Exports `Tables<T>`, `TablesInsert<T>`, `TablesUpdate<T>`, `Enums<T>`, `CompositeTypes<T>`.

---

## Appendix — shadcn/ui components (auto-generated)

`src/components/ui/`:

accordion · alert · alert-dialog · aspect-ratio · avatar · badge · breadcrumb · button · calendar · card · carousel · chart · checkbox · collapsible · command · context-menu · dialog · drawer · dropdown-menu · form · hover-card · input · input-otp · label · menubar · navigation-menu · pagination · popover · progress · radio-group · resizable · scroll-area · select · separator · sheet · sidebar · skeleton · slider · sonner · switch · table · tabs · textarea · toast · toaster · toggle · toggle-group · tooltip
