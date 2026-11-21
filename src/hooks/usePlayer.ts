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

export interface UsePlayerOptions {
  /**
   * Non-null while `initialTracks` is a hand-ordered set (a user playlist);
   * the value identifies which one. In an ordered context "shuffle off" means
   * the order the tracks were given in, not the artist/album sort, and
   * entering one starts at its first track with shuffle off. Leaving restores
   * the shuffle setting the listener had before.
   */
  orderedContextKey?: string | null;
}

export interface ContextStart {
  /** Start shuffled instead of in the given order. */
  shuffle?: boolean;
  /** Start on this track instead of the first one. */
  startTrackId?: string;
}

export function usePlayer(
  initialTracks?: Track[],
  dislikedTracks?: Track[],
  options: UsePlayerOptions = {},
) {
  const orderedContextKey = options.orderedContextKey ?? null;
  const isOrdered = orderedContextKey !== null;

  // Track if we're using demo/mock data
  const [isUsingMockData, setIsUsingMockData] = useState(() => !initialTracks || initialTracks.length === 0);
  
  // Shuffle is the default listening mode: the initial playlist is shuffled,
  // so index 0 is a different random track on every app load. Toggling shuffle
  // OFF restores the sorted sequential order.
  const [playlist, setPlaylist] = useState<Track[]>(() => {
    if (initialTracks && initialTracks.length > 0) {
      return shuffleTracks(initialTracks);
    }
    return shuffleTracks(mockTracks);
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<number | null>(null);
  const contextKeyRef = useRef<string | null>(orderedContextKey);
  const shuffleBeforeContextRef = useRef<boolean | null>(null);
  const pendingStartRef = useRef<({ key: string } & ContextStart) | null>(null);

  const [isShuffle, setIsShuffle] = useState(true);

  // Keep the same TRACK current when the playlist is reordered, re-sorted or
  // trimmed. This is done during render (React's "adjust state when a prop
  // changes" pattern) rather than in an effect, so no render ever commits
  // with the index pointing at the wrong track — an effect would let one
  // through, and the player would start loading the wrong video before the
  // correction landed.
  //
  // The anchor is whatever sat at the current index in the previous playlist.
  // When the index moved in the same batch (dislike = remove + skip), that is
  // the track the caller meant to land on, which is the right thing to follow.
  const [prevPlaylist, setPrevPlaylist] = useState(playlist);
  // An explicit start position for one exact playlist array (entering a user
  // playlist, "Play in order", tapping a row in the editor). It wins over the
  // anchor: the listener asked for a specific track.
  const [startAt, setStartAt] = useState<{ playlist: Track[]; index: number } | null>(null);
  if (prevPlaylist !== playlist) {
    setPrevPlaylist(playlist);
    if (startAt && startAt.playlist === playlist) {
      setStartAt(null);
      if (currentIndex !== startAt.index) setCurrentIndex(startAt.index);
    } else {
      const anchorId = prevPlaylist[currentIndex]?.id;
      if (anchorId && playlist[currentIndex]?.id !== anchorId) {
        const found = playlist.findIndex((t) => t.id === anchorId);
        // Not found means the current track was removed: keep the index so
        // the track that followed it slides into place (clamped below).
        if (found !== -1) setCurrentIndex(found);
      }
    }
  }

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

    // Entering, leaving or switching an ordered context (a user playlist).
    if (contextKeyRef.current !== orderedContextKey) {
      const wasOrdered = contextKeyRef.current !== null;
      contextKeyRef.current = orderedContextKey;
      const pending = pendingStartRef.current;
      pendingStartRef.current = null;
      const start = pending && pending.key === orderedContextKey ? pending : null;
      let shuffle = isShuffle;
      if (isOrdered) {
        if (!wasOrdered) shuffleBeforeContextRef.current = isShuffle;
        shuffle = !!start?.shuffle;
      } else if (shuffleBeforeContextRef.current !== null) {
        shuffle = shuffleBeforeContextRef.current;
        shuffleBeforeContextRef.current = null;
      }
      const next = shuffle
        ? shuffleTracks(filtered)
        : isOrdered
        ? filtered
        : sortSequential(filtered);
      if (shuffle !== isShuffle) setIsShuffle(shuffle);
      setIsUsingMockData(false);
      setPlaylist(next);
      if (isOrdered) {
        // A playlist starts from its first track (or the row that was
        // tapped). Leaving one keeps whatever is playing — the render-time
        // anchor finds it in the library.
        const at = start?.startTrackId ? next.findIndex((t) => t.id === start.startTrackId) : 0;
        setStartAt({ playlist: next, index: Math.max(0, at) });
        setCurrentTime(0);
        if (start) setIsPlaying(true);
      }
      return;
    }

    // Ordered context, shuffle off: the given order is the playing order.
    // Reorders, removals and metadata updates all flow straight through.
    if (isOrdered && !isShuffle) {
      setIsUsingMockData(false);
      setPlaylist((prev) =>
        prev.length === filtered.length && prev.every((t, i) => t === filtered[i]) ? prev : filtered
      );
      return;
    }

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
  }, [initialTracks, dislikedTracks, isShuffle, filterDisliked, isUsingMockData, orderedContextKey, isOrdered]);

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
        // Turning OFF shuffle — restore artist/album sequential order, or the
        // playlist's own order inside an ordered context.
        if (initialTracks) {
           const filtered = filterDisliked(initialTracks);
           setPlaylist(isOrdered ? filtered : sortSequential(filtered));
        }
      }
      return nextState;
    });
  }, [initialTracks, filterDisliked, isOrdered]);

  /**
   * Restart the CURRENT input tracks from a chosen point: in order (the
   * playlist's own order inside an ordered context, the artist/album sort
   * otherwise) or shuffled, on the first track or a named one. Autoplays.
   */
  const playFromContext = useCallback((start: ContextStart = {}) => {
    if (!initialTracks || initialTracks.length === 0) return;
    const filtered = filterDisliked(initialTracks);
    if (filtered.length === 0) return;
    const shuffle = !!start.shuffle;
    const next = shuffle ? shuffleTracks(filtered) : isOrdered ? filtered : sortSequential(filtered);
    const at = start.startTrackId ? next.findIndex((t) => t.id === start.startTrackId) : 0;
    const index = Math.max(0, at);
    setIsShuffle(shuffle);
    if (next === playlist) {
      // Same array (already playing this order): a plain index change.
      setCurrentIndex(index);
    } else {
      setStartAt({ playlist: next, index });
      setPlaylist(next);
    }
    setCurrentTime(0);
    setTimeout(() => {
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo();
      }
      setIsPlaying(true);
    }, 100);
  }, [initialTracks, filterDisliked, isOrdered, playlist]);

  /**
   * Call just before switching `orderedContextKey` to `key`: the switch then
   * starts the way `start` says, and autoplays.
   */
  const requestContextStart = useCallback((key: string, start: ContextStart = {}) => {
    pendingStartRef.current = { key, ...start };
  }, []);

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
    playFromContext,
    requestContextStart,
  };
}
