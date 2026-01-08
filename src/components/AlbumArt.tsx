import { Track } from '@/types/track';

interface AlbumArtProps {
  track: Track;
  isPlaying: boolean;
  showVideo: boolean;
  onClick: () => void;
}

export function AlbumArt({ track, isPlaying, showVideo, onClick }: AlbumArtProps) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 cursor-pointer ${
        showVideo ? 'opacity-0 z-0 pointer-events-none' : 'opacity-100 z-10'
      }`}
      onClick={onClick}
    >
      <div className="relative w-72 h-72 md:w-80 md:h-80 lg:w-96 lg:h-96">
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
          <div className="absolute inset-4 rounded-full border border-vinyl-groove opacity-30" />
          <div className="absolute inset-8 rounded-full border border-vinyl-groove opacity-30" />
          <div className="absolute inset-12 rounded-full border border-vinyl-groove opacity-30" />
          <div className="absolute inset-16 rounded-full border border-vinyl-groove opacity-30" />
          {/* Center label */}
          <div className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-gradient-to-br from-primary to-amber-dim flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-vinyl-black" />
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
            <div className="bg-background/80 backdrop-blur-sm rounded-full p-4">
              <span className="text-sm text-muted-foreground">Click for video</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
