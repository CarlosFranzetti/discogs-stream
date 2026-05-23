# Phase 3: Discogs OAuth Diff-Sync - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

OAuth-from-Settings login (Discogs IS the account — no separate Supabase email signup), durable per-user persistence of collection + wantlist in `discogs_track_cache` keyed by Discogs username, resume-safe diff sync on mount + manual trigger, and a **weekly server-side background scan** that refreshes YouTube link availability for already-cached tracks.

**In scope:**
- OAuth1 entry from Settings only (REQ-C1)
- `user_tokens` schema **revised**: `username TEXT PRIMARY KEY` (no `auth.users` FK)
- `discogs_track_cache.owner_key` = Discogs username for OAuth users
- Paginated `collection_full` / `wantlist_full` edge function actions (REQ-C3)
- `src/services/discogsSync.ts` diff service (REQ-C4) — preferences never overwritten
- `useDiscogsSync` hook + Settings UI (REQ-C5, REQ-C6)
- Rate-limit-safe sync with exponential back-off (REQ-C7)
- **NEW: Weekly server-side cron** that walks `discogs_track_cache` and re-runs `youtube-search` to refresh `youtube1` / `youtube2`. Treated as part of Phase 3 per discussion.

**Out of scope (deferred):**
- CSV → OAuth migration (see Deferred Ideas)
- Manual track-link override UI

</domain>

<decisions>
## Implementation Decisions

### Identity model
- **D-01:** **Discogs username is the account identity.** No Supabase Auth user is created. `user_tokens` schema is revised to `username TEXT PRIMARY KEY` (drops the `auth.users(id)` foreign key originally specified in TDD.md §2.2 and REQ-C2). This is a documented deviation from `TDD.md` and must be reflected in the new migration.
- **D-02:** `discogs_track_cache.owner_key` for OAuth users is the Discogs `username` string (case-preserved as Discogs returns it). For CSV-only users, `owner_key` remains the existing anonymous `csv-{uuid}` format. The two coexist; CSV rows are not auto-migrated.
- **D-03:** RLS for `user_tokens`: row is readable/writable only when the request carries a session JWT whose `username` claim matches the row. The Discogs OAuth callback edge function must mint such a JWT (signed with the Supabase service role) on successful token exchange and set it as an HttpOnly cookie. Client-side Supabase calls include this cookie automatically.
- **D-04:** Discogs tokens (`discogs_token`, `discogs_secret`) **never** enter localStorage. Only `username` and a `lastSyncAt` ISO string may be persisted to localStorage for cross-session display.

### Sync semantics
- **D-05:** Membership rule — remote Discogs is source of truth. New releases get upserted; releases removed from the Discogs side are **soft-deleted** by setting `working_status = 'non_working'` on every row that belongs to that `release_id`. Rows are never hard-deleted on sync.
- **D-06:** `user_track_preferences` (likes/dislikes) are **read-only from the sync's perspective**. Sync never touches that table. (Confirms REQ-C4 carry-forward from PROJECT.md.)
- **D-07:** Auto-sync triggers: (a) once on mount when `username` is present in the session cookie, (b) manual "Re-sync now" button in Settings. **Not** on every navigation, not on focus. Tab open for days → user must hit "Re-sync now" or refresh.
- **D-08:** Resume-safety: each paginated page is upserted **before** the next page is fetched. A network drop mid-sync leaves `discogs_track_cache` in a valid partial state; the next `syncNow()` call picks up by full re-fetch + diff (idempotent because of `unique (owner_key, track_id)`).

### Unavailable track UX
- **D-09:** Existing `non_working` dim + 3-second auto-skip UX (already in code per `CLAUDE.md`) is the canonical "unavailable" presentation. No new status enum value is introduced. Both "soft-deleted because removed from Discogs" and "no YouTube ID found" map to `non_working`. This is intentional from a UX standpoint — both states mean "in the playlist but not playable right now."
- **D-10:** Background verifier already retries `non_working` tracks at lower priority. The weekly cron (D-13) is a server-side complement to this: it re-checks tracks that the client may never visit.

### Weekly YouTube link-health scan (folded into Phase 3 by user)
- **D-11:** A new Supabase **scheduled edge function** (`youtube-rescan-weekly`, runs `0 4 * * 0` — Sundays at 04:00 UTC) walks `discogs_track_cache` and for each row, re-runs the `youtube-search` chain (yt-dlp → Invidious → YouTube API). It updates `youtube1` / `youtube2` if a new candidate scores higher than the stored one, and flips `working_status` between `working` ↔ `non_working` based on resolution outcome.
- **D-12:** Cron job is rate-limited: max 100 tracks per minute, page through the table; one batch per pass, no parallel passes. It logs to a new `rescan_log` table (date, tracks_checked, links_updated, errors) so the user can see "last rescan: Sunday 04:13 UTC, refreshed 7 / 412 tracks."
- **D-13:** Settings panel surfaces the last rescan timestamp alongside "Last sync" so the user sees both Discogs sync and YouTube rescan freshness.
- **D-14:** Cron honors `youtube-search`'s built-in quota handling — if YouTube quota is exhausted, the yt-dlp/Invidious chain still runs. The cron is deliberately scheduled at 04:00 UTC when the daily YouTube quota has just reset.

### Multi-link redundancy
- **D-15:** Schema already supports `youtube1` + `youtube2` (per TDD.md §2.3). Sync + rescan populate both: highest-scored candidate → `youtube1`, second-highest → `youtube2`. Playback prefers `youtube1`; if it 404s or fails to play, the player falls back to `youtube2` before flipping `working_status = 'non_working'`. (This fallback behavior is a planner concern.)

### Claude's Discretion
- Exact OAuth callback URL routing (`/auth/discogs-callback` vs reusing `/auth`) — planner picks based on existing route structure.
- Toast vs inline error placement in Settings — planner matches existing Settings UX.
- Cron job initial deploy: planner decides whether to deploy enabled or shipped disabled-by-default with a manual toggle for the first week.

### Reviewed but not folded
None.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase contract
- `.planning/REQUIREMENTS.md` §C (REQ-C1..C7) — locked requirements for the Discogs sync sub-project.
- `.planning/ROADMAP.md` — Phase 3 goal + 5 success criteria.
- `.planning/PROJECT.md` — global constraints (Discogs API 60 req/min, no `auth.users` retro-fit, hooks-as-service-layer).

### Source design docs (authoritative)
- `TDD.md` §2.2 — original `user_tokens` schema (note: D-01 explicitly **overrides** the `auth.users(id)` FK).
- `TDD.md` §2.3 — `discogs_track_cache` schema (used as-is, no changes).
- `TDD.md` §2.6 — `user_track_preferences` (sync MUST NOT touch this table).
- `docs/superpowers/specs/2026-04-22-all-sprints-design.md` §"Sub-project C" — diff-sync semantics, soft-delete rule.
- `docs/superpowers/plans/2026-04-22-all-sprints.md` Tasks 14–18 — reference implementation sketches for `discogs-api` actions, `discogsSync.ts`, `useDiscogsSync`, Settings wiring.
- `PRD.md` §5.2 — OAuth + sync product requirements (membership rule, OAuth from Settings only).
- `PRD.md` §5.5 — persistent user state on return visit (loading hierarchy).

### Codebase
- `CLAUDE.md` "Authentication" + "Caching Strategy" + "isUsingMockData" sections.
- `docs/CODEBASE-FUNCTIONS.md` §Hooks/useDiscogsAuth, §Hooks/useTrackCache, §Hooks/useDiscogsData, §Components/SettingsDialog.

### New artifact to produce (Phase 3)
- `supabase/migrations/00X-user-tokens-username-pk.sql` — revised schema per D-01.
- `supabase/functions/youtube-rescan-weekly/` — new scheduled function (D-11).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/hooks/useDiscogsAuth.ts` — already implements OAuth1 request_token + callback flow via `discogs-auth` edge function. Phase 3 task: **strip the localStorage credentials write** and replace with a server-set session cookie + `username`-only client state.
- `src/hooks/useTrackCache.ts` — `upsertTracks` / `loadTracks` / `deleteTracks` already accept an `ownerKey` parameter; sync wires Discogs `username` as that key. `resolveOwnerKey(discogsUsername?)` already prefers username over generated `csv-{uuid}` — usable as-is.
- `src/hooks/useDiscogsData.ts` — `fetchAllTracks` already paginates collection + wantlist via existing edge function. Phase 3 replaces this with `collection_full` / `wantlist_full` (single-call, server-side pagination) for efficiency, but the response shape (Discogs release object) stays compatible.
- `supabase/functions/discogs-api/` — already proxies Discogs API calls with OAuth header signing. Adding two new actions is a localized change.
- `src/components/SettingsDialog.tsx` — already hosts Discogs OAuth connect/disconnect UI. Phase 3 adds the "Last sync" + "Re-sync now" + "Last rescan" lines + sync error surface.

### Established Patterns
- All Discogs traffic flows through `supabase/functions/discogs-*` — never direct from the browser. Phase 3 honors this for both sync and rescan.
- Hooks own their own state; no global store. `useDiscogsSync` follows the per-route convention.
- The existing `non_working` UX (dim row + 3 s auto-skip) is the canonical "track exists but can't play" state — D-09 reuses it.
- Edge functions return `{ ...data }` directly; client invokes via `supabase.functions.invoke('name', { body })`.

### Integration Points
- `MobilePlayer.tsx` will import `useDiscogsSync` and trigger the on-mount sync exactly once when the session cookie carries a `username`.
- `useTrackCache.upsertTracks` is the existing 500 ms-debounced write path — sync uses it page-by-page; no new debounce logic needed.
- `SettingsDialog` `onClearData` reset flow (already updated in Phase 1) must additionally clear the session cookie + the per-username `discogs_track_cache` rows on disconnect.
- Background verifier (`useBackgroundVerifier`) already retries `non_working` tracks → no client-side changes needed for the rescan; the cron's writes flow through `discogs_track_cache` and the client sees them on next load.

</code_context>

<specifics>
## Specific Ideas

- User's exact words on robustness: "I want this to be smart and redundant. i.e. store the various available links" → D-15 (two YouTube IDs persisted, fallback at playback time).
- User's exact words on degraded tracks: "if a link isn't available or it goes down keep the track in the playlists but dim it and have it skipped when playing back" → D-09 / D-10 (reuse `non_working` UX; no new status).
- User's exact words on link decay: "end of every week maybe run a background scan to see if there are any new available youtube links" → D-11..D-14 (weekly cron, Sunday 04:00 UTC, rate-limited, surfaced in Settings).

</specifics>

<deferred>
## Deferred Ideas

- **CSV → OAuth migration.** When a CSV-only user later connects Discogs, do we re-key their existing `csv-{uuid}` rows to their Discogs `username`, or wipe them? Not blocking Phase 3 — OAuth users get a fresh sync, CSV-only users keep their existing rows. Revisit if user feedback demands continuity.
- **Per-track manual link override.** "This YouTube ID is wrong, here's the right one" UI. Belongs in a future v2 phase.
- **Marketplace price caching TTL tunable per release.** Already in PROJECT.md non-goals for v1; restated here for completeness.
- **BPM / key detection for DJ persona.** v2 backlog (PRD §8).

</deferred>

---

*Phase: 3-Discogs OAuth Diff-Sync*
*Context gathered: 2026-05-20*
