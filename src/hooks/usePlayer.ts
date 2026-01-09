/// <reference path="../types/youtube.d.ts" />
import { useState, useCallback, useRef, useEffect } from 'react';
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
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<number | null>(null);

  const currentTrack = playlist[currentIndex];

  // Update playlist when initialTracks changes, filtering out disliked tracks
  useEffect(() => {
    if (initialTracks && initialTracks.length > 0) {
      const dislikedIds = new Set((dislikedTracks || []).map(t => t.id));
      const filtered = initialTracks.filter(t => !dislikedIds.has(t.id));
      setPlaylist(shuffleTracks(filtered));
      setCurrentIndex(0);
    }
  }, [initialTracks, dislikedTracks]);

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
  }, [playlist.length]);

  const skipPrev = useCallback(() => {
    setCurrentTime(0);
    setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
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
  };
}
