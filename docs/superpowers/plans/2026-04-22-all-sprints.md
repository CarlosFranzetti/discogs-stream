# Discogs Stream — All Sprints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement volume hardening, keyboard shortcuts overhaul, reset bug fix, Now Playing Panel, Discogs OAuth sync, tests, security, and perf improvements — four sub-projects in order, no push/deploy.

**Architecture:** Per-route `useAudioController` hook as single volume source of truth; new keyboard shortcuts using arrow keys for nav, +/- for volume; `NowPlayingPanel` bottom sheet triggered by album art tap; `discogsSync` service for diff-based OAuth collection sync.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Tailwind, shadcn/ui, Supabase edge functions (Deno), YouTube IFrame API.

---

## Sub-project A — Foundation Fixes

### Task 1: Create `useAudioController` hook

**Files:**
- Create: `src/hooks/useAudioController.ts`

- [ ] **Step 1: Create the file with this exact content**

```ts
import { useRef, useState, useCallback } from 'react';

export interface AudioController {
  volume: number;
  isMuted: boolean;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  attachYTPlayer: (player: YT.Player | null) => void;
  attachAudioElement: (el: HTMLAudioElement | null) => void;
}

export function useAudioController(): AudioController {
  const [volume, setVolumeState] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

  const ytPlayerRef = useRef<YT.Player | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  // Refs track live values so callbacks never go stale
  const volumeRef = useRef(100);
  const isMutedRef = useRef(false);

  const syncPlayers = useCallback((vol: number, muted: boolean) => {
    if (ytPlayerRef.current) {
      if (muted) {
        ytPlayerRef.current.mute();
      } else {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(vol);
      }
    }
    if (audioElRef.current) {
      audioElRef.current.muted = muted;
      audioElRef.current.volume = muted ? 0 : vol / 100;
    }
  }, []); // stable — only reads refs

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    volumeRef.current = clamped;
    isMutedRef.current = false;
    setVolumeState(clamped);
    setIsMuted(false);
    syncPlayers(clamped, false);
  }, [syncPlayers]);

  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current;
    isMutedRef.current = next;
    setIsMuted(next);
    syncPlayers(volumeRef.current, next);
  }, [syncPlayers]);

  const attachYTPlayer = useCallback((player: YT.Player | null) => {
    ytPlayerRef.current = player;
    if (player) syncPlayers(volumeRef.current, isMutedRef.current);
  }, [syncPlayers]);

  const attachAudioElement = useCallback((el: HTMLAudioElement | null) => {
    audioElRef.current = el;
    if (el) syncPlayers(volumeRef.current, isMutedRef.current);
  }, [syncPlayers]);

  return { volume, isMuted, setVolume, toggleMute, attachYTPlayer, attachAudioElement };
}
```

---

### Task 2: Update `useKeyboardShortcuts`

**Files:**
- Modify: `src/hooks/useKeyboardShortcuts.ts`

- [ ] **Step 1: Replace the entire file with this content**

```ts
import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onTogglePlay: () => void;
  onSkipPrev: () => void;
  onSkipNext: () => void;
  onTogglePlaylist?: () => void;
  onToggleShuffle?: () => void;
  onToggleOptions?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onToggleMute?: () => void;
  onSkipNextRelease?: () => void;
  onSkipPrevRelease?: () => void;
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onSkipPrev,
  onSkipNext,
  onTogglePlaylist,
  onToggleShuffle,
  onToggleOptions,
  onVolumeUp,
  onVolumeDown,
  onToggleMute,
  onSkipNextRelease,
  onSkipPrevRelease,
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          onTogglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSkipPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSkipNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          onSkipNextRelease?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onSkipPrevRelease?.();
          break;
        case '+':
        case '=':
          e.preventDefault();
          onVolumeUp?.();
          break;
        case '-':
          e.preventDefault();
          onVolumeDown?.();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          onToggleMute?.();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          onTogglePlaylist?.();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          onToggleShuffle?.();
          break;
        case 'o':
        case 'O':
          e.preventDefault();
          onToggleOptions?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onTogglePlay, onSkipPrev, onSkipNext, onTogglePlaylist,
    onToggleShuffle, onToggleOptions, onVolumeUp, onVolumeDown,
    onToggleMute, onSkipNextRelease, onSkipPrevRelease,
  ]);
}
```

---

### Task 3: Add `skipNextRelease` / `skipPrevRelease` to `usePlayer`

**Files:**
- Modify: `src/hooks/usePlayer.ts`

- [ ] **Step 1: After the `skipPrev` callback (around line 271), add these two callbacks**

```ts
  const skipNextRelease = useCallback(() => {
    if (playlist.length === 0) return;
    const currentReleaseId = playlist[currentIndex]?.discogsReleaseId;
    const nextIdx = currentReleaseId
      ? playlist.findIndex((t, i) => i > currentIndex && t.discogsReleaseId !== currentReleaseId)
      : -1;
    if (nextIdx === -1) return;
    setCurrentTime(0);
    setCurrentIndex(nextIdx);
    setTimeout(() => {
      playerRef.current?.playVideo();
      setIsPlaying(true);
    }, 100);
  }, [playlist, currentIndex]);

  const skipPrevRelease = useCallback(() => {
    if (playlist.length === 0 || currentIndex === 0) return;
    const currentReleaseId = playlist[currentIndex]?.discogsReleaseId;
    let i = currentIndex - 1;
    while (i >= 0 && playlist[i].discogsReleaseId === currentReleaseId) i--;
    if (i < 0) return;
    const prevReleaseId = playlist[i].discogsReleaseId;
    const firstOfPrev = prevReleaseId
      ? playlist.findIndex(t => t.discogsReleaseId === prevReleaseId)
      : i;
    setCurrentTime(0);
    setCurrentIndex(firstOfPrev !== -1 ? firstOfPrev : i);
    setTimeout(() => {
      playerRef.current?.playVideo();
      setIsPlaying(true);
    }, 100);
  }, [playlist, currentIndex]);
```

- [ ] **Step 2: Add `skipNextRelease` and `skipPrevRelease` to the return object at the bottom of `usePlayer`**

```ts
  return {
    playlist,
    currentTrack,
    currentIndex,
    isPlaying,
    currentTime,
    playerDuration,
    showVideo,
    playerRef,
    play,
    pause,
    togglePlay,
    skipNext,
    skipPrev,
    skipNextRelease,
    skipPrevRelease,
    seekTo,
    skipForward,
    skipBackward,
    selectTrack,
    toggleVideo,
    setCurrentIndex,
    setCurrentTime,
    setIsPlaying,
    setPlaylist,
    removeFromPlaylist,
    isShuffle,
    toggleShuffle,
  };
```

- [ ] **Step 3: Remove all `console.log` and `console.warn` calls from `usePlayer.ts`** (there are ~10 of them)

---

### Task 4: Wire `useAudioController` + new shortcuts into `MobilePlayer`

**Files:**
- Modify: `src/components/MobilePlayer.tsx`

- [ ] **Step 1: Add the import at the top of `MobilePlayer.tsx`**

```ts
import { useAudioController } from '@/hooks/useAudioController';
```

- [ ] **Step 2: Add the hook call near the other hooks (after `usePlayer`)**

```ts
  const audioController = useAudioController();
```

- [ ] **Step 3: Destructure `skipNextRelease` and `skipPrevRelease` from `usePlayer` return**

Find the `usePlayer(filteredTracks, persistedDislikedTracks)` call and add to the destructure:

```ts
  const {
    playlist,
    currentTrack,
    currentIndex,
    isPlaying,
    currentTime,
    playerDuration,
    playerRef,
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
    skipForward,
    skipBackward,
    selectTrack,
    setCurrentIndex,
    setCurrentTime,
    setIsPlaying,
    setPlaylist,
    removeFromPlaylist,
    isShuffle,
    toggleShuffle,
    skipNextRelease,
    skipPrevRelease,
  } = usePlayer(filteredTracks, persistedDislikedTracks);
```

- [ ] **Step 4: Replace the `volume` useState and `handleVolumeChange` with audioController equivalents**

Remove:
```ts
  const [volume, setVolume] = useState(100);
```
and:
```ts
  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (playerRef.current) {
      playerRef.current.setVolume(newVolume);
    }
  }, [playerRef]);
```

Add:
```ts
  const handleVolumeChange = useCallback((value: number[]) => {
    audioController.setVolume(value[0]);
  }, [audioController]);
```

- [ ] **Step 5: Update `useKeyboardShortcuts` call to add new callbacks**

```ts
  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onSkipPrev: skipPrev,
    onSkipNext: skipNext,
    onTogglePlaylist: () => setSidebarOpen(prev => !prev),
    onToggleShuffle: toggleShuffle,
    onToggleOptions: () => setIsOptionsOpen(prev => !prev),
    onVolumeUp: () => audioController.setVolume(audioController.volume + 5),
    onVolumeDown: () => audioController.setVolume(audioController.volume - 5),
    onToggleMute: audioController.toggleMute,
    onSkipNextRelease: skipNextRelease,
    onSkipPrevRelease: skipPrevRelease,
  });
```

- [ ] **Step 6: Wire `attachYTPlayer` to the `onReady` callback of both `YouTubePlayer` instances**

Find `onReady={() => {}}` and replace both occurrences with:
```ts
onReady={() => { audioController.attachYTPlayer(playerRef.current); }}
```

- [ ] **Step 7: Update `MobileTransportControls` props to use `audioController.volume`**

```ts
          volume={audioController.volume}
```

---

### Task 5: Wire `useAudioController` into `Player.tsx` (desktop)

**Files:**
- Modify: `src/components/Player.tsx`
- Modify: `src/components/DirectAudioPlayer.tsx`

- [ ] **Step 1: Add `volume` and `muted` props to `DirectAudioPlayer`**

In `DirectAudioPlayer.tsx`, update the props interface:

```ts
interface DirectAudioPlayerProps {
  audioUrl: string;
  isPlaying: boolean;
  onEnded: () => void;
  onError?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  seekTime?: number;
  volume?: number;   // 0–100
  muted?: boolean;
}
```

Add `volume` and `muted` to the component signature and add a `useEffect` to sync them:

```ts
export const DirectAudioPlayer = React.forwardRef<DirectAudioPlayerRef, DirectAudioPlayerProps>(
  ({ audioUrl, isPlaying, onEnded, onError, onTimeUpdate, seekTime, volume = 100, muted = false }, ref) => {
```

Add after the existing `seekTime` effect:

```ts
    useEffect(() => {
      if (!audioRef.current) return;
      audioRef.current.volume = muted ? 0 : volume / 100;
      audioRef.current.muted = muted;
    }, [volume, muted]);
```

- [ ] **Step 2: Remove all `console.log` and `console.error` calls from `DirectAudioPlayer.tsx`**

- [ ] **Step 3: Add import and hook call in `Player.tsx`**

```ts
import { useAudioController } from '@/hooks/useAudioController';
```

Inside `Player` component, after the `usePlayer` call:

```ts
  const audioController = useAudioController();
```

- [ ] **Step 4: Find the `useKeyboardShortcuts` call in `Player.tsx` and add new callbacks**

```ts
  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onSkipPrev: skipPrev,
    onSkipNext: skipNext,
    onVolumeUp: () => audioController.setVolume(audioController.volume + 5),
    onVolumeDown: () => audioController.setVolume(audioController.volume - 5),
    onToggleMute: audioController.toggleMute,
    onSkipNextRelease: skipNextRelease,
    onSkipPrevRelease: skipPrevRelease,
  });
```

(Add `skipNextRelease`, `skipPrevRelease` to the `usePlayer` destructure in `Player.tsx` too.)

- [ ] **Step 5: Wire `attachYTPlayer` in `Player.tsx`'s `YouTubePlayer` `onReady`**

```ts
onReady={() => { audioController.attachYTPlayer(playerRef.current); }}
```

- [ ] **Step 6: Pass `volume` and `muted` to `DirectAudioPlayer` in `Player.tsx`**

```ts
<DirectAudioPlayer
  volume={audioController.volume}
  muted={audioController.isMuted}
  ...rest
/>
```

---

### Task 6: Fix the reset bug in `MobilePlayer`

**Files:**
- Modify: `src/components/MobilePlayer.tsx`

- [ ] **Step 1: In the `onClearData` handler passed to `SettingsDialog` (around line 862), add `setHasUserInteracted(false)` and clear `cacheHydratedRef`**

Find the `onClearData` handler block and update it to:

```ts
            onClearData={() => {
              clearCSVData();
              clearCollection();
              clearWantlist();
              clearCache();
              deleteTracks(ownerKey);
              setDiscogsTracks([]);
              setCurrentVideoId('');
              setHasUserInteracted(false);
              cachedRowsRef.current = [];
              cacheHydratedRef.current = null;
              hasAutoStartedRef.current = false;
              lastSearchedTrackId.current = '';
              prefetchedRef.current.clear();
              fallbackAttemptedRef.current.clear();
            }}
```

---

### Task 7: `console.log` cleanup sweep

**Files:**
- Modify: `src/components/MobilePlayer.tsx`
- Modify: `src/components/YouTubePlayer.tsx`
- Modify: `src/hooks/usePlayer.ts` (already done in Task 3)
- Modify: `src/hooks/useBackgroundVerifier.ts`

- [ ] **Step 1: In `MobilePlayer.tsx`, remove every `console.log(...)` and `console.error(...)` call** (there are ~12 across the file — search for `console.` and delete each line)

- [ ] **Step 2: In `YouTubePlayer.tsx`, remove every `console.log(...)` and `console.error(...)` call** (~5 instances)

- [ ] **Step 3: Run lint to confirm no regressions**

```bash
npm run lint
```

Expected: 0 errors.

---

### Task 8: Commit Sub-project A

- [ ] **Step 1: Run lint and build**

```bash
npm run lint && npm run build
```

Expected: no errors, build succeeds.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAudioController.ts \
        src/hooks/useKeyboardShortcuts.ts \
        src/hooks/usePlayer.ts \
        src/components/MobilePlayer.tsx \
        src/components/Player.tsx \
        src/components/DirectAudioPlayer.tsx \
        src/components/YouTubePlayer.tsx
git commit -m "feat: volume controller hook, release skip shortcuts, reset fix, console cleanup"
```

---

## Sub-project B — Now Playing Panel

### Task 9: Extend `discogs-public` edge function for marketplace stats

**Files:**
- Modify: `supabase/functions/discogs-public/index.ts`

- [ ] **Step 1: Replace the entire `discogs-public/index.ts` with this content**

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DISCOGS_CONSUMER_KEY = Deno.env.get('DISCOGS_CONSUMER_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action ?? 'release';
    const release_id = body.release_id;

    if (!release_id) {
      throw new Error('release_id is required');
    }

    if (action === 'marketplace') {
      const response = await fetch(
        `https://api.discogs.com/marketplace/stats/${release_id}?curr_abbr=USD`,
        { headers: { 'User-Agent': 'DiscogsRadio/1.0', 'Authorization': `Discogs key=${DISCOGS_CONSUMER_KEY}` } }
      );
      if (!response.ok) {
        return new Response(JSON.stringify({ lowest_price: null, num_for_sale: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const data = await response.json();
      return new Response(JSON.stringify({
        lowest_price: data.lowest_price ?? null,
        num_for_sale: data.num_for_sale ?? 0,
        blocked_from_sale: data.blocked_from_sale ?? false,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Default: release detail
    const response = await fetch(
      `https://api.discogs.com/releases/${release_id}?key=${DISCOGS_CONSUMER_KEY}`,
      { headers: { 'User-Agent': 'DiscogsRadio/1.0' } }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(JSON.stringify({ error: 'Release not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Discogs API error: ${await response.text()}`);
    }

    const data = await response.json();
    const result = {
      id: data.id,
      title: data.title,
      thumb: data.thumb,
      cover_image: data.images?.[0]?.uri || data.thumb,
      images: data.images?.map((img: { uri?: string; resource_url?: string; type?: string }) => ({
        uri: img.uri || img.resource_url || '',
        type: img.type,
      })),
      artists: data.artists?.map((a: { name: string }) => ({ name: a.name })),
      year: data.year,
      country: data.country,
      genres: data.genres,
      styles: data.styles,
      labels: data.labels?.map((l: { name: string; catno?: string }) => ({ name: l.name, catno: l.catno })),
      formats: data.formats?.map((f: { name: string; descriptions?: string[]; qty?: string }) => ({
        name: f.name,
        descriptions: f.descriptions ?? [],
        qty: f.qty,
      })),
      tracklist: data.tracklist?.map((t: { position?: string; title?: string; duration?: string; type_?: string; artists?: Array<{ name: string }> }) => ({
        position: t.position,
        title: t.title,
        duration: t.duration,
        type_: t.type_,
        artists: t.artists?.map((a: { name: string }) => ({ name: a.name })),
      })),
      videos: data.videos?.map((v: { uri?: string; url?: string; title?: string }) => ({
        uri: v.uri || v.url || '',
        title: v.title,
      })),
      uri: data.uri,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

---

### Task 10: Create `useNowPlayingData` hook

**Files:**
- Create: `src/hooks/useNowPlayingData.ts`

- [ ] **Step 1: Create the file with this exact content**

```ts
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ReleaseDetail {
  id: number;
  title: string;
  artists: { name: string }[];
  year: number;
  country: string;
  genres: string[];
  styles: string[];
  labels: { name: string; catno?: string }[];
  formats: { name: string; descriptions: string[]; qty?: string }[];
  uri: string;
}

export interface MarketplaceStats {
  lowest_price: { value: number; currency: string } | null;
  num_for_sale: number;
  blocked_from_sale: boolean;
}

export interface NowPlayingData {
  releaseDetail: ReleaseDetail | null;
  marketplaceStats: MarketplaceStats | null;
  isLoading: boolean;
  error: string | null;
}

interface CacheEntry {
  releaseDetail: ReleaseDetail | null;
  marketplaceStats: MarketplaceStats | null;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const sessionCache = new Map<string, CacheEntry>();

export function useNowPlayingData(releaseId: string | undefined): NowPlayingData {
  const [releaseDetail, setReleaseDetail] = useState<ReleaseDetail | null>(null);
  const [marketplaceStats, setMarketplaceStats] = useState<MarketplaceStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!releaseId) {
      setReleaseDetail(null);
      setMarketplaceStats(null);
      return;
    }

    const cached = sessionCache.get(releaseId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setReleaseDetail(cached.releaseDetail);
      setMarketplaceStats(cached.marketplaceStats);
      setIsLoading(false);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    Promise.all([
      supabase.functions.invoke('discogs-public', {
        body: { action: 'release', release_id: releaseId },
      }),
      supabase.functions.invoke('discogs-public', {
        body: { action: 'marketplace', release_id: releaseId },
      }),
    ]).then(([releaseRes, marketRes]) => {
      if (controller.signal.aborted) return;
      const detail = releaseRes.data as ReleaseDetail | null;
      const market = marketRes.data as MarketplaceStats | null;
      sessionCache.set(releaseId, { releaseDetail: detail, marketplaceStats: market, fetchedAt: Date.now() });
      setReleaseDetail(detail);
      setMarketplaceStats(market);
      setIsLoading(false);
    }).catch((err) => {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load release data');
      setIsLoading(false);
    });

    return () => { controller.abort(); };
  }, [releaseId]);

  return { releaseDetail, marketplaceStats, isLoading, error };
}
```

---

### Task 11: Create `NowPlayingPanel` component

**Files:**
- Create: `src/components/NowPlayingPanel.tsx`

- [ ] **Step 1: Create the file with this content**

```tsx
import { ExternalLink, X, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useNowPlayingData } from '@/hooks/useNowPlayingData';
import { Track } from '@/types/track';

interface NowPlayingPanelProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatPrice(price: { value: number; currency: string } | null): string {
  if (!price) return '—';
  return `${price.currency} ${price.value.toFixed(2)}`;
}

export function NowPlayingPanel({ track, isOpen, onClose }: NowPlayingPanelProps) {
  const { releaseDetail, marketplaceStats, isLoading } = useNowPlayingData(
    isOpen ? track?.discogsReleaseId : undefined
  );

  const discogsUrl = releaseDetail?.uri
    ? `https://www.discogs.com${releaseDetail.uri}`
    : track?.discogsReleaseId
    ? `https://www.discogs.com/release/${track.discogsReleaseId}`
    : null;

  const label = releaseDetail?.labels?.[0];
  const format = releaseDetail?.formats?.[0];
  const allGenres = [
    ...(releaseDetail?.genres ?? (track?.genre ? [track.genre] : [])),
    ...(releaseDetail?.styles ?? []),
  ].filter(Boolean);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto pb-safe">
        <SheetHeader className="flex flex-row items-center justify-between mb-4">
          <SheetTitle className="text-sm font-semibold">Release Info</SheetTitle>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && track && (
          <div className="space-y-4">
            {/* Artist + title */}
            <div>
              <p className="text-base font-semibold text-foreground leading-tight">{track.title}</p>
              <p className="text-sm text-muted-foreground">{track.artist}</p>
            </div>

            {/* Release metadata grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {(track.year || releaseDetail?.year) && (
                <>
                  <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">Year</span>
                  <span className="text-foreground">{releaseDetail?.year ?? track.year}</span>
                </>
              )}
              {(track.country || releaseDetail?.country) && (
                <>
                  <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">Country</span>
                  <span className="text-foreground">{releaseDetail?.country ?? track.country}</span>
                </>
              )}
              {label && (
                <>
                  <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">Label</span>
                  <span className="text-foreground">{label.name}{label.catno ? ` — ${label.catno}` : ''}</span>
                </>
              )}
              {format && (
                <>
                  <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">Format</span>
                  <span className="text-foreground">{format.name}{format.descriptions.length ? ` (${format.descriptions.join(', ')})` : ''}</span>
                </>
              )}
            </div>

            {/* Genres / styles */}
            {allGenres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allGenres.map((g) => (
                  <span key={g} className="px-2 py-0.5 rounded-full bg-muted text-[11px] text-muted-foreground">{g}</span>
                ))}
              </div>
            )}

            {/* Marketplace */}
            {marketplaceStats && (
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Marketplace</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Lowest price</span>
                  <span className="font-medium text-foreground">{formatPrice(marketplaceStats.lowest_price)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">For sale</span>
                  <span className="font-medium text-foreground">{marketplaceStats.num_for_sale}</span>
                </div>
                {marketplaceStats.blocked_from_sale && (
                  <p className="text-[10px] text-muted-foreground/50">Marketplace data may be limited for this release.</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-1">
              {discogsUrl && (
                <a
                  href={discogsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-border text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open on Discogs
                </a>
              )}
              {marketplaceStats && marketplaceStats.num_for_sale > 0 && discogsUrl && (
                <a
                  href={`${discogsUrl}#release-marketplace`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Buy from {formatPrice(marketplaceStats.lowest_price)}
                </a>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

---

### Task 12: Wire `NowPlayingPanel` into `MobilePlayer` and update album art click

**Files:**
- Modify: `src/components/MobilePlayer.tsx`
- Modify: `src/components/MobileAlbumCover.tsx`

- [ ] **Step 1: Add import in `MobilePlayer.tsx`**

```ts
import { NowPlayingPanel } from './NowPlayingPanel';
```

- [ ] **Step 2: Add `nowPlayingOpen` state near other boolean states**

```ts
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
```

- [ ] **Step 3: Change the `MobileAlbumCover` click handler to open Now Playing (not toggle play)**

In `MobilePlayer.tsx`, find `<MobileAlbumCover` and change `onClick={togglePlay}` to:

```tsx
<MobileAlbumCover
  track={currentTrack}
  isPlaying={isPlaying}
  onClick={() => setNowPlayingOpen(true)}
/>
```

- [ ] **Step 4: Update the hover tooltip in `MobileAlbumCover.tsx` to reflect new action**

In `MobileAlbumCover.tsx`, find the hover hint div and replace:
```tsx
          {isPlaying ? 'Tap to pause' : 'Tap to play'}
```
with:
```tsx
          Release info
```

- [ ] **Step 5: Add `NowPlayingPanel` at the bottom of the main player return in `MobilePlayer.tsx`, just before the closing `</div>`**

```tsx
      <NowPlayingPanel
        track={currentTrack}
        isOpen={nowPlayingOpen}
        onClose={() => setNowPlayingOpen(false)}
      />
```

---

### Task 13: Commit Sub-project B

- [ ] **Step 1: Run lint and build**

```bash
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/discogs-public/index.ts \
        src/hooks/useNowPlayingData.ts \
        src/components/NowPlayingPanel.tsx \
        src/components/MobilePlayer.tsx \
        src/components/MobileAlbumCover.tsx
git commit -m "feat: Now Playing Panel with release details and marketplace stats"
```

---

## Sub-project C — Discogs OAuth Sync

### Task 14: Extend `discogs-api` edge function with full-pagination actions

**Files:**
- Modify: `supabase/functions/discogs-api/index.ts`

- [ ] **Step 1: Read the full current `discogs-api/index.ts`** to understand all existing actions before editing.

- [ ] **Step 2: Add a `collection_full` action** that loops through all pages and returns all releases.

After the existing `if (action === 'collection')` block, add:

```ts
    if (action === 'collection_full') {
      const allReleases: unknown[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await fetch(
          `https://api.discogs.com/users/${username}/collection/folders/0/releases?page=${page}&per_page=100`,
          { headers: { 'Authorization': oauthHeader, 'User-Agent': 'DiscogsRadio/1.0' } }
        );
        if (!res.ok) break;
        const data = await res.json();
        allReleases.push(...(data.releases || []));
        totalPages = data.pagination?.pages ?? 1;
        page++;
      } while (page <= totalPages);

      return new Response(JSON.stringify({ releases: allReleases }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
```

- [ ] **Step 3: Add a `wantlist_full` action** immediately after the `collection_full` block:

```ts
    if (action === 'wantlist_full') {
      const allWants: unknown[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await fetch(
          `https://api.discogs.com/users/${username}/wants?page=${page}&per_page=100`,
          { headers: { 'Authorization': oauthHeader, 'User-Agent': 'DiscogsRadio/1.0' } }
        );
        if (!res.ok) break;
        const data = await res.json();
        allWants.push(...(data.wants || []));
        totalPages = data.pagination?.pages ?? 1;
        page++;
      } while (page <= totalPages);

      return new Response(JSON.stringify({ wants: allWants }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
```

---

### Task 15: Create `discogsSync.ts` service

**Files:**
- Create: `src/services/discogsSync.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p /Users/carlosfranzetti/Documents/GITHUB/discogs-stream/src/services
```

- [ ] **Step 2: Create `src/services/discogsSync.ts` with this content**

```ts
import { supabase } from '@/integrations/supabase/client';
import { Track } from '@/types/track';

interface DiscogsCredentials {
  token: string;
  secret: string;
  username: string;
}

interface DiscogsRelease {
  id: number;
  basic_information: {
    id: number;
    title: string;
    year: number;
    thumb: string;
    cover_image: string;
    artists: { name: string }[];
    genres: string[];
    styles: string[];
    labels: { name: string; catno?: string }[];
    formats: { name: string }[];
  };
}

interface DiscogsWant {
  id: number;
  basic_information: DiscogsRelease['basic_information'];
}

function releaseToTrack(release: DiscogsRelease, source: 'collection' | 'wantlist'): Track {
  const info = release.basic_information;
  return {
    id: `${source}-${info.id}-A1`,
    source,
    title: info.title,
    artist: info.artists?.map(a => a.name).join(', ') ?? 'Unknown',
    album: info.title,
    year: info.year ?? 0,
    genre: info.genres?.[0] ?? 'Unknown',
    label: info.labels?.[0]?.name ?? 'Unknown',
    duration: 240,
    coverUrl: info.cover_image || info.thumb || '/placeholder.svg',
    coverUrls: [info.cover_image, info.thumb].filter(Boolean) as string[],
    youtubeId: '',
    workingStatus: 'pending',
    discogsReleaseId: String(info.id),
    discogsTrackPosition: 'A1',
  };
}

export async function fetchFullCollection(
  credentials: DiscogsCredentials
): Promise<Track[]> {
  const { data, error } = await supabase.functions.invoke('discogs-api', {
    body: {
      action: 'collection_full',
      access_token: credentials.token,
      access_token_secret: credentials.secret,
      username: credentials.username,
    },
  });
  if (error || !data?.releases) return [];
  return (data.releases as DiscogsRelease[]).map(r => releaseToTrack(r, 'collection'));
}

export async function fetchFullWantlist(
  credentials: DiscogsCredentials
): Promise<Track[]> {
  const { data, error } = await supabase.functions.invoke('discogs-api', {
    body: {
      action: 'wantlist_full',
      access_token: credentials.token,
      access_token_secret: credentials.secret,
      username: credentials.username,
    },
  });
  if (error || !data?.wants) return [];
  return (data.wants as DiscogsWant[]).map(w => releaseToTrack({ id: w.id, basic_information: w.basic_information }, 'wantlist'));
}

export interface SyncResult {
  added: Track[];
  unchanged: number;
}

export function diffSync(remote: Track[], local: Track[]): SyncResult {
  const localIds = new Set(local.map(t => t.discogsReleaseId));
  const added = remote.filter(t => !localIds.has(t.discogsReleaseId));
  const unchanged = remote.length - added.length;
  return { added, unchanged };
}
```

---

### Task 16: Create `useDiscogsSync` hook

**Files:**
- Create: `src/hooks/useDiscogsSync.ts`

- [ ] **Step 1: Create the file with this content**

```ts
import { useState, useCallback } from 'react';
import { fetchFullCollection, fetchFullWantlist, diffSync } from '@/services/discogsSync';
import { Track } from '@/types/track';

const LAST_SYNC_KEY = 'discogs_stream_last_sync';

interface SyncCredentials {
  token: string;
  secret: string;
  username: string;
}

interface UseDiscogsSync {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncError: string | null;
  syncNow: (
    credentials: SyncCredentials,
    currentTracks: Track[],
    onTracksAdded: (tracks: Track[]) => void
  ) => Promise<void>;
}

function loadLastSync(): Date | null {
  const stored = localStorage.getItem(LAST_SYNC_KEY);
  if (!stored) return null;
  const d = new Date(stored);
  return isNaN(d.getTime()) ? null : d;
}

export function useDiscogsSync(): UseDiscogsSync {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(loadLastSync);
  const [syncError, setSyncError] = useState<string | null>(null);

  const syncNow = useCallback(async (
    credentials: SyncCredentials,
    currentTracks: Track[],
    onTracksAdded: (tracks: Track[]) => void
  ) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const [remoteCollection, remoteWantlist] = await Promise.all([
        fetchFullCollection(credentials),
        fetchFullWantlist(credentials),
      ]);
      const remote = [...remoteCollection, ...remoteWantlist];
      const { added } = diffSync(remote, currentTracks);
      if (added.length > 0) {
        onTracksAdded(added);
      }
      const now = new Date();
      setLastSyncAt(now);
      localStorage.setItem(LAST_SYNC_KEY, now.toISOString());
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return { isSyncing, lastSyncAt, syncError, syncNow };
}
```

---

### Task 17: Wire `useDiscogsSync` into `MobilePlayer` and `SettingsDialog`

**Files:**
- Modify: `src/components/MobilePlayer.tsx`
- Modify: `src/components/SettingsDialog.tsx`

- [ ] **Step 1: Import and use `useDiscogsSync` in `MobilePlayer.tsx`**

Add import:
```ts
import { useDiscogsSync } from '@/hooks/useDiscogsSync';
```

Add hook call after `useDiscogsAuth`:
```ts
  const { isSyncing, lastSyncAt, syncError, syncNow } = useDiscogsSync();
```

- [ ] **Step 2: Add auto-sync on mount when credentials are present** — add this effect after the existing credential-based effect:

```ts
  useEffect(() => {
    if (!isAuthenticated || !credentials) return;
    syncNow(
      { token: credentials.token, secret: credentials.secret, username: credentials.username },
      discogsTracks,
      (added) => {
        setDiscogsTracks(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          return [...prev, ...added.filter(t => !existingIds.has(t.id))];
        });
      }
    );
  // Only run once on credentials becoming available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
```

- [ ] **Step 3: Pass sync props to `SettingsDialog`**

Update the `SettingsDialog` props interface to accept:
```ts
  isSyncing?: boolean;
  lastSyncAt?: Date | null;
  syncError?: string | null;
  onSyncNow?: () => void;
```

Update the `SettingsDialog` JSX in `MobilePlayer.tsx`:
```tsx
            <SettingsDialog
              ...existingProps
              isSyncing={isSyncing}
              lastSyncAt={lastSyncAt}
              syncError={syncError ?? undefined}
              onSyncNow={() =>
                credentials && syncNow(
                  { token: credentials.token, secret: credentials.secret, username: credentials.username },
                  discogsTracks,
                  (added) => setDiscogsTracks(prev => {
                    const ids = new Set(prev.map(t => t.id));
                    return [...prev, ...added.filter(t => !ids.has(t.id))];
                  })
                )
              }
            />
```

- [ ] **Step 4: Add sync status UI to `SettingsDialog.tsx`**

Update `SettingsDialogProps` to include the new fields:
```ts
  isSyncing?: boolean;
  lastSyncAt?: Date | null;
  syncError?: string | null;
  onSyncNow?: () => void;
```

Add inside the Discogs Account section, after the connected user display:
```tsx
            {isDiscogsAuthenticated && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {isSyncing
                    ? 'Syncing…'
                    : lastSyncAt
                    ? `Last sync: ${lastSyncAt.toLocaleTimeString()}`
                    : 'Never synced'}
                </span>
                {onSyncNow && !isSyncing && (
                  <button
                    onClick={onSyncNow}
                    className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Sync now
                  </button>
                )}
              </div>
            )}
            {syncError && (
              <p className="text-[11px] text-destructive">{syncError}</p>
            )}
```

---

### Task 18: Commit Sub-project C

- [ ] **Step 1: Run lint and build**

```bash
npm run lint && npm run build
```

Expected: 0 errors.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/discogs-api/index.ts \
        src/services/discogsSync.ts \
        src/hooks/useDiscogsSync.ts \
        src/components/MobilePlayer.tsx \
        src/components/SettingsDialog.tsx
git commit -m "feat: Discogs OAuth diff-sync with collection_full/wantlist_full pagination"
```

---

## Sub-project D — Tests + Security + Performance

### Task 19: Test `useAudioController`

**Files:**
- Create: `src/hooks/useAudioController.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioController } from './useAudioController';

describe('useAudioController', () => {
  it('starts at volume 100, not muted', () => {
    const { result } = renderHook(() => useAudioController());
    expect(result.current.volume).toBe(100);
    expect(result.current.isMuted).toBe(false);
  });

  it('clamps volume to 0–100', () => {
    const { result } = renderHook(() => useAudioController());
    act(() => result.current.setVolume(150));
    expect(result.current.volume).toBe(100);
    act(() => result.current.setVolume(-10));
    expect(result.current.volume).toBe(0);
  });

  it('toggleMute flips muted state without changing volume', () => {
    const { result } = renderHook(() => useAudioController());
    act(() => result.current.setVolume(60));
    act(() => result.current.toggleMute());
    expect(result.current.isMuted).toBe(true);
    expect(result.current.volume).toBe(60);
    act(() => result.current.toggleMute());
    expect(result.current.isMuted).toBe(false);
    expect(result.current.volume).toBe(60);
  });

  it('setVolume clears mute state', () => {
    const { result } = renderHook(() => useAudioController());
    act(() => result.current.toggleMute());
    expect(result.current.isMuted).toBe(true);
    act(() => result.current.setVolume(80));
    expect(result.current.isMuted).toBe(false);
    expect(result.current.volume).toBe(80);
  });

  it('attachYTPlayer syncs volume to the player', () => {
    const { result } = renderHook(() => useAudioController());
    const mockPlayer = {
      setVolume: vi.fn(),
      mute: vi.fn(),
      unMute: vi.fn(),
    } as unknown as YT.Player;

    act(() => result.current.setVolume(70));
    act(() => result.current.attachYTPlayer(mockPlayer));

    expect(mockPlayer.unMute).toHaveBeenCalled();
    expect(mockPlayer.setVolume).toHaveBeenCalledWith(70);
  });

  it('attachYTPlayer with muted state calls mute on player', () => {
    const { result } = renderHook(() => useAudioController());
    const mockPlayer = {
      setVolume: vi.fn(),
      mute: vi.fn(),
      unMute: vi.fn(),
    } as unknown as YT.Player;

    act(() => result.current.toggleMute());
    act(() => result.current.attachYTPlayer(mockPlayer));

    expect(mockPlayer.mute).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm test -- useAudioController.test.ts
```

Expected: 6 passing tests.

---

### Task 20: Test reset state completeness

**Files:**
- Create: `src/services/discogsSync.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect } from 'vitest';
import { diffSync } from './discogsSync';
import { Track } from '@/types/track';

function makeTrack(releaseId: string, source: 'collection' | 'wantlist' = 'collection'): Track {
  return {
    id: `${source}-${releaseId}-A1`,
    source,
    title: 'Test',
    artist: 'Artist',
    album: 'Album',
    year: 2020,
    genre: 'Rock',
    label: 'Label',
    duration: 240,
    coverUrl: '/placeholder.svg',
    coverUrls: [],
    youtubeId: '',
    workingStatus: 'pending',
    discogsReleaseId: releaseId,
    discogsTrackPosition: 'A1',
  };
}

describe('diffSync', () => {
  it('returns all remote tracks as added when local is empty', () => {
    const remote = [makeTrack('1'), makeTrack('2')];
    const { added, unchanged } = diffSync(remote, []);
    expect(added).toHaveLength(2);
    expect(unchanged).toBe(0);
  });

  it('returns only new tracks not already in local', () => {
    const remote = [makeTrack('1'), makeTrack('2'), makeTrack('3')];
    const local = [makeTrack('1'), makeTrack('2')];
    const { added, unchanged } = diffSync(remote, local);
    expect(added).toHaveLength(1);
    expect(added[0].discogsReleaseId).toBe('3');
    expect(unchanged).toBe(2);
  });

  it('returns empty added when all remote tracks already exist locally', () => {
    const tracks = [makeTrack('1'), makeTrack('2')];
    const { added, unchanged } = diffSync(tracks, tracks);
    expect(added).toHaveLength(0);
    expect(unchanged).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm test -- discogsSync.test.ts
```

Expected: 3 passing tests.

---

### Task 21: Test `useNowPlayingData`

**Files:**
- Create: `src/hooks/useNowPlayingData.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNowPlayingData } from './useNowPlayingData';

const { supabase } = await vi.importMock('@/integrations/supabase/client');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useNowPlayingData', () => {
  it('returns loading state then data', async () => {
    const releaseData = { id: 123, title: 'Test Album', artists: [{ name: 'Artist' }], year: 2020, country: 'US', genres: ['Rock'], styles: ['Indie'], labels: [{ name: 'Label', catno: 'LAB001' }], formats: [{ name: 'Vinyl', descriptions: ['LP'], qty: '1' }], uri: '/release/123' };
    const marketData = { lowest_price: { value: 5.99, currency: 'USD' }, num_for_sale: 10, blocked_from_sale: false };

    supabase.functions.invoke
      .mockResolvedValueOnce({ data: releaseData, error: null })
      .mockResolvedValueOnce({ data: marketData, error: null });

    const { result } = renderHook(() => useNowPlayingData('123'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.releaseDetail?.title).toBe('Test Album');
    expect(result.current.marketplaceStats?.num_for_sale).toBe(10);
    expect(result.current.error).toBeNull();
  });

  it('returns null data when releaseId is undefined', () => {
    const { result } = renderHook(() => useNowPlayingData(undefined));
    expect(result.current.releaseDetail).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('sets error when fetch fails', async () => {
    supabase.functions.invoke.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useNowPlayingData('456'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm test -- useNowPlayingData.test.ts
```

Expected: 3 passing tests.

---

### Task 22: Replace `confirm()` with `AlertDialog` in `SettingsDialog`

**Files:**
- Modify: `src/components/SettingsDialog.tsx`

- [ ] **Step 1: Add AlertDialog import**

```ts
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
```

- [ ] **Step 2: Remove the `useState` import if not already there, or add `useState` to the existing import**

```ts
import { useRef, useState } from 'react';
```

- [ ] **Step 3: Replace the entire `handleClear` function and the "Clear All Data" button**

Remove:
```ts
  const handleClear = () => {
    if (confirm('Are you sure you want to clear all local data (CSV, cache)? This cannot be undone.')) {
      onOpenChange?.(false);
      onClearData();
      toast.success('All data cleared.');
    }
  };
```

Replace the `Button variant="destructive"` at the bottom of the dialog with:

```tsx
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="w-full gap-2 text-xs h-8">
                <RefreshCw className="w-3 h-3" /> Clear All Data & Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes your CSV collection, wantlist, and all cached data. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onOpenChange?.(false);
                    onClearData();
                    toast.success('All data cleared.');
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
```

---

### Task 23: Update CSP and security hardening

**Files:**
- Modify: `vercel.json`
- Modify: `src/lib/csvParser.ts`

- [ ] **Step 1: Audit `src/lib/csvParser.ts` for URL validation**

Read the file and check for any usage of URL fields (cover art URLs from CSV). Add a validator:

```bash
grep -n "coverUrl\|cover\|http" src/lib/csvParser.ts
```

If any raw URL is used without validation, wrap it with:
```ts
function isSafeUrl(url: string): boolean {
  return url.startsWith('https://');
}
```
and guard: `coverUrl: isSafeUrl(rawUrl) ? rawUrl : '/placeholder.svg'`

- [ ] **Step 2: Update `vercel.json` CSP `connect-src` to also allow Invidious API calls**

The current `connect-src` only allows Supabase. Direct Invidious calls from `useDirectAudio` would be blocked. Check if the app makes direct calls to Invidious from the client (not via edge functions).

```bash
grep -r "invidious\|inv\." src/hooks/useDirectAudio.ts src/hooks/useYouTubeSearch.ts
```

If direct client calls exist, add the Invidious domains. If all Invidious calls go through Supabase edge functions, the CSP is already correct — no change needed.

- [ ] **Step 3: Verify no `dangerouslySetInnerHTML` usage anywhere**

```bash
grep -r "dangerouslySetInnerHTML\|innerHTML" src/ --include="*.tsx" --include="*.ts"
```

Expected: no output (already safe).

---

### Task 24: Performance audit

**Files:**
- Modify: `src/components/MobilePlayer.tsx`
- Modify: `src/hooks/useCoverArtScraper.ts`

- [ ] **Step 1: Add a `loadedReleaseIds` ref to guard duplicate `batchLoadCoverArtFromDb` calls**

In `MobilePlayer.tsx`, add:
```ts
  const loadedCoverReleaseIdsRef = useRef<Set<string>>(new Set());
```

Then update the cover art effect to skip already-loaded releases:

```ts
  useEffect(() => {
    if (discogsTracks.length > prevDiscogsCountRef.current && discogsTracks.length > 0) {
      prevDiscogsCountRef.current = discogsTracks.length;

      const unloaded = discogsTracks.filter(
        t => t.discogsReleaseId && !loadedCoverReleaseIdsRef.current.has(t.discogsReleaseId)
      );
      if (unloaded.length === 0) return;

      unloaded.forEach(t => {
        if (t.discogsReleaseId) loadedCoverReleaseIdsRef.current.add(t.discogsReleaseId);
      });

      batchLoadCoverArtFromDb(unloaded, updateDiscogsTrack).then(dbLoadCount => {
        if (dbLoadCount > 0) {
          toast.success(`Loaded ${dbLoadCount} cover arts from cache`);
        }
        scrapeCoverArt(unloaded, updateDiscogsTrack, true);
      });
    }
  }, [discogsTracks.length, batchLoadCoverArtFromDb, scrapeCoverArt, updateDiscogsTrack]);
```

- [ ] **Step 2: Also clear `loadedCoverReleaseIdsRef` in the reset handler**

Add to the `onClearData` block:
```ts
              loadedCoverReleaseIdsRef.current.clear();
```

- [ ] **Step 3: Verify `applyTrackPatch` isn't triggering `upsertTracks` on every single patch (there's a 500ms debounce — confirm it's working by checking `syncTimerRef` logic)**

Read the `syncTimerRef` effect in `MobilePlayer.tsx`. It triggers on `discogsTracks` which changes on every `applyTrackPatch`. The 500ms debounce is correct — each patch resets the timer. No change needed.

---

### Task 25: Run all tests and fix any failures

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected output: all tests pass, no failures.

- [ ] **Step 2: If any test fails, read the error message, identify the cause, and fix the affected file**

Common failure modes:
- Mock not set up: add the mock to `src/test/setup.ts`
- Type mismatch: check interface definitions match between hook and test
- Import path wrong: ensure `@/` alias resolves (configured in `vitest.config.ts`)

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: 0 errors.

---

### Task 26: Commit Sub-project D

- [ ] **Step 1: Run final build**

```bash
npm run build
```

Expected: successful build, no TypeScript errors.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAudioController.test.ts \
        src/services/discogsSync.test.ts \
        src/hooks/useNowPlayingData.test.ts \
        src/components/SettingsDialog.tsx \
        src/components/MobilePlayer.tsx \
        vercel.json \
        src/lib/csvParser.ts
git commit -m "test: audio controller, sync diff, now playing data; security: AlertDialog, CSP; perf: dedup cover art loads"
```

---

## Self-Review Checklist (completed by plan author)

- [x] **Spec coverage:** useAudioController ✓, keyboard shortcuts ✓, release skip ✓, reset bug ✓, console.log cleanup ✓, NowPlayingPanel ✓, useNowPlayingData ✓, discogs-public marketplace ✓, discogsSync service ✓, useDiscogsSync hook ✓, discogs-api full-pagination ✓, tests ✓, AlertDialog ✓, CSP/security ✓, perf ✓
- [x] **No placeholders:** every step has complete code
- [x] **Type consistency:** `AudioController` interface defined in Task 1 and referenced consistently; `SyncCredentials` matches `DiscogsCredentials` (same shape, used appropriately); `Track` type from `@/types/track` used throughout
- [x] **Ambiguity resolved:** `skipNextRelease` with no next release returns early (no wrap-around); volume +5/-5 clamped in `setVolume`; marketplace data falls back gracefully when blocked
