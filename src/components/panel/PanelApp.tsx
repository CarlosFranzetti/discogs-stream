import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Music, Disc3, ListMusic, ShoppingCart, Heart, Package,
  Sparkles, Settings, Loader2, Upload,
} from 'lucide-react';
import { Track } from '@/types/track';
import { DiscogsRelease, TabId } from '@/types/extension';
import { usePlayer } from '@/hooks/usePlayer';
import { useCSVCollection } from '@/hooks/useCSVCollection';
import { useBackgroundVerifier } from '@/hooks/useBackgroundVerifier';
import { useTrackMediaResolver } from '@/hooks/useTrackMediaResolver';
import { useYouTubeSearch } from '@/hooks/useYouTubeSearch';
import { useExtensionSettings } from '@/hooks/useExtensionSettings';
import { useCurrentRelease } from '@/hooks/useCurrentRelease';
import { useCrates } from '@/hooks/useCrates';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useDiscogsAuth } from '@/hooks/useDiscogsAuth';
import { useDiscogsData } from '@/hooks/useDiscogsData';
import { CompactPlayer } from './CompactPlayer';
import { NowPlayingView } from './NowPlayingView';
import { CratesView } from './CratesView';
import { PlaylistsView } from './PlaylistsView';
import { CartsView } from './CartsView';
import { WantlistView } from './WantlistView';
import { CollectionView } from './CollectionView';
import { SuggestionsView } from './SuggestionsView';
import { SettingsView } from './SettingsView';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

interface Tab {
  id: TabId;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const TABS: Tab[] = [
  { id: 'player', icon: Music, label: 'Now' },
  { id: 'crates', icon: Disc3, label: 'Crates' },
  { id: 'playlists', icon: ListMusic, label: 'Lists' },
  { id: 'cart', icon: ShoppingCart, label: 'Cart' },
  { id: 'wantlist', icon: Heart, label: 'Want' },
  { id: 'collection', icon: Package, label: 'Coll.' },
  { id: 'suggestions', icon: Sparkles, label: 'Similar' },
  { id: 'settings', icon: Settings, label: 'Set' },
];

export function PanelApp() {
  const [activeTab, setActiveTab] = useState<TabId>('player');
  const { settings, updateSetting, resetSettings } = useExtensionSettings();
  const { currentRelease } = useCurrentRelease();
  const [themeClass, setThemeClass] = useState('');

  useEffect(() => {
    const map: Record<string, string> = {
      midnight: 'theme-midnight',
      'neon-orange': 'theme-neon-orange',
      cyberpunk: 'theme-cyberpunk',
    };
    setThemeClass(map[settings.theme] || '');
  }, [settings.theme]);

  const {
    collection: csvCollection,
    wantlist: csvWantlist,
    allTracks,
    hasCSVData,
    isLoading: csvLoading,
    loadCollectionCSV,
    loadWantlistCSV,
    clearCollection,
    clearWantlist,
    updateTrack: updateCSVTrack,
  } = useCSVCollection();

  const { credentials } = useDiscogsAuth();
  const { fetchRelease } = useDiscogsData(credentials);
  const { resolveMediaForTrack } = useTrackMediaResolver({
    fetchRelease,
    discogsUsername: credentials?.username,
  });
  const { searchForVideo, prefetchVideos } = useYouTubeSearch();

  const {
    playlist, currentTrack, currentIndex, isPlaying,
    currentTime, playerDuration, playerRef,
    play, pause, skipNext, skipPrev, seekTo,
    selectTrack, toggleShuffle, isShuffle, setPlaylist,
    setCurrentIndex, setCurrentTime, setIsPlaying,
  } = usePlayer(allTracks.length > 0 ? allTracks : undefined);

  const { triggerImmediate } = useBackgroundVerifier({
    tracks: playlist,
    currentTrack: playlist[currentIndex] || null,
    isPlaying,
    searchForVideo,
    resolveMediaForTrack,
    updateTrack: (t: Track) => updateCSVTrack(t),
  });

  const { openMarketplacePage } = useMarketplace();

  const autoSkipRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!currentTrack) return;
    if (autoSkipRef.current) clearTimeout(autoSkipRef.current);
    if (!currentTrack.youtubeId && currentTrack.workingStatus !== 'pending') {
      autoSkipRef.current = setTimeout(() => skipNext(), 3000);
    }
    return () => { if (autoSkipRef.current) clearTimeout(autoSkipRef.current); };
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!currentRelease || !settings.autoLoadRelease) return;
    const releaseTrack = allTracks.find(t => t.discogsReleaseId === currentRelease.releaseId);
    if (releaseTrack) {
      const idx = playlist.findIndex(t => t.id === releaseTrack.id);
      if (idx !== -1 && idx !== currentIndex) selectTrack(idx);
    }
  }, [currentRelease?.releaseId, settings.autoLoadRelease]);

  useEffect(() => {
    if (currentTrack?.source === 'wantlist' && settings.openReleaseInBrowser && currentTrack.discogsReleaseId) {
      const url = `https://www.discogs.com/release/${currentTrack.discogsReleaseId}`;
      if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
        chrome.runtime.sendMessage({ type: 'OPEN_URL', url });
      }
    }
  }, [currentTrack?.id]);

  const pageRelease: DiscogsRelease | null = currentRelease ? {
    id: currentRelease.releaseId,
    title: currentRelease.title,
    artist: currentRelease.artist,
    year: currentRelease.year || 0,
    coverUrl: currentRelease.coverUrl,
    label: currentRelease.label,
    genre: currentRelease.genre,
  } : null;

  const openInBrowser = useCallback((releaseId: number) => {
    const url = `https://www.discogs.com/release/${releaseId}`;
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      chrome.runtime.sendMessage({ type: 'OPEN_URL', url });
    } else {
      window.open(url, '_blank');
    }
  }, []);

  const trackToRelease = useCallback((track: Track): DiscogsRelease => ({
    id: track.discogsReleaseId || 0,
    title: track.album || track.title,
    artist: track.artist,
    year: track.year,
    coverUrl: track.coverUrl,
    label: track.label,
    genre: track.genre,
  }), []);

  const handlePlayTrack = useCallback((track: Track) => {
    const idx = playlist.findIndex(t => t.id === track.id);
    if (idx !== -1) {
      selectTrack(idx);
      setActiveTab('player');
    }
  }, [playlist, selectTrack]);

  const handleLoadPlaylist = useCallback((tracks: Track[]) => {
    setPlaylist(tracks);
    setCurrentIndex(0);
    setActiveTab('player');
    setTimeout(() => {
      playerRef.current?.playVideo?.();
      setIsPlaying(true);
    }, 200);
  }, [setPlaylist, setCurrentIndex, setIsPlaying, playerRef]);

  const handleImportCollection = async (f: File) => {
    await loadCollectionCSV(f);
    triggerImmediate();
    toast('Collection imported!', { duration: 2000 });
  };

  const handleImportWantlist = async (f: File) => {
    await loadWantlistCSV(f);
    triggerImmediate();
    toast('Wantlist imported!', { duration: 2000 });
  };

  return (
    <div className={`flex flex-col h-screen bg-background text-foreground ${themeClass}`} style={{ width: '100%' }}>
      <Toaster position="bottom-right" />

      {/* Hidden YouTube player */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: -1 }}>
        <YouTubePlayer
          videoId={currentTrack?.youtubeId || ''}
          isPlaying={isPlaying}
          showVideo={false}
          playerRef={playerRef}
          onStateChange={(state: number) => {
            if (state === 0) skipNext();
            if (state === 1) setIsPlaying(true);
            if (state === 2) setIsPlaying(false);
          }}
          onReady={() => {}}
        />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-card/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
            <Disc3 className="w-3 h-3 text-primary" />
          </div>
          <span className="text-xs font-bold tracking-tight font-display">VinylStream</span>
          {currentRelease && (
            <span className="text-[9px] text-primary/60 bg-primary/10 px-1 rounded">
              on Discogs
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {csvLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          {!hasCSVData && (
            <label className="flex items-center gap-1 text-[10px] text-primary cursor-pointer hover:text-primary/80">
              <Upload className="w-3 h-3" />
              Import CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImportCollection(f); }}
              />
            </label>
          )}
        </div>
      </header>

      {/* Compact player (always visible) */}
      <CompactPlayer
        track={currentTrack || null}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={playerDuration || currentTrack?.duration || 0}
        isShuffle={isShuffle}
        onPlay={play}
        onPause={pause}
        onNext={skipNext}
        onPrev={skipPrev}
        onSeek={seekTo}
        onToggleShuffle={toggleShuffle}
        showPitch={settings.pitchEnabled}
        ytPlayerRef={playerRef}
      />

      {/* Tab bar */}
      <div className="shrink-0 border-b border-border/40 bg-card/30">
        <div className="flex">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[9px] font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'player' && (
          <NowPlayingView
            track={currentTrack || null}
            playlist={playlist}
            currentIndex={currentIndex}
            isPlaying={isPlaying}
            showRainbow={settings.showRainbowPulse}
            showPitch={settings.pitchEnabled}
            onSelectTrack={selectTrack}
            onPlay={play}
            ytPlayerRef={playerRef}
          />
        )}

        {activeTab === 'crates' && (
          <CratesView
            currentRelease={pageRelease || (currentTrack ? trackToRelease(currentTrack) : null)}
            onPlayRelease={release => {
              const track = allTracks.find(t => t.discogsReleaseId === release.id);
              if (track) handlePlayTrack(track);
            }}
          />
        )}

        {activeTab === 'playlists' && (
          <PlaylistsView
            currentTrack={currentTrack}
            onLoadPlaylist={handleLoadPlaylist}
            onPlayTrack={handlePlayTrack}
          />
        )}

        {activeTab === 'cart' && (
          <CartsView
            currentRelease={pageRelease || (currentTrack ? trackToRelease(currentTrack) : null)}
          />
        )}

        {activeTab === 'wantlist' && (
          <WantlistView
            wantlist={csvWantlist}
            onPlay={handlePlayTrack}
            onOpenInBrowser={openInBrowser}
            onClearAll={clearWantlist}
            onImportCSV={handleImportWantlist}
          />
        )}

        {activeTab === 'collection' && (
          <CollectionView
            collection={csvCollection}
            onPlay={handlePlayTrack}
            onOpenInBrowser={openInBrowser}
            onClearAll={clearCollection}
            onImportCSV={handleImportCollection}
          />
        )}

        {activeTab === 'suggestions' && (
          <SuggestionsView
            currentTrack={currentTrack}
            onOpenInBrowser={openInBrowser}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdate={updateSetting}
            onReset={resetSettings}
          />
        )}
      </div>
    </div>
  );
}
