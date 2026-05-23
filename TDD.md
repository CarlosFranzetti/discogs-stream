# Technical Design Document — Discogs Stream

**Version:** 2.0  
**Date:** 2026-04-22  
**Stack:** React 18 + Vite · TypeScript · Tailwind + shadcn/ui · Supabase (Postgres + Edge Functions) · Vercel

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (Vite SPA)                                           │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ AudioCtrl  │  │ CollectionSt │  │   UI Components    │   │
│  │ (single    │  │ (Zustand or  │  │  (shadcn + custom) │   │
│  │  source)   │  │  Context)    │  │                    │   │
│  └─────┬──────┘  └──────┬───────┘  └────────────────────┘   │
│        │                │                                     │
│  ┌─────▼────────────────▼──────────────────────────────┐    │
│  │            Service Layer (hooks)                      │    │
│  │  useAudio · useCollection · useSync · usePlayer       │    │
│  └─────────────────────────┬────────────────────────────┘    │
└────────────────────────────┼─────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼─────────────────────────────────┐
│  Supabase Edge Functions (Deno)                               │
│  discogs-auth · discogs-api · youtube-search                  │
│  yt-dlp-audio · invidious-audio · track-cache · track-media   │
└────────────────────────────┬─────────────────────────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
     Supabase DB       Discogs API       YouTube / Invidious
```

---

## 2. Database Schema (Final — Supabase Postgres)

### 2.1 `users` (managed by Supabase Auth)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | Supabase auth UID |
| email | text | |
| created_at | timestamptz | |

### 2.2 `user_tokens`
Stores OAuth credentials per user. Never exposed client-side.

```sql
create table user_tokens (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  discogs_token  text not null,
  discogs_secret text not null,
  username       text not null,
  updated_at     timestamptz default now()
);
alter table user_tokens enable row level security;
create policy "own token only"
  on user_tokens for all
  using (auth.uid() = user_id);
```

### 2.3 `discogs_track_cache`
Primary persistence layer for track metadata (one row per track per user).

```sql
create table discogs_track_cache (
  id              bigserial primary key,
  owner_key       text        not null,   -- anon fingerprint or user_id
  track_id        text        not null,   -- '{source}-{releaseId}-{position}'
  source          text        not null check (source in ('collection','wantlist')),
  release_id      text,
  track_position  text,
  title           text        not null,
  artist          text        not null,
  album           text,
  year            int,
  genre           text,
  label           text,
  country         text,
  duration        int,         -- seconds
  cover1          text,        -- primary cover URL
  cover2          text,
  cover3          text,
  cover4          text,
  youtube1        text,        -- best confirmed YouTube ID
  youtube2        text,        -- fallback
  working_status  text default 'pending'
                    check (working_status in ('pending','working','non_working')),
  updated_at      timestamptz default now(),
  unique (owner_key, track_id)
);
create index idx_dtrack_owner on discogs_track_cache(owner_key);
create index idx_dtrack_status on discogs_track_cache(owner_key, working_status);
```

### 2.4 `release_cover_art`
Caches scraped cover URLs so the Discogs API is never hit twice for the same release.

```sql
create table release_cover_art (
  release_id   text primary key,
  cover_url    text not null,
  thumb_url    text,
  scraped_at   timestamptz default now()
);
```

### 2.5 `track_media_links`
Stores manually-confirmed or user-overridden media mappings.

```sql
create table track_media_links (
  id               bigserial primary key,
  owner_key        text  not null,
  release_id       text  not null,
  track_position   text  not null,
  youtube_id       text,
  bandcamp_src     text,
  playback_provider text not null default 'youtube'
                      check (playback_provider in ('youtube','bandcamp')),
  updated_at       timestamptz default now(),
  unique (owner_key, release_id, track_position)
);
create index idx_tmedia_owner on track_media_links(owner_key, release_id);
```

### 2.6 `user_track_preferences`
Persists likes/dislikes independently of media resolution state.

```sql
create table user_track_preferences (
  owner_key   text not null,
  track_id    text not null,
  preference  text not null check (preference in ('like','dislike')),
  updated_at  timestamptz default now(),
  primary key (owner_key, track_id)
);
```

---

## 3. Supabase Migrations (Ordered Execution)

Run via Supabase CLI: `supabase migration new <name>` then paste the SQL.

### Migration 001 — initial schema
```sql
-- (Tables 2.3 and 2.4 already exist in production; this migration is idempotent)
alter table discogs_track_cache
  add column if not exists cover2 text,
  add column if not exists cover3 text,
  add column if not exists cover4 text,
  add column if not exists youtube2 text,
  add column if not exists country text;
```

### Migration 002 — user tokens
```sql
create table if not exists user_tokens (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  discogs_token  text not null,
  discogs_secret text not null,
  username       text not null,
  updated_at     timestamptz default now()
);
alter table user_tokens enable row level security;
create policy "own token only" on user_tokens
  for all using (auth.uid() = user_id);
```

### Migration 003 — track media links
```sql
create table if not exists track_media_links (
  id                bigserial primary key,
  owner_key         text  not null,
  release_id        text  not null,
  track_position    text  not null,
  youtube_id        text,
  bandcamp_src      text,
  playback_provider text  not null default 'youtube'
                      check (playback_provider in ('youtube','bandcamp')),
  updated_at        timestamptz default now(),
  unique (owner_key, release_id, track_position)
);
create index if not exists idx_tmedia_owner
  on track_media_links(owner_key, release_id);
```

### Migration 004 — preferences table
```sql
create table if not exists user_track_preferences (
  owner_key   text not null,
  track_id    text not null,
  preference  text not null check (preference in ('like','dislike')),
  updated_at  timestamptz default now(),
  primary key (owner_key, track_id)
);
```

### Migration 005 — indexes for performance
```sql
create index if not exists idx_dtrack_owner
  on discogs_track_cache(owner_key);
create index if not exists idx_dtrack_status
  on discogs_track_cache(owner_key, working_status);
create index if not exists idx_cover_release
  on release_cover_art(release_id);
```

---

## 4. React Component Architecture

```
pages/
  Index.tsx              → renders <MobilePlayer /> (route /)
  Library.tsx            → renders <Player /> (route /library, desktop)
  Auth.tsx               → OAuth callback handler

components/
  MobilePlayer.tsx       → root orchestrator: state, hooks, layout
  MobileTitleScreen.tsx  → import screen (CSV upload, start button)
  MobileAlbumCover.tsx   → vinyl disc + album art (fixed: h-full not aspect-square)
  MobileTrackInfo.tsx    → artist / title / label / year display
  MobileTimeline.tsx     → seek bar + time display
  MobileTransportControls.tsx → play/pause, skip, volume, like/dislike
  MobilePlaylistSheet.tsx → slide-in playlist panel
  NowPlayingPanel.tsx    → [NEW P1] slide-up release detail + marketplace
  SettingsDialog.tsx     → theme, CSV, Discogs OAuth, reset
  YouTubePlayer.tsx      → YT IFrame wrapper (hidden)
  DirectAudioPlayer.tsx  → HTML5 <audio> for yt-dlp / Invidious streams
  BandcampPlayer.tsx     → Bandcamp embed wrapper

hooks/
  usePlayer.ts           → playlist, shuffle, skip, index management
  useAudioController.ts  → [REFACTOR] single volume source of truth
  useBackgroundVerifier.ts → priority-queue media resolver
  useCSVCollection.ts    → CSV parse + localStorage + DB upsert
  useDiscogsSync.ts      → [NEW] OAuth fetch + diff-based sync
  useTrackCache.ts       → Supabase discogs_track_cache CRUD
  useTrackMediaResolver.ts → multi-tier YouTube/Bandcamp resolution
  useCoverArtScraper.ts  → cover art DB cache + background scrape
  useTrackPreferences.ts → like/dislike persistence
  useKeyboardShortcuts.ts → global keyboard event management
  useNowPlayingData.ts   → [NEW] marketplace + release detail fetch

services/
  discogsSync.ts         → [NEW] diff-based collection/wantlist sync logic
  audioController.ts     → [NEW] singleton audio state (volume, mute)
```

### Key component contracts

**`NowPlayingPanel`** (new P1):
```tsx
interface NowPlayingPanelProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToWantlist: (releaseId: string) => void;
  onAddToCollection: (releaseId: string) => void;
}
```

**`useAudioController`** (refactor to fix volume desync):
```ts
// Single source of truth for volume. Both HTML5 <audio> and YT IFrame
// read/write through this hook only.
interface AudioController {
  volume: number;           // 0–100
  isMuted: boolean;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  attachAudioElement: (el: HTMLAudioElement) => void;
  attachYTPlayer: (player: YT.Player) => void;
}
```

---

## 5. Step-by-Step Implementation Plan (2-Week Sprint)

### Week 1 — Foundation & Bugs

**Day 1–2: Vinyl fix + volume hardening**
1. ✅ Fix vinyl oval distortion (done — `aspect-ratio: 1/1` on parent, `h-full` on child).
2. Extract `useAudioController` hook; route all volume reads/writes through it.
3. Add `↑`/`↓` volume keyboard shortcuts in `useKeyboardShortcuts`.
4. Add `M` mute toggle; sync slider UI ↔ `useAudioController` state.

**Day 3: Reset / clear state bug**
1. Audit all state layers touched by "clear" actions.
2. Implement `resetAllState()` utility that flushes: React state, localStorage keys, Supabase `discogs_track_cache` rows for `owner_key`, YouTube search cache, and all refs.
3. Write a Vitest test: after reset, `discogsTracks.length === 0` and localStorage is empty.

**Day 4–5: Discogs OAuth sync (edge function)**
1. Extend `discogs-api` edge function to accept `GET /collection/full` and `GET /wantlist/full`.
2. Implement `discogsSync.ts`: fetch remote list → compare with DB snapshot → upsert new, mark removed as `source: 'removed'`.
3. Expose `useDiscogsSync` hook with `{ isSyncing, lastSyncAt, syncNow, syncError }`.
4. Wire to `SettingsDialog` — show last sync timestamp, manual re-sync button.

### Week 2 — Persistence, Sync & Now Playing

**Day 6–7: Persistent hydration on return visit**
1. On app mount, call `loadTracks(ownerKey)` before any Discogs API call.
2. Render collection from DB immediately; show subtle "Syncing…" indicator.
3. After sync completes, patch tracks silently (no re-render flicker).
4. Loading state: skeleton shimmer on `MobileAlbumCover` while hydrating.

**Day 8–9: Now Playing Panel**
1. Create `NowPlayingPanel.tsx`: bottom sheet using `Sheet` from shadcn/ui.
2. Create `useNowPlayingData` hook: fetch release details + marketplace prices (cached for 1h in `release_cover_art`-style table).
3. Show: label, catalogue #, country, formats, all genres/styles, price range.
4. Add: "Open on Discogs", "Add to Wantlist", purchase link buttons.
5. Trigger: tap album art on the player screen → panel slides up.

**Day 10: Polish + deploy**
1. Audit all `console.log` calls; remove or downgrade to debug-only.
2. Run `npm run lint` — fix all warnings.
3. Write 3 new Vitest tests: volume sync, reset completeness, hydration order.
4. `vercel --prod --yes` — deploy.

---

## 6. Risks & Edge Cases

| Risk | Mitigation |
|---|---|
| Discogs API rate limit (60 req/min) | Exponential back-off; sync runs after 1s debounce; cover art scraper already rate-limited at 1 req/s |
| YouTube quota exhausted | yt-dlp → Invidious chain runs regardless; quota flag only gates toast messages |
| Safari `svh` oval vinyl | Fixed: `aspect-ratio: 1/1` on single width expression |
| Volume desync on player swap (YT ↔ HTML5) | Single `useAudioController` singleton; both players subscribe to it |
| Partial Discogs sync (network drop mid-fetch) | Each page of results upserted immediately; resume-safe by design |
| Orphaned DB rows after reset | `deleteTracks(ownerKey)` called as part of reset flow; uses `owner_key` index |
| Marketplace prices stale | Cache for 1 hour (TTL in `updated_at` check); show "prices from Discogs" disclaimer |
| `svh` on older Safari (iOS 15 and below) | `svh` with `vh` fallback via `@supports`; minimum clamp value (212px) ensures usable size |
