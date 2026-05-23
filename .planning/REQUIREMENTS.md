# Requirements

**Source:** Synthesized from `PRD.md` v2.0, `TDD.md` v2.0, and `docs/superpowers/specs/2026-04-22-all-sprints-design.md` (approved).
**Date:** 2026-05-20

Requirement IDs use category prefixes. Each v1 requirement maps to exactly one phase (see `ROADMAP.md`).

---

## A. Foundation / Player Hardening (Sub-project A — SHIPPED in commit `6a1d48f`)

### REQ-A1-audio-controller
Single source of truth for volume + mute across HTML5 `<audio>` and YouTube IFrame.
- `useAudioController` hook owns `volume` (0–100) and `isMuted`.
- `setVolume()` always unmutes; `toggleMute()` preserves previous volume.
- `attachAudioElement()` and `attachYTPlayer()` wire both engines through the same hook.
- Refs (`volumeRef`, `isMutedRef`) prevent stale-callback bugs.
- No desync between slider position and engine volume on player swap.

### REQ-A2-keyboard-shortcuts
Authoritative shortcut mapping (SPEC variant, supersedes PRD `,`/`.` mapping):
- Space → play/pause
- ← → previous track
- → → next track
- ↑ → skip to first track of next release
- ↓ → skip to first track of previous release
- `+` → volume +5 %
- `-` → volume -5 %
- `M` → toggle mute
- `P` → toggle playlist sheet
- `S` → toggle shuffle
- `O` → toggle options
- Listeners ignore keypresses while focus is on `input`/`textarea`.
- Cleanup on unmount.

### REQ-A3-skip-release
`usePlayer` exposes `skipNextRelease()` and `skipPrevRelease()` that walk the live playlist by `discogsReleaseId` from the current index, in both shuffle and sequential modes.

### REQ-A4-reset-bug-fix
`onClearData` in `MobilePlayer` calls `setHasUserInteracted(false)` so the title screen re-renders after a reset; no stale state lingers.

### REQ-A5-console-cleanup
Production `console.log` calls removed from `MobilePlayer`, `Player`, `DirectAudioPlayer`, `YouTubePlayer`, and `usePlayer`. Only structured errors remain.

---

## B. Now Playing Panel (Sub-project B — P1 NEXT)

### REQ-B1-now-playing-panel-ui
A bottom slide-up sheet showing the currently playing release in detail.
- Triggered from the mobile album-cover tap target.
- Shows: artist, label, catalogue #, country, year, all genres, all styles.
- Renders large cover art with the same source the player is using.
- Spring animation on open; closes on swipe-down or tap-outside.

### REQ-B2-now-playing-data-hook
`useNowPlayingData(track)` hook fetches release detail (`discogs-public` edge function) and marketplace stats.
- Returns `{ releaseDetail, marketplaceStats, isLoading, error }`.
- Session cache in a `Map<releaseId, data>` ref; entries stale after 1 hour.
- Real-time re-fetch when the playing track changes.

### REQ-B3-marketplace-stats
Marketplace pricing (lowest, median, highest) for the playing release.
- Source: `https://api.discogs.com/marketplace/stats/{releaseId}` (public, no auth required).
- Routed through `discogs-public` edge function with a new `marketplace` action to share CORS/back-off plumbing.
- Cached alongside release detail (1-hour TTL).

### REQ-B4-now-playing-actions
Actions inside the panel:
- Add to wantlist (calls `onAddToWantlist(releaseId)`)
- Add to collection (calls `onAddToCollection(releaseId)`)
- Open on Discogs (opens release page in new tab)
- Purchase link (opens marketplace listing in new tab)
- Panel `props` interface matches `CONSTRAINT-now-playing-panel-props` exactly.

---

## C. Discogs OAuth Diff-Sync (Sub-project C — P0)

### REQ-C1-oauth-from-settings
OAuth1 flow is reachable **only** from the Settings panel (gear icon). The title screen never offers OAuth.

### REQ-C2-user-tokens-table
`user_tokens` Supabase table stores `discogs_token`, `discogs_secret`, `username` per `auth.users.id`.
- RLS enabled: a row is readable/writable only by its owning `auth.uid()`.
- Tokens never enter localStorage.

### REQ-C3-edge-paginated-fetch
`discogs-api` edge function gains two new actions:
- `collection_full` — paginates the user's full collection, returns a flat array.
- `wantlist_full` — paginates the user's full wantlist, returns a flat array.
- Same response shape as the existing per-page endpoints.

### REQ-C4-diff-sync-service
`src/services/discogsSync.ts` performs an incremental, resume-safe sync.
- Fetches full collection + wantlist page-by-page via the edge function.
- Diffs against current `discogs_track_cache` rows by `track_id`.
- Upserts new tracks; marks removed tracks `working_status = 'non_working'` (soft delete).
- Page-by-page upsert is resume-safe if the network drops mid-sync.
- **Local likes/dislikes are never overwritten** (preserves `user_track_preferences`).

### REQ-C5-sync-hook
`useDiscogsSync` hook returns `{ isSyncing, lastSyncAt, syncError, syncNow }`.
- Auto-syncs once on mount when Discogs credentials are present.
- `lastSyncAt` persisted to localStorage for cross-session display.

### REQ-C6-settings-sync-ui
Settings panel shows:
- Last sync timestamp (or "never synced").
- A manual "Re-sync now" button that calls `syncNow()`.
- Sync error surface (toast or inline).

### REQ-C7-rate-limit-safe
Sync respects Discogs's 60 req/min ceiling with exponential back-off; a slow connection or rate-limit response never throws — it pauses and resumes.

---

## D. Tests, Security, Performance (Sub-project D — P0/P1 hardening)

### REQ-D1-vitest-coverage
Vitest suites added:
- `src/hooks/useAudioController.test.ts` — volume clamp, mute toggle, player sync.
- `src/services/discogsSync.test.ts` — diff add/remove, soft-delete of removed releases, preferences never overwritten.
- `src/hooks/useNowPlayingData.test.ts` — cache hit, 1-hour stale check, error state.

### REQ-D2-alert-dialog
Replace native `window.confirm()` calls in `SettingsDialog` (and any other component using it) with shadcn/ui `AlertDialog`. No native confirms remain.

### REQ-D3-csp-hardening
`vercel.json` CSP updated:
- Invidious instance domains added to `media-src` and `connect-src` (whitelist, not wildcard).
- No new wildcard sources introduced.
- All user-supplied strings continue to flow through React (no `innerHTML` / `dangerouslySetInnerHTML`).

### REQ-D4-csv-url-validation
`csvParser` validates that cover-art and any URL fields start with `https://` before use. Non-conforming URLs are dropped (not rendered, not stored).

### REQ-D5-cover-art-dedup
`useCoverArtScraper.batchLoadCoverArtFromDb` is guarded by a `Set<releaseId>` ref of already-loaded releases so it does not re-fire on every `discogsTracks.length` change.
`upsertTracks` confirmed to debounce at 500 ms with no duplicate calls under rapid CSV import.

---

## Cross-Cutting Goals (PRD §6)

These are not standalone requirements — they are validated *through* the requirements above:

- Time-to-first-play (return visit) < 5 s
- Sessions with ≥ 3 tracks played > 60 %
- Re-import rate < 5 %
- Track resolution success rate > 85 %
- Discogs link click-through per session > 15 %

---

## Out-of-Scope (v2 backlog, not v1 requirements)

- Auto-import wantlist → collection after Purchase
- Marketplace price caching TTL tunable per release
- BPM / key detection
- Native / Electron app
- Social features
- Listing / selling

---

## Traceability

Every v1 requirement maps to exactly one phase.

| Requirement | Phase | Status |
|---|---|---|
| REQ-A1-audio-controller | Phase 1 | DONE (commit `6a1d48f`) |
| REQ-A2-keyboard-shortcuts | Phase 1 | DONE (commit `6a1d48f`) |
| REQ-A3-skip-release | Phase 1 | DONE (commit `6a1d48f`) |
| REQ-A4-reset-bug-fix | Phase 1 | DONE (commit `6a1d48f`) |
| REQ-A5-console-cleanup | Phase 1 | DONE (commit `6a1d48f`) |
| REQ-B1-now-playing-panel-ui | Phase 2 | Pending |
| REQ-B2-now-playing-data-hook | Phase 2 | Pending |
| REQ-B3-marketplace-stats | Phase 2 | Pending |
| REQ-B4-now-playing-actions | Phase 2 | Pending |
| REQ-C1-oauth-from-settings | Phase 3 | Pending |
| REQ-C2-user-tokens-table | Phase 3 | Pending |
| REQ-C3-edge-paginated-fetch | Phase 3 | Pending |
| REQ-C4-diff-sync-service | Phase 3 | Pending |
| REQ-C5-sync-hook | Phase 3 | Pending |
| REQ-C6-settings-sync-ui | Phase 3 | Pending |
| REQ-C7-rate-limit-safe | Phase 3 | Pending |
| REQ-D1-vitest-coverage | Phase 4 | Pending |
| REQ-D2-alert-dialog | Phase 4 | Pending |
| REQ-D3-csp-hardening | Phase 4 | Pending |
| REQ-D4-csv-url-validation | Phase 4 | Pending |
| REQ-D5-cover-art-dedup | Phase 4 | Pending |

**Coverage:** 21 / 21 requirements mapped. No orphans.
