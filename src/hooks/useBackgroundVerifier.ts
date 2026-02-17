import { useEffect, useRef, useState, useCallback } from 'react';
import { Track } from '@/types/track';

interface UseBackgroundVerifierProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  searchForVideo: (track: Track, options?: { force?: boolean; maxResults?: number }) => Promise<string>;
  resolveMediaForTrack?: (track: Track) => Promise<{
    provider: 'youtube' | 'bandcamp' | null;
    youtubeId?: string;
    youtubeCandidates?: string[];
    bandcampEmbedSrc?: string;
    coverUrl?: string;
    coverUrls?: string[];
  }>;
  updateTrack: (track: Track) => void;
}

export function useBackgroundVerifier({
  tracks,
  currentTrack,
  isPlaying: _isPlaying,
  searchForVideo,
  resolveMediaForTrack,
  updateTrack,
}: UseBackgroundVerifierProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [progress, setProgress] = useState({ verified: 0, total: 0 });
  const verifiedIds = useRef<Set<string>>(new Set());
  const processingRef = useRef(false);
  const processNextRef = useRef<(() => Promise<void>) | null>(null);

  // Queue management:
  // Priority 1: Current Track
  // Priority 2: Next 3 Tracks
  // Priority 3: Pending tracks (not yet resolved)
  // Priority 4: non_working tracks (retry transient failures)
  const getNextTrackToVerify = useCallback(() => {
    if (tracks.length === 0) return null;

    // 1. Current Track (if not verified)
    if (currentTrack && !verifiedIds.current.has(currentTrack.id)) {
      if (!currentTrack.youtubeId || !currentTrack.coverUrl || currentTrack.coverUrl.includes('placeholder')) {
        return currentTrack;
      }
      verifiedIds.current.add(currentTrack.id);
    }

    const currentIndex = currentTrack ? tracks.findIndex(t => t.id === currentTrack.id) : 0;

    // 2. Next 3 Tracks
    for (let i = 1; i <= 3; i++) {
      const nextIndex = (currentIndex + i) % tracks.length;
      const track = tracks[nextIndex];
      if (track && !verifiedIds.current.has(track.id)) {
        if (!track.youtubeId || !track.coverUrl || track.coverUrl.includes('placeholder')) {
          return track;
        }
        verifiedIds.current.add(track.id);
      }
    }

    // 3. Scan list for pending tracks (skip non_working for now)
    for (let i = 0; i < tracks.length; i++) {
      const idx = (currentIndex + 4 + i) % tracks.length;
      const track = tracks[idx];
      if (track && !verifiedIds.current.has(track.id) && track.workingStatus !== 'non_working') {
        if (!track.youtubeId || !track.coverUrl || track.coverUrl.includes('placeholder')) {
          return track;
        }
        verifiedIds.current.add(track.id);
      }
    }

    // 4. Retry non_working tracks (cleared from verifiedIds at cycle end)
    for (let i = 0; i < tracks.length; i++) {
      const idx = (currentIndex + 4 + i) % tracks.length;
      const track = tracks[idx];
      if (track && !verifiedIds.current.has(track.id) && track.workingStatus === 'non_working') {
        return track;
      }
    }

    return null;
  }, [tracks, currentTrack]);

  useEffect(() => {
    setProgress(prev => ({ ...prev, total: tracks.length }));

    const processNext = async () => {
      if (processingRef.current) return;

      const track = getNextTrackToVerify();
      if (!track) {
        setIsVerifying(false);
        // Clear non_working tracks from verifiedIds so they get retried next cycle
        const nonWorkingIds = new Set(
          tracks.filter(t => t.workingStatus === 'non_working').map(t => t.id)
        );
        nonWorkingIds.forEach(id => verifiedIds.current.delete(id));
        return;
      }

      setIsVerifying(true);
      processingRef.current = true;

      try {
        console.log(`[Verifier] Processing: ${track.artist} - ${track.title}`);

        const updatedTrack = { ...track };
        let changed = false;
        let videoId = updatedTrack.youtubeId || '';

        // 1. Try cheap resolution first (Discogs metadata / DB Cache)
        if (resolveMediaForTrack) {
          const media = await resolveMediaForTrack(track);
          if (media.provider === 'youtube' && media.youtubeId) {
            videoId = media.youtubeId;
            console.log(`[Verifier] Resolved via Discogs/Cache: ${videoId}`);
            if (media.youtubeCandidates?.length) {
              updatedTrack.youtubeCandidates = media.youtubeCandidates;
              changed = true;
            }
          }

          if (media.coverUrl && (!updatedTrack.coverUrl || updatedTrack.coverUrl === '/placeholder.svg' || updatedTrack.coverUrl.includes('placeholder'))) {
            updatedTrack.coverUrl = media.coverUrl;
            changed = true;
          }
          if (media.coverUrls?.length) {
            updatedTrack.coverUrls = media.coverUrls;
            changed = true;
          }
        }

        // 2. Fallback to YouTube search chain: yt-dlp → Invidious → Official API
        // No quota guard here — the edge function handles quota internally and
        // always tries yt-dlp and Invidious first regardless of API quota status.
        if (!videoId) {
          videoId = await searchForVideo(track);
        }

        if (videoId) {
          if (updatedTrack.youtubeId !== videoId) {
            updatedTrack.youtubeId = videoId;
            changed = true;
          }
          if (updatedTrack.workingStatus !== 'working') {
            updatedTrack.workingStatus = 'working';
            changed = true;
          }
        } else if (updatedTrack.workingStatus !== 'non_working') {
          updatedTrack.workingStatus = 'non_working';
          changed = true;
        }

        if (changed) {
          updateTrack(updatedTrack);
        }

        verifiedIds.current.add(track.id);
        setProgress(prev => ({ ...prev, verified: prev.verified + 1 }));

      } catch (error) {
        console.error('[Verifier] Error:', error);
      } finally {
        processingRef.current = false;
        // Reduced delay — slow searches self-throttle via their own timeouts
        setTimeout(processNext, 500);
      }
    };

    // Store in ref so triggerImmediate can call it
    processNextRef.current = processNext;

    // Polling interval — processNext also self-schedules via setTimeout
    const intervalId = setInterval(() => {
      if (!processingRef.current) {
        processNext();
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [tracks, getNextTrackToVerify, searchForVideo, resolveMediaForTrack, updateTrack]);

  // Allows callers to force immediate processing (e.g. right after a CSV import)
  const triggerImmediate = useCallback(() => {
    if (processNextRef.current && !processingRef.current) {
      processNextRef.current();
    }
  }, []);

  return { isVerifying, progress, triggerImmediate };
}
