import { renderHook, act } from '@testing-library/react';
import { useYouTubeSearch } from './useYouTubeSearch';
import { supabase } from '@/integrations/supabase/client';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Track } from '@/types/track';

describe('useYouTubeSearch', () => {
  const mockTrack: Track = {
    id: '1',
    artist: 'Artist',
    title: 'Title',
    album: 'Album',
    year: 2021,
    genre: 'Rock',
    label: 'Label',
    duration: 180,
    coverUrl: '',
    youtubeId: '',
    source: 'collection',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const { result } = renderHook(() => useYouTubeSearch());
    act(() => {
      result.current.clearCache();
    });
  });

  it('should search for a video if not in cache', async () => {
    const mockResponse = { data: { videos: [{ videoId: 'mock-id', title: 'Mock Title', channelTitle: 'Mock Channel', thumbnail: 'mock-thumb' }] }, error: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.functions.invoke).mockResolvedValue(mockResponse as any);

    const { result } = renderHook(() => useYouTubeSearch());

    let videoId;
    await act(async () => {
      videoId = await result.current.searchForVideo(mockTrack);
    });

    expect(videoId).toBe('mock-id');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('youtube-search', expect.objectContaining({
      body: expect.objectContaining({
        artist: 'Artist',
        title: 'Title',
      }),
    }));
  });

  it('should return empty string if search fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: { message: 'Error' } } as any);

    const { result } = renderHook(() => useYouTubeSearch());

    let videoId;
    await act(async () => {
      videoId = await result.current.searchForVideo(mockTrack);
    });

    expect(videoId).toBe('');
  });

  it('should throttle requests', async () => {
    const mockResponse = { data: { videos: [{ videoId: 'mock-id' }] }, error: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.functions.invoke).mockResolvedValue(mockResponse as any);

    const { result } = renderHook(() => useYouTubeSearch());

    const startTime = Date.now();
    await act(async () => {
      await Promise.all([
        result.current.searchForVideo({ ...mockTrack, id: '1', title: 'Title 1' }),
        result.current.searchForVideo({ ...mockTrack, id: '2', title: 'Title 2' }),
      ]);
    });
    const endTime = Date.now();

    // Since we have a 500ms throttle, the second request should have been delayed
    expect(endTime - startTime).toBeGreaterThanOrEqual(500);
  });
});
