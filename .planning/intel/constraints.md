# Constraints (SPEC Intel)

Two SPECs ingested:
- `/Users/carlosfranzetti/Documents/GITHUB/discogs-stream/TDD.md` — Technical Design Document v2.0
- `/Users/carlosfranzetti/Documents/GITHUB/discogs-stream/docs/superpowers/specs/2026-04-22-all-sprints-design.md` — All Sprints Design (Approved)

Both have precedence 1. They are complementary (TDD covers schema + architecture; sprint design covers per-task contracts) and do not contradict each other.

---

## Architecture

### CONSTRAINT-stack
- source: TDD.md §1
- type: nfr
- Stack: React 18 + Vite · TypeScript · Tailwind + shadcn/ui · Supabase (Postgres + Edge Functions) · Vercel
- Browser SPA → Supabase Edge Functions (Deno) → Supabase DB / Discogs API / YouTube / Invidious
- No server-side rendering; pure Vite SPA deployed on Vercel

### CONSTRAINT-service-layer
- source: TDD.md §1
- type: api-contract
- Service layer composed of hooks: `useAudio`, `useCollection`, `useSync`, `usePlayer`
- All Discogs/YouTube traffic proxied via Supabase Edge Functions: `discogs-auth`, `discogs-api`, `discogs-public`, `youtube-search`, `yt-dlp-audio`, `invidious-audio`, `track-cache`, `track-media`

---

## Database Schema (Supabase Postgres)

### CONSTRAINT-schema-user-tokens
- source: TDD.md §2.2
- type: schema
```sql
create table user_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discogs_token text not null,
  discogs_secret text not null,
  username text not null,
  updated_at timestamptz default now()
);
alter table user_tokens enable row level security;
create policy "own token only" on user_tokens for all using (auth.uid() = user_id);
```

### CONSTRAINT-schema-discogs-track-cache
- source: TDD.md §2.3
- type: schema
- Primary persistence layer; one row per track per user
- `track_id` format: `{source}-{releaseId}-{position}`
- `source` ∈ ('collection','wantlist'); `working_status` ∈ ('pending','working','non_working')
- Unique key: `(owner_key, track_id)`
- Indexes: `idx_dtrack_owner`, `idx_dtrack_status`
- Columns: cover1..cover4, youtube1 (best confirmed), youtube2 (fallback)

### CONSTRAINT-schema-release-cover-art
- source: TDD.md §2.4
- type: schema
- `release_id` PK, `cover_url`, `thumb_url`, `scraped_at`

### CONSTRAINT-schema-track-media-links
- source: TDD.md §2.5
- type: schema
- `playback_provider` ∈ ('youtube','bandcamp'), default 'youtube'
- Unique: `(owner_key, release_id, track_position)`

### CONSTRAINT-schema-user-track-preferences
- source: TDD.md §2.6
- type: schema
- `preference` ∈ ('like','dislike')
- PK: `(owner_key, track_id)`

### CONSTRAINT-migrations
- source: TDD.md §3
- type: schema
- Migrations 001–005, idempotent (uses `if not exists` / `add column if not exists`)
- 001: add cover2/3/4, youtube2, country to discogs_track_cache
- 002: create user_tokens + RLS
- 003: create track_media_links + idx_tmedia_owner
- 004: create user_track_preferences
- 005: add idx_dtrack_owner, idx_dtrack_status, idx_cover_release

---

## Component Contracts

### CONSTRAINT-component-tree
- source: TDD.md §4
- type: api-contract
- Pages: `Index.tsx` → `<MobilePlayer />`; `Library.tsx` → `<Player />`; `Auth.tsx` OAuth callback
- New components: `NowPlayingPanel`
- New hooks: `useAudioController`, `useDiscogsSync`, `useNowPlayingData`, `useKeyboardShortcuts`
- New services: `discogsSync.ts`, `audioController.ts`

### CONSTRAINT-now-playing-panel-props
- source: TDD.md §4
- type: api-contract
```ts
interface NowPlayingPanelProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToWantlist: (releaseId: string) => void;
  onAddToCollection: (releaseId: string) => void;
}
```

### CONSTRAINT-audio-controller-interface
- source: TDD.md §4; all-sprints-design.md Sub-project A
- type: api-contract
```ts
interface AudioController {
  volume: number;           // 0–100
  isMuted: boolean;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  attachAudioElement: (el: HTMLAudioElement) => void;
  attachYTPlayer: (player: YT.Player) => void;
}
```
- Single source of truth for volume. Both HTML5 `<audio>` and YT IFrame read/write through this hook only.
- `setVolume()` always unmutes; `toggleMute()` preserves the previous volume.
- Refs (volumeRef, isMutedRef) track live values so callbacks never stale.
- Per-route hook (not global singleton — matches `useAudioController` hook pattern in sprint design).

### CONSTRAINT-keyboard-shortcuts
- source: all-sprints-design.md Sub-project A
- type: api-contract
- AUTHORITATIVE MAPPING (SPEC wins over PRD/DOC variants):
  - Space → play/pause
  - ← → previous track
  - → → next track
  - ↑ → skip to first track of next release
  - ↓ → skip to first track of previous release
  - `+` → volume +5%
  - `-` → volume -5%
  - M → toggle mute
  - P → toggle playlist
  - S → toggle shuffle
  - O → toggle options
- Old `,`/`.` shortcuts REMOVED (supersedes PRD §5.4 and CLAUDE.md keyboard section)
- `useKeyboardShortcuts` gains callbacks: `onVolumeUp`, `onVolumeDown`, `onToggleMute`, `onSkipNextRelease`, `onSkipPrevRelease`
- Listeners ignore keypresses when focus is on input/textarea

### CONSTRAINT-skip-release
- source: all-sprints-design.md Sub-project A
- type: api-contract
- `usePlayer` gains `skipNextRelease()` and `skipPrevRelease()`
- Walk live playlist from `currentIndex`; compare `discogsReleaseId`
- Operates on shuffled OR sequential playlist order

### CONSTRAINT-reset-bug-fix
- source: all-sprints-design.md Sub-project A
- type: api-contract
- `onClearData` in `MobilePlayer` must call `setHasUserInteracted(false)` so title screen renders after reset
- All other ref/state resets already present

### CONSTRAINT-discogs-sync-service
- source: all-sprints-design.md Sub-project C; TDD.md §5 Day 4–5
- type: api-contract
- `discogsSync.ts`: fetches full collection + wantlist pages from `discogs-api` edge function
- Diffs against current `discogs_track_cache` by `track_id`
- Upserts new tracks; marks removed tracks `working_status = 'non_working'` (soft delete)
- Page-by-page upsert is resume-safe on network drop
- `useDiscogsSync` returns `{ isSyncing, lastSyncAt, syncError, syncNow }`
- Auto-syncs on mount when Discogs credentials present
- `lastSyncAt` persisted to localStorage

### CONSTRAINT-discogs-api-edge-extension
- source: all-sprints-design.md Sub-project C
- type: api-contract
- Add `GET /collection/full` and `GET /wantlist/full` routes
- Paginate through all Discogs pages, return flat arrays (same shape as existing endpoints)

### CONSTRAINT-now-playing-data-hook
- source: all-sprints-design.md Sub-project B
- type: api-contract
- Fetches release detail via `discogs-public` edge function (no auth)
- Marketplace stats via `https://api.discogs.com/marketplace/stats/{releaseId}` (public, no auth)
- Cached in `Map<releaseId, data>` ref for session; stale after 1 hour (timestamp check)
- Returns `{ releaseDetail, marketplaceStats, isLoading, error }`

---

## Security / NFR

### CONSTRAINT-csp
- source: all-sprints-design.md Sub-project D
- type: nfr
- `vercel.json` CSP: add Invidious instance domains to `media-src` and `connect-src`
- All user strings via React (no `innerHTML`/`dangerouslySetInnerHTML`)

### CONSTRAINT-csv-url-validation
- source: all-sprints-design.md Sub-project D
- type: nfr
- CSV parser must validate URL fields (cover art) start with `https://` before use

### CONSTRAINT-alert-dialog
- source: all-sprints-design.md Sub-project D
- type: nfr
- Replace `confirm()` in `SettingsDialog` with shadcn/ui `AlertDialog`

### CONSTRAINT-perf-cover-art-dedup
- source: all-sprints-design.md Sub-project D
- type: nfr
- `batchLoadCoverArtFromDb` must guard with Set of already-loaded release IDs (avoid firing on every `discogsTracks.length` change)
- `upsertTracks` debounce 500ms; confirm no duplicate calls

### CONSTRAINT-rate-limits
- source: PRD.md §7 (constraint cross-cut)
- type: nfr
- Discogs API: 60 req/min unauthenticated, 60 req/min per OAuth token; exponential back-off
- YouTube quota: 10,000 units/day (search = 100); yt-dlp + Invidious chain runs regardless
- Supabase free tier: 500 MB DB, 2 GB bandwidth

---

## Risks (TDD.md §6)
- source: TDD.md §6
- type: nfr
- Discogs rate limit → exponential back-off + 1s debounce
- YouTube quota → yt-dlp/Invidious chain unaffected; quota flag only gates toasts
- Safari `svh` oval vinyl → fixed via `aspect-ratio: 1/1`
- Volume desync on player swap → solved by `useAudioController`
- Partial sync on network drop → page-by-page upsert is resume-safe
- Orphaned DB rows on reset → `deleteTracks(ownerKey)` in reset flow
- Marketplace prices stale → 1-hour TTL
- `svh` on older Safari (iOS ≤15) → `vh` fallback via `@supports`; min clamp 212px

---

## Tests Required (SPEC Sub-project D)
- source: all-sprints-design.md Sub-project D
- type: nfr
- `useAudioController.test.ts` — volume clamp, mute toggle, player sync
- `resetState.test.ts` — after reset, tracks empty + localStorage cleared
- `useNowPlayingData.test.ts` — cache hit, stale check, error state
