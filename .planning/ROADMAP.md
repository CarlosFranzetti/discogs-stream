# Roadmap: Discogs Stream

## Overview

Four-phase roadmap derived from the approved all-sprints design SPEC and PRD. Phase 1 (Foundation / Player Hardening) shipped in commit `6a1d48f` and is collapsed below. The remaining work delivers the Now Playing Panel (B), Discogs OAuth diff-sync (C), and a hardening pass for tests/security/performance (D). Each phase delivers an end-to-end, user-observable capability.

## Phases

- [x] **Phase 1: Foundation & Player Hardening** - Single-source-of-truth audio controller, new keyboard shortcut grammar, release-skip navigation, reset fix, console cleanup (SHIPPED `6a1d48f`)
- [ ] **Phase 2: Now Playing Panel** - Bottom-sheet release detail with marketplace pricing and Discogs deep-links
- [ ] **Phase 3: Discogs OAuth Diff-Sync** - OAuth-from-Settings + incremental, resume-safe sync that preserves user preferences
- [ ] **Phase 4: Tests, Security & Performance** - Vitest coverage for new hooks, AlertDialog migration, CSP hardening, CSV URL validation, cover-art dedup

## Phase Details

### Phase 1: Foundation & Player Hardening
**Goal**: A single, predictable player surface — one volume/mute source of truth, the new keyboard grammar everywhere, release-level navigation, and a clean reset flow.
**Status**: Complete — shipped in commit `6a1d48f`
**Depends on**: Nothing (first phase)
**Requirements**: REQ-A1-audio-controller, REQ-A2-keyboard-shortcuts, REQ-A3-skip-release, REQ-A4-reset-bug-fix, REQ-A5-console-cleanup
**Success Criteria** (what must be TRUE):
  1. User can change volume from slider, `+`/`-`, or `M` and see the same value reflected across HTML5 audio and YouTube IFrame engines with no desync.
  2. User can press ↑ / ↓ to jump to the first track of the next / previous release, in both shuffle and sequential modes.
  3. User can press Space, ← / →, P, S, O and trigger the documented action; the old `,` / `.` shortcuts no longer fire.
  4. User can clear data from the title screen and immediately see the title screen again (no stale player state).
  5. Production console output is free of debug `console.log` calls — only structured errors remain.
**Plans**: Shipped as a single integrated commit (no per-plan tracking retained).

### Phase 2: Now Playing Panel
**Goal**: Tapping the album cover opens a release-detail bottom sheet showing full Discogs metadata, marketplace pricing, and one-tap actions to wantlist / collection / Discogs / purchase.
**Depends on**: Phase 1
**Requirements**: REQ-B1-now-playing-panel-ui, REQ-B2-now-playing-data-hook, REQ-B3-marketplace-stats, REQ-B4-now-playing-actions
**Success Criteria** (what must be TRUE):
  1. User taps the mobile album cover and a bottom sheet springs up showing the currently playing release's artist, label, catalogue #, country, year, genres, and styles.
  2. User sees lowest / median / highest marketplace prices for the playing release, fetched via the `discogs-public` edge function `marketplace` action.
  3. User can tap "Add to wantlist", "Add to collection", "Open on Discogs", or "Purchase" and the corresponding action fires (collection/wantlist callbacks; new-tab links for Discogs / marketplace).
  4. Panel closes on swipe-down or tap-outside; reopening within an hour returns instantly from the session cache.
  5. When the playing track changes, the panel's content re-syncs to the new release without manual reopen.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Discogs OAuth Diff-Sync
**Goal**: Power users can connect their Discogs account from Settings and have their collection + wantlist incrementally synced into `discogs_track_cache` without ever losing local likes/dislikes.
**Depends on**: Phase 1
**Requirements**: REQ-C1-oauth-from-settings, REQ-C2-user-tokens-table, REQ-C3-edge-paginated-fetch, REQ-C4-diff-sync-service, REQ-C5-sync-hook, REQ-C6-settings-sync-ui, REQ-C7-rate-limit-safe
**Success Criteria** (what must be TRUE):
  1. User opens Settings, taps "Connect Discogs", completes OAuth1, and lands back in Settings with their username displayed; the title screen never offers OAuth.
  2. User's Discogs tokens are stored only in the Supabase `user_tokens` table (RLS-protected) — never in localStorage.
  3. On next mount with credentials present, the app paginates the user's full collection + wantlist via `discogs-api` `collection_full` / `wantlist_full` actions and upserts new tracks into `discogs_track_cache`; removed releases are soft-deleted via `working_status = 'non_working'`.
  4. User's `user_track_preferences` (likes/dislikes) survive every sync untouched.
  5. Settings shows the last-sync timestamp and a "Re-sync now" button; sync errors are surfaced (toast/inline) and a mid-sync network drop resumes safely on the next attempt.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Tests, Security & Performance
**Goal**: Lock in the new hooks with real Vitest coverage, replace native `confirm()` with shadcn AlertDialog, tighten CSP, validate CSV URLs, and stop duplicate cover-art / upsert work.
**Depends on**: Phase 2, Phase 3
**Requirements**: REQ-D1-vitest-coverage, REQ-D2-alert-dialog, REQ-D3-csp-hardening, REQ-D4-csv-url-validation, REQ-D5-cover-art-dedup
**Success Criteria** (what must be TRUE):
  1. `npm test` runs and passes new suites: `useAudioController.test.ts`, `discogsSync.test.ts`, `useNowPlayingData.test.ts` — each exercising the contract documented in REQUIREMENTS.md.
  2. User-facing destructive confirmations in Settings render as shadcn `AlertDialog`; no `window.confirm()` call remains in the codebase.
  3. `vercel.json` CSP whitelists Invidious instance domains in `media-src` and `connect-src` (named, not wildcard); no new wildcard sources are introduced and no `dangerouslySetInnerHTML` exists.
  4. CSV imports drop any cover-art / URL field that does not start with `https://` (validated in `csvParser`); malicious or `http://` URLs never reach the DOM or DB.
  5. Rapid CSV import or repeated `discogsTracks.length` changes do not re-fire `batchLoadCoverArtFromDb` for already-loaded releases (Set-ref guard), and `upsertTracks` stays debounced at 500 ms with no duplicate calls.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phase 1 (done) → Phase 2 → Phase 3 → Phase 4. Phases 2 and 3 are independent of each other and could in principle run in either order, but the canonical sequence is 2 → 3 → 4 to match the design SPEC.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Player Hardening | 1/1 | Complete | 2026-05-20 (commit `6a1d48f`) |
| 2. Now Playing Panel | 0/TBD | Not started | - |
| 3. Discogs OAuth Diff-Sync | 0/TBD | Not started | - |
| 4. Tests, Security & Performance | 0/TBD | Not started | - |
