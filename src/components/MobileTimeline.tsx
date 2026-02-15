import { useRef, useState, useCallback } from 'react';

interface MobileTimelineProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MobileTimeline({ currentTime, duration, onSeek }: MobileTimelineProps) {
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
    <div className="w-full space-y-1.5">
      {/* Compact waveform visualization (decorative) */}
      <div
        ref={trackRef}
        className="relative h-8 sm:h-10 cursor-pointer group flex items-center"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Waveform bars (decorative) - fewer bars for smaller size */}
        <div className="absolute inset-0 flex items-center justify-around gap-px overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => {
            // Deterministic waveform based on index
            const height = 20 + Math.sin(i * 0.2) * 15 + Math.cos(i * 0.5) * 10 + (i % 3) * 5;
            const isPast = (i / 50) * 100 <= progress;
            return (
              <div
                key={i}
                className={`w-0.5 sm:w-1 rounded-full transition-colors ${isPast ? 'bg-primary' : 'bg-muted'}`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
        
        {/* Progress overlay */}
        <div
          className="absolute inset-y-0 left-0 pointer-events-none"
          style={{ width: `${progress}%` }}
        />
        
        {/* Playhead */}
        <div
          className={`absolute top-0 bottom-0 w-0.5 bg-primary transition-all ${isDragging ? 'w-1' : ''}`}
          style={{ left: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground px-1">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
