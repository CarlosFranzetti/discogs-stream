import { Track } from '@/types/track';
import { Badge } from '@/components/ui/badge';

interface TrackInfoProps {
  track: Track;
}

export function TrackInfo({ track }: TrackInfoProps) {
  const sourceColors = {
    collection: 'bg-primary/20 text-primary border-primary/30',
    wantlist: 'bg-accent/20 text-accent border-accent/30',
    similar: 'bg-secondary text-secondary-foreground border-secondary',
  };

  const sourceLabels = {
    collection: 'Collection',
    wantlist: 'Want List',
    similar: 'Similar',
  };

  return (
    <div className="text-center space-y-2">
      <div className="flex items-center justify-center gap-2">
        <Badge variant="outline" className={sourceColors[track.source]}>
          {sourceLabels[track.source]}
        </Badge>
        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted">
          {track.year}
        </Badge>
      </div>
      <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground truncate max-w-md">
        {track.title}
      </h2>
      <p className="text-lg text-muted-foreground truncate max-w-sm">
        {track.artist}
      </p>
      <p className="text-sm text-muted-foreground/70 truncate max-w-sm">
        {track.album} • {track.label}
      </p>
    </div>
  );
}
