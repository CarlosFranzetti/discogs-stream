import { useState, useCallback } from 'react';
import { Track } from '@/types/track';

// YouTube IFrame API for searching videos
// Since we don't have a YouTube API key, we'll use the IFrame search embedding approach
// For production, you'd want to add YouTube Data API key

export function useYouTubeSearch() {
  const [isSearching, setIsSearching] = useState(false);

  const searchForVideo = useCallback(async (track: Track): Promise<string> => {
    // If track already has a youtubeId, return it
    if (track.youtubeId) {
      return track.youtubeId;
    }

    setIsSearching(true);
    
    try {
      // Construct search query
      const searchQuery = `${track.artist} ${track.title} full album`.trim();
      
      // For a proper implementation, you would call YouTube Data API here
      // Since we don't have an API key, we'll use a workaround:
      // Generate a search URL that can be used with YouTube's oembed or
      // rely on the user's YouTube embeds
      
      // For demo purposes, we'll use known video IDs based on common patterns
      // In production, integrate with YouTube Data API v3
      
      // Return empty string - the YouTubePlayer component will need to handle search
      console.log('Searching YouTube for:', searchQuery);
      
      return '';
    } finally {
      setIsSearching(false);
    }
  }, []);

  const getSearchUrl = useCallback((track: Track): string => {
    const query = encodeURIComponent(`${track.artist} ${track.title}`);
    return `https://www.youtube.com/results?search_query=${query}`;
  }, []);

  return {
    isSearching,
    searchForVideo,
    getSearchUrl,
  };
}
