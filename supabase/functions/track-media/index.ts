import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Provider = 'youtube' | 'bandcamp';

interface UpsertItem {
  discogs_username: string;
  discogs_release_id: number;
  track_position: string;
  provider: Provider;
  youtube_id?: string | null;
  bandcamp_embed_src?: string | null;
  bandcamp_url?: string | null;
  track_title?: string | null;
  artist?: string | null;
  album?: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body?.action as string | undefined;

    if (action === 'get') {
      const discogs_username = String(body?.discogs_username || '').trim();
      const discogs_release_id = Number(body?.discogs_release_id);
      if (!discogs_username || !Number.isFinite(discogs_release_id)) {
        return new Response(JSON.stringify({ error: 'discogs_username and discogs_release_id are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('track_media_links')
        .select('provider,youtube_id,bandcamp_embed_src,bandcamp_url,track_position')
        .eq('discogs_username', discogs_username)
        .eq('discogs_release_id', discogs_release_id);

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
      const items = (body?.items || []) as UpsertItem[];
      if (!Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ error: 'items are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Basic validation/sanitization.
      const rows = items.map((i) => ({
        discogs_username: String(i.discogs_username || '').trim(),
        discogs_release_id: Number(i.discogs_release_id),
        track_position: String(i.track_position || '').trim(),
        provider: i.provider,
        youtube_id: i.youtube_id ?? null,
        bandcamp_embed_src: i.bandcamp_embed_src ?? null,
        bandcamp_url: i.bandcamp_url ?? null,
        track_title: i.track_title ?? null,
        artist: i.artist ?? null,
        album: i.album ?? null,
        updated_at: new Date().toISOString(),
      }));

      if (rows.some((r) => !r.discogs_username || !Number.isFinite(r.discogs_release_id) || !r.track_position)) {
        return new Response(JSON.stringify({ error: 'invalid_items' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase
        .from('track_media_links')
        .upsert(rows, { onConflict: 'discogs_username,discogs_release_id,track_position,provider' });

      if (error) {
        return new Response(JSON.stringify({ error: 'db_error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'invalid_action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('track-media error:', error);
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

