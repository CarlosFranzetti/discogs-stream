# MEMORY STATE — Discogs Stream

> Living memory log. Updated after every engineering pass (docs → cleanup → review → security → suggestions).
> Newest entries at the top of the Log. Do not delete old entries; they are the history.

## Current State (last updated: 2026-07-15, Pass 1 COMPLETE — all phases done)

- **Branch**: `master`, all changes LOCAL and UNCOMMITTED (user hold: no GitHub push, no Vercel deploy — test first)
- **Tests**: 9/9 passing · **tsc**: clean · **Lint**: 0 errors / 12 warnings (shadcn boilerplate + 1 intentional deps-array) · **Build**: OK (696 kB bundle, code-splitting is top optimization candidate)
- **Removed this pass**: 13 dead src files (legacy desktop player tree + orphans), `LEGACY/` (13 files), `run-migration` edge fn — ~27 files total, verified green after each batch
- **Fixed this pass**: background-verifier timer leak (HIGH), workingStatus cache-reversion (MED), npm lockfile drift (MED), 4 security issues (see Phase 5 log)
- **Docs**: CLAUDE.md, README.md, PRD.md, TDD.md, docs/CODEBASE-FUNCTIONS.md all synced; memorystate.md (this file) + LOOPY.md created
- **Live app shape**: single `MobilePlayer` at `/` (YouTube IFrame playback only), `/library` standalone page, `/auth` Discogs OAuth. Direct-audio + Bandcamp exist only as server-side edge fns with no UI consumer.

### ⚠️ Deploy-time checklist (when the user lifts the hold)
1. `supabase db push` — applies `20260715000000_lock_down_youtube_videos.sql`
2. `supabase functions deploy track-cache track-media youtube-rescan-weekly` AND deploy the client build in the same window (track-cache writes for OAuth users 401 if client lags; CSV users unaffected)
3. `supabase functions delete run-migration` — remove the obsolete deployed copy
4. Optionally set a dedicated `SESSION_SECRET` on edge functions (currently falls back to service-role key)
5. `deno check` the three edited functions (Deno not installed locally this session)

## Suggestions (Phase 6 — carried between loop cycles until accepted/rejected)

### Features (DJ/collector lens)
1. **Rewire direct audio into MobilePlayer** — the yt-dlp/Invidious `<audio>` chain (edge fns already built) gives true background playback on iOS PWA + lock-screen control via **Media Session API** (artwork, prev/next). The single biggest listening-experience win; the removed `DirectAudioPlayer`/`useDirectAudio` in git history are a working reference implementation.
2. **Crate-digging filters** — filter/sort playlist by Discogs style/genre/label/year (data already cached per track). "Play only the 90s Chicago house I own" is the collector's dream query.
3. **Wantlist price awareness** — marketplace lowest-price on wantlist track cards (PRD §2 promises this; `discogs-api` proxy can fetch it).
4. **Cue preview mode** — long-press a playlist row to preview from ~60s in at lower volume without leaving the current track (classic record-store listening booth behavior). Needs the direct-audio path (#1) for a second concurrent stream.
5. **Bandcamp: decide** — either restore an embed player behind a Settings flag (data + provider fields still flow through `track_media_links`) or strip `bandcampEmbedSrc`/provider plumbing for tightness.

### Optimizations
6. **Code-splitting** — `React.lazy` the `/auth` + `/library` routes and `manualChunks` for react/supabase/shadcn: 696 kB → likely ~40% smaller initial load on phone radios.
7. **Virtualize the playlist** — big collections (2k+ tracks) render every row in `MobilePlaylistSheet`; `@tanstack/react-virtual` keeps the sheet at 60fps.
8. **Test the schedulers** — vitest fake-timer specs for `useBackgroundVerifier` (the leak fixed this pass was exactly the kind of bug a timer test catches) and `usePlayer` shuffle/sequential invariants.
9. **CI gate** — GitHub Action: `npm ci && npm test && npm run lint && npx tsc --noEmit && npm run build` (the lockfile drift fixed this pass would have been caught on day one).
10. **Cover-art write path** — move `release_cover_art` writes behind `discogs-public`, then service-role-lock its RLS (closes the last world-writable table).

## Log

### 2026-07-15 — Pass 1 SHIPPED: committed, pushed, auto-deployed to production
- Local dev server verified in browser (title screen renders, HTTP 200) before ship
- Rebased onto 2 remote commits (new Chrome extension: side panel/crates/carts/pitch/marketplace) — verified extension code has zero imports of the deleted files; full test/tsc/build green on merged tree
- Committed as `f384d8c`, pushed to origin/master
- ⚠️ Vercel Git integration auto-deployed the push to **PRODUCTION** (master = production branch; every push does this). Deployment `dpl_7VWETVaY83Hipt7hsoKmtqX9BNS5` READY in ~21s → https://discogs-stream.vercel.app (200, title renders). A separate preview deploy was moot (same commit already live); local `vercel` CLI token is expired anyway (`vercel login` needed for manual deploys).
- Frontend-only deploy is SAFE with the security changes (client's extra `session` field is ignored by the old deployed edge functions). The Supabase side is still pending — see Deploy-time checklist: `supabase db push` (youtube_videos RLS), `supabase functions deploy track-cache track-media youtube-rescan-weekly`, `supabase functions delete run-migration`.

### 2026-07-15 — Pass 1, Phase 6: Suggestions written, final verification green
- 10 ranked feature/optimization candidates recorded above (top pick: rewire direct-audio + Media Session API into MobilePlayer)
- Final full verification: tests 9/9, tsc clean, lint 0 errors, build OK
- Pass 1 of the LOOPY loop complete. Next cycle: run LOOPY.md phases against this state.

### 2026-07-15 — Pass 1, Phase 5: Security audit (Fable) → 4 fixed, 3 logged
**Fixed in repo (take effect on next `supabase functions deploy` / `db push`):**
1. **HIGH** `youtube_videos` table had NO RLS — anon key could read/write/poison the search cache (rewrite `video_id` per artist/title for every user). New migration `20260715000000_lock_down_youtube_videos.sql` (service-role-only, matches `search_cache` pattern; only the `youtube-search` fn touches it).
2. **HIGH** `run-migration` edge fn: obsolete unauthenticated service-role SQL runner (one-shot for a table that exists). DELETED from repo + config.toml. ⚠️ Also delete the deployed copy: `supabase functions delete run-migration`.
3. **HIGH** `youtube-rescan-weekly` had no inbound auth (verify_jwt=false + no header check) — anyone could burn YouTube quota. Now requires `Authorization: Bearer <service_role_key>` (pg_cron job already sends it).
4. **MEDIUM** `track-cache` upsert/delete and `track-media` upsert accepted any `owner_key`/`discogs_username` — Discogs usernames are public ⇒ cache wipe / YouTube-ID poisoning of OAuth users. Now: `csv-*` capability keys pass (unguessable), username keys require valid HMAC session for that exact username. Client `useTrackCache` threads the session token from `discogs_session_v2`. ⚠️ Deploy function + client TOGETHER, else OAuth-user writes 401 (CSV users unaffected).
5. **LOW** `_shared/session.ts` HMAC compare was `!==` (timing-leak) — now constant-time XOR compare.

**Logged, not fixed (design decisions):**
- `release_cover_art` is world-writable by anon (by design — client-side scraper writes directly). Poisoning vector for cover URLs (cosmetic, CSP-constrained img-src). Proper fix: route writes through `discogs-public` fn, then lock RLS to service-role.
- `SESSION_SECRET` falls back to `SUPABASE_SERVICE_ROLE_KEY` as HMAC secret. Works, but set a dedicated `SESSION_SECRET` env on the functions and remove the fallback (rotating either then has isolated blast radius).
- CSP still whitelists Bandcamp frame/media sources though no Bandcamp embed renders anymore — harmless; tighten when Bandcamp's fate is decided.

**Verified clean:** production bundle contains no secrets (anon key only, expected); `user_tokens` RLS deny-all + tokens never in localStorage (legacy key actively wiped); `discogs_track_cache`/`track_media_links`/`search_cache` service-role-only; `rescan_log` read-only to clients; CSP solid (frame-ancestors self, object-src none, connect-src supabase-only).
**Post-fix verification:** tests 9/9, tsc clean, build OK. Deno not installed locally — edge fn changes need `deno check` / staging invoke at deploy time.

### 2026-07-15 — Pass 1, Phase 4: Sonnet code review → 3 findings, all fixed
- **HIGH (fixed)** `useBackgroundVerifier.ts`: self-perpetuating `setTimeout(processNext, 500)` chains leaked on every effect re-run (which happens after nearly every resolved track — `tracks` prop changes reference). Fix: `disposed` flag + timeout id cleared in effect cleanup; orphaned closures no longer reschedule. Worst case before fix: hundreds of immortal timer chains during a large CSV import.
- **MEDIUM (fixed)** `useTrackCache.ts` `applyCachedMetadata`: `row.working_status || track.workingStatus` always let the stale cached status overwrite the live verifier result, dimming already-resolved tracks mid-import. Fix: live `'working'` status is never downgraded by cache re-application.
- **MEDIUM (fixed)** `package-lock.json` drifted from `package.json` (baseline-browser-mapping 2.9.19 vs ^2.10.43, caniuse-lite too) — `npm ci` hard-failed (reproduced by reviewer in isolation). Fix: `npm install` re-sync, 0 vulnerabilities.
- Reviewer verified clean: MobilePlayer audio-bleed/auto-skip logic, usePlayer (the eslint `currentIndex` dep warning is intentional and safe), useAudioController refs, discogsSync soft-delete diff, both hot edge functions, and zero dangling imports from the dead-code sweep.
- Post-fix verification: tests 9/9, tsc clean, build OK, lint 0 errors/12 warnings (was 14 — dead files carried 2)

### 2026-07-15 — Pass 1, Phase 1: Docs synced to post-cleanup reality
- **CLAUDE.md**: playback description corrected (YouTube IFrame is the only live path), removed-file references purged from data flow / patterns / structure tree, Media Provider note updated (bandcampEmbedSrc is data-only)
- **README.md**: `npm run preview` fix, structure tree updated, real theme names (Dark/Midnight/Neon Orange/Cyberpunk), Bandcamp claims corrected, Jul 2026 updates section added
- **docs/CODEBASE-FUNCTIONS.md**: 8 dead-file sections removed, useTheme/useSettings entries corrected, "last synced" stamp added
- **PRD.md / TDD.md**: implementation-status / as-built deviation notes added (no Zustand; no live direct-audio path)

### 2026-07-15 — Pass 1, Phase 3: Dead code removed (all green after)
- **Batch 1** (independently dead, zero imports): `CSVUpload.tsx`, `DiscogsConnect.tsx`, `NavLink.tsx`, `useDiscogsYouTubeResolver.ts`
- **Batch 2** (dead Player tree — Player.tsx imported by nothing, sole consumer of the rest): `Player.tsx`, `PlaylistSidebar.tsx`, `TrackInfo.tsx`, `PlayerControls.tsx`, `Timeline.tsx`, `AlbumArt.tsx`, `BandcampPlayer.tsx`, `DirectAudioPlayer.tsx`, `useDirectAudio.ts`
- **Batch 3**: `LEGACY/` (13 tracked files: old Gemini CI workflows, Apr-2026 instructions, stale test CSV) + stray `.DS_Store` files (already gitignored)
- Verified after EACH batch: `npm test` 9/9, `npx tsc --noEmit` clean, `npm run build` OK
- Post-removal rescan: no newly-dead (transitively orphaned) files remain
- ⚠️ Consequence made explicit: Bandcamp playback and direct-audio (yt-dlp/Invidious `<audio>`) had NO live UI path even before removal — edge functions `yt-dlp-audio` / `invidious-audio` remain server-side, currently unconsumed. Rewire-or-retire decision logged in Suggestions.

### 2026-07-15 — Pass 1, Phase 0: Baseline captured
- CLAUDE.md audit completed earlier this session (8 fixes: preview cmd, keyboard shortcuts, rescan fn, 4 DB tables, diff-sync pattern, structure tree, testing, theme gotcha)
- Green baseline established (tests/lint/build above) BEFORE any dead-code removal
- Dead-code import graph mapped (grep-based zero-import scan + transitive closure from Player.tsx)

<!-- Append new log entries ABOVE this line, newest first under ## Log -->
