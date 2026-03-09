import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DISCOGS_CONSUMER_KEY = Deno.env.get('DISCOGS_CONSUMER_KEY')!;

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
