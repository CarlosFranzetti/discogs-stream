# Discogs Stream

**Full name:** Discogs Vinyl Collection Streamer
**Status:** Active development (Phase 1 shipped, Phase 2 next)
**Created:** 2026-05-20
**Repo:** `/Users/carlosfranzetti/Documents/GITHUB/discogs-stream`

---

## Core Value

A browser-based, mobile-first streamer that turns a user's Discogs vinyl collection (or wantlist) into a playable, persistent listening queue using YouTube and Bandcamp as audio sources — with **<5 s time-to-first-play on return visits** and zero re-import friction.

The user owns the records; the app finds the audio. CSV import keeps it loginless; OAuth keeps it synced.

---

## Target Users

- Vinyl collectors with an active Discogs collection or wantlist
- Listeners who want to audition records (collection or shopping list) without juggling tabs
- Mobile-first (phone in pocket, vinyl on the desk) and macOS Safari users

---

## Runtime / Stack

- **Frontend:** React 18 + Vite 7 + TypeScript 5
- **UI:** Tailwind + shadcn/ui (Radix primitives)
- **Backend:** Supabase — Postgres + Deno Edge Functions
- **Deploy:** Vercel (SPA, no SSR)
- **Testing:** Vitest + jsdom
- **Node:** 20.x

No Electron. No SSR. No native apps in v1.

---

## Primary Success Metric

**Time-to-first-play on return visit < 5 seconds.**

### Secondary

- Track resolution success rate > 85 %
- Sessions with ≥ 3 tracks played > 60 %
- Re-import rate < 5 %
- Discogs link click-through per session > 15 %

---

## Goals (v1)

1. CSV import path that requires no login (primary onboarding)
2. Discogs OAuth path with diff-based incremental sync (power users)
3. Multi-tier audio resolution (yt-dlp → Invidious → YouTube API) that survives YouTube quota exhaustion
4. Persistent metadata cache (Supabase `discogs_track_cache`) so return visits load instantly
5. Mobile-first UX with full keyboard control on desktop
6. Now-playing release detail panel with marketplace pricing and Discogs deep-links
7. Single source of truth for volume across HTML5 audio + YouTube IFrame
8. Hardened security (CSP, no `confirm()`, URL validation) and a real Vitest suite for the new hooks

---

## Non-Goals (Locked v1 Exclusions)

These are **scope decisions, not deferrals.** Do not add them to any v1 phase.

- **No audio ripping or downloading.** Streaming only; no offline files; no MP3 export.
- **No social features.** No follow, no comments, no shared playlists, no profiles.
- **No Discogs listing or selling.** Read-only marketplace data (lowest/median/highest). Purchase links open Discogs in a new tab; the app never POSTs to Discogs marketplace.
- **No Electron / native wrapper.** Web only.
- **No SSR / Next.js migration.** Vite SPA stays.
- **No BPM / key detection.** (Open question deferred to v2.)
- **No auto-import wantlist → collection on Purchase.** (Open question deferred to v2.)

---

## Key Architectural Decisions (implicit, not yet ADR'd)

- **Hooks-as-service-layer** (`useAudioController`, `useDiscogsSync`, `useNowPlayingData`, `usePlayer`) instead of a Redux/Zustand store.
- **All third-party traffic proxied through Supabase Edge Functions** — never direct from browser. CORS, secrets, and rate-limit shaping all live in `supabase/functions/*`.
- **Track ID format:** `{source}-{releaseId}-{position}` — stable across sessions, lets the same release coexist in collection and wantlist.
- **DB-first hydration, localStorage as fallback.** `discogs_track_cache` is the primary persistence layer; localStorage is the offline-first safety net.
- **Diff-based sync.** Remote Discogs is source of truth for collection membership; local user preferences (likes/dislikes) are **never** overwritten by sync. Removed releases are soft-deleted via `working_status = 'non_working'`.
- **YouTube quota flag is UX-only.** The resolution chain (yt-dlp → Invidious → YouTube API) runs unconditionally; the quota flag only gates toasts.
- **Per-route audio controller** (not a global singleton) — matches the existing hook composition pattern.

---

## Constraints / Risk Floor

- **Discogs API:** 60 req/min unauthenticated and per-OAuth-token. All call sites must back off exponentially and dedupe at the release level.
- **YouTube API quota:** 10 000 units/day (search = 100). Treated as best-effort, never load-bearing.
- **Supabase free tier:** 500 MB DB, 2 GB bandwidth — drives the dedup / batching design.
- **Safari:** `svh` viewport units are flaky on iOS ≤15; fallbacks required. Vinyl must stay circular under resize (`aspect-ratio: 1/1`).
- **CSP:** Strict CSP in `vercel.json`. Any new media source (Invidious instance domain) must be allow-listed in both `media-src` and `connect-src`.

---

## Project References

- PRD: `PRD.md`
- TDD: `TDD.md`
- Design SPEC (authoritative for shortcuts, hooks, edge function contracts): `docs/superpowers/specs/2026-04-22-all-sprints-design.md`
- Implementation plan: `docs/superpowers/plans/2026-04-22-all-sprints.md`
- Codebase guide: `CLAUDE.md`
- Intel synthesis: `.planning/intel/SYNTHESIS.md`
