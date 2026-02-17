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
    <div className="text-center space-y-0.5">
      <h2 className="text-base font-semibold text-foreground truncate px-2 leading-tight">
        {track.title}
      </h2>
      <p className="text-sm text-muted-foreground truncate px-2">
        {track.artist}
      </p>
      {track.album && (
        <p className="text-[11px] text-muted-foreground/60 truncate px-2">
          {track.album} {track.year && `• ${track.year}`}
        </p>
      )}
      {track.genre && (
        <span className="inline-block px-2 py-px text-xs bg-muted text-muted-foreground/70 rounded-full">
          {track.genre}
        </span>
      )}
    </div>
  );
}
