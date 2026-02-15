import { Track } from '@/types/track';
import { useSettings } from '@/hooks/useSettings';

interface MobileAlbumCoverProps {
  track: Track | null;
  isPlaying: boolean;
  onClick: () => void;
}

export function MobileAlbumCover({ track, isPlaying, onClick }: MobileAlbumCoverProps) {
  const { settings } = useSettings();

  if (!track) {
    return (
      <div className="relative w-full aspect-square">
        <div className="absolute inset-0 rounded-full bg-vinyl-black vinyl-texture" />
      </div>
    );
  }

  const hasValidCover = track.coverUrl && track.coverUrl !== '/placeholder.svg' && !track.coverUrl.includes('placeholder');

  return (
    <div
      className="relative w-full aspect-square cursor-pointer group"
      onClick={onClick}
    >
      {/* Outer glow ring - theme aware */}
      <div className={`absolute -inset-3 rounded-full transition-all duration-500 ${
        isPlaying && settings.pulseEnabled 
          ? 'bg-gradient-to-r from-primary/30 via-transparent to-primary/30 animate-pulse-slow' 
          : ''
      }`} />
      <div className={`absolute -inset-1 rounded-full transition-all duration-300 ${isPlaying ? 'ring-2 ring-primary/40' : 'ring-1 ring-border'}`} />
      
      {/* Vinyl record background */}
      <div className={`absolute inset-0 rounded-full bg-vinyl-black shadow-vinyl ${isPlaying ? 'animate-spin-slow' : ''}`}>
        {/* Vinyl grooves */}
        <div className="absolute inset-[8%] rounded-full border border-vinyl-groove/30" />
        <div className="absolute inset-[16%] rounded-full border border-vinyl-groove/25" />
        <div className="absolute inset-[24%] rounded-full border border-vinyl-groove/20" />
        
        {/* Center label with album art */}
        <div className="absolute inset-[28%] rounded-full overflow-hidden shadow-2xl border-2 border-vinyl-groove/40">
          {hasValidCover ? (
            <img
              src={track.coverUrl}
              alt={`${track.album} by ${track.artist}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Show fallback on error
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
              <div className="text-center">
                <div className="text-2xl">🎵</div>
              </div>
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
