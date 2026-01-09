import { useState, useCallback, useRef } from 'react';
import { Track } from '@/types/track';

interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

// Cache for YouTube video IDs to avoid repeated API calls
const videoCache = new Map<string, string>();

export function useYouTubeSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const pendingSearches = useRef<Map<string, Promise<string>>>(new Map());

  const searchForVideo = useCallback(async (track: Track): Promise<string> => {
    // If track already has a youtubeId, return it
    if (track.youtubeId) {
      return track.youtubeId;
    }

    // Create a cache key from artist + title
    const cacheKey = `${track.artist}-${track.title}`.toLowerCase();
    
    // Check cache first
    if (videoCache.has(cacheKey)) {
      return videoCache.get(cacheKey)!;
    }

    // Check if there's already a pending search for this track
    if (pendingSearches.current.has(cacheKey)) {
      return pendingSearches.current.get(cacheKey)!;
    }

    setIsSearching(true);
    
    // Create the search promise
    const searchPromise = (async () => {
      try {
        const query = `${track.artist} ${track.title}`;
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-search`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, maxResults: 1 }),
          }
        );

        if (!response.ok) {
          console.error('YouTube search failed:', await response.text());
          return '';
        }

        const data = await response.json();
        const videos: YouTubeVideo[] = data.videos || [];
        
        if (videos.length > 0) {
          const videoId = videos[0].videoId;
          videoCache.set(cacheKey, videoId);
          console.log(`Found YouTube video for "${track.title}": ${videoId}`);
          return videoId;
        }
        
        // Cache empty result to avoid repeated failed searches
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

    pendingSearches.current.set(cacheKey, searchPromise);
    return searchPromise;
  }, []);

  const getSearchUrl = useCallback((track: Track): string => {
    const query = encodeURIComponent(`${track.artist} ${track.title}`);
    return `https://www.youtube.com/results?search_query=${query}`;
  }, []);

  const prefetchVideos = useCallback(async (tracks: Track[]): Promise<Map<string, string>> => {
    const results = new Map<string, string>();
    
    // Search for videos in parallel, but limit concurrency
    const batchSize = 5;
    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      const promises = batch.map(async (track) => {
        const videoId = await searchForVideo(track);
        if (videoId) {
          results.set(track.id, videoId);
        }
      });
      await Promise.all(promises);
    }
    
    return results;
  }, [searchForVideo]);

  return {
    isSearching,
    searchForVideo,
    getSearchUrl,
    prefetchVideos,
  };
}
