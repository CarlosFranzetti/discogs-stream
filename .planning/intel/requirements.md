# Requirements (PRD Intel)

Source: `/Users/carlosfranzetti/Documents/GITHUB/discogs-stream/PRD.md` (v2.0, 2026-04-22, Active)

---

## REQ-collection-import-csv
- source: PRD.md §5.1
- status: shipped
- description: Upload Discogs export CSV for collection or wantlist, with tracks expanded from release-level to per-track entries (1 req/sec to Discogs API).
- acceptance:
  - CSV upload accepted from Settings / title screen
  - Tracks persisted to `discogs_track_cache`
  - localStorage offline fallback
  - Reloads instantly on return visits
- scope: CSV import, track expansion, persistence

## REQ-discogs-account-sync
- source: PRD.md §5.2
- status: P0 — next sprint
- description: OAuth1 connection to Discogs; full collection + wantlist fetched; incremental diff-based sync per session.
- acceptance:
  - OAuth flow triggered from Settings only (NOT title screen)
  - Token stored in Supabase `user_tokens` table, never in localStorage
  - Rate limit ≤ 60 req/min with exponential back-off
  - Remote Discogs is source of truth; local likes/dislikes never overwritten
  - Diff-based sync: add/remove only, never full overwrite
- scope: OAuth, user_tokens, diff-sync, conflict policy

## REQ-playback-engine
- source: PRD.md §5.3
- status: shipped (ongoing hardening)
- description: Multi-tier audio resolution chain (yt-dlp → Invidious → YouTube IFrame API) with HTML5 `<audio>` preferred.
- acceptance:
  - Resolution chain runs in declared order regardless of YouTube quota state
  - HTML5 `<audio>` preferred for background playback
  - 3-second auto-skip on failed tracks
  - Background retry for `non_working` tracks
- scope: playback, media resolution

## REQ-volume-keyboard-controls
- source: PRD.md §5.4
- status: P0 — in progress
- description: Volume slider bidirectionally synced with audio element; keyboard shortcuts for volume, mute, play/pause, skip.
- acceptance (PRD variant):
  - `↑`/`↓` volume ±5%
  - `M` mute
  - `Space` play/pause
  - `,`/`.` skip
  - Global keydown listeners with cleanup on unmount
  - No desync between slider and real volume on player swap
- NOTE: Acceptance shortcut mapping CONFLICTS with the approved design SPEC (see INGEST-CONFLICTS.md). SPEC wins by precedence (SPEC > PRD); SPEC variant is the synthesized truth in `constraints.md`. Volume bidirectional sync and cleanup requirements stand unchanged.

## REQ-persistent-user-state
- source: PRD.md §5.5
- status: P0
- description: On authenticated return visits, hydrate collection + wantlist from cache before any network call.
- acceptance:
  - Supabase DB cache renders immediately
  - localStorage snapshot fills gaps
  - Discogs API diff-sync patches in background
  - Cover art loads from `release_cover_art` cache
  - Playback can start before sync completes
- scope: hydration, caching hierarchy

## REQ-now-playing-panel
- source: PRD.md §5.6
- status: P1 — design phase
- description: Bottom slide-up sheet with full release info, marketplace pricing, and actions.
- acceptance:
  - Shows artist, label, catalogue #, country, year, all genres/styles
  - Marketplace data: lowest, median, highest price
  - Actions: Add to wantlist, Add to collection, Open on Discogs, Purchase link
  - Spring animation; closes on swipe-down or tap outside
  - Real-time sync with currently playing track
- scope: UI, marketplace API, release detail

## REQ-playlist-wantlist-reset
- source: PRD.md §5.7
- status: P0 — bug fix
- description: Reset must flush all state layers consistently.
- acceptance:
  - Clear CSV data → clear localStorage → delete `discogs_track_cache` rows for `owner_key` → reset React state → return to title screen
  - Collection and wantlist clear independently or together
  - DB + localStorage always in sync (no orphaned rows)
- scope: reset flow

## REQ-vinyl-rendering
- source: PRD.md §5.8
- status: shipped (bug fixed)
- description: Round vinyl renders as a true circle.
- acceptance:
  - Use `width` + `aspect-ratio: 1/1` (single-expression layout)
  - Renders correctly under Safari resize
- scope: vinyl rendering, Safari compatibility

---

## Success Metrics (PRD §6)
- source: PRD.md §6
- Time to first play (return visit) < 5 s
- Sessions with ≥ 3 tracks played > 60%
- Re-import rate < 5%
- Track resolution success rate > 85%
- Discogs link click-through per session > 15%

## Goals / Non-Goals (PRD §4)
- source: PRD.md §4
- Goals: <5s time-to-first-play return visit; zero re-import friction; offline metadata; mobile-first + macOS Safari
- Non-Goals: no audio ripping/downloading; no social features v1; no Discogs listing/selling; no Electron wrapper v1

## Open Questions (PRD §8)
- source: PRD.md §8
- Auto-import wantlist → collection after Purchase?
- Marketplace price caching TTL?
- BPM/key detection in v2 scope?
