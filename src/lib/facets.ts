import type { Track } from '@/types/track';

/**
 * Crate-digging search and facet logic for the playlist panel. Pure functions,
 * no React — the panel, the facet picker and the add-tracks picker all filter
 * through here so they can never disagree about what a query matches.
 *
 * Facet values come off Track fields that are already cached per track
 * (Discogs styles fold into `genre` at ingest; year is bucketed into decades).
 */

export type FacetKey = 'genre' | 'label' | 'decade' | 'country';
export type FacetSelections = Record<FacetKey, string[]>;

export const FACET_KEYS: FacetKey[] = ['genre', 'label', 'decade', 'country'];

export const FACET_LABELS: Record<FacetKey, string> = {
  genre: 'Genre',
  label: 'Label',
  decade: 'Decade',
  country: 'Country',
};

export const EMPTY_FACETS: FacetSelections = { genre: [], label: [], decade: [], country: [] };

export function facetValue(track: Track, facet: FacetKey): string | undefined {
  switch (facet) {
    case 'genre': return track.genre && track.genre !== 'Unknown' ? track.genre : undefined;
    case 'label': return track.label && track.label !== 'Unknown' ? track.label : undefined;
    case 'decade': return track.year ? `${Math.floor(track.year / 10) * 10}s` : undefined;
    case 'country': return track.country || undefined;
  }
}

export function countSelected(selections: FacetSelections): number {
  return FACET_KEYS.reduce((n, key) => n + selections[key].length, 0);
}

/** Lower-cased, whitespace-split terms. An empty array matches everything. */
export function parseSearchTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Every term must appear somewhere in title / artist / album / label / year,
 * in any field and any order ("drexciya 1995", "tresor hood").
 */
export function matchesSearch(track: Track, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = `${track.title} ${track.artist} ${track.album || ''} ${track.label || ''} ${track.year || ''}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * OR within a facet, AND across facets. `except` skips one facet — that is
 * how a facet's own option counts are computed (see facetOptions).
 */
export function matchesFacets(track: Track, selections: FacetSelections, except?: FacetKey): boolean {
  for (const facet of FACET_KEYS) {
    if (facet === except) continue;
    const selected = selections[facet];
    if (selected.length === 0) continue;
    const value = facetValue(track, facet);
    if (value === undefined || !selected.includes(value)) return false;
  }
  return true;
}

export function filterTracks(tracks: Track[], terms: string[], selections: FacetSelections): Track[] {
  if (terms.length === 0 && countSelected(selections) === 0) return tracks;
  return tracks.filter((t) => matchesSearch(t, terms) && matchesFacets(t, selections));
}

export interface FacetOption {
  value: string;
  /** Tracks this value would show given the search and the OTHER facets. */
  count: number;
  selected: boolean;
}

/**
 * The values offered for one facet. Counts are taken over the tracks that
 * match the search and every other facet's selection, so a value is only
 * offered if picking it would actually return something — no dead ends.
 * A selected value is always kept (even at zero) so it can be un-ticked.
 * Order: selected first, then most tracks, then alphabetical.
 */
export function facetOptions(
  tracks: Track[],
  terms: string[],
  selections: FacetSelections,
  facet: FacetKey,
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const track of tracks) {
    if (!matchesSearch(track, terms) || !matchesFacets(track, selections, facet)) continue;
    const value = facetValue(track, facet);
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  }
  const selected = new Set(selections[facet]);
  for (const value of selected) {
    if (!counts.has(value)) counts.set(value, 0);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, selected: selected.has(value) }))
    .sort(
      (a, b) =>
        Number(b.selected) - Number(a.selected) ||
        b.count - a.count ||
        a.value.localeCompare(b.value),
    );
}

/** h:mm for hour-plus sets, m:ss below that. */
export function formatRuntime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s >= 3600) {
    return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
  }
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
