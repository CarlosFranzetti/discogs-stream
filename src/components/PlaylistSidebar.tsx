import { useState, useRef, useEffect } from 'react';
import { Track } from '@/types/track';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Music, Disc, Ban, Loader2 } from 'lucide-react';

interface PlaylistSidebarProps {
  playlist: Track[];
  currentIndex: number;
  onSelectTrack: (index: number) => void;
  onRetryTrack?: (track: Track) => void;
}

export function PlaylistSidebar({ playlist, currentIndex, onSelectTrack, onRetryTrack }: PlaylistSidebarProps) {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const retriedOnce = useRef<Set<string>>(new Set());

  // When a retrying track gets resolved, clear the retryingId
  useEffect(() => {
    if (!retryingId) return;
    const track = playlist.find(t => t.id === retryingId);
    if (track?.workingStatus === 'working' && track?.youtubeId) {
      setRetryingId(null);
    }
  }, [playlist, retryingId]);

  const handleTrackClick = (track: Track, index: number) => {
    const isNonWorking = track.workingStatus === 'non_working';

    if (!isNonWorking) {
      onSelectTrack(index);
      return;
    }

    // Non-working track: first click retries, second click plays if resolved
    if (retryingId === track.id) {
      // Currently retrying — if it resolved, play; otherwise ignore
      if (track.youtubeId && track.workingStatus === 'working') {
        onSelectTrack(index);
      }
      return;
    }

    if (retriedOnce.current.has(track.id)) {
      // Already retried before — check if now working
      if (track.youtubeId && track.workingStatus === 'working') {
        onSelectTrack(index);
      }
      return;
    }

    // First click on a non_working track: trigger background retry
    retriedOnce.current.add(track.id);
    setRetryingId(track.id);
    onRetryTrack?.(track);
  };

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
          {playlist.map((track, index) => {
            const isNonWorking = track.workingStatus === 'non_working';
            const isPending = !track.youtubeId && track.workingStatus !== 'working' && !isNonWorking;
            const isRetrying = retryingId === track.id;
            const opacityClass = isNonWorking ? 'opacity-50' : isPending ? 'opacity-75' : '';
            const cursorClass = isNonWorking
              ? isRetrying ? 'cursor-wait' : 'cursor-pointer'
              : 'cursor-pointer';

            return (
              <div
                key={track.id}
                onClick={() => handleTrackClick(track, index)}
                className={`track-item ${index === currentIndex ? 'active' : ''} ${opacityClass} ${cursorClass}`}
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
                  {/* Status badge — bottom right of cover */}
                  {isRetrying && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-background/80 rounded-tl flex items-center justify-center">
                      <Loader2 className="w-2.5 h-2.5 text-primary animate-spin" />
                    </div>
                  )}
                  {isNonWorking && !isRetrying && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-background/80 rounded-tl flex items-center justify-center">
                      <Ban className="w-2.5 h-2.5 text-muted-foreground" />
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
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
