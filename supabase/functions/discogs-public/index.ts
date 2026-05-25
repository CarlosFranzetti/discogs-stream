import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DISCOGS_CONSUMER_KEY = Deno.env.get('DISCOGS_CONSUMER_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const { release_id } = await req.json();

    if (!release_id) {
      throw new Error('release_id is required');
    }

    // 24h cache lookup — avoids hitting Discogs (60 req/min auth limit) for
    // releases already fetched recently by any user.
    const cacheKey = `discogs-public:release:${release_id}`;
    const { data: cached } = await supabase
      .from('search_cache')
      .select('results')
      .eq('query', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (cached?.results) {
      return new Response(JSON.stringify(cached.results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Fetching public Discogs release: ${release_id}`);

    // Fetch release data from Discogs public API
    const response = await fetch(
      `https://api.discogs.com/releases/${release_id}?key=${DISCOGS_CONSUMER_KEY}`,
      {
        headers: {
          'User-Agent': 'DiscogsRadio/1.0',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(JSON.stringify({ error: 'Release not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Discogs API error: ${await response.text()}`);
    }

    const data = await response.json();

    // Return full release data (cover art + tracklist + videos)
    const result = {
      id: data.id,
      title: data.title,
      thumb: data.thumb,
      cover_image: data.images?.[0]?.uri || data.thumb,
      images: data.images?.map((img: { uri?: string; resource_url?: string; type?: string }) => ({
        uri: img.uri || img.resource_url || '',
        type: img.type,
      })),
      artists: data.artists?.map((a: { name: string }) => ({ name: a.name })),
      year: data.year,
      country: data.country,
      genres: data.genres,
      styles: data.styles,
      labels: data.labels?.map((l: { name: string }) => ({ name: l.name })),
      tracklist: data.tracklist?.map((t: { position?: string; title?: string; duration?: string; type_?: string; artists?: Array<{ name: string }> }) => ({
        position: t.position,
        title: t.title,
        duration: t.duration,
        type_: t.type_,
        artists: t.artists?.map((a: { name: string }) => ({ name: a.name })),
      })),
      videos: data.videos?.map((v: { uri?: string; url?: string; title?: string }) => ({
        uri: v.uri || v.url || '',
        title: v.title,
      })),
    };

    // Persist to 24h cache for the next caller.
    await supabase.from('search_cache').insert({
      query: cacheKey,
      results: result,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Discogs public API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
