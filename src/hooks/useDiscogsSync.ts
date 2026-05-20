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
}

export interface UseDiscogsSyncReturn {
  isSyncing: boolean;
  progress: SyncProgress | null;
  lastSyncAt: string | null;
  lastRescanAt: string | null;
  error: string | null;
  syncNow: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export function useDiscogsSync(args: UseDiscogsSyncArgs): UseDiscogsSyncReturn {
  const { username, session, ownerKey, releasesToTracks, onSyncResult } = args;
  const { upsertTracks, loadTracks } = useTrackCache();

  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastRescanAt, setLastRescanAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const autoSyncDoneRef = useRef<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!username) return;
    const status = await fetchSyncStatus(username);
    setLastSyncAt(status.lastSyncAt);
    setLastRescanAt(status.lastRescanAt);
  }, [username]);

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

  // Fetch last-sync timestamps whenever username changes.
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Auto-sync once per username when both username + session are present (D-07).
  useEffect(() => {
    if (!username || !session || !ownerKey) return;
    if (autoSyncDoneRef.current === username) return;
    autoSyncDoneRef.current = username;
    syncNow();
  }, [username, session, ownerKey, syncNow]);

  return {
    isSyncing,
    progress,
    lastSyncAt,
    lastRescanAt,
    error,
    syncNow,
    refreshStatus,
  };
}
