import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, ChevronLeft, Plus, Search, X } from 'lucide-react';
import type { Track } from '@/types/track';
import { matchesSearch, parseSearchTerms } from '@/lib/facets';

interface AddTracksPickerProps {
  /** The whole library, in library order. */
  library: Track[];
  playlistName: string;
  /** Ids currently in the playlist (the lead keeps this live). */
  trackIdsInPlaylist: string[];
  onAdd: (trackId: string) => void;
  onRemove: (trackId: string) => void;
  onDone: () => void;
  /** Compact rows (settings.playlistSize === 'tight'). */
  isTight?: boolean;
}

const ROW_HEIGHT_NORMAL = 52;
const ROW_HEIGHT_TIGHT = 44;

function hasRealCover(url: string | undefined): url is string {
  return !!url && url !== '/placeholder.svg' && !url.includes('placeholder');
}

export function AddTracksPicker({
  library,
  playlistName,
  trackIdsInPlaylist,
  onAdd,
  onRemove,
  onDone,
  isTight = false,
}: AddTracksPickerProps) {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedThisVisit, setAddedThisVisit] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const id = window.setTimeout(() => setSearchQuery(searchInput), 150);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
  }, []);

  const inPlaylist = useMemo(() => new Set(trackIdsInPlaylist), [trackIdsInPlaylist]);

  const filtered = useMemo(() => {
    const terms = parseSearchTerms(searchQuery);
    if (terms.length === 0) return library;
    return library.filter((t) => matchesSearch(t, terms));
  }, [library, searchQuery]);

  const isFiltered = filtered.length !== library.length;

  const handleToggle = useCallback(
    (trackId: string, currentlyIn: boolean) => {
      if (currentlyIn) {
        setAddedThisVisit((prev) => {
          if (!prev.has(trackId)) return prev;
          const next = new Set(prev);
          next.delete(trackId);
          return next;
        });
        onRemove(trackId);
      } else {
        setAddedThisVisit((prev) => {
          if (prev.has(trackId)) return prev;
          const next = new Set(prev);
          next.add(trackId);
          return next;
        });
        onAdd(trackId);
      }
    },
    [onAdd, onRemove],
  );

  // Scroll element lives in state (callback ref): the sheet mounts through a
  // portal, and a plain useRef leaves the virtualizer with null and zero rows.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => (isTight ? ROW_HEIGHT_TIGHT : ROW_HEIGHT_NORMAL),
    overscan: 8,
    getItemKey: (i) => filtered[i]?.id ?? i,
  });

  const addedCount = addedThisVisit.size;
  const coverSize = isTight ? 'w-8 h-8' : 'w-10 h-10';

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <button
          type="button"
          onClick={onDone}
          className="flex items-center gap-0.5 min-h-[44px] -ml-2 pl-1 pr-2 text-sm text-primary hover:text-primary/80 transition-colors shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          Done
        </button>
        <p className="flex-1 min-w-0 text-center text-sm font-medium text-foreground truncate">
          Add to {playlistName}
        </p>
        <span className="min-w-[2.5rem] text-right text-xs text-muted-foreground tabular-nums shrink-0">
          {addedCount > 0 ? `+${addedCount}` : ''}
        </span>
      </div>

      {/* Search */}
      <div className="px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            inputMode="search"
            placeholder="Search your library…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-transparent text-sm flex-1 outline-none text-foreground placeholder:text-muted-foreground min-w-0"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {isFiltered
            ? `${filtered.length} of ${library.length} tracks`
            : `${library.length} tracks`}
        </p>
      </div>

      {/* Virtualized list */}
      <div
        ref={setScrollEl}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center">
            <Search className="w-5 h-5 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              {library.length === 0 ? 'No tracks loaded yet' : 'Nothing matches'}
            </p>
            {library.length > 0 && (
              <button
                type="button"
                onClick={clearSearch}
                className="text-[11px] text-primary hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const track = filtered[virtualRow.index];
              if (!track) return null;
              const isIn = inPlaylist.has(track.id);
              const label = `${isIn ? 'Remove' : 'Add'} ${track.title} by ${track.artist}`;
              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isIn}
                    aria-label={label}
                    onClick={() => handleToggle(track.id, isIn)}
                    className={`w-full min-h-[44px] flex items-center gap-2.5 px-4 py-1.5 text-left transition-colors ${
                      isIn ? 'bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className={`${coverSize} rounded overflow-hidden bg-muted shrink-0 relative`}>
                      {hasRealCover(track.coverUrl) ? (
                        <img
                          src={track.coverUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs bg-gradient-to-br from-primary/20 to-accent/20">
                          🎵
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`${isTight ? 'text-xs' : 'text-sm'} truncate leading-tight text-foreground`}
                      >
                        {track.title}
                      </p>
                      <p
                        className={`${isTight ? 'text-[10px]' : 'text-xs'} text-muted-foreground truncate leading-tight`}
                      >
                        {track.year ? `${track.artist} · ${track.year}` : track.artist}
                      </p>
                    </div>

                    <span
                      aria-hidden="true"
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isIn
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border text-muted-foreground'
                      }`}
                    >
                      {isIn ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
