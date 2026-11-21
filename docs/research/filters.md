# Mobile filtering with short and long facets: research for the playlist sheet

Scope: the playlist sheet (about 320px wide) has search, sort chips (Artist, Title, Genre), and a Filter chip that expands four facet rows at once (Genre 2-15 values, Label hundreds of values, Decade 3-7, Country 5-30). OR within a facet, AND across facets. Library about 1,800 tracks.

Budget used: 7 searches, 5 page reads. Everything marked "not confirmed" was not verified in a source I read.

---

## 0. What the sources actually say (short version)

- NN/g: on mobile, batch filtering with an explicit Apply button is the recommended default. Bottom sheets are for short interactions, should have a visible Close button, should not be stacked, and should not hold lengthy content.
- Baymard (applied filters, updated May 2026): 28% of benchmark sites show no applied-filters overview. On mobile, show applied filters as a horizontally scrolling chip list with a truncation or fade cue, or as stacked rows. A bare "Filter (3)" count is not enough.
- Baymard (filter UI, Apr 2026): on mobile use a full-screen or bottom-sheet drawer, keep the trigger sticky, use a "Show X results" button whose count updates live, use 44x44pt targets, and show result counts next to each option. Collapse less important groups. Search within a long facet is recommended (Lowe's cited as an example).
- Material 3 (chips): 8dp minimum between chips, 48dp minimum target, labels 20 characters or fewer. Chips may wrap to a new line, but "if there are more than two rows, consider using horizontal scrolling." A chip can open a menu of options. Do not mix single-select and multi-select in one set.
- Discogs' own marketplace filters are nested: Year is "browse by decade, then expand to select a specific year"; Genre & Style has styles nested under genres and both are searchable. Country is filtered as "Ships From". Discogs' own apps therefore use progressive disclosure, not a wall of rows.

Our current design breaks two of these rules directly: the Label row wraps to 5-6 lines (Material's "more than two rows" rule), and four facets are expanded at once (Baymard's advice to collapse less needed groups).

---

## 1. Patterns found

Each pattern lists what it is, which apps or sources use it, when it works, and when it fails. "Used by" comes only from sources I read or saw as excerpts.

### P1. Horizontal filter-chip rail, one chip per facet
- What: a single non-wrapping row of facet chips (for example "Genre 2 v", "Label 1 v", "Decade v", "Country v"). Each chip opens that facet's picker. The rail scrolls sideways.
- Used by: Material 3 explicitly allows horizontally scrolling chip sets ("Filter chips can scroll horizontally to show many options"). Baymard describes horizontal filter bars as common on desktop apparel sites (read; mobile use not stated for this pattern). Specific apps for this pattern: not confirmed beyond these.
- Works when: there are few facets and each facet is large enough to deserve its own picker. Keeps the default footprint to one row.
- Fails when: hidden facets are not discoverable (the right edge has to be faded or truncated to signal more), or when a chip is so long that one-tap changes feel like two-step navigation.

### P2. Applied-filters summary row (removable chips)
- What: a row above the list that shows active selections as removable chips with an x, plus "Clear all".
- Used by: Baymard finds it on 72% of desktop benchmark sites. Baymard's mobile examples: Wayfair (horizontal scrolling list, last chip truncated), Amazon app (count "4" plus truncated third chip), Northern Tool (Clear All plus x in the filter menu), and REI (desktop). Baymard's guideline: avoid showing only a number of applied filters.
- Works when: the user needs to see what narrows the list while scrolling, and to remove one filter in a single tap. Baymard: users who could not see the applied filters misread the catalog's scope.
- Fails when: it adds a row that pushes the list down (Baymard notes stacked rows do this), or when it shows only "3 filters" with no names.

### P3. Single "Filter" button that opens one full filter view with sections
- What: one trigger button. Inside, a list of facets, each row showing its current selection summary ("Label: Blue Note +2"). Tapping a row opens that facet. An Apply button sits at the bottom and shows the result count.
- Used by: Baymard recommends a full-screen or bottom-sheet drawer with a sticky "Show X results" button. Macy's app is cited by Baymard for a clear Apply button that shows the expected result count. Lowe's mobile filters are cited for a single filter area with search inside a long facet.
- Works when: there are many facets, or the user is comparing combinations. One place to see everything.
- Fails when: the layers get deep. NN/g warns against stacking sheets and against sheets for lengthy content. Keep it to two levels at most.

### P4. Accordion, one facet open at a time
- What: stacked facet headers (for example "Genre · 2"). Tapping one expands it inline; opening another collapses the first.
- Used by: Baymard lists collapsible or accordion groups as a common desktop and mobile form, and recommends keeping key groups open and collapsing the rest. Specific apps: not confirmed.
- Works when: there are about 4-6 facets with short lists, and the user is exploring.
- Fails when: the open facet is long (Label), since it pushes the track list off a 390x844 phone screen. Inline-expanded content plus the track list is a lot of scrolling.

### P5. Bottom sheet or full-screen picker per facet, with search and Apply
- What: tapping a facet opens a picker for that facet only: search field, options with counts, multi-select, and a footer button "Show N results".
- Used by: Baymard cites Lowe's (search within the Brand filter on mobile) and Macy's (count on the Apply button). NN/g's batch-filter guidance recommends an Apply button on mobile.
- Works when: one facet has many values. Search and counts make long lists usable. The footer count tells the user what they are committing to.
- Fails when: it is opened from inside another sheet. NN/g: "Do not stack bottom sheets." Our playlist is already a slide-in sheet, so a picker must replace the panel body (push within the same surface), not float a second sheet on top.

### P6. Dimmed-results update while filters change (interactive filtering)
- What: results update as each selection is made, with a dimmed area and a spinner while it loads.
- Used by: NN/g cites Net-a-porter (desktop). NN/g says batch filtering is the mobile recommendation because page loads are often slow.
- Works when: on desktop, or when filtering is fast and local (our case: filtering a loaded list is local and fast, so this is viable).
- Fails when: on mobile the list jumps or scrolls under the user's thumb. NN/g: results that shift the page position disrupt the process.

---

## 2. Guidance for LONG facets (hundreds of labels)

Sourced guidance is marked (src). Inference is marked (inferred). Not confirmed is marked as such.

1. Search within the facet (src: Baymard on Lowe's mobile; Baymard guidance for long lists). Put a search field at the top of the picker, not in the main rail. Match on any substring, case-insensitive.
2. Show counts next to every option (src: Baymard "Blue (34)" guidance; "one of the single highest-impact improvements"). For us: "Blue Note 212".
3. Show top-N by count first, then "Show all N" (src: Baymard "show top values, hide the rest" pattern; N discussed in section 3). Sort the top-N by track count, not alphabetically, so the most useful values come first.
4. Pin selected values to the top of the picker (inferred from Baymard's applied-filters rule: the user must see what is active). Selected values stay visible even when they fall outside the top-N.
5. Hide or disable values that would return zero tracks under the other active facets (inferred from Baymard: "filters that silently return zero results" are a listed mistake; NN/g notes the zero-result risk of batch filtering). Show counts under the current other filters, not the global count.
6. Alphabetical index (A-Z strip): not confirmed as a sourced recommendation in what I read. Reasonable for a full-screen picker only. At 320px, a vertical A-Z index costs about 20px of width and 26 targets of 48dp is impossible, so use a horizontally scrolling letter strip (28px tall) in the full picker, not in an inline panel (inferred).
7. Recently used: not confirmed in the sources I read. Could be a small "Recent" group of up to 3 values in the picker (inferred). Skip it in v1 unless the owner asks.
8. Keep labels to one line with ellipsis (src: Material "Chip labels will truncate when in a wrapped layout"; "Text labels should be concise").
9. Use one apply action for the whole filter set, not an apply per facet, unless each facet is its own screen (src: NN/g batch filtering; Baymard sticky "Show X results" button). Inside a picker, the footer button shows the count for the combined filter set, not only the facet.

---

## 3. How many options to show before collapsing (with sources)

| Number | Where it comes from | Strength of source |
|---|---|---|
| Top 4 to 6 values per facet, then "Show more" | btng.studio blog, search excerpt, not read in full | Vendor blog opinion. Not a study. |
| Top 5 to 10 values when a facet has 50+ options, plus "Show more" or search | brokenrubik.com blog, search excerpt, not read in full | Vendor blog opinion. Not a study. |
| 5 to 10 relevant attributes per category; collapse or deprioritize the rest | Baymard "ecommerce-filter-ui" (read) | Baymard guidance, not a fixed numeric study result. Applies to facets, not values. |
| No more than 2 chip rows before horizontal scroll | Material 3 chips guidelines (read): "If there are more than two rows, consider using horizontal scrolling" | Official design system guidance. |
| 8dp minimum between chips; 48dp minimum target | Material 3 chips guidelines (read) | Official. |
| 44x44pt minimum target | Baymard "ecommerce-filter-ui" (read), citing Apple HIG accessibility. I did not read the Apple page. | Attributed to Apple by Baymard; Apple page not read. |
| Chip labels 20 characters or fewer | Material 3 chips guidelines (read) | Official. |
| Show "Show N results" with live count | Baymard (read) | Guidance. |

Derived numbers for our sheet (inferred, to be tested):
- Label, inline in an accordion: show 6 values (within the 4-6 blog range; 6 rows of 44px = 264px is about the most a 390px-tall viewport can hold beside a header).
- Label, in a dedicated picker: show 8 values before "Show all 340" (the picker has the room; 8 rows of 44px = 352px).
- Genre, Decade, Country: show all values in the picker if 15 or fewer; Country (up to 30) gets search plus top 8.
- Maximum rows of chips in any inline row: 2, then horizontal scroll (Material).

Source caveat: no study I read gives an exact number for "how many options before collapsing". The 4-6 and 5-10 figures are blog opinions. Treat them as starting points and test with the owner.

---

## 4. Three design options for our sheet (320px wide, 288px content width, 16px gutters)

Shared at the top of all three: search field (40px), sort chips (36px). The Label row, the four-row expansion, and the 5-6 line wrap are removed in all three.

Note on "bottom sheet" in the brief: the playlist is already a slide-in sheet. NN/g says not to stack sheets, so every "bottom sheet picker" below is implemented as a view that replaces the panel body, with a back chevron, not as a second overlay.

### Option A: Facet rail with per-facet picker (recommended)

Default layout, top to bottom:
1. Search field, 288x40, placeholder "Search tracks".
2. Sort chips: Artist | Title | Genre, 32px tall.
3. Facet rail, 40px row, horizontal scroll, no wrap. Chips: "Genre v", "Label v", "Decade v", "Country v". Chip height 32px, tap area 48px. Selected chips show a count badge ("Label 2 v"). Right edge fades 24px to signal scroll.
4. Applied summary row, 32px, shown only when at least one filter is active: removable chips "Blue Note x", "1960s x", then "Clear all" text button. Horizontal scroll with the last chip cut at the edge.
5. Result caption, 20px: "214 of 1,812 tracks · 18h 04m".
6. Track list begins at about y=170px.

What each tap does:
- Tap a facet chip: the panel body slides to a picker for that facet. Header: back chevron (44x44), facet name centered, "Clear" at right (44x44).
- Picker body: search field (40px, "Search 340 labels"); pinned "Selected" group if any; then the top 8 values by count, 44px rows with a 20px checkbox, name truncated to one line, count right-aligned; then "Show all 340" row, which expands to a scrollable list.
- Footer, sticky, 64px: primary button 288x48 "Show 214 tracks". The count updates live with the combined filter set. Tapping it commits the selection, returns to the list, and keeps the scroll position (NN/g).
- Back chevron: discards uncommitted changes.
- Tap a chip in the applied summary row: removes that filter immediately (no picker needed).

How selected filters are shown and removed:
- Facet chip shows a count badge; applied summary row shows names; removing from either place is one tap.
- Deselecting inside a picker, then committing, removes it.

Trade-offs:
- Pro: the default footprint is one row plus the summary. Removes the 4-row expansion and the Label wrap. Long facets get their own space with search and counts. Matches Material's chip-rail guidance and Baymard's applied-filters and apply-button guidance.
- Con: two taps to change a filter (chip, then Show). Four pickers to learn. The applied summary row adds a line when filters are on.

### Option B: Accordion, one facet open at a time, live results

Default layout, top to bottom:
1. Search field, 288x40.
2. Sort chips, 32px.
3. Filter header row, 40px, full width: funnel icon, "Filters", count "3 active" or "All tracks", chevron. Tapping toggles the accordion.
4. Applied summary row, 32px, always visible even when the accordion is collapsed (Baymard: the user must see what narrows the list).
5. Track list begins at about y=150px when collapsed.

Expanded accordion:
- Four facet headers, 44px each: "Genre · 2 v", "Label · 1 v", "Decade v", "Country v". Only one can be open.
- Open facet, Label: search field 40px; top 6 values as 44px rows with checkbox and count; "Show all 340" row, which expands to an inline list with a max height of 220px and its own scroll.
- Open facet, Genre, Decade, Country: chips in a wrapping set, capped at 2 rows, then horizontal scroll (Material).

What each tap does:
- Tapping a value ticks it and updates the list and the header count live ("214 of 1,812"). No Apply button. This is interactive filtering (NN/g: suited to exploratory users, but fragile on mobile).
- Tapping a facet header opens it and closes the others.
- Tapping the Filters header collapses the accordion.

How selected filters are shown and removed:
- Applied summary row shows removable chips. Removing a chip unticks the value and updates the list.
- Facet headers show "· N" counts.

Trade-offs:
- Pro: everything is visible in one scroll, no second screen, good for exploring. Live results need no commit step.
- Con: with the accordion open, the expanded area (4 x 44px headers + about 300px open facet) is about 480px, so the track list is pushed well below the fold on a 390x844 phone. Live updates while the user scrolls can shift the list under the thumb (NN/g). Mitigation: auto-collapse on list scroll.

### Option C: One Filters screen with sections and a sticky Apply

Default layout, top to bottom:
1. Search field, 288x40.
2. Sort chips, 32px.
3. Single trigger row, 44px full width: "Filters · 3 active" with a funnel icon and chevron. Sticky (stays visible as the list scrolls, per Baymard).
4. Applied summary row, 32px, removable chips.
5. Track list.

Tapping the trigger opens a Filters screen that replaces the panel body:
- Header 48px: X (close, 44x44, NN/g), "Filters" centered, "Clear all" at right.
- Applied chips row, 32px.
- Four section rows, 56px each: facet name at left, selection summary at right ("Blue Note +2 >", "1960s >", "Any >", "Genre: Rock, Jazz +1 >").
- Tapping a section row pushes that facet's picker (same picker as Option A), with a back chevron.
- Label picker only: horizontal letter strip, 28px tall, A-Z plus #, that jumps to the first label starting with the letter.
- Footer, sticky 64px: "Show 214 tracks" primary button 288x48. Commits all facets at once (Baymard's sticky Show X results pattern).

What each tap does:
- Trigger: opens the Filters screen.
- Section row: pushes that facet's picker.
- Picker: as Option A. Back returns to the Filters screen (not the list), with uncommitted changes kept until Show is tapped or X is pressed.
- X or Show: closes the screen. Show commits; X discards.

How selected filters are shown and removed:
- Section rows show the selected values. Applied chips at the top of the Filters screen and in the list summary row are removable. Clear all is in the header.

Trade-offs:
- Pro: all filters in one place; the most complete view of what is active; the clearest for a user who combines several facets. Closest to Baymard's and NN/g's mobile recommendations (one apply button with count, sticky trigger, applied summary).
- Con: three levels for a Label change (trigger, Filters screen, picker, then Show). This is the deepest flow of the three, and NN/g warns about layered overlays. The default footprint is one trigger row plus the summary, so it is similar to A, but the flow is longer.

### Recommendation: Option A

Why A over B and C:
- Smallest default footprint: one rail plus the summary row. This addresses "too busy" most directly.
- It removes the Label wrap entirely. Label gets a dedicated picker with search, counts, pinned selections, and top-8 by count, which is what a 300-value facet needs.
- Keeps the four facets visible and one tap away, so the capability is not hidden (the owner likes it).
- Matches the sourced guidance: a chip rail that scrolls instead of wrapping past 2 rows (Material), applied-filter chips that stay visible (Baymard), and a count on the Show button with batch apply on mobile (Baymard and NN/g).
- B is good for exploring but pushes the list off-screen on a phone. C is the right fallback if the owner later asks for one place to see every filter.

Implementation notes for A:
- Implement the picker as a view that replaces the panel body. Do not open a bottom sheet on top of the slide-in panel (NN/g: do not stack).
- The rail's horizontal scroll and the applied summary row's horizontal scroll both need the edge-fade cue (Baymard).
- Keep the 48px tap target even when the visible chip is 32px (Material).

---

## 5. Discogs, Spotify, and other apps: what I could and could not confirm

- Discogs marketplace (web, support article, excerpt): filters are Ships From (country or region), Format and Format Description, Price with preset ranges, Good Deals, Seller, Year (browse by decade, then expand to a year), and Genre & Style (styles nested under genres; both searchable). Sort by a dropdown. Confirmed as to the list of filters; the layout (sidebar, chips, or sheet) was not confirmed from the excerpt.
- Discogs collection, Android app (forum excerpt, date unknown): "filter your Collection and Wantlist on Genre, Style, Format, Year, Label, and more." Confirmed as a statement in a forum post, not as a current app screen.
- Discogs forum threads (dates unknown, not confirmed current): one request says Country and Label were not featured as filters, and an iOS feature request says artist pages gained format, year, genre, style, and country filters. Treat as user reports.
- Spotify (support and community excerpts): Your Library has type filters at the top (for example "Playlists", and "By you" / "By Spotify" for playlists). The full set of library filter chips and their layout: not confirmed.
- Apple Music, Bandcamp, and record-shop or marketplace apps: not researched within the budget. Not confirmed.
- Apple HIG segmented controls and search fields: pages found but not read. Not confirmed beyond the 44pt figure Baymard attributes to Apple.

---

## 6. Source URLs

Read in full (page reads, 5 of 5 budget):
1. https://www.nngroup.com/articles/applying-filters/ (NN/g, User Intent Affects Filter Design, 2016)
2. https://www.nngroup.com/articles/bottom-sheet/ (NN/g, Bottom Sheets: Definition and UX Guidelines, 2023)
3. https://baymard.com/research-articles/how-to-design-applied-filters (Baymard, Display Applied Filters in an Overview, updated May 2026)
4. https://baymard.com/blog/ecommerce-filter-ui (Baymard, What Is an Ecommerce Filter, Apr 2026)
5. https://m3.material.io/components/chips/guidelines (Material Design 3, Chips guidelines)

Seen as search excerpts only (not read in full):
6. https://support.discogs.com/hc/en-us/articles/47366145329421-How-To-Search-Filter-Marketplace-Listings
7. https://www.discogs.com/forum/thread/372692 (Sort by Genre in Collection)
8. https://www.discogs.com/forum/thread/402745 (Filter by country request)
9. https://www.discogs.com/forum/thread/707219 (iOS app feature requests)
10. https://support.spotify.com/us/article/your-library/
11. https://community.spotify.com/forum/en/discussion/7411628/ (Playlist folders on mobile)
12. https://www.btng.studio/articles/top-ecommerce-ux-filter-design-patterns-practical-tips-for-2025/ (source of the 4-6 figure; blog)
13. https://www.brokenrubik.com/blog/faceted-search-best-practices (source of the 5-10 figure at 50+ options; blog)
14. https://developer.apple.com/design/human-interface-guidelines/segmented-controls (not read)
15. https://developer.apple.com/design/human-interface-guidelines/search-fields (not read)

Also cited inside Baymard's pages but not read: the Baymard guideline on apply buttons in mobile filtering (guideline 1125) and the guideline on applied filters on mobile (guideline 2572). Those would be the next reads if the owner wants more depth.
