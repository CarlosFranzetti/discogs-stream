import { useState, useEffect, useCallback } from 'react';
import { Crate, DiscogsRelease } from '@/types/extension';
import { dbGetAll, dbSet, dbDelete } from '@/lib/db';

function newId() {
  return `crate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useCrates() {
  const [crates, setCrates] = useState<Crate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dbGetAll<Crate>('crates').then(all => {
      setCrates(all.sort((a, b) => b.updatedAt - a.updatedAt));
      setLoading(false);
    });
  }, []);

  const createCrate = useCallback(async (name: string, color?: string): Promise<Crate> => {
    const crate: Crate = {
      id: newId(),
      name,
      releases: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      color,
    };
    await dbSet('crates', crate);
    setCrates(prev => [crate, ...prev]);
    return crate;
  }, []);

  const renameCrate = useCallback(async (id: string, name: string) => {
    setCrates(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, name, updatedAt: Date.now() } : c);
      const crate = updated.find(c => c.id === id);
      if (crate) dbSet('crates', crate);
      return updated;
    });
  }, []);

  const deleteCrate = useCallback(async (id: string) => {
    await dbDelete('crates', id);
    setCrates(prev => prev.filter(c => c.id !== id));
  }, []);

  const addReleaseToCrate = useCallback(async (crateId: string, release: DiscogsRelease) => {
    setCrates(prev => {
      const updated = prev.map(c => {
        if (c.id !== crateId) return c;
        const already = c.releases.some(r => r.id === release.id);
        if (already) return c;
        const updatedCrate = { ...c, releases: [...c.releases, release], updatedAt: Date.now() };
        dbSet('crates', updatedCrate);
        return updatedCrate;
      });
      return updated;
    });
  }, []);

  const removeReleaseFromCrate = useCallback(async (crateId: string, releaseId: number) => {
    setCrates(prev => {
      const updated = prev.map(c => {
        if (c.id !== crateId) return c;
        const updatedCrate = { ...c, releases: c.releases.filter(r => r.id !== releaseId), updatedAt: Date.now() };
        dbSet('crates', updatedCrate);
        return updatedCrate;
      });
      return updated;
    });
  }, []);

  const removeDuplicatesFromCrate = useCallback(async (crateId: string) => {
    setCrates(prev => {
      const updated = prev.map(c => {
        if (c.id !== crateId) return c;
        const seen = new Set<number>();
        const deduped = c.releases.filter(r => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });
        const updatedCrate = { ...c, releases: deduped, updatedAt: Date.now() };
        dbSet('crates', updatedCrate);
        return updatedCrate;
      });
      return updated;
    });
  }, []);

  const isInCrate = useCallback((crateId: string, releaseId: number): boolean => {
    const crate = crates.find(c => c.id === crateId);
    return crate?.releases.some(r => r.id === releaseId) ?? false;
  }, [crates]);

  return {
    crates,
    loading,
    createCrate,
    renameCrate,
    deleteCrate,
    addReleaseToCrate,
    removeReleaseFromCrate,
    removeDuplicatesFromCrate,
    isInCrate,
  };
}
