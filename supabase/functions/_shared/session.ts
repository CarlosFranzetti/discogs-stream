// Shared HMAC session verifier for Discogs Stream edge functions.
// Imported by discogs-api, youtube-rescan-weekly, etc.

const SESSION_SECRET =
  Deno.env.get('SESSION_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64url(bytes: Uint8Array): string {
  const s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

export interface SessionClaims {
  username: string;
}

export async function verifySession(session: string | null | undefined): Promise<SessionClaims | null> {
  if (!session) return null;
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
