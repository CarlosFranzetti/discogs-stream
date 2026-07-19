import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DirectAudioResult {
  audioUrl: string;
  source: 'invidious' | 'yt-dlp' | null;
  title?: string;
  author?: string;
}

export function useDirectAudio() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDirectAudioUrl = useCallback(async (youtubeId: string): Promise<DirectAudioResult | null> => {
    if (!youtubeId) {
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ytdlpResponse = await supabase.functions.invoke('yt-dlp-audio', {
        body: { videoId: youtubeId },
      });

      if (ytdlpResponse.data?.success && ytdlpResponse.data?.audioUrl) {
        setIsLoading(false);
        return {
          audioUrl: ytdlpResponse.data.audioUrl,
          source: 'yt-dlp',
          title: ytdlpResponse.data.title,
        };
      }

      const invidiousResponse = await supabase.functions.invoke('invidious-audio', {
        body: { videoId: youtubeId },
      });

      if (invidiousResponse.data?.success && invidiousResponse.data?.audioUrl) {
        setIsLoading(false);
        return {
          audioUrl: invidiousResponse.data.audioUrl,
          source: 'invidious',
          title: invidiousResponse.data.title,
          author: invidiousResponse.data.author,
        };
      }

      setError('Could not extract direct audio URL');
      setIsLoading(false);
      return null;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
      return null;
    }
  }, []);

  return {
    getDirectAudioUrl,
    isLoading,
    error,
  };
}
