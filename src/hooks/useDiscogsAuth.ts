import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DiscogsCredentials {
  access_token: string;
  access_token_secret: string;
  username: string;
}

const STORAGE_KEY = 'discogs_credentials';

export function useDiscogsAuth() {
  const [credentials, setCredentials] = useState<DiscogsCredentials | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored credentials', e);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!credentials;

  const startAuth = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);
    
    try {
      const callbackUrl = `${window.location.origin}/?discogs_callback=true`;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discogs-auth?action=request_token&callback_url=${encodeURIComponent(callbackUrl)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to start OAuth flow');
      }

      const tokenData = await response.json();
      
      if (!tokenData.authorize_url) {
        throw new Error('No authorization URL received');
      }
      
      // Store the token secret for later
      sessionStorage.setItem('discogs_oauth_token_secret', tokenData.oauth_token_secret);
      
      // Redirect to Discogs authorization - use assign for better compatibility
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
      if (!tokenSecret) {
        throw new Error('Missing OAuth token secret');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discogs-auth?action=access_token&oauth_token=${oauthToken}&oauth_token_secret=${encodeURIComponent(tokenSecret)}&oauth_verifier=${oauthVerifier}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get access token');
      }

      const accessData = await response.json();
      
      // Get user identity
      const identityResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discogs-api`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'identity',
            access_token: accessData.access_token,
            access_token_secret: accessData.access_token_secret,
          }),
        }
      );

      if (!identityResponse.ok) {
        throw new Error('Failed to get user identity');
      }

      const identity = await identityResponse.json();
      
      const newCredentials: DiscogsCredentials = {
        access_token: accessData.access_token,
        access_token_secret: accessData.access_token_secret,
        username: identity.username,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCredentials));
      setCredentials(newCredentials);
      sessionStorage.removeItem('discogs_oauth_token_secret');
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      console.error('Callback error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCredentials(null);
  }, []);

  // Check for OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('oauth_token');
    const oauthVerifier = params.get('oauth_verifier');
    const tokenSecret = sessionStorage.getItem('discogs_oauth_token_secret');

    // If we have oauth_token, oauth_verifier AND a stored token secret, this is a callback
    if (oauthToken && oauthVerifier && tokenSecret) {
      console.log('Discogs OAuth callback detected, processing...');
      handleCallback(oauthToken, oauthVerifier);
    }
  }, [handleCallback]);

  return {
    credentials,
    isAuthenticated,
    isAuthenticating,
    error,
    startAuth,
    logout,
  };
}
