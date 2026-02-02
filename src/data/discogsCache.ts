import type { Track } from '@/types/track';

const CACHE_PREFIX = 'discogs-stream:discogs-tracks';
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

export interface DiscogsTracksCache {
  discogsTracks: Track[];
  playableTracks: Track[];
  updatedAt: number;
}

function getCacheKey(username: string) {
  return `${CACHE_PREFIX}:${username}`;
}

export function readDiscogsCache(username: string): DiscogsTracksCache | null {
  if (!username || typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(getCacheKey(username));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DiscogsTracksCache | null;
    if (
      !parsed ||
      !Array.isArray(parsed.discogsTracks) ||
      !Array.isArray(parsed.playableTracks)
    ) {
      localStorage.removeItem(getCacheKey(username));
      return null;
    }
    if (Date.now() - parsed.updatedAt > CACHE_TTL_MS) {
      localStorage.removeItem(getCacheKey(username));
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('Unable to read Discogs cache', error);
    localStorage.removeItem(getCacheKey(username));
    return null;
  }
}

export function writeDiscogsCache(
  username: string,
  discogsTracks: Track[],
  playableTracks: Track[]
) {
  if (!username || typeof window === 'undefined') return;

  try {
    const payload: DiscogsTracksCache = {
      discogsTracks,
      playableTracks,
      updatedAt: Date.now(),
    };

    localStorage.setItem(getCacheKey(username), JSON.stringify(payload));
  } catch (error) {
    console.error('Unable to persist Discogs cache', error);
  }
}

export function clearDiscogsCache(username: string) {
  if (!username || typeof window === 'undefined') return;
  localStorage.removeItem(getCacheKey(username));
}
