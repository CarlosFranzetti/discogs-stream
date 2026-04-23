import React, { useEffect, useRef } from 'react';

interface DirectAudioPlayerProps {
  audioUrl: string;
  isPlaying: boolean;
  onEnded: () => void;
  onError?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  seekTime?: number;
  volume?: number;
  muted?: boolean;
}

export interface DirectAudioPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export const DirectAudioPlayer = React.forwardRef<DirectAudioPlayerRef, DirectAudioPlayerProps>(
  ({ audioUrl, isPlaying, onEnded, onError, onTimeUpdate, seekTime, volume = 100, muted = false }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    React.useImperativeHandle(ref, () => ({
      play: () => {
        audioRef.current?.play().catch(() => { onError?.(); });
      },
      pause: () => {
        audioRef.current?.pause();
      },
      seekTo: (time: number) => {
        if (audioRef.current) audioRef.current.currentTime = time;
      },
      getCurrentTime: () => audioRef.current?.currentTime || 0,
      getDuration: () => audioRef.current?.duration || 0,
    }));

    useEffect(() => {
      if (!audioRef.current || !audioUrl) return;
      const audio = audioRef.current;
      audio.src = audioUrl;
      audio.load();
      if (isPlaying) {
        audio.play().catch(() => { onError?.(); });
      }
    }, [audioUrl]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (!audioRef.current) return;
      const audio = audioRef.current;
      if (isPlaying && audio.paused) {
        audio.play().catch(() => { onError?.(); });
      } else if (!isPlaying && !audio.paused) {
        audio.pause();
      }
    }, [isPlaying, onError]);

    useEffect(() => {
      if (seekTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = seekTime;
      }
    }, [seekTime]);

    useEffect(() => {
      if (!audioRef.current) return;
      audioRef.current.muted = muted;
      audioRef.current.volume = muted ? 0 : volume / 100;
    }, [volume, muted]);

    const handleEnded = () => { onEnded(); };
    const handleError = () => { onError?.(); };
    const handleTimeUpdate = () => {
      if (audioRef.current && onTimeUpdate) onTimeUpdate(audioRef.current.currentTime);
    };

    return (
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onError={handleError}
        onTimeUpdate={handleTimeUpdate}
        preload="auto"
        style={{ display: 'none' }}
      />
    );
  }
);

DirectAudioPlayer.displayName = 'DirectAudioPlayer';
