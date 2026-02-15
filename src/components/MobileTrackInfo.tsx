import { Track } from '@/types/track';

interface MobileTrackInfoProps {
  track: Track | null;
}

export function MobileTrackInfo({ track }: MobileTrackInfoProps) {
  if (!track) {
    return (
      <div className="text-center space-y-1">
        <div className="h-6 bg-muted rounded w-48 mx-auto animate-pulse" />
        <div className="h-4 bg-muted rounded w-32 mx-auto animate-pulse" />
      </div>
    );
  }

  return (
    <div className="text-center space-y-0.5 sm:space-y-1">
      <h2 className="text-base sm:text-lg font-semibold text-foreground truncate px-2 leading-tight">
        {track.title}
      </h2>
      <p className="text-sm text-muted-foreground truncate px-2">
        {track.artist}
      </p>
      {track.album && (
        <p className="text-[10px] sm:text-xs text-muted-foreground/70 truncate px-2">
          {track.album} {track.year && `• ${track.year}`}
        </p>
      )}
      {track.genre && (
        <div className="pt-0.5 sm:pt-1">
          <span className="inline-block px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs bg-muted text-muted-foreground rounded-full">
            {track.genre}
          </span>
        </div>
      )}
    </div>
  );
}
