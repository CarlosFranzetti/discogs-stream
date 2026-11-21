# MEMORY STATE — Discogs Stream

> Current state only. Where things go:
> - **State** (what is true now, what is deployed, what needs a human) goes in this file. Edit it in place; keep it under about 90 lines.
> - **Plans** (backlog, decisions, roadmap, ideas) go in `FUTURE.md`.
> - **Finished-session detail** goes in `docs/HISTORY.md`. Add a dated entry there at the end of a session, never edit or delete old ones, then replace the oldest of the three summaries below.

## Current state (last updated 2026-11-21)

- **Branch**: `claude/check-out-jkrunj`. Three pieces of work are not on master: `0e24a87` (virtualized playlist, search, user playlists), `c980540` plus `796d4cf` (demo crate, `/links`, direct-audio rework, CSP fix, blank-queue fix, title-screen tidy, docs restructure), and the playlist-panel second pass, `763e32a` plus the commit that carries this note (filter rail and picker, playlist editor, play in the playlist's own order, `usePlayer` fix, panel title restyle). Not merged. `origin/master` was last recorded at `da95f12` (2026-11-11).
- **Prod frontend**: Vercel production was last recorded READY at `da95f12` (`dpl_3wuStn4W38PuEpbFpNaSnhQjmsfu`) on https://discogs-stream.vercel.app. Nothing from `0e24a87`, `c980540` or the playlist-panel second pass is live until the branch is merged.
- **Prod edge functions**: last recorded 2026-11-11: `youtube-search` v15 (deployed by CI, includes the duration filter), `track-cache` v14. The reworked `invidious-audio` and `yt-dlp-audio` are in the branch, not deployed.
- **Not verified in production**: direct audio (`invidious-audio` race over Invidious then Piped, 8s budget). The dev sandbox has no network egress.
- **Health**, as of the playlist-panel second pass (2026-11-21): tests 58 passing across 5 files, typecheck (`npm run typecheck`) 0 errors. lint 0 errors / 14 warnings, build OK.
- **Supabase side**: hardening deployed and live-verified 2026-07-17 (RLS migration synced, 401 guards checked against prod). Weekly rescan runs by pg_cron `0 4 * * 0`.

## Deployment facts that bite

- **verify_jwt**: `invidious-audio` and `yt-dlp-audio` must stay `verify_jwt = true` (deployed setting; `config.toml` now matches). Other functions are `false`. A bare `supabase functions deploy` with no name would flip them, so always deploy functions BY NAME.
- **Edge functions deploy through CI**: `.github/workflows/deploy-edge-functions.yml`. A push to master touching `supabase/functions/**` deploys only the changed function directories; a manual run takes space-separated names. A `_shared` change only emits a warning. It needs the repo secret `SUPABASE_ACCESS_TOKEN`. MCP deploys from remote sessions fail with "requires approval".
- **Master is production**: every push to master auto-deploys the frontend to production on Vercel (Git integration). Merging `claude/check-out-jkrunj` therefore ships the frontend and, through CI, the two audio functions.
- **Preview URLs need a Vercel login**: branch preview deployments are not publicly viewable. The local `vercel` CLI token was recorded as expired (`vercel login` needed for manual deploys).
- **Typecheck**: use `npm run typecheck` (`tsc -p tsconfig.app.json`). Bare `tsc --noEmit` checks nothing because the root tsconfig has `files: []`.

## Open items needing a human

- Rotate the Discogs consumer secret (exposed briefly on 2026-07-17 through `pagination.urls`; the leak itself is fixed).
- Set a dedicated `SESSION_SECRET` on the edge functions (currently falls back to the service-role key).
- Merge `claude/check-out-jkrunj` to master, then confirm the CI deploy of `invidious-audio` and `yt-dlp-audio` and test direct audio in production (details in `FUTURE.md`).
- Try the new playlist panel on a real iPhone: drag reorder in the editor, and the facet picker with the keyboard open. It was only driven in headless Chromium with touch emulation.
- Rebuild the Chrome extension locally (`npm run build:extension`, reload) to pick up the 2026-07-17 panel fixes (last recorded as pending; unverified whether done since).

## Last 3 sessions (newest first; full detail in `docs/HISTORY.md`)

- **2026-11-21 (second session)** — Playlist-panel second pass (`763e32a`): facet rail and picker (`src/lib/facets.ts`), playlist editor with reorder, move-to-position, undo and running set length, play in the playlist's own order, and a `usePlayer` fix so the current track stays put when the playlist changes. 58 tests, typecheck clean; not tested on a real iPhone.
- **2026-11-21** — Shipped `c980540`: demo crate (`?demo`), `/links` page, direct-audio rework, CSP font/media fixes, blank-queue fix. Research on YouTube pitch limits, playlist editing and facet design. Docs restructured into this file, `FUTURE.md` and `docs/HISTORY.md`. A mobile UX audit backlog was recorded in `FUTURE.md`; none of it is fixed.
- **2026-11-11** — Playlist UX pass (`0e24a87`): virtualized queue (1800 tracks mount 22 rows), multi-field debounced search, user playlists (localStorage, ids not copies). Confirmed prod at `da95f12` with `youtube-search` v15.

## Pointers

- `FUTURE.md` — backlog, pending decisions, Decks mode, roadmap, ideas.
- `docs/HISTORY.md` — complete engineering log and superseded suggestion lists.
- `PRD.md` product requirements · `CLAUDE.md` architecture guide · `docs/CODEBASE-FUNCTIONS.md` function reference · `LOOPY.md` loop playbook.
