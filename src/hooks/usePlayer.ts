import { useState, useCallback, useEffect, useRef } from 'react';
import { Track } from '@/types/track';
import { mockTracks, shuffleTracks } from '@/data/mockTracks';

function sortSequential(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => {
    const artistCmp = a.artist.localeCompare(b.artist);
    if (artistCmp !== 0) return artistCmp;
    const albumCmp = (a.album || '').localeCompare(b.album || '');
    if (albumCmp !== 0) return albumCmp;
    const yearCmp = (a.year || 0) - (b.year || 0);
    if (yearCmp !== 0) return yearCmp;
    const posA = a.discogsTrackPosition || '';
    const posB = b.discogsTrackPosition || '';
    if (posA && posB) return posA.localeCompare(posB, undefined, { numeric: true });
    return a.title.localeCompare(b.title);
  });
}

export function usePlayer(initialTracks?: Track[], dislikedTracks?: Track[]) {
  // Track if we're using demo/mock data
  const [isUsingMockData, setIsUsingMockData] = useState(() => !initialTracks || initialTracks.length === 0);
  
  const [playlist, setPlaylist] = useState<Track[]>(() => {
    if (initialTracks && initialTracks.length > 0) {
      return sortSequential(initialTracks);
    }
    return sortSequential(mockTracks);
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<number | null>(null);

  const [isShuffle, setIsShuffle] = useState(false);

  const currentTrack = playlist[currentIndex];

  // Helper to filter disliked tracks
  const filterDisliked = useCallback((tracks: Track[]) => {
    if (!dislikedTracks || dislikedTracks.length === 0) return tracks;
    const dislikedIds = new Set(dislikedTracks.map(t => t.id));
    return tracks.filter(t => !dislikedIds.has(t.id));
  }, [dislikedTracks]);

  // Update playlist when initialTracks changes
  useEffect(() => {
    if (!initialTracks || initialTracks.length === 0) {
      setPlaylist([]);
      setCurrentIndex(0);
      setCurrentTime(0);
      setIsPlaying(false);
      setIsUsingMockData(false);
      return;
    }

    const filtered = filterDisliked(initialTracks);

    setPlaylist(prev => {
      if (isUsingMockData && filtered.length > 0) {
        setIsUsingMockData(false);
        setCurrentIndex(0);
        return isShuffle ? shuffleTracks(filtered) : sortSequential(filtered);
      }

      if (prev.length === 0) {
        setIsUsingMockData(false);
        return isShuffle ? shuffleTracks(filtered) : sortSequential(filtered);
      }

      const initialMap = new Map(filtered.map(t => [t.id, t]));
      const updatedPlaylist = prev.map(t => {
        const updated = initialMap.get(t.id);
        return updated ? updated : t;
      });

      const prevIds = new Set(prev.map(t => t.id));
      const newTracks = filtered.filter(t => !prevIds.has(t.id));

      const filteredIds = new Set(filtered.map(t => t.id));
      const cleanedPlaylist = updatedPlaylist.filter(t => filteredIds.has(t.id));

      if (newTracks.length === 0) {
        const removedCount = prev.length - cleanedPlaylist.length;
        if (removedCount > 0) return cleanedPlaylist;
        return updatedPlaylist;
      }

      if (isShuffle) {
        return [...cleanedPlaylist, ...shuffleTracks(newTracks)];
      } else {
        return sortSequential(filtered);
      }
    });
  }, [initialTracks, dislikedTracks, isShuffle, filterDisliked, isUsingMockData]);

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

  useEffect(() => {
    if (playlist.length === 0) {
      if (currentIndex !== 0) setCurrentIndex(0);
      return;
    }
    if (currentIndex >= playlist.length) setCurrentIndex(0);
  }, [playlist.length, currentIndex]);

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
        // Turning OFF shuffle — restore artist/album sequential order
        if (initialTracks) {
           setPlaylist(sortSequential(filterDisliked(initialTracks)));
        }
      }
      return nextState;
    });
  }, [initialTracks, filterDisliked]);

  // Reset playerDuration when the track changes
  useEffect(() => {
    setPlayerDuration(0);
  }, [currentIndex]);

  const updateTime = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      const time = playerRef.current.getCurrentTime();
      setCurrentTime(time);
      if (typeof playerRef.current.getDuration === 'function') {
        const dur = playerRef.current.getDuration();
        if (dur > 0) setPlayerDuration(dur);
      }
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
    if (playlist.length === 0) return;
    setCurrentTime(0);
    setCurrentIndex((prev) => (prev + 1) % playlist.length);
    setTimeout(() => {
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo();
      }
      setIsPlaying(true);
    }, 100);
  }, [playlist.length]);

  const skipPrev = useCallback(() => {
    if (playlist.length === 0) return;
    setCurrentTime(0);
    setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    setTimeout(() => {
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo();
      }
      setIsPlaying(true);
    }, 100);
  }, [playlist.length]);

  const skipNextRelease = useCallback(() => {
    if (playlist.length === 0) return;
    const currentReleaseId = playlist[currentIndex]?.discogsReleaseId;
    const nextIdx = currentReleaseId
      ? playlist.findIndex((t, i) => i > currentIndex && t.discogsReleaseId !== currentReleaseId)
      : -1;
    if (nextIdx === -1) return;
    setCurrentTime(0);
    setCurrentIndex(nextIdx);
    setTimeout(() => {
      playerRef.current?.playVideo();
      setIsPlaying(true);
    }, 100);
  }, [playlist, currentIndex]);

  const skipPrevRelease = useCallback(() => {
    if (playlist.length === 0 || currentIndex === 0) return;
    const currentReleaseId = playlist[currentIndex]?.discogsReleaseId;
    let i = currentIndex - 1;
    while (i >= 0 && playlist[i].discogsReleaseId === currentReleaseId) i--;
    if (i < 0) return;
    const prevReleaseId = playlist[i].discogsReleaseId;
    const firstOfPrev = prevReleaseId
      ? playlist.findIndex(t => t.discogsReleaseId === prevReleaseId)
      : i;
    setCurrentTime(0);
    setCurrentIndex(firstOfPrev !== -1 ? firstOfPrev : i);
    setTimeout(() => {
      playerRef.current?.playVideo();
      setIsPlaying(true);
    }, 100);
  }, [playlist, currentIndex]);

  const seekTo = useCallback((time: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(time, true);
      setCurrentTime(time);
      // Resume playback after seek (works even during buffering state)
      setTimeout(() => {
        playerRef.current?.playVideo();
        setIsPlaying(true);
      }, 150);
    }
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
    if (index < 0 || index >= playlist.length) return;
    setCurrentTime(0);
    setCurrentIndex(index);
    // Force playback to start immediately
    setTimeout(() => {
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo();
      }
      setIsPlaying(true);
    }, 100);
  }, [playlist.length]);

  const toggleVideo = useCallback(() => {
    setShowVideo((prev) => !prev);
  }, []);

  return {
    playlist,
    currentTrack,
    currentIndex,
    isPlaying,
    currentTime,
    playerDuration,
    showVideo,
    playerRef,
    play,
    pause,
    togglePlay,
    skipNext,
    skipPrev,
    skipNextRelease,
    skipPrevRelease,
    seekTo,
    skipForward,
    skipBackward,
    selectTrack,
    toggleVideo,
    setCurrentIndex,
    setCurrentTime,
    setIsPlaying,
    setPlaylist,
    removeFromPlaylist,
    isShuffle,
    toggleShuffle,
  };
}
