# Product Requirements Document — Discogs Stream

**Version:** 2.0  
**Date:** 2026-04-22  
**Status:** Active  
**Owner:** Carlos Franzetti

---

## 1. Problem Statement

Discogs is the definitive catalogue for vinyl collectors, but it offers zero playback. Every session forces users to leave the platform, manually search YouTube or Bandcamp, and lose context. Collectors — especially DJs — want to hear what they own or want in the same flow where they track it.

---

## 2. Product Vision

A streaming layer that sits on top of a Discogs collection. Drop in a CSV or connect an account, and every record you own or want becomes instantly playable, with artwork, marketplace prices, and deep release metadata — without ever leaving the app.

---

## 3. Users

| Persona | Need |
|---|---|
| **Vinyl DJ** | Preview upcoming purchases, build set ideas from owned records |
| **Collector** | Browse + play any release in their archive, track condition vs sound |
| **Wantlist digger** | Hear wantlist items before committing to a buy |
| **Casual listener** | Shuffle through a curated collection like a personal radio |

---

## 4. Goals & Non-Goals

### Goals
- Time-to-first-play under 5 seconds on return visits.
- Zero re-import friction: collection is always up to date.
- Works offline for metadata; gracefully degrades for playback.
- Mobile-first UI that also runs well on macOS desktop Safari.

### Non-Goals
- No ripping or downloading audio.
- No social features in v1.
- No Discogs listing/selling actions from inside the app.
- No desktop Electron wrapper in v1.

---

## 5. Feature Set

### 5.1 Collection Import (CSV — shipped)
- Upload Discogs export CSV for collection or wantlist.
- Tracks expanded from release-level to individual per-track entries (1 req/sec to Discogs API).
- Persisted to `discogs_track_cache` table; reloads instantly on return visits.
- localStorage as offline fallback.

### 5.2 Discogs Account Sync (P0 — next sprint)
Users connect via OAuth1. App fetches full collection + wantlist via Discogs API. Incremental sync on every session open (diff-based: only add/remove, never full overwrite).

**Requirements:**
- OAuth flow triggered from Settings only (not title screen).
- Token stored in Supabase `user_tokens` table, never in localStorage.
- Rate limit: max 60 req/min per Discogs spec; back-off with exponential retry.
- Sync conflict rule: remote Discogs is source of truth; local overrides (likes/dislikes) are never overwritten.

### 5.3 Playback Engine (shipped, ongoing hardening)
Multi-tier audio resolution: yt-dlp → Invidious → YouTube IFrame API. HTML5 `<audio>` preferred for background playback. 3-second auto-skip on failed tracks with background retry.

### 5.4 Volume & Keyboard Controls (P0 — in progress)
- Volume slider synced bidirectionally with actual audio element.
- Keyboard shortcuts: `↑`/`↓` volume ±5%, `M` mute, `Space` play/pause, `,`/`.` skip.
- Global `keydown` listeners with proper cleanup on unmount.
- No desync between slider state and real volume on player swap.

### 5.5 Persistent User State (P0)
On any authenticated return visit: collection + wantlist hydrate from `discogs_track_cache` before any API call fires. Cover art loads from `release_cover_art` cache. Playback can start before sync completes.

**Loading hierarchy:**
1. Supabase DB cache → render immediately.
2. localStorage snapshot → fill gaps.
3. Discogs API diff-sync → patch in background.

### 5.6 Now Playing Panel (P1 — design phase)
Bottom slide-up sheet (mobile-first, also works on desktop) showing:
- Full release info: artist, label, catalogue number, country, year, all genres/styles.
- Marketplace data: lowest, median, highest price (Discogs marketplace API).
- Actions: Add to wantlist, Add to collection, Open on Discogs, Purchase link.
- Smooth spring animation; closes on swipe-down or tap outside.
- Real-time sync with currently playing track (no stale data).

### 5.7 Playlist / Wantlist Reset (P0 — bug fix)
Current reset does not flush all state layers consistently. Fixed behavior:
- Clear CSV data → clear localStorage → delete `discogs_track_cache` rows for `owner_key` → reset all React state → return to title screen.
- Collection and wantlist clear independently or together.
- DB + localStorage always stay in sync (no orphaned rows).

### 5.8 Vinyl Rendering (shipped — bug fixed)
Round vinyl always renders as a true circle. Fixed by using `width` + `aspect-ratio: 1/1` (single-expression layout) instead of separate `width`/`height` clamp expressions that Safari can evaluate inconsistently during resize.

---

## 6. Success Metrics

| Metric | Target |
|---|---|
| Time to first play (return visit) | < 5 s |
| Sessions with ≥ 3 tracks played | > 60 % |
| Re-import rate (users who must re-import) | < 5 % |
| Track resolution success rate | > 85 % |
| Discogs link click-through per session | > 15 % |

---

## 7. Constraints

- Discogs API: 60 req/min unauthenticated, 60 req/min per OAuth token.
- YouTube quota: 10,000 units/day (search = 100 units); yt-dlp + Invidious chain runs regardless.
- Supabase free tier: 500 MB DB, 2 GB bandwidth.
- No server-side rendering; pure Vite SPA deployed on Vercel.

---

## 8. Open Questions

1. Should wantlist items auto-import to collection after a "Purchase" action?
2. Do we cache Discogs marketplace prices, and if so, for how long?
3. Is BPM/key detection in scope for the DJ persona in v2?
