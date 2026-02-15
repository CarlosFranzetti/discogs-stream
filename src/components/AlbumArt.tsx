import { Track } from '@/types/track';

interface AlbumArtProps {
  track: Track;
  isPlaying: boolean;
  showVideo?: boolean; // kept for compatibility but not used
  onClick: () => void;
}

export function AlbumArt({ track, isPlaying, onClick }: AlbumArtProps) {
  const hasValidCover = track.coverUrl && track.coverUrl !== '/placeholder.svg' && !track.coverUrl.includes('placeholder');
  
  console.log(`[AlbumArt] Track: ${track.title}, coverUrl: ${track.coverUrl}, hasValidCover: ${hasValidCover}`);
  
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
          {/* Center label - show cover art if available */}
          <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-amber-dim flex items-center justify-center overflow-hidden">
            {hasValidCover ? (
              <img 
                src={track.coverUrl} 
                alt={`${track.album} by ${track.artist}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Hide image on error and show fallback
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-2 h-2 rounded-full bg-vinyl-black" />
            )}
          </div>
        </div>

        {/* Album cover */}
        <div
          className="relative z-10 w-full h-full rounded-lg overflow-hidden shadow-vinyl group"
          style={hasValidCover ? {
            backgroundImage: `url(${track.coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : {
            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2) 0%, hsl(var(--accent) / 0.2) 100%)',
          }}
        >
          {!hasValidCover && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="text-4xl mb-2">🎵</div>
                <div className="text-xs opacity-50">Loading cover...</div>
              </div>
            </div>
          )}
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
