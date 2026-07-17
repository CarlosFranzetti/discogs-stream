import { useCallback, useEffect, useRef, useState } from 'react';
import { useMarketplace } from './useMarketplace';
import type { MarketplaceStats } from '@/types/extension';

/**
 * The marketplace stats shape returned by {@link useWantlistPrices}.
 * Re-exported here so UI code can depend on this hook without also importing
 * from `@/types/extension`.
 */
export type { MarketplaceStats };

/** Minimum gap between outbound marketplace-stats requests (ms). */
const REQUEST_INTERVAL_MS = 1000;

/**
 * Batches Discogs marketplace price lookups for a list of releases (e.g. the
 * releases visible in a playlist / wantlist view) in a way that is safe to call
 * repeatedly from render-driven UI.
 *
 * Behavior:
 * - `requestPrices(ids)` enqueues the given release IDs. Already-fetched and
 *   already-queued IDs are deduped, so it can be called on every render / scroll
 *   without re-fetching.
 * - The queue is drained one request at a time with a ~1 request/second throttle
 *   (see {@link REQUEST_INTERVAL_MS}) to respect Discogs rate limits. Underlying
 *   fetches go through `useMarketplace().getMarketplaceStats`, which also caches.
 * - Resolved prices are stored in a ref-backed map and a version counter is
 *   bumped so consuming components re-render and re-read via `getPriceForRelease`.
 * - `getPriceForRelease(id)` returns the cached {@link MarketplaceStats} or
 *   `null` if not yet resolved (or unavailable).
 *
 * @example
 * const { getPriceForRelease, requestPrices } = useWantlistPrices();
 * useEffect(() => { requestPrices(visibleReleaseIds); }, [visibleReleaseIds]);
 * const stats = getPriceForRelease(release.id); // MarketplaceStats | null
 */
export function useWantlistPrices(): {
  /** Returns the resolved marketplace stats for a release, or null if not (yet) available. */
  getPriceForRelease: (releaseId: number) => MarketplaceStats | null;
  /** Enqueue release IDs for throttled, deduped price resolution. Safe to call from UI. */
  requestPrices: (releaseIds: number[]) => void;
} {
  const { getMarketplaceStats } = useMarketplace();

  // Resolved prices (ref so identity is stable; state bump drives re-render).
  const priceMap = useRef<Map<number, MarketplaceStats>>(new Map());
  // IDs we've already queued or fetched — prevents duplicate work.
  const requested = useRef<Set<number>>(new Set());
  const queue = useRef<number[]>([]);
  const draining = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const [, setVersion] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const drain = useCallback(() => {
    if (draining.current) return;
    const next = queue.current.shift();
    if (next === undefined) return;

    draining.current = true;
    getMarketplaceStats(next)
      .then((stats) => {
        if (!mounted.current) return;
        if (stats) {
          priceMap.current.set(next, stats);
          setVersion((v) => v + 1);
        }
      })
      .catch(() => {
        /* getMarketplaceStats already logs; a failed lookup just stays unresolved */
      })
      .finally(() => {
        draining.current = false;
        if (!mounted.current) return;
        if (queue.current.length > 0) {
          timer.current = setTimeout(drain, REQUEST_INTERVAL_MS);
        }
      });
  }, [getMarketplaceStats]);

  const requestPrices = useCallback((releaseIds: number[]) => {
    let added = false;
    for (const id of releaseIds) {
      if (!Number.isFinite(id) || requested.current.has(id)) continue;
      requested.current.add(id);
      queue.current.push(id);
      added = true;
    }
    if (added && !draining.current) drain();
  }, [drain]);

  const getPriceForRelease = useCallback(
    (releaseId: number): MarketplaceStats | null =>
      priceMap.current.get(releaseId) ?? null,
    [],
  );

  return { getPriceForRelease, requestPrices };
}
