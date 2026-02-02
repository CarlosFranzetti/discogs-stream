import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DISCOGS_CONSUMER_KEY = Deno.env.get('DISCOGS_CONSUMER_KEY')!;
const DISCOGS_CONSUMER_SECRET = Deno.env.get('DISCOGS_CONSUMER_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, access_token, access_token_secret, username, params } = await req.json();
    
    console.log(`Discogs API action: ${action}, username: ${username}`);

    const oauthHeader = generateOAuthHeader(access_token, access_token_secret);

    // Caching logic for read-only actions
    const cacheableActions = ['collection', 'wantlist', 'orders', 'release'];
    let cacheKey = '';
    if (cacheableActions.includes(action)) {
      cacheKey = `discogs:${username || 'anon'}:${action}:${JSON.stringify(params || {})}`;
      
      const { data: cachedData } = await supabase
        .from('search_cache')
        .select('results')
        .eq('query', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (cachedData) {
        console.log(`Discogs cache hit: ${cacheKey}`);
        return new Response(JSON.stringify(cachedData.results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'identity') {
      const response = await fetch('https://api.discogs.com/oauth/identity', {
        headers: {
          'Authorization': oauthHeader,
          'User-Agent': 'DiscogsRadio/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get identity: ${await response.text()}`);
      }

      const data = await response.json();
      console.log('Identity response:', data);
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'collection') {
      const page = params?.page || 1;
      const perPage = params?.per_page || 50;
      
      const response = await fetch(
        `https://api.discogs.com/users/${username}/collection/folders/0/releases?page=${page}&per_page=${perPage}`,
        {
          headers: {
            'Authorization': oauthHeader,
            'User-Agent': 'DiscogsRadio/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get collection: ${await response.text()}`);
      }

      const data = await response.json();
      console.log(`Collection: ${data.releases?.length} releases on page ${page}`);
      
      // Store in cache
      await supabase.from('search_cache').insert({
        query: cacheKey,
        results: data,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      });

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'wantlist') {
      const page = params?.page || 1;
      const perPage = params?.per_page || 50;
      
      const response = await fetch(
        `https://api.discogs.com/users/${username}/wants?page=${page}&per_page=${perPage}`,
        {
          headers: {
            'Authorization': oauthHeader,
            'User-Agent': 'DiscogsRadio/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get wantlist: ${await response.text()}`);
      }

      const data = await response.json();
      console.log(`Wantlist: ${data.wants?.length} wants on page ${page}`);
      
      // Store in cache
      await supabase.from('search_cache').insert({
        query: cacheKey,
        results: data,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      });

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'orders') {
      const page = params?.page || 1;
      const perPage = params?.per_page || 50;
      
      const response = await fetch(
        `https://api.discogs.com/marketplace/orders?page=${page}&per_page=${perPage}&status=Shipped`,
        {
          headers: {
            'Authorization': oauthHeader,
            'User-Agent': 'DiscogsRadio/1.0',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Orders API error (may need seller account):', errorText);
        // Return empty if user doesn't have marketplace access
        return new Response(JSON.stringify({ orders: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      console.log(`Orders: ${data.orders?.length} orders on page ${page}`);
      
      // Store in cache
      await supabase.from('search_cache').insert({
        query: cacheKey,
        results: data,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      });

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'release') {
      const releaseId = params?.release_id;
      
      const response = await fetch(
        `https://api.discogs.com/releases/${releaseId}`,
        {
          headers: {
            'Authorization': oauthHeader,
            'User-Agent': 'DiscogsRadio/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get release: ${await response.text()}`);
      }

      const data = await response.json();
      console.log(`Release ${releaseId}: ${data.title}`);
      
      // Store in cache
      await supabase.from('search_cache').insert({
        query: cacheKey,
        results: data,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours for specific releases
      });

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'search_youtube') {
      // Search for YouTube video for a track
      const artist = params?.artist || '';
      const title = params?.title || '';
      const query = `${artist} ${title}`;
      
      // Use YouTube Data API or return a search URL
      // For now, we'll construct a search query that can be used client-side
      const searchQuery = encodeURIComponent(query);
      
      return new Response(JSON.stringify({
        search_query: query,
        youtube_search_url: `https://www.youtube.com/results?search_query=${searchQuery}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Discogs API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateOAuthHeader(token: string, tokenSecret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replace(/-/g, '');
  
  const signature = `${encodeURIComponent(DISCOGS_CONSUMER_SECRET)}&${encodeURIComponent(tokenSecret)}`;
  
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: DISCOGS_CONSUMER_KEY,
    oauth_nonce: nonce,
    oauth_signature: signature,
    oauth_signature_method: 'PLAINTEXT',
    oauth_timestamp: timestamp,
    oauth_token: token,
    oauth_version: '1.0',
  };

  const headerParts = Object.entries(oauthParams)
    .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}
