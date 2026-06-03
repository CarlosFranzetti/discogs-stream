import React, { useState, useMemo } from 'react';
import { Search, Trash2, Plus, ShoppingCart, Music, Copy, ExternalLink, Heart } from 'lucide-react';
import { Track } from '@/types/track';
import { DiscogsRelease } from '@/types/extension';

interface WantlistViewProps {
  wantlist: Track[];
  onPlay?: (track: Track) => void;
  onAddToCrate?: (release: DiscogsRelease) => void;
  onAddToCart?: (cartId: string, release: DiscogsRelease) => void;
  onRemove?: (trackId: string) => void;
  onOpenInBrowser?: (releaseId: number) => void;
  onClearAll?: () => void;
  onImportCSV?: (file: File) => void;
}

function trackToRelease(track: Track): DiscogsRelease {
  return {
    id: track.discogsReleaseId || parseInt(track.id.split('-')[1] || '0', 10),
    title: track.album || track.title,
    artist: track.artist,
    year: track.year,
    coverUrl: track.coverUrl,
    label: track.label,
    genre: track.genre,
  };
}

function dedupeByRelease(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter(t => {
    const key = `${t.artist}-${t.album || t.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function WantlistView({
  wantlist,
  onPlay,
  onAddToCrate,
  onAddToCart,
  onRemove,
  onOpenInBrowser,
  onClearAll,
  onImportCSV,
}: WantlistViewProps) {
  const [search, setSearch] = useState('');
  const [showDedupe, setShowDedupe] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const filtered = useMemo(() => {
    const base = showDedupe ? dedupeByRelease(wantlist) : wantlist;
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album?.toLowerCase().includes(q)
    );
  }, [wantlist, search, showDedupe]);

  const dupCount = wantlist.length - dedupeByRelease(wantlist).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-400" />
          <h2 className="font-semibold text-sm">Wantlist</h2>
          <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 rounded">{wantlist.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {dupCount > 0 && (
            <button
              onClick={() => setShowDedupe(d => !d)}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${showDedupe ? 'border-primary text-primary' : 'border-border/40 text-muted-foreground'}`}
            >
              {showDedupe ? `Deduped (${dupCount})` : `${dupCount} dups`}
            </button>
          )}
          <button
            onClick={() => setEditMode(e => !e)}
            className={`text-xs px-2 py-0.5 rounded border ${editMode ? 'border-primary text-primary' : 'border-border/40 text-muted-foreground'}`}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border/20">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search wantlist…"
            className="w-full bg-secondary/30 border border-border/30 rounded pl-6 pr-3 py-1 text-xs focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {wantlist.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-4">
          <Heart className="w-12 h-12 opacity-15" />
          <p className="text-xs text-center">No wantlist items yet</p>
          <p className="text-[10px] text-center opacity-60">Import a Discogs wantlist CSV to get started</p>
          {onImportCSV && (
            <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              Import CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onImportCSV(f); }}
              />
            </label>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-border/20">
              {filtered.map(track => {
                const release = trackToRelease(track);
                return (
                  <div key={track.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/20 group">
                    <img
                      src={track.coverUrl || '/placeholder.svg'}
                      alt={track.album || track.title}
                      className="w-10 h-10 rounded object-cover shrink-0 border border-border/20"
                      onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{track.album || track.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{track.artist} {track.year > 0 ? `• ${track.year}` : ''}</p>
                      {track.label && <p className="text-[9px] text-muted-foreground/50 truncate">{track.label}</p>}
                    </div>

                    {editMode ? (
                      <div className="flex items-center gap-1">
                        {onAddToCrate && (
                          <button onClick={() => onAddToCrate(release)} className="p-1 text-primary hover:text-primary/80" title="Add to crate">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onAddToCart && (
                          <button onClick={() => onAddToCart('', release)} className="p-1 text-muted-foreground hover:text-foreground" title="Add to cart">
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onOpenInBrowser && release.id > 0 && (
                          <button onClick={() => onOpenInBrowser(release.id)} className="p-1 text-muted-foreground hover:text-foreground" title="Open in browser">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onRemove && (
                          <button onClick={() => onRemove(track.id)} className="p-1 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onPlay && (
                          <button onClick={() => onPlay(track)} className="p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20">
                            <Music className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onOpenInBrowser && release.id > 0 && (
                          <button onClick={() => onOpenInBrowser(release.id)} className="p-1 text-muted-foreground hover:text-foreground">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {editMode && onClearAll && (
            <div className="border-t border-border/40 px-3 py-2">
              <button
                onClick={onClearAll}
                className="w-full text-xs text-destructive border border-destructive/30 rounded py-1.5 hover:bg-destructive/10 transition-colors"
              >
                Clear All Wantlist Items
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
