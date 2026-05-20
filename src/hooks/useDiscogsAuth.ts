import { useState, useCallback, useEffect } from 'react';

/**
 * Phase 3 (Discogs OAuth Diff-Sync):
 *   - Discogs access tokens NEVER live in localStorage. They are persisted
 *     server-side in the `user_tokens` table and accessed only via the
 *     `discogs-auth` / `discogs-api` edge functions.
 *   - The client stores only the Discogs `username` and an opaque HMAC-signed
 *     `session` token. The session token authenticates subsequent API calls.
 */

export interface DiscogsSession {
  username: string;
  session: string;
}

const SESSION_KEY = 'discogs_session_v2';
const LEGACY_CREDS_KEY = 'discogs_credentials';

function readSession(): DiscogsSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.username === 'string' && typeof parsed.session === 'string') {
      return parsed as DiscogsSession;
    }
    return null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function writeSession(session: DiscogsSession | null) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function useDiscogsAuth() {
  const [session, setSession] = useState<DiscogsSession | null>(() => {
    if (typeof window !== 'undefined') {
      // One-shot wipe of legacy localStorage that previously held raw OAuth tokens.
      localStorage.removeItem(LEGACY_CREDS_KEY);
    }
    return readSession();
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!session;

  const startAuth = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const callbackUrl = `${window.location.origin}/?discogs_callback=true`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discogs-auth?action=request_token&callback_url=${encodeURIComponent(callbackUrl)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) throw new Error('Failed to start OAuth flow');
      const tokenData = await response.json();
      if (!tokenData.authorize_url) throw new Error('No authorization URL received');

      sessionStorage.setItem('discogs_oauth_token_secret', tokenData.oauth_token_secret);
      window.location.assign(tokenData.authorize_url);
    } catch (err) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsAuthenticating(false);
    }
  }, []);

  const handleCallback = useCallback(async (oauthToken: string, oauthVerifier: string) => {
    setIsAuthenticating(true);
    setError(null);

    try {
      const tokenSecret = sessionStorage.getItem('discogs_oauth_token_secret');
      if (!tokenSecret) throw new Error('Missing OAuth token secret');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discogs-auth?action=access_token&oauth_token=${oauthToken}&oauth_token_secret=${encodeURIComponent(tokenSecret)}&oauth_verifier=${oauthVerifier}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to complete OAuth');
      }

      const result = await response.json();
      if (!result?.username || !result?.session) {
        throw new Error('Invalid OAuth response — missing username or session');
      }

      const newSession: DiscogsSession = {
        username: result.username,
        session: result.session,
      };
      writeSession(newSession);
      setSession(newSession);
      sessionStorage.removeItem('discogs_oauth_token_secret');

      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      console.error('Callback error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const current = session;
    writeSession(null);
    setSession(null);
    if (current) {
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discogs-auth?action=logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session: current.session }),
        });
      } catch {
        // Best-effort; client state already cleared.
      }
    }
  }, [session]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('oauth_token');
    const oauthVerifier = params.get('oauth_verifier');
    const tokenSecret = sessionStorage.getItem('discogs_oauth_token_secret');
    if (oauthToken && oauthVerifier && tokenSecret) {
      handleCallback(oauthToken, oauthVerifier);
    }
  }, [handleCallback]);

  // Backwards-compat alias used by existing callers.
  const credentials = session
    ? { username: session.username, session: session.session }
    : null;

  return {
    session,
    credentials,
    isAuthenticated,
    isAuthenticating,
    error,
    startAuth,
    logout,
  };
}
