import { useState, useCallback } from 'react';
import { SimilarRelease } from '@/types/extension';
import { Track } from '@/types/track';
import { useMarketplace } from './useMarketplace';

export function useSimilarReleases() {
  const [results, setResults] = useState<SimilarRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTrack, setLastTrack] = useState<Track | null>(null);
  const { searchSimilar } = useMarketplace();

  const findSimilar = useCallback(async (track: Track, mode: 'genre' | 'label' | 'artist' | 'year' = 'genre') => {
    if (!track) return;
    setLoading(true);
    setError(null);
    setLastTrack(track);

    try {
      const params: Parameters<typeof searchSimilar>[0] = {};

      if (mode === 'genre' && track.genre) params.genre = track.genre;
      else if (mode === 'label' && track.label) params.label = track.label;
      else if (mode === 'artist' && track.artist) params.artist = track.artist;
      else if (mode === 'year' && track.year) params.year = track.year;
      else {
        if (track.genre) params.genre = track.genre;
        else if (track.artist) params.artist = track.artist;
      }

      const similar = await searchSimilar(params);
      const filtered = similar.filter((r: SimilarRelease) =>
        String(r.id) !== String(track.discogsReleaseId)
      );
      setResults(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to find similar releases');
    } finally {
      setLoading(false);
    }
  }, [searchSimilar]);

  const clearResults = useCallback(() => {
    setResults([]);
    setLastTrack(null);
  }, []);

  return {
    results,
    loading,
    error,
    lastTrack,
    findSimilar,
    clearResults,
  };
}
