# FUTURE — Discogs Stream

Everything forward-looking. Current state is in `memorystate.md`; finished work is in `docs/HISTORY.md`. Move an item to HISTORY (as part of a dated entry) when it ships.

## Now

Mobile UX audit backlog. A read-only audit found these; none is fixed yet.

### HIGH
- [ ] H1 Settings dialog cannot scroll and can become unclosable on small phones: needs a max-height and inner scroll. `src/components/SettingsDialog.tsx`, `src/components/ui/dialog.tsx`
- [ ] H2 Player uses `h-screen` (100vh) and `main` is `overflow-hidden`, so on iPhone SE and in landscape the bottom controls are clipped. Use `h-dvh` with a vh fallback and let `main` scroll. `src/components/MobilePlayer.tsx`

### MEDIUM
- [x] M1 (fixed 2026-11-21) Title screen is `h-screen overflow-hidden` with no scroll child; rows fall below the fold on small phones. `src/components/MobileTitleScreen.tsx`
- [ ] M2 No `overscroll-behavior` on html/body: page bounce and pull-to-refresh can reload the page and kill playback. `src/index.css`
- [ ] M3 Tap targets well under 40px: transport row (20-28px), header menu button (28px, no aria-label), dialog close (16px), settings pills and buttons, title-screen clear-CSV X (12px). `MobileTransportControls.tsx`, `MobilePlayer.tsx`, `ui/dialog.tsx`, `SettingsDialog.tsx`, `MobileTitleScreen.tsx`
- [ ] M4 Rewind/fast-forward broken on touch: double-fires (touchstart plus mousedown), hold does not scan (stale closure), and it is dead in direct-audio mode (goes through the iframe-only seek). `MobileTransportControls.tsx`, `MobilePlayer.tsx`
- [ ] M5 Timeline touch seeking lacks `touch-action: none` and a `touchcancel` handler (listener can stick). `src/components/MobileTimeline.tsx`
- [ ] M6 "Start Listening" unmounts and rebuilds the preloaded YouTube player (different root element types in the two branches). `src/components/MobilePlayer.tsx`
- [ ] M7 `/manifest.json` is the Chrome-extension manifest, not a web app manifest, so Android cannot install the PWA standalone. Needs a separate `site.webmanifest` plus 192 and 512 icons. `public/manifest.json`, `index.html`
- [ ] M8 The saved theme is only applied once the Settings dialog mounts, so the title screen always shows the default theme. `src/hooks/useTheme.ts`, `SettingsDialog.tsx`

### LOW
- [ ] Pitch row mount/unmount shifts the transport by about 20px. `MobilePlayer.tsx`
- [ ] Sticky hover states on touch (`hoverOnlyWhenSupported`). `tailwind.config.ts`, `src/index.css`
- [ ] `/library` page has no safe-area padding and is linked from nowhere. `src/pages/Library.tsx`
- [ ] Remaining `100vh` uses in Auth, NotFound, ErrorBoundary and Library. `src/pages/`, `src/components/ErrorBoundary.tsx`
- [ ] Three product names: "Discogs Radio" (title and apple meta), "Discogs Stream" (UI), "Discogs Vinyl Stream" (manifest). `index.html`, `public/manifest.json`
- [ ] apple-touch-icon is a 96px favicon. `index.html`, `public/icons/`
- [ ] theme-color `#000` versus background `#111318`. `index.html`
- [ ] Toasts have no safe-area offset. `src/components/ui/sonner.tsx`, `src/components/ui/toaster.tsx`

## Next — decisions waiting on Carlos

Title screen: done 2026-11-21 — the main block Carlos approved (connect card, Start Listening, demo crate) is unchanged; sign-in and the install hint moved to a quiet footer, and the screen now scrolls on short phones (audit item M1).

**Proposed order of work**
1. Ship what is finished: merge `claude/check-out-jkrunj`, then check in production whether direct audio engages (Decks depends on the answer).
2. The HIGH and MEDIUM items under "Now".
3. Playlist panel second pass: the chosen filter design and editor design, with rename, reorder, undo and play-in-order.
4. Decks v1.
5. Decks v2.
6. Sync and install: playlists in Supabase (C1), a real web app manifest (M7), and B5.

### Playlist filter redesign
The filters are too busy on iPhone; the Label row is far too long. Research input: show the top 4-6 values per facet, hide the rest behind "show more" or a search-within-filter, and show applied filters as removable chips. Current implementation: `src/components/MobilePlaylistSheet.tsx` (top 12 values per facet, genre / label / decade / country).

Three options were mocked up for Carlos (2026-11-21); full research in [docs/research/filters.md](docs/research/filters.md). **Awaiting his pick.**

- **A — one rail, one picker (recommended).** A single horizontally scrolling row of facet chips (Sort, Genre, Label, Decade, Country). Tapping a facet replaces the panel body with that facet's picker: a search field, values with counts ordered by count with selected values pinned, values that would return zero tracks under the other filters hidden, and an apply button that states the result count. Applied filters show as removable chips under the rail. The panel never grows by more than one row.
- **B — accordion.** Four collapsed rows showing each facet and its current value; one opens at a time, capped at six values plus search for Label. Live results, but the open facet pushes the track list off an iPhone screen.
- **C — one Filters screen.** A single button opens a full-height screen with every facet in sections and a sticky apply button. Cleanest queue, but Label is three taps deep and the tracks are hidden while choosing.

Rules that apply whichever is chosen: never wrap chips past two rows (Material guidance — scroll instead); do not stack a second sheet on the slide-in panel (NN/g) — replace the panel body; keep applied filters visible and individually removable (Baymard).

### Playlist editor redesign
The editor needs improving on iOS. Research input (Spotify and Apple Music patterns): explicit edit mode; remove control on one side and drag handle on the other; a non-drag alternative (move up/down); the wording "Remove from playlist"; undo after removal; keep playback stable while editing; model entries with stable ids and positions. Current implementation: per-row `+` picker and `×` remove in `MobilePlaylistSheet.tsx`, storage in `src/hooks/useUserPlaylists.ts`.

Three options were mocked up for Carlos (2026-11-21); full research in [docs/research/playlist-editors.md](docs/research/playlist-editors.md). **Awaiting his pick.**

- **A — explicit Edit mode (recommended).** Listen by default. `Edit` turns the name into a field and shows a red remove control on the left of each row and a drag handle on the right, plus "Add tracks from library". `Done` leaves. Removal shows a "Removed from playlist · Undo" toast. Matches Apple Music / YouTube Music / SoundCloud conventions; adds the undo none of them offers.
- **B — always editable.** No mode: swipe left to remove, long-press to drag, an add-from-library field at the top. Fastest for heavy editing, but swipe and long-press are fragile in a web app (they compete with scrolling and with the edge swipe that closes the panel) and nothing advertises them.
- **C — DJ crate.** Dense numbered rows with label and year, a running set-length total per row, a sort switch (Custom / A–Z / Year) and "Move to position…". No covers. BPM and key columns would need data the Track model does not have.

Recommendation: A, borrowing C's running set length and "Move to position…".

Needed under any option (none exist yet): `renamePlaylist` is in the hook but has no UI; reorder (`moveTrack`); undo; and **play in the playlist's own order** — today `usePlayer` either shuffles or applies `sortSequential` (artist → album → year), so a hand-ordered playlist is never played in its order. Fix: a `preserveOrder` option on `usePlayer` used while a user playlist is active.

### Verify direct audio in production
The reworked `invidious-audio` (races the vetted Invidious list then Piped within about 8s, prefers m4a) and `yt-dlp-audio` (501 `yt_dlp_unavailable` on Supabase) are in `c980540`; the client probe timeout is 9s. Not verified in production because the dev sandbox has no egress. After merge and the CI deploy: play a few tracks, confirm the `<audio>` engine takes over from the iframe, and confirm the pitch fader becomes active. If it never engages, the instance lists are the first suspect (they have rotted twice, see HISTORY 2026-07-18 and 2026-07-20).

## Decks mode (desktop)

Spec stub. Requested by Carlos on 2026-11-21; planned, not built.

- Desktop-only mode with two turntables and a mixer.
- Per-deck pitch.
- Touch, nudge and scratch on the platter.
- A vinyl-mode interface, driven by the trackpad.

Constraint: the YouTube IFrame API's `setPlaybackRate` rounds an unsupported rate "to the nearest supported value in the direction of 1", so a +/-8% vinyl pitch is impossible on the iframe engine. Consequence: real pitch, nudge and scratch need the direct `<audio>` engine (`playbackRate` with `preservesPitch=false`), which today depends on `invidious-audio` resolving a stream (see "Verify direct audio in production"). A track with no direct stream cannot be pitched on a deck. Whether two simultaneous `<audio>` elements work on the target browsers is unverified.

Architecture, from [docs/research/decks.md](docs/research/decks.md):

**What each engine can do**

| Control | YouTube iframe | Direct `<audio>` |
|---|---|---|
| Play, cue point, seek | yes | yes |
| Channel faders, crossfader | yes — `setVolume` 0–100 only | yes — `volume` with proper curves |
| Pitch fader ±8% / ±16% | no — rate rounds toward 1 | yes — `playbackRate`, `preservesPitch=false` |
| Nudge (platter edge) | rough, by small seeks | yes — brief rate bend, then back to the fader value |
| Spinning platter + position marker | yes | yes |
| Scratch (platter top) | no | only with decoded audio |
| 3-band EQ / filter | no — iframe audio cannot enter Web Audio | only if the stream sends CORS headers (otherwise `createMediaElementSource` outputs silence) — untested |
| Headphone pre-listen | no | no (a browser has one output) |

**Decisions**
- Route `/decks`, desktop only (offered at ≥1024px with a fine pointer); it reads the library from the cloud cache and falls back to the demo crate.
- One `Deck` abstraction over both engines (`play / pause / seek / getTime / getDuration / setRate / getRate / setVolume`). Loading a track cues the iframe at once and probes for a direct stream in parallel; if the stream arrives before the deck is started, the deck uses `<audio>`. No mid-track engine swap on a deck.
- The pitch readout shows the rate the engine reports, not the fader position, and a deck on the iframe engine shows its pitch fader as locked with the reason.
- Crossfader: constant-power by default (`gainA = cos(π/2·x)`, `gainB = cos(π/2·(1−x))`), with a sharp-cut option.
- Platter: 33⅓ rpm, so one revolution is 1.8 s of audio and the marker angle is `time × 200°/s × rate`.
- Trackpad: two-finger scroll over the platter **rim** (outer ~20% of the radius) = nudge; click-drag on the platter **top** = hold and scrub, mapping rotation to time (v1 seeks on release; true scratch is v2). Pinch arrives as `wheel` with `ctrlKey` and is ignored. Pitch fader: drag, double-click to reset.
- **v1 (both engines where possible):** two decks, mixer, platters, cue, load-from-library, pitch + nudge on `<audio>` decks.
- **v2 (only if streams can be fetched with CORS):** decode to an `AudioBuffer` (about 85 MB per four-minute stereo deck) for real scratch, EQ, and BPM detection for beat-matching.
- **Blocked on:** proving direct audio in production (see above). If it does not engage, Decks ships as a volume-only mixer and the pitch work waits.

Unverified: YouTube's terms on two overlapping embedded players; reverse playback (`playbackRate < 0`) outside Safari; how other browser DJ tools handle pitch on YouTube sources.

## Roadmap

Status as of 2026-11-21. "Done" items cite the commit or date; details are in `docs/HISTORY.md`.

**Phase A — Audio engine: done (`4eed9e2`, 2026-07-17)**
- [x] A1 Direct audio (yt-dlp/Invidious to HTML5 `<audio>`) in MobilePlayer, iframe kept as the engine that plays first. Reworked in `c980540`, production behaviour unverified.
- [x] A2 Media Session API (lock-screen artwork and transport), `useMediaSession`
- [x] A3 Candidate failover (cached `youtube2` tried before re-searching on error 150/101)
- [x] A4 Set-length totals in the playlist sheet header
- [x] A5 +/-8% pitch fader (`usePitch`, `preservesPitch=false`); active only on the direct engine

**Phase B — Collector surfaces**
- [x] B1 Wantlist price badges (`useWantlistPrices`, `4eed9e2`)
- [x] B2 Crate-digging filters (genre / label / decade / country; no style facet because styles fold into `genre` at ingest). Done 2026-07-17, merged in PR #20 (`71463b9`). Redesign pending, see "Next".
- [ ] B3 Cue preview mode (long-press a row for a low-volume preview stream; needs the direct engine)
- [ ] B4 Wire the `'similar'` source end to end (extension similar-releases to playable tracks)
- [ ] B5 Wantlist thumbs-down release-check flow. Specified 2026-07-20, deliberately not built (per Carlos). Thumbs-down on a wantlist track prompts "This will remove this track — check all tracks from this release?". On yes, queue that release's remaining tracks sequentially; if every track of the release ends up thumbs-down, remove the release from the wantlist (Discogs API delete for OAuth users, local removal for CSV). Needs release-level grouping of preferences, a confirm dialog, a sequential release playback mode, and a wantlist-remove call in `discogs-api`.
- [x] B6 (new) User playlists: `useUserPlaylists`, localStorage, ids not copies, Queue / Playlists tabs (`0e24a87`). Editor redesign pending, see "Next".
- [x] B7 (new) Demo crate: 25 electro and techno records, `?demo` deep link, session-only (`c980540`)

**Phase C — Unification and structure**
- [ ] C1 Extension and PWA state bridge (crates, playlists, carts). Partly addressed: PWA user playlists exist, are localStorage-only, and use a model shaped like a future `user_playlists` table (id / name / track_ids / timestamps), so the Supabase move is a transport change. Extension crates, playlists and carts still live in a private IndexedDB (`src/lib/db.ts`); a JSON export/import is the first step.
- [ ] C2 One shared virtualized playlist component. The PWA sheet is virtualized (D2); the extension `src/components/panel/NowPlayingView.tsx` does not use `@tanstack/react-virtual`.
- [ ] C3 Shared THEMES and SourceType constants. The SourceType half is partly done (MobilePlaylistSheet imports from SourceFilters); consolidation into `types/track.ts` is open.
- [ ] C4 Bandcamp: restore behind a Settings flag or strip the plumbing (`bandcampEmbedSrc`, provider fields). `vercel.json` still mentions Bandcamp in its CSP.

**Phase D — Performance and delivery**
- [x] D1 Code-splitting: lazy `/auth` and `/library`, manualChunks. Done 2026-07-17 (`279af58`); main chunk 712 kB to 312 kB.
- [x] D2 Virtualization for large collections: `@tanstack/react-virtual`, 1800 tracks mount 22 rows. Done 2026-11-11 (`0e24a87`).
- [ ] D3 PWA offline shell (service worker and cover cache). No service worker found in `src/`, `public/` or `index.html`. Related: M7 above.
- [x] D4 CI gate (npm ci, test, lint, typecheck, build): `.github/workflows/ci.yml` (`4eed9e2`)

**Phase E — Hardening and quality**
- [ ] E1 Scheduler tests (fake-timer specs for `useBackgroundVerifier`, `usePlayer` invariants). Only two test files exist: `useYouTubeSearch.test.ts`, `csvParser.test.ts`.
- [ ] E2 Cover-art write path through an edge function, then lock `release_cover_art` RLS (it is still world-writable by anon)
- [ ] E3 Dedicated `SESSION_SECRET` env (remove the service-role fallback)
- [ ] E4 Tighten the CSP once C4 is decided

## Ideas parking lot

Not committed to a phase. Items already in the roadmap are not repeated.

Enormous collections (look-in of 2026-07-18; the caps were removed, these are the next bottlenecks):
- **localStorage ceiling** (about 5 MB): a 10k-track collection's JSON may exceed it and writes would throw silently. Move the offline cache to IndexedDB (the extension's `src/lib/db.ts` is a ready pattern) with a localStorage fallback for small sets. Unverified at 10k tracks.
- **Progressive hydration**: `track-cache` `get` returns everything, but the client waits for the full payload before first render. Stream page by page (first 1000 gives an instant player, the rest in the background).
- **Server-side pre-resolution**: for huge sets the client verifier (about 1 track per second) takes hours. Raise the weekly rescan's per-pass row budget or add an on-demand "resolve my pending tracks" server pass.
- **Dirty-row upserts**: the 500ms-debounced upsert rewrites all rows each burst (20 chunked requests per save at 10k tracks). Track dirty ids and upsert only changed rows.

Other:
- Cue preview via a second concurrent stream (see B3), the record-store listening booth behaviour.
- Marketplace data in the Now Playing panel (lowest / median / highest price) and actions (add to wantlist or collection, open on Discogs); listed in the old PRD as P1, only the wantlist price badge is built. Unverified how much of this exists in the extension panel.
- Open questions carried from the old PRD: whether wantlist items auto-import to the collection after a purchase action, how long marketplace prices should be cached (the `discogs-public` path proxy caches 24h), and whether BPM/key detection is in scope for DJs.
