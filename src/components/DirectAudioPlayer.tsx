import React, { useEffect, useRef, type MutableRefObject } from 'react';

interface DirectAudioPlayerProps {
  audioUrl: string;
  isPlaying: boolean;
  onEnded: () => void;
  onError?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  seekTime?: number;
}

export interface DirectAudioPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export const DirectAudioPlayer = React.forwardRef<DirectAudioPlayerRef, DirectAudioPlayerProps>(
  ({ audioUrl, isPlaying, onEnded, onError, onTimeUpdate, seekTime }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    // Expose player controls via ref
    React.useImperativeHandle(ref, () => ({
      play: () => {
        console.log('[DirectAudioPlayer] Play called');
        audioRef.current?.play().catch(err => {
          console.error('[DirectAudioPlayer] Play error:', err);
          onError?.();
        });
      },
      pause: () => {
        console.log('[DirectAudioPlayer] Pause called');
        audioRef.current?.pause();
      },
      seekTo: (time: number) => {
        console.log('[DirectAudioPlayer] Seek to:', time);
        if (audioRef.current) {
          audioRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => {
        return audioRef.current?.currentTime || 0;
      },
      getDuration: () => {
        return audioRef.current?.duration || 0;
      },
    }));

    // Load new audio URL
    useEffect(() => {
      if (!audioRef.current || !audioUrl) return;

      console.log('[DirectAudioPlayer] Loading audio URL:', audioUrl);

      const audio = audioRef.current;
      audio.src = audioUrl;
      audio.load();

      // Auto-play after loading
      if (isPlaying) {
        audio.play().catch(err => {
          console.error('[DirectAudioPlayer] Auto-play error:', err);
          onError?.();
        });
      }
    }, [audioUrl]);

    // Handle play/pause state changes
    useEffect(() => {
      if (!audioRef.current) return;

      const audio = audioRef.current;

      if (isPlaying && audio.paused) {
        audio.play().catch(err => {
          console.error('[DirectAudioPlayer] Play error:', err);
          onError?.();
        });
      } else if (!isPlaying && !audio.paused) {
        audio.pause();
      }
    }, [isPlaying, onError]);

    // Handle seek
    useEffect(() => {
      if (seekTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = seekTime;
      }
    }, [seekTime]);

    // Event handlers
    const handleEnded = () => {
      console.log('[DirectAudioPlayer] Track ended');
      onEnded();
    };

    const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
      console.error('[DirectAudioPlayer] Error loading audio:', e);
      onError?.();
    };

    const handleTimeUpdate = () => {
      if (audioRef.current && onTimeUpdate) {
        onTimeUpdate(audioRef.current.currentTime);
      }
    };

    const handleCanPlay = () => {
      console.log('[DirectAudioPlayer] Audio ready to play');
    };

    return (
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onError={handleError}
        onTimeUpdate={handleTimeUpdate}
        onCanPlay={handleCanPlay}
        preload="auto"
        style={{ display: 'none' }}
      />
    );
  }
);

DirectAudioPlayer.displayName = 'DirectAudioPlayer';
