import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DirectAudioResult {
  audioUrl: string;
  source: 'invidious' | 'piped' | 'yt-dlp' | null;
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
      // Both extractors are asked at once. On Supabase's hosted runtime
      // yt-dlp-audio answers 501 immediately (no subprocesses), so running
      // them one after the other only added a round trip before the function
      // that can actually succeed. Whichever returns a stream first wins.
      const ask = async (fn: 'yt-dlp-audio' | 'invidious-audio'): Promise<DirectAudioResult> => {
        const { data } = await supabase.functions.invoke(fn, { body: { videoId: youtubeId } });
        if (!data?.success || !data?.audioUrl) throw new Error(`${fn}: no stream`);
        return {
          audioUrl: data.audioUrl,
          // invidious-audio reports which network served it ('invidious' | 'piped')
          source: fn === 'yt-dlp-audio' ? 'yt-dlp' : data.source === 'piped' ? 'piped' : 'invidious',
          title: data.title,
          author: data.author,
        };
      };

      const result = await Promise.any([ask('yt-dlp-audio'), ask('invidious-audio')]).catch(() => null);
      if (!result) setError('Could not extract direct audio URL');
      setIsLoading(false);
      return result;

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
