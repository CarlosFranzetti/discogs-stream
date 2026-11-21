import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { moveItem, useUserPlaylists } from './useUserPlaylists';

describe('moveItem', () => {
  it('moves forwards and backwards', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('clamps out-of-range targets to the ends', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, -5)).toEqual(['c', 'a', 'b']);
  });

  it('returns the same array when nothing moves', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 1, 1)).toBe(items);
    expect(moveItem(items, 7, 0)).toBe(items);
  });
});

describe('useUserPlaylists', () => {
  beforeEach(() => localStorage.clear());

  const setup = () => {
    const hook = renderHook(() => useUserPlaylists());
    let id = '';
    act(() => { id = hook.result.current.createPlaylist('Set opener', ['a', 'b', 'c', 'd']).id; });
    const ids = () => hook.result.current.playlists.find((p) => p.id === id)?.trackIds;
    return { hook, id, ids };
  };

  it('moveTrackById places a track before another, or at the end', () => {
    const { hook, id, ids } = setup();
    act(() => hook.result.current.moveTrackById(id, 'd', 'b'));
    expect(ids()).toEqual(['a', 'd', 'b', 'c']);
    act(() => hook.result.current.moveTrackById(id, 'a', null));
    expect(ids()).toEqual(['d', 'b', 'c', 'a']);
  });

  it('moveTrackById ignores unknown tracks and self-moves', () => {
    const { hook, id, ids } = setup();
    const before = hook.result.current.playlists;
    act(() => hook.result.current.moveTrackById(id, 'zzz', 'a'));
    act(() => hook.result.current.moveTrackById(id, 'b', 'b'));
    expect(ids()).toEqual(['a', 'b', 'c', 'd']);
    expect(hook.result.current.playlists[0]).toBe(before[0]);
  });

  it('moveTrack reorders by index', () => {
    const { hook, id, ids } = setup();
    act(() => hook.result.current.moveTrack(id, 0, 3));
    expect(ids()).toEqual(['b', 'c', 'd', 'a']);
  });

  it('setPlaylistTracks undoes a removal in place', () => {
    const { hook, id, ids } = setup();
    const snapshot = ids()!;
    act(() => hook.result.current.removeTrackFromPlaylist(id, 'b'));
    expect(ids()).toEqual(['a', 'c', 'd']);
    act(() => hook.result.current.setPlaylistTracks(id, snapshot));
    expect(ids()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('restorePlaylist puts a deleted playlist back at its position, once', () => {
    const { hook } = setup();
    act(() => { hook.result.current.createPlaylist('Second'); });
    const [second, first] = hook.result.current.playlists;
    act(() => hook.result.current.deletePlaylist(first.id));
    expect(hook.result.current.playlists.map((p) => p.name)).toEqual(['Second']);
    act(() => hook.result.current.restorePlaylist(first, 1));
    act(() => hook.result.current.restorePlaylist(first, 1));
    expect(hook.result.current.playlists.map((p) => p.id)).toEqual([second.id, first.id]);
  });

  it('renames, and keeps the old name for a blank one', () => {
    const { hook, id } = setup();
    act(() => hook.result.current.renamePlaylist(id, '  Warm up  '));
    expect(hook.result.current.playlists[0].name).toBe('Warm up');
    act(() => hook.result.current.renamePlaylist(id, '   '));
    expect(hook.result.current.playlists[0].name).toBe('Warm up');
  });

  it('persists to localStorage', () => {
    const { hook, id } = setup();
    act(() => hook.result.current.moveTrackById(id, 'c', 'a'));
    const again = renderHook(() => useUserPlaylists());
    expect(again.result.current.playlists[0].trackIds).toEqual(['c', 'a', 'b', 'd']);
  });
});
