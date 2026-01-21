import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '@/hooks/usePlayer';
import { useDiscogsAuth } from '@/hooks/useDiscogsAuth';
import { useDiscogsData } from '@/hooks/useDiscogsData';
import { useYouTubeSearch } from '@/hooks/useYouTubeSearch';
import { useAuth } from '@/hooks/useAuth';
import { useTrackPreferences } from '@/hooks/useTrackPreferences';
import { YouTubePlayer } from './YouTubePlayer';
import { MobileAlbumCover } from './MobileAlbumCover';
import { MobileTrackInfo } from './MobileTrackInfo';
import { MobileTimeline } from './MobileTimeline';
import { MobileTransportControls } from './MobileTransportControls';
import { MobilePlaylistSheet } from './MobilePlaylistSheet';
import { MobileTitleScreen } from './MobileTitleScreen';
import { Track } from '@/types/track';
import { Loader2, Radio, Menu, Volume2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { SourceType } from './SourceFilters';

export function MobilePlayer() {
  const navigate = useNavigate();
  
  // User auth
  const { user, isAuthenticated: isUserLoggedIn, signOut } = useAuth();
  
  // Track preferences (persisted)
  const {
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [volume, setVolume] = useState(100);

  // Filter tracks by active sources
  const filteredTracks = useMemo(() => {
    return discogsTracks.filter(track => activeSources.includes(track.source));
  }, [discogsTracks, activeSources]);

  const handleToggleSource = useCallback((source: SourceType) => {
    setActiveSources(prev => {
      if (prev.includes(source)) {
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
    playerRef,
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
    skipForward,
    skipBackward,
    selectTrack,
    setIsPlaying,
    setPlaylist,
    removeFromPlaylist,
  } = usePlayer(filteredTracks, persistedDislikedTracks);

  // Handle volume change
  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (playerRef.current) {
      playerRef.current.setVolume(newVolume);
    }
  }, [playerRef]);

  // Like/dislike handlers
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
    if (currentTrack.id === lastSearchedTrackId.current) return;
    lastSearchedTrackId.current = currentTrack.id;
    
    if (currentTrack.youtubeId) {
      setCurrentVideoId(currentTrack.youtubeId);
    } else {
      searchForVideo(currentTrack).then((videoId) => {
        if (videoId) {
          setCurrentVideoId(videoId);
          setDiscogsTracks((prev) =>
            prev.map((t) =>
              t.id === currentTrack.id ? { ...t, youtubeId: videoId } : t
            )
          );
        } else {
          setCurrentVideoId('');
          skipNext();
        }
      });
    }
  }, [currentTrack, searchForVideo, skipNext]);

  // Pre-fetch YouTube IDs for next 4 tracks
  useEffect(() => {
    if (!playlist.length || currentIndex < 0) return;

    const upcomingTracks = playlist
      .slice(currentIndex + 1, currentIndex + 5)
      .filter((t) => !t.youtubeId && !prefetchedRef.current.has(t.id));

    if (upcomingTracks.length === 0) return;

    upcomingTracks.forEach((t) => prefetchedRef.current.add(t.id));

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
    if (state === 0) skipNext();
    if (state === 1) setIsPlaying(true);
    if (state === 2) setIsPlaying(false);
  };

  const handlePlayerError = useCallback(
    async (code: number) => {
      if (!currentTrack) return;

      if (code === 100 || code === 2 || code === 5) {
        skipNext();
        return;
      }

      if (code !== 150 && code !== 101) return;

      if (fallbackAttemptedRef.current.has(currentTrack.id)) {
        skipNext();
        return;
      }

      fallbackAttemptedRef.current.add(currentTrack.id);

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

  const handleStartListening = useCallback(() => {
    setHasUserInteracted(true);
    setTimeout(() => {
      playerRef.current?.playVideo();
    }, 100);
  }, [playerRef]);

  // Loading states
  if (isAuthenticating) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Connecting to Discogs...</p>
      </div>
    );
  }

  if (isAuthenticated && isLoadingData && discogsTracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading your collection from Discogs...</p>
      </div>
    );
  }

  // Title screen
  if (!hasUserInteracted) {
    return (
      <>
        {/* Hidden YouTube player for preload */}
        <div className="absolute opacity-0 pointer-events-none" style={{ width: 1, height: 1, overflow: 'hidden' }}>
          <YouTubePlayer
            videoId={currentVideoId || currentTrack?.youtubeId || ''}
            searchQuery={!currentVideoId && !currentTrack?.youtubeId && currentTrack ? `${currentTrack.artist} ${currentTrack.title}` : undefined}
            isPlaying={false}
            showVideo={false}
            playerRef={playerRef}
            onStateChange={handlePlayerStateChange}
            onError={handlePlayerError}
            onReady={() => {}}
          />
        </div>
        <MobileTitleScreen
          isDiscogsAuthenticated={isAuthenticated}
          isDiscogsAuthenticating={isAuthenticating}
          discogsUsername={credentials?.username}
          discogsError={authError || dataError}
          onConnectDiscogs={startAuth}
          onDisconnectDiscogs={logout}
          isUserLoggedIn={isUserLoggedIn}
          userEmail={user?.email}
          onSignOut={signOut}
          onNavigateAuth={() => navigate('/auth')}
          activeSources={activeSources}
          onToggleSource={handleToggleSource}
          onStartListening={handleStartListening}
        />
      </>
    );
  }

  // Main player view
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden max-w-md mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Radio className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-tight">Discogs</h1>
            <span className="text-xs text-primary">Radio</span>
          </div>
        </div>
        
        {/* Volume control */}
        <div className="flex items-center gap-2 flex-1 max-w-32 mx-4">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <Slider
            value={[volume]}
            onValueChange={handleVolumeChange}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Username / Menu */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          {credentials?.username && <span>{credentials.username}</span>}
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col px-4 py-4 overflow-hidden">
        {/* Album cover */}
        <div className="relative w-full max-w-[280px] mx-auto aspect-square mb-4">
          <MobileAlbumCover
            track={currentTrack}
            isPlaying={isPlaying}
            onClick={togglePlay}
          />
          
          {isSearching && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
              <div className="flex flex-col items-center gap-1 text-white">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs">Finding...</span>
              </div>
            </div>
          )}
        </div>

        {/* Source badge */}
        {currentTrack && (
          <div className="flex justify-center mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-muted text-muted-foreground border border-border">
              {currentTrack.source === 'wantlist' ? '♡ Wantlist' : '◎ Collection'}
            </span>
          </div>
        )}

        {/* Track info */}
        <MobileTrackInfo track={currentTrack} />

        {/* Divider */}
        <div className="border-t border-border/50 my-4" />

        {/* Timeline */}
        <MobileTimeline
          currentTime={currentTime}
          duration={currentTrack?.duration || 0}
          onSeek={seekTo}
        />

        {/* Divider */}
        <div className="border-t border-border/50 my-4" />

        {/* Transport controls */}
        <MobileTransportControls
          isPlaying={isPlaying}
          isLiked={currentTrack ? isTrackLiked(currentTrack.id) : false}
          isDisliked={currentTrack ? isTrackDisliked(currentTrack.id) : false}
          onTogglePlay={togglePlay}
          onPrevious={skipPrev}
          onNext={skipNext}
          onSkipBackward={skipBackward}
          onSkipForward={skipForward}
          onLike={handleLikeTrack}
          onDislike={handleDislikeTrack}
        />
      </main>

      {/* Hidden YouTube player */}
      <div className="absolute opacity-0 pointer-events-none" style={{ width: 1, height: 1, overflow: 'hidden' }}>
        <YouTubePlayer
          videoId={currentVideoId || currentTrack?.youtubeId || ''}
          searchQuery={!currentVideoId && !currentTrack?.youtubeId && currentTrack ? `${currentTrack.artist} ${currentTrack.title}` : undefined}
          isPlaying={isPlaying}
          showVideo={false}
          playerRef={playerRef}
          onStateChange={handlePlayerStateChange}
          onError={handlePlayerError}
          onReady={() => {}}
        />
      </div>

      {/* Playlist sidebar sheet */}
      <MobilePlaylistSheet
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        playlist={playlist}
        currentIndex={currentIndex}
        onSelectTrack={selectTrack}
        isDiscogsAuthenticated={isAuthenticated}
        discogsUsername={credentials?.username}
        onDisconnectDiscogs={logout}
        isUserLoggedIn={isUserLoggedIn}
        userEmail={user?.email}
        onSignOut={signOut}
      />
    </div>
  );
}
