import { describe, it, expect } from 'vitest';
import type { Track } from '@/types/track';
import {
  EMPTY_FACETS,
  countSelected,
  facetOptions,
  facetValue,
  filterTracks,
  formatRuntime,
  matchesFacets,
  matchesSearch,
  parseSearchTerms,
  type FacetSelections,
} from './facets';

let seq = 0;
function mk(overrides: Partial<Track> = {}): Track {
  seq += 1;
  return {
    id: `t-${seq}`,
    title: `Title ${seq}`,
    artist: 'Artist',
    album: 'Album',
    year: 1995,
    genre: 'Techno',
    label: 'Tresor',
    duration: 300,
    coverUrl: '',
    youtubeId: '',
    country: 'Germany',
    source: 'collection',
    ...overrides,
  };
}

function sel(partial: Partial<FacetSelections>): FacetSelections {
  return { ...EMPTY_FACETS, ...partial };
}

describe('facetValue', () => {
  it('returns the field value', () => {
    const t = mk({ genre: 'House', label: 'Planet E', country: 'US' });
    expect(facetValue(t, 'genre')).toBe('House');
    expect(facetValue(t, 'label')).toBe('Planet E');
    expect(facetValue(t, 'country')).toBe('US');
  });

  it('treats Unknown and empty as missing', () => {
    const t = mk({ genre: 'Unknown', label: 'Unknown', country: undefined });
    expect(facetValue(t, 'genre')).toBeUndefined();
    expect(facetValue(t, 'label')).toBeUndefined();
    expect(facetValue(t, 'country')).toBeUndefined();
    expect(facetValue(mk({ genre: '', label: '', country: '' }), 'genre')).toBeUndefined();
    expect(facetValue(mk({ country: '' }), 'country')).toBeUndefined();
  });

  it('buckets year into decades', () => {
    expect(facetValue(mk({ year: 1989 }), 'decade')).toBe('1980s');
    expect(facetValue(mk({ year: 1990 }), 'decade')).toBe('1990s');
    expect(facetValue(mk({ year: 2003 }), 'decade')).toBe('2000s');
  });

  it('has no decade when year is 0', () => {
    expect(facetValue(mk({ year: 0 }), 'decade')).toBeUndefined();
  });
});

describe('countSelected', () => {
  it('sums across facets', () => {
    expect(countSelected(EMPTY_FACETS)).toBe(0);
    expect(countSelected(sel({ genre: ['a', 'b'], country: ['c'] }))).toBe(3);
  });
});

describe('parseSearchTerms', () => {
  it('lower-cases and splits on whitespace', () => {
    expect(parseSearchTerms('  Drexciya   1995 ')).toEqual(['drexciya', '1995']);
  });
  it('returns empty for blank input', () => {
    expect(parseSearchTerms('')).toEqual([]);
    expect(parseSearchTerms('   ')).toEqual([]);
  });
});

describe('matchesSearch', () => {
  const t = mk({ title: 'Andrea', artist: 'Drexciya', album: 'Neptune', label: 'Tresor', year: 1995 });

  it('matches everything with no terms', () => {
    expect(matchesSearch(t, [])).toBe(true);
  });
  it('matches any field', () => {
    expect(matchesSearch(t, ['andrea'])).toBe(true);
    expect(matchesSearch(t, ['drexciya'])).toBe(true);
    expect(matchesSearch(t, ['neptune'])).toBe(true);
    expect(matchesSearch(t, ['tresor'])).toBe(true);
  });
  it('requires all terms, in any order', () => {
    expect(matchesSearch(t, ['tresor', 'drexciya'])).toBe(true);
    expect(matchesSearch(t, ['tresor', 'nope'])).toBe(false);
  });
  it('matches on year', () => {
    expect(matchesSearch(t, ['drexciya', '1995'])).toBe(true);
    expect(matchesSearch(t, ['1996'])).toBe(false);
  });
});

describe('matchesFacets', () => {
  const t = mk({ genre: 'Techno', label: 'Tresor', year: 1995, country: 'Germany' });

  it('passes with no selections', () => {
    expect(matchesFacets(t, EMPTY_FACETS)).toBe(true);
  });
  it('ORs within a facet', () => {
    expect(matchesFacets(t, sel({ genre: ['House', 'Techno'] }))).toBe(true);
    expect(matchesFacets(t, sel({ genre: ['House', 'Electro'] }))).toBe(false);
  });
  it('ANDs across facets', () => {
    expect(matchesFacets(t, sel({ genre: ['Techno'], label: ['Tresor'] }))).toBe(true);
    expect(matchesFacets(t, sel({ genre: ['Techno'], label: ['Other'] }))).toBe(false);
  });
  it('fails when the track lacks a value for a selected facet', () => {
    expect(matchesFacets(mk({ country: undefined }), sel({ country: ['Germany'] }))).toBe(false);
  });
  it('skips the excepted facet', () => {
    const s = sel({ genre: ['House'], label: ['Tresor'] });
    expect(matchesFacets(t, s)).toBe(false);
    expect(matchesFacets(t, s, 'genre')).toBe(true);
    expect(matchesFacets(t, s, 'label')).toBe(false);
  });
});

describe('filterTracks', () => {
  const a = mk({ artist: 'Drexciya', genre: 'Electro', year: 1995 });
  const b = mk({ artist: 'Jeff Mills', genre: 'Techno', year: 1996 });
  const c = mk({ artist: 'Drexciya', genre: 'Techno', year: 2001 });
  const tracks = [a, b, c];

  it('returns the same array reference when nothing is active', () => {
    expect(filterTracks(tracks, [], EMPTY_FACETS)).toBe(tracks);
  });
  it('filters by search', () => {
    expect(filterTracks(tracks, ['drexciya'], EMPTY_FACETS)).toEqual([a, c]);
  });
  it('filters by facets', () => {
    expect(filterTracks(tracks, [], sel({ genre: ['Techno'] }))).toEqual([b, c]);
  });
  it('combines search and facets', () => {
    expect(filterTracks(tracks, ['drexciya'], sel({ genre: ['Techno'] }))).toEqual([c]);
  });
});

describe('facetOptions', () => {
  const tracks = [
    mk({ genre: 'Techno', label: 'Tresor', artist: 'A' }),
    mk({ genre: 'Techno', label: 'Tresor', artist: 'A' }),
    mk({ genre: 'Techno', label: 'Axis', artist: 'B' }),
    mk({ genre: 'House', label: 'Axis', artist: 'B' }),
    mk({ genre: 'Electro', label: 'Underground Resistance', artist: 'B' }),
    mk({ genre: 'Unknown', label: 'Unknown', artist: 'B' }),
  ];

  it('counts and orders by count desc then alphabetical', () => {
    const opts = facetOptions(tracks, [], EMPTY_FACETS, 'genre');
    expect(opts.map((o) => [o.value, o.count])).toEqual([
      ['Techno', 3],
      ['Electro', 1],
      ['House', 1],
    ]);
  });

  it('omits Unknown values', () => {
    const opts = facetOptions(tracks, [], EMPTY_FACETS, 'label');
    expect(opts.find((o) => o.value === 'Unknown')).toBeUndefined();
  });

  it('respects the search terms', () => {
    const opts = facetOptions(tracks, ['a'], EMPTY_FACETS, 'genre');
    // search "a" matches artist A, B, and titles/albums containing "a"; use a tighter term instead
    expect(opts.length).toBeGreaterThan(0);
    const narrow = facetOptions(tracks, ['tresor'], EMPTY_FACETS, 'genre');
    expect(narrow.map((o) => [o.value, o.count])).toEqual([['Techno', 2]]);
  });

  it('respects other facets but not its own selection', () => {
    const selections = sel({ genre: ['House'], label: ['Axis'] });
    const genreOpts = facetOptions(tracks, [], selections, 'genre');
    // genre counts ignore the genre selection but apply label=Axis
    expect(genreOpts.map((o) => [o.value, o.count, o.selected])).toEqual([
      ['House', 1, true],
      ['Techno', 1, false],
    ]);
    const labelOpts = facetOptions(tracks, [], selections, 'label');
    // label counts apply genre=House
    expect(labelOpts.map((o) => [o.value, o.count, o.selected])).toEqual([['Axis', 1, true]]);
  });

  it('omits zero-count values unless selected', () => {
    const selections = sel({ genre: ['Electro'], label: ['Tresor'] });
    const opts = facetOptions(tracks, [], selections, 'genre');
    // With label=Tresor only Techno has tracks; Electro is selected so kept at zero.
    expect(opts.map((o) => [o.value, o.count, o.selected])).toEqual([
      ['Electro', 0, true],
      ['Techno', 2, false],
    ]);
  });

  it('orders selected first, then count desc, then alphabetical', () => {
    const opts = facetOptions(tracks, [], sel({ genre: ['House'] }), 'genre');
    expect(opts.map((o) => o.value)).toEqual(['House', 'Techno', 'Electro']);
  });
});

describe('formatRuntime', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatRuntime(0)).toBe('0:00');
    expect(formatRuntime(59)).toBe('0:59');
    expect(formatRuntime(240)).toBe('4:00');
    expect(formatRuntime(3600)).toBe('1h 00m');
    expect(formatRuntime(3725)).toBe('1h 02m');
  });
});
