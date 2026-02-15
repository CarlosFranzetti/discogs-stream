import { useState, useCallback, useMemo } from 'react';
import { Track } from '@/types/track';
import { parseDiscogsCSV } from '@/lib/csvParser';

const STORAGE_KEY_COLLECTION = 'csv_collection';
const STORAGE_KEY_WANTLIST = 'csv_wantlist';

export function useCSVCollection() {
  const [collection, setCollection] = useState<Track[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_COLLECTION);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored collection', e);
      localStorage.removeItem(STORAGE_KEY_COLLECTION);
      return [];
    }
  });

  const [wantlist, setWantlist] = useState<Track[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_WANTLIST);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored wantlist', e);
      localStorage.removeItem(STORAGE_KEY_WANTLIST);
      return [];
    }
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadCollectionCSV = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const content = await file.text();
      const tracks = parseDiscogsCSV(content, 'collection');

      localStorage.setItem(STORAGE_KEY_COLLECTION, JSON.stringify(tracks));
      setCollection(tracks);

      return tracks;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse CSV file';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadWantlistCSV = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const content = await file.text();
      const tracks = parseDiscogsCSV(content, 'wantlist');

      localStorage.setItem(STORAGE_KEY_WANTLIST, JSON.stringify(tracks));
      setWantlist(tracks);

      return tracks;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse CSV file';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCollection = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_COLLECTION);
    setCollection([]);
  }, []);

  const clearWantlist = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_WANTLIST);
    setWantlist([]);
  }, []);

  const clearAll = useCallback(() => {
    clearCollection();
    clearWantlist();
  }, [clearCollection, clearWantlist]);

  const updateTrack = useCallback((updatedTrack: Track) => {
    // Update in collection if exists
    setCollection(prev => {
      const idx = prev.findIndex(t => t.id === updatedTrack.id);
      if (idx === -1) return prev;
      const newCollection = [...prev];
      newCollection[idx] = updatedTrack;
      localStorage.setItem(STORAGE_KEY_COLLECTION, JSON.stringify(newCollection));
      return newCollection;
    });

    // Update in wantlist if exists
    setWantlist(prev => {
      const idx = prev.findIndex(t => t.id === updatedTrack.id);
      if (idx === -1) return prev;
      const newWantlist = [...prev];
      newWantlist[idx] = updatedTrack;
      localStorage.setItem(STORAGE_KEY_WANTLIST, JSON.stringify(newWantlist));
      return newWantlist;
    });
  }, []);

  const hasCSVData = collection.length > 0 || wantlist.length > 0;

  const allTracks = useMemo(() => [...collection, ...wantlist], [collection, wantlist]);

  return {
    collection,
    wantlist,
    allTracks,
    hasCSVData,
    isLoading,
    error,
    loadCollectionCSV,
    loadWantlistCSV,
    clearCollection,
    clearWantlist,
    clearAll,
    updateTrack,
  };
}
