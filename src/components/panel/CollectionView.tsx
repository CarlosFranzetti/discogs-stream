import React, { useState, useMemo } from 'react';
import { Search, Music, Plus, ShoppingCart, Package, ExternalLink, Copy } from 'lucide-react';
import { Track } from '@/types/track';
import { DiscogsRelease } from '@/types/extension';

interface CollectionViewProps {
  collection: Track[];
  onPlay?: (track: Track) => void;
  onAddToCrate?: (release: DiscogsRelease) => void;
  onAddToCart?: (cartId: string, release: DiscogsRelease) => void;
  onOpenInBrowser?: (releaseId: number) => void;
  onClearAll?: () => void;
  onImportCSV?: (file: File) => void;
}

function trackToRelease(track: Track): DiscogsRelease {
  return {
    id: track.discogsReleaseId || 0,
    title: track.album || track.title,
    artist: track.artist,
    year: track.year,
    coverUrl: track.coverUrl,
    label: track.label,
    genre: track.genre,
  };
}

export function CollectionView({
  collection,
  onPlay,
  onAddToCrate,
  onAddToCart,
  onOpenInBrowser,
  onClearAll,
  onImportCSV,
}: CollectionViewProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'artist' | 'year' | 'added'>('artist');
  const [editMode, setEditMode] = useState(false);

  const sorted = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = collection.filter(t =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album?.toLowerCase().includes(q) ||
      t.label?.toLowerCase().includes(q)
    );

    return [...filtered].sort((a, b) => {
      if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
      if (sortBy === 'year') return (b.year || 0) - (a.year || 0);
      return 0;
    });
  }, [collection, search, sortBy]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-cyan-400" />
          <h2 className="font-semibold text-sm">Collection</h2>
          <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 rounded">{collection.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-[10px] bg-secondary/30 border border-border/30 rounded px-1 py-0.5 text-muted-foreground focus:outline-none"
          >
            <option value="artist">Artist</option>
            <option value="year">Year</option>
          </select>
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
            placeholder="Search collection…"
            className="w-full bg-secondary/30 border border-border/30 rounded pl-6 pr-3 py-1 text-xs focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {collection.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-4">
          <Package className="w-12 h-12 opacity-15" />
          <p className="text-xs text-center">Collection is empty</p>
          <p className="text-[10px] text-center opacity-60">Import a Discogs collection CSV to get started</p>
          {onImportCSV && (
            <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              Import Collection CSV
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
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-border/20">
            {sorted.map(track => {
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
                    {track.genre && <p className="text-[9px] text-muted-foreground/50 truncate">{track.genre}</p>}
                  </div>

                  {editMode ? (
                    <div className="flex items-center gap-1">
                      {onAddToCrate && (
                        <button onClick={() => onAddToCrate(release)} className="p-1 text-primary" title="Add to crate">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onAddToCart && (
                        <button onClick={() => onAddToCart('', release)} className="p-1 text-muted-foreground hover:text-foreground" title="Add to cart">
                          <ShoppingCart className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onOpenInBrowser && release.id > 0 && (
                        <button onClick={() => onOpenInBrowser(release.id)} className="p-1 text-muted-foreground hover:text-foreground">
                          <ExternalLink className="w-3.5 h-3.5" />
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
      )}
    </div>
  );
}
