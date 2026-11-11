import { useCallback, useEffect, useState } from 'react';
import type { Track } from '@/types/track';

/**
 * User-made playlists — named, ordered sets of track ids drawn from the
 * loaded library.
 *
 * Storage: localStorage only. Playlists hold ids, not track copies, so a
 * 500-track playlist costs a few KB and can never go stale against the
 * library's metadata (covers, resolved YouTube ids, durations all keep
 * coming from the live track objects). Ids that no longer resolve — a
 * release removed from the collection — are skipped at read time rather
 * than pruned, so a track that comes back reappears in place.
 *
 * The shape is deliberately the one a `user_playlists` table would take
 * (id / name / track_ids / timestamps), so moving this to Supabase later is
 * a transport change, not a remodel. See memorystate C1.
 */

const STORAGE_KEY = 'discogs_stream_user_playlists_v1';

export interface UserPlaylist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
}

function readStored(): UserPlaylist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive: a hand-edited or partially-written blob shouldn't crash the
    // playlist panel on open.
    return parsed.filter(
      (p): p is UserPlaylist =>
        !!p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.trackIds)
    );
  } catch {
    return [];
  }
}

function writeStored(playlists: UserPlaylist[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  } catch {
    // Quota or private mode — playlists stay in memory for this session.
  }
}

export function useUserPlaylists() {
  const [playlists, setPlaylists] = useState<UserPlaylist[]>(() => readStored());

  useEffect(() => {
    writeStored(playlists);
  }, [playlists]);

  const createPlaylist = useCallback((name: string, trackIds: string[] = []): UserPlaylist => {
    const now = new Date().toISOString();
    const playlist: UserPlaylist = {
      id: `pl-${crypto.randomUUID()}`,
      name: name.trim() || 'Untitled playlist',
      trackIds: [...new Set(trackIds)],
      createdAt: now,
      updatedAt: now,
    };
    setPlaylists((prev) => [playlist, ...prev]);
    return playlist;
  }, []);

  const renamePlaylist = useCallback((id: string, name: string) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: new Date().toISOString() } : p
      )
    );
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
  }, []);

  /** Appends; adding a track already in the playlist is a no-op, not a duplicate. */
  const addTrackToPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId && !p.trackIds.includes(trackId)
          ? { ...p, trackIds: [...p.trackIds, trackId], updatedAt: new Date().toISOString() }
          : p
      )
    );
  }, []);

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId
          ? { ...p, trackIds: p.trackIds.filter((t) => t !== trackId), updatedAt: new Date().toISOString() }
          : p
      )
    );
  }, []);

  /** Adds many at once (e.g. "save these filter results as a playlist"). */
  const addTracksToPlaylist = useCallback((playlistId: string, trackIds: string[]) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId
          ? {
              ...p,
              trackIds: [...p.trackIds, ...trackIds.filter((id) => !p.trackIds.includes(id))],
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  }, []);

  /**
   * Resolves a playlist to real Track objects, in the playlist's own order.
   * Ids with no matching track are skipped (removed from the library, not
   * yet loaded) rather than rendered as blanks.
   */
  const resolvePlaylist = useCallback((playlist: UserPlaylist, library: Track[]): Track[] => {
    const byId = new Map(library.map((t) => [t.id, t]));
    return playlist.trackIds.map((id) => byId.get(id)).filter((t): t is Track => !!t);
  }, []);

  return {
    playlists,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    addTracksToPlaylist,
    removeTrackFromPlaylist,
    resolvePlaylist,
  };
}
