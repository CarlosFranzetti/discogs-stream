import { Track } from '@/types/track';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Music, Disc } from 'lucide-react';

interface PlaylistSidebarProps {
  playlist: Track[];
  currentIndex: number;
  onSelectTrack: (index: number) => void;
}

export function PlaylistSidebar({ playlist, currentIndex, onSelectTrack }: PlaylistSidebarProps) {
  console.log(`[PlaylistSidebar] Rendering with ${playlist.length} tracks`);
  if (playlist.length > 0) {
    console.log('[PlaylistSidebar] First track cover URL:', playlist[0].coverUrl);
    console.log('[PlaylistSidebar] Current track cover URL:', playlist[currentIndex]?.coverUrl);
  }
  
  return (
    <div className="w-full h-full bg-card border-l border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Disc className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Up Next</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {playlist.length} tracks in queue
        </p>
      </div>

      {/* Track list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {playlist.map((track, index) => (
            <div
              key={track.id}
              onClick={() => onSelectTrack(index)}
              className={`track-item ${index === currentIndex ? 'active' : ''}`}
            >
              {/* Index or playing indicator */}
              <div className="w-6 flex-shrink-0 text-center">
                {index === currentIndex ? (
                  <div className="flex items-center justify-center">
                    <Music className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">{index + 1}</span>
                )}
              </div>

              {/* Cover art */}
              <div
                className="w-10 h-10 rounded-md bg-cover bg-center flex-shrink-0 relative overflow-hidden"
                style={track.coverUrl && track.coverUrl !== '/placeholder.svg' && !track.coverUrl.includes('placeholder') 
                  ? { backgroundImage: `url(${track.coverUrl})` }
                  : { background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2) 0%, hsl(var(--accent) / 0.2) 100%)' }
                }
              >
                {(!track.coverUrl || track.coverUrl === '/placeholder.svg' || track.coverUrl.includes('placeholder')) && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs">
                    🎵
                  </div>
                )}
              </div>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    index === currentIndex ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {track.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
              </div>

              {/* Source indicator */}
              <div className="flex-shrink-0">
                <div
                  className={`w-2 h-2 rounded-full ${
                    track.source === 'collection'
                      ? 'bg-primary'
                      : track.source === 'wantlist'
                      ? 'bg-accent'
                      : 'bg-muted-foreground'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
