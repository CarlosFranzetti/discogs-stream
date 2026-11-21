# Playlist editors on iPhone: research notes for the discogs-stream playlist sheet

Scope: how iPhone music apps edit playlists, the conventions users already know, complaints, and three design options for a ~320px sheet.
Budget used: 8 searches, 6 page reads (4 read in full; 1 returned an unrelated page; 1 was too large to read).

Confidence key: **[read]** = confirmed on a page I read in full. **[excerpt]** = seen only in a search snippet, not read in full. **not confirmed** = I could not verify it.

---

## 1. Comparison table (iPhone, app x capability)

| Capability | Apple Music | Spotify | YouTube Music | Tidal | SoundCloud | djay (iOS) / DJ tools |
|---|---|---|---|---|---|---|
| Enter edit mode | Playlist > More (...) > **Edit** [read] | Playlist **Edit** at top, or ... menu > Edit [excerpt, Spotify community staff reply] | Library > playlist > More > **Edit playlist** for reorder/title; swipe for remove [read] | **not confirmed** for the current app. Reddit [excerpt]: choose "Free order" sort, then Edit, then drag | Playlist > ... (three dots) > **Edit playlist** [read] | Playlist sort control (two arrows) at top of list [read]. No manual edit mode confirmed |
| Reorder | Drag the **Reorder** handle next to a song [read] (icon shown, no label in text) | Edit, then drag [excerpt]. Handle position **not confirmed** | Edit playlist > reorder [read, but reorder UI not described in text] | Press and hold the three-line handle at right of track, then drag (Gadget Hacks, older app) [excerpt]. Current app **not confirmed** | Edit playlist > drag and drop [read] | Manual reorder **not confirmed**. Sort by BPM, Key, Title, etc., tap again to reverse, **Reset** returns default [read] |
| Remove | Tap the song, then tap **Delete** (icon) [read]. Note in Apple's text: "Deleting a song from a playlist doesn't delete it from your library." Swipe **not confirmed** | Track menu "Remove from this playlist" wording **not confirmed** on current app | Swipe **left** on song, tap **Remove** [read] | **not confirmed** | iOS: swipe left, tap **Remove** [read]; or in Edit playlist, tap the **red circle** on the left [read] | n/a (sets are built from the library) |
| Add tracks | Edit > Add (+) opens library picker with a per-row **+**; **Suggested Songs** list at bottom of playlist; or touch-and-hold any item > Add to a Playlist [read] | Search from the playlist: **not confirmed** | Bottom of playlist: **Add a song** [read]. Also Save to playlist from any track [read] | not confirmed | Add to playlist from Now Playing > More [read] | Browse library into playlist: not confirmed |
| Rename | Edit > tap the current name [read] | Edit [excerpt] | Edit playlist > title [read] | not confirmed | Edit playlist [read] | n/a |
| Description / privacy / artwork | Cover art: Apple templates or camera [read]. Show on profile toggle [read] | not confirmed | Description, privacy, AI thumbnail (Premium) [read] | not confirmed | Make public via ... menu [read] | n/a |
| Multi-select / bulk | **Not confirmed** in the help page | not confirmed | not confirmed | not confirmed | Web only: bulk remove via edit page [read] | not confirmed |
| Undo | **Not found** in any source read | not found | not found | not found | not found | not found |
| Sort inside a playlist | More > **Sort By** > option (options not listed in the page) [read]. Apple Music forum excerpt: a "Playlist Order" sort plays songs in the order added [excerpt] | Custom order for playlists in the library list [excerpt, about playlists, not tracks]. Track sort **not confirmed** | not confirmed | Free order is the custom order [excerpt] | not confirmed | Sort dropdown (two arrows) at top: BPM, Key, Title, Artist, Time (Android page excerpt) [read for BPM and Key on iOS] |
| DJ-specific | n/a | n/a | n/a | n/a | n/a | BPM and Key sort, harmonic-mixing tip [read]. Track # renumbering in rekordbox: Facebook group post [excerpt, low confidence]: tap the # column, select track, move to position |

Notes:
- Apple's Playlist Playground (US beta) lets users "add, reorder or remove tracks" after AI generation [read]. Not relevant to our editor but shows Apple treats reorder as a normal action.
- The Apple help page says collaborative playlist participants can "add, remove, or reorder" [read].

---

## 2. Patterns that recur (the conventions iPhone users already know)

1. **Edit is a named mode, entered from a menu or header button.** Apple (More > Edit), YouTube Music (More > Edit playlist), SoundCloud (... > Edit playlist), Spotify (Edit button). Users look for the word "Edit" first.
2. **Remove is a swipe-left on the row, with a red destructive action.** YouTube Music and SoundCloud iOS both document this [read]. Apple's Edit mode uses a tap-then-Delete path [read].
3. **Reorder is a drag handle, not a plain-row drag.** Apple shows an explicit Reorder control [read]. Spotify and Tidal use "edit then drag" [excerpt]. Drag is only offered inside the edit state.
4. **Add is inside the playlist as a bottom row or a search sheet.** YouTube Music: "Add a song" at the bottom [read]. Apple: Add button opens library, with a per-row +, plus suggested songs at the bottom [read].
5. **Rename is tapping the title in the edit state.** Apple [read].
6. **Destructive remove never deletes from the source.** Apple states this explicitly [read]. Important for a collection app: removing from a playlist must never remove from the Discogs collection.
7. **Sort is a separate control, not a reorder.** Apple: More > Sort By [read]. djay: sort dropdown at top, tap again to reverse, Reset to default [read]. Users expect a way back to the original order.
8. **Edit state is for list management, play state is for listening.** Tapping a row plays it in browse mode. In edit mode it selects or opens the row (Apple: "Tap the song, then tap Delete" [read]).

---

## 3. Pitfalls and complaints (searched; excerpts unless noted)

- **Losing custom order.** Apple Discussions thread "How do I change the order of songs within a playlist?": user says they "used to be able to order songs... any order I wanted" and can't find it [excerpt, date not seen].
- **No control after creation.** Apple Discussions "Editing Playlist Contents in Apple Music": "almost no control over playlist contents once we've made it, other than to reconstruct it with another name" [excerpt].
- **Missing bulk sort.** Reddit r/soundcloud: user says there used to be an option to sort every song in a playlist, now they cannot without a long manual drag [excerpt].
- **Edit blocked for months.** Reddit r/soundcloud: "haven't been able to edit playlist name or change the order of songs for months" [excerpt, date not verified].
- **Old Spotify wording.** A Facebook group says Spotify showed "Move / Remove" and did not allow reordering [excerpt, likely old; not confirmed for current app].
- **Spotify Android reorder bug.** Spotify community thread "Can't edit playlist order on Android - Premium" exists [title only; body not read].
- **Sync reorders your order.** Algoriddim community: "Playlists are automatically reorganized with Tidal after I put them in the order I want" [title and excerpt]. A sync that resorts a custom order is a real failure mode for us if we ever sync.
- **Requests for renumber-by-sort.** Algoriddim community: user asks for a "renumber track order" like rekordbox, to sort by BPM or key but keep the result as the real order [excerpt]. Shows DJs want sort-then-commit, not sort-as-view.
- **Hard-to-find controls.** SoundCloud's own help article has conflicting text for iOS remove (swipe left vs the red circle in Edit playlist), which suggests the UI changed and docs lag [read].

Pitfalls to design against (from the above plus common sense):
- Drag competes with scroll and with the sheet's swipe-to-dismiss. Start drag only from a handle or long-press.
- Swipe-left row actions compete with iOS edge-swipe back gestures near the screen edge.
- Single-tap remove with no undo is the most repeated complaint pattern.
- "Sort" that silently destroys custom order.
- Tiny (<32px) drag or remove targets on a 320px screen.
- Confusing "delete" wording. Apple's "Delete" inside a playlist means remove-from-playlist; say "Remove from playlist".

---

## 4. Three design options for our editor (320px sheet, iPhone Safari and home-screen PWA)

Layout assumptions: sheet width 320px, 16px side padding, so 288px content. Row heights respect 44px touch targets. Safe-area insets respected at top and bottom. Our data (per CLAUDE.md): track has artist, title, album, genre, label, year, cover, YouTube IDs, working_status. There is **no BPM or key** in the Track model, so any BPM or key column needs new data. Option C must say this.

### Option A: Explicit Edit mode (Apple Music style)

Recommended base. Matches what iPhone users already know.

**Browse state (default)**
- Header (52px): left chevron (close sheet / back to playlist list), centered playlist name, right **Edit** button.
- Sub-header (32px): "23 tracks · 1h 12m" left, **Sort** (two-arrow icon, 44px target) right.
- Track rows (56px): cover 40px, title (1 line) and artist (1 line, muted), tap to play. Current track shows an equalizer icon. Status dim as today: pending opacity-75, non_working opacity-50.
- Bottom of list: "Add songs" row (44px).

**Edit state (after tapping Edit)**
- Header: left "Cancel" (discards nothing because edits apply live, so use "Done" only), centered name becomes tappable to rename (inline text field), right **Done**.
- Rows change: left red **minus** circle (28px visual, 44px hit area). Right **drag handle** (three horizontal lines, 44px hit area). Tapping the row does nothing in edit state.
- Search field appears under the sub-header in edit state for filtering the list (display-only, indexes preserved).
- Sticky bottom bar (56px + safe area): "Add songs" (opens full-height search sheet with per-result "+") and "Sort" (menu: Playlist order, Title, Artist, Year, Label, Date added; a "Restore original order" item always shown).

**Gestures and controls**
- Tap **minus**: row slides out to reveal a red **Remove** button on the right; tap **Remove** to commit, or tap elsewhere to cancel. (Two-step avoids accidents; avoids a modal.)
- After commit: toast at bottom above the bar, "Removed "Title" · **Undo**" for about 5 seconds.
- Drag: long-press the handle (about 150ms) or press-and-drag directly on the handle. Row lifts with shadow, list auto-scrolls near top and bottom edges, haptic tick on pickup and drop. Scrolling anywhere else still scrolls.
- **Add songs**: opens the search sheet. Per result, "+" with check after adding. Duplicates show "Already in playlist" (no add).
- Sheet swipe-to-dismiss only from the header area, so drag and scroll in the list never dismiss the sheet.

**Trade-offs**
- Pro: no gesture ambiguity in browse state; matches Apple, YouTube Music, Spotify muscle memory; the two-step remove is safe.
- Pro: mode boundary means drag never fights scroll.
- Con: an extra tap to start editing; users who want quick reorder have to enter Edit.
- Con: drag at 288px content width needs the handle to be the drag source, and long handles are hard to hit; keep 44px.
- Con: undo is required, otherwise two-step remove is the only protection.

### Option B: Always editable, swipe actions and long-press drag

No mode. Every row is editable at all times, closer to a native list with inline actions.

**Layout**
- Header (52px): playlist name (tap to rename inline), right **...** menu (Rename, Sort, Duplicate playlist, Delete playlist).
- Search bar always visible (44px). When the query is non-empty, the list splits into two sections: **In this playlist** (filtered rows) and **Add from collection** (results with a per-row "+"). This is add-from-search inline, with no separate sheet.
- Track rows (56px), same content as Option A, no visible handle.

**Gestures**
- **Swipe left** on a row: reveals red **Remove** (full swipe commits). Swipe right: reveals **Play next** (blue) in case the user wants to queue a track they are reordering. Keep right-swipe optional.
- **Long-press** (about 300ms) on a row: lifts it for drag. Haptic on lift. Auto-scroll at edges. Drop shows a thin insertion line between rows.
- Tap: plays the track.
- After remove: same undo toast as Option A.

**Trade-offs**
- Pro: fastest path for a user who wants to reorder or delete one track. No mode to remember.
- Pro: one list handles both search-add and reorder.
- Con: long-press to drag and tap to play means a long-press that is slightly late plays the track. Mitigate with a 300ms threshold and cancel-on-move.
- Con: swipe actions are invisible; users discover them late. Add a one-time hint.
- Con: swipe-left competes with iOS back gesture near the left edge. Keep swipe actions off the first 16px of the screen (not a problem if the sheet has side padding, but test on iPhone Safari PWA where edge-swipe goes back).
- Con: no clear "done" moment; hard to tell whether you are editing.

### Option C: DJ crate (compact rows, numbering, set length, move-to-position)

Aimed at DJs who think in set order. Dense, numeric, precise.

**Layout**
- Header (52px): playlist name (tap to rename), right **...** (Duplicate, Rename, Restore original order, Delete).
- Set bar (36px, always visible, sticky): "23 tracks · 1:12:04 · 6 labels" live totals. Long-press to switch to a target-length readout (for example "target 60:00, 12 min left"). Target optional, not in v1.
- Compact rows (44px): index **01** (28px, monospace, tap to select), title (1 line, 15px), second line artist · label · year (11-12px, muted), runtime right (36px). No cover art, to fit density. Optional 28px thumbnail if the user toggles it on.
- Track rows are not tap-to-play by default. Tap title to play, tap index to select. This keeps the list precise for ordering. (Alternative: a toggle "Tap plays / Tap selects".)

**Controls**
- **Select**: tap index to select (checkmark appears over the index). Long-press a row to start multi-select. Selection count appears in the set bar.
- **Action bar** (appears when at least one row selected, replaces the set bar): "Move…", "Remove", "Add to…", "Clear".
- **Move to position**: tap "Move…" with rows selected, and a bottom sheet appears with a number field and a stepper, showing "Move to position [ 07 ] of 23", with "Move". For single moves, the row's **...** menu has "Move to position…". Typing a number is faster than a drag on 320px.
- **Renumber by sort**: Sort… opens a sheet listing Artist, Title, Year, Label, Runtime, Original order. Shows a preview ("Rows will be renumbered 01–23") and "Apply". Applied sorts are undoable from the toast. "Restore original order" always available.
- **Drag**: optional. Long-press the index to drag, not the row. Keeps drag off the title so scrolling stays safe.
- **Remove**: select rows, tap Remove, toast with Undo.

**Trade-offs**
- Pro: precise and numeric; fits DJ mental model ("track 7"); set length always visible.
- Pro: move-to-position solves the "moving 15 rows" problem better than drag on a narrow screen.
- Con: small text (11-12px) hurts legibility outdoors and in dim booths; need 15px titles minimum.
- Con: BPM and key are not in our data. A "BPM / Key" column is out of reach without new data sources; do not promise it.
- Con: much more UI to build and explain; higher risk of confusing a casual collector.
- Con: the index-tap-to-select pattern is unconventional on iPhone and needs a first-run hint.

---

## 5. Recommendation

**Recommend Option A**, with two borrowings from C: the always-visible runtime total in the sub-header, and a "Move to position…" item in each row's menu for long moves (keep it out of the primary drag path).

Why:
- It is what iPhone users already know from Apple Music, YouTube Music and Spotify. Least teaching.
- The explicit Edit state avoids the scroll-vs-drag and swipe-vs-dismiss collisions that the narrow 320px sheet makes worse.
- It keeps the two-step remove and undo toast, which addresses the most repeated complaint pattern (no undo).
- It maps onto what exists today (the "x" to remove appears in Edit state; the "+" becomes "Add songs").
- Option B is a good phase-two addition for power users (swipe actions) once Option A exists. Option C is a separate "DJ view" toggle, and only worth building after deciding whether to store BPM or key.

Build order suggestion:
1. Edit mode with drag handle, minus-to-remove, and undo toast.
2. Rename in edit state; Sort menu with "Restore original order".
3. Runtime total in sub-header.
4. Add songs sheet with per-result "+" and "Already in playlist".
5. Optional: Move to position from row menu.

---

## 6. Source URLs

Read in full [read]:
- https://support.apple.com/guide/iphone/create-edit-and-delete-playlists-iph21addc265/ios (Apple Music on iPhone: create, edit, sort, delete)
- https://support.google.com/youtubemusic/answer/7205933?hl=en&co=GENIE.Platform%3DiOS (YouTube Music on iPhone: make or edit a playlist)
- https://help.soundcloud.com/hc/en-us/articles/115003449787-Adding-Removing-and-Rearranging-Tracks-in-a-Playlist-or-Album (SoundCloud help, iOS remove and rearrange)
- https://help.algoriddim.com/user-manual/djay-ios/music-library/advanced/sorting (djay iOS sorting)

Attempted, not usable:
- https://community.spotify.com/forum/en/discussion/6517360/how-do-i-rearrange-my-songs-in-my-playlist (scrape failed: content too large; only search excerpt used)
- https://discussions.apple.com/thread/254431410 (scrape returned the Apple Support homepage, not the thread; only search excerpt used)

Search excerpts only [excerpt]:
- https://discussions.apple.com/thread/254431410 (order complaint)
- https://discussions.apple.com/thread/255501679 (reconstruct-to-reorder complaint)
- https://discussions.apple.com/thread/256052152 (sort by date added on iOS 18.4.1)
- https://support.apple.com/guide/music-web/sort-songs-apdmbb7c96e5/web (Apple Music web sort)
- https://apple.stackexchange.com/questions/36287/can-i-sort-the-songs-in-a-playlist-on-my-iphone
- https://www.reddit.com/r/AppleMusic/comments/1dbgkty/how_to_have_a_playlist_which_is_sorted_by_date/ (Playlist order sort)
- https://www.youtube.com/watch?v=OY6MS-web28 (video title and description only)
- https://community.spotify.com/forum/en/discussion/7058691/cant-edit-playlist-order-on-android-premium (title only)
- https://www.reddit.com/r/spotify/comments/wjbncy/how_do_you_rearrange_the_custom_order_of_the/ (older Spotify reorder thread)
- https://www.facebook.com/groups/34510656142/posts/10162373677031143/ (old Spotify Move/Remove complaint)
- https://www.reddit.com/r/TIdaL/comments/1kdf4lk/arranging_tracks_in_certain_order_on_playlist/ (Tidal Free order)
- https://smartphones.gadgethacks.com/how-to/tidal-101-create-edit-playlists-0180381/ (Tidal handle, older app)
- https://community.algoriddim.com/t/playlists-are-automatically-reorganized-with-tidal-after-i-put-them-in-the-order-i-want/22371
- https://community.algoriddim.com/t/renumber-track-order/27435 (renumber request)
- https://www.facebook.com/groups/crisangelmusic/posts/820709768642178/ (rekordbox # column, low confidence)
- https://www.reddit.com/r/soundcloud/comments/1mgexbr/is_there_any_way_to_rearrange_songs_on_my/ (bulk sort complaint)
- https://www.reddit.com/r/soundcloud/comments/1xi2bio/havent_been_able_to_edit_playlist_name_or_change/ (edit blocked complaint)
- https://help.soundcloud.com/hc/en-us/articles/46020168734235-Your-Playlists-FAQs (drag and drop via edit options)
- https://help.soundcloud.com/hc/en-us/articles/1260801673729-Rearrange-tracks
- https://support.spotify.com/us/article/sort-and-filter/ (library playlist custom order, not track order)
- https://help.algoriddim.com/user-manual/djay-android/music-library/advanced/sorting (Android sort options excerpt)
- https://support.google.com/youtube/answer/6083634?hl=en&co=GENIE.Platform%3DiOS (YouTube app edit playlists, search excerpt)

Not confirmed (did not find a source): Spotify current mobile drag handle and remove wording; Tidal current iOS remove; multi-select in any iPhone app's playlist editor; undo in any iPhone playlist editor; Apple Music "Sort By" option list.
