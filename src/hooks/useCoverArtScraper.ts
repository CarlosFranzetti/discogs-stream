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
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          return null;
        }
        return null;
      }

      return data?.cover_url || data?.thumb_url || null;
    } catch {
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
        return 0;
      }

      if (!data || data.length === 0) return 0;

      const coverMap = new Map<number, string>();
      data.forEach(row => {
        const url = row.cover_url || row.thumb_url;
        if (url) coverMap.set(row.release_id, url);
      });

      let updateCount = 0;
      tracks.forEach(track => {
        if (track.discogsReleaseId && coverMap.has(track.discogsReleaseId)) {
          const coverUrl = coverMap.get(track.discogsReleaseId)!;
          onTrackUpdate({ ...track, coverUrl, coverUrls: [coverUrl] });
          updateCount++;
        }
      });

      return updateCount;
    } catch {
      return 0;
    }
  }, []);

  const storeCoverArtInDb = useCallback(async (
    releaseId: number,
    coverUrl: string,
    thumbUrl?: string
  ): Promise<void> => {
    try {
      await supabase
        .from('release_cover_art')
        .upsert({
          release_id: releaseId,
          cover_url: coverUrl,
          thumb_url: thumbUrl,
          updated_at: new Date().toISOString(),
        });
    } catch {
      // Silently fail - caching is optional
    }
  }, []);

  const fetchCoverArt = useCallback(async (releaseId: number): Promise<string | null> => {
    const cachedUrl = await getCoverArtFromDb(releaseId);
    if (cachedUrl) return cachedUrl;

    try {
      const { data, error } = await supabase.functions.invoke('discogs-public', {
        body: { release_id: releaseId },
      });

      if (error) return null;

      const coverUrl = data?.cover_image || data?.thumb;
      if (coverUrl) {
        await storeCoverArtInDb(releaseId, coverUrl, data.thumb);
      }

      return coverUrl || null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return null;
      return null;
    }
  }, [getCoverArtFromDb, storeCoverArtInDb]);

  const scrapeCoverArt = useCallback(
    async (
      tracks: Track[],
      onTrackUpdate: (track: Track) => void,
      startFromFirst: boolean = true
    ) => {
      if (isScrapingRef.current) return;

      const tracksToScrape = tracks.filter(
        (t) => t.discogsReleaseId && (!t.coverUrl || t.coverUrl === '/placeholder.svg')
      );

      if (tracksToScrape.length === 0) return;

      isScrapingRef.current = true;
      setIsScraping(true);
      abortControllerRef.current = new AbortController();

      setProgress({ completed: 0, total: tracksToScrape.length, currentTrack: null });

      let successCount = 0;

      if (startFromFirst && tracksToScrape.length > 0) {
        const firstTrack = tracksToScrape[0];
        setProgress((prev) => ({ ...prev, currentTrack: firstTrack.title }));

        const coverUrl = await fetchCoverArt(firstTrack.discogsReleaseId!);
        if (coverUrl) {
          onTrackUpdate({ ...firstTrack, coverUrl, coverUrls: [coverUrl] });
          successCount++;
        }

        setProgress((prev) => ({ ...prev, completed: 1, currentTrack: null }));
      }

      const startIndex = startFromFirst ? 1 : 0;
      for (let i = startIndex; i < tracksToScrape.length; i++) {
        if (!isScrapingRef.current) break;

        const track = tracksToScrape[i];
        setProgress((prev) => ({ ...prev, currentTrack: track.title }));

        const coverUrl = await fetchCoverArt(track.discogsReleaseId!);
        if (coverUrl) {
          onTrackUpdate({ ...track, coverUrl, coverUrls: [coverUrl] });
          successCount++;
        }

        setProgress((prev) => ({ ...prev, completed: i + 1, currentTrack: null }));

        if (i < tracksToScrape.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      isScrapingRef.current = false;
      setIsScraping(false);
    },
    [fetchCoverArt]
  );

  const stopScraping = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isScrapingRef.current = false;
    setIsScraping(false);
    setProgress({ completed: 0, total: 0, currentTrack: null });
  }, []);

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
