import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Track } from '@/types/track';
import { Music, Heart, ShoppingCart, Disc3, User, Ban, Search } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

type SourceType = 'collection' | 'wantlist';

interface MobilePlaylistSheetProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Track[];
  currentIndex: number;
  onSelectTrack: (index: number) => void;
  isDiscogsAuthenticated: boolean;
  discogsUsername?: string;
  onDisconnectDiscogs: () => void;
  isUserLoggedIn: boolean;
  userEmail?: string;
  onSignOut: () => void;
  activeSources?: SourceType[];
  onToggleSource?: (source: SourceType) => void;
}

export function MobilePlaylistSheet({
  isOpen,
  onClose,
  playlist,
  currentIndex,
  onSelectTrack,
  isDiscogsAuthenticated,
  discogsUsername,
  onDisconnectDiscogs: _onDisconnectDiscogs,
  isUserLoggedIn,
  userEmail,
  onSignOut: _onSignOut,
  activeSources,
  onToggleSource,
}: MobilePlaylistSheetProps) {
  const retryingId = null;
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'none' | 'artist' | 'title' | 'genre'>('none');
  const { settings } = useSettings();
  const isTight = settings.playlistSize === 'tight';

  // Determine which sources are present in the playlist
  const hasCollection = playlist.some(t => t.source === 'collection');
  const hasWantlist = playlist.some(t => t.source === 'wantlist');
  const showSourceFilter = (hasCollection && hasWantlist) && activeSources !== undefined;

  const displayedPlaylist = searchQuery.trim()
    ? playlist.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.artist.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : playlist;

  const sortedPlaylist = sortBy === 'none'
    ? displayedPlaylist
    : [...displayedPlaylist].sort((a, b) => {
        let va = '', vb = '';
        if (sortBy === 'artist') { va = a.artist; vb = b.artist; }
        else if (sortBy === 'title') { va = a.title; vb = b.title; }
        else if (sortBy === 'genre') { va = a.genre || ''; vb = b.genre || ''; }
        return va.localeCompare(vb);
      });

  const handleTrackClick = (track: Track, index: number) => {
    // Non-working tracks are display-only — not clickable
    if (track.workingStatus === 'non_working') return;

    onSelectTrack(index);
    onClose();
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'wantlist': return <Heart className="w-3 h-3" />;
      case 'similar': return <ShoppingCart className="w-3 h-3" />;
      default: return <Disc3 className="w-3 h-3" />;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-[320px] sm:w-[380px] p-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Music className="w-4 h-4 text-primary" />
            Up Next
          </SheetTitle>
        </SheetHeader>

        {/* Track count + user info (moved to top) */}
        <div className="border-b border-border px-4 py-2.5 space-y-1">
          <p className="text-xs text-muted-foreground">{playlist.length} tracks in queue</p>

          {isDiscogsAuthenticated && discogsUsername && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-success">●</span>
              <span className="text-muted-foreground">Connected to Discogs</span>
            </div>
          )}
          {isUserLoggedIn && userEmail && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>{userEmail.split('@')[0]}</span>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className={isTight ? 'py-1' : 'py-2'}>
            {sortedPlaylist.map((track, idx) => {
              const index = playlist.indexOf(track);
              const isNonWorking = track.workingStatus === 'non_working';
              const isPending = !track.youtubeId && track.workingStatus !== 'working' && !isNonWorking;
              void retryingId; // unused, kept for future retry UX
              const opacityClass = isNonWorking ? 'opacity-50' : isPending ? 'opacity-75' : '';
              const coverSize = isTight ? 'w-8 h-8' : 'w-10 h-10';
              const entryPadding = isTight ? 'py-1.5' : 'py-2.5';

              return (
                <div key={track.id}>
                  <button
                    onClick={() => handleTrackClick(track, index)}
                    className={`w-full flex items-center gap-2.5 px-4 ${entryPadding} transition-colors text-left ${
                      index === currentIndex
                        ? 'bg-primary/10 border-l-2 border-primary'
                        : isNonWorking
                        ? ''
                        : 'hover:bg-muted/50'
                    } ${opacityClass} ${isNonWorking ? 'cursor-not-allowed select-none' : 'cursor-pointer'}`}
                  >
                    {/* Track number / playing indicator */}
                    <div className="w-5 text-center shrink-0">
                      {index === currentIndex ? (
                        <span className="text-primary text-base">•</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">{index + 1}</span>
                      )}
                    </div>

                    {/* Cover */}
                    <div className={`${coverSize} rounded overflow-hidden bg-muted shrink-0 relative`}>
                      {track.coverUrl && track.coverUrl !== '/placeholder.svg' && !track.coverUrl.includes('placeholder') ? (
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs bg-gradient-to-br from-primary/20 to-accent/20">
                          🎵
                        </div>
                      )}
                      {isNonWorking && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-background/80 rounded-tl flex items-center justify-center">
                          <Ban className="w-2 h-2 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <p className={`${isTight ? 'text-xs' : 'text-sm'} truncate leading-tight ${index === currentIndex ? 'text-primary font-medium' : 'text-foreground'}`}>
                        {track.title}
                      </p>
                      <p className={`${isTight ? 'text-[10px]' : 'text-xs'} text-muted-foreground truncate leading-tight`}>{track.artist}</p>
                    </div>

                    {/* Source indicator */}
                    <div className="text-muted-foreground shrink-0">
                      {getSourceIcon(track.source)}
                    </div>
                  </button>

                  {/* Thin partial-width divider in tight mode */}
                  {isTight && idx < sortedPlaylist.length - 1 && (
                    <div className="mx-[52px] border-t border-border/10" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Search + sort chips (moved to bottom for thumb reach) */}
        <div className="px-4 py-2 border-t border-border">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search tracks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm flex-1 outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {(['artist', 'title', 'genre'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(prev => prev === key ? 'none' : key)}
                className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors capitalize ${
                  sortBy === key
                    ? 'bg-primary/15 text-primary border-primary'
                    : 'bg-muted text-muted-foreground border-transparent'
                }`}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
            {/* Source filter toggles */}
            {showSourceFilter && (
              <>
                <div className="w-px bg-border mx-0.5 self-stretch" />
                {(['collection', 'wantlist'] as const).map((src) => {
                  const active = activeSources!.includes(src);
                  return (
                    <button
                      key={src}
                      onClick={() => onToggleSource?.(src)}
                      className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors flex items-center gap-1 ${
                        active
                          ? 'bg-primary/15 text-primary border-primary'
                          : 'bg-muted text-muted-foreground/50 border-transparent line-through'
                      }`}
                    >
                      {src === 'collection' ? '◎' : '♡'} {src.charAt(0).toUpperCase() + src.slice(1)}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
