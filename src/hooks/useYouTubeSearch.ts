import { useState, useCallback, useRef } from 'react';
import { Track } from '@/types/track';
import { supabase } from '@/integrations/supabase/client';

interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

// Cache for YouTube video IDs to avoid repeated API calls
const videoCache = new Map<string, string>();
// Cache for tracks we know have no YouTube video
const unavailableCache = new Set<string>();

// Function to clear all caches (for fresh loads)
function clearAllCaches() {
  videoCache.clear();
  unavailableCache.clear();
}

export function useYouTubeSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  // Important: use a ref so in-flight loops can see quota updates immediately
  // (state updates won't update existing closures until rerender).
  const quotaExceededRef = useRef(false);
  const pendingSearches = useRef<Map<string, Promise<string>>>(new Map());
  const lastSearchTime = useRef<number>(0);
  const MIN_SEARCH_INTERVAL = 500; // ms

  const isQuotaError = useCallback((errText: string) => {
    return /quota_exceeded|quotaExceeded|dailyLimitExceeded|exceeded.*quota|youtube api search error:\s*403/i.test(errText);
  }, []);

  const markQuotaExceeded = useCallback(() => {
    quotaExceededRef.current = true;
    setIsQuotaExceeded(true);
  }, []);

  const getCacheKey = useCallback((track: Track): string => {
    return `${track.artist}-${track.title}`.toLowerCase();
  }, []);

  const isTrackAvailable = useCallback((track: Track): boolean | null => {
    const cacheKey = getCacheKey(track);
    if (track.youtubeId) return true;
    if (videoCache.has(cacheKey) && videoCache.get(cacheKey)) return true;
    if (unavailableCache.has(cacheKey)) return false;
    return null; // Unknown
  }, [getCacheKey]);

  const searchForVideo = useCallback(
    async (track: Track, options?: { force?: boolean; maxResults?: number }): Promise<string> => {
      const force = options?.force ?? false;
      const maxResults = options?.maxResults ?? 5;

      const cacheKey = getCacheKey(track);

      // If track already has a youtubeId and we're not forcing a re-search, return it
      if (track.youtubeId && !force) {
        return track.youtubeId;
      }

      // Check cache first (unless forced)
      if (!force && videoCache.has(cacheKey)) {
        return videoCache.get(cacheKey)!;
      }

      // Check unavailable cache (unless forced)
      if (!force && unavailableCache.has(cacheKey)) {
        return '';
      }

      // Check if there's already a pending search for this track (unless forced)
      if (!force && pendingSearches.current.has(cacheKey)) {
        return pendingSearches.current.get(cacheKey)!;
      }

       // If we've already hit YouTube quota this session, avoid hammering the backend.
       if (!force && quotaExceededRef.current) {
        return '';
      }

      // Throttle requests
      const now = Date.now();
      const timeSinceLastSearch = now - lastSearchTime.current;
      if (timeSinceLastSearch < MIN_SEARCH_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_SEARCH_INTERVAL - timeSinceLastSearch));
      }
      lastSearchTime.current = Date.now();

      setIsSearching(true);

      // Create the search promise
      const searchPromise = (async () => {
        try {
          const query = `${track.artist} ${track.title}`;

          const { data, error } = await supabase.functions.invoke('youtube-search', {
            body: { 
              query, 
              maxResults,
              artist: track.artist,
              title: track.title,
              refresh: force
            },
          });

          if (error) {
            const status = (error as { context?: { status?: number } })?.context?.status;
            const msg = String(error.message || 'YouTube search failed');
            console.error('YouTube search failed:', msg);

             if (status === 429 || isQuotaError(msg)) {
               markQuotaExceeded();
            }
            // Do NOT cache as unavailable when backend fails (prevents false negatives)
            return '';
          }

          // Some backend failures (like quota exceeded) are returned as 200 with an error payload
          // to avoid surfacing as a hard runtime error.
          if (data?.error === 'quota_exceeded') {
            markQuotaExceeded();
            return '';
          }

          const videos: YouTubeVideo[] = data.videos || [];

          if (videos.length > 0) {
            const videoId = videos[0].videoId;
            videoCache.set(cacheKey, videoId);
            unavailableCache.delete(cacheKey); // Remove from unavailable if it was there
            console.log(`Found YouTube video for "${track.title}": ${videoId}`);
            return videoId;
          }

          // Cache as unavailable
          unavailableCache.add(cacheKey);
          videoCache.set(cacheKey, '');
          return '';
        } catch (error) {
          console.error('YouTube search error:', error);
          return '';
        } finally {
          setIsSearching(false);
          pendingSearches.current.delete(cacheKey);
        }
      })();

      if (!force) {
        pendingSearches.current.set(cacheKey, searchPromise);
      }
      return searchPromise;
    },
    [getCacheKey, isQuotaError, markQuotaExceeded]
  );

  const getSearchUrl = useCallback((track: Track): string => {
    const query = encodeURIComponent(`${track.artist} ${track.title}`);
    return `https://www.youtube.com/results?search_query=${query}`;
  }, []);

  const prefetchVideos = useCallback(async (tracks: Track[]): Promise<Map<string, string>> => {
    const results = new Map<string, string>();
    
    // Search for videos in parallel, but limit concurrency
    const batchSize = 3; // Reduced batch size
    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      const promises = batch.map(async (track) => {
        const videoId = await searchForVideo(track);
        results.set(track.id, videoId);
      });
      await Promise.all(promises);
      
      // Add delay between batches
      if (i + batchSize < tracks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }, [searchForVideo]);

  // Verify and filter tracks - returns tracks that have YouTube videos
  const verifyTracksAvailability = useCallback(async (
    tracks: Track[],
    onProgress?: (verified: number, total: number) => void
  ): Promise<{ available: Track[]; unavailable: Track[] }> => {
    const available: Track[] = [];
    const unavailable: Track[] = [];
    
    const batchSize = 3;
    let verified = 0;

    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (track) => {
          // Check if already known
          const status = isTrackAvailable(track);
          if (status === true) return { track, available: true };
          if (status === false) return { track, available: false };
          
          // Search for video
          const videoId = await searchForVideo(track);
          return { track: { ...track, youtubeId: videoId || undefined }, available: !!videoId };
        })
      );

      for (const result of results) {
        if (result.available) {
          available.push(result.track);
        } else {
          unavailable.push(result.track);
        }
      }

      verified += batch.length;
      onProgress?.(verified, tracks.length);

       // Add delay between batches
       if (i + batchSize < tracks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return { available, unavailable };
  }, [isTrackAvailable, searchForVideo]);

  const markAsUnavailable = useCallback((track: Track) => {
    const cacheKey = getCacheKey(track);
    unavailableCache.add(cacheKey);
    videoCache.set(cacheKey, '');
  }, [getCacheKey]);

  const clearCache = useCallback(() => {
    clearAllCaches();
  }, []);

  return {
    isSearching,
    isQuotaExceeded,
    searchForVideo,
    getSearchUrl,
    prefetchVideos,
    isTrackAvailable,
    verifyTracksAvailability,
    markAsUnavailable,
    clearCache,
  };
}
