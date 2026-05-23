import { useCallback, useEffect, useRef, useState } from 'react';
import { Track } from '@/types/track';
import { useTrackCache } from '@/hooks/useTrackCache';
import {
  runDiscogsSync,
  fetchSyncStatus,
  type SyncProgress,
  type SyncResult,
} from '@/services/discogsSync';

export interface UseDiscogsSyncArgs {
  username?: string | null;
  session?: string | null;
  ownerKey: string;
  /** Builds Track[] from a list of Discogs collection/wantlist release entries. */
  releasesToTracks: (raw: unknown[], source: 'collection' | 'wantlist') => Track[];
  /** Called once sync completes successfully with new tracks (so callers can merge). */
  onSyncResult?: (result: SyncResult) => void;
  /**
   * Cache state for this owner: 'loading' until the local DB cache has been read,
   * then 'empty' or 'has-data'. Auto-sync fires only once the cache is known to be
   * empty — so a returning user with cached tracks loads instantly and re-syncs
   * only on demand (manual "Re-sync now").
   */
  cacheStatus?: 'loading' | 'empty' | 'has-data';
}

export interface UseDiscogsSyncReturn {
  isSyncing: boolean;
  isRescanning: boolean;
  progress: SyncProgress | null;
  lastSyncAt: string | null;
  lastRescanAt: string | null;
  error: string | null;
  syncNow: () => Promise<void>;
  rescanNow: () => Promise<{ ok: boolean; tracksChecked?: number; linksUpdated?: number; error?: string }>;
  refreshStatus: () => Promise<void>;
}

export function useDiscogsSync(args: UseDiscogsSyncArgs): UseDiscogsSyncReturn {
  const { username, session, ownerKey, releasesToTracks, onSyncResult, cacheStatus = 'loading' } = args;
  const { upsertTracks, loadTracks } = useTrackCache();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastRescanAt, setLastRescanAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const autoSyncDoneRef = useRef<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!username || !session) return;
    const status = await fetchSyncStatus(username, session);
    setLastSyncAt(status.lastSyncAt);
    setLastRescanAt(status.lastRescanAt);
  }, [username, session]);

  const syncNow = useCallback(async () => {
    if (!username || !session || !ownerKey) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSyncing(true);
    setError(null);
    setProgress({ phase: 'starting', collected: 0 });

    const result = await runDiscogsSync(
      {
        ownerKey,
        username,
        session,
        releasesToTracks,
        upsertTracks,
        loadTracks,
      },
      (p) => setProgress(p)
    );

    inFlightRef.current = false;
    setIsSyncing(false);

    if (!result.ok) {
      setError(result.error || 'sync_failed');
    } else {
      onSyncResult?.(result);
      await refreshStatus();
    }
  }, [username, session, ownerKey, releasesToTracks, upsertTracks, loadTracks, onSyncResult, refreshStatus]);

  // Manual trigger of the weekly YouTube rescan — re-checks every cached track's
  // links and updates youtube1/youtube2 + working_status (D-11..D-14). Limited to
  // 200 rows per manual run so the user doesn't wait minutes; the scheduled cron
  // does the full sweep.
  const rescanNow = useCallback(async () => {
    if (!username || !session || !ownerKey) {
      return { ok: false, error: 'not_authenticated' };
    }
    if (isRescanning) return { ok: false, error: 'in_flight' };
    setIsRescanning(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-rescan-weekly`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ownerKey, limit: 200 }),
      });
      const data = await resp.json().catch(() => ({}));
      await refreshStatus();
      if (!resp.ok || !data?.ok) {
        return { ok: false, error: data?.error || `http_${resp.status}` };
      }
      return {
        ok: true,
        tracksChecked: data.tracksChecked,
        linksUpdated: data.linksUpdated,
      };
    } finally {
      setIsRescanning(false);
    }
  }, [username, session, ownerKey, isRescanning, refreshStatus]);

  // Fetch last-sync timestamps whenever username changes.
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Auto-sync once per username, but ONLY when the local cache is empty (D-07).
  // A returning user with cached tracks loads instantly from the DB and re-syncs
  // only via the manual "Re-sync now" button — no full re-download every visit.
  useEffect(() => {
    if (!username || !session || !ownerKey) return;
    if (cacheStatus === 'loading') return;          // wait until cache is known
    if (cacheStatus === 'has-data') return;         // cache hit — skip auto-sync
    if (autoSyncDoneRef.current === username) return;
    autoSyncDoneRef.current = username;
    syncNow();
  }, [username, session, ownerKey, cacheStatus, syncNow]);

  return {
    isSyncing,
    isRescanning,
    progress,
    lastSyncAt,
    lastRescanAt,
    error,
    syncNow,
    rescanNow,
    refreshStatus,
  };
}
