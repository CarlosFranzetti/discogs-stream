import { useMemo } from 'react';
import { Track } from '@/types/track';
import { useSettings } from '@/hooks/useSettings';

interface MobileAlbumCoverProps {
  track: Track | null;
  isPlaying: boolean;
  onClick: () => void;
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface DustParticle {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

function useVinylDust(seed: string): DustParticle[] {
  return useMemo(() => {
    let r = hashString(seed);
    const next = () => {
      r = (r * 1664525 + 1013904223) >>> 0;
      return r / 0xffffffff;
    };

    const particles: DustParticle[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = next() * Math.PI * 2;
      // Groove area: label ends at radius ~22, rim at ~48 — stay strictly inside
      const radius = 23 + next() * 24;
      const cx = 50 + Math.cos(angle) * radius;
      const cy = 50 + Math.sin(angle) * radius;
      // Tiny specks only — very small
      const r2 = 0.08 + next() * 0.18;
      const opacity = 0.03 + next() * 0.06;
      particles.push({ cx, cy, r: r2, opacity });
    }
    return particles;
  }, [seed]);
}

export function MobileAlbumCover({ track, isPlaying, onClick }: MobileAlbumCoverProps) {
  const { settings } = useSettings();
  const dustParticles = useVinylDust(track?.id || 'default');

  if (!track) {
    return (
      <div className="relative w-full aspect-square">
        <div className="absolute inset-0 rounded-full bg-vinyl-black vinyl-texture" />
      </div>
    );
  }

  const hasValidCover = track.coverUrl && track.coverUrl !== '/placeholder.svg' && !track.coverUrl.includes('placeholder');
  const rainbowActive = isPlaying && settings.pulseEnabled && settings.rainbowPulse;
  const pulseActive = isPlaying && settings.pulseEnabled && !settings.rainbowPulse;

  return (
    <div
      className="relative w-full aspect-square cursor-pointer group"
      onClick={onClick}
    >
      {/* Outer glow — rainbow or theme pulse */}
      <div className={`absolute -inset-4 rounded-full transition-all duration-500 ${
        rainbowActive
          ? 'animate-rainbow-pulse'
          : pulseActive
          ? 'bg-gradient-to-r from-primary/30 via-transparent to-primary/30 animate-pulse-slow'
          : ''
      }`} />

      {/* Inner ring — syncs color with rainbow */}
      <div className={`absolute -inset-1 rounded-full transition-all duration-300 ${
        rainbowActive
          ? 'ring-2 ring-white/20'
          : isPlaying
          ? 'ring-2 ring-primary/40'
          : 'ring-1 ring-border'
      }`} />

      {/* Vinyl record */}
      <div className={`absolute inset-0 rounded-full bg-vinyl-black shadow-vinyl ${isPlaying ? 'animate-spin-slow' : ''}`}>

        {/* Vinyl grooves */}
        <div className="absolute inset-[8%]  rounded-full border border-vinyl-groove/30" />
        <div className="absolute inset-[16%] rounded-full border border-vinyl-groove/25" />
        <div className="absolute inset-[24%] rounded-full border border-vinyl-groove/20" />

        {/* Dust particles — rotate with the record */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
        >
          {dustParticles.map((p, i) => (
            <circle
              key={i}
              cx={p.cx}
              cy={p.cy}
              r={p.r}
              fill="white"
              fillOpacity={p.opacity}
            />
          ))}
        </svg>

        {/* Center label with album art */}
        <div className="absolute inset-[28%] rounded-full overflow-hidden shadow-2xl border-2 border-vinyl-groove/40">
          {hasValidCover ? (
            <img
              src={track.coverUrl}
              alt={`${track.album} by ${track.artist}`}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
              <div className="text-2xl">🎵</div>
            </div>
          )}
        </div>

        {/* Center hole */}
        <div className="absolute inset-[47%] rounded-full bg-background" />
      </div>

      {/* Hover hint */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-muted-foreground">
          {isPlaying ? 'Tap to pause' : 'Tap to play'}
        </div>
      </div>
    </div>
  );
}
