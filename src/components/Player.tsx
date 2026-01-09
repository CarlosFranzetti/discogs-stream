import { useEffect, useState, useRef } from 'react';
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
import { Track } from '@/types/track';
import { Loader2 } from 'lucide-react';

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
  } = usePlayer(discogsTracks);

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

  // Update playlist when discogs tracks change
  useEffect(() => {
    if (discogsTracks.length > 0 && setPlaylist) {
      setPlaylist(discogsTracks);
    }
  }, [discogsTracks, setPlaylist]);

  // Auto-search for YouTube video when track changes
  useEffect(() => {
    if (currentTrack && currentTrack.id !== lastSearchedTrackId.current) {
      lastSearchedTrackId.current = currentTrack.id;
      
      if (currentTrack.youtubeId) {
        setCurrentVideoId(currentTrack.youtubeId);
      } else {
        // Search for the video
        searchForVideo(currentTrack).then((videoId) => {
          if (videoId) {
            setCurrentVideoId(videoId);
            // Update the track in the playlist with the found videoId
            setDiscogsTracks((prev) =>
              prev.map((t) =>
                t.id === currentTrack.id ? { ...t, youtubeId: videoId } : t
              )
            );
          } else {
            setCurrentVideoId('');
          }
        });
      }
    }
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
          <div className="flex items-center justify-between">
            <TrackInfo track={currentTrack} />
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
