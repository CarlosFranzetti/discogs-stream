import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DISCOGS_CONSUMER_KEY = Deno.env.get('DISCOGS_CONSUMER_KEY')!;
const DISCOGS_CONSUMER_SECRET = Deno.env.get('DISCOGS_CONSUMER_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SESSION_SECRET = Deno.env.get('SESSION_SECRET') || SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------- Session token (HMAC-signed, opaque to client) ----------
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  const s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return b64url(new Uint8Array(sig));
}

export async function mintSession(username: string, ttlSeconds = 60 * 60 * 24 * 90): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({
    u: username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  })));
  const sig = await hmacSign(payload);
  return `${payload}.${sig}`;
}

// ---------- Routes ----------
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'request_token') {
      const callbackUrl = url.searchParams.get('callback_url') || '';
      const requestTokenUrl = 'https://api.discogs.com/oauth/request_token';
      const oauthHeader = generateOAuthHeader('POST', requestTokenUrl, {}, '', '');

      const response = await fetch(requestTokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': oauthHeader,
          'User-Agent': 'DiscogsRadio/1.0',
        },
        body: `oauth_callback=${encodeURIComponent(callbackUrl)}`,
      });

      if (!response.ok) {
        throw new Error(`Failed to get request token: ${await response.text()}`);
      }

      const params = new URLSearchParams(await response.text());
      const oauth_token = params.get('oauth_token');
      const oauth_token_secret = params.get('oauth_token_secret');

      return new Response(JSON.stringify({
        oauth_token,
        oauth_token_secret,
        authorize_url: `https://discogs.com/oauth/authorize?oauth_token=${oauth_token}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'access_token') {
      // Exchange verifier for access token, fetch identity, persist tokens, mint session.
      const oauth_token = url.searchParams.get('oauth_token') || '';
      const oauth_token_secret = url.searchParams.get('oauth_token_secret') || '';
      const oauth_verifier = url.searchParams.get('oauth_verifier') || '';

      const accessTokenUrl = 'https://api.discogs.com/oauth/access_token';
      const oauthHeader = generateOAuthHeader('POST', accessTokenUrl, { oauth_verifier }, oauth_token, oauth_token_secret);

      const response = await fetch(accessTokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': oauthHeader,
          'User-Agent': 'DiscogsRadio/1.0',
        },
        body: `oauth_verifier=${encodeURIComponent(oauth_verifier)}`,
      });

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${await response.text()}`);
      }

      const params = new URLSearchParams(await response.text());
      const access_token = params.get('oauth_token') || '';
      const access_token_secret = params.get('oauth_token_secret') || '';

      // Fetch identity to get the canonical username.
      const idHeader = generateOAuthHeader('GET', 'https://api.discogs.com/oauth/identity', {}, access_token, access_token_secret);
      const idResp = await fetch('https://api.discogs.com/oauth/identity', {
        headers: { 'Authorization': idHeader, 'User-Agent': 'DiscogsRadio/1.0' },
      });
      if (!idResp.ok) {
        throw new Error(`Failed to fetch identity: ${await idResp.text()}`);
      }
      const identity = await idResp.json();
      const username: string = identity.username;
      if (!username) throw new Error('No username from Discogs identity');

      // Persist tokens server-side (D-01, D-04).
      const { error: dbErr } = await supabase
        .from('user_tokens')
        .upsert({
          username,
          discogs_token: access_token,
          discogs_secret: access_token_secret,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'username' });
      if (dbErr) {
        console.error('user_tokens upsert error:', dbErr);
        throw new Error('Failed to persist tokens');
      }

      const session = await mintSession(username);

      return new Response(JSON.stringify({
        username,
        session,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'logout') {
      // Client-side session token is opaque; nothing server-side to revoke unless we
      // also wipe stored tokens. The body may carry a session for username extraction.
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      const session = String(body?.session || '');
      if (session) {
        const verified = await verifySession(session);
        if (verified) {
          await supabase.from('user_tokens').delete().eq('username', verified.username);
        }
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Discogs auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function verifySession(session: string): Promise<{ username: string } | null> {
  const parts = session.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = await hmacSign(payload);
  if (expected !== sig) return null;
  try {
    const decoded = JSON.parse(dec.decode(b64urlDecode(payload)));
    if (typeof decoded?.u !== 'string') return null;
    if (typeof decoded?.exp === 'number' && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return { username: decoded.u };
  } catch {
    return null;
  }
}

function generateOAuthHeader(
  method: string,
  url: string,
  extraParams: Record<string, string> = {},
  token: string = '',
  tokenSecret: string = ''
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replace(/-/g, '');

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: DISCOGS_CONSUMER_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'PLAINTEXT',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
    ...extraParams,
  };
  if (token) oauthParams.oauth_token = token;

  const signature = `${encodeURIComponent(DISCOGS_CONSUMER_SECRET)}&${encodeURIComponent(tokenSecret)}`;
  oauthParams.oauth_signature = signature;

  const headerParts = Object.entries(oauthParams)
    .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}
