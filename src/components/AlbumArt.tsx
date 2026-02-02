import { Track } from '@/types/track';

interface AlbumArtProps {
  track: Track;
  isPlaying: boolean;
  showVideo?: boolean; // kept for compatibility but not used
  onClick: () => void;
}

export function AlbumArt({ track, isPlaying, onClick }: AlbumArtProps) {
  return (
    <div
      className="flex items-center justify-center h-full cursor-pointer"
      onClick={onClick}
    >
      <div className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64">
        {/* Vinyl record behind */}
        <div
          className={`absolute inset-0 rounded-full bg-vinyl-black shadow-vinyl ${
            isPlaying ? 'animate-spin-slow' : ''
          }`}
          style={{
            transform: 'translateX(20%)',
            zIndex: 0,
          }}
        >
          {/* Vinyl grooves */}
          <div className="absolute inset-3 rounded-full border border-vinyl-groove opacity-30" />
          <div className="absolute inset-6 rounded-full border border-vinyl-groove opacity-30" />
          <div className="absolute inset-9 rounded-full border border-vinyl-groove opacity-30" />
          <div className="absolute inset-12 rounded-full border border-vinyl-groove opacity-30" />
          {/* Center label */}
          <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-amber-dim flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-vinyl-black" />
          </div>
        </div>

        {/* Album cover */}
        <div
          className="relative z-10 w-full h-full rounded-lg overflow-hidden shadow-vinyl group"
          style={{
            backgroundImage: `url(${track.coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-background/80 backdrop-blur-sm rounded-full px-3 py-2">
              <span className="text-xs text-muted-foreground">{isPlaying ? 'Pause' : 'Play'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
