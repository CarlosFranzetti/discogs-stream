# Discogs Stream — All Sprints Design
**Date:** 2026-04-22  
**Status:** Approved

---

## Sub-project A — Foundation Fixes

### useAudioController (new hook)
Single source of truth for volume (0–100) and mute state per route. Exposes `setVolume`, `toggleMute`, `attachYTPlayer`, `attachAudioElement`. On every state change, syncs the attached YT player via `setVolume()`/`mute()`/`unMute()` and the audio element via `.volume` (scaled 0–1) and `.muted`. A volume gesture (setVolume) always unmutes. Mute preserves the previous volume level.

### Keyboard shortcuts (updated)
| Key | Action |
|---|---|
| Space | play/pause |
| ← | previous track |
| → | next track |
| ↑ | skip to first track of next release |
| ↓ | skip to first track of previous release |
| + | volume +5% |
| - | volume -5% |
| M | toggle mute |
| P | toggle playlist |
| S | toggle shuffle |
| O | toggle options |

Old `,`/`.` shortcuts removed. `useKeyboardShortcuts` gains optional callbacks: `onVolumeUp`, `onVolumeDown`, `onToggleMute`, `onSkipNextRelease`, `onSkipPrevRelease`.

### skipNextRelease / skipPrevRelease (added to usePlayer)
Walk the live playlist array from `currentIndex`. Next release: find first index where `discogsReleaseId` differs. Prev release: walk backwards past the current release boundary, then find the first track of that prior release. Both operate on the shuffled/sequential playlist order.

### Reset bug fix
`onClearData` in `MobilePlayer` must call `setHasUserInteracted(false)` so the title screen renders after reset. All other ref/state resets already present.

### console.log cleanup
Remove all `console.log` and `console.error` calls from source files. Keep only genuine error paths that surface actionable information (none found that qualify).

---

## Sub-project B — Now Playing Panel

### NowPlayingPanel (new component)
Bottom `Sheet` (shadcn/ui) triggered by tapping the album art in `MobileAlbumCover`. Shows: artist, label, catalogue number, country, year, all genres/styles, format, marketplace prices (low/median/high). Actions: "Open on Discogs" (external link), "Add to Wantlist" button, purchase link. Spring animation via Sheet's built-in transition. Closes on swipe-down or tap outside.

### useNowPlayingData (new hook)
Fetches release detail from Discogs via the `discogs-public` Supabase edge function (no auth required). Fetches marketplace stats via `https://api.discogs.com/marketplace/stats/{releaseId}` (public endpoint, no auth). Results cached in a `Map<releaseId, data>` ref for the session lifetime; stale after 1 hour (checked via timestamp). Returns `{ releaseDetail, marketplaceStats, isLoading, error }`.

---

## Sub-project C — Discogs OAuth Sync

### discogsSync.ts (new service)
Fetches full collection + wantlist pages from the `discogs-api` edge function. Diffs against current `discogs_track_cache` rows by `track_id`. Upserts new tracks; marks removed tracks with `working_status = 'non_working'` (soft delete, preserves user data). Page-by-page upsert makes it resume-safe on network drop.

### useDiscogsSync (new hook)
Exposes `{ isSyncing, lastSyncAt, syncError, syncNow }`. Auto-syncs on mount when Discogs credentials are present. Writes `lastSyncAt` to localStorage. Wires into `SettingsDialog` to show last sync timestamp and a manual re-sync button.

### discogs-api edge function extension
Add `GET /collection/full` and `GET /wantlist/full` routes that paginate through all Discogs pages and return flat arrays of release objects (same shape as existing endpoints).

---

## Sub-project D — Tests + Security

### Tests (Vitest)
- `useAudioController.test.ts`: volume clamp, mute toggle, player sync
- `resetState.test.ts`: after reset, tracks empty, localStorage cleared
- `useNowPlayingData.test.ts`: cache hit, stale check, error state

### Security hardening
- CSP in `vercel.json`: already strong; add `invidious` instance domains to `media-src` and `connect-src`
- CSV parser: validate that URL fields (cover art) are `https://` before using
- Replace `confirm()` in `SettingsDialog` with a proper `AlertDialog` (shadcn/ui) — no XSS vector but improves UX consistency and avoids browser dialog blocking
- All user-facing strings passed through React (no `innerHTML`/`dangerouslySetInnerHTML`) — confirmed safe

### Performance
- Audit `MobilePlayer` `useCallback`/`useMemo` deps for unnecessary re-renders
- `batchLoadCoverArtFromDb` currently fires on every `discogsTracks.length` change — guard with a Set of already-loaded release IDs
- `upsertTracks` debounce already 500ms — confirm no duplicate calls on rapid track patches
