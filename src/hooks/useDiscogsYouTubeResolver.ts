import { useCallback, useRef } from 'react';
import type { Track } from '@/types/track';
import { extractYouTubeIdsFromDiscogsRelease } from '@/lib/discogs';

type FetchRelease = (releaseId: number) => Promise<unknown>;

export function useDiscogsYouTubeResolver(fetchRelease?: FetchRelease) {
  const releaseCandidatesCache = useRef<Map<number, string[]>>(new Map());
  const pendingReleaseFetches = useRef<Map<number, Promise<string[]>>>(new Map());

  const getCandidatesForRelease = useCallback(async (releaseId: number): Promise<string[]> => {
    const cached = releaseCandidatesCache.current.get(releaseId);
    if (cached) return cached;

    const pending = pendingReleaseFetches.current.get(releaseId);
    if (pending) return pending;

    const p = (async () => {
      if (!fetchRelease) return [];

      try {
        const release = await fetchRelease(releaseId);
        const candidates = extractYouTubeIdsFromDiscogsRelease(release);
        releaseCandidatesCache.current.set(releaseId, candidates);
        return candidates;
      } catch {
        releaseCandidatesCache.current.set(releaseId, []);
        return [];
      } finally {
        pendingReleaseFetches.current.delete(releaseId);
      }
    })();

    pendingReleaseFetches.current.set(releaseId, p);
    return p;
  }, [fetchRelease]);

  const resolveVideoIdForTrack = useCallback(async (
    track: Track,
    options?: { preferDifferentFrom?: string }
  ): Promise<string> => {
    if (track.youtubeId) return track.youtubeId;
    if (!track.discogsReleaseId) return '';

    const candidates = await getCandidatesForRelease(track.discogsReleaseId);
    if (candidates.length === 0) return '';

    const preferDifferentFrom = options?.preferDifferentFrom;
    if (preferDifferentFrom) {
      const alt = candidates.find((id) => id !== preferDifferentFrom);
      return alt || '';
    }

    return candidates[0] || '';
  }, [getCandidatesForRelease]);

  const prefetchTracks = useCallback(async (tracks: Track[]) => {
    const releaseIds = new Set<number>();
    for (const t of tracks) {
      if (t.discogsReleaseId) releaseIds.add(t.discogsReleaseId);
    }

    await Promise.all([...releaseIds].map((id) => getCandidatesForRelease(id)));
  }, [getCandidatesForRelease]);

  return { resolveVideoIdForTrack, prefetchTracks };
}

