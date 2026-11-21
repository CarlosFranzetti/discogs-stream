# Engineering history — Discogs Stream

Append-only record of finished engineering sessions. Entries are never deleted or rewritten; new ones go at the top of the Log, newest first. Live state is in `../memorystate.md`, forward-looking plans are in `../FUTURE.md`.

Layout: Log (dated entries) · Superseded: Current State snapshot of 2026-11-11 · Superseded: Suggestions v2 · Superseded: Suggestions v1 · Completed deploy-time checklist.

Items from the old Suggestions sections that are demonstrably done (so they are not carried into FUTURE.md): direct audio + Media Session (A1/A2, `4eed9e2`), crate-digging filters (B2), wantlist price badges (B1), candidate failover (A3), set-length totals (A4), virtualized playlist sheet (D2, `0e24a87`), code-splitting (D1), CI gate (D4, `.github/workflows/ci.yml`), the 1000-row cap, the dead Invidious list, and the unconsumed direct-audio functions.

## Log

<!-- Add new entries directly below this line, newest first. -->

### 2026-11-21 (second session) — Playlist-panel second pass: filter rail and picker, playlist editor, play in order, `usePlayer` fix
- **State**: on `claude/check-out-jkrunj` as `763e32a` plus the commit carrying this entry; not merged, not deployed. Carlos chose Filters option A and Playlist editor option A plus two things from option C (running set length, "Move to position…"). Both are built.
- **Panel title**: Carlos asked for the italic serif heading in the mockup to go. The panel title ("Up Next" / "Playlists" / the playing playlist's name) is now the UI sans, small, bold, upper-case and in the theme's primary colour; the playlist name in the editor is sans bold. The global `h1, h2, h3` serif rule in `src/index.css` is unchanged (the player's track title still uses it).
- **Health**: tests 58 passing across 5 files, typecheck 0 errors, lint 0 errors / 14 warnings, build OK.
- **Filters, "one rail, one picker"**:
  - New pure module `src/lib/facets.ts` (`FacetKey`, `FacetSelections`, `FACET_KEYS`, `FACET_LABELS`, `EMPTY_FACETS`, `facetValue`, `countSelected`, `parseSearchTerms`, `matchesSearch`, `matchesFacets`, `filterTracks`, `facetOptions`, `formatRuntime`). The playlist panel, the facet picker and the add-tracks picker all filter through it. Tests: `src/lib/facets.test.ts` (27).
  - `src/components/playlist/FacetRail.tsx`: one horizontally scrolling, never-wrapping row of 32px chips (Sort, each facet with two or more values in the queue or a selection, then the Collection / Wantlist toggles). A second single row holds applied filters as removable chips, "Clear all" when two or more are applied, and a "Save N as playlist" chip when a search or filter is active.
  - `src/components/playlist/FacetPicker.tsx`: tapping a facet chip replaces the panel body (no second sheet). Draft selection, "‹ Filters" cancels, a search field when the facet has more than 8 values, rows with counts, at most 50 values listed without a search ("N more — type to search"), and a bottom bar with Clear and a primary button stating the result count ("Show 3 tracks"), disabled at zero. Counts are disjunctive: computed over tracks matching the search and every other facet, so a value that would return nothing is not offered. Row order is fixed while the picker is open.
  - Sort is now a chip opening the same picker with six options: Queue order, Artist A–Z, Title A–Z, Genre, Year, Label (Year and Label are new).
  - The old design (a Filter toggle expanding four wrapping chip rows, top 12 values per facet) is gone; there is no cap now because the picker scrolls and searches. "Save these N as…" is no longer a permanent row: the chip reveals a name field when tapped, and after saving a notice offers "Open".
- **Playlist editor**:
  - `src/components/playlist/PlaylistEditor.tsx`, opened by tapping a playlist in the Playlists tab (the play button on the row still plays immediately). Listen mode: tap a row to play from there; each row shows the running set length; the header shows track count and "set length"; bottom bar "Play in order" and "Shuffle". Edit mode (Edit / Done): name becomes a field, red remove control on the left, a row-number chip opening "Move to position…" (number field, Move, move-to-top, move-to-end), drag handle on the right, bottom bar "Add tracks from library" and delete.
  - Reorder is a handle-only pointer drag (`touch-action: none` on the handle only, so the row body still scrolls and nothing competes with the panel edge swipe), fixed row heights in edit mode, auto-scroll near the list edges, and arrow keys on the handle as the non-drag alternative. No new dependency.
  - `src/components/playlist/AddTracksPicker.tsx`: virtualized, searchable library list with add/remove toggles; replaces the panel body.
  - Undo for removing a track, moving a track and deleting a playlist, as an in-panel notice bar (6 seconds). It lives inside the sheet on purpose: a toast outside a modal Radix sheet cannot be tapped, and tapping it would dismiss the sheet. Deleting a playlist no longer uses the browser `confirm()`.
  - `src/hooks/useUserPlaylists.ts` gained `moveItem` (exported helper), `moveTrack`, `moveTrackById` (id-based, safe against ids that do not resolve), `setPlaylistTracks` (used by Undo) and `restorePlaylist` (Undo for delete). `renamePlaylist` now has UI. Tests: `src/hooks/useUserPlaylists.test.ts`.
  - The Queue tab lost its per-row × for removing from the playing playlist; its "Playing <name>" banner now has Edit (opens the editor) and Library (back to the full library). Row + buttons and other small controls in the panel were enlarged to 36–44px tap targets.
  - Playlists resolve against the whole library (`libraryTracks` prop = `verifiedTracks`), not the queue, because while a playlist plays the queue is that playlist.
- **Play in the playlist's own order** (`src/hooks/usePlayer.ts`): new third argument `options.orderedContextKey` (the active playlist id, or null). While non-null, "shuffle off" means the given order instead of `sortSequential`; entering a playlist starts at its first track with shuffle off; leaving restores the listener's shuffle setting and keeps the playing track. New `playFromContext({ shuffle?, startTrackId? })` and `requestContextStart(key, start)`; `MobilePlayer.handlePlayPlaylist` uses them.
- **Bug found and fixed in `usePlayer`**: the effect meant to keep the same track current when the playlist changed never worked, because an earlier effect overwrote the remembered track id in the same commit. It is replaced by a render-time adjustment (React's "adjust state when a value changes" pattern) keyed on the previous playlist array, so no render commits with the index pointing at the wrong track. Visible effects: toggling shuffle no longer swaps the playing track; in sequential mode newly resolved tracks no longer shift playback; after a dislike (remove and skip) playback lands on the true next track instead of skipping one; reordering or removing tracks in a playing playlist keeps the current track (if the current track itself is removed, the next one slides in). Tests: `src/hooks/usePlayer.test.ts`.
- **Verification and its limits**: 58 unit tests passing across 5 files; typecheck (`npm run typecheck`) 0 errors. Driven in headless Chromium at 390×844 with touch emulation against the demo crate: rail → Label picker → apply → save as playlist → open editor → drag reorder (mouse and touch, including auto-scroll across 25 rows) → Undo → Move to position → remove → Undo → rename → add from library → Play in order → queue banner → back to library, with no page errors. NOT tested on a real iPhone. The sandbox has no network, so tracks could not resolve: audible play-in-order was verified only by unit tests and by the first track shown. Lint and build were run by the lead (result in `memorystate.md`).
- **Still open**: nothing is merged; merging ships the frontend and, via CI, the two audio functions. Direct audio is still not verified in production, and Decks mode (planned, not built) is blocked on that. The mobile UX audit backlog in `FUTURE.md` is unchanged except a note on M3 (the playlist panel's tap targets are done; M3 is not ticked). B5 is specified, not built. `docs/CODEBASE-FUNCTIONS.md` is still stale. Playlists are still localStorage-only.

### 2026-11-21 — Demo crate, link page, direct-audio rework, blank-queue fix (`c980540`); research for filters, playlist editor and Decks
- **Branch state**: `claude/check-out-jkrunj` carries two commits not yet on master: `0e24a87` (virtualized playlist, search overhaul, user playlists) and `c980540` (everything below).
- **Demo crate** (`src/data/demoCrate.ts`): 25 real electro and techno records (Kraftwerk, Cybotron, Drexciya, Model 500, Jeff Mills, Robert Hood, Basic Channel, and others). Offered on the title screen only while the library is empty; the `?demo` deep link loads it directly. Session-only: ids start with `demo-`, never written to `discogs_track_cache` or localStorage, and any real import or cloud load replaces them. No hardcoded YouTube ids (the search chain resolves them); covers are generated SVG data URIs; the header shows "Demo crate · Electro & Techno".
- **Blank-queue bug fixed** (`MobilePlaylistSheet.tsx`): the virtualizer's scroll element was a ref. The Sheet content mounts through a portal after the parent's layout effect, so a quiet library rendered zero rows. The scroll element is now held in state (callback ref).
- **Direct audio rework**: `invidious-audio` now races the vetted Invidious list, then Piped (`/streams/{id}`), within about 8s and prefers m4a. `yt-dlp-audio` returns 501 `yt_dlp_unavailable` immediately on Supabase. Client `useDirectAudio` asks both in parallel; probe timeout raised from 5s to 9s. NOT yet verified in production (the sandbox has no egress).
- **CSP** (`vercel.json`): added `font-src 'self' data: https://fonts.gstatic.com` (Space Grotesk and Playfair were blocked in production) and `media-src 'self' https:` (direct streams were blocked).
- **`supabase/config.toml`**: `verify_jwt = true` for `invidious-audio` and `yt-dlp-audio`, matching the deployed setting, so the CI deploy-by-name cannot flip them.
- **Link-in-bio page**: `public/links.html`, served at `/links` through a rewrite in `vercel.json`.
- `tsconfig.app.json` lib raised to ES2021 (`Promise.any`).
- An Instagram story kit (3 frames, 1080x1920) was produced outside the repo.
- **Research findings**:
  - YouTube IFrame API: `setPlaybackRate` rounds an unsupported rate "to the nearest supported value in the direction of 1". A vinyl-style pitch of +/-8% is therefore impossible on the iframe engine; it works only on the direct `<audio>` engine (`playbackRate` with `preservesPitch=false`).
  - Playlist editing patterns (Spotify, Apple Music): explicit edit mode; remove control on one side and drag handle on the other; a non-drag alternative (move up/down); the wording "Remove from playlist"; undo after removal; stable playback while editing; entries modelled with stable ids and positions.
  - Long facet lists: show the top 4-6 values per facet, hide the rest behind "show more" or a search-within-filter; show applied filters as removable chips.
- A read-only mobile UX audit produced the backlog now in `FUTURE.md` "Now". None of it is fixed.

### 2026-11-11 — Playlist UX pass: virtualization (D2), search overhaul, user playlists (NEW)
- **Confirmed deployed before starting**: prod frontend READY at `da95f12`; `youtube-search` **v15** deployed *by the CI workflow* (entrypoint path is a GH Actions runner), so the duration-filter fix from `644aa78` is live. `invidious-audio`/`yt-dlp-audio` still verify_jwt=true — the by-name deploy guard did its job.
- **D2 virtualization DONE** — the sheet rendered every row: a 1800-track queue mounted ~1800 DOM rows and fired ~1800 cover requests on open. Now `@tanstack/react-virtual` over a plain overflow container (not Radix ScrollArea, so the virtualizer owns a real scroll element and mobile momentum scrolling is native). **Measured: 1800 tracks → 22 rows mounted**, 12 scroll jumps in 876ms, window stays ~30.
- Also killed the per-row `playlist.indexOf(track)` (O(n²) per render — 2ms at 1800, but ~60ms at 10k) via an id→index Map; added `loading="lazy"`/`decoding="async"` to covers.
- **Search overhaul**: was title+artist only and un-debounced. Now spans title/artist/album/label/year, multi-term (all terms must match, any field any order), 150ms debounce, clear (×) button, and an empty state with a one-tap "clear search & filters". **Verified: "transmat" → 225 matches, "1994" → 40** — both returned nothing before.
- **User playlists (NEW)** — `useUserPlaylists` hook, localStorage-backed, storing track IDs not copies (a 500-track playlist is a few KB and can never go stale against library metadata). Shape matches a future `user_playlists` table so the Supabase move is transport-only (C1).
  - Sheet now has Queue / Playlists tabs; create, delete, play, add/remove track.
  - Per-row `+` opens an inline picker (existing playlists + "New playlist…"); inside an open playlist the affordance flips to `×` = remove.
  - "Save these N as…" turns a search/filter result into a playlist in one tap.
  - **Playback design**: playing a playlist narrows `filteredTracks` in MobilePlayer rather than calling `setPlaylist` — usePlayer re-merges `initialTracks` on every library update and would clobber a hand-set list. Shuffle/skip/verification keep working untouched. Deleting the active playlist falls back to the library.
- **Verified in a real browser** (Playwright, 390×844, 1800-row CSV through the actual import path): build playlist from rows → play → queue narrows to 3 → "Playing from" banner → exit → back to 1800. Zero page errors.
- Fixed en route: Playlists tab header was reporting queue stats ("40 of 1800 tracks") under a playlist heading.
- Still open (unchanged): `invidious-audio` instance list is rotten so direct audio never engages and the pitch fader stays inert against the iframe; rotate Discogs consumer secret; `SESSION_SECRET` (E3); B5 spec'd not built.

### 2026-10-27 — Header refreshed; edge-fn deploys moved to GitHub Actions (no laptop needed)
- Current State header was stale (still claimed master at `71463b9`); corrected to `c613180` with the real prod Vercel deployment and the v10-vs-repo gap on `youtube-search` spelled out.
- **New `.github/workflows/deploy-edge-functions.yml`**: deploys edge functions from CI so a local Supabase CLI is no longer required. Push to master touching `supabase/functions/**` deploys only the function dirs that changed in that push; manual run takes space-separated names. **Always deploys BY NAME** — a bare `supabase functions deploy` would flip remote `invidious-audio`/`yt-dlp-audio` from verify_jwt=true to false (config.toml says false for all nine), so blanket deploys are structurally prevented. `_shared` changes emit a warning instead of guessing dependents. Needs one repo secret: `SUPABASE_ACCESS_TOKEN`.
- Project ref hardcoded in the workflow deliberately: it is the hostname of every request the public site already makes, so it is not a secret; only the token is.

### 2026-07-20 — Wrong-link diagnosis & repair; source toggles fixed; per-source cloud reload (per Carlos)
- **Wrong links root-caused** (user screenshots: a track playing at 0:05 total; another showing the PREVIOUS track's 5:53 duration):
  1. **Search chain accepted junk**: the scrape tier took the first `videoRenderer` on the page — which can be a 5s teaser/Short — and no tier considered duration at all. Once persisted to `youtube_videos` (keyed artist+title), a bad ID replays forever. FIX (`youtube-search`): all quota-free tiers now parse durations (scrape `lengthText`, Invidious `lengthSeconds`, Piped `duration`, API ISO8601); sub-60s results dropped when the expected track is ≥90s (or unknown); scoring adds a duration-closeness term (±15% → +5, ±40% → +2, ≥2x/half → −5) using new `durationSeconds` request field the client sends from real Discogs tracklist durations (240 placeholder omitted).
  2. **Duration cross-stamping**: on skip, the persist-duration effect ran with the NEW `currentTrack` while `playerDuration` still held the OLD video's length → new track stamped (and DB-cached) with the previous track's duration. FIX (`MobilePlayer`): stamp only when `playerRef.getVideoData().video_id` matches the current track's video, and never stamp <30s.
  3. **Bad-link auto-repair**: when a playing "track" reports <30s against a ≥90s (or unknown) expectation, it's routed through the error-150 recovery once per track — cached `youtube2` candidate first, else forced re-search (`refresh:true` overwrites the poisoned `youtube_videos` row). Existing poisoned links self-heal on next play.
- **Playlist source toggles fixed**: chips were gated on sources present in the FILTERED playlist — toggling Collection or Wantlist off removed its chip (one-way door). New `availableSources` prop computed from the full library keeps both chips visible; last-active-source still can't be disabled.
- **Settings → per-source reload**: "Reload collection" / "Reload wantlist" buttons re-pull that source's rows from `discogs_track_cache` (fresh rescan links, imports from another device), rebuild the local slice, and let placeholders re-expand. OAuth Re-sync/Rescan untouched.
- **Loading path quick-check**: initial DB load (placeholder-drop for expanded releases, cache re-apply, chunked upserts) reviewed — sound. One consequence of the duration bug: previously-stamped wrong durations live in `discogs_track_cache` rows; they self-correct when a track plays (stamp guard now correct) or via the <30s auto-repair, no migration needed for now.
- **SHIPPED**: merged to master (fast-forward, `644aa78`) with Carlos's go-ahead → Vercel production deploy `dpl_ERPEjq3na8J6DCHHk1n3vPWpAfHg` READY at https://discogs-stream.vercel.app. Verified on the merged tree before pushing: tests 9/9, typecheck 0, build OK.
- ⚠️ **`youtube-search` edge fn STILL NOT DEPLOYED** — the duration-filter/scoring change is in git + prod frontend, but the deployed fn is still v10 without it. Four MCP deploy attempts across two sessions all returned "requires approval" (non-interactive remote session can't grant it). Deploy from a session with the CLI: `npx supabase functions deploy youtube-search` (remote `verify_jwt` is currently **false** — the CLI reads config.toml which also says false, so no drift). Until then only the REPAIR half is live (cross-stamp guard + <30s auto-repair, both client-side); the PREVENTION half (never pick a Short in the first place) waits on this deploy.
- 🧹 Found on master during the merge: `src/hooks/useDirectAudio 2.ts` — a byte-identical, zero-import duplicate of `useDirectAudio.ts` (macOS " 2" copy artifact) committed by the local session in Pass 2. Harmless but dead; left in place rather than deleted unilaterally since another session created it. Delete when convenient.
- To-do carried: B5 spec'd above for a future release (NOT built); rotate Discogs consumer secret; `SESSION_SECRET` (E3); refresh `invidious-audio` instances so direct audio engages; delete the duplicate hook file.

### 2026-07-20 — Repo↔prod drift on youtube-search synced back into git
- Status check found deployed `youtube-search` v10 AHEAD of the repo: the deploy-and-verify session had refined the chain during live verification — Invidious + Piped instances now raced via `Promise.any` (old sequential loop cost 5s per dead instance, up to 25s), a shared 20s wall-clock budget across the quota-free tiers, and a "7b" embeddability probe (1-unit `videos.list` check filters non-embeddable/deleted IDs from quota-free results before they're persisted; best-effort, keeps originals on probe failure). None of that was committed — a future repo deploy would have silently reverted it.
- Deployed v10 source pulled via management API and committed verbatim to `supabase/functions/youtube-search/index.ts`. `track-cache` v12 checked too: byte-identical to repo, no drift.
- Also noted from prod logs: `yt-dlp-audio` 500s instantly and `invidious-audio` 500s after ~7s on every direct-audio probe (its own instance list is as rotten as youtube-search's was). Client handles it (3-fail session-off → iframe), but refreshing/racing `invidious-audio`'s instances is the obvious next fix if direct audio should actually engage.
- `claude/check-out-jkrunj` restarted from master (`71463b9`) per merged-PR protocol; sync committed there.

### 2026-07-19 — MERGED PR #20 (parallel cloud session) into master
- Reconciled the parallel session's branch `claude/check-out-jkrunj` (3 commits: quota-chain rebuild, 1000-row cap removal, B2 facets) with local pass-2 work. Only memorystate.md conflicted (log union below); code auto-merged.
- ⚠️ Their session could NOT deploy `youtube-search` + `track-cache` (no token in remote sandbox) — deploying + live-verifying now from this session.

### 2026-07-17 — PASS 2 complete: blocker fixed, shipped, code-split. Cycle closed.
- **Error-checker (dedicated Sonnet) verdict on the feature batch**: 1 BLOCKER + 1 MEDIUM, everything else explicitly clean (probe races, engine exclusivity, whitelist bypasses, CI lockfile sync all verified).
- **BLOCKER fixed**: original probe design mounted NEITHER engine while probing → up to 5s of silence on every track change. New design: iframe plays immediately, direct engine takes over at the elapsed position (`initialSeek` applied on `loadedmetadata`). **MEDIUM fixed**: mid-track direct-stream failure now resumes the iframe at the elapsed position (`iframeResumeAtRef` + seek in onReady) instead of restarting at 0:00.
- **Shipped** `4eed9e2` (the full feature batch) → master auto-deployed to production (READY, verified via API) + `development` branch pushed for the preview environment.
- **Pass-2 optimization (D1)**: route-level lazy loading (Auth/Library/NotFound) + manualChunks (react-vendor 160 kB, supabase 170 kB) — main chunk **712 kB → 312 kB** (gzip ~209 → ~100 kB), 500 kB warning gone, vendor chunks now cache across deploys. Extension build untouched and green.
- Production build boots (vite preview 200, title renders). All checks green: typecheck 0, tests 9/9, lint 0 errors, both builds.
- **Loop status**: docs → baseline → cleanup → review → security → features → review → fix → ship → optimize → ship. Next cycle candidates: B2 crate filters, B3 cue preview, C1 state bridge, remaining Phase C/D/E roadmap items. Open user actions: rotate Discogs consumer secret; rebuild the Chrome extension locally (`npm run build:extension` + reload) to pick up the panel fixes.

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

## Superseded: Current State snapshot (last updated 2026-11-11)

Moved verbatim from the old `memorystate.md` header when that file was restructured on 2026-11-21.

- **Branch**: `origin/master` at `da95f12` (Node 26 bump; contains PR #21/#22, the CI deploy workflow and the whole wrong-link pass). Work branch `claude/check-out-jkrunj` restarted from it.
- **Prod frontend**: Vercel production READY at `da95f12` (`dpl_3wuStn4W38PuEpbFpNaSnhQjmsfu`) on https://discogs-stream.vercel.app.
- **Prod edge fns**: `youtube-search` **v15**, deployed BY CI (GH Actions runner entrypoint) and including the duration filter/scoring; `track-cache` v14. `invidious-audio`/`yt-dlp-audio` remain verify_jwt=true.
- ⚠️ **verify_jwt drift to respect before any blanket deploy**: `config.toml` says `false` for ALL nine functions, but remote `invidious-audio` and `yt-dlp-audio` are `true`. A bare `supabase functions deploy` (no function name) would flip those two to no-JWT. Always deploy functions **by name**.
- **Tests**: 9/9 passing · **typecheck** (`tsc -p tsconfig.app.json`): 0 errors · **Lint**: 0 errors / 15 warnings (shadcn boilerplate + 1 intentional deps-array) · **Build**: OK (code-splitting still the top optimization candidate)
- **Shipped 2026-07-17** (`4eed9e2`, auto-deployed to prod via Vercel Git integration): Phase A complete (A1 direct audio, A2 Media Session, A3 candidate-failover, A4 set-length totals, A5 pitch fader) + B1 wantlist price badges + extension review fixes + `discogs-public` path proxy + CI workflow
- **Supabase side**: hardening deployed + live-verified 2026-07-17 (RLS migration synced; `track-cache` v7 / `track-media` v6 / `youtube-rescan-weekly` v7; 401 guards verified against prod)
- **Live app shape**: single `MobilePlayer` at `/` — direct-audio `<audio>` engine (yt-dlp/Invidious probe) with YouTube IFrame fallback; `/library` standalone page, `/auth` Discogs OAuth; Chrome extension side panel shares hooks
- **2026-07-18 on `claude/check-out-jkrunj`**: B2 crate-digging filters; youtube-search chain rebuilt (yt-dlp → **YouTube scrape** [new, quota-free primary] → Invidious [refreshed list] → **Piped** [new] → API last); track-cache `get` pages internally (1000/batch, **no cap** — was silently truncating >1000-track collections); client upserts chunked 500/req; cover-art `.in()` chunked 200/req; shuffle default ON + shuffled initial playlist (random start every load); autoplay-on-skip retry loop
- **Open items**: rotate Discogs consumer secret (brief `pagination.urls` exposure 2026-07-17, leak itself fixed); dedicated `SESSION_SECRET` env (E3); next up B3 cue preview / B4 similar-source wiring / C-phase structure work

## Superseded: Suggestions v2 (2026-07-17)

Moved verbatim. Top priorities 1-5 were all delivered (see the note at the top of this file); items 6-12 and the enormous-collections list live on in `FUTURE.md` (Roadmap and Ideas parking lot).

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

## Superseded: Suggestions v1 (2026-07-15)

Superseded by v2 above; kept for history.

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

## Completed: Deploy-time checklist (2026-07-17)

1. ✅ RLS migration `20260715000000_lock_down_youtube_videos.sql` applied remotely (found already synced on 2026-07-17)
2. ✅ `track-cache` v7, `track-media` v6, `youtube-rescan-weekly` v7 deployed (client was already live since 2026-07-15 — backward-compatible order held)
3. ✅ `run-migration` was never deployed remotely — nothing to delete (repo copy removed in Pass 1)
4. ⏳ Still open: set a dedicated `SESSION_SECRET` on edge functions (currently falls back to service-role key)
5. ✅ Live guard verification against prod: rescan w/o service key → 401; username-key track-cache upsert w/o session → 401; `csv-*` upsert+delete roundtrip → ok (test row cleaned up)
