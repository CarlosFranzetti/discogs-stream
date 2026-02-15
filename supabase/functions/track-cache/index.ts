import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface TrackCacheItem {
  owner_key: string;
  source: 'collection' | 'wantlist' | 'similar';
  track_id: string;
  release_id?: number | null;
  track_position?: string | null;
  artist: string;
  title: string;
  album?: string | null;
  genre?: string | null;
  label?: string | null;
  year?: number | null;
  country?: string | null;
  cover1?: string | null;
  cover2?: string | null;
  cover3?: string | null;
  cover4?: string | null;
  youtube1?: string | null;
  youtube2?: string | null;
  working_status?: 'working' | 'non_working' | 'pending';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = String(body?.action || '').trim();

    if (action === 'get') {
      const ownerKey = String(body?.owner_key || '').trim();
      const source = body?.source ? String(body.source).trim() : null;

      if (!ownerKey) {
        return new Response(JSON.stringify({ error: 'owner_key is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let query = supabase
        .from('discogs_track_cache')
        .select('owner_key,source,track_id,release_id,track_position,artist,title,album,genre,label,year,country,cover1,cover2,cover3,cover4,youtube1,youtube2,working_status,updated_at')
        .eq('owner_key', ownerKey)
        .order('updated_at', { ascending: false });

      if (source) {
        query = query.eq('source', source);
      }

      const { data, error } = await query;
      if (error) {
        return new Response(JSON.stringify({ error: 'db_error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ rows: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'upsert') {
      const items = (body?.items || []) as TrackCacheItem[];
      if (!Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ error: 'items are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rows = items.map((item) => ({
        owner_key: String(item.owner_key || '').trim(),
        source: item.source,
        track_id: String(item.track_id || '').trim(),
        release_id: Number.isFinite(Number(item.release_id)) ? Number(item.release_id) : null,
        track_position: item.track_position ?? null,
        artist: String(item.artist || '').trim(),
        title: String(item.title || '').trim(),
        album: item.album ?? null,
        genre: item.genre ?? null,
        label: item.label ?? null,
        year: Number.isFinite(Number(item.year)) ? Number(item.year) : null,
        country: item.country ?? null,
        cover1: item.cover1 ?? null,
        cover2: item.cover2 ?? null,
        cover3: item.cover3 ?? null,
        cover4: item.cover4 ?? null,
        youtube1: item.youtube1 ?? null,
        youtube2: item.youtube2 ?? null,
        working_status: item.working_status || 'pending',
        updated_at: new Date().toISOString(),
      }));

      if (rows.some((r) => !r.owner_key || !r.track_id || !r.artist || !r.title || !r.source)) {
        return new Response(JSON.stringify({ error: 'invalid_items' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase
        .from('discogs_track_cache')
        .upsert(rows, { onConflict: 'owner_key,track_id' });

      if (error) {
        return new Response(JSON.stringify({ error: 'db_error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true, count: rows.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'invalid_action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('track-cache error:', error);
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
