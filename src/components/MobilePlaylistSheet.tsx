import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Track } from '@/types/track';
import { Music, Heart, ShoppingCart, Disc3, LogOut, User } from 'lucide-react';

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
}

export function MobilePlaylistSheet({
  isOpen,
  onClose,
  playlist,
  currentIndex,
  onSelectTrack,
  isDiscogsAuthenticated,
  discogsUsername,
  onDisconnectDiscogs,
  isUserLoggedIn,
  userEmail,
  onSignOut,
}: MobilePlaylistSheetProps) {
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'wantlist':
        return <Heart className="w-3 h-3" />;
      case 'similar':
        return <ShoppingCart className="w-3 h-3" />;
      default:
        return <Disc3 className="w-3 h-3" />;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[320px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Music className="w-4 h-4 text-primary" />
            Up Next
          </SheetTitle>
          <p className="text-xs text-muted-foreground">{playlist.length} tracks in queue</p>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="py-2">
            {playlist.map((track, index) => (
              <button
                key={track.id}
                onClick={() => {
                  onSelectTrack(index);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                  index === currentIndex
                    ? 'bg-primary/10 border-l-2 border-primary'
                    : 'hover:bg-muted/50'
                }`}
              >
                {/* Track number / playing indicator */}
                <div className="w-6 text-center shrink-0">
                  {index === currentIndex ? (
                    <span className="text-primary text-lg">•</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{index + 1}</span>
                  )}
                </div>

                {/* Cover */}
                <div className="w-10 h-10 rounded overflow-hidden bg-muted shrink-0 relative">
                  {track.coverUrl && track.coverUrl !== '/placeholder.svg' && !track.coverUrl.includes('placeholder') ? (
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs bg-gradient-to-br from-primary/20 to-accent/20">
                      🎵
                    </div>
                  )}
                </div>

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${index === currentIndex ? 'text-primary font-medium' : 'text-foreground'}`}>
                    {track.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                </div>

                {/* Source indicator */}
                <div className="text-muted-foreground shrink-0">
                  {getSourceIcon(track.source)}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Footer with user info */}
        <div className="border-t border-border p-4 space-y-3">
          {/* Discogs connection */}
          {isDiscogsAuthenticated && discogsUsername && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-success">●</span>
                <span className="text-muted-foreground">Connected to Discogs</span>
              </div>
            </div>
          )}
          
          {/* User info */}
          {isUserLoggedIn && userEmail && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>{userEmail.split('@')[0]}</span>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
