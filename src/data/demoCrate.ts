import type { Track } from '@/types/track';

/**
 * Demo crate — a session-only library of electro and techno records so the
 * app can be tried without a Discogs login or a CSV export.
 *
 * Rules the rest of the app relies on:
 *  - every id starts with `demo-` (see isDemoTrack). Demo rows are never
 *    written to the cloud cache or localStorage, and any real import replaces
 *    them rather than merging with them.
 *  - `youtubeId` is deliberately empty: links come from the same search chain
 *    as a real collection. Hardcoding ids would rot silently the first time an
 *    upload is taken down; the chain self-heals and caches by artist + title.
 *  - `duration` stays at the 240s placeholder, so the client does not send a
 *    made-up expected length and the real one is stamped from playback.
 *  - covers are generated SVG data URIs — no third-party image host, and
 *    `img-src data:` is already in the CSP.
 */

type DemoGenre = 'Electro' | 'Techno';

interface DemoSeed {
  artist: string;
  title: string;
  album: string;
  year: number;
  label: string;
  country: string;
  genre: DemoGenre;
}

const SEEDS: DemoSeed[] = [
  // ── Electro ──────────────────────────────────────────────────────────
  { artist: 'Kraftwerk', title: 'Numbers', album: 'Computer World', year: 1981, label: 'Kling Klang', country: 'Germany', genre: 'Electro' },
  { artist: 'Afrika Bambaataa & The Soulsonic Force', title: 'Planet Rock', album: 'Planet Rock', year: 1982, label: 'Tommy Boy', country: 'US', genre: 'Electro' },
  { artist: 'Man Parrish', title: "Hip Hop, Be Bop (Don't Stop)", album: "Hip Hop, Be Bop (Don't Stop)", year: 1982, label: 'Importe/12', country: 'US', genre: 'Electro' },
  { artist: 'Cybotron', title: 'Clear', album: 'Clear', year: 1983, label: 'Fantasy', country: 'US', genre: 'Electro' },
  { artist: 'Hashim', title: 'Al-Naafiysh (The Soul)', album: 'Al-Naafiysh (The Soul)', year: 1983, label: 'Cutting Records', country: 'US', genre: 'Electro' },
  { artist: 'Newcleus', title: 'Jam On It', album: 'Jam On It', year: 1984, label: 'Sunnyview', country: 'US', genre: 'Electro' },
  { artist: 'Egyptian Lover', title: 'Egypt, Egypt', album: 'Egypt, Egypt', year: 1984, label: 'Freak Beat Records', country: 'US', genre: 'Electro' },
  { artist: 'Model 500', title: "No UFO's", album: "No UFO's", year: 1985, label: 'Metroplex', country: 'US', genre: 'Electro' },
  { artist: 'Drexciya', title: 'Wavejumper', album: 'Aquatic Invasion', year: 1995, label: 'Underground Resistance', country: 'US', genre: 'Electro' },
  { artist: 'Aux 88', title: 'Direct Drive', album: 'Direct Drive', year: 1995, label: 'Direct Beat', country: 'US', genre: 'Electro' },
  { artist: 'Anthony Rother', title: 'Sex With The Machines', album: 'Sex With The Machines', year: 1997, label: 'Kanzleramt', country: 'Germany', genre: 'Electro' },
  { artist: 'Dopplereffekt', title: 'Scientist', album: 'Gesamtkunstwerk', year: 1999, label: 'International Deejay Gigolo Records', country: 'Germany', genre: 'Electro' },
  { artist: 'The Other People Place', title: 'Let Me Be Me', album: 'Lifestyles Of The Laptop Café', year: 2001, label: 'Warp Records', country: 'UK', genre: 'Electro' },
  // ── Techno ───────────────────────────────────────────────────────────
  { artist: 'Rhythim Is Rhythim', title: 'Strings Of Life', album: 'Strings Of Life', year: 1987, label: 'Transmat', country: 'US', genre: 'Techno' },
  { artist: 'Inner City', title: 'Big Fun', album: 'Big Fun', year: 1988, label: 'KMS', country: 'US', genre: 'Techno' },
  { artist: 'Joey Beltram', title: 'Energy Flash', album: 'Beltram Vol. 1', year: 1990, label: 'R&S Records', country: 'Belgium', genre: 'Techno' },
  { artist: 'Galaxy 2 Galaxy', title: 'Hi-Tech Jazz', album: 'Galaxy 2 Galaxy', year: 1993, label: 'Underground Resistance', country: 'US', genre: 'Techno' },
  { artist: 'Plastikman', title: 'Spastik', album: 'Spastik', year: 1993, label: 'Plus 8 Records', country: 'Canada', genre: 'Techno' },
  { artist: 'Basic Channel', title: 'Phylyps Trak', album: 'Phylyps Trak', year: 1993, label: 'Basic Channel', country: 'Germany', genre: 'Techno' },
  { artist: 'Robert Hood', title: 'Minus', album: 'Internal Empire', year: 1994, label: 'Tresor', country: 'Germany', genre: 'Techno' },
  { artist: 'Dave Clarke', title: 'Wisdom To The Wise (Red 2)', album: 'Red 2', year: 1994, label: 'Bush', country: 'UK', genre: 'Techno' },
  { artist: 'Paperclip People', title: 'Throw', album: 'Throw / Remake (Basic Reshape)', year: 1994, label: 'Planet E', country: 'US', genre: 'Techno' },
  { artist: 'Jeff Mills', title: 'The Bells', album: 'Kat Moda EP', year: 1997, label: 'Purpose Maker', country: 'US', genre: 'Techno' },
  { artist: 'DJ Rolando', title: 'Jaguar', album: 'Knights Of The Jaguar EP', year: 1999, label: 'Underground Resistance', country: 'US', genre: 'Techno' },
  { artist: 'Octave One', title: 'Blackwater', album: 'Blackwater', year: 2000, label: '430 West', country: 'US', genre: 'Techno' },
];

/** Two palettes, one per genre: cold cyan/magenta for electro, acid for techno. */
const PALETTES: Record<DemoGenre, [string, string][]> = {
  Electro: [['#22d3ee', '#e879f9'], ['#38bdf8', '#f472b6'], ['#2dd4bf', '#a78bfa'], ['#67e8f9', '#fb7185']],
  Techno: [['#a3e635', '#facc15'], ['#f97316', '#fde047'], ['#bef264', '#34d399'], ['#fb923c', '#f43f5e']],
};

/** Up to three characters that read as a record-label monogram. */
function monogram(artist: string): string {
  const words = artist.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
}

/**
 * Sleeve art as an inline SVG. Radial on purpose: the player crops covers to
 * a circle for the record label, the playlist shows them square, and a
 * concentric design survives both. The centre is kept empty because the
 * player draws the spindle hole there — text sits above and below it.
 */
function demoCover(seed: DemoSeed, index: number): string {
  const palette = PALETTES[seed.genre];
  const [a, b] = palette[index % palette.length];
  const rings = Array.from({ length: 7 }, (_, i) => {
    const r = 46 + i * 22;
    const dash = seed.genre === 'Techno' ? `stroke-dasharray="${4 + i * 3} ${6 + i * 2}"` : '';
    return `<circle cx="200" cy="200" r="${r}" fill="none" stroke="${i % 2 ? b : a}" stroke-opacity="${0.55 - i * 0.06}" stroke-width="${i % 3 === 0 ? 2 : 1}" ${dash} transform="rotate(${index * 37 + i * 19} 200 200)"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<defs><radialGradient id="g" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="${a}" stop-opacity=".5"/><stop offset=".6" stop-color="#0b0d14" stop-opacity="1"/><stop offset="1" stop-color="#05060a"/></radialGradient></defs>
<rect width="400" height="400" fill="#05060a"/><rect width="400" height="400" fill="url(#g)"/>
${rings}
<text x="200" y="128" text-anchor="middle" font-family="ui-monospace,Menlo,Consolas,monospace" font-weight="700" font-size="60" letter-spacing="6" fill="${a}">${monogram(seed.artist)}</text>
<text x="200" y="306" text-anchor="middle" font-family="ui-monospace,Menlo,Consolas,monospace" font-weight="700" font-size="22" letter-spacing="6" fill="${b}">${seed.genre.toUpperCase()} · ${seed.year}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const DEMO_ID_PREFIX = 'demo-';

export function isDemoTrack(track: Pick<Track, 'id'>): boolean {
  return track.id.startsWith(DEMO_ID_PREFIX);
}

export const DEMO_TRACKS: Track[] = SEEDS.map((seed, index) => {
  const coverUrl = demoCover(seed, index);
  return {
    id: `${DEMO_ID_PREFIX}${index + 1}`,
    title: seed.title,
    artist: seed.artist,
    album: seed.album,
    year: seed.year,
    genre: seed.genre,
    label: seed.label,
    country: seed.country,
    duration: 240,
    coverUrl,
    coverUrls: [coverUrl],
    youtubeId: '',
    youtubeCandidates: [],
    workingStatus: 'pending',
    source: 'collection',
  };
});
