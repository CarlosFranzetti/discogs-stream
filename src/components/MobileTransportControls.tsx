import { useRef, useCallback, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward, ThumbsUp, ThumbsDown, Shuffle } from 'lucide-react';

interface MobileTransportControlsProps {
  isPlaying: boolean;
  isLiked: boolean;
  isDisliked: boolean;
  isShuffle?: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSkipBackward: (seconds?: number) => void;
  onSkipForward: (seconds?: number) => void;
  onLike: () => void;
  onDislike: () => void;
  onToggleShuffle?: () => void;
}

export function MobileTransportControls({
  isPlaying,
  isLiked,
  isDisliked,
  isShuffle,
  onTogglePlay,
  onPrevious,
  onNext,
  onSkipBackward,
  onSkipForward,
  onLike,
  onDislike,
  onToggleShuffle,
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
    <div className="flex flex-col gap-4">
      {/* Main Transport */}
      <div className="flex items-center justify-center gap-4">
        {/* Shuffle button */}
        <button
          onClick={onToggleShuffle}
          className={`control-button w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            isShuffle ? 'text-primary bg-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-label="Toggle Shuffle"
        >
          <Shuffle className="w-5 h-5" />
        </button>

        {/* Previous track */}
        <button
          onClick={onPrevious}
          className="control-button w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-muted transition-all"
          aria-label="Previous track"
        >
          <SkipBack className="w-6 h-6" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          className="control-button control-button-primary w-16 h-16 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-glow transition-all active:scale-95"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-8 h-8" />
          ) : (
            <Play className="w-8 h-8 ml-1" />
          )}
        </button>

        {/* Next track */}
        <button
          onClick={onNext}
          className="control-button w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-muted transition-all"
          aria-label="Next track"
        >
          <SkipForward className="w-6 h-6" />
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

      {/* Secondary Controls (Seek & Dislike) */}
      <div className="flex items-center justify-center gap-6">
        {/* Rewind */}
        <button
          onMouseDown={handleRewindStart}
          onMouseUp={handleRewindEnd}
          onMouseLeave={handleRewindEnd}
          onTouchStart={handleRewindStart}
          onTouchEnd={handleRewindEnd}
          className={`control-button w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isHoldingRewind ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-label="Rewind"
        >
          <Rewind className="w-4 h-4" />
        </button>

        {/* Dislike */}
        <button
          onClick={onDislike}
          className={`control-button w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isDisliked ? 'text-destructive bg-destructive/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-label="Dislike track"
        >
          <ThumbsDown className="w-4 h-4" />
        </button>

        {/* Fast forward */}
        <button
          onMouseDown={handleForwardStart}
          onMouseUp={handleForwardEnd}
          onMouseLeave={handleForwardEnd}
          onTouchStart={handleForwardStart}
          onTouchEnd={handleForwardEnd}
          className={`control-button w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isHoldingForward ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-label="Fast forward"
        >
          <FastForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
