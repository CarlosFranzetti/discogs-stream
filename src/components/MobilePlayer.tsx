import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '@/hooks/usePlayer';
import { useDiscogsAuth } from '@/hooks/useDiscogsAuth';
import { useDiscogsData } from '@/hooks/useDiscogsData';
import { useYouTubeSearch } from '@/hooks/useYouTubeSearch';
import { useAuth } from '@/hooks/useAuth';
import { useTrackPreferences } from '@/hooks/useTrackPreferences';
import { useCSVCollection } from '@/hooks/useCSVCollection';
import { YouTubePlayer } from './YouTubePlayer';
import { MobileAlbumCover } from './MobileAlbumCover';
import { MobileTrackInfo } from './MobileTrackInfo';
import { MobileTimeline } from './MobileTimeline';
import { MobileTransportControls } from './MobileTransportControls';
import { MobilePlaylistSheet } from './MobilePlaylistSheet';
import { MobileTitleScreen } from './MobileTitleScreen';
import { Track } from '@/types/track';
import { readDiscogsCache, writeDiscogsCache } from '@/data/discogsCache';
import { Loader2, Radio, Menu } from 'lucide-react';
import { SourceType } from './SourceFilters';
import { QuotaBanner } from './QuotaBanner';
import { toast } from 'sonner';
import { SettingsDialog } from '@/components/SettingsDialog';
import { useTrackMediaResolver } from '@/hooks/useTrackMediaResolver';
import { useBackgroundVerifier } from '@/hooks/useBackgroundVerifier';
import { useCoverArtScraper } from '@/hooks/useCoverArtScraper';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { resolveOwnerKey, useTrackCache, type TrackCacheRow } from '@/hooks/useTrackCache';

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

  const { isLoading: isLoadingData, error: dataError, fetchAllTracks, fetchRelease } = useDiscogsData(credentials);
  const { resolveMediaForTrack } = useTrackMediaResolver({
    fetchRelease,
    discogsUsername: credentials?.username,
  });
  
  const {
    searchForVideo,
    isSearching,
    prefetchVideos,
    isQuotaExceeded,
    clearCache,
    getSearchUrl,
  } = useYouTubeSearch();
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
    updateTrack: updateCSVTrack,
  } = useCSVCollection();
  const [discogsTracks, setDiscogsTracks] = useState<Track[]>([]);

  // Helper to update a track in discogsTracks (used by cover art scraper)
  const updateDiscogsTrack = useCallback((updatedTrack: Track) => {
    setDiscogsTracks(prev => {
      const idx = prev.findIndex(t => t.id === updatedTrack.id);
      if (idx === -1) return prev;
      const newTracks = [...prev];
      newTracks[idx] = updatedTrack;
      return newTracks;
    });
    // Also update CSV track if it exists there
    updateCSVTrack(updatedTrack);
  }, [updateCSVTrack]);

  const applyTrackPatch = useCallback((trackId: string, patch: Partial<Track>) => {
    const normalizedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    ) as Partial<Track>;
    setDiscogsTracks((prev) =>
      prev.map((track) => (track.id === trackId ? { ...track, ...normalizedPatch } : track))
    );
    setVerifiedTracks((prev) =>
      prev.map((track) => (track.id === trackId ? { ...track, ...normalizedPatch } : track))
    );
  }, []);

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
  
  // Sync verified tracks with discogsTracks for now (until we need separate lists)
  useEffect(() => {
     setVerifiedTracks(discogsTracks);
  }, [discogsTracks]);

  const [lastFetchedKey, setLastFetchedKey] = useState<string | null>(null);
  const cacheHydratedRef = useRef<string | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const lastSearchedTrackId = useRef<string>('');
  const fallbackAttemptedRef = useRef<Set<string>>(new Set());
  const prefetchedRef = useRef<Set<string>>(new Set());
  const [activeSources, setActiveSources] = useState<SourceType[]>(['collection', 'wantlist']);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [volume, setVolume] = useState(100);

  useEffect(() => {
    verifiedTracksRef.current = verifiedTracks;
  }, [verifiedTracks]);

  // Filter tracks by active sources - use verified tracks only
  const filteredTracks = useMemo(() => {
    return verifiedTracks.filter(track => activeSources.includes(track.source));
  }, [verifiedTracks, activeSources]);

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
    isShuffle,
    toggleShuffle,
  } = usePlayer(filteredTracks, persistedDislikedTracks);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onSkipPrev: skipPrev,
    onSkipNext: skipNext
  });

  // Background Verifier Hook
  const { isVerifying, progress: verifyProgress } = useBackgroundVerifier({
    tracks: verifiedTracks, // Use verifiedTracks which now mirrors discogsTracks
    currentTrack: playlist[currentIndex] || null, // Access current track from player state
    isPlaying,
    searchForVideo,
    resolveMediaForTrack,
    updateTrack: updateDiscogsTrack,
    isQuotaExceeded
  });

  // Cover art scraper hook
  const { scrapeCoverArt, batchLoadCoverArtFromDb } = useCoverArtScraper();
  const { upsertTracks, loadTracks, applyCachedMetadata } = useTrackCache();
  const ownerKey = useMemo(() => resolveOwnerKey(credentials?.username), [credentials?.username]);
  const cachedRowsRef = useRef<TrackCacheRow[]>([]);
  const syncTimerRef = useRef<number | null>(null);

  // Load cached metadata from database for faster future loads.
  useEffect(() => {
    let cancelled = false;
    loadTracks(ownerKey).then((rows) => {
      if (cancelled) return;
      cachedRowsRef.current = rows;
      if (rows.length > 0) {
        setDiscogsTracks((prev) => {
          if (prev.length === 0) {
            const fromDb: Track[] = rows.map((row) => ({
              id: row.track_id,
              title: row.title,
              artist: row.artist,
              album: row.album || row.title,
              year: row.year || 0,
              genre: row.genre || 'Unknown',
              label: row.label || 'Unknown',
              duration: 240,
              coverUrl: row.cover1 || '/placeholder.svg',
              coverUrls: [row.cover1, row.cover2, row.cover3, row.cover4].filter(Boolean) as string[],
              youtubeId: row.youtube1 || '',
              youtubeCandidates: [row.youtube1, row.youtube2].filter(Boolean) as string[],
              discogsReleaseId: row.release_id || undefined,
              discogsTrackPosition: row.track_position || undefined,
              country: row.country || undefined,
              workingStatus: row.working_status,
              source: row.source,
            }));
            return fromDb;
          }
          return applyCachedMetadata(prev, rows);
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ownerKey, loadTracks, applyCachedMetadata]);

  useEffect(() => {
    if (discogsTracks.length === 0 || cachedRowsRef.current.length === 0) return;
    setDiscogsTracks((prev) => applyCachedMetadata(prev, cachedRowsRef.current));
  }, [discogsTracks.length, applyCachedMetadata]);

  // Persist track updates to database in batches.
  useEffect(() => {
    if (!ownerKey || discogsTracks.length === 0) return;
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(() => {
      upsertTracks(ownerKey, discogsTracks);
    }, 500);
    return () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
    };
  }, [ownerKey, discogsTracks, upsertTracks]);

  // Cover art scraping notifications are handled per-track as they update

  // Handle volume change
  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (playerRef.current) {
      playerRef.current.setVolume(newVolume);
    }
  }, [playerRef]);

  // Enforce autoplay when skipping tracks
  useEffect(() => {
    if (isPlaying && currentVideoId && playerRef.current) {
      const timeoutId = setTimeout(() => {
        if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
           const state = playerRef.current.getPlayerState();
           // If not playing (1) and not buffering (3)
           if (state !== 1 && state !== 3) {
             playerRef.current.playVideo();
           }
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [currentVideoId, isPlaying]);

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

  const isCacheReady = useCallback(() => {
    const username = credentials?.username;
    if (!username) {
      cacheHydratedRef.current = null;
      return null;
    }

    if (cacheHydratedRef.current === username) {
      return null;
    }

    cacheHydratedRef.current = username;
    return username;
  }, [credentials?.username]);

  useEffect(() => {
    const username = isCacheReady();
    if (!username) return;

    const cache = readDiscogsCache(username);
    if (!cache) return;

    setDiscogsTracks((prev) => (prev.length === 0 ? cache.discogsTracks : prev));
    if (verifiedTracksRef.current.length === 0) {
      setVerifiedTracks(cache.playableTracks);
    }
  }, [isCacheReady]);

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
      console.log('[fetchAllTracks] Starting to load Discogs tracks');
      try {
        const tracks = await fetchAllTracks(100);
        console.log(`[fetchAllTracks] Fetched ${tracks.length} tracks from Discogs API`);
        
        if (cancelled) {
          console.log('[fetchAllTracks] Load cancelled');
          return;
        }
        
        if (tracks.length === 0) {
          console.log('[fetchAllTracks] No tracks returned, skipping');
          return;
        }

        // Log first track to verify cover art
        if (tracks.length > 0) {
          console.log('[fetchAllTracks] First track:', {
            title: tracks[0].title,
            coverUrl: tracks[0].coverUrl,
            source: tracks[0].source
          });
        }

        const preserved = new Map(verifiedTracksRef.current.map((t) => [t.id, t.youtubeId]));
        const merged = tracks.map((track) => ({
          ...track,
          youtubeId: track.youtubeId || preserved.get(track.id) || '',
        }));

        console.log(`[fetchAllTracks] Setting ${merged.length} tracks to discogsTracks state`);
        setIsPlaying(false);
        setCurrentVideoId('');
        setDiscogsTracks(merged);
      } catch (error) {
        console.error('[fetchAllTracks] Failed to refresh Discogs tracks', error);
        setLastFetchedKey(null);
      }
    };

    loadTracks();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, credentials?.username, fetchAllTracks, lastFetchedKey, setIsPlaying]);

  useEffect(() => {
    prefetchedRef.current.clear();
  }, [discogsTracks.length]);

  // Load cover art for Discogs tracks when they change
  const prevDiscogsCountRef = useRef(0);
  useEffect(() => {
    // Only trigger when new tracks are added, not on updates
    if (discogsTracks.length > prevDiscogsCountRef.current && discogsTracks.length > 0) {
      prevDiscogsCountRef.current = discogsTracks.length;
      
      console.log(`[Cover Art] Loading cover art for ${discogsTracks.length} tracks`);
      
      // Load cover art from database immediately, then scrape missing ones
      batchLoadCoverArtFromDb(discogsTracks, updateDiscogsTrack).then(dbLoadCount => {
        if (dbLoadCount > 0) {
          console.log(`[Cover Art] Loaded ${dbLoadCount} covers from database`);
          toast.success(`Loaded ${dbLoadCount} cover arts from cache`);
        }
        
        // Then start scraping for missing covers in the background
        console.log('[Cover Art] Starting scraper for missing covers');
        scrapeCoverArt(discogsTracks, updateDiscogsTrack, true);
      });
    }
  }, [discogsTracks.length, batchLoadCoverArtFromDb, scrapeCoverArt, updateDiscogsTrack]);

  useEffect(() => {
    const username = credentials?.username;
    if (!username || discogsTracks.length === 0) return;

    const playable =
      verifiedTracks.length > 0
        ? verifiedTracks
        : discogsTracks.filter((track) => !!track.youtubeId || !!track.bandcampEmbedSrc);
    writeDiscogsCache(username, discogsTracks, playable);
  }, [credentials?.username, discogsTracks, verifiedTracks]);

  // Track if we've auto-started playback
  const hasAutoStartedRef = useRef(false);

  // Auto-start playback when first track is ready (and actually has a video)
  useEffect(() => {
     if (verifiedTracks.length > 0 && !hasAutoStartedRef.current && hasUserInteracted) {
         const firstTrack = verifiedTracks[0];
         if (firstTrack.youtubeId) {
             // Only auto-start if we have a valid ID
             hasAutoStartedRef.current = true;
         }
     }
  }, [verifiedTracks, hasUserInteracted]);

  // Update playlist when filtered tracks change
  useEffect(() => {
    if (filteredTracks.length > 0 && setPlaylist) {
      setPlaylist(filteredTracks);
    }
  }, [filteredTracks, setPlaylist]);

  // Auto-resolve YouTube with a 3-second skip window for the active track.
  useEffect(() => {
    if (!currentTrack) return;
    if (currentTrack.id === lastSearchedTrackId.current) return;
    lastSearchedTrackId.current = currentTrack.id;

    if (currentTrack.youtubeId) {
      setCurrentVideoId(currentTrack.youtubeId);
      applyTrackPatch(currentTrack.id, { workingStatus: 'working' });
    } else {
      const trackId = currentTrack.id;
      let cancelled = false;
      let timedOut = false;

      const markAsNonWorking = () => {
        applyTrackPatch(trackId, { workingStatus: 'non_working' });
      };

      const timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        timedOut = true;
        markAsNonWorking();
        setCurrentVideoId('');
        skipNext();
      }, 3000);

      (async () => {
        const media = await resolveMediaForTrack(currentTrack);
        if (media.provider === 'youtube' && media.youtubeId) {
          return {
            videoId: media.youtubeId,
            youtubeCandidates: media.youtubeCandidates,
            coverUrl: media.coverUrl,
            coverUrls: media.coverUrls,
          };
        }

        const videoId = await searchForVideo(currentTrack);
        return { videoId, youtubeCandidates: undefined, coverUrl: undefined, coverUrls: undefined };
      })().then(({ videoId, youtubeCandidates, coverUrl, coverUrls }) => {
        if (cancelled) return;
        if (videoId) {
          setCurrentVideoId(videoId);
          applyTrackPatch(trackId, {
            youtubeId: videoId,
            youtubeCandidates,
            coverUrl,
            coverUrls,
            workingStatus: 'working',
          });
          window.clearTimeout(timeoutId);
        } else {
          if (!timedOut) {
            markAsNonWorking();
            setCurrentVideoId('');
            window.clearTimeout(timeoutId);
            skipNext();
          }
        }
      });

      return () => {
        cancelled = true;
        window.clearTimeout(timeoutId);
      };
    }
  }, [currentTrack, resolveMediaForTrack, searchForVideo, skipNext, applyTrackPatch]);

  // Pre-fetch YouTube IDs for next 4 tracks
  useEffect(() => {
    if (!playlist.length || currentIndex < 0) return;

    const upcomingTracks = playlist
      .slice(currentIndex + 1, currentIndex + 5)
      .filter((t) => !t.youtubeId && !prefetchedRef.current.has(t.id));

    if (upcomingTracks.length === 0) return;

    upcomingTracks.forEach((t) => prefetchedRef.current.add(t.id));

    prefetchVideos(upcomingTracks).then((results) => {
      results.forEach((videoId, trackId) => {
        if (videoId) {
          applyTrackPatch(trackId, { youtubeId: videoId, workingStatus: 'working' });
        } else {
          applyTrackPatch(trackId, { workingStatus: 'non_working' });
        }
      });
    });
  }, [currentIndex, playlist, prefetchVideos, applyTrackPatch]);

  const handlePlayerStateChange = (state: number) => {
    if (state === 0) skipNext();
    if (state === 1) setIsPlaying(true);
    if (state === 2) setIsPlaying(false);
  };

  const handlePlayerError = useCallback(
    async (code: number) => {
      if (!currentTrack) return;

      if (code === 100 || code === 2 || code === 5) {
        // Video unavailable - mark as non-working and skip.
        applyTrackPatch(currentTrack.id, { workingStatus: 'non_working' });
        skipNext();
        return;
      }

      if (code !== 150 && code !== 101) return;

      if (fallbackAttemptedRef.current.has(currentTrack.id)) {
        // Already tried fallback, keep track in list but skip.
        applyTrackPatch(currentTrack.id, { workingStatus: 'non_working' });
        skipNext();
        return;
      }

      fallbackAttemptedRef.current.add(currentTrack.id);

      const altId = await searchForVideo(currentTrack, { force: true, maxResults: 8 });

      if (altId) {
        setCurrentVideoId(altId);
        applyTrackPatch(currentTrack.id, { youtubeId: altId, workingStatus: 'working' });
        return;
      }

      // No alternative found - keep row but skip.
      applyTrackPatch(currentTrack.id, { workingStatus: 'non_working' });
      skipNext();
    },
    [currentTrack, searchForVideo, skipNext, applyTrackPatch]
  );

  // Demo mode helper - open current track in YouTube
  const handleOpenInYouTube = useCallback(() => {
    if (currentTrack) {
      window.open(getSearchUrl(currentTrack), '_blank');
    }
  }, [currentTrack, getSearchUrl]);

  const handleStartListening = useCallback(() => {
    setHasUserInteracted(true);
    // Start playback as soon as we have at least one track
    if (currentTrack?.youtubeId || currentVideoId) {
      setTimeout(() => {
        playerRef.current?.playVideo();
        setIsPlaying(true);
      }, 100);
    }
  }, [playerRef, currentTrack, currentVideoId, setIsPlaying]);

  // CSV upload handlers with toast notifications and cover art scraping
  const handleCollectionCSVUpload = async (file: File) => {
    try {
      // First import should clear active playback/demo stream state.
      setIsPlaying(false);
      setCurrentVideoId('');

      const tracks = await loadCollectionCSV(file);
      toast.success(`Loaded ${tracks.length} collection items from CSV`);

      if (tracks.length > 0) {
        const firstTrack = tracks[0];
        const firstVideoId = await Promise.race<string>([
          searchForVideo(firstTrack),
          new Promise((resolve) => setTimeout(() => resolve(''), 3000)),
        ]);
        if (firstVideoId) {
          updateCSVTrack({ ...firstTrack, youtubeId: firstVideoId, workingStatus: 'working' });
        } else {
          updateCSVTrack({ ...firstTrack, workingStatus: 'non_working' });
        }

        await upsertTracks(ownerKey, tracks);
      }

      // Load cover art from database immediately, then scrape missing ones
      if (tracks.length > 0) {
        // First, batch load any existing cover art from database
        const dbLoadCount = await batchLoadCoverArtFromDb(tracks, updateCSVTrack);
        if (dbLoadCount > 0) {
          toast.success(`Loaded ${dbLoadCount} covers from database`);
        }

        // Then start scraping for missing covers in the background
        toast.info('Fetching remaining cover art...');
        scrapeCoverArt(tracks, updateCSVTrack, true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load CSV');
    }
  };

  const handleWantlistCSVUpload = async (file: File) => {
    try {
      // First import should clear active playback/demo stream state.
      setIsPlaying(false);
      setCurrentVideoId('');

      const tracks = await loadWantlistCSV(file);
      toast.success(`Loaded ${tracks.length} wantlist items from CSV`);

      if (tracks.length > 0) {
        const firstTrack = tracks[0];
        const firstVideoId = await Promise.race<string>([
          searchForVideo(firstTrack),
          new Promise((resolve) => setTimeout(() => resolve(''), 3000)),
        ]);
        if (firstVideoId) {
          updateCSVTrack({ ...firstTrack, youtubeId: firstVideoId, workingStatus: 'working' });
        } else {
          updateCSVTrack({ ...firstTrack, workingStatus: 'non_working' });
        }

        await upsertTracks(ownerKey, tracks);
      }

      // Load cover art from database immediately, then scrape missing ones
      if (tracks.length > 0) {
        // First, batch load any existing cover art from database
        const dbLoadCount = await batchLoadCoverArtFromDb(tracks, updateCSVTrack);
        if (dbLoadCount > 0) {
          toast.success(`Loaded ${dbLoadCount} covers from database`);
        }

        // Then start scraping for missing covers in the background
        toast.info('Fetching remaining cover art...');
        scrapeCoverArt(tracks, updateCSVTrack, true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load CSV');
    }
  };

  const handleClearCSV = () => {
    clearCSVData();
    toast.success('CSV data cleared');
  };

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
          trackCount={verifiedTracks.length}
          isVerifying={isVerifying}
          verifyProgress={verifyProgress}
          hasCSVData={hasCSVData}
          csvCollectionCount={csvCollection.length}
          csvWantlistCount={csvWantlist.length}
          onCollectionCSVUpload={handleCollectionCSVUpload}
          onWantlistCSVUpload={handleWantlistCSVUpload}
          onClearCSV={handleClearCSV}
          csvError={csvError}
          isCSVLoading={isCSVLoading}
        />
      </>
    );
  }

  // Main player view
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden max-w-[480px] md:max-w-md mx-auto safe-area">
      {/* Header */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Radio className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-tight">Discogs</h1>
            <span className="text-xs text-primary">Radio</span>
          </div>
        </div>
        
        {/* Username / Settings / Menu - no volume in header */}
        <div className="flex items-center gap-1">
          {credentials?.username && <span className="text-xs sm:text-sm text-muted-foreground mr-1 sm:mr-2 hidden sm:inline">{credentials.username}</span>}
          <SettingsDialog 
            onClearData={() => {
              clearCSVData();
              clearCache();
            }}
            playlistTracks={playlist}
          />
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 sm:p-2 text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col px-3 sm:px-4 py-3 sm:py-4 overflow-hidden">
        {/* Album cover */}
        <div className="relative w-full max-w-[240px] sm:max-w-[280px] mx-auto aspect-square mb-3 sm:mb-4">
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

        {/* Quota banner (demo mode) */}
        {isQuotaExceeded && (
          <div className="mb-3">
            <QuotaBanner onOpenYouTube={handleOpenInYouTube} />
          </div>
        )}

        {/* Source badge */}
        {currentTrack && (
          <div className="flex justify-center mb-1.5 sm:mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs bg-muted text-muted-foreground border border-border">
              {currentTrack.source === 'wantlist' ? '♡ Wantlist' : '◎ Collection'}
            </span>
          </div>
        )}

        {/* Track info */}
        <MobileTrackInfo track={currentTrack} />

        {/* Divider */}
        <div className="border-t border-border/50 my-2 sm:my-3" />

        {/* Timeline */}
        <MobileTimeline
          currentTime={currentTime}
          duration={currentTrack?.duration || 0}
          onSeek={seekTo}
        />

        {/* Divider */}
        <div className="border-t border-border/50 my-2 sm:my-3" />

        {/* Transport controls */}
        <MobileTransportControls
          isPlaying={isPlaying}
          isLiked={currentTrack ? isTrackLiked(currentTrack.id) : false}
          isDisliked={currentTrack ? isTrackDisliked(currentTrack.id) : false}
          isShuffle={isShuffle}
          volume={volume}
          onTogglePlay={togglePlay}
          onPrevious={skipPrev}
          onNext={skipNext}
          onSkipBackward={skipBackward}
          onSkipForward={skipForward}
          onLike={handleLikeTrack}
          onDislike={handleDislikeTrack}
          onToggleShuffle={toggleShuffle}
          onVolumeChange={handleVolumeChange}
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
