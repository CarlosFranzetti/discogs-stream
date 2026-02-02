import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTrackPreferences } from '@/hooks/useTrackPreferences';
import { Track } from '@/types/track';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  Heart,
  ThumbsDown,
  Play,
  Trash2,
  Loader2,
  Music,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TrackRowProps {
  track: Track;
  onPlay: (track: Track) => void;
  onRemove: (track: Track) => void;
  isRemoving: boolean;
}

function TrackRow({ track, onPlay, onRemove, isRemoving }: TrackRowProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
      <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-muted">
        {track.coverUrl && track.coverUrl !== '/placeholder.svg' ? (
          <img
            src={track.coverUrl}
            alt={track.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        <button
          onClick={() => onPlay(track)}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Play className="w-5 h-5 text-white" fill="white" />
        </button>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{track.title}</p>
        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
        {track.album && (
          <p className="text-xs text-muted-foreground/70 truncate">{track.album}</p>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(track)}
        disabled={isRemoving}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        {isRemoving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}

export default function Library() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const { likedTracks, dislikedTracks, loadPreferences } = useTrackPreferences(user?.id);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handlePlay = useCallback(
    (track: Track) => {
      // Navigate to home and trigger playback of this track
      // We'll store the track in sessionStorage to be picked up by the Player
      sessionStorage.setItem('playTrack', JSON.stringify(track));
      navigate('/');
    },
    [navigate]
  );

  const handleRemove = useCallback(
    async (track: Track) => {
      if (!user?.id) return;

      setRemovingId(track.id);
      try {
        const { error } = await supabase
          .from('track_preferences')
          .delete()
          .eq('user_id', user.id)
          .eq('track_id', track.id);

        if (error) {
          console.error('Error removing preference:', error);
          toast({
            title: 'Error',
            description: 'Failed to remove track from library.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Removed',
            description: `"${track.title}" removed from library.`,
          });
          // Reload preferences to update the list
          await loadPreferences();
        }
      } catch (err) {
        console.error('Error removing preference:', err);
      } finally {
        setRemovingId(null);
      }
    },
    [user?.id, toast, loadPreferences]
  );

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4 p-4">
        <p className="text-muted-foreground text-center">
          Sign in to view your saved tracks
        </p>
        <Button onClick={() => navigate('/auth')}>Sign In</Button>
        <Button variant="ghost" onClick={() => navigate('/')}>
          Back to Player
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-4 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">My Library</h1>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="likes" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-4 w-fit">
          <TabsTrigger value="likes" className="gap-2">
            <Heart className="w-4 h-4" />
            Likes ({likedTracks.length})
          </TabsTrigger>
          <TabsTrigger value="dislikes" className="gap-2">
            <ThumbsDown className="w-4 h-4" />
            Dislikes ({dislikedTracks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="likes" className="flex-1 overflow-hidden m-0 p-4">
          <ScrollArea className="h-full">
            {likedTracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                <Heart className="w-8 h-8" />
                <p>No liked tracks yet</p>
                <p className="text-sm">Like tracks while listening to save them here</p>
              </div>
            ) : (
              <div className="space-y-1">
                {likedTracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    onPlay={handlePlay}
                    onRemove={handleRemove}
                    isRemoving={removingId === track.id}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="dislikes" className="flex-1 overflow-hidden m-0 p-4">
          <ScrollArea className="h-full">
            {dislikedTracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                <ThumbsDown className="w-8 h-8" />
                <p>No disliked tracks yet</p>
                <p className="text-sm">Disliked tracks are skipped automatically</p>
              </div>
            ) : (
              <div className="space-y-1">
                {dislikedTracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    onPlay={handlePlay}
                    onRemove={handleRemove}
                    isRemoving={removingId === track.id}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
