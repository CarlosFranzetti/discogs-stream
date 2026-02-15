import { useCallback, useRef } from 'react';
import type { Track } from '@/types/track';
import { supabase } from '@/integrations/supabase/client';
import { extractYouTubeCandidatesFromDiscogsRelease } from '@/lib/discogs';

type FetchRelease = (releaseId: number) => Promise<unknown>;

type ResolvedMedia =
  | { provider: 'youtube'; youtubeId: string; coverUrl?: string }
  | { provider: 'bandcamp'; bandcampEmbedSrc: string; bandcampUrl?: string; coverUrl?: string }
  | { provider: null; coverUrl?: string };

function normalizeForMatch(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function scoreVideoTitle(videoTitle: string, artist: string, trackTitle: string): number {
  const v = normalizeForMatch(videoTitle);
  const a = normalizeForMatch(artist);
  const t = normalizeForMatch(trackTitle);
  if (!v || !t) return 0;

  let score = 0;
  if (v.includes(t)) score += 10;
  if (a && v.includes(a)) score += 4;

  const vTokens = new Set(v.split(' ').filter(Boolean));
  const tTokens = new Set(t.split(' ').filter(Boolean));
  for (const tok of tTokens) {
    if (vTokens.has(tok)) score += 1;
  }

  return score;
}

interface TrackMediaRow {
  provider: 'youtube' | 'bandcamp';
  youtube_id?: string | null;
  bandcamp_embed_src?: string | null;
  bandcamp_url?: string | null;
  track_position?: string | null;
}

export function useTrackMediaResolver(opts: { fetchRelease?: FetchRelease; discogsUsername?: string }) {
  const { fetchRelease, discogsUsername } = opts;

  const mediaByReleaseCache = useRef<Map<number, TrackMediaRow[]>>(new Map());
  const pendingMediaFetch = useRef<Map<number, Promise<TrackMediaRow[]>>>(new Map());

  const releaseCache = useRef<Map<number, unknown>>(new Map());
  const pendingReleaseFetch = useRef<Map<number, Promise<unknown>>>(new Map());

  const getSavedMediaForRelease = useCallback(async (discogsReleaseId: number): Promise<TrackMediaRow[]> => {
    const cached = mediaByReleaseCache.current.get(discogsReleaseId);
    if (cached) return cached;

    const pending = pendingMediaFetch.current.get(discogsReleaseId);
    if (pending) return pending;

    const p = (async () => {
      if (!discogsUsername) return [];

      const { data, error } = await supabase.functions.invoke('track-media', {
        body: { action: 'get', discogs_username: discogsUsername, discogs_release_id: discogsReleaseId },
      });
      if (error) return [];

      const rows = (data?.rows || []) as TrackMediaRow[];
      mediaByReleaseCache.current.set(discogsReleaseId, rows);
      return rows;
    })().finally(() => {
      pendingMediaFetch.current.delete(discogsReleaseId);
    });

    pendingMediaFetch.current.set(discogsReleaseId, p);
    return p;
  }, [discogsUsername]);

  const getRelease = useCallback(async (discogsReleaseId: number): Promise<unknown> => {
    const cached = releaseCache.current.get(discogsReleaseId);
    if (cached) return cached;

    const pending = pendingReleaseFetch.current.get(discogsReleaseId);
    if (pending) return pending;

    const p = (async () => {
      if (!fetchRelease) return null;
      try {
        const rel = await fetchRelease(discogsReleaseId);
        releaseCache.current.set(discogsReleaseId, rel);
        return rel;
      } catch (error) {
        // Handle authentication errors gracefully - return null instead of throwing
        if (error instanceof Error && error.message.includes('Not authenticated')) {
          console.warn('Cannot fetch release - not authenticated');
          return null;
        }
        throw error;
      }
    })().finally(() => {
      pendingReleaseFetch.current.delete(discogsReleaseId);
    });

    pendingReleaseFetch.current.set(discogsReleaseId, p);
    return p;
  }, [fetchRelease]);

  const resolveMediaForTrack = useCallback(async (
    track: Track,
    options?: { preferDifferentFromYoutubeId?: string }
  ): Promise<ResolvedMedia> => {
    if (!track.discogsReleaseId) return { provider: null };

    // 1) Prefer saved media mappings (Bandcamp first, then YouTube) for this release/track position.
    const saved = await getSavedMediaForRelease(track.discogsReleaseId);
    const pos = (track.discogsTrackPosition || '').trim() || null;
    const exact = pos ? saved.filter((r) => (r.track_position || '').trim() === pos) : [];
    const candidates = exact.length ? exact : saved;

    const bandcamp = candidates.find((r) => r.provider === 'bandcamp' && r.bandcamp_embed_src);
    if (bandcamp?.bandcamp_embed_src) {
      return { provider: 'bandcamp', bandcampEmbedSrc: bandcamp.bandcamp_embed_src, bandcampUrl: bandcamp.bandcamp_url || undefined };
    }

    const youtube = candidates.find((r) => r.provider === 'youtube' && r.youtube_id);
    if (youtube?.youtube_id) {
      return { provider: 'youtube', youtubeId: youtube.youtube_id };
    }

    // 2) Fallback: Discogs release videos (often YouTube) and best-effort match to the track title.
    const release = await getRelease(track.discogsReleaseId);
    
    // Extract cover art from Discogs release
    const images = (release as { images?: Array<{ resource_url?: string; type?: string }> })?.images;
    const discogsCover = images?.find(img => img.type === 'primary')?.resource_url || images?.[0]?.resource_url;

    const yt = extractYouTubeCandidatesFromDiscogsRelease(release);
    if (yt.length === 0) return { provider: null, coverUrl: discogsCover };

    const scored = yt
      .map((c) => ({ ...c, score: scoreVideoTitle(c.title || '', track.artist, track.title) }))
      .sort((a, b) => b.score - a.score);

    const preferDifferentFrom = (options?.preferDifferentFromYoutubeId || '').trim();
    const best = preferDifferentFrom ? scored.find((x) => x.videoId !== preferDifferentFrom) : scored[0];
    if (best && best.videoId) return { provider: 'youtube', youtubeId: best.videoId, coverUrl: discogsCover };
    return { provider: null, coverUrl: discogsCover };
  }, [getRelease, getSavedMediaForRelease]);

  const prefetchForTracks = useCallback(async (tracks: Track[]) => {
    const releaseIds = new Set<number>();
    for (const t of tracks) {
      if (t.discogsReleaseId) releaseIds.add(t.discogsReleaseId);
    }
    await Promise.all([...releaseIds].flatMap((id) => [getSavedMediaForRelease(id), getRelease(id)]));
  }, [getRelease, getSavedMediaForRelease]);

  return { resolveMediaForTrack, prefetchForTracks };
}
