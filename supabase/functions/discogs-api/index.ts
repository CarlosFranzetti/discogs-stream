import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifySession } from "../_shared/session.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DISCOGS_CONSUMER_KEY = Deno.env.get('DISCOGS_CONSUMER_KEY')!;
const DISCOGS_CONSUMER_SECRET = Deno.env.get('DISCOGS_CONSUMER_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AuthContext {
  username: string;
  access_token: string;
  access_token_secret: string;
}

async function loadTokensByUsername(username: string): Promise<AuthContext | null> {
  const { data, error } = await supabase
    .from('user_tokens')
    .select('username, discogs_token, discogs_secret')
    .eq('username', username)
    .maybeSingle();
  if (error || !data) return null;
  return {
    username: data.username,
    access_token: data.discogs_token,
    access_token_secret: data.discogs_secret,
  };
}

async function resolveAuth(body: Record<string, unknown>): Promise<AuthContext | null> {
  // Prefer session-based auth (D-04 — tokens never leave server).
  const session = typeof body.session === 'string' ? body.session : null;
  if (session) {
    const claims = await verifySession(session);
    if (claims) {
      const ctx = await loadTokensByUsername(claims.username);
      if (ctx) return ctx;
    }
  }

  // Legacy fallback: explicit tokens in request body (kept for transition).
  const access_token = typeof body.access_token === 'string' ? body.access_token : '';
  const access_token_secret = typeof body.access_token_secret === 'string' ? body.access_token_secret : '';
  const username = typeof body.username === 'string' ? body.username : '';
  if (access_token && access_token_secret) {
    return { username, access_token, access_token_secret };
  }

  return null;
}

// Sleep helper for rate-limit backoff.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function discogsFetch(url: string, oauthHeader: string, attempt = 0): Promise<Response> {
  const resp = await fetch(url, {
    headers: { 'Authorization': oauthHeader, 'User-Agent': 'DiscogsRadio/1.0' },
  });
  if (resp.status === 429 && attempt < 4) {
    const retryAfter = Number(resp.headers.get('Retry-After')) || (2 ** attempt);
    await sleep(retryAfter * 1000);
    return discogsFetch(url, oauthHeader, attempt + 1);
  }
  return resp;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action: string = body?.action || '';
    const params = body?.params || {};

    // `identity` is the one action that may run before tokens are persisted
    // (called once during the OAuth callback to fetch the canonical username).
    if (action === 'identity') {
      const access_token = String(body.access_token || '');
      const access_token_secret = String(body.access_token_secret || '');
      if (!access_token || !access_token_secret) {
        return jsonErr('identity requires access_token + access_token_secret', 400);
      }
      const oauthHeader = generateOAuthHeader(access_token, access_token_secret);
      const response = await discogsFetch('https://api.discogs.com/oauth/identity', oauthHeader);
      if (!response.ok) throw new Error(`Failed to get identity: ${await response.text()}`);
      const data = await response.json();
      return json(data);
    }

    const auth = await resolveAuth(body);
    if (!auth) {
      return jsonErr('Unauthorized — session expired or invalid', 401);
    }
    const { username, access_token, access_token_secret } = auth;
    const oauthHeader = generateOAuthHeader(access_token, access_token_secret);

    // Caching for read-only single-page actions.
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
      if (cachedData) return json(cachedData.results);
    }

    if (action === 'whoami') {
      // Used by client after page refresh to confirm the session is still valid.
      return json({ username });
    }

    if (action === 'collection') {
      const page = params?.page || 1;
      const perPage = params?.per_page || 50;
      const url = `https://api.discogs.com/users/${username}/collection/folders/0/releases?page=${page}&per_page=${perPage}`;
      const response = await discogsFetch(url, oauthHeader);
      if (!response.ok) throw new Error(`Failed to get collection: ${await response.text()}`);
      const data = await response.json();
      await cacheInsert(cacheKey, data, 60 * 60 * 1000);
      return json(data);
    }

    if (action === 'wantlist') {
      const page = params?.page || 1;
      const perPage = params?.per_page || 50;
      const url = `https://api.discogs.com/users/${username}/wants?page=${page}&per_page=${perPage}`;
      const response = await discogsFetch(url, oauthHeader);
      if (!response.ok) throw new Error(`Failed to get wantlist: ${await response.text()}`);
      const data = await response.json();
      await cacheInsert(cacheKey, data, 60 * 60 * 1000);
      return json(data);
    }

    if (action === 'collection_full' || action === 'wantlist_full') {
      // Paginated full-fetch — returns the union of all pages.
      // Pace at ~50 req/min (Discogs OAuth limit is 60/min) — wait 1.2s between calls.
      const perPage = Math.min(Number(params?.per_page) || 100, 100);
      const releasesKey = action === 'collection_full' ? 'releases' : 'wants';
      const pathFragment = action === 'collection_full'
        ? `users/${username}/collection/folders/0/releases`
        : `users/${username}/wants`;

      const collected: unknown[] = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const url = `https://api.discogs.com/${pathFragment}?page=${page}&per_page=${perPage}`;
        const response = await discogsFetch(url, oauthHeader);
        if (!response.ok) throw new Error(`Failed page ${page}: ${await response.text()}`);
        const data = await response.json();
        totalPages = data?.pagination?.pages || 1;
        const items = data?.[releasesKey] || [];
        collected.push(...items);
        if (page >= totalPages) break;
        page += 1;
        await sleep(1200); // rate-limit-safe pacing (D-08, REQ-C7)
      }

      return json({ [releasesKey]: collected, pagination: { pages: totalPages, items: collected.length } });
    }

    if (action === 'orders') {
      const page = params?.page || 1;
      const perPage = params?.per_page || 50;
      const url = `https://api.discogs.com/marketplace/orders?page=${page}&per_page=${perPage}&status=Shipped`;
      const response = await discogsFetch(url, oauthHeader);
      if (!response.ok) return json({ orders: [] });
      const data = await response.json();
      await cacheInsert(cacheKey, data, 60 * 60 * 1000);
      return json(data);
    }

    if (action === 'release') {
      const releaseId = params?.release_id;
      const url = `https://api.discogs.com/releases/${releaseId}`;
      const response = await discogsFetch(url, oauthHeader);
      if (!response.ok) throw new Error(`Failed to get release: ${await response.text()}`);
      const data = await response.json();
      await cacheInsert(cacheKey, data, 24 * 60 * 60 * 1000);
      return json(data);
    }

    if (action === 'search_youtube') {
      const artist = params?.artist || '';
      const title = params?.title || '';
      const query = `${artist} ${title}`;
      return json({
        search_query: query,
        youtube_search_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      });
    }

    return jsonErr('Invalid action', 400);
  } catch (error) {
    console.error('Discogs API error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return jsonErr(msg, 500);
  }
});

async function cacheInsert(key: string, results: unknown, ttlMs: number) {
  if (!key) return;
  await supabase.from('search_cache').insert({
    query: key,
    results,
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function jsonErr(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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
