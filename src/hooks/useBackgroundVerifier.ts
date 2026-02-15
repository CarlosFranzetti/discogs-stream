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
  isQuotaExceeded: boolean;
}

export function useBackgroundVerifier({
  tracks,
  currentTrack,
  isPlaying: _isPlaying,
  searchForVideo,
  resolveMediaForTrack,
  updateTrack,
  isQuotaExceeded
}: UseBackgroundVerifierProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [progress, setProgress] = useState({ verified: 0, total: 0 });
  const verifiedIds = useRef<Set<string>>(new Set());
  const processingRef = useRef(false);

  // Queue management:
  // Priority 1: Current Track
  // Priority 2: Next 3 Tracks
  // Priority 3: Rest of the list
  const getNextTrackToVerify = useCallback(() => {
    if (tracks.length === 0) return null;

    // 1. Current Track (if not verified)
    if (currentTrack && !verifiedIds.current.has(currentTrack.id)) {
       // Check if it really needs verification (missing youtubeId or coverUrl)
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

    // 3. Scan list for any unverified
    // Start from current index + 4 to avoid re-checking immediate neighbors
    for (let i = 0; i < tracks.length; i++) {
       const idx = (currentIndex + 4 + i) % tracks.length;
       const track = tracks[idx];
       if (track && !verifiedIds.current.has(track.id)) {
         if (!track.youtubeId || !track.coverUrl || track.coverUrl.includes('placeholder')) {
           return track;
         }
         verifiedIds.current.add(track.id);
       }
    }

    return null;
  }, [tracks, currentTrack]);

  useEffect(() => {
    // Don't stop entirely when quota exceeded - we can still use free methods
    
    // Reset verified set if tracks change significantly (length check is a simple proxy)
    if (Math.abs(tracks.length - verifiedIds.current.size) > tracks.length) {
       // Don't clear fully, just trust existing IDs if they are in the new list?
       // For now, simpler to just keep going.
    }
    
    // Initialize progress
    setProgress(prev => ({ ...prev, total: tracks.length }));

    const processNext = async () => {
      if (processingRef.current) return;

      const track = getNextTrackToVerify();
      if (!track) {
        setIsVerifying(false);
        return;
      }

      setIsVerifying(true);
      processingRef.current = true;

      try {
        console.log(`[Verifier] Processing: ${track.artist} - ${track.title}`);
        
        // Clone the track to avoid mutating the original
        const updatedTrack = { ...track };
        let changed = false;
        let videoId = updatedTrack.youtubeId || '';

        // 1. Try cheap resolution first (Discogs metadata / Cache)
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

        // 2. Fallback to expensive search (only if quota allows)
        if (!videoId && !isQuotaExceeded) {
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

        // 4. Persist if changed
        if (changed) {
           updateTrack(updatedTrack);
        }
        
        verifiedIds.current.add(track.id);
        setProgress(prev => ({ ...prev, verified: prev.verified + 1 }));

      } catch (error) {
        console.error('[Verifier] Error:', error);
      } finally {
        processingRef.current = false;
        // Schedule next check
        // If playing, go faster? Or slower?
        // User said: "start background scraping... while music plays"
        // We'll keep a steady pace. 2 seconds delay.
        setTimeout(processNext, 2000);
      }
    };

    // Start the loop
    const intervalId = setInterval(() => {
       if (!processingRef.current) {
         processNext();
       }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [tracks, getNextTrackToVerify, searchForVideo, resolveMediaForTrack, updateTrack, isQuotaExceeded]);

  return { isVerifying, progress };
}
