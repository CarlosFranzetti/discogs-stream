# MEMORY STATE — Discogs Stream

> Living memory log. Updated after every engineering pass (docs → cleanup → review → security → suggestions).
> Newest entries at the top of the Log. Do not delete old entries; they are the history.

## Current State (last updated: 2026-07-18, quota-failsafe rebuild + big-collection fixes + B2 shipped)

- **Branch**: everything COMMITTED and PUSHED — `origin/master` at `4eed9e2` ("Direct-audio engine, Media Session, pitch fader, wantlist prices, extension fixes"); work continues on `claude/check-out-jkrunj` (started from that commit)
- **Tests**: 9/9 passing · **typecheck** (`tsc -p tsconfig.app.json`): 0 errors · **Lint**: 0 errors / 15 warnings (shadcn boilerplate + 1 intentional deps-array) · **Build**: OK (code-splitting still the top optimization candidate)
- **Shipped 2026-07-17** (`4eed9e2`, auto-deployed to prod via Vercel Git integration): Phase A complete (A1 direct audio, A2 Media Session, A3 candidate-failover, A4 set-length totals, A5 pitch fader) + B1 wantlist price badges + extension review fixes + `discogs-public` path proxy + CI workflow
- **Supabase side**: hardening deployed + live-verified 2026-07-17 (RLS migration synced; `track-cache` v7 / `track-media` v6 / `youtube-rescan-weekly` v7; 401 guards verified against prod)
- **Live app shape**: single `MobilePlayer` at `/` — direct-audio `<audio>` engine (yt-dlp/Invidious probe) with YouTube IFrame fallback; `/library` standalone page, `/auth` Discogs OAuth; Chrome extension side panel shares hooks
- **2026-07-18 on `claude/check-out-jkrunj`**: B2 crate-digging filters; youtube-search chain rebuilt (yt-dlp → **YouTube scrape** [new, quota-free primary] → Invidious [refreshed list] → **Piped** [new] → API last); track-cache `get` pages internally (1000/batch, **no cap** — was silently truncating >1000-track collections); client upserts chunked 500/req; cover-art `.in()` chunked 200/req; shuffle default ON + shuffled initial playlist (random start every load); autoplay-on-skip retry loop
- **Open items**: rotate Discogs consumer secret (brief `pagination.urls` exposure 2026-07-17, leak itself fixed); dedicated `SESSION_SECRET` env (E3); next up B3 cue preview / B4 similar-source wiring / C-phase structure work

### ✅ Deploy-time checklist — COMPLETED 2026-07-17
1. ✅ RLS migration `20260715000000_lock_down_youtube_videos.sql` applied remotely (found already synced on 2026-07-17)
2. ✅ `track-cache` v7, `track-media` v6, `youtube-rescan-weekly` v7 deployed (client was already live since 2026-07-15 — backward-compatible order held)
3. ✅ `run-migration` was never deployed remotely — nothing to delete (repo copy removed in Pass 1)
4. ⏳ Still open: set a dedicated `SESSION_SECRET` on edge functions (currently falls back to service-role key)
5. ✅ Live guard verification against prod: rescan w/o service key → 401; username-key track-cache upsert w/o session → 401; `csv-*` upsert+delete roundtrip → ok (test row cleaned up)

## Phased Roadmap (2026-07-17 — ALL feature ideas are committed for eventual implementation, per Carlos)

**Phase A — Audio engine (DONE 2026-07-17, shipped in `4eed9e2`)**
- A1. Direct audio (yt-dlp/Invidious → HTML5 `<audio>`) into MobilePlayer, iframe fallback kept
- A2. Media Session API (lock-screen artwork + transport)
- A3. Quick win: candidate-failover (try cached `youtube2` before re-searching on error 150/101)
- A4. Quick win: set-length totals (total runtime wherever track counts show)
- A5. ±8% pitch fader with slider in the PWA (usePitch + audio playbackRate, preservesPitch=false for true vinyl behavior) — AFTER A1

**Phase B — Collector surfaces (B1 DONE `4eed9e2`; B2 DONE 2026-07-17 on `claude/check-out-jkrunj`)**
- B1. ✅ Wantlist price awareness in PWA (port extension `useMarketplace.getBulkStats` + price badges)
- B2. ✅ Crate-digging filters (genre/label/decade/country chips in playlist sheet — no separate style field on Track; styles fold into `genre` at ingest)
- B3. Cue preview mode (long-press row → low-volume preview stream; needs A1)
- B4. Wire `'similar'` source end-to-end (extension similar-releases → playable tracks)

**Phase C — Unification & structure**
- C1. Extension ↔ PWA state bridge (crates/playlists/carts: JSON export/import first, Supabase tables later)
- C2. One shared virtualized playlist component (MobilePlaylistSheet + NowPlayingView)
- C3. Shared THEMES + SourceType constants module; finish SourceType consolidation into types/track.ts
- C4. Bandcamp: restore behind Settings flag or strip plumbing (decide once, apply to both surfaces)

**Phase D — Performance & delivery**
- D1. Code-splitting (lazy /auth + /library, manualChunks; consider both Vite entries)
- D2. Virtualization perf pass on 2k+ collections
- D3. PWA offline shell (service worker + cover cache)
- D4. CI gate (npm ci, test, lint, **typecheck**, build) — GitHub Action

**Phase E — Hardening & quality**
- E1. Scheduler tests (fake-timer specs for useBackgroundVerifier, usePlayer invariants)
- E2. Cover-art write path via edge fn + RLS lockdown of release_cover_art
- E3. Dedicated SESSION_SECRET env (remove service-role fallback)
- E4. Tighten CSP once C4 decided

## Suggestions — v2 (2026-07-17, Sonnet deep-dive re-rank; carried between loop cycles)

### Top priorities (re-ranked with the Chrome extension in the picture)
1. **Direct audio + Media Session API into MobilePlayer** (M/L) — now UPGRADED from "nice UX" to "unblocks shipped features": the extension's DJ pitch slider (`usePitch.ts`) is functionally inert against YouTube (±8% snaps to YT's fixed rate set → always 1.0) and only works against a real `<audio>` element. `useAudioController.attachAudioElement` is already built and waiting. Reference impl recoverable: `git show f384d8c^:src/hooks/useDirectAudio.ts`.
2. **Crate-digging filters** (S/M) — genre/label/year/country fully cached per track but the player only sorts, never filters. Complementary to (not duplicated by) the extension's `useSimilarReleases` marketplace discovery.
3. **Wantlist price awareness** (now S, was M) — LARGELY BUILT by the extension: port `useMarketplace.getBulkStats` + a price badge into the PWA wantlist rows. Clearest "port, don't rebuild" win.
4. **Free candidate-failover** (S, NEW) — on YouTube error 150/101, `handlePlayerError` re-searches the network but never tries the already-cached `track.youtubeCandidates[1]` (youtube2 column). Zero-cost, zero-quota retry sitting unused.
5. **Set-length totals** (S, NEW) — durations are tracked and even corrected from real YT playback, but no surface shows total runtime of a crate/playlist/filtered list. DJs think in minutes, not track counts.

### Enormous collections/wantlists (2026-07-18 look-in; caps removed, these are the next bottlenecks)
- **localStorage is the next hard ceiling** (~5MB): a 10k-track collection's JSON blows it and writes start throwing silently. Move the offline cache to IndexedDB (the extension's `src/lib/db.ts` is a ready pattern) with localStorage fallback for small sets.
- **Progressive hydration**: track-cache `get` now returns everything, but the client waits for the full payload before first render. Stream page-by-page into state (first 1000 → instant player, rest in background).
- **Virtualize the playlist sheet** (roadmap D2): 10k unvirtualized rows will jank the sheet open/scroll. `@tanstack/react-virtual`.
- **Server-side pre-resolution**: for huge sets, the client verifier (1 track/~1s) takes hours. Raise the weekly rescan's per-pass row budget or add an on-demand "resolve my pending tracks" server pass so links are ready before the user ever opens the app.
- **Dirty-row upserts**: the 500ms-debounced upsert still rewrites ALL rows each burst; for 10k tracks that's 20 chunked requests per save. Track dirty ids and upsert only changed rows.

### Structural (both surfaces)
6. **Unify extension ↔ PWA state** (L; S if scoped to JSON export/import) — extension crates/playlists/carts live in a private IndexedDB (`src/lib/db.ts`), invisible to the Supabase-backed PWA. Crate-dig on discogs.com, can't play it on the phone.
7. **One virtualized playlist component** (S/M) — the unvirtualized `.map` list now exists TWICE (`MobilePlaylistSheet`, extension `NowPlayingView`).
8. **Shared THEMES + SourceType constants** (S) — themes and types duplicated between PWA and extension; will drift. (SourceType half fixed 2026-07-17 — MobilePlaylistSheet now imports from SourceFilters; full consolidation into types/track.ts still open. The `'similar'` source is half-wired UI-side and looks intended as the bridge for extension similar-releases → playable tracks.)
9. **Scheduler tests** (M) — `useBackgroundVerifier` is now imported by BOTH surfaces; a timer regression hits two apps at once.
10. **CI gate** (S) — MUST use `npm run typecheck` (added 2026-07-15..17), NOT bare `tsc --noEmit`: root tsconfig has `files: []` and checks nothing (this hid 9 real errors including a panel crash until 2026-07-17).
11. **Cover-art write path lockdown** (S/M) — `release_cover_art` still world-writable by anon; route writes through `discogs-public`, then service-role-lock RLS.
12. **Code-splitting** (S/M) — 696 kB main bundle; consider both Vite entries (app + extension panel). Also still open: Bandcamp decide-or-strip; PWA offline shell; `SESSION_SECRET` dedicated env.

## Suggestions v1 (2026-07-15, superseded by v2 above — kept for history)

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

### 2026-07-18 — Quota failsafes rebuilt; 1000-row cap removed; random start + skip autoplay (per Carlos)
- **Root cause of the quota message**: the chain's quota-free tiers were both dead in production — yt-dlp can't spawn subprocesses in Supabase's edge runtime (instant fail), and the 2024-era Invidious list (puffyan/kavin/snopyta/lunar — all shut down) cost timeouts then failed. Nearly every search fell through to the official API and burned quota.
- **Chain rebuilt** (`youtube-search` edge fn): yt-dlp (kept first — works if ever self-hosted) → **YouTube results-page scrape** (NEW: parses videoRenderer blocks from ytInitialData; quota-free, key-free, no third-party instance to rot; parser unit-verified incl. escaped quotes + dedupe) → Invidious (refreshed 2026 list: inv.nadeko.net, yewtu.be, f5.si, nerdvpn.de, melmac.space; capped to 2 query variants) → **Piped** (NEW: adminforge.de, private.coffee, reallyaweso.me) → official API strictly last. Weekly rescan inherits the new chain automatically (it invokes youtube-search).
- **NOTE — could not live-verify instance liveness or the scrape from the dev sandbox (egress blocked, 000s); needs a prod invoke test after deploy.**
- **Deploy status**: Vercel preview auto-deployed off the branch push — `dpl_2L6UyCZ8QvzKaMWP2gPoQ6yJDQYT` READY at https://discogs-stream-git-claude-chec-aad011-carlosfranzettis-projects.vercel.app (commit `8205be9`). ⚠️ Supabase edge fns `youtube-search` + `track-cache` NOT yet deployed — MCP deploy required interactive approval unavailable in the remote session, and no `SUPABASE_ACCESS_TOKEN` for CLI. Until they're deployed, prod still runs the old chain/cap: deploy via `npx supabase functions deploy youtube-search track-cache` (or approve the MCP deploy), preserving remote verify_jwt (youtube-search=true, track-cache=false — config.toml says false for both; CLI deploy would flip youtube-search, which still works since clients send the anon JWT).
- **1000-track cap removed**: `track-cache` `get` was one select → PostgREST silently caps at 1000 rows, truncating bigger collections on return visits. Now pages internally 1000/batch until exhausted, ordered by track_id (stable key), no total cap. Client `upsertTracks` chunked 500/req (was POSTing the whole collection in one body, debounced). Cover-art batch `.in()` chunked 200 ids/req (URL overflow + same 1000-row cap).
- **Random start**: `usePlayer` isShuffle now defaults TRUE (code had drifted from CLAUDE.md) and the initial playlist state is shuffled — index 0 is a different random track every load.
- **Skip autoplay**: replaced the one-shot 200ms enforce-autoplay check with a ~3s retry loop (300ms × 10) — the old check gave up if the iframe was still remounting after the direct-audio engine unmounted on skip, leaving the next track silent.
- **Copy fixes**: QuotaBanner "Demo mode — YouTube quota exceeded" → "YouTube API quota reached — quota-free fallback search active"; player status row "Streaming via Invidious" → "API quota reached — using fallback search".
- DB persistence + weekly rescan verified untouched: client still upserts youtube1/youtube2 + working_status per track; `youtube_videos`/`search_cache` writes in the edge fn unchanged; pg_cron rescan `0 4 * * 0` intact.
- Verified: tests 9/9, typecheck 0 errors, lint 0 errors, build OK.

### 2026-07-17 — Memorystate synced to post-ship reality; B2 crate-digging filters implemented
- Current State header rewritten: Pass 1 + Phase A + B1 are committed/pushed/deployed (`4eed9e2` on master), not "local and uncommitted" as the stale header claimed; Phase A marked DONE, B1 checked off
- **B2 implemented** (`MobilePlaylistSheet`, display-only like search so playlist indices stay correct): funnel chip toggles facet rows — genre / label / decade / country — built from the loaded playlist (top 12 per facet by frequency, counts shown). OR within a facet, AND across facets; active-filter count on the funnel chip; Clear-filters action; header flips to "X of Y tracks" and the A4 runtime total tracks the filtered view. No style facet: Discogs styles fold into `genre` at ingest (`genres[0] || styles[0]`), noted in roadmap
- Facets with <2 distinct values self-hide (nothing to dig through); 'Unknown' genre/label and year 0 excluded from chips
- Verified: tests 9/9, typecheck 0 errors, lint 0 errors/15 warnings, build OK. CLAUDE.md filter section updated

### 2026-07-17 — Parallel agents landed; B1 wired; SECRET LEAK caught & fixed in prod
- **Opus agent #1 (extension)**: all 6 review findings fixed — CompactPlayer volume/mute now drives the YT player; single `usePitch` lifted into PanelApp (new `PitchControl` type) passed to CompactPlayer + NowPlayingView; auto-load effect re-runs when tracks arrive (with once-per-release guard); `.catch` on every dbSet/dbDelete in crates/playlists/carts; no-empty lint error fixed; auto-skip uses `skipNextRef`. typecheck/lint/test/build/build:extension all green.
- **Opus agent #2 (marketplace/CI)**: `discogs-public` now handles `{path}` with a strict whitelist (`/marketplace/stats/\d+`, `/database/search?` with param whitelist q/type/genre/style/year/format/per_page), 24h cache under `discogs-public:path:*` keys; new `useWantlistPrices` hook (1 req/s queue, dedupe, Map+version); `.github/workflows/ci.yml` (npm ci → test → lint → typecheck → build).
- **B1 UI (main agent)**: playlist sheet requests prices for open-sheet wantlist rows (cap 40) and shows lowest-price badges (`$X.XX`, tooltip = num for sale).
- **Deployed + E2E-tested `discogs-public`**: stats ✓ (real data), search ✓, non-whitelisted path → 400 ✓, legacy release_id ✓.
- **🔴 Security catch during E2E**: Discogs echoes the request query string — including our consumer key+secret — back in `pagination.urls`, and the proxy passed it straight to clients (and into the 24h cache). Fixed (strip `pagination.urls` before cache/response), tainted cache rows purged via SQL, redeployed, re-tested clean. ⚠️ Recommend rotating the Discogs consumer secret (was exposed for ~minutes on a just-created endpoint).
- Dedicated Sonnet error-checker now reviewing the full uncommitted diff before ship.

### 2026-07-17 — Phase A IMPLEMENTED (direct audio, Media Session, failover, totals, pitch) + parallel agents dispatched
- **A1**: `useDirectAudio` + `DirectAudioPlayer` restored from git history (with new `onAudioElement` callback + `preservesPitch=false` turntable behavior). MobilePlayer now probes yt-dlp/Invidious per video (5s race, per-video failure memory, session-off after 3 consecutive fails) and mounts `<audio>` instead of the YT iframe when a direct stream resolves; iframe remains the fallback engine. Seek/duration/ended routed per engine.
- **A2**: new `useMediaSession` hook — lock-screen metadata/artwork + play/pause/next/prev/seekto handlers.
- **A3**: `handlePlayerError` now tries the cached `youtubeCandidates` alternate (youtube2) before any network re-search (new `candidateTriedRef` stage before the search stage).
- **A4**: playlist sheet header shows total runtime of the visible queue (h:mm / m:ss).
- **A5**: ±8% `PitchSlider` (shared with extension) rendered under the timeline when the direct engine is live; single `usePitch` instance attached via `onAudioElement`.
- **Parallel agents (per Carlos)**: Opus agent #1 fixing the 6 extension review findings (CompactPlayer volume, pitch-state lift into PanelApp, auto-load deps, IndexedDB catches, no-empty lint error, stale skipNext); Opus agent #2 fixing the discogs-public `{path}` contract (HIGH — marketplace/similar dead) + `useWantlistPrices` hook + CI workflow. A dedicated Sonnet error-checker runs after they land.
- **Sonnet review pass 2 findings (7)**: logged; #1/#2 assigned to agents; remainder in agents' scope. Review also confirmed clean: discogsSync, discogs-auth/api, youtube-search chain, core hooks.
- Verified mid-flight: typecheck 0 errors, tests 9/9.

### 2026-07-17 — Suggestions subagent returned: found a P0 panel crash + a broken typecheck; all 9 type errors fixed
- **The root `tsc --noEmit` was checking NOTHING** (`tsconfig.json` has `files: []`) — every earlier "tsc clean" was hollow. Added `npm run typecheck` → `tsc -p tsconfig.app.json --noEmit` (now genuinely 0 errors).
- **P0 fixed**: `PanelApp.tsx:294` passed undeclared `audioRef` → ReferenceError crash of the extension's DEFAULT tab on load (prop is optional in NowPlayingView; removed).
- Also fixed: MobilePlayer media-union narrowing (3 errors — `strict:false` breaks null-discriminant narrowing; used `'youtubeId' in media`), duplicated SourceType (MobilePlaylistSheet now imports from SourceFilters), missing YT typings (`origin`/`host` playerVars, `setPlaybackRate`/`getPlaybackRate`).
- Suggestions section rewritten as v2 (see above): pitch slider is inert without direct audio (top pick reinforced); wantlist prices now mostly a port job from extension's `useMarketplace`; 2 new S-effort wins (candidate-failover, set-length totals); extension↔PWA state split flagged.
- Verified: typecheck 0 errors, tests 9/9, build OK.

### 2026-07-17 — Supabase hardening deployed + verified live; suggestions subagent running
- Deployed `track-cache`/`track-media`/`youtube-rescan-weekly` via `npx supabase functions deploy`; RLS migration was already applied remotely; `run-migration` never existed remotely
- All three new guards verified against production with curl (401/401/ok — see checklist above)
- Note: remote `youtube-search`/`invidious-audio`/`yt-dlp-audio` run with `verify_jwt=true` (differs from config.toml's false) — works because the client invokes with the anon-key JWT; leave as-is
- Background Sonnet subagent dispatched to expand the Suggestions section (re-rank vs the new Chrome extension, add code-grounded candidates)

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
