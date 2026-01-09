import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { usePlayer } from '@/hooks/usePlayer';
import { useDiscogsAuth } from '@/hooks/useDiscogsAuth';
import { useDiscogsData } from '@/hooks/useDiscogsData';
import { useYouTubeSearch } from '@/hooks/useYouTubeSearch';
import { YouTubePlayer } from './YouTubePlayer';
import { AlbumArt } from './AlbumArt';
import { Timeline } from './Timeline';
import { PlayerControls } from './PlayerControls';
import { TrackInfo } from './TrackInfo';
import { PlaylistSidebar } from './PlaylistSidebar';
import { DiscogsConnect } from './DiscogsConnect';
import { SourceFilters, SourceType } from './SourceFilters';
import { Track } from '@/types/track';
import { Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Player() {
  const { 
    credentials, 
    isAuthenticated, 
    isAuthenticating, 
    error: authError, 
    startAuth, 
    logout 
  } = useDiscogsAuth();
  
  const { isLoading: isLoadingData, error: dataError, fetchAllTracks } = useDiscogsData(credentials);
  const { searchForVideo, isSearching } = useYouTubeSearch();
  const [discogsTracks, setDiscogsTracks] = useState<Track[]>([]);
  const [hasLoadedDiscogs, setHasLoadedDiscogs] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const lastSearchedTrackId = useRef<string>('');
  const fallbackAttemptedRef = useRef<Set<string>>(new Set());
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
    isLiked,
    isDisliked,
    playerRef,
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
    skipForward,
    skipBackward,
    likeTrack,
    dislikeTrack,
    selectTrack,
    toggleVideo,
    setIsPlaying,
    setPlaylist,
  } = usePlayer(filteredTracks);

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
      return;
    }
    
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
        console.log('No video found for:', currentTrack.title);
        setCurrentVideoId('');
      }
    });
  }, [currentTrack, searchForVideo]);

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

      // 150/101: embedding disabled / not allowed
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

  if (!currentTrack) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-bold text-foreground">Discogs Radio</h1>
          <p className="text-muted-foreground">Connect your Discogs account to start listening</p>
        </div>
        <DiscogsConnect
          isAuthenticated={isAuthenticated}
          isAuthenticating={isAuthenticating}
          username={credentials?.username}
          error={authError || dataError}
          onConnect={startAuth}
          onDisconnect={logout}
        />
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
          onClick={() => setHasUserInteracted(true)}
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
      <div className="flex-1 flex flex-col">
        {/* Album art / Video area */}
        <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-card to-background">
          <YouTubePlayer
            videoId={currentVideoId || currentTrack.youtubeId}
            searchQuery={!currentVideoId && !currentTrack.youtubeId ? `${currentTrack.artist} ${currentTrack.title}` : undefined}
            isPlaying={isPlaying}
            showVideo={showVideo}
            playerRef={playerRef}
            onStateChange={handlePlayerStateChange}
            onError={handlePlayerError}
            onReady={() => {}}
          />
          <AlbumArt
            track={currentTrack}
            isPlaying={isPlaying}
            showVideo={showVideo}
            onClick={toggleVideo}
          />

          {/* YouTube search indicator */}
          {isSearching && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Finding video...</span>
            </div>
          )}

          {/* Video toggle hint when showing video */}
          {showVideo && (
            <button
              onClick={toggleVideo}
              className="absolute bottom-4 right-4 z-20 bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Show album art
            </button>
          )}
        </div>

        {/* Controls area */}
        <div className="bg-card border-t border-border p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <TrackInfo track={currentTrack} />
            <div className="flex items-center gap-4">
              <SourceFilters
                activeSources={activeSources}
                onToggleSource={handleToggleSource}
                trackCounts={trackCounts}
              />
              <div className="hidden md:block">
                <DiscogsConnect
                  isAuthenticated={isAuthenticated}
                  isAuthenticating={isAuthenticating}
                  username={credentials?.username}
                  error={authError}
                  onConnect={startAuth}
                  onDisconnect={logout}
                />
              </div>
            </div>
          </div>
          
          <div className="max-w-xl mx-auto w-full">
            <Timeline
              currentTime={currentTime}
              duration={currentTrack.duration}
              onSeek={seekTo}
            />
          </div>

          <PlayerControls
            isPlaying={isPlaying}
            isLiked={isLiked}
            isDisliked={isDisliked}
            onTogglePlay={togglePlay}
            onSkipPrev={skipPrev}
            onSkipNext={skipNext}
            onSkipBackward={skipBackward}
            onSkipForward={skipForward}
            onLike={likeTrack}
            onDislike={dislikeTrack}
          />
        </div>
      </div>

      {/* Playlist sidebar */}
      <div className="hidden md:block w-80 lg:w-96">
        <PlaylistSidebar
          playlist={playlist}
          currentIndex={currentIndex}
          onSelectTrack={selectTrack}
        />
      </div>
    </div>
  );
}
