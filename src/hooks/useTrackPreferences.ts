import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Track } from '@/types/track';

interface TrackPreference {
  id: string;
  track_id: string;
  artist: string;
  title: string;
  album: string | null;
  cover_url: string | null;
  source: string | null;
  preference: 'liked' | 'disliked';
}

export function useTrackPreferences(userId: string | undefined) {
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [dislikedTracks, setDislikedTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load preferences from database
  const loadPreferences = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('track_preferences')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error loading preferences:', error);
        return;
      }

      const liked: Track[] = [];
      const disliked: Track[] = [];

      (data || []).forEach((pref) => {
        const track: Track = {
          id: pref.track_id,
          artist: pref.artist,
          title: pref.title,
          album: pref.album || '',
          coverUrl: pref.cover_url || '/placeholder.svg',
          source: (pref.source as Track['source']) || 'collection',
          year: 0,
          genre: '',
          label: '',
          duration: 240,
          youtubeId: '',
        };

        if (pref.preference === 'liked') {
          liked.push(track);
        } else {
          disliked.push(track);
        }
      });

      setLikedTracks(liked);
      setDislikedTracks(disliked);
    } catch (err) {
      console.error('Error loading preferences:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const savePreference = useCallback(
    async (track: Track, preference: 'liked' | 'disliked') => {
      if (!userId) return;

      try {
        const { error } = await supabase
          .from('track_preferences')
          .upsert(
            {
              user_id: userId,
              track_id: track.id,
              artist: track.artist,
              title: track.title,
              album: track.album,
              cover_url: track.coverUrl,
              source: track.source,
              preference,
            },
            { onConflict: 'user_id,track_id' }
          );

        if (error) {
          console.error('Error saving preference:', error);
        }
      } catch (err) {
        console.error('Error saving preference:', err);
      }
    },
    [userId]
  );

  const removePreference = useCallback(
    async (trackId: string) => {
      if (!userId) return;

      try {
        const { error } = await supabase
          .from('track_preferences')
          .delete()
          .eq('user_id', userId)
          .eq('track_id', trackId);

        if (error) {
          console.error('Error removing preference:', error);
        }
      } catch (err) {
        console.error('Error removing preference:', err);
      }
    },
    [userId]
  );

  const likeTrack = useCallback(
    async (track: Track) => {
      // Remove from disliked if present
      setDislikedTracks((prev) => prev.filter((t) => t.id !== track.id));

      // Toggle like
      if (likedTracks.some((t) => t.id === track.id)) {
        setLikedTracks((prev) => prev.filter((t) => t.id !== track.id));
        await removePreference(track.id);
      } else {
        setLikedTracks((prev) => [...prev, track]);
        await savePreference(track, 'liked');
      }
    },
    [likedTracks, savePreference, removePreference]
  );

  const dislikeTrack = useCallback(
    async (track: Track) => {
      // Remove from liked if present
      setLikedTracks((prev) => prev.filter((t) => t.id !== track.id));

      // Add to disliked
      if (!dislikedTracks.some((t) => t.id === track.id)) {
        setDislikedTracks((prev) => [...prev, track]);
        await savePreference(track, 'disliked');
      }
    },
    [dislikedTracks, savePreference]
  );

  const isLiked = useCallback(
    (trackId: string) => likedTracks.some((t) => t.id === trackId),
    [likedTracks]
  );

  const isDisliked = useCallback(
    (trackId: string) => dislikedTracks.some((t) => t.id === trackId),
    [dislikedTracks]
  );

  return {
    likedTracks,
    dislikedTracks,
    isLoading,
    likeTrack,
    dislikeTrack,
    isLiked,
    isDisliked,
    loadPreferences,
  };
}
