import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Play, ListMusic, Copy } from 'lucide-react';
import { Track } from '@/types/track';
import { usePlaylists } from '@/hooks/usePlaylists';

interface PlaylistsViewProps {
  currentTrack?: Track | null;
  onLoadPlaylist?: (tracks: Track[]) => void;
  onPlayTrack?: (track: Track) => void;
}

export function PlaylistsView({ currentTrack, onLoadPlaylist, onPlayTrack }: PlaylistsViewProps) {
  const { playlists, loading, createPlaylist, renamePlaylist, deletePlaylist, removeTrackFromPlaylist, addTrackToPlaylist, removeDuplicates } = usePlaylists();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const active = playlists.find(p => p.id === selectedId);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createPlaylist(newName.trim());
    setNewName('');
    setAdding(false);
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    await renamePlaylist(id, editName.trim());
    setEditingId(null);
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;

  if (selectedId && active) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
          <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
          <h3 className="font-semibold text-sm flex-1 truncate">{active.name}</h3>
          <span className="text-xs text-muted-foreground">{active.tracks.length} tracks</span>
          <button onClick={() => removeDuplicates(active.id)} className="p-1 text-muted-foreground hover:text-foreground" title="Remove duplicates">
            <Copy className="w-3.5 h-3.5" />
          </button>
          {onLoadPlaylist && active.tracks.length > 0 && (
            <button
              onClick={() => onLoadPlaylist(active.tracks)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 ml-1"
            >
              <Play className="w-3 h-3" fill="currentColor" />
              Play All
            </button>
          )}
        </div>

        {currentTrack && (
          <div className="px-3 py-2 bg-primary/5 border-b border-border/20 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground truncate">Current: {currentTrack.title}</span>
            <button
              onClick={() => addTrackToPlaylist(active.id, currentTrack)}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {active.tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <ListMusic className="w-8 h-8 opacity-30" />
              <p className="text-xs">Playlist is empty</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {active.tracks.map((track, i) => (
                <div key={track.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/20 group">
                  <span className="text-[9px] text-muted-foreground/50 w-4 text-right shrink-0">{i + 1}</span>
                  <img
                    src={track.coverUrl || '/placeholder.svg'}
                    alt={track.album}
                    className="w-8 h-8 rounded object-cover shrink-0 border border-border/20"
                    onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{track.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onPlayTrack && (
                      <button onClick={() => onPlayTrack(track)} className="p-1 text-primary hover:text-primary/80">
                        <Play className="w-3.5 h-3.5" fill="currentColor" />
                      </button>
                    )}
                    <button onClick={() => removeTrackFromPlaylist(active.id, track.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <h2 className="font-semibold text-sm">Playlists</h2>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {adding && (
        <div className="px-3 py-2 border-b border-border/40 bg-secondary/10">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Playlist name…"
            className="w-full bg-secondary/40 border border-border/40 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/60 mb-2"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex-1 text-xs bg-primary text-primary-foreground rounded py-1">Create</button>
            <button onClick={() => setAdding(false)} className="flex-1 text-xs bg-secondary text-foreground rounded py-1">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <ListMusic className="w-10 h-10 opacity-20" />
            <p className="text-xs">No playlists yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {playlists.map(pl => (
              <div
                key={pl.id}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary/20 group cursor-pointer"
                onClick={() => setSelectedId(pl.id)}
              >
                <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <ListMusic className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  {editingId === pl.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleRename(pl.id); if (e.key === 'Escape') setEditingId(null); }}
                      onClick={e => e.stopPropagation()}
                      className="w-full bg-secondary/40 border border-primary/40 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                    />
                  ) : (
                    <>
                      <p className="text-xs font-medium truncate">{pl.name}</p>
                      <p className="text-[10px] text-muted-foreground">{pl.tracks.length} tracks</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  {editingId === pl.id ? (
                    <>
                      <button onClick={() => handleRename(pl.id)} className="p-1 text-primary"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                    </>
                  ) : (
                    <>
                      {currentTrack && (
                        <button onClick={() => addTrackToPlaylist(pl.id, currentTrack)} className="p-1 text-primary hover:text-primary/80" title="Add current track">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => { setEditingId(pl.id); setEditName(pl.name); }} className="p-1 text-muted-foreground hover:text-foreground">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => deletePlaylist(pl.id)} className="p-1 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
