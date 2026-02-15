import { useState, useCallback, useRef, useEffect } from 'react';
import { Track } from '@/types/track';
import { supabase } from '@/integrations/supabase/client';

interface ScrapeProgress {
  completed: number;
  total: number;
  currentTrack: string | null;
}

export function useCoverArtScraper() {
  const [isScraping, setIsScraping] = useState(false);
  const [progress, setProgress] = useState<ScrapeProgress>({
    completed: 0,
    total: 0,
    currentTrack: null,
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const isScrapingRef = useRef(false);

  const getCoverArtFromDb = useCallback(async (releaseId: number): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('release_cover_art')
        .select('cover_url, thumb_url')
        .eq('release_id', releaseId)
        .maybeSingle();

      if (error) {
        // Silently ignore table not found errors - means migration not applied yet
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          return null;
        }
        console.warn(`Error fetching cover art from DB for release ${releaseId}:`, error.message);
        return null;
      }

      return data?.cover_url || data?.thumb_url || null;
    } catch (error) {
      console.warn(`Error querying cover art DB for release ${releaseId}`);
      return null;
    }
  }, []);

  const batchLoadCoverArtFromDb = useCallback(async (
    tracks: Track[],
    onTrackUpdate: (track: Track) => void
  ): Promise<number> => {
    const releaseIds = tracks
      .filter(t => t.discogsReleaseId && (!t.coverUrl || t.coverUrl === '/placeholder.svg'))
      .map(t => t.discogsReleaseId!);

    if (releaseIds.length === 0) return 0;

    try {
      const { data, error } = await supabase
        .from('release_cover_art')
        .select('release_id, cover_url, thumb_url')
        .in('release_id', releaseIds);

      if (error) {
        // Silently ignore table not found errors
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          console.log('Cover art cache table not found - will scrape from Discogs');
          return 0;
        }
        console.warn('Error batch fetching cover art from DB:', error.message);
        return 0;
      }

      if (!data || data.length === 0) {
        console.log('No cached cover art found in database');
        return 0;
      }

      // Create a map of release_id -> cover_url
      const coverMap = new Map<number, string>();
      data.forEach(row => {
        const url = row.cover_url || row.thumb_url;
        if (url) {
          coverMap.set(row.release_id, url);
        }
      });

      // Update tracks that have cover art in DB
      let updateCount = 0;
      tracks.forEach(track => {
        if (track.discogsReleaseId && coverMap.has(track.discogsReleaseId)) {
          const coverUrl = coverMap.get(track.discogsReleaseId)!;
          onTrackUpdate({ ...track, coverUrl });
          updateCount++;
        }
      });

      if (updateCount > 0) {
        console.log(`Loaded ${updateCount} cover arts from database`);
      }
      return updateCount;
    } catch (error) {
      console.warn('Error batch loading cover art');
      return 0;
    }
  }, []);

  const storeCoverArtInDb = useCallback(async (
    releaseId: number,
    coverUrl: string,
    thumbUrl?: string
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('release_cover_art')
        .upsert({
          release_id: releaseId,
          cover_url: coverUrl,
          thumb_url: thumbUrl,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        // Silently ignore table not found errors
        if (error.code !== 'PGRST205' && !error.message?.includes('does not exist')) {
          console.warn(`Error storing cover art in DB for release ${releaseId}:`, error.message);
        }
      }
    } catch (error) {
      // Silently fail - caching is optional
    }
  }, []);

  const fetchCoverArt = useCallback(async (releaseId: number): Promise<string | null> => {
    // First, check if we have it in the database
    const cachedUrl = await getCoverArtFromDb(releaseId);
    if (cachedUrl) {
      console.log(`Cover art found in DB for release ${releaseId}`);
      return cachedUrl;
    }

    // If not in DB, fetch from Discogs API using Supabase client for auth
    try {
      const { data, error } = await supabase.functions.invoke('discogs-public', {
        body: { release_id: releaseId },
      });

      if (error) {
        console.warn(`Failed to fetch cover art for release ${releaseId}:`, error.message);
        return null;
      }

      const coverUrl = data?.cover_image || data?.thumb;

      if (coverUrl) {
        // Store in database for future use
        await storeCoverArtInDb(releaseId, coverUrl, data.thumb);
        console.log(`Cover art fetched and stored for release ${releaseId}`);
      }

      return coverUrl || null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      console.error(`Error fetching cover art for release ${releaseId}:`, error);
      return null;
    }
  }, [getCoverArtFromDb, storeCoverArtInDb]);

  const scrapeCoverArt = useCallback(
    async (
      tracks: Track[],
      onTrackUpdate: (track: Track) => void,
      startFromFirst: boolean = true
    ) => {
      if (isScrapingRef.current) {
        console.log('Scraping already in progress');
        return;
      }

      const tracksToScrape = tracks.filter(
        (t) => t.discogsReleaseId && (!t.coverUrl || t.coverUrl === '/placeholder.svg')
      );

      if (tracksToScrape.length === 0) {
        console.log('No tracks need cover art scraping');
        return;
      }

      isScrapingRef.current = true;
      setIsScraping(true);
      abortControllerRef.current = new AbortController();

      setProgress({
        completed: 0,
        total: tracksToScrape.length,
        currentTrack: null,
      });

      console.log(`Starting cover art scraping for ${tracksToScrape.length} tracks`);
      let successCount = 0;

      // Process first track immediately if requested
      if (startFromFirst && tracksToScrape.length > 0) {
        const firstTrack = tracksToScrape[0];
        setProgress((prev) => ({
          ...prev,
          currentTrack: firstTrack.title,
        }));

        const coverUrl = await fetchCoverArt(firstTrack.discogsReleaseId!);
        if (coverUrl) {
          onTrackUpdate({ ...firstTrack, coverUrl });
          successCount++;
        }

        setProgress((prev) => ({
          ...prev,
          completed: 1,
          currentTrack: null,
        }));
      }

      // Process remaining tracks in background with rate limiting
      const startIndex = startFromFirst ? 1 : 0;
      for (let i = startIndex; i < tracksToScrape.length; i++) {
        if (!isScrapingRef.current) {
          console.log('Scraping aborted');
          break;
        }

        const track = tracksToScrape[i];
        setProgress((prev) => ({
          ...prev,
          currentTrack: track.title,
        }));

        const coverUrl = await fetchCoverArt(track.discogsReleaseId!);
        if (coverUrl) {
          onTrackUpdate({ ...track, coverUrl });
          successCount++;
        }

        setProgress((prev) => ({
          ...prev,
          completed: i + 1,
          currentTrack: null,
        }));

        // Rate limiting: wait 1 second between requests to avoid hitting Discogs rate limits
        if (i < tracksToScrape.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      isScrapingRef.current = false;
      setIsScraping(false);

      console.log(`Cover art scraping completed: ${successCount}/${tracksToScrape.length} covers found`);
    },
    [fetchCoverArt]
  );

  const stopScraping = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isScrapingRef.current = false;
    setIsScraping(false);
    setProgress({
      completed: 0,
      total: 0,
      currentTrack: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    isScraping,
    progress,
    scrapeCoverArt,
    batchLoadCoverArtFromDb,
    stopScraping,
  };
}
