import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DISCOGS_CONSUMER_KEY = Deno.env.get('DISCOGS_CONSUMER_KEY')!;
const DISCOGS_CONSUMER_SECRET = Deno.env.get('DISCOGS_CONSUMER_SECRET')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    console.log(`Discogs auth action: ${action}`);

    if (action === 'request_token') {
      const callbackUrl = url.searchParams.get('callback_url') || '';
      
      // Step 1: Get request token from Discogs
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
        const errorText = await response.text();
        console.error('Discogs request token error:', errorText);
        throw new Error(`Failed to get request token: ${errorText}`);
      }

      const responseText = await response.text();
      const params = new URLSearchParams(responseText);
      
      const oauth_token = params.get('oauth_token');
      const oauth_token_secret = params.get('oauth_token_secret');

      console.log('Got request token successfully');

      return new Response(JSON.stringify({
        oauth_token,
        oauth_token_secret,
        authorize_url: `https://discogs.com/oauth/authorize?oauth_token=${oauth_token}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'access_token') {
      const oauth_token = url.searchParams.get('oauth_token') || '';
      const oauth_token_secret = url.searchParams.get('oauth_token_secret') || '';
      const oauth_verifier = url.searchParams.get('oauth_verifier') || '';

      // Step 3: Exchange for access token
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
        const errorText = await response.text();
        console.error('Discogs access token error:', errorText);
        throw new Error(`Failed to get access token: ${errorText}`);
      }

      const responseText = await response.text();
      const params = new URLSearchParams(responseText);

      const access_token = params.get('oauth_token');
      const access_token_secret = params.get('oauth_token_secret');

      console.log('Got access token successfully');

      return new Response(JSON.stringify({
        access_token,
        access_token_secret,
      }), {
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
  
  if (token) {
    oauthParams.oauth_token = token;
  }

  // For PLAINTEXT signature method
  const signature = `${encodeURIComponent(DISCOGS_CONSUMER_SECRET)}&${encodeURIComponent(tokenSecret)}`;
  oauthParams.oauth_signature = signature;

  const headerParts = Object.entries(oauthParams)
    .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}
