import { useState, useCallback } from 'react';
import { MarketplaceStats } from '@/types/extension';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function callDiscogsProxy(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/discogs-api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  if (!res.ok) throw new Error(`Discogs API error: ${res.status}`);
  return res.json();
}

async function callDiscogsPublic(path: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/discogs-public`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`Discogs public API error: ${res.status}`);
  return res.json();
}

export function useMarketplace() {
  const [statsCache] = useState(new Map<number, MarketplaceStats>());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMarketplaceStats = useCallback(async (releaseId: number): Promise<MarketplaceStats | null> => {
    if (statsCache.has(releaseId)) return statsCache.get(releaseId)!;

    try {
      const data = await callDiscogsPublic(`/marketplace/stats/${releaseId}`);
      const stats: MarketplaceStats = {
        releaseId,
        numForSale: data.num_for_sale || 0,
        lowestPrice: data.lowest_price?.value || null,
        currency: data.lowest_price?.currency || 'USD',
        blockingBuyLink: `https://www.discogs.com/sell/release/${releaseId}`,
      };
      statsCache.set(releaseId, stats);
      return stats;
    } catch (e) {
      console.error('Failed to get marketplace stats', e);
      return null;
    }
  }, [statsCache]);

  const getBulkStats = useCallback(async (releaseIds: number[]): Promise<Map<number, MarketplaceStats>> => {
    setLoading(true);
    setError(null);
    const result = new Map<number, MarketplaceStats>();

    const toFetch = releaseIds.filter(id => !statsCache.has(id));
    const cached = releaseIds.filter(id => statsCache.has(id));
    cached.forEach(id => result.set(id, statsCache.get(id)!));

    await Promise.allSettled(
      toFetch.map(async id => {
        const stats = await getMarketplaceStats(id);
        if (stats) result.set(id, stats);
      })
    );

    setLoading(false);
    return result;
  }, [getMarketplaceStats, statsCache]);

  const openMarketplacePage = useCallback((releaseId: number) => {
    const url = `https://www.discogs.com/sell/release/${releaseId}`;
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'OPEN_URL', url });
    } else {
      window.open(url, '_blank');
    }
  }, []);

  const openDiscogsListing = useCallback((listingId: number) => {
    const url = `https://www.discogs.com/sell/item/${listingId}`;
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'OPEN_URL', url });
    } else {
      window.open(url, '_blank');
    }
  }, []);

  const searchSimilar = useCallback(async (params: {
    genre?: string;
    style?: string;
    year?: number;
    label?: string;
    artist?: string;
    page?: number;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const query = [
        params.artist && `artist:"${params.artist}"`,
        params.label && `label:"${params.label}"`,
      ].filter(Boolean).join(' ');

      const searchParams: Record<string, unknown> = {
        type: 'release',
        per_page: 20,
        page: params.page || 1,
      };
      if (query) searchParams.q = query;
      if (params.genre) searchParams.genre = params.genre;
      if (params.style) searchParams.style = params.style;
      if (params.year) searchParams.year = params.year;

      const data = await callDiscogsPublic(`/database/search?${new URLSearchParams(
        Object.entries(searchParams).map(([k, v]) => [k, String(v)])
      )}`);

      return (data.results || []).map((r: Record<string, unknown>) => ({
        id: r.id,
        title: r.title,
        artist: (r.title as string)?.split(' - ')[0] || '',
        year: r.year || 0,
        coverUrl: r.cover_image || r.thumb || '',
        label: Array.isArray(r.label) ? r.label[0] : r.label || '',
        genre: Array.isArray(r.genre) ? r.genre[0] : r.genre || '',
        style: Array.isArray(r.style) ? r.style[0] : r.style || '',
        country: r.country || '',
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Search failed';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getMarketplaceStats,
    getBulkStats,
    openMarketplacePage,
    openDiscogsListing,
    searchSimilar,
  };
}
