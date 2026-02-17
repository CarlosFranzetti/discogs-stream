import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onTogglePlay: () => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onTogglePlaylist?: () => void;
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onSkipPrev,
  onSkipNext,
  onTogglePlaylist,
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // Space: play/pause
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
        return;
      }

      // Comma (< when shifted): previous
      if (e.key === ',' || e.key === '<' || e.code === 'Comma') {
        e.preventDefault();
        onSkipPrev();
        return;
      }

      // Period (> when shifted): next
      if (e.key === '.' || e.key === '>' || e.code === 'Period') {
        e.preventDefault();
        onSkipNext();
        return;
      }

      // P: toggle playlist
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        onTogglePlaylist?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onTogglePlay, onSkipPrev, onSkipNext, onTogglePlaylist]);
}
