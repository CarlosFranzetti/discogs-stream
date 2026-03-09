import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onTogglePlay: () => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onTogglePlaylist?: () => void;
  onToggleShuffle?: () => void;
  onToggleOptions?: () => void;
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onSkipPrev,
  onSkipNext,
  onTogglePlaylist,
  onToggleShuffle,
  onToggleOptions,
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
        case 'Space':
          e.preventDefault();
          onTogglePlay();
          break;
        case ',':
        case '<':
          e.preventDefault();
          onSkipPrev();
          break;
        case '.':
        case '>':
          e.preventDefault();
          onSkipNext();
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

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onTogglePlay, onSkipPrev, onSkipNext, onTogglePlaylist, onToggleShuffle, onToggleOptions]);
}
