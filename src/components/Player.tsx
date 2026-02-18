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
import { useDirectAudio } from '@/hooks/useDirectAudio';
import { useCoverArtScraper } from '@/hooks/useCoverArtScraper';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { resolveOwnerKey, useTrackCache } from '@/hooks/useTrackCache';
import { YouTubePlayer } from './YouTubePlayer';
import { BandcampPlayer } from './BandcampPlayer';
import { DirectAudioPlayer, type DirectAudioPlayerRef } from './DirectAudioPlayer';
import { AlbumArt } from './AlbumArt';
import { Timeline } from './Timeline';
import { PlayerControls } from './PlayerControls';
import { TrackInfo } from './TrackInfo';
import { PlaylistSidebar } from './PlaylistSidebar';
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
    updateTrack: updateCSVTrack,
  } = useCSVCollection();
  const {
    searchForVideo,
    isQuotaExceeded,
  } = useYouTubeSearch();
  const {
    scrapeCoverArt,
    batchLoadCoverArtFromDb,
  } = useCoverArtScraper();
  const { upsertTracks, loadTracks, applyCachedMetadata } = useTrackCache();
  const ownerKey = useMemo(() => resolveOwnerKey(credentials?.username), [credentials?.username]);
  const [discogsTracks, setDiscogsTracks] = useState<Track[]>([]);

  // Helper to update a track and immediately persist to DB
  const updateDiscogsTrack = useCallback((updatedTrack: Track) => {
    setDiscogsTracks(prev => {
      const idx = prev.findIndex(t => t.id === updatedTrack.id);
      if (idx === -1) return prev;
      const newTracks = [...prev];
      newTracks[idx] = updatedTrack;
      return newTracks;
    });
    updateCSVTrack(updatedTrack);
    // Persist YouTube ID and cover resolution immediately to DB
    upsertTracks(ownerKey, [updatedTrack]);
  }, [updateCSVTrack, upsertTracks, ownerKey]);

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

  // Hydrate CSV tracks from DB cache on startup (restores YouTube IDs and covers from prior session)
  const csvHydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ownerKey || csvAllTracks.length === 0) return;
    if (csvHydratedRef.current === ownerKey) return;
    csvHydratedRef.current = ownerKey;

    loadTracks(ownerKey).then(rows => {
      if (!rows.length) return;
      const hydrated = applyCachedMetadata(csvAllTracks, rows);
      setDiscogsTracks(prev => {
        const csvIds = new Set(csvAllTracks.map(t => t.id));
        return [...prev.filter(t => !csvIds.has(t.id)), ...hydrated];
      });
    });
  }, [ownerKey, csvAllTracks, loadTracks, applyCachedMetadata]);
  
  // Tracks with background-loaded cover art and YouTube IDs
  const [verifiedTracks, setVerifiedTracks] = useState<Track[]>([]);
  
  // Sync verified tracks with discogsTracks
  useEffect(() => {
     setVerifiedTracks(discogsTracks);
  }, [discogsTracks]);
  const [lastFetchedKey, setLastFetchedKey] = useState<string | null>(null);
  const cacheHydratedRef = useRef<string | null>(null);
  const discogsTracksRef = useRef<Track[]>([]);
  const [currentVideoId, setCurrentVideoId] = useState<string>('');
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string>('');
  const [audioSource, setAudioSource] = useState<'invidious' | 'yt-dlp' | null>(null);
  const audioPlayerRef = useRef<DirectAudioPlayerRef>(null);
  const { getDirectAudioUrl } = useDirectAudio();
  const lastSearchedTrackId = useRef<string>('');
  const fallbackAttemptedRef = useRef<Set<string>>(new Set());
  const prefetchedRef = useRef<Set<string>>(new Set());
  const [activeSources, setActiveSources] = useState<SourceType[]>(['collection', 'wantlist']);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  useEffect(() => {
    discogsTracksRef.current = discogsTracks;
  }, [discogsTracks]);

  // Filter tracks by active sources
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

  // Background Verifier Hook — no quota guard; yt-dlp/Invidious run regardless of API quota
  const { isVerifying: _isVerifying, progress: _verifyProgress, triggerImmediate } = useBackgroundVerifier({
    tracks: verifiedTracks,
    currentTrack: playlist[currentIndex] || null,
    isPlaying,
    searchForVideo,
    resolveMediaForTrack,
    updateTrack: updateDiscogsTrack,
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

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onSkipPrev: skipPrev,
    onSkipNext: skipNext,
    onToggleShuffle: toggleShuffle,
  });

  // Show toast notification when quota is first exceeded
  const hasShownQuotaToastRef = useRef(false);
  useEffect(() => {
    if (isQuotaExceeded && !hasShownQuotaToastRef.current) {
      hasShownQuotaToastRef.current = true;
      toast.warning('YouTube quota exceeded. Using cached videos and Discogs links only.', {
        duration: 5000,
      });
    }
  }, [isQuotaExceeded]);

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

        setIsPlaying(false);
        setCurrentVideoId('');
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
      
      // Load cover art from database immediately, then scrape missing ones
      batchLoadCoverArtFromDb(discogsTracks, updateDiscogsTrack).then(dbLoadCount => {
        if (dbLoadCount > 0) {
          console.log(`Loaded ${dbLoadCount} covers from database`);
        }
        
        // Then start scraping for missing covers in the background
        scrapeCoverArt(discogsTracks, updateDiscogsTrack, true);
      });
    }
  }, [discogsTracks.length, batchLoadCoverArtFromDb, scrapeCoverArt, updateDiscogsTrack]);

  useEffect(() => {
    const username = credentials?.username;
    if (!username || discogsTracks.length === 0) return;

    const playable = discogsTracks.filter(
      (track) => !!track.youtubeId || !!track.bandcampEmbedSrc
    );
    writeDiscogsCache(username, discogsTracks, playable);
  }, [credentials?.username, discogsTracks]);

  useEffect(() => {
    if (discogsTracks.length === 0) return;
    upsertTracks(ownerKey, discogsTracks);
  }, [discogsTracks, ownerKey, upsertTracks]);

  const currentProvider = currentTrack?.playbackProvider || (currentTrack?.bandcampEmbedSrc ? 'bandcamp' : 'youtube');

  // Resolve a playable media id (Bandcamp preferred when present) when track changes
  useEffect(() => {
    if (!currentTrack) {
      console.log('[Audio Debug] No current track');
      return;
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('[Audio Debug] NEW TRACK:', currentTrack.title, 'by', currentTrack.artist);
    console.log('[Audio Debug] Track ID:', currentTrack.id);
    console.log('[Audio Debug] Track source:', currentTrack.source);
    console.log('[Audio Debug] Track has youtubeId:', currentTrack.youtubeId);
    console.log('[Audio Debug] Track has bandcampEmbedSrc:', currentTrack.bandcampEmbedSrc);
    console.log('[Audio Debug] Track has playbackProvider:', currentTrack.playbackProvider);
    console.log('[Audio Debug] Track has discogsReleaseId:', currentTrack.discogsReleaseId);
    console.log('[Audio Debug] Current videoId state:', currentVideoId);
    console.log('[Audio Debug] Current audioUrl state:', currentAudioUrl);
    console.log('═══════════════════════════════════════════════════════');
    
    // If this track was already searched, skip
    if (currentTrack.id === lastSearchedTrackId.current) return;
    lastSearchedTrackId.current = currentTrack.id;
    
    // If we already have a provider + payload, use it immediately
    if (currentTrack.playbackProvider === 'youtube' && currentTrack.youtubeId) {
      console.log('[Audio Debug] Setting YouTube ID from track:', currentTrack.youtubeId, 'Track:', currentTrack.title);
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
      // Log quota status when resolving
      if (isQuotaExceeded) {
        console.log('[Auto-Skip] Quota exceeded, using only free sources (Discogs videos, DB cache) for:', currentTrack.title);
      }

      let cancelled = false;
      let timedOut = false;
      console.log('[Media Resolution] Starting resolution for:', currentTrack.artist, '-', currentTrack.title);
      console.log('[Media Resolution] Track has discogsReleaseId:', currentTrack.discogsReleaseId);

      const timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        timedOut = true;
        setDiscogsTracks((prev) =>
          prev.map((t) => (t.id === currentTrack.id ? { ...t, workingStatus: 'non_working' } : t))
        );
        setCurrentVideoId('');
        skipNext();
      }, 3000);

      resolveMediaForTrack(currentTrack).then((media) => {
        if (cancelled) return;

        console.log('[Media Resolution] Result:', media);

        if (media.provider === 'youtube' && 'youtubeId' in media) {
          console.log('[Audio Debug] Resolved YouTube ID:', media.youtubeId, 'for track:', currentTrack.title);
          setCurrentVideoId(media.youtubeId);
          setDiscogsTracks((prev) =>
            prev.map((t) => (t.id === currentTrack.id ? { ...t, youtubeId: media.youtubeId, playbackProvider: 'youtube', workingStatus: 'working' } : t))
          );
          window.clearTimeout(timeoutId);
          return;
        }
        if (media.provider === 'bandcamp' && 'bandcampEmbedSrc' in media) {
          setCurrentVideoId('');
          setDiscogsTracks((prev) =>
            prev.map((t) => (t.id === currentTrack.id ? { ...t, bandcampEmbedSrc: media.bandcampEmbedSrc, bandcampUrl: media.bandcampUrl, playbackProvider: 'bandcamp' } : t))
          );
          window.clearTimeout(timeoutId);
          return;
        }

        // No media found - auto-skip
        if (!timedOut) {
          const quotaMsg = isQuotaExceeded ? ' (quota exceeded, only free sources checked)' : '';
          console.log(`[Auto-Skip] No playable media found for: ${currentTrack.title}${quotaMsg} - skipping`);
          setDiscogsTracks((prev) =>
            prev.map((t) => (t.id === currentTrack.id ? { ...t, workingStatus: 'non_working' } : t))
          );
          setCurrentVideoId('');
          window.clearTimeout(timeoutId);
          skipNext();
        }
      });

      return () => {
        cancelled = true;
        window.clearTimeout(timeoutId);
      };
    }
  }, [currentTrack, resolveMediaForTrack, skipNext, isQuotaExceeded]);

  // Fetch direct audio URL whenever currentVideoId changes
  useEffect(() => {
    if (!currentVideoId) {
      console.log('[DirectAudio] No video ID, clearing audio URL');
      setCurrentAudioUrl('');
      setAudioSource(null);
      return;
    }

    console.log('[DirectAudio] Video ID changed:', currentVideoId, '- fetching audio URL');

    let cancelled = false;

    getDirectAudioUrl(currentVideoId).then((result) => {
      if (cancelled) return;

      if (result) {
        console.log('[DirectAudio] ✓ Got direct audio URL from:', result.source);
        console.log('[DirectAudio] Audio URL:', result.audioUrl.substring(0, 100) + '...');
        setCurrentAudioUrl(result.audioUrl);
        setAudioSource(result.source);
      } else {
        console.log('[DirectAudio] ✗ No direct audio URL, will use YouTube iframe');
        setCurrentAudioUrl('');
        setAudioSource(null);
      }
    }).catch(err => {
      if (cancelled) return;
      console.error('[DirectAudio] Error fetching audio URL:', err);
      setCurrentAudioUrl('');
      setAudioSource(null);
    });

    return () => {
      cancelled = true;
    };
  }, [currentVideoId, getDirectAudioUrl]);

  // Bandcamp iframes aren't controllable like the YouTube player, so we best-effort auto-advance.
  useEffect(() => {
    if (!currentTrack) return;
    if (currentProvider !== 'bandcamp') return;
    if (!isPlaying) return;

    const ms = Math.max(5, currentTrack.duration || 240) * 1000;
    const t = window.setTimeout(() => skipNext(), ms);
    return () => window.clearTimeout(t);
  }, [currentProvider, currentTrack?.id, currentTrack?.duration, isPlaying, skipNext]);

  // Pre-fetch media for next 4 tracks in the queue (covers both Discogs and CSV tracks)
  useEffect(() => {
    if (!playlist.length || currentIndex < 0) return;

    const upcoming = playlist
      .slice(currentIndex + 1, currentIndex + 5)
      .filter((t) => !t.youtubeId && !t.bandcampEmbedSrc && !prefetchedRef.current.has(t.id));

    if (upcoming.length === 0) return;

    upcoming.forEach((t) => prefetchedRef.current.add(t.id));

    // Discogs tracks: use full media resolver (checks release videos, Bandcamp, etc.)
    const withReleaseId = upcoming.filter(t => !!t.discogsReleaseId);
    if (withReleaseId.length > 0) {
      console.log('Pre-fetching media candidates for', withReleaseId.length, 'Discogs tracks');
      prefetchForTracks(withReleaseId);
    }

    // CSV tracks without a release ID: fall through to YouTube search chain directly
    const csvOnly = upcoming.filter(t => !t.discogsReleaseId);
    csvOnly.forEach(t => {
      searchForVideo(t).then(videoId => {
        if (videoId) updateDiscogsTrack({ ...t, youtubeId: videoId, workingStatus: 'working' });
      });
    });
  }, [currentIndex, playlist, prefetchForTracks, searchForVideo, updateDiscogsTrack]);

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
        setDiscogsTracks((prev) =>
          prev.map((t) => (t.id === currentTrack.id ? { ...t, workingStatus: 'non_working' } : t))
        );
        skipNext();
        return;
      }

      // 150/101: embedding disabled / not allowed - try alternative
      if (code !== 150 && code !== 101) return;

      // Avoid infinite loops per track
      if (fallbackAttemptedRef.current.has(currentTrack.id)) {
        console.warn('Embed blocked and fallback already attempted, skipping track:', currentTrack.title);
        setDiscogsTracks((prev) =>
          prev.map((t) => (t.id === currentTrack.id ? { ...t, workingStatus: 'non_working' } : t))
        );
        skipNext();
        return;
      }

      fallbackAttemptedRef.current.add(currentTrack.id);
      console.warn('Embed blocked (code', code, ') - trying an alternative for:', currentTrack.title);

      const preferDifferentFromYoutubeId = currentVideoId || currentTrack.youtubeId;
      const alt = await resolveMediaForTrack(currentTrack, { preferDifferentFromYoutubeId });

      if (alt.provider === 'youtube' && 'youtubeId' in alt) {
        setCurrentVideoId(alt.youtubeId);
        setDiscogsTracks((prev) =>
          prev.map((t) => (t.id === currentTrack.id ? { ...t, youtubeId: alt.youtubeId, playbackProvider: 'youtube', workingStatus: 'working' } : t))
        );
        return;
      }

      setDiscogsTracks((prev) =>
        prev.map((t) => (t.id === currentTrack.id ? { ...t, workingStatus: 'non_working' } : t))
      );
      skipNext();
    },
    [currentTrack, currentVideoId, resolveMediaForTrack, skipNext]
  );

  // CSV upload handlers with toast notifications and cover art loading
  const handleCollectionCSVUpload = async (file: File) => {
    try {
      setIsPlaying(false);
      setCurrentVideoId('');
      const tracks = await loadCollectionCSV(file);
      toast.success(`Loaded ${tracks.length} collection items from CSV`);

      if (tracks.length > 0) {
        await upsertTracks(ownerKey, tracks);
      }

      // Load cover art from database immediately, then scrape missing ones
      if (tracks.length > 0) {
        const dbLoadCount = await batchLoadCoverArtFromDb(tracks, updateDiscogsTrack);
        if (dbLoadCount > 0) {
          toast.success(`Loaded ${dbLoadCount} covers from database`);
        }

        // Then start scraping for missing covers in the background
        toast.info('Fetching remaining cover art...');
        scrapeCoverArt(tracks, updateDiscogsTrack, true);
        triggerImmediate();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load CSV');
    }
  };

  const handleWantlistCSVUpload = async (file: File) => {
    try {
      setIsPlaying(false);
      setCurrentVideoId('');
      const tracks = await loadWantlistCSV(file);
      toast.success(`Loaded ${tracks.length} wantlist items from CSV`);

      if (tracks.length > 0) {
        await upsertTracks(ownerKey, tracks);
      }

      // Load cover art from database immediately, then scrape missing ones
      if (tracks.length > 0) {
        const dbLoadCount = await batchLoadCoverArtFromDb(tracks, updateDiscogsTrack);
        if (dbLoadCount > 0) {
          toast.success(`Loaded ${dbLoadCount} covers from database`);
        }

        // Then start scraping for missing covers in the background
        toast.info('Fetching remaining cover art...');
        scrapeCoverArt(tracks, updateDiscogsTrack, true);
        triggerImmediate();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load CSV');
    }
  };

  // Retry a non_working track on demand (from playlist click)
  const handleRetryTrack = useCallback(async (track: Track) => {
    const videoId = await searchForVideo(track, { force: true });
    if (videoId) {
      updateDiscogsTrack({ ...track, youtubeId: videoId, workingStatus: 'working' });
    }
  }, [searchForVideo, updateDiscogsTrack]);

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
          <h1 className="text-4xl font-display font-bold text-foreground">Discogs Stream</h1>
          <p className="text-muted-foreground">Stream music from your Discogs collection</p>
        </div>

        {/* Discogs connected indicator (read-only on title screen — connect/disconnect via Options) */}
        {isAuthenticated && credentials?.username && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-success text-xs">●</span>
            <span>Connected as <strong className="text-foreground">{credentials.username}</strong></span>
          </div>
        )}

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
            if (playlist.length > 0) {
              const playableIndices = playlist
                .map((t, idx) => ({ t, idx }))
                .filter(({ t }) => t.youtubeId || t.bandcampEmbedSrc)
                .map(({ idx }) => idx);
              const candidates = playableIndices.length > 0 ? playableIndices : playlist.map((_, idx) => idx);
              const start = Math.floor(Math.random() * candidates.length);
              let chosen = candidates[start];
              for (let i = 0; i < candidates.length; i++) {
                const idx = candidates[(start + i) % candidates.length];
                const track = playlist[idx];
                if (track.youtubeId || track.bandcampEmbedSrc) { chosen = idx; break; }
              }
              setCurrentIndex(chosen);
              setCurrentTime(0);
              setIsPlaying(true);
            }
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
          ) : currentAudioUrl ? (
            <DirectAudioPlayer
              ref={audioPlayerRef}
              audioUrl={currentAudioUrl}
              isPlaying={isPlaying}
              onEnded={skipNext}
              onError={() => {
                console.log('[DirectAudio] Playback error, falling back to YouTube iframe');
                setCurrentAudioUrl('');
                setAudioSource(null);
              }}
              onTimeUpdate={setCurrentTime}
            />
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

      {/* Playlist sidebar */}
      <div className="hidden md:block w-[320px] lg:w-[400px] flex-shrink-0">
        <PlaylistSidebar
          playlist={playlist}
          currentIndex={currentIndex}
          onSelectTrack={selectTrack}
          onRetryTrack={handleRetryTrack}
        />
      </div>
    </div>
  );
}
