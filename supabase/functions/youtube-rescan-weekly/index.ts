/**
 * Phase 3 — Weekly YouTube link-health rescan (D-11..D-14).
 *
 * Walks `discogs_track_cache`, re-runs the `youtube-search` chain for each row,
 * updates youtube1 / youtube2 if a new candidate scores higher, and flips
 * working_status between 'working' <-> 'non_working' based on outcome. Logs the
 * pass into `rescan_log`.
 *
 * Pacing:
 *   - 100 rows per minute target (rate-limit safe per D-12).
 *   - Wait 600ms between calls -> ~100 req/min after youtube-search internal
 *     latency.
 *
 * Scheduling:
 *   - Configure a pg_cron / Supabase scheduled-function entry to POST `{}` to
 *     this endpoint at `0 4 * * 0` (Sundays 04:00 UTC, just after the daily
 *     YouTube quota reset).
 *   - Can also be triggered manually by POSTing `{ "limit": N }`.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const RESCAN_BATCH = 100; // rows per pass per username
const PACE_MS = 600;       // between youtube-search calls

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface CacheRow {
  owner_key: string;
  track_id: string;
  artist: string;
  title: string;
  youtube1: string | null;
  youtube2: string | null;
  working_status: 'working' | 'non_working' | 'pending';
}

async function callYoutubeSearch(artist: string, title: string): Promise<string[]> {
  const url = `${SUPABASE_URL}/functions/v1/youtube-search`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      query: `${artist} ${title}`.trim(),
      artist,
      title,
      maxResults: 5,
      refresh: true,
    }),
  });
  if (!resp.ok) return [];
  try {
    const data = await resp.json();
    const videos = Array.isArray(data?.videos) ? data.videos : [];
    return videos.map((v: { videoId?: string }) => v?.videoId).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ranAt = new Date().toISOString();
  let body: { limit?: number; username?: string } = {};
  try { body = await req.json(); } catch { /* no body */ }

  const limit = Math.max(1, Math.min(Number(body.limit) || RESCAN_BATCH, 500));

  let tracksChecked = 0;
  let linksUpdated = 0;
  let flippedWorking = 0;
  let flippedNonWorking = 0;
  let errors = 0;

  try {
    // Fetch the oldest-updated rows (rotate through the cache over multiple passes).
    let query = supabase
      .from('discogs_track_cache')
      .select('owner_key,track_id,artist,title,youtube1,youtube2,working_status,updated_at')
      .order('updated_at', { ascending: true })
      .limit(limit);
    if (body.username) query = query.eq('owner_key', body.username);

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []) as CacheRow[];

    for (const row of rows) {
      tracksChecked++;
      try {
        const candidates = await callYoutubeSearch(row.artist, row.title);
        const top = candidates[0] || null;
        const second = candidates[1] || null;

        const beforeWorking = row.working_status === 'working';
        const willBeWorking = !!top;

        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        let changed = false;

        if (top && top !== row.youtube1) {
          updates.youtube1 = top;
          changed = true;
        }
        if (second && second !== row.youtube2) {
          updates.youtube2 = second;
          changed = true;
        }
        if (beforeWorking && !willBeWorking) {
          updates.working_status = 'non_working';
          flippedNonWorking++;
          changed = true;
        } else if (!beforeWorking && willBeWorking) {
          updates.working_status = 'working';
          flippedWorking++;
          changed = true;
        }

        if (changed) {
          linksUpdated++;
          await supabase
            .from('discogs_track_cache')
            .update(updates)
            .eq('owner_key', row.owner_key)
            .eq('track_id', row.track_id);
        }
      } catch (e) {
        errors++;
        console.error('rescan row error', row.track_id, e);
      }

      await sleep(PACE_MS);
    }

    // Update last_rescan_at for any usernames touched in this pass.
    const usernames = Array.from(new Set(rows.map((r) => r.owner_key)));
    if (usernames.length > 0) {
      await supabase
        .from('user_tokens')
        .update({ last_rescan_at: ranAt })
        .in('username', usernames);
    }

    await supabase.from('rescan_log').insert({
      ran_at: ranAt,
      tracks_checked: tracksChecked,
      links_updated: linksUpdated,
      status_flipped_working: flippedWorking,
      status_flipped_non_working: flippedNonWorking,
      errors,
    });

    return new Response(JSON.stringify({
      ok: true,
      tracksChecked,
      linksUpdated,
      flippedWorking,
      flippedNonWorking,
      errors,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    await supabase.from('rescan_log').insert({
      ran_at: ranAt,
      tracks_checked: tracksChecked,
      links_updated: linksUpdated,
      status_flipped_working: flippedWorking,
      status_flipped_non_working: flippedNonWorking,
      errors: errors + 1,
      note: msg,
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
