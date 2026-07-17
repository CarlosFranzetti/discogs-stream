import { useEffect } from 'react';
import { Track } from '@/types/track';

interface UseMediaSessionArgs {
  track: Track | null | undefined;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek?: (time: number) => void;
}

/**
 * Media Session API: lock-screen / notification-shade metadata, artwork, and
 * transport controls. Most useful with the direct-audio (<audio>) path, where
 * the OS treats the app as a first-class audio player; harmless elsewhere.
 */
export function useMediaSession({ track, isPlaying, onPlay, onPause, onNext, onPrev, onSeek }: UseMediaSessionArgs) {
  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || '',
        artwork: track.coverUrl
          ? [{ src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
          : [],
      });
    } catch {
      // MediaMetadata not constructible (old WebKit) — metadata is best-effort
    }
  }, [track]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const bind = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      // Individual actions can be unsupported per-browser — bind what we can
      try { ms.setActionHandler(action, handler); } catch { /* unsupported action */ }
    };
    bind('play', onPlay);
    bind('pause', onPause);
    bind('nexttrack', onNext);
    bind('previoustrack', onPrev);
    bind('seekto', (details) => {
      if (onSeek && details.seekTime != null) onSeek(details.seekTime);
    });
    return () => {
      (['play', 'pause', 'nexttrack', 'previoustrack', 'seekto'] as MediaSessionAction[]).forEach(
        (a) => bind(a, null)
      );
    };
  }, [onPlay, onPause, onNext, onPrev, onSeek]);
}
