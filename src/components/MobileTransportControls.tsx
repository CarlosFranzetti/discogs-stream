import { useRef, useCallback, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward, ThumbsUp, ThumbsDown } from 'lucide-react';

interface MobileTransportControlsProps {
  isPlaying: boolean;
  isLiked: boolean;
  isDisliked: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSkipBackward: (seconds?: number) => void;
  onSkipForward: (seconds?: number) => void;
  onLike: () => void;
  onDislike: () => void;
}

export function MobileTransportControls({
  isPlaying,
  isLiked,
  isDisliked,
  onTogglePlay,
  onPrevious,
  onNext,
  onSkipBackward,
  onSkipForward,
  onLike,
  onDislike,
}: MobileTransportControlsProps) {
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isHoldingRewind, setIsHoldingRewind] = useState(false);
  const [isHoldingForward, setIsHoldingForward] = useState(false);

  const handleRewindStart = useCallback(() => {
    onSkipBackward(5);
    holdTimeoutRef.current = setTimeout(() => {
      setIsHoldingRewind(true);
      holdIntervalRef.current = setInterval(() => {
        onSkipBackward(1);
      }, 100);
    }, 300);
  }, [onSkipBackward]);

  const handleRewindEnd = useCallback(() => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setIsHoldingRewind(false);
  }, []);

  const handleForwardStart = useCallback(() => {
    onSkipForward(5);
    holdTimeoutRef.current = setTimeout(() => {
      setIsHoldingForward(true);
      holdIntervalRef.current = setInterval(() => {
        onSkipForward(1);
      }, 100);
    }, 300);
  }, [onSkipForward]);

  const handleForwardEnd = useCallback(() => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setIsHoldingForward(false);
  }, []);

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Dislike button */}
      <button
        onClick={onDislike}
        className={`control-button w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          isDisliked ? 'text-destructive bg-destructive/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
        aria-label="Dislike track"
      >
        <ThumbsDown className="w-5 h-5" />
      </button>

      {/* Previous track */}
      <button
        onClick={onPrevious}
        className="control-button w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-muted transition-all"
        aria-label="Previous track"
      >
        <SkipBack className="w-5 h-5" />
      </button>

      {/* Rewind */}
      <button
        onMouseDown={handleRewindStart}
        onMouseUp={handleRewindEnd}
        onMouseLeave={handleRewindEnd}
        onTouchStart={handleRewindStart}
        onTouchEnd={handleRewindEnd}
        className={`control-button w-9 h-9 rounded-full flex items-center justify-center transition-all ${
          isHoldingRewind ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-muted'
        }`}
        aria-label="Rewind"
      >
        <Rewind className="w-4 h-4" />
      </button>

      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        className="control-button control-button-primary w-14 h-14 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-glow transition-all active:scale-95"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="w-7 h-7" />
        ) : (
          <Play className="w-7 h-7 ml-0.5" />
        )}
      </button>

      {/* Fast forward */}
      <button
        onMouseDown={handleForwardStart}
        onMouseUp={handleForwardEnd}
        onMouseLeave={handleForwardEnd}
        onTouchStart={handleForwardStart}
        onTouchEnd={handleForwardEnd}
        className={`control-button w-9 h-9 rounded-full flex items-center justify-center transition-all ${
          isHoldingForward ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-muted'
        }`}
        aria-label="Fast forward"
      >
        <FastForward className="w-4 h-4" />
      </button>

      {/* Next track */}
      <button
        onClick={onNext}
        className="control-button w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-muted transition-all"
        aria-label="Next track"
      >
        <SkipForward className="w-5 h-5" />
      </button>

      {/* Like button */}
      <button
        onClick={onLike}
        className={`control-button w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          isLiked ? 'text-success bg-success/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
        aria-label="Like track"
      >
        <ThumbsUp className="w-5 h-5" />
      </button>
    </div>
  );
}
