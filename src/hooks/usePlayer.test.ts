import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Track } from '@/types/track';
import { usePlayer } from './usePlayer';

function track(id: string, artist = `Artist ${id}`): Track {
  return {
    id, title: `Title ${id}`, artist, album: 'Album', year: 1990, genre: 'Techno', label: 'Label',
    duration: 240, coverUrl: '', youtubeId: `yt-${id}`, source: 'collection',
  };
}

// Library in an order that the artist sort would change (z, y, x … → a, b, c).
const library = ['z', 'y', 'x', 'w', 'v', 'u'].map((id) => track(id));
const byId = new Map(library.map((t) => [t.id, t]));
const pick = (...ids: string[]) => ids.map((id) => byId.get(id)!);
const ids = (tracks: Track[]) => tracks.map((t) => t.id);

interface Props { tracks: Track[]; key: string | null }

function setup(initial: Props = { tracks: library, key: null }) {
  return renderHook(
    ({ tracks, key }: Props) => usePlayer(tracks, undefined, { orderedContextKey: key }),
    { initialProps: initial },
  );
}

describe('usePlayer — ordered context (user playlists)', () => {
  it('plays a playlist in its own order, from the top, with shuffle off', () => {
    const hook = setup();
    expect(hook.result.current.isShuffle).toBe(true);

    hook.rerender({ tracks: pick('w', 'z', 'u'), key: 'pl-1' });

    expect(ids(hook.result.current.playlist)).toEqual(['w', 'z', 'u']);
    expect(hook.result.current.currentIndex).toBe(0);
    expect(hook.result.current.currentTrack.id).toBe('w');
    expect(hook.result.current.isShuffle).toBe(false);
  });

  it('starts on a requested track and autoplays', () => {
    const hook = setup();
    act(() => hook.result.current.requestContextStart('pl-1', { startTrackId: 'u' }));
    hook.rerender({ tracks: pick('w', 'z', 'u'), key: 'pl-1' });

    expect(ids(hook.result.current.playlist)).toEqual(['w', 'z', 'u']);
    expect(hook.result.current.currentTrack.id).toBe('u');
    expect(hook.result.current.isPlaying).toBe(true);
  });

  it('can start shuffled', () => {
    const hook = setup();
    act(() => hook.result.current.requestContextStart('pl-1', { shuffle: true }));
    hook.rerender({ tracks: pick('w', 'z', 'u', 'x', 'y'), key: 'pl-1' });

    expect(hook.result.current.isShuffle).toBe(true);
    expect(ids(hook.result.current.playlist).sort()).toEqual(['u', 'w', 'x', 'y', 'z']);
    expect(hook.result.current.currentIndex).toBe(0);
  });

  it('ignores a start request queued for a different playlist', () => {
    const hook = setup();
    act(() => hook.result.current.requestContextStart('pl-other', { startTrackId: 'u' }));
    hook.rerender({ tracks: pick('w', 'z', 'u'), key: 'pl-1' });
    expect(hook.result.current.currentTrack.id).toBe('w');
  });

  it('keeps the playing track when the playlist is reordered', () => {
    const hook = setup();
    act(() => hook.result.current.requestContextStart('pl-1', { startTrackId: 'z' }));
    hook.rerender({ tracks: pick('w', 'z', 'u'), key: 'pl-1' });
    expect(hook.result.current.currentTrack.id).toBe('z');

    hook.rerender({ tracks: pick('u', 'w', 'z'), key: 'pl-1' });

    expect(ids(hook.result.current.playlist)).toEqual(['u', 'w', 'z']);
    expect(hook.result.current.currentTrack.id).toBe('z');
    expect(hook.result.current.currentIndex).toBe(2);
  });

  it('slides the next track in when the playing track is removed', () => {
    const hook = setup();
    act(() => hook.result.current.requestContextStart('pl-1', { startTrackId: 'z' }));
    hook.rerender({ tracks: pick('w', 'z', 'u'), key: 'pl-1' });

    hook.rerender({ tracks: pick('w', 'u'), key: 'pl-1' });

    expect(hook.result.current.currentTrack.id).toBe('u');
  });

  it('picks up tracks added to the playlist, at their position', () => {
    const hook = setup();
    hook.rerender({ tracks: pick('w', 'z'), key: 'pl-1' });
    hook.rerender({ tracks: pick('w', 'x', 'z'), key: 'pl-1' });
    expect(ids(hook.result.current.playlist)).toEqual(['w', 'x', 'z']);
    expect(hook.result.current.currentTrack.id).toBe('w');
  });

  it('toggling shuffle off inside a playlist restores the playlist order, not the artist sort', () => {
    const hook = setup();
    hook.rerender({ tracks: pick('w', 'z', 'u'), key: 'pl-1' });
    act(() => hook.result.current.toggleShuffle());
    expect(hook.result.current.isShuffle).toBe(true);
    act(() => hook.result.current.toggleShuffle());
    expect(hook.result.current.isShuffle).toBe(false);
    expect(ids(hook.result.current.playlist)).toEqual(['w', 'z', 'u']);
  });

  it('playFromContext restarts in order from a named track', () => {
    const hook = setup();
    hook.rerender({ tracks: pick('w', 'z', 'u'), key: 'pl-1' });
    act(() => hook.result.current.toggleShuffle());
    act(() => hook.result.current.playFromContext({ startTrackId: 'u' }));
    expect(hook.result.current.isShuffle).toBe(false);
    expect(ids(hook.result.current.playlist)).toEqual(['w', 'z', 'u']);
    expect(hook.result.current.currentTrack.id).toBe('u');
  });

  it('leaving a playlist restores the earlier shuffle setting and keeps the track', () => {
    const hook = setup();
    act(() => hook.result.current.requestContextStart('pl-1', { startTrackId: 'u' }));
    hook.rerender({ tracks: pick('w', 'z', 'u'), key: 'pl-1' });
    expect(hook.result.current.isShuffle).toBe(false);

    hook.rerender({ tracks: library, key: null });

    expect(hook.result.current.isShuffle).toBe(true);
    expect(hook.result.current.playlist).toHaveLength(library.length);
    expect(hook.result.current.currentTrack.id).toBe('u');
  });
});

describe('usePlayer — library', () => {
  it('keeps the playing track when shuffle is switched off (artist sort)', () => {
    const hook = setup();
    const playing = hook.result.current.currentTrack.id;
    act(() => hook.result.current.toggleShuffle());
    expect(ids(hook.result.current.playlist)).toEqual(['u', 'v', 'w', 'x', 'y', 'z']);
    expect(hook.result.current.currentTrack.id).toBe(playing);
  });

  it('lands on the true next track after remove + skip (dislike)', () => {
    const hook = setup();
    act(() => hook.result.current.toggleShuffle()); // u v w x y z
    act(() => hook.result.current.selectTrack(1)); // v
    act(() => {
      hook.result.current.removeFromPlaylist('v');
      hook.result.current.skipNext();
    });
    expect(hook.result.current.currentTrack.id).toBe('w');
  });
});
