import { useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  ThumbsUp,
  ThumbsDown,
  Shuffle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlayerControlsProps {
  isPlaying: boolean;
  isLiked: boolean;
  isDisliked: boolean;
  isShuffle?: boolean;
  onTogglePlay: () => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onSkipBackward: (seconds?: number) => void;
  onSkipForward: (seconds?: number) => void;
  onLike: () => void;
  onDislike: () => void;
  onToggleShuffle?: () => void;
}

export function PlayerControls({
  isPlaying,
  isLiked,
  isDisliked,
  isShuffle,
  onTogglePlay,
  onSkipPrev,
  onSkipNext,
  onSkipBackward,
  onSkipForward,
  onLike,
  onDislike,
  onToggleShuffle,
}: PlayerControlsProps) {
  const holdIntervalRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);
  const isHoldingRef = useRef(false);

  const handleRewindStart = useCallback(() => {
    // Initial 5-second skip on tap
    if (!isHoldingRef.current) {
      onSkipBackward(5);
    }

    holdTimeoutRef.current = window.setTimeout(() => {
      isHoldingRef.current = true;
      // Continuous scrubbing when held
      holdIntervalRef.current = window.setInterval(() => {
        onSkipBackward(1);
      }, 50);
    }, 200);
  }, [onSkipBackward]);

  const handleFastForwardStart = useCallback(() => {
    if (!isHoldingRef.current) {
      onSkipForward(5);
    }

    holdTimeoutRef.current = window.setTimeout(() => {
      isHoldingRef.current = true;
      holdIntervalRef.current = window.setInterval(() => {
        onSkipForward(1);
      }, 50);
    }, 200);
  }, [onSkipForward]);

  const handleHoldEnd = useCallback(() => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
    }
    isHoldingRef.current = false;
  }, []);

  return (
    <div className="flex items-center justify-center gap-2 md:gap-4">
      {/* Shuffle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleShuffle}
        className={`control-button w-10 h-10 ${
          isShuffle ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Shuffle className="w-5 h-5" />
      </Button>

      {/* Dislike button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDislike}
        className={`control-button w-10 h-10 ${
          isDisliked ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <ThumbsDown className="w-5 h-5" />
      </Button>

      {/* Skip back */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onSkipPrev}
        className="control-button w-10 h-10 text-muted-foreground hover:text-foreground"
      >
        <SkipBack className="w-5 h-5" />
      </Button>

      {/* Rewind */}
      <Button
        variant="ghost"
        size="icon"
        onMouseDown={handleRewindStart}
        onMouseUp={handleHoldEnd}
        onMouseLeave={handleHoldEnd}
        onTouchStart={handleRewindStart}
        onTouchEnd={handleHoldEnd}
        className="control-button w-10 h-10 text-muted-foreground hover:text-foreground"
      >
        <Rewind className="w-5 h-5" />
      </Button>

      {/* Play/Pause */}
      <Button
        variant="default"
        size="icon"
        onClick={onTogglePlay}
        className="control-button control-button-primary w-14 h-14 rounded-full"
      >
        {isPlaying ? (
          <Pause className="w-6 h-6" />
        ) : (
          <Play className="w-6 h-6 ml-0.5" />
        )}
      </Button>

      {/* Fast forward */}
      <Button
        variant="ghost"
        size="icon"
        onMouseDown={handleFastForwardStart}
        onMouseUp={handleHoldEnd}
        onMouseLeave={handleHoldEnd}
        onTouchStart={handleFastForwardStart}
        onTouchEnd={handleHoldEnd}
        className="control-button w-10 h-10 text-muted-foreground hover:text-foreground"
      >
        <FastForward className="w-5 h-5" />
      </Button>

      {/* Skip next */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onSkipNext}
        className="control-button w-10 h-10 text-muted-foreground hover:text-foreground"
      >
        <SkipForward className="w-5 h-5" />
      </Button>

      {/* Like button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onLike}
        className={`control-button w-10 h-10 ${
          isLiked ? 'text-success' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <ThumbsUp className="w-5 h-5" />
      </Button>
    </div>
  );
}
