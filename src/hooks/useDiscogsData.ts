import { useState, useCallback } from 'react';
import { Track } from '@/types/track';

interface DiscogsCredentials {
  access_token: string;
  access_token_secret: string;
  username: string;
}

interface DiscogsRelease {
  id: number;
  basic_information: {
    id: number;
    title: string;
    year: number;
    thumb: string;
    cover_image: string;
    artists: Array<{ name: string }>;
    labels: Array<{ name: string }>;
    genres: string[];
    styles: string[];
  };
}

interface DiscogsWant {
  id: number;
  basic_information: {
    id: number;
    title: string;
    year: number;
    thumb: string;
    cover_image: string;
    artists: Array<{ name: string }>;
    labels: Array<{ name: string }>;
    genres: string[];
    styles: string[];
  };
}

export function useDiscogsData(credentials: DiscogsCredentials | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callApi = useCallback(async (action: string, params?: Record<string, unknown>) => {
    if (!credentials) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discogs-api`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          access_token: credentials.access_token,
          access_token_secret: credentials.access_token_secret,
          username: credentials.username,
          params,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'API call failed');
    }

    return response.json();
  }, [credentials]);

  const releaseToTrack = (release: DiscogsRelease | DiscogsWant, source: Track['source']): Track => {
    const info = release.basic_information;
    const artistName = info.artists?.[0]?.name || 'Unknown Artist';
    // Clean up artist name (remove numbering like (2), (3) etc)
    const cleanArtistName = artistName.replace(/\s*\(\d+\)$/, '');
    
    return {
      id: `${source}-${info.id}`,
      title: info.title,
      artist: cleanArtistName,
      album: info.title,
      year: info.year || 0,
      genre: info.genres?.[0] || info.styles?.[0] || 'Unknown',
      label: info.labels?.[0]?.name || 'Unknown',
      duration: 240, // Default duration, will be updated when YouTube video loads
      coverUrl: info.cover_image || info.thumb || '/placeholder.svg',
      youtubeId: '', // Will be populated by YouTube search
      source,
    };
  };

  const fetchCollection = useCallback(async (page = 1, perPage = 50): Promise<{ tracks: Track[]; hasMore: boolean }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await callApi('collection', { page, per_page: perPage });
      const tracks = (data.releases || []).map((r: DiscogsRelease) => releaseToTrack(r, 'collection'));
      const hasMore = data.pagination?.page < data.pagination?.pages;
      
      return { tracks, hasMore };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch collection');
      return { tracks: [], hasMore: false };
    } finally {
      setIsLoading(false);
    }
  }, [callApi]);

  const fetchWantlist = useCallback(async (page = 1, perPage = 50): Promise<{ tracks: Track[]; hasMore: boolean }> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await callApi('wantlist', { page, per_page: perPage });
      const tracks = (data.wants || []).map((w: DiscogsWant) => releaseToTrack(w, 'wantlist'));
      const hasMore = data.pagination?.page < data.pagination?.pages;
      
      return { tracks, hasMore };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wantlist');
      return { tracks: [], hasMore: false };
    } finally {
      setIsLoading(false);
    }
  }, [callApi]);

  const fetchPurchaseHistory = useCallback(async (): Promise<Track[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await callApi('orders');
      // Purchase history would require processing order items
      // For now, return empty as this requires additional API calls per order
      console.log('Orders data:', data);
      return [];
    } catch (err) {
      console.log('Purchase history not available:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [callApi]);

  const fetchAllTracks = useCallback(async (maxPerSource = 50): Promise<Track[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [collectionResult, wantlistResult] = await Promise.all([
        fetchCollection(1, maxPerSource),
        fetchWantlist(1, maxPerSource),
      ]);

      const allTracks = [...collectionResult.tracks, ...wantlistResult.tracks];
      
      // Shuffle the tracks
      const shuffled = allTracks.sort(() => Math.random() - 0.5);
      
      return shuffled;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tracks');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchCollection, fetchWantlist]);

  return {
    isLoading,
    error,
    fetchCollection,
    fetchWantlist,
    fetchPurchaseHistory,
    fetchAllTracks,
  };
}
