import { useState, useCallback, useEffect, useRef } from 'react';
import { Track } from '@/types/track';
import { mockTracks, shuffleTracks } from '@/data/mockTracks';

export function usePlayer(initialTracks?: Track[], dislikedTracks?: Track[]) {
  const [playlist, setPlaylist] = useState<Track[]>(() => {
    if (initialTracks && initialTracks.length > 0) {
      return shuffleTracks(initialTracks);
    }
    return shuffleTracks(mockTracks);
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<number | null>(null);

  const [isShuffle, setIsShuffle] = useState(true);

  const currentTrack = playlist[currentIndex];

  // Helper to filter disliked tracks
  const filterDisliked = useCallback((tracks: Track[]) => {
    if (!dislikedTracks || dislikedTracks.length === 0) return tracks;
    const dislikedIds = new Set(dislikedTracks.map(t => t.id));
    return tracks.filter(t => !dislikedIds.has(t.id));
  }, [dislikedTracks]);

  // Update playlist when initialTracks changes
  useEffect(() => {
    if (!initialTracks || initialTracks.length === 0) return;

    const filtered = filterDisliked(initialTracks);
    
    setPlaylist(prev => {
      if (prev.length === 0) {
        return isShuffle ? shuffleTracks(filtered) : filtered;
      }

      // Update existing tracks with new metadata (e.g. coverUrl, youtubeId)
      // while preserving the current playlist order.
      const initialMap = new Map(filtered.map(t => [t.id, t]));
      const updatedPlaylist = prev.map(t => {
        const updated = initialMap.get(t.id);
        return updated ? updated : t;
      });

      // Identify entirely new tracks to append
      const prevIds = new Set(prev.map(t => t.id));
      const newTracks = filtered.filter(t => !prevIds.has(t.id));
      
      // If no new tracks and no changes to existing ones (deep equality check too expensive, just reference check?)
      // Actually, since we created new objects in updatedPlaylist, strictly speaking it's always "new" array if mapped.
      // But if we want to avoid unnecessary re-renders or logic:
      // We can rely on React's state update.
      
      if (newTracks.length === 0) {
        // Handle removals (dislikes)
        const currentIds = new Set(filtered.map(t => t.id));
        const finalPlaylist = updatedPlaylist.filter(t => currentIds.has(t.id));
        return finalPlaylist;
      }

      // Append new tracks
      if (isShuffle) {
        return [...updatedPlaylist, ...shuffleTracks(newTracks)];
      } else {
        // If sequential, just return the filtered list which is already sorted
        return filtered; 
      }
    });
  }, [initialTracks, dislikedTracks, isShuffle, filterDisliked]);

  // Adjust currentIndex if the current track moves
  // This is tricky because `setPlaylist` is async. 
  // We can trust that if we swap the playlist, we should find the current track ID.
  const prevCurrentTrackIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentTrack) {
      prevCurrentTrackIdRef.current = currentTrack.id;
    }
  }, [currentTrack]);

  // When playlist changes, try to keep the same track playing
  useEffect(() => {
    const id = prevCurrentTrackIdRef.current;
    if (!id || playlist.length === 0) return;

    // Only update index if the track at current index is NOT the same as before
    // (Meaning the playlist shifted)
    if (playlist[currentIndex]?.id !== id) {
      const newIndex = playlist.findIndex(t => t.id === id);
      if (newIndex !== -1) {
        setCurrentIndex(newIndex);
      } else {
        // Track removed? Go to 0 or nearest?
        setCurrentIndex(0);
      }
    }
  }, [playlist]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle(prev => {
      const nextState = !prev;
      
      if (nextState) {
        // Turning ON shuffle
        // Shuffle the existing playlist
        setPlaylist(currentList => {
           const shuffled = shuffleTracks([...currentList]);
           // Move current track to front? Or just find it? 
           // Let's just shuffle and let the index-fixer effect handle it?
           // No, index-fixer runs on playlist change.
           // Better to explicitly set it here to be safe.
           return shuffled;
        });
      } else {
        // Turning OFF shuffle
        // Revert to original order (filtered initialTracks)
        if (initialTracks) {
           setPlaylist(filterDisliked(initialTracks));
        }
      }
      return nextState;
    });
  }, [initialTracks, filterDisliked]);

  const updateTime = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      const time = playerRef.current.getCurrentTime();
      setCurrentTime(time);
    }
  }, []);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(updateTime, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, updateTime]);

  const play = useCallback(() => {
    playerRef.current?.playVideo();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const skipNext = useCallback(() => {
    setCurrentTime(0);
    setCurrentIndex((prev) => (prev + 1) % playlist.length);
    setIsPlaying(true);
  }, [playlist.length]);

  const skipPrev = useCallback(() => {
    setCurrentTime(0);
    setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    setIsPlaying(true);
  }, [playlist.length]);

  const seekTo = useCallback((time: number) => {
    playerRef.current?.seekTo(time, true);
    setCurrentTime(time);
  }, []);

  const skipForward = useCallback((seconds: number = 5) => {
    const newTime = Math.min(currentTime + seconds, currentTrack?.duration || 0);
    seekTo(newTime);
  }, [currentTime, currentTrack, seekTo]);

  const skipBackward = useCallback((seconds: number = 5) => {
    const newTime = Math.max(currentTime - seconds, 0);
    seekTo(newTime);
  }, [currentTime, seekTo]);

  const removeFromPlaylist = useCallback((trackId: string) => {
    setPlaylist((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

  const selectTrack = useCallback((index: number) => {
    setCurrentTime(0);
    setCurrentIndex(index);
    setIsPlaying(true);
  }, []);

  const toggleVideo = useCallback(() => {
    setShowVideo((prev) => !prev);
  }, []);

  return {
    playlist,
    currentTrack,
    currentIndex,
    isPlaying,
    currentTime,
    showVideo,
    playerRef,
    play,
    pause,
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
    skipForward,
    skipBackward,
    selectTrack,
    toggleVideo,
    setCurrentTime,
    setIsPlaying,
    setPlaylist,
    removeFromPlaylist,
    isShuffle,
    toggleShuffle,
  };
}
