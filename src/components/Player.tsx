import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '@/hooks/usePlayer';
import { useDiscogsAuth } from '@/hooks/useDiscogsAuth';
import { useDiscogsData } from '@/hooks/useDiscogsData';
import { useYouTubeSearch } from '@/hooks/useYouTubeSearch';
import { useAuth } from '@/hooks/useAuth';
import { useTrackPreferences } from '@/hooks/useTrackPreferences';
import { YouTubePlayer } from './YouTubePlayer';
import { AlbumArt } from './AlbumArt';
import { Timeline } from './Timeline';
import { PlayerControls } from './PlayerControls';
import { TrackInfo } from './TrackInfo';
import { PlaylistSidebar } from './PlaylistSidebar';
import { DiscogsConnect } from './DiscogsConnect';
import { SourceFilters, SourceType } from './SourceFilters';
import { Track } from '@/types/track';
import { Loader2, Play, User, Library, Disc, Heart } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

// Simple toggle component for sources
function SourceToggle({ 
  label, 
  icon, 
  isActive, 
  onToggle 
}: { 
  label: string; 
  icon: React.ReactNode; 
  isActive: boolean; 
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
        isActive 
          ? 'bg-primary text-primary-foreground border-primary' 
          : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      <div className={`w-8 h-5 rounded-full relative ml-2 transition-colors ${isActive ? 'bg-primary-foreground/30' : 'bg-border'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-background transition-all ${isActive ? 'left-3.5' : 'left-0.5'}`} />
      </div>
    </button>
  );
}
import { Button } from '@/components/ui/button';

export function Player() {
  const navigate = useNavigate();
  
  // User auth
  const { user, isAuthenticated: isUserLoggedIn, signOut } = useAuth();
  
  // Track preferences (persisted)
  const {
    likedTracks: persistedLikedTracks,
    dislikedTracks: persistedDislikedTracks,
    likeTrack: persistLike,
    dislikeTrack: persistDislike,
    isLiked: isTrackLiked,
    isDisliked: isTrackDisliked,
  } = useTrackPreferences(user?.id);

  const { 
    credentials, 
    isAuthenticated, 
    isAuthenticating, 
    error: authError, 
    startAuth, 
    logout 
  } = useDiscogsAuth();
  
  const { isLoading: isLoadingData, error: dataError, fetchAllTracks } = useDiscogsData(credentials);
  const { searchForVideo, isSearching, prefetchVideos } = useYouTubeSearch();
  const [discogsTracks, setDiscogsTracks] = useState<Track[]>([]);
  const [hasLoadedDiscogs, setHasLoadedDiscogs] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const lastSearchedTrackId = useRef<string>('');
  const fallbackAttemptedRef = useRef<Set<string>>(new Set());
  const prefetchedRef = useRef<Set<string>>(new Set());
  const [activeSources, setActiveSources] = useState<SourceType[]>(['collection', 'wantlist']);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Filter tracks by active sources
  const filteredTracks = useMemo(() => {
    return discogsTracks.filter(track => activeSources.includes(track.source));
  }, [discogsTracks, activeSources]);

  // Track counts per source
  const trackCounts = useMemo(() => {
    const counts: Record<SourceType, number> = { collection: 0, wantlist: 0, similar: 0 };
    discogsTracks.forEach(track => {
      if (track.source in counts) {
        counts[track.source]++;
      }
    });
    return counts;
  }, [discogsTracks]);

  const handleToggleSource = useCallback((source: SourceType) => {
    setActiveSources(prev => {
      if (prev.includes(source)) {
        // Don't allow deselecting all sources
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== source);
      }
      return [...prev, source];
    });
  }, []);

  const {
    playlist,
    currentTrack,
    currentIndex,
    isPlaying,
    currentTime,
    showVideo,
    playerRef,
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
    skipForward,
    skipBackward,
    selectTrack,
    toggleVideo,
    setIsPlaying,
    setPlaylist,
    removeFromPlaylist,
  } = usePlayer(filteredTracks, persistedDislikedTracks);

  // Like/dislike handlers that persist to database
  const handleLikeTrack = useCallback(() => {
    if (!currentTrack) return;
    persistLike(currentTrack);
  }, [currentTrack, persistLike]);

  const handleDislikeTrack = useCallback(() => {
    if (!currentTrack) return;
    persistDislike(currentTrack);
    removeFromPlaylist(currentTrack.id);
    skipNext();
  }, [currentTrack, persistDislike, removeFromPlaylist, skipNext]);

  // Load Discogs tracks when authenticated
  useEffect(() => {
    if (isAuthenticated && credentials && !hasLoadedDiscogs) {
      const loadTracks = async () => {
        const tracks = await fetchAllTracks(100);
        if (tracks.length > 0) {
          setDiscogsTracks(tracks);
          setHasLoadedDiscogs(true);
        }
      };
      loadTracks();
    }
  }, [isAuthenticated, credentials, hasLoadedDiscogs, fetchAllTracks]);

  // Update playlist when filtered tracks change
  useEffect(() => {
    if (filteredTracks.length > 0 && setPlaylist) {
      setPlaylist(filteredTracks);
    }
  }, [filteredTracks, setPlaylist]);

  // Auto-search for YouTube video when track changes
  useEffect(() => {
    if (!currentTrack) return;
    
    // If this track was already searched, skip
    if (currentTrack.id === lastSearchedTrackId.current) return;
    lastSearchedTrackId.current = currentTrack.id;
    
    // If track already has a youtubeId, use it immediately
    if (currentTrack.youtubeId) {
      console.log('Using existing youtubeId:', currentTrack.youtubeId, 'for', currentTrack.title);
      setCurrentVideoId(currentTrack.youtubeId);
    } else {
      // Search for the video
      console.log('Searching for video:', currentTrack.artist, currentTrack.title);
      searchForVideo(currentTrack).then((videoId) => {
        if (videoId) {
          console.log('Found video:', videoId);
          setCurrentVideoId(videoId);
          // Update the track in the playlist with the found videoId
          setDiscogsTracks((prev) =>
            prev.map((t) =>
              t.id === currentTrack.id ? { ...t, youtubeId: videoId } : t
            )
          );
        } else {
          console.log('No video found for:', currentTrack.title, '- skipping');
          setCurrentVideoId('');
          // Skip to next track if no video found
          skipNext();
        }
      });
    }
  }, [currentTrack, searchForVideo, skipNext]);

  // Pre-fetch YouTube IDs for next 4 tracks in the queue
  useEffect(() => {
    if (!playlist.length || currentIndex < 0) return;

    const upcomingTracks = playlist
      .slice(currentIndex + 1, currentIndex + 5)
      .filter((t) => !t.youtubeId && !prefetchedRef.current.has(t.id));

    if (upcomingTracks.length === 0) return;

    // Mark as being prefetched
    upcomingTracks.forEach((t) => prefetchedRef.current.add(t.id));

    console.log('Pre-fetching YouTube IDs for', upcomingTracks.length, 'upcoming tracks');
    prefetchVideos(upcomingTracks).then((results) => {
      if (results.size > 0) {
        setDiscogsTracks((prev) =>
          prev.map((t) => {
            const videoId = results.get(t.id);
            return videoId ? { ...t, youtubeId: videoId } : t;
          })
        );
      }
    });
  }, [currentIndex, playlist, prefetchVideos]);

  const handlePlayerStateChange = (state: number) => {
    // YT.PlayerState.ENDED = 0
    if (state === 0) {
      skipNext();
    }
    // YT.PlayerState.PLAYING = 1
    if (state === 1) {
      setIsPlaying(true);
    }
    // YT.PlayerState.PAUSED = 2
    if (state === 2) {
      setIsPlaying(false);
    }
  };

  const handlePlayerError = useCallback(
    async (code: number) => {
      if (!currentTrack) return;

      // Error codes:
      // 2: Invalid parameter value
      // 5: HTML5 player error
      // 100: Video not found or removed
      // 101/150: Embedding disabled / not allowed
      console.warn('YouTube player error:', code, 'for track:', currentTrack.title);

      // For 100 (not found) or 2/5 (invalid/player error), skip immediately
      if (code === 100 || code === 2 || code === 5) {
        console.warn('Video unavailable (code', code, '), skipping track:', currentTrack.title);
        skipNext();
        return;
      }

      // 150/101: embedding disabled / not allowed - try alternative
      if (code !== 150 && code !== 101) return;

      // Avoid infinite loops per track
      if (fallbackAttemptedRef.current.has(currentTrack.id)) {
        console.warn('Embed blocked and fallback already attempted, skipping track:', currentTrack.title);
        skipNext();
        return;
      }

      fallbackAttemptedRef.current.add(currentTrack.id);
      console.warn('Embed blocked (code', code, ') - searching for embeddable alternative for:', currentTrack.title);

      const altId = await searchForVideo(currentTrack, { force: true, maxResults: 8 });

      if (altId) {
        setCurrentVideoId(altId);
        setDiscogsTracks((prev) =>
          prev.map((t) => (t.id === currentTrack.id ? { ...t, youtubeId: altId } : t))
        );
        return;
      }

      skipNext();
    },
    [currentTrack, searchForVideo, skipNext]
  );

  // Show loading state when fetching Discogs data
  if (isAuthenticated && isLoadingData && discogsTracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading your collection from Discogs...</p>
      </div>
    );
  }

  // Title screen: show when no tracks loaded or not authenticated
  if (!hasLoadedDiscogs || discogsTracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-8 p-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-display font-bold text-foreground">Discogs Radio</h1>
          <p className="text-muted-foreground">Stream music from your Discogs collection</p>
        </div>

        {/* Discogs Connection */}
        <div className="w-full max-w-sm">
          <DiscogsConnect
            isAuthenticated={isAuthenticated}
            isAuthenticating={isAuthenticating}
            username={credentials?.username}
            error={authError || dataError}
            onConnect={startAuth}
            onDisconnect={logout}
          />
        </div>

        {/* Source Toggles - only show when connected */}
        {isAuthenticated && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">Select sources to include:</p>
            <div className="flex gap-3">
              <SourceToggle
                label="Collection"
                icon={<Disc className="w-4 h-4" />}
                isActive={activeSources.includes('collection')}
                onToggle={() => handleToggleSource('collection')}
              />
              <SourceToggle
                label="Wantlist"
                icon={<Heart className="w-4 h-4" />}
                isActive={activeSources.includes('wantlist')}
                onToggle={() => handleToggleSource('wantlist')}
              />
            </div>
          </div>
        )}

        {/* User Login */}
        <div className="flex flex-col items-center gap-2">
          {isUserLoggedIn ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Signed in as {user?.email?.split('@')[0]}</span>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate('/auth')} className="gap-2">
              <User className="w-4 h-4" />
              Sign in to save likes
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Show start button if user hasn't interacted yet (needed for autoplay)
  if (!hasUserInteracted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-6">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-display font-bold text-foreground">Discogs Radio</h1>
          <p className="text-muted-foreground">Ready to play from your collection</p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>{trackCounts.collection} in collection</span>
            <span>•</span>
            <span>{trackCounts.wantlist} in wantlist</span>
          </div>
        </div>
        <SourceFilters
          activeSources={activeSources}
          onToggleSource={handleToggleSource}
          trackCounts={trackCounts}
        />
        <Button 
          size="lg" 
          onClick={() => {
            setHasUserInteracted(true);
            // Trigger play after a small delay to allow YouTube player to initialize
            setTimeout(() => {
              playerRef.current?.playVideo();
            }, 500);
          }}
          className="gap-2 px-8"
        >
          <Play className="w-5 h-5" />
          Start Listening
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Main player area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Album art / Video area - compact height */}
        <div className="relative flex-shrink-0 h-72 sm:h-80 md:h-96 bg-gradient-to-b from-card to-background flex items-center justify-center">
          <AlbumArt
            track={currentTrack}
            isPlaying={isPlaying}
            showVideo={false}
            onClick={togglePlay}
          />

          {/* YouTube player as PIP in corner */}
          <YouTubePlayer
            videoId={currentVideoId || currentTrack.youtubeId}
            searchQuery={!currentVideoId && !currentTrack.youtubeId ? `${currentTrack.artist} ${currentTrack.title}` : undefined}
            isPlaying={isPlaying}
            showVideo={false}
            playerRef={playerRef}
            onStateChange={handlePlayerStateChange}
            onError={handlePlayerError}
            onReady={() => {}}
          />

          {/* YouTube search indicator */}
          {isSearching && (
            <div className="absolute top-3 left-3 z-30 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-1">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Finding video...</span>
            </div>
          )}
        </div>

        {/* Controls area - more compact with proper spacing */}
        <div className="bg-card border-t border-border p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TrackInfo track={currentTrack} />
            <div className="flex items-center gap-2 flex-wrap">
              <SourceFilters
                activeSources={activeSources}
                onToggleSource={handleToggleSource}
                trackCounts={trackCounts}
              />
              <div className="hidden lg:block">
                <DiscogsConnect
                  isAuthenticated={isAuthenticated}
                  isAuthenticating={isAuthenticating}
                  username={credentials?.username}
                  error={authError}
                  onConnect={startAuth}
                  onDisconnect={logout}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/library')}
                className="gap-1.5"
              >
                <Library className="w-4 h-4" />
                <span className="hidden sm:inline">Library</span>
              </Button>
              {isUserLoggedIn ? (
                <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-1.5">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{user?.email?.split('@')[0]}</span>
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => navigate('/auth')} className="gap-1.5">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign in</span>
                </Button>
              )}
            </div>
          </div>
          
          <div className="max-w-md mx-auto w-full py-2">
            <Timeline
              currentTime={currentTime}
              duration={currentTrack.duration}
              onSeek={seekTo}
            />
          </div>

          <PlayerControls
            isPlaying={isPlaying}
            isLiked={currentTrack ? isTrackLiked(currentTrack.id) : false}
            isDisliked={currentTrack ? isTrackDisliked(currentTrack.id) : false}
            onTogglePlay={togglePlay}
            onSkipPrev={skipPrev}
            onSkipNext={skipNext}
            onSkipBackward={skipBackward}
            onSkipForward={skipForward}
            onLike={handleLikeTrack}
            onDislike={handleDislikeTrack}
          />
        </div>
      </div>

      {/* Playlist sidebar - narrower */}
      <div className="hidden md:block w-64 lg:w-80 flex-shrink-0">
        <PlaylistSidebar
          playlist={playlist}
          currentIndex={currentIndex}
          onSelectTrack={selectTrack}
        />
      </div>
    </div>
  );
}
