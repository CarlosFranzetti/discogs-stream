import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Track } from '@/types/track';

const CSV_OWNER_KEY_STORAGE = 'discogs_stream_owner_key';

export type WorkingStatus = 'working' | 'non_working' | 'pending';

export interface TrackCacheRow {
  owner_key: string;
  source: 'collection' | 'wantlist' | 'similar';
  track_id: string;
  release_id: number | null;
  track_position: string | null;
  artist: string;
  title: string;
  album: string | null;
  genre: string | null;
  label: string | null;
  year: number | null;
  country: string | null;
  cover1: string | null;
  cover2: string | null;
  cover3: string | null;
  cover4: string | null;
  youtube1: string | null;
  youtube2: string | null;
  working_status: WorkingStatus;
}

function getOrCreateCsvOwnerKey(): string {
  const stored = localStorage.getItem(CSV_OWNER_KEY_STORAGE);
  if (stored) return stored;
  const key = `csv-${crypto.randomUUID()}`;
  localStorage.setItem(CSV_OWNER_KEY_STORAGE, key);
  return key;
}

export function resolveOwnerKey(discogsUsername?: string): string {
  if (discogsUsername && discogsUsername.trim()) {
    return discogsUsername.trim();
  }
  return getOrCreateCsvOwnerKey();
}

function getTrackCovers(track: Track): string[] {
  const base = Array.isArray(track.coverUrls) ? track.coverUrls : [];
  const withPrimary = track.coverUrl && !base.includes(track.coverUrl) ? [track.coverUrl, ...base] : base;
  return withPrimary.filter(Boolean).slice(0, 4);
}

function getTrackVideos(track: Track): string[] {
  const base = Array.isArray(track.youtubeCandidates) ? track.youtubeCandidates : [];
  const withPrimary = track.youtubeId && !base.includes(track.youtubeId) ? [track.youtubeId, ...base] : base;
  return withPrimary.filter(Boolean).slice(0, 2);
}

function inferWorkingStatus(track: Track): WorkingStatus {
  if (track.workingStatus) return track.workingStatus;
  return track.youtubeId ? 'working' : 'pending';
}

export function useTrackCache() {
  const upsertTracks = useCallback(async (ownerKey: string, tracks: Track[]) => {
    if (!ownerKey || tracks.length === 0) return;

    const items = tracks.map((track) => {
      const covers = getTrackCovers(track);
      const videos = getTrackVideos(track);
      return {
        owner_key: ownerKey,
        source: track.source,
        track_id: track.id,
        release_id: track.discogsReleaseId ?? null,
        track_position: track.discogsTrackPosition ?? null,
        artist: track.artist,
        title: track.title,
        album: track.album,
        genre: track.genre,
        label: track.label,
        year: track.year || null,
        country: track.country ?? null,
        cover1: covers[0] || null,
        cover2: covers[1] || null,
        cover3: covers[2] || null,
        cover4: covers[3] || null,
        youtube1: videos[0] || null,
        youtube2: videos[1] || null,
        working_status: inferWorkingStatus(track),
      };
    });

    await supabase.functions.invoke('track-cache', {
      body: {
        action: 'upsert',
        items,
      },
    });
  }, []);

  const loadTracks = useCallback(async (ownerKey: string, source?: Track['source']): Promise<TrackCacheRow[]> => {
    if (!ownerKey) return [];

    const { data, error } = await supabase.functions.invoke('track-cache', {
      body: {
        action: 'get',
        owner_key: ownerKey,
        source,
      },
    });

    if (error) return [];
    return (data?.rows || []) as TrackCacheRow[];
  }, []);

  const applyCachedMetadata = useCallback((tracks: Track[], rows: TrackCacheRow[]): Track[] => {
    if (!tracks.length || !rows.length) return tracks;

    const byTrackId = new Map(rows.map((row) => [row.track_id, row]));

    return tracks.map((track) => {
      const row = byTrackId.get(track.id);
      if (!row) return track;

      const coverUrls = [row.cover1, row.cover2, row.cover3, row.cover4].filter(Boolean) as string[];
      const youtubeCandidates = [row.youtube1, row.youtube2].filter(Boolean) as string[];

      return {
        ...track,
        country: track.country || row.country || undefined,
        coverUrl: track.coverUrl && track.coverUrl !== '/placeholder.svg' ? track.coverUrl : coverUrls[0] || track.coverUrl,
        coverUrls: coverUrls.length > 0 ? coverUrls : track.coverUrls,
        youtubeId: track.youtubeId || row.youtube1 || '',
        youtubeCandidates: youtubeCandidates.length > 0 ? youtubeCandidates : track.youtubeCandidates,
        workingStatus: row.working_status || track.workingStatus,
      };
    });
  }, []);

  return {
    upsertTracks,
    loadTracks,
    applyCachedMetadata,
  };
}
