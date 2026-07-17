import React, { useEffect, useRef } from 'react';

interface DirectAudioPlayerProps {
  audioUrl: string;
  isPlaying: boolean;
  onEnded: () => void;
  onError?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  /** Receives the live <audio> element on mount and null on unmount, so callers
   *  can attach it to useAudioController / usePitch. */
  onAudioElement?: (el: HTMLAudioElement | null) => void;
  seekTime?: number;
  /** Engine-handoff position: applied once metadata loads, so taking over from
   *  the iframe resumes where playback was instead of restarting at 0:00. */
  initialSeek?: number;
}

export interface DirectAudioPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export const DirectAudioPlayer = React.forwardRef<DirectAudioPlayerRef, DirectAudioPlayerProps>(
  ({ audioUrl, isPlaying, onEnded, onError, onTimeUpdate, onAudioElement, seekTime, initialSeek }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const initialSeekRef = useRef(initialSeek);
    initialSeekRef.current = initialSeek;

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
      const audio = audioRef.current;
      if (!audio) return;
      // Turntable behavior: playbackRate changes shift pitch too (a real ±8%
      // fader alters both tempo and pitch — preservesPitch would defeat it).
      audio.preservesPitch = false;
      onAudioElement?.(audio);
      return () => { onAudioElement?.(null); };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (!audioRef.current || !audioUrl) return;
      const audio = audioRef.current;
      audio.src = audioUrl;
      audio.load();
      // Seeking before metadata is loaded is a no-op in some browsers — apply
      // the handoff position once the stream reports its duration.
      const applyInitialSeek = () => {
        const t = initialSeekRef.current;
        if (t && t > 0 && Number.isFinite(audio.duration) && t < audio.duration) {
          audio.currentTime = t;
        }
      };
      audio.addEventListener('loadedmetadata', applyInitialSeek, { once: true });
      if (isPlaying) {
        audio.play().catch(() => { onError?.(); });
      }
      return () => audio.removeEventListener('loadedmetadata', applyInitialSeek);
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
