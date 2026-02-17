import { useRef, useCallback, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward, ThumbsUp, ThumbsDown, Shuffle, Volume2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface MobileTransportControlsProps {
  isPlaying: boolean;
  isLiked: boolean;
  isDisliked: boolean;
  isShuffle?: boolean;
  volume?: number;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSkipBackward: (seconds?: number) => void;
  onSkipForward: (seconds?: number) => void;
  onLike: () => void;
  onDislike: () => void;
  onToggleShuffle?: () => void;
  onVolumeChange?: (value: number[]) => void;
}

export function MobileTransportControls({
  isPlaying,
  isLiked,
  isDisliked,
  isShuffle,
  volume = 100,
  onTogglePlay,
  onPrevious,
  onNext,
  onSkipBackward,
  onSkipForward,
  onLike,
  onDislike,
  onToggleShuffle,
  onVolumeChange,
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
    <div className="flex flex-col gap-2">
      {/* Main controls row */}
      <div className="flex items-center justify-between gap-1 px-1.5">
        {/* Shuffle */}
        <button
          onClick={onToggleShuffle}
          className={`control-button w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-all ${
            isShuffle ? 'text-primary bg-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-label="Toggle Shuffle"
        >
          <Shuffle className="w-3 h-3" />
        </button>

        {/* Rewind */}
        <button
          onMouseDown={handleRewindStart}
          onMouseUp={handleRewindEnd}
          onMouseLeave={handleRewindEnd}
          onTouchStart={handleRewindStart}
          onTouchEnd={handleRewindEnd}
          className={`control-button w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all ${
            isHoldingRewind ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-label="Rewind"
        >
          <Rewind className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        </button>

        {/* Previous */}
        <button
          onClick={onPrevious}
          className="control-button w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-foreground hover:bg-muted transition-all"
          aria-label="Previous track"
        >
          <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          className="control-button control-button-primary w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-glow transition-all active:scale-95"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5" />
          )}
        </button>

        {/* Next */}
        <button
          onClick={onNext}
          className="control-button w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-foreground hover:bg-muted transition-all"
          aria-label="Next track"
        >
          <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Fast forward */}
        <button
          onMouseDown={handleForwardStart}
          onMouseUp={handleForwardEnd}
          onMouseLeave={handleForwardEnd}
          onTouchStart={handleForwardStart}
          onTouchEnd={handleForwardEnd}
          className={`control-button w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all ${
            isHoldingForward ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-label="Fast forward"
        >
          <FastForward className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        </button>

        {/* Like */}
        <button
          onClick={onLike}
          className={`control-button w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-all ${
            isLiked ? 'text-success bg-success/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-label="Like track"
        >
          <ThumbsUp className="w-3 h-3" />
        </button>
      </div>

      {/* Volume row: Dislike | Volume slider */}
      <div className="flex items-center justify-center gap-2 px-3">
        {/* Dislike */}
        <button
          onClick={onDislike}
          className={`control-button w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all shrink-0 ${
            isDisliked ? 'text-destructive bg-destructive/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-label="Dislike track"
        >
          <ThumbsDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        </button>

        {/* Volume slider */}
        <div className="flex items-center gap-2 flex-1 max-w-xs ml-2">
          <Volume2 className="w-3 h-3 text-muted-foreground shrink-0" />
          <Slider
            value={[volume]}
            onValueChange={onVolumeChange}
            max={100}
            step={1}
            className="w-full"
          />
          <span className="text-[10px] text-muted-foreground shrink-0 w-7 text-right">{volume}%</span>
        </div>
      </div>
    </div>
  );
}
