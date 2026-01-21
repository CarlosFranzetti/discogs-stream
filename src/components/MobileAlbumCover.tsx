import { Track } from '@/types/track';

interface MobileAlbumCoverProps {
  track: Track | null;
  isPlaying: boolean;
  onClick: () => void;
}

export function MobileAlbumCover({ track, isPlaying, onClick }: MobileAlbumCoverProps) {
  if (!track) {
    return (
      <div className="relative w-full aspect-square">
        <div className="absolute inset-0 rounded-full bg-vinyl-black vinyl-texture" />
      </div>
    );
  }

  return (
    <div
      className="relative w-full aspect-square cursor-pointer group"
      onClick={onClick}
    >
      {/* Outer glow ring */}
      <div className={`absolute inset-0 rounded-full transition-all duration-500 ${isPlaying ? 'ring-2 ring-primary/30 ring-offset-4 ring-offset-background' : ''}`} />
      
      {/* Vinyl record background */}
      <div className={`absolute inset-0 rounded-full bg-vinyl-black shadow-vinyl ${isPlaying ? 'animate-spin-slow' : ''}`}>
        {/* Vinyl grooves */}
        <div className="absolute inset-[8%] rounded-full border border-vinyl-groove/30" />
        <div className="absolute inset-[16%] rounded-full border border-vinyl-groove/25" />
        <div className="absolute inset-[24%] rounded-full border border-vinyl-groove/20" />
        
        {/* Center label with album art */}
        <div className="absolute inset-[28%] rounded-full overflow-hidden shadow-2xl border-2 border-vinyl-groove/40">
          <img
            src={track.coverUrl}
            alt={`${track.album} by ${track.artist}`}
            className="w-full h-full object-cover"
          />
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
