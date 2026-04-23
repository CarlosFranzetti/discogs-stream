import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onTogglePlay: () => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onTogglePlaylist?: () => void;
  onToggleShuffle?: () => void;
  onToggleOptions?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onToggleMute?: () => void;
  onSkipNextRelease?: () => void;
  onSkipPrevRelease?: () => void;
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onSkipPrev,
  onSkipNext,
  onTogglePlaylist,
  onToggleShuffle,
  onToggleOptions,
  onVolumeUp,
  onVolumeDown,
  onToggleMute,
  onSkipNextRelease,
  onSkipPrevRelease,
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          onTogglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSkipPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSkipNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          onSkipNextRelease?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onSkipPrevRelease?.();
          break;
        case '+':
        case '=':
          e.preventDefault();
          onVolumeUp?.();
          break;
        case '-':
          e.preventDefault();
          onVolumeDown?.();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          onToggleMute?.();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          onTogglePlaylist?.();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          onToggleShuffle?.();
          break;
        case 'o':
        case 'O':
          e.preventDefault();
          onToggleOptions?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onTogglePlay, onSkipPrev, onSkipNext, onTogglePlaylist,
    onToggleShuffle, onToggleOptions, onVolumeUp, onVolumeDown,
    onToggleMute, onSkipNextRelease, onSkipPrevRelease,
  ]);
}
