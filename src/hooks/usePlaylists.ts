import { useState, useEffect, useCallback } from 'react';
import { ExtensionPlaylist } from '@/types/extension';
import { Track } from '@/types/track';
import { dbGetAll, dbSet, dbDelete } from '@/lib/db';

function newId() {
  return `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<ExtensionPlaylist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dbGetAll<ExtensionPlaylist>('playlists').then(all => {
      setPlaylists(all.sort((a, b) => b.updatedAt - a.updatedAt));
      setLoading(false);
    });
  }, []);

  const createPlaylist = useCallback(async (name: string): Promise<ExtensionPlaylist> => {
    const pl: ExtensionPlaylist = {
      id: newId(),
      name,
      tracks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await dbSet('playlists', pl);
    setPlaylists(prev => [pl, ...prev]);
    return pl;
  }, []);

  const renamePlaylist = useCallback(async (id: string, name: string) => {
    setPlaylists(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, name, updatedAt: Date.now() } : p);
      const pl = updated.find(p => p.id === id);
      if (pl) dbSet('playlists', pl);
      return updated;
    });
  }, []);

  const deletePlaylist = useCallback(async (id: string) => {
    await dbDelete('playlists', id);
    setPlaylists(prev => prev.filter(p => p.id !== id));
  }, []);

  const addTrackToPlaylist = useCallback(async (playlistId: string, track: Track) => {
    setPlaylists(prev => {
      const updated = prev.map(p => {
        if (p.id !== playlistId) return p;
        const already = p.tracks.some(t => t.id === track.id);
        if (already) return p;
        const updatedPl = { ...p, tracks: [...p.tracks, track], updatedAt: Date.now() };
        dbSet('playlists', updatedPl);
        return updatedPl;
      });
      return updated;
    });
  }, []);

  const removeTrackFromPlaylist = useCallback(async (playlistId: string, trackId: string) => {
    setPlaylists(prev => {
      const updated = prev.map(p => {
        if (p.id !== playlistId) return p;
        const updatedPl = { ...p, tracks: p.tracks.filter(t => t.id !== trackId), updatedAt: Date.now() };
        dbSet('playlists', updatedPl);
        return updatedPl;
      });
      return updated;
    });
  }, []);

  const reorderPlaylist = useCallback(async (playlistId: string, tracks: Track[]) => {
    setPlaylists(prev => {
      const updated = prev.map(p => {
        if (p.id !== playlistId) return p;
        const updatedPl = { ...p, tracks, updatedAt: Date.now() };
        dbSet('playlists', updatedPl);
        return updatedPl;
      });
      return updated;
    });
  }, []);

  const removeDuplicates = useCallback(async (playlistId: string) => {
    setPlaylists(prev => {
      const updated = prev.map(p => {
        if (p.id !== playlistId) return p;
        const seen = new Set<string>();
        const deduped = p.tracks.filter(t => {
          const key = `${t.artist}-${t.title}`.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const updatedPl = { ...p, tracks: deduped, updatedAt: Date.now() };
        dbSet('playlists', updatedPl);
        return updatedPl;
      });
      return updated;
    });
  }, []);

  return {
    playlists,
    loading,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    reorderPlaylist,
    removeDuplicates,
  };
}
