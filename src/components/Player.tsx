import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '@/hooks/usePlayer';
import { useDiscogsAuth } from '@/hooks/useDiscogsAuth';
import { useDiscogsData } from '@/hooks/useDiscogsData';
import { useAuth } from '@/hooks/useAuth';
import { useTrackPreferences } from '@/hooks/useTrackPreferences';
import { useTrackMediaResolver } from '@/hooks/useTrackMediaResolver';
import { useCSVCollection } from '@/hooks/useCSVCollection';
import { useYouTubeSearch } from '@/hooks/useYouTubeSearch';
import { useBackgroundVerifier } from '@/hooks/useBackgroundVerifier';
import { YouTubePlayer } from './YouTubePlayer';
import { BandcampPlayer } from './BandcampPlayer';
import { AlbumArt } from './AlbumArt';
import { Timeline } from './Timeline';
import { PlayerControls } from './PlayerControls';
import { TrackInfo } from './TrackInfo';
import { PlaylistSidebar } from './PlaylistSidebar';
import { DiscogsConnect } from './DiscogsConnect';
import { SourceFilters, SourceType } from './SourceFilters';
import { Track } from '@/types/track';
import { readDiscogsCache, writeDiscogsCache } from '@/data/discogsCache';
import { Loader2, Play, User, Library, Disc, Heart, Upload, FileText, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

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
  
  const { isLoading: isLoadingData, error: dataError, fetchAllTracks, fetchRelease } = useDiscogsData(credentials);
  const { resolveMediaForTrack, prefetchForTracks } = useTrackMediaResolver({
    fetchRelease,
    discogsUsername: credentials?.username,
  });
  const {
    collection: csvCollection,
    wantlist: csvWantlist,
    allTracks: csvAllTracks,
    hasCSVData,
    isLoading: isCSVLoading,
    error: csvError,
    loadCollectionCSV,
    loadWantlistCSV,
    clearAll: clearCSVData,
    updateTrack,
  } = useCSVCollection();
  const {
    searchForVideo,
    isSearching,
    prefetchVideos,
    markAsUnavailable,
    isQuotaExceeded,
    clearCache,
    getSearchUrl,
  } = useYouTubeSearch();
  const [discogsTracks, setDiscogsTracks] = useState<Track[]>([]);

  // Merge CSV tracks with Discogs tracks
  useEffect(() => {
    if (csvAllTracks.length > 0) {
      setDiscogsTracks(prev => {
        const csvIds = new Set(csvAllTracks.map(t => t.id));
        const filtered = prev.filter(t => !csvIds.has(t.id));
        return [...filtered, ...csvAllTracks];
      });
    }
  }, [csvAllTracks]);
  
  // Verification is now handled by the hook
  const [verifiedTracks, setVerifiedTracks] = useState<Track[]>([]);
  const verifiedTracksRef = useRef<Track[]>([]);
  
  // Sync verified tracks with discogsTracks
  useEffect(() => {
     setVerifiedTracks(discogsTracks);
  }, [discogsTracks]);

  useEffect(() => {
    verifiedTracksRef.current = verifiedTracks;
  }, [verifiedTracks]);
  const [lastFetchedKey, setLastFetchedKey] = useState<string | null>(null);
  const cacheHydratedRef = useRef<string | null>(null);
  const discogsTracksRef = useRef<Track[]>([]);
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const lastSearchedTrackId = useRef<string>('');
  const fallbackAttemptedRef = useRef<Set<string>>(new Set());
  const prefetchedRef = useRef<Set<string>>(new Set());
  const [activeSources, setActiveSources] = useState<SourceType[]>(['collection', 'wantlist']);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  useEffect(() => {
    discogsTracksRef.current = discogsTracks;
  }, [discogsTracks]);

  // Filter tracks by active sources - use verified tracks only
  const filteredTracks = useMemo(() => {
    return verifiedTracks.filter(track => activeSources.includes(track.source));
  }, [verifiedTracks, activeSources]);

  // Track counts per source
  const trackCounts = useMemo(() => {
    const counts: Record<SourceType, number> = { collection: 0, wantlist: 0, similar: 0 };
    verifiedTracks.forEach(track => {
      if (track.source in counts) {
        counts[track.source]++;
      }
    });
    return counts;
  }, [verifiedTracks]);

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
    isShuffle,
    toggleShuffle,
  } = usePlayer(filteredTracks, persistedDislikedTracks);

  // Comprehensive update function that handles both CSV and Discogs tracks
  const updateTrackWithVerification = useCallback((updatedTrack: Track) => {
    // Update CSV tracks in localStorage via useCSVCollection
    updateTrack(updatedTrack);
    
    // Also update verifiedTracks state for immediate UI update (works for all tracks)
    setVerifiedTracks(prev => {
      const idx = prev.findIndex(t => t.id === updatedTrack.id);
      if (idx === -1) return prev;
      const newTracks = [...prev];
      newTracks[idx] = updatedTrack;
      return newTracks;
    });
  }, [updateTrack]);

  // Background Verifier Hook
  const { isVerifying, progress: verifyProgress } = useBackgroundVerifier({
    tracks: verifiedTracks,
    currentTrack: playlist[currentIndex] || null,
    isPlaying,
    searchForVideo,
    resolveMediaForTrack,
    updateTrack: updateTrackWithVerification,
    isQuotaExceeded
  });

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

  useEffect(() => {
    const username = credentials?.username;
    if (!username) {
      cacheHydratedRef.current = null;
      return;
    }

    if (cacheHydratedRef.current === username) return;
    cacheHydratedRef.current = username;

    const cache = readDiscogsCache(username);
    if (!cache) return;

    setDiscogsTracks((prev) => (prev.length === 0 ? cache.discogsTracks : prev));
  }, [credentials?.username]);

  useEffect(() => {
    const username = credentials?.username;
    const fetchKey = username ? `discogs:${username}` : null;

    if (!isAuthenticated || !fetchKey) {
      if (!fetchKey) {
        setLastFetchedKey(null);
      }
      return;
    }

    if (lastFetchedKey === fetchKey) return;
    setLastFetchedKey(fetchKey);

    let cancelled = false;

    const loadTracks = async () => {
      try {
        const tracks = await fetchAllTracks(100);
        if (cancelled || tracks.length === 0) return;

        const knownMap = new Map(discogsTracksRef.current.map((t) => [t.id, t.youtubeId]));
        const merged = tracks.map((track) => ({
          ...track,
          youtubeId: track.youtubeId || knownMap.get(track.id) || '',
        }));

        setDiscogsTracks(merged);
      } catch (error) {
        console.error('Failed to refresh Discogs tracks', error);
        setLastFetchedKey(null);
      }
    };

    loadTracks();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, credentials?.username, fetchAllTracks, lastFetchedKey]);

  useEffect(() => {
    prefetchedRef.current.clear();
  }, [discogsTracks.length]);

  useEffect(() => {
    const username = credentials?.username;
    if (!username || discogsTracks.length === 0) return;

    const playable = discogsTracks.filter(
      (track) => !!track.youtubeId || !!track.bandcampEmbedSrc
    );
    writeDiscogsCache(username, discogsTracks, playable);
  }, [credentials?.username, discogsTracks]);

  // Update playlist when filtered tracks change
  useEffect(() => {
    if (filteredTracks.length > 0 && setPlaylist) {
      setPlaylist(filteredTracks);
    }
  }, [filteredTracks, setPlaylist]);

  const currentProvider = currentTrack?.playbackProvider || (currentTrack?.bandcampEmbedSrc ? 'bandcamp' : 'youtube');

  // Resolve a playable media id (Bandcamp preferred when present) when track changes
  useEffect(() => {
    if (!currentTrack) return;
    
    // If this track was already searched, skip
    if (currentTrack.id === lastSearchedTrackId.current) return;
    lastSearchedTrackId.current = currentTrack.id;
    
    // If we already have a provider + payload, use it immediately
    if (currentTrack.playbackProvider === 'youtube' && currentTrack.youtubeId) {
      setCurrentVideoId(currentTrack.youtubeId);
      return;
    }
    if (currentTrack.playbackProvider === 'bandcamp' && currentTrack.bandcampEmbedSrc) {
      setCurrentVideoId('');
      return;
    }

    if (currentTrack.youtubeId) {
      // Back-compat: existing youtubeId without provider.
      setCurrentVideoId(currentTrack.youtubeId);
      setDiscogsTracks((prev) =>
        prev.map((t) => (t.id === currentTrack.id ? { ...t, playbackProvider: 'youtube' } : t))
      );
    } else if (currentTrack.bandcampEmbedSrc) {
      setCurrentVideoId('');
      setDiscogsTracks((prev) =>
        prev.map((t) => (t.id === currentTrack.id ? { ...t, playbackProvider: 'bandcamp' } : t))
      );
    } else {
      let cancelled = false;
      console.log('Resolving media for:', currentTrack.artist, currentTrack.title);

      resolveMediaForTrack(currentTrack).then((media) => {
        if (cancelled) return;

        if (media.provider === 'youtube') {
          setCurrentVideoId(media.youtubeId);
          setDiscogsTracks((prev) =>
            prev.map((t) => (t.id === currentTrack.id ? { ...t, youtubeId: media.youtubeId, playbackProvider: 'youtube' } : t))
          );
          return;
        }
        if (media.provider === 'bandcamp') {
          setCurrentVideoId('');
          setDiscogsTracks((prev) =>
            prev.map((t) => (t.id === currentTrack.id ? { ...t, bandcampEmbedSrc: media.bandcampEmbedSrc, bandcampUrl: media.bandcampUrl, playbackProvider: 'bandcamp' } : t))
          );
          return;
        }

        console.log('No playable media found for:', currentTrack.title, '- skipping');
        setCurrentVideoId('');
        skipNext();
      });

      return () => {
        cancelled = true;
      };
    }
  }, [currentTrack, resolveMediaForTrack, skipNext]);

  // Bandcamp iframes aren't controllable like the YouTube player, so we best-effort auto-advance.
  useEffect(() => {
    if (!currentTrack) return;
    if (currentProvider !== 'bandcamp') return;
    if (!isPlaying) return;

    const ms = Math.max(5, currentTrack.duration || 240) * 1000;
    const t = window.setTimeout(() => skipNext(), ms);
    return () => window.clearTimeout(t);
  }, [currentProvider, currentTrack?.id, currentTrack?.duration, isPlaying, skipNext]);

  // Pre-fetch media candidates for next 4 tracks in the queue
  useEffect(() => {
    if (!playlist.length || currentIndex < 0) return;

    const upcomingTracks = playlist
      .slice(currentIndex + 1, currentIndex + 5)
      .filter((t) => !t.youtubeId && !t.bandcampEmbedSrc && !!t.discogsReleaseId && !prefetchedRef.current.has(t.id));

    if (upcomingTracks.length === 0) return;

    // Mark as being prefetched
    upcomingTracks.forEach((t) => prefetchedRef.current.add(t.id));

    console.log('Pre-fetching media candidates for', upcomingTracks.length, 'upcoming tracks');
    prefetchForTracks(upcomingTracks);
  }, [currentIndex, playlist, prefetchForTracks]);

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
      console.warn('Embed blocked (code', code, ') - trying an alternative for:', currentTrack.title);

      const preferDifferentFromYoutubeId = currentVideoId || currentTrack.youtubeId;
      const alt = await resolveMediaForTrack(currentTrack, { preferDifferentFromYoutubeId });

      if (alt.provider === 'youtube') {
        setCurrentVideoId(alt.youtubeId);
        setDiscogsTracks((prev) =>
          prev.map((t) => (t.id === currentTrack.id ? { ...t, youtubeId: alt.youtubeId, playbackProvider: 'youtube' } : t))
        );
        return;
      }

      skipNext();
    },
    [currentTrack, currentVideoId, resolveMediaForTrack, skipNext]
  );

  // CSV upload handlers with toast notifications
  const handleCollectionCSVUpload = async (file: File) => {
    try {
      const tracks = await loadCollectionCSV(file);
      toast.success(`Loaded ${tracks.length} collection items from CSV`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load CSV');
    }
  };

  const handleWantlistCSVUpload = async (file: File) => {
    try {
      const tracks = await loadWantlistCSV(file);
      toast.success(`Loaded ${tracks.length} wantlist items from CSV`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load CSV');
    }
  };

  const handleClearCSV = () => {
    clearCSVData();
    toast.success('CSV data cleared');
  };

  const collectionInputRef = useRef<HTMLInputElement>(null);
  const wantlistInputRef = useRef<HTMLInputElement>(null);

  // Show loading state when authenticating with Discogs
  if (isAuthenticating) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Connecting to Discogs...</p>
      </div>
    );
  }

  // Show loading state when fetching Discogs data
  if (isAuthenticated && isLoadingData && discogsTracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading your collection from Discogs...</p>
      </div>
    );
  }

  // Title screen: show options to connect or start with demo
  const showTitleScreen = !hasUserInteracted;
  
  if (showTitleScreen) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-8 p-6 relative">
        {/* Hidden YouTube player - preloaded for instant playback */}
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

        {/* CSV Upload Section - show when not authenticated */}
        {!isAuthenticated && (
          <div className="w-full max-w-sm bg-card/50 backdrop-blur-sm rounded-lg border border-border p-6 space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Or load from CSV files</p>
              <p className="text-xs text-muted-foreground mt-1">No account needed</p>
            </div>

            {hasCSVData && (
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">
                    {csvCollection.length > 0 && `${csvCollection.length} collection`}
                    {csvCollection.length > 0 && csvWantlist.length > 0 && ', '}
                    {csvWantlist.length > 0 && `${csvWantlist.length} wantlist`}
                  </span>
                </div>
                <button
                  onClick={handleClearCSV}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={isCSVLoading}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {csvError && (
              <p className="text-xs text-destructive text-center p-2 bg-destructive/10 rounded">{csvError}</p>
            )}

            <div className="space-y-2">
              <input
                ref={collectionInputRef}
                type="file"
                accept=".csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    await handleCollectionCSVUpload(file);
                    if (collectionInputRef.current) {
                      collectionInputRef.current.value = '';
                    }
                  }
                }}
                className="hidden"
                id="collection-csv-upload"
                disabled={isCSVLoading}
              />
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => collectionInputRef.current?.click()}
                disabled={isCSVLoading}
              >
                {isCSVLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload Collection CSV
              </Button>

              <input
                ref={wantlistInputRef}
                type="file"
                accept=".csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    await handleWantlistCSVUpload(file);
                    if (wantlistInputRef.current) {
                      wantlistInputRef.current.value = '';
                    }
                  }
                }}
                className="hidden"
                id="wantlist-csv-upload"
                disabled={isCSVLoading}
              />
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => wantlistInputRef.current?.click()}
                disabled={isCSVLoading}
              >
                {isCSVLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload Wantlist CSV
              </Button>
            </div>

            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">How to export from Discogs</summary>
              <ol className="list-decimal list-inside space-y-1 ml-2 mt-2">
                <li>Go to your Discogs collection or wantlist</li>
                <li>Click the "..." menu and select "Export"</li>
                <li>Choose CSV format and download</li>
                <li>Upload the file here</li>
              </ol>
            </details>
          </div>
        )}

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

        {/* Start Button - triggers hidden YouTube player */}
        <Button 
          size="lg" 
          onClick={() => {
            setHasUserInteracted(true);
            // Start playback immediately via the preloaded player
            setTimeout(() => {
              playerRef.current?.playVideo();
            }, 100);
          }}
          className="gap-2 px-8"
        >
          <Play className="w-5 h-5" />
          Start Listening
        </Button>

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

          {currentProvider === 'bandcamp' && currentTrack.bandcampEmbedSrc ? (
            <BandcampPlayer embedSrc={currentTrack.bandcampEmbedSrc} show={false} />
          ) : (
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
          
          {currentProvider === 'youtube' ? (
            <div className="max-w-md mx-auto w-full py-2">
              <Timeline
                currentTime={currentTime}
                duration={currentTrack.duration}
                onSeek={seekTo}
              />
            </div>
          ) : (
            <div className="max-w-md mx-auto w-full py-2 text-center text-xs text-muted-foreground">
              Bandcamp playback uses the embedded player controls.
            </div>
          )}

          <PlayerControls
            isPlaying={isPlaying}
            isLiked={currentTrack ? isTrackLiked(currentTrack.id) : false}
            isDisliked={currentTrack ? isTrackDisliked(currentTrack.id) : false}
            isShuffle={isShuffle}
            onTogglePlay={togglePlay}
            onSkipPrev={skipPrev}
            onSkipNext={skipNext}
            onSkipBackward={skipBackward}
            onSkipForward={skipForward}
            onLike={handleLikeTrack}
            onDislike={handleDislikeTrack}
            onToggleShuffle={toggleShuffle}
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
