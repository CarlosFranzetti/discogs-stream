import { useState, useCallback } from 'react';
import { Track } from '@/types/track';
import { parseDiscogsDurationToSeconds } from '@/lib/discogs';

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

interface DiscogsReleaseDetails {
  id: number;
  title?: string;
  year?: number;
  tracklist?: Array<{
    position?: string;
    title?: string;
    duration?: string;
    type_?: string;
    artists?: Array<{ name?: string }>;
  }>;
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
      id: `${source}-${release.id}`,
      title: info.title,
      artist: cleanArtistName,
      album: info.title,
      year: info.year || 0,
      genre: info.genres?.[0] || info.styles?.[0] || 'Unknown',
      label: info.labels?.[0]?.name || 'Unknown',
      duration: 240, // Default duration, will be updated when YouTube video loads
      coverUrl: info.cover_image || info.thumb || '/placeholder.svg',
      youtubeId: '', // Populated later from Discogs release video links (or user input).
      discogsReleaseId: info.id,
      source,
    };
  };

  const fetchRelease = useCallback(async (releaseId: number) => {
    return callApi('release', { release_id: releaseId });
  }, [callApi]);

  const expandReleaseToTracks = useCallback(async (
    release: DiscogsRelease | DiscogsWant,
    source: Track['source']
  ): Promise<Track[]> => {
    const info = release.basic_information;
    const artistName = info.artists?.[0]?.name || 'Unknown Artist';
    const cleanArtistName = artistName.replace(/\s*\(\d+\)$/, '');

    const releaseId = info.id;
    const coverUrl = info.cover_image || info.thumb || '/placeholder.svg';
    const album = info.title;
    const year = info.year || 0;
    const genre = info.genres?.[0] || info.styles?.[0] || 'Unknown';
    const label = info.labels?.[0]?.name || 'Unknown';

    const details = (await fetchRelease(releaseId)) as DiscogsReleaseDetails;
    const tracklist = Array.isArray(details?.tracklist) ? details.tracklist : [];

    const tracks: Track[] = [];
    let idx = 0;

    for (const t of tracklist) {
      if (t?.type_ && t.type_ !== 'track') continue;
      const title = (t?.title || '').trim();
      if (!title) continue;

      const pos = (t?.position || '').trim();
      const duration = parseDiscogsDurationToSeconds(t?.duration || '') ?? 240;
      const trackArtistRaw = t?.artists?.[0]?.name || cleanArtistName;
      const trackArtist = (trackArtistRaw || 'Unknown Artist').replace(/\s*\(\d+\)$/, '');

      const position = pos || String(idx + 1);
      tracks.push({
        id: `${source}-${releaseId}-${position}`,
        title,
        artist: trackArtist,
        album,
        year,
        genre,
        label,
        duration,
        coverUrl,
        youtubeId: '',
        discogsReleaseId: releaseId,
        discogsTrackPosition: position,
        discogsTrackIndex: idx,
        source,
      });
      idx += 1;
    }

    return tracks;
  }, [fetchRelease]);

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
      const [collectionRaw, wantlistRaw] = await Promise.all([
        callApi('collection', { page: 1, per_page: maxPerSource }),
        callApi('wantlist', { page: 1, per_page: maxPerSource }),
      ]);

      const collectionReleases = (collectionRaw?.releases || []) as DiscogsRelease[];
      const wantReleases = (wantlistRaw?.wants || []) as DiscogsWant[];

      const allReleases: Array<{ r: DiscogsRelease | DiscogsWant; source: Track['source'] }> = [
        ...collectionReleases.map((r) => ({ r, source: 'collection' as const })),
        ...wantReleases.map((r) => ({ r, source: 'wantlist' as const })),
      ];

      const expanded: Track[] = [];

      // Limit concurrency to avoid hammering the edge function.
      const concurrency = 3;
      for (let i = 0; i < allReleases.length; i += concurrency) {
        const batch = allReleases.slice(i, i + concurrency);
        const batchTracks = await Promise.all(batch.map((x) => expandReleaseToTracks(x.r, x.source)));
        for (const list of batchTracks) expanded.push(...list);
      }

      // Shuffle the tracks
      return expanded.sort(() => Math.random() - 0.5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tracks');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [callApi, expandReleaseToTracks]);

  return {
    isLoading,
    error,
    fetchCollection,
    fetchWantlist,
    fetchPurchaseHistory,
    fetchAllTracks,
    fetchRelease,
  };
}
