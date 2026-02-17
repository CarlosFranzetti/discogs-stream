import { useRef, useState, useCallback, useId, useMemo } from 'react';

interface MobileTimelineProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  trackId?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function buildAmplitudes(seed: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const v =
      Math.sin(t * Math.PI * 4 + (seed % 100) * 0.1) * 0.4 +
      Math.sin(t * Math.PI * 9 + (seed % 50) * 0.2) * 0.3 +
      Math.cos(t * Math.PI * 15 + (seed % 30) * 0.15) * 0.2 +
      Math.sin(t * Math.PI * 23 + (seed % 17) * 0.25) * 0.1;
    // Normalize from [-1, 1] to [0.15, 1.0]
    return 0.15 + ((v + 1) / 2) * 0.85;
  });
}

function buildWaveformPath(amplitudes: number[]): string {
  const n = amplitudes.length;
  const w = 100;
  const midY = 20;
  const maxAmp = 17; // 85% of half-height (20 * 0.85)

  const curvePts = (pts: [number, number][]): string => {
    let d = `L ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i - 1];
      const [cx, cy] = pts[i];
      const mpx = ((px + cx) / 2).toFixed(2);
      d += ` C ${mpx} ${py.toFixed(2)},${mpx} ${cy.toFixed(2)},${cx.toFixed(2)} ${cy.toFixed(2)}`;
    }
    return d;
  };

  // Top half: left to right
  const topPts: [number, number][] = amplitudes.map((a, i) => [
    (i / (n - 1)) * w,
    midY - a * maxAmp,
  ]);

  // Bottom half: right to left (reversed), mirrored below midY
  const botPts: [number, number][] = [...amplitudes].reverse().map((a, i) => [
    ((n - 1 - i) / (n - 1)) * w,
    midY + a * maxAmp,
  ]);

  return `M 0 ${midY} ${curvePts(topPts)} L ${w} ${midY} ${curvePts(botPts)} Z`;
}

export function MobileTimeline({ currentTime, duration, onSeek, trackId }: MobileTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const uid = useId();

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const amplitudes = useMemo(() => {
    const seed = trackId ? hashString(trackId) : 42;
    return buildAmplitudes(seed, 80);
  }, [trackId]);

  const wavePath = useMemo(() => buildWaveformPath(amplitudes), [amplitudes]);

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

  // Sanitize uid for use in SVG id attributes
  const safeUid = uid.replace(/[^a-zA-Z0-9]/g, '');
  const playedId = `played-${safeUid}`;
  const unplayedId = `unplayed-${safeUid}`;

  return (
    <div className="w-full space-y-1.5">
      {/* Smooth SVG waveform (seekable) */}
      <div
        ref={trackRef}
        className="relative h-[26px] cursor-pointer group"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
        >
          <defs>
            <clipPath id={playedId}>
              <rect x="0" y="0" width={progress} height="40" />
            </clipPath>
            <clipPath id={unplayedId}>
              <rect x={progress} y="0" width={100 - progress} height="40" />
            </clipPath>
          </defs>
          {/* Unplayed region */}
          <path
            d={wavePath}
            style={{ fill: 'hsl(var(--muted-foreground) / 0.12)' }}
            clipPath={`url(#${unplayedId})`}
          />
          {/* Played region */}
          <path
            d={wavePath}
            style={{ fill: 'hsl(var(--primary) / 0.35)' }}
            clipPath={`url(#${playedId})`}
          />
          {/* Playhead */}
          <line
            x1={progress}
            y1="0"
            x2={progress}
            y2="40"
            style={{ stroke: 'hsl(var(--primary))' }}
            strokeWidth={isDragging ? 1 : 0.5}
          />
        </svg>
      </div>

      <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground px-1">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
