import React, { useState } from 'react';
import { Sparkles, ExternalLink, ShoppingCart, Plus, RefreshCw, Disc3 } from 'lucide-react';
import { SimilarRelease, DiscogsRelease } from '@/types/extension';
import { Track } from '@/types/track';
import { useSimilarReleases } from '@/hooks/useSimilarReleases';

type Mode = 'genre' | 'label' | 'artist' | 'year';

interface SuggestionsViewProps {
  currentTrack?: Track | null;
  onAddToCrate?: (release: DiscogsRelease) => void;
  onAddToCart?: (release: DiscogsRelease) => void;
  onOpenInBrowser?: (releaseId: number) => void;
}

const MODE_LABELS: Record<Mode, string> = {
  genre: 'Genre',
  label: 'Label',
  artist: 'Artist',
  year: 'Year',
};

function similarToRelease(s: SimilarRelease): DiscogsRelease {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    year: s.year,
    coverUrl: s.coverUrl,
    label: s.label,
    genre: s.genre,
  };
}

export function SuggestionsView({ currentTrack, onAddToCrate, onAddToCart, onOpenInBrowser }: SuggestionsViewProps) {
  const { results, loading, error, lastTrack, findSimilar, clearResults } = useSimilarReleases();
  const [mode, setMode] = useState<Mode>('genre');

  const handleFind = () => {
    if (currentTrack) findSimilar(currentTrack, mode);
  };

  const canFind = currentTrack && (
    (mode === 'genre' && currentTrack.genre) ||
    (mode === 'label' && currentTrack.label) ||
    (mode === 'artist' && currentTrack.artist) ||
    (mode === 'year' && currentTrack.year > 0)
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
        <Sparkles className="w-4 h-4 text-yellow-400" />
        <h2 className="font-semibold text-sm">Suggestions</h2>
      </div>

      <div className="px-3 py-2 border-b border-border/20">
        {currentTrack ? (
          <div className="flex items-center gap-2 mb-2">
            <img
              src={currentTrack.coverUrl || '/placeholder.svg'}
              alt={currentTrack.title}
              className="w-8 h-8 rounded object-cover shrink-0 border border-border/20"
              onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{currentTrack.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">{currentTrack.artist}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mb-2">Play a track to find similar releases</p>
        )}

        <div className="flex gap-1 mb-2">
          {(Object.keys(MODE_LABELS) as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 text-[9px] py-1 rounded border transition-colors ${
                mode === m
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/30 text-muted-foreground hover:border-border/60'
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        <button
          onClick={handleFind}
          disabled={!canFind || loading}
          className="w-full flex items-center justify-center gap-2 text-xs bg-primary text-primary-foreground rounded py-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {loading ? 'Searching…' : `Find similar by ${MODE_LABELS[mode]}`}
        </button>

        {!canFind && currentTrack && (
          <p className="text-[9px] text-muted-foreground/50 mt-1 text-center">
            No {MODE_LABELS[mode].toLowerCase()} info available for this track
          </p>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-destructive border-b border-border/20">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <Sparkles className="w-10 h-10 opacity-15" />
            <p className="text-xs">No results yet</p>
            <p className="text-[10px] opacity-60">Select a mode and click Search</p>
          </div>
        ) : (
          <>
            {lastTrack && results.length > 0 && (
              <div className="px-3 py-1.5 flex items-center justify-between border-b border-border/20">
                <span className="text-[10px] text-muted-foreground">{results.length} results · similar to {lastTrack.title}</span>
                <button onClick={clearResults} className="text-[9px] text-muted-foreground hover:text-foreground">Clear</button>
              </div>
            )}
            <div className="divide-y divide-border/20">
              {results.map(r => {
                const release = similarToRelease(r);
                return (
                  <div key={r.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/20 group">
                    <img
                      src={r.coverUrl || '/placeholder.svg'}
                      alt={r.title}
                      className="w-10 h-10 rounded object-cover shrink-0 border border-border/20"
                      onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{r.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {r.artist} {r.year > 0 ? `• ${r.year}` : ''}
                      </p>
                      {(r.genre || r.label) && (
                        <p className="text-[9px] text-muted-foreground/50 truncate">
                          {[r.genre, r.label].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onAddToCrate && (
                        <button onClick={() => onAddToCrate(release)} className="p-1 text-primary hover:text-primary/80" title="Add to crate">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onAddToCart && (
                        <button onClick={() => onAddToCart(release)} className="p-1 text-muted-foreground hover:text-foreground" title="Add to cart">
                          <ShoppingCart className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onOpenInBrowser && (
                        <button onClick={() => onOpenInBrowser(r.id)} className="p-1 text-muted-foreground hover:text-foreground" title="View on Discogs">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
