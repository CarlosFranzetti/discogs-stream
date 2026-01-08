import { useRef, useState, useCallback } from 'react';

interface TimelineProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function Timeline({ currentTime, duration, onSeek }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      onSeek(percentage * duration);
    },
    [duration, onSeek]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleSeek(e.clientX);

    const handleMouseMove = (e: MouseEvent) => {
      handleSeek(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleSeek(e.touches[0].clientX);

    const handleTouchMove = (e: TouchEvent) => {
      handleSeek(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  return (
    <div className="w-full space-y-2">
      <div
        ref={trackRef}
        className="relative h-2 bg-secondary rounded-full cursor-pointer group"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Progress bar */}
        <div
          className="absolute h-full bg-gradient-to-r from-primary to-amber-glow rounded-full transition-all duration-75"
          style={{ width: `${progress}%` }}
        />

        {/* Thumb */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-primary rounded-full shadow-glow transition-transform duration-150 ${
            isDragging ? 'scale-125' : 'scale-100 group-hover:scale-110'
          }`}
          style={{ left: `${progress}%` }}
        />

        {/* Hover indicator */}
        <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute inset-0 bg-primary/10 rounded-full" />
        </div>
      </div>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
