# Phase 3: Discogs OAuth Diff-Sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 3-Discogs OAuth Diff-Sync
**Areas discussed:** Auth gating before OAuth, Identity model, Weekly re-scan

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Auth gating before OAuth | `user_tokens` references `auth.users` — must users sign up for Supabase Auth first, or relax the schema? | ✓ |
| CSV ↔ OAuth reconciliation | When OAuth users have prior CSV data, migrate / keep separate / wipe? | |
| First-sync UX | Block title screen with progress, sync silently, or stream into playlist? | |
| Soft-deleted release behavior | Dim, hide, or new dedicated status? | |

**User's choice:** "Auth gating before OAuth" — but with a freeform clarification that reframed the whole phase: "im confused i want the user to login to his or her discogs account in order to populate the collection and wantlist in the app. i also want the lists to be stored in the database such that when the user logs in again the coverart and youtube links are already available in the database and it wont have to scan. i want this to be smart and redundant. i.e. store the various available links and end of every week maybe run a background scan to see if there are any new available youtube links. if a link isnt available or it goes down keep the track in the playlists but dim it and have it skipped when playing back."

**Notes:** This message resolved 3 of the 4 gray areas implicitly:
- Auth gating → "Discogs login IS the auth" (no Supabase email signup)
- Soft-deleted behavior → "keep in playlist, dim, auto-skip" (reuse `non_working` UX)
- First-sync UX → on re-login the cached data hydrates first → not blocking (D-07 / D-08)
And it introduced a new requirement: a weekly server-side YouTube link-health re-scan.

---

## Identity model

| Option | Description | Selected |
|--------|-------------|----------|
| Discogs username as primary key | Drop `auth.users` FK. `user_tokens.username TEXT PRIMARY KEY`. RLS keyed on username from a custom JWT cookie minted by the OAuth callback. | ✓ |
| Auto-provision anon Supabase Auth user | Edge function creates anonymous auth.users row on OAuth success and links the token to that uid. | |

**User's choice:** Discogs username as primary key.
**Notes:** Drove decisions D-01 through D-04. Documented as an explicit deviation from `TDD.md §2.2`.

---

## Weekly re-scan scope

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to its own phase | Phase 3 stays focused on Discogs collection sync; weekly link-health re-scan is captured as a deferred idea. | |
| Fold into Phase 3 | Add a Supabase scheduled function that walks the cache weekly and refreshes YouTube candidates. | ✓ |

**User's choice:** Fold into Phase 3.
**Notes:** Drove decisions D-11 through D-14. Adds a new `youtube-rescan-weekly` Supabase scheduled edge function and a `rescan_log` table, and surfaces "Last rescan" in Settings alongside "Last sync." Expands phase scope; planner should account for this.

---

## Claude's Discretion

- OAuth callback route URL (reuse `/auth` vs new `/auth/discogs-callback`).
- Toast vs inline error placement in Settings.
- Whether the cron deploys enabled or shipped disabled-by-default for the first week.

## Deferred Ideas

- **CSV → OAuth row migration.** Not blocking Phase 3 — revisit if users complain about discontinuity.
- **Per-track manual YouTube link override UI.** v2.
- **Marketplace price TTL per release.** v2 (already in PROJECT.md non-goals).
- **BPM / key detection.** v2 backlog (PRD §8).
