# Product Requirements — Discogs Stream

**Version:** 3.0
**Date:** 2026-11-21
**Owner:** Carlos Franzetti

Describes the product as it is built. Planned work is in `FUTURE.md`; engineering state is in `memorystate.md`.

---

## 1. Problem

Discogs is the definitive catalogue for vinyl collectors, but it offers no playback. To hear a record they own or want, users leave the site, search YouTube by hand, and lose their place. Collectors and DJs want to hear their collection in the same flow where they browse it.

## 2. Product

A streaming layer over a Discogs collection. Import a CSV or connect an account and every record in the collection or wantlist becomes playable, with artwork, wantlist price badges and release metadata. Visitors with no collection can try a built-in demo crate first.

## 3. Users

| Persona | Need |
|---|---|
| **Vinyl DJ** | Preview upcoming purchases, build set ideas from owned records, think in runtime |
| **Collector** | Browse and play any release in the archive |
| **Wantlist digger** | Hear wantlist items before buying |
| **Casual listener** | Shuffle a collection like a personal radio |

## 4. What it does today

### 4.1 Getting a collection in
- **CSV import** of a Discogs collection or wantlist export. No login. Releases are expanded to per-track entries through the `discogs-public` edge function. Resolved tracks are written immediately to the `discogs_track_cache` table and mirrored in localStorage.
- **Optional Discogs OAuth** from Settings only (never the title screen). Diff-sync: remote Discogs is the source of truth, releases removed on Discogs are soft-deleted (`working_status = 'non_working'`), likes and dislikes are never touched by sync. Tokens live server-side in `user_tokens`. Auto-sync runs only when the local cache is empty; otherwise "Re-sync now".
- **Demo crate**: 25 electro and techno records, offered on the title screen while the library is empty and reachable through `?demo`. Session-only: never saved to the cloud cache or localStorage, and replaced by any real import.
- Return visits load from the cloud cache first (resolved links and covers), then localStorage, then any sync, so playback can begin before network work finishes.

### 4.2 Playback
- **YouTube IFrame player** (youtube-nocookie) plays immediately. When a direct audio stream resolves for the track, an HTML5 `<audio>` engine takes over at the elapsed position; if the stream fails mid-track the iframe resumes at the elapsed position. Direct audio is not verified in production (`memorystate.md`).
- **Link resolution**, in order: saved mapping in the database, YouTube ids in the Discogs release `videos` field, then the `youtube-search` chain: yt-dlp (no-op on Supabase), YouTube results-page scrape, Invidious, Piped, official YouTube API last (the only tier that uses quota). Matching is duration-aware: results far shorter than the expected track length are dropped and closeness to the expected duration adds to the score.
- **Background verification** resolves tracks without blocking playback (current track, then the next three, then all pending, then `non_working` for retry). A track with no link is skipped after 3 seconds and retried later.
- **Weekly rescan** (`youtube-rescan-weekly`, Sunday 04:00 UTC) re-runs the chain over cached rows and flips `working_status`.
- Shuffle is on by default with a random start; off gives artist, album, year, track order. Skips always autoplay. Like and dislike per track. Lock-screen controls through the Media Session API. Keyboard shortcuts on desktop. A +/-8% pitch fader appears when the direct engine is live.

### 4.3 Browsing
- **Virtualized queue**: only visible rows are mounted (1800 tracks mount about 22 rows).
- **Search** across title, artist, album, label and year; all terms must match; debounced.
- **Crate-digging filters**: genre, label, decade and country chips (OR within a facet, AND across facets), with "X of Y tracks" and filtered runtime.
- **Set-length totals** wherever track counts show.
- **User playlists**: named, ordered lists of track ids (not copies), stored in localStorage; create, delete, play, add and remove tracks, "Save these N as…" from a search or filter result. Playing a playlist narrows the queue to it.
- **Wantlist price badges**: lowest marketplace price on wantlist rows in the open sheet.
- Dimmed tracks: pending tracks at reduced opacity, `non_working` tracks dimmer; one tap queues a silent retry, a second plays if resolved.

### 4.4 Surfaces
- Mobile-first single-page player at `/`, usable on desktop. Themes: Dark, Midnight, Neon Orange, Cyberpunk.
- `/auth` for Discogs OAuth, `/library` as a secondary page, `/links` as a link-in-bio landing page (static `public/links.html`).
- PWA shell (home-screen metadata). Installing the PWA standalone on Android does not work yet (`FUTURE.md`, M7).
- **Chrome extension side panel** (built with `npm run build:extension`) that shares hooks with the app: crates, carts, playlists, pitch, marketplace data, similar releases.

## 5. Goals and non-goals

### Goals
- Time to first play under 5 seconds on return visits.
- No re-import friction: the collection is always current.
- Metadata works offline; playback degrades gracefully.
- Works well on a phone and on desktop Safari and Chrome.
- Resolve links without depending on YouTube API quota.

### Non-goals
- No ripping or downloading audio.
- No social features.
- No listing or selling actions on Discogs from inside the app.
- No desktop Electron wrapper.
- No account system beyond the Discogs username; no Supabase Auth user is created for OAuth.
- No Bandcamp playback (edge functions and a data field remain; no UI).

## 6. Planned

See `FUTURE.md`: the mobile UX backlog, playlist filter and editor redesigns, direct-audio verification, desktop Decks mode (two turntables and a mixer), and the phased roadmap.

## 7. Success metrics

| Metric | Target |
|---|---|
| Time to first play (return visit) | < 5 s |
| Sessions with 3 or more tracks played | > 60 % |
| Users who must re-import | < 5 % |
| Track resolution success rate | > 85 % |
| Discogs link click-through per session | > 15 % |

These are targets; no measurement is recorded in the repo.

## 8. Constraints

- Discogs API: 60 requests per minute (unauthenticated, and per OAuth token). Track expansion is paced to stay under it.
- YouTube API quota: 10,000 units a day, a search costs 100. The quota-free tiers run regardless.
- Supabase free tier: 500 MB database, 2 GB bandwidth (as stated in the earlier PRD; unverified against the current plan).
- No server-side rendering: a Vite SPA on Vercel.

## 9. Open questions

1. Should wantlist items auto-import to the collection after a purchase action?
2. How long should marketplace prices be cached? (The `discogs-public` proxy caches for 24 hours today.)
3. Is BPM or key detection in scope for the DJ persona?
