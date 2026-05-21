/**
 * Phase 3 — Discogs OAuth Diff-Sync (REQ-C4 / D-05..D-08).
 *
 *   - Remote Discogs is the source of truth.
 *   - Releases the user has removed on Discogs are SOFT-deleted by flipping
 *     working_status='non_working' on their cached rows (D-05). Rows are never
 *     hard-deleted on sync.
 *   - Likes/dislikes (user_track_preferences) are read-only from sync's POV (D-06).
 *   - Pages are upserted incrementally — a mid-sync drop leaves valid state (D-08).
 */

import type { Track } from '@/types/track';
import type { TrackCacheRow } from '@/hooks/useTrackCache';

export interface DiscogsSyncDeps {
  ownerKey: string;
  session: string;
  username: string;
  /** Builds full Track[] from raw Discogs release entries (per source). */
  releasesToTracks: (raw: unknown[], source: 'collection' | 'wantlist') => Track[];
  /** Page-by-page upsert to discogs_track_cache. */
  upsertTracks: (ownerKey: string, tracks: Track[]) => Promise<void>;
  /** Load current cached rows for diff. */
  loadTracks: (ownerKey: string) => Promise<TrackCacheRow[]>;
}

export interface SyncProgress {
  phase: 'starting' | 'collection' | 'wantlist' | 'reconciling' | 'done' | 'error';
  collected: number;
  total?: number;
  message?: string;
}

export interface SyncResult {
  ok: boolean;
  upserted: number;
  softDeleted: number;
  error?: string;
}

async function callDiscogsApi(
  session: string,
  username: string,
  action: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discogs-api`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, session, username, params }),
  });
  if (!resp.ok) {
    let detail = '';
    try {
      const j = await resp.json();
      detail = j?.error || '';
    } catch {
      /* no-op */
    }
    throw new Error(`${action} failed (${resp.status}): ${detail || 'unknown'}`);
  }
  return resp.json();
}

/**
 * Runs a full diff sync. Returns counts. Idempotent — re-running just refreshes.
 */
export async function runDiscogsSync(
  deps: DiscogsSyncDeps,
  onProgress?: (p: SyncProgress) => void
): Promise<SyncResult> {
  const { ownerKey, session, username, releasesToTracks, upsertTracks, loadTracks } = deps;

  if (!ownerKey || !session || !username) {
    return { ok: false, upserted: 0, softDeleted: 0, error: 'missing_auth' };
  }

  let upserted = 0;
  let softDeleted = 0;

  onProgress?.({ phase: 'starting', collected: 0 });

  try {
    // ---- Pull cached state first (so we can diff for soft-delete) ----
    const existingRows = await loadTracks(ownerKey);
    const existingReleaseIds = new Set(
      existingRows.map((r) => r.release_id).filter((id): id is number => Number.isFinite(id))
    );

    // ---- Fetch full collection (isolated — a wantlist failure must not lose this) ----
    let collectionTracks: Track[] = [];
    let collectionOk = false;
    try {
      onProgress?.({ phase: 'collection', collected: 0 });
      const colData = (await callDiscogsApi(session, username, 'collection_full')) as {
        releases?: unknown[];
      };
      const collectionReleases = colData?.releases || [];
      collectionTracks = releasesToTracks(collectionReleases, 'collection');
      collectionOk = true;
      for (let i = 0; i < collectionTracks.length; i += 100) {
        const chunk = collectionTracks.slice(i, i + 100);
        await upsertTracks(ownerKey, chunk);
        upserted += chunk.length;
        onProgress?.({ phase: 'collection', collected: upserted });
      }
    } catch (e) {
      console.error('collection sync failed', e);
    }

    // ---- Fetch full wantlist (isolated) ----
    let wantlistTracks: Track[] = [];
    let wantlistOk = false;
    try {
      onProgress?.({ phase: 'wantlist', collected: upserted });
      const wantData = (await callDiscogsApi(session, username, 'wantlist_full')) as {
        wants?: unknown[];
      };
      const wantReleases = wantData?.wants || [];
      wantlistTracks = releasesToTracks(wantReleases, 'wantlist');
      wantlistOk = true;
      for (let i = 0; i < wantlistTracks.length; i += 100) {
        const chunk = wantlistTracks.slice(i, i + 100);
        await upsertTracks(ownerKey, chunk);
        upserted += chunk.length;
        onProgress?.({ phase: 'wantlist', collected: upserted });
      }
    } catch (e) {
      console.error('wantlist sync failed', e);
    }

    if (!collectionOk && !wantlistOk) {
      const message = 'Both collection and wantlist failed to fetch';
      onProgress?.({ phase: 'error', collected: upserted, message });
      return { ok: false, upserted, softDeleted, error: message };
    }

    // ---- Reconcile: soft-delete releases removed remotely ----
    onProgress?.({ phase: 'reconciling', collected: upserted });
    const remoteReleaseIds = new Set<number>();
    for (const t of collectionTracks) {
      if (typeof t.discogsReleaseId === 'number') remoteReleaseIds.add(t.discogsReleaseId);
    }
    for (const t of wantlistTracks) {
      if (typeof t.discogsReleaseId === 'number') remoteReleaseIds.add(t.discogsReleaseId);
    }

    // Only reconcile when BOTH lists fetched successfully — otherwise a failed or
    // partial fetch would soft-delete releases that are actually still present.
    const removed = (collectionOk && wantlistOk)
      ? Array.from(existingReleaseIds).filter((id) => !remoteReleaseIds.has(id))
      : [];
    if (removed.length > 0) {
      // Soft-delete via edge function — discogs_track_cache is RLS-locked to
      // service_role, so the browser cannot update it directly (D-05).
      const res = (await callDiscogsApi(session, username, 'soft_delete_releases', {
        release_ids: removed,
      })) as { softDeleted?: number };
      softDeleted = res?.softDeleted || 0;
    }

    // ---- Stamp last_sync_at (server-side; user_tokens is RLS-locked) ----
    await callDiscogsApi(session, username, 'stamp_sync');

    onProgress?.({ phase: 'done', collected: upserted });
    return { ok: true, upserted, softDeleted };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync_failed';
    onProgress?.({ phase: 'error', collected: upserted, message });
    return { ok: false, upserted, softDeleted, error: message };
  }
}

/**
 * Fetch the last sync + last rescan timestamps for display in Settings.
 * Reads via the discogs-api edge function because user_tokens is RLS-locked
 * to service_role (the browser cannot query it directly).
 */
export async function fetchSyncStatus(
  username: string,
  session: string
): Promise<{ lastSyncAt: string | null; lastRescanAt: string | null }> {
  if (!username || !session) return { lastSyncAt: null, lastRescanAt: null };
  try {
    const res = (await callDiscogsApi(session, username, 'sync_status')) as {
      lastSyncAt?: string | null;
      lastRescanAt?: string | null;
    };
    return {
      lastSyncAt: res?.lastSyncAt ?? null,
      lastRescanAt: res?.lastRescanAt ?? null,
    };
  } catch {
    return { lastSyncAt: null, lastRescanAt: null };
  }
}
