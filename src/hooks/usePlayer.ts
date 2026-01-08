/// <reference path="../types/youtube.d.ts" />
import { useState, useCallback, useRef, useEffect } from 'react';
import { Track } from '@/types/track';
import { mockTracks, shuffleTracks } from '@/data/mockTracks';

export function usePlayer() {
  const [playlist, setPlaylist] = useState<Track[]>(() => shuffleTracks(mockTracks));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [dislikedTracks, setDislikedTracks] = useState<Track[]>([]);
  
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<number | null>(null);

  const currentTrack = playlist[currentIndex];

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

  const likeTrack = useCallback(() => {
    if (!currentTrack) return;
    
    // Remove from disliked if present
    setDislikedTracks((prev) => prev.filter((t) => t.id !== currentTrack.id));
    
    // Toggle like
    if (likedTracks.some((t) => t.id === currentTrack.id)) {
      setLikedTracks((prev) => prev.filter((t) => t.id !== currentTrack.id));
    } else {
      setLikedTracks((prev) => [...prev, currentTrack]);
    }
  }, [currentTrack, likedTracks]);

  const dislikeTrack = useCallback(() => {
    if (!currentTrack) return;
    
    // Remove from liked if present
    setLikedTracks((prev) => prev.filter((t) => t.id !== currentTrack.id));
    
    // Add to disliked and remove from playlist
    if (!dislikedTracks.some((t) => t.id === currentTrack.id)) {
      setDislikedTracks((prev) => [...prev, currentTrack]);
      setPlaylist((prev) => prev.filter((t) => t.id !== currentTrack.id));
      // Don't need to change index as the playlist shifts
    }
  }, [currentTrack, dislikedTracks]);

  const selectTrack = useCallback((index: number) => {
    setCurrentTime(0);
    setCurrentIndex(index);
    setIsPlaying(true);
  }, []);

  const toggleVideo = useCallback(() => {
    setShowVideo((prev) => !prev);
  }, []);

  const isLiked = currentTrack ? likedTracks.some((t) => t.id === currentTrack.id) : false;
  const isDisliked = currentTrack ? dislikedTracks.some((t) => t.id === currentTrack.id) : false;

  return {
    playlist,
    currentTrack,
    currentIndex,
    isPlaying,
    currentTime,
    showVideo,
    likedTracks,
    dislikedTracks,
    isLiked,
    isDisliked,
    playerRef,
    play,
    pause,
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
    skipForward,
    skipBackward,
    likeTrack,
    dislikeTrack,
    selectTrack,
    toggleVideo,
    setCurrentTime,
    setIsPlaying,
  };
}
