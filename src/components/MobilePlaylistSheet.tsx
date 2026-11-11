import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Track } from '@/types/track';
import {
  Music, Heart, ShoppingCart, Disc3, User, Ban, Search, Filter, X,
  ListMusic, Plus, Play, Trash2, Check, ArrowLeft,
} from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useWantlistPrices } from '@/hooks/useWantlistPrices';
import type { UserPlaylist } from '@/hooks/useUserPlaylists';
import { SourceType } from './SourceFilters';

// Phase B2 — crate-digging facets. Values come off the Track fields that are
// already cached per track (styles fold into `genre` at ingest; year is
// bucketed into decades so the chip row stays short).
type FacetKey = 'genre' | 'label' | 'decade' | 'country';
type FacetSelections = Record<FacetKey, string[]>;

const EMPTY_FACETS: FacetSelections = { genre: [], label: [], decade: [], country: [] };
const FACET_CHIP_CAP = 12;

function facetValue(track: Track, facet: FacetKey): string | undefined {
  switch (facet) {
    case 'genre': return track.genre && track.genre !== 'Unknown' ? track.genre : undefined;
    case 'label': return track.label && track.label !== 'Unknown' ? track.label : undefined;
    case 'decade': return track.year ? `${Math.floor(track.year / 10) * 10}s` : undefined;
    case 'country': return track.country || undefined;
  }
}

/** Row heights drive the virtualizer's initial estimate; real heights are
 *  measured after mount, so these only need to be close. */
const ROW_HEIGHT_TIGHT = 44;
const ROW_HEIGHT_NORMAL = 61;

interface MobilePlaylistSheetProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Track[];
  currentIndex: number;
  onSelectTrack: (index: number) => void;
  isDiscogsAuthenticated: boolean;
  discogsUsername?: string;
  onDisconnectDiscogs: () => void;
  isUserLoggedIn: boolean;
  userEmail?: string;
  onSignOut: () => void;
  activeSources?: SourceType[];
  onToggleSource?: (source: SourceType) => void;
  /** Sources present in the full library — chip visibility must not depend on
   *  the filtered playlist, or toggling a source off hides its chip forever. */
  availableSources?: SourceType[];
  // User playlists
  userPlaylists?: UserPlaylist[];
  activePlaylistId?: string | null;
  onPlayPlaylist?: (id: string) => void;
  onExitPlaylist?: () => void;
  onCreatePlaylist?: (name: string, trackIds?: string[]) => void;
  onDeletePlaylist?: (id: string) => void;
  onAddTrackToPlaylist?: (playlistId: string, trackId: string) => void;
  onRemoveTrackFromPlaylist?: (playlistId: string, trackId: string) => void;
}

export function MobilePlaylistSheet({
  isOpen,
  onClose,
  playlist,
  currentIndex,
  onSelectTrack,
  isDiscogsAuthenticated,
  discogsUsername,
  onDisconnectDiscogs: _onDisconnectDiscogs,
  isUserLoggedIn,
  userEmail,
  onSignOut: _onSignOut,
  activeSources,
  onToggleSource,
  availableSources,
  userPlaylists = [],
  activePlaylistId = null,
  onPlayPlaylist,
  onExitPlaylist,
  onCreatePlaylist,
  onDeletePlaylist,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
}: MobilePlaylistSheetProps) {
  const [tab, setTab] = useState<'queue' | 'playlists'>('queue');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'none' | 'artist' | 'title' | 'genre'>('none');
  const [showFilters, setShowFilters] = useState(false);
  const [facetSelections, setFacetSelections] = useState<FacetSelections>(EMPTY_FACETS);
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const { settings } = useSettings();
  const isTight = settings.playlistSize === 'tight';

  // Debounced search: filtering a 2k-track library on every keystroke made
  // typing visibly lag. The input stays instant; the filter trails it.
  useEffect(() => {
    const id = window.setTimeout(() => setSearchQuery(searchInput), 150);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  // Source chips show whenever both sources exist in the LIBRARY (prop from
  // the player, falling back to the playlist for older callers) — never gated
  // on the filtered playlist, which loses a source the moment it's toggled off.
  const libHasCollection = availableSources
    ? availableSources.includes('collection')
    : playlist.some(t => t.source === 'collection');
  const libHasWantlist = availableSources
    ? availableSources.includes('wantlist')
    : playlist.some(t => t.source === 'wantlist');
  const showSourceFilter = (libHasCollection && libHasWantlist) && activeSources !== undefined;

  // id -> queue index. The row loop used playlist.indexOf(track), which is
  // O(n) per row and so O(n²) per render; at 10k tracks that alone is tens of
  // milliseconds of every scroll frame.
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    playlist.forEach((t, i) => m.set(t.id, i));
    return m;
  }, [playlist]);

  // Phase B2 — distinct chip values per facet, most-frequent first, capped so
  // a 2k-track collection with hundreds of labels stays a chip row, not a wall.
  const facetOptions = useMemo(() => {
    const options = {} as Record<FacetKey, { value: string; count: number }[]>;
    for (const facet of ['genre', 'label', 'decade', 'country'] as FacetKey[]) {
      const counts = new Map<string, number>();
      for (const track of playlist) {
        const value = facetValue(track, facet);
        if (value) counts.set(value, (counts.get(value) || 0) + 1);
      }
      options[facet] = [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
        .slice(0, FACET_CHIP_CAP);
    }
    return options;
  }, [playlist]);

  const activeFacetCount = Object.values(facetSelections).reduce((n, sel) => n + sel.length, 0);

  const toggleFacetValue = (facet: FacetKey, value: string) => {
    setFacetSelections(prev => ({
      ...prev,
      [facet]: prev[facet].includes(value)
        ? prev[facet].filter(v => v !== value)
        : [...prev[facet], value],
    }));
  };

  // Search now spans title, artist, album, label and year — searching "1988"
  // or a label name used to come back empty, which read as a broken search.
  // Multi-word queries match on every term, in any field and any order.
  const displayedPlaylist = useMemo(() => {
    const terms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

    const matchesSearch = (t: Track) => {
      if (terms.length === 0) return true;
      const haystack = `${t.title} ${t.artist} ${t.album || ''} ${t.label || ''} ${t.year || ''}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    };

    const matchesFacets = (track: Track) =>
      (Object.entries(facetSelections) as [FacetKey, string[]][]).every(([facet, selected]) => {
        if (selected.length === 0) return true;
        const value = facetValue(track, facet);
        return value !== undefined && selected.includes(value);
      });

    return playlist.filter(
      (t) => matchesSearch(t) && (activeFacetCount === 0 || matchesFacets(t))
    );
  }, [playlist, searchQuery, facetSelections, activeFacetCount]);

  const sortedPlaylist = useMemo(() => {
    if (sortBy === 'none') return displayedPlaylist;
    return [...displayedPlaylist].sort((a, b) => {
      let va = '', vb = '';
      if (sortBy === 'artist') { va = a.artist; vb = b.artist; }
      else if (sortBy === 'title') { va = a.title; vb = b.title; }
      else if (sortBy === 'genre') { va = a.genre || ''; vb = b.genre || ''; }
      return va.localeCompare(vb);
    });
  }, [displayedPlaylist, sortBy]);

  // Phase B1 — wantlist marketplace prices. requestPrices dedupes internally
  // and throttles to ~1 req/s; only fetch while the sheet is actually open,
  // capped so a huge wantlist doesn't queue an hour of lookups.
  const { getPriceForRelease, requestPrices } = useWantlistPrices();
  useEffect(() => {
    if (!isOpen) return;
    const ids = playlist
      .filter((t) => t.source === 'wantlist' && t.discogsReleaseId)
      .map((t) => t.discogsReleaseId as number)
      .slice(0, 40);
    if (ids.length) requestPrices(ids);
  }, [isOpen, playlist, requestPrices]);

  // Phase A4 — total runtime of the visible queue (DJs think in minutes, not
  // track counts). Formats as h:mm for hour+ crates, m:ss below that.
  const totalSeconds = sortedPlaylist.reduce((sum, t) => sum + (t.duration || 0), 0);
  const totalRuntime = totalSeconds >= 3600
    ? `${Math.floor(totalSeconds / 3600)}h ${String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')}m`
    : `${Math.floor(totalSeconds / 60)}:${String(Math.floor(totalSeconds % 60)).padStart(2, '0')}`;

  // Virtualized list. A 1800-track queue rendered ~1800 rows and fired ~1800
  // cover-image requests on open; only the visible window is mounted now.
  // A plain overflow container is used rather than Radix ScrollArea so the
  // virtualizer owns a real scrolling element and mobile momentum scrolling
  // behaves natively.
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sortedPlaylist.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (isTight ? ROW_HEIGHT_TIGHT : ROW_HEIGHT_NORMAL),
    overscan: 8,
    getItemKey: (i) => sortedPlaylist[i]?.id ?? i,
  });

  // Opening the sheet should land on the track that's playing, not at the top
  // of a 1800-row list the user then has to hunt through.
  useEffect(() => {
    if (!isOpen || tab !== 'queue') return;
    if (searchQuery || activeFacetCount > 0 || sortBy !== 'none') return;
    const pos = sortedPlaylist.findIndex((t) => indexById.get(t.id) === currentIndex);
    if (pos >= 0) {
      requestAnimationFrame(() => rowVirtualizer.scrollToIndex(pos, { align: 'center' }));
    }
    // Only on open — re-running while the user scrolls would yank them back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tab]);

  const handleTrackClick = (track: Track) => {
    // Non-working tracks are display-only — not clickable
    if (track.workingStatus === 'non_working') return;
    const index = indexById.get(track.id);
    if (index === undefined) return;
    onSelectTrack(index);
    onClose();
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'wantlist': return <Heart className="w-3 h-3" />;
      case 'similar': return <ShoppingCart className="w-3 h-3" />;
      default: return <Disc3 className="w-3 h-3" />;
    }
  };

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
  }, []);

  const activePlaylist = userPlaylists.find((p) => p.id === activePlaylistId) || null;

  const handleCreatePlaylist = (trackIds?: string[]) => {
    if (!onCreatePlaylist) return;
    const name = newPlaylistName.trim();
    if (!name) return;
    onCreatePlaylist(name, trackIds);
    setNewPlaylistName('');
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-[320px] sm:w-[380px] p-0 flex flex-col"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            {activePlaylist ? (
              <>
                <ListMusic className="w-4 h-4 text-primary" />
                <span className="truncate">{activePlaylist.name}</span>
              </>
            ) : (
              <>
                <Music className="w-4 h-4 text-primary" />
                Up Next
              </>
            )}
          </SheetTitle>
          {/* Track count + user info. Queue stats are meaningless while the
              Playlists tab is open, so they're hidden there rather than
              reporting the queue's numbers under a playlist heading. */}
          <div className="flex items-center gap-3 pt-0.5">
            <p className="text-xs text-muted-foreground">
              {tab === 'playlists'
                ? `${userPlaylists.length} ${userPlaylists.length === 1 ? 'playlist' : 'playlists'}`
                : sortedPlaylist.length !== playlist.length
                ? `${sortedPlaylist.length} of ${playlist.length} tracks`
                : `${playlist.length} tracks`}
              {tab === 'queue' && totalSeconds > 0 && (
                <span className="text-muted-foreground/70"> · {totalRuntime}</span>
              )}
            </p>
            {isDiscogsAuthenticated && discogsUsername && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="text-success">●</span>
                Discogs
              </span>
            )}
            {isUserLoggedIn && userEmail && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                {userEmail.split('@')[0]}
              </span>
            )}
          </div>

          {/* Queue / Playlists tabs */}
          <div className="flex gap-1 pt-2">
            {(['queue', 'playlists'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  tab === t
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'queue' ? <Music className="w-3 h-3" /> : <ListMusic className="w-3 h-3" />}
                {t === 'queue' ? 'Queue' : `Playlists${userPlaylists.length ? ` (${userPlaylists.length})` : ''}`}
              </button>
            ))}
          </div>
        </SheetHeader>

        {tab === 'queue' ? (
          <>
            {/* Playing-from banner — the way back out of a user playlist. */}
            {activePlaylist && onExitPlaylist && (
              <button
                onClick={onExitPlaylist}
                className="flex items-center gap-2 px-4 py-2 text-[11px] text-muted-foreground hover:text-foreground border-b border-border/60 shrink-0 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Playing from <span className="text-primary">{activePlaylist.name}</span> — back to library
              </button>
            )}

            {/* Search + sort chips — at the top of the playlist so they're never
                obscured by activity messages docked at the bottom of the screen. */}
            <div className="px-4 py-2 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  inputMode="search"
                  placeholder="Title, artist, album, label, year…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="bg-transparent text-sm flex-1 outline-none text-foreground placeholder:text-muted-foreground min-w-0"
                />
                {searchInput && (
                  <button
                    onClick={clearSearch}
                    aria-label="Clear search"
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {(['artist', 'title', 'genre'] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(prev => prev === key ? 'none' : key)}
                    className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors capitalize ${
                      sortBy === key
                        ? 'bg-primary/15 text-primary border-primary'
                        : 'bg-muted text-muted-foreground border-transparent'
                    }`}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
                {/* Phase B2 — crate-digging filter toggle */}
                <button
                  onClick={() => setShowFilters(prev => !prev)}
                  className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors flex items-center gap-1 ${
                    showFilters || activeFacetCount > 0
                      ? 'bg-primary/15 text-primary border-primary'
                      : 'bg-muted text-muted-foreground border-transparent'
                  }`}
                >
                  <Filter className="w-2.5 h-2.5" />
                  Filter{activeFacetCount > 0 ? ` (${activeFacetCount})` : ''}
                </button>
                {showSourceFilter && (
                  <>
                    <div className="w-px bg-border mx-0.5 self-stretch" />
                    {(['collection', 'wantlist'] as const).map((src) => {
                      const active = activeSources!.includes(src);
                      return (
                        <button
                          key={src}
                          onClick={() => onToggleSource?.(src)}
                          className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors flex items-center gap-1 ${
                            active
                              ? 'bg-primary/15 text-primary border-primary'
                              : 'bg-muted text-muted-foreground/50 border-transparent line-through'
                          }`}
                        >
                          {src === 'collection' ? '◎' : '♡'} {src.charAt(0).toUpperCase() + src.slice(1)}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Phase B2 — facet chip rows (genre / label / decade / country).
                  OR within a row, AND across rows; display-only filtering. */}
              {showFilters && (
                <div className="mt-2 space-y-1.5">
                  {(['genre', 'label', 'decade', 'country'] as FacetKey[]).map((facet) => {
                    const options = facetOptions[facet];
                    if (options.length < 2 && facetSelections[facet].length === 0) return null;
                    return (
                      <div key={facet} className="flex items-start gap-1.5">
                        <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70 w-12 shrink-0 pt-1">
                          {facet}
                        </span>
                        <div className="flex gap-1 flex-wrap min-w-0">
                          {options.map(({ value, count }) => {
                            const active = facetSelections[facet].includes(value);
                            return (
                              <button
                                key={value}
                                onClick={() => toggleFacetValue(facet, value)}
                                className={`px-1.5 py-0.5 rounded-full text-[9px] border transition-colors max-w-[140px] truncate ${
                                  active
                                    ? 'bg-primary/15 text-primary border-primary'
                                    : 'bg-muted text-muted-foreground border-transparent'
                                }`}
                                title={`${value} (${count})`}
                              >
                                {value} <span className="opacity-60">{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {activeFacetCount > 0 && (
                    <button
                      onClick={() => setFacetSelections(EMPTY_FACETS)}
                      className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors ml-[54px]"
                    >
                      <X className="w-2.5 h-2.5" /> Clear filters
                    </button>
                  )}
                </div>
              )}

              {/* Save the current view as a playlist — turns a dug-out filter
                  result into something permanent in one tap. */}
              {onCreatePlaylist && (searchQuery || activeFacetCount > 0) && sortedPlaylist.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(sortedPlaylist.map(t => t.id)); }}
                    placeholder={`Save these ${sortedPlaylist.length} as…`}
                    className="flex-1 min-w-0 bg-muted/50 rounded px-2 py-1 text-[11px] outline-none placeholder:text-muted-foreground/70"
                  />
                  <button
                    onClick={() => handleCreatePlaylist(sortedPlaylist.map(t => t.id))}
                    disabled={!newPlaylistName.trim()}
                    className="shrink-0 px-2 py-1 rounded text-[10px] bg-primary/15 text-primary disabled:opacity-40 transition-opacity"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            {/* Virtualized track list */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {sortedPlaylist.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center">
                  <Search className="w-5 h-5 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">
                    {playlist.length === 0 ? 'No tracks loaded yet' : 'Nothing matches those filters'}
                  </p>
                  {(searchQuery || activeFacetCount > 0) && (
                    <button
                      onClick={() => { clearSearch(); setFacetSelections(EMPTY_FACETS); }}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Clear search &amp; filters
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={isTight ? 'py-1' : 'py-2'}
                  style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const track = sortedPlaylist[virtualRow.index];
                    if (!track) return null;
                    const index = indexById.get(track.id) ?? -1;
                    const isNonWorking = track.workingStatus === 'non_working';
                    const isPending = !track.youtubeId && track.workingStatus !== 'working' && !isNonWorking;
                    const opacityClass = isNonWorking ? 'opacity-50' : isPending ? 'opacity-75' : '';
                    const coverSize = isTight ? 'w-8 h-8' : 'w-10 h-10';
                    const entryPadding = isTight ? 'py-1.5' : 'py-2.5';
                    const isCurrent = index === currentIndex;

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
                        <div
                          className={`w-full flex items-center gap-2.5 pl-4 pr-2 ${entryPadding} transition-colors ${
                            isCurrent
                              ? 'bg-primary/10 border-l-2 border-primary'
                              : isNonWorking
                              ? ''
                              : 'hover:bg-muted/50'
                          } ${opacityClass}`}
                        >
                          <button
                            onClick={() => handleTrackClick(track)}
                            disabled={isNonWorking}
                            className={`flex items-center gap-2.5 flex-1 min-w-0 text-left ${
                              isNonWorking ? 'cursor-not-allowed select-none' : 'cursor-pointer'
                            }`}
                          >
                            {/* Track number / playing indicator */}
                            <div className="w-5 text-center shrink-0">
                              {isCurrent ? (
                                <span className="text-primary text-base">•</span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">{index + 1}</span>
                              )}
                            </div>

                            {/* Cover */}
                            <div className={`${coverSize} rounded overflow-hidden bg-muted shrink-0 relative`}>
                              {track.coverUrl && track.coverUrl !== '/placeholder.svg' && !track.coverUrl.includes('placeholder') ? (
                                <img
                                  src={track.coverUrl}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-xs bg-gradient-to-br from-primary/20 to-accent/20">
                                  🎵
                                </div>
                              )}
                              {isNonWorking && (
                                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-background/80 rounded-tl flex items-center justify-center">
                                  <Ban className="w-2 h-2 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            {/* Track info */}
                            <div className="flex-1 min-w-0">
                              <p className={`${isTight ? 'text-xs' : 'text-sm'} truncate leading-tight ${isCurrent ? 'text-primary font-medium' : 'text-foreground'}`}>
                                {track.title}
                              </p>
                              <p className={`${isTight ? 'text-[10px]' : 'text-xs'} text-muted-foreground truncate leading-tight`}>{track.artist}</p>
                            </div>
                          </button>

                          {/* Phase B1 — wantlist lowest-price badge */}
                          {track.source === 'wantlist' && track.discogsReleaseId ? (() => {
                            const stats = getPriceForRelease(track.discogsReleaseId);
                            return stats && stats.lowestPrice != null ? (
                              <span className="text-[9px] font-mono text-success shrink-0" title={`${stats.numForSale} for sale`}>
                                {stats.currency === 'USD' ? '$' : `${stats.currency} `}
                                {stats.lowestPrice.toFixed(stats.lowestPrice >= 100 ? 0 : 2)}
                              </span>
                            ) : null;
                          })() : null}

                          {/* Source indicator */}
                          <div className="text-muted-foreground shrink-0">
                            {getSourceIcon(track.source)}
                          </div>

                          {/* Add to playlist / remove from the open playlist */}
                          {activePlaylist && onRemoveTrackFromPlaylist ? (
                            <button
                              onClick={() => onRemoveTrackFromPlaylist(activePlaylist.id, track.id)}
                              aria-label="Remove from playlist"
                              className="shrink-0 p-1.5 -mr-0.5 text-muted-foreground/60 hover:text-destructive transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          ) : onAddTrackToPlaylist ? (
                            <button
                              onClick={() => setAddingTrackId(addingTrackId === track.id ? null : track.id)}
                              aria-label="Add to playlist"
                              className={`shrink-0 p-1.5 -mr-0.5 transition-colors ${
                                addingTrackId === track.id ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                        </div>

                        {/* Inline playlist picker for this row */}
                        {addingTrackId === track.id && onAddTrackToPlaylist && (
                          <div className="mx-4 mb-2 rounded-lg border border-border bg-popover p-2 space-y-1">
                            {userPlaylists.length === 0 && (
                              <p className="text-[10px] text-muted-foreground px-1 pb-1">
                                No playlists yet — name one below.
                              </p>
                            )}
                            {userPlaylists.map((p) => {
                              const already = p.trackIds.includes(track.id);
                              return (
                                <button
                                  key={p.id}
                                  disabled={already}
                                  onClick={() => {
                                    onAddTrackToPlaylist(p.id, track.id);
                                    setAddingTrackId(null);
                                  }}
                                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-[11px] hover:bg-muted/60 disabled:opacity-50 transition-colors"
                                >
                                  <span className="truncate">{p.name}</span>
                                  {already
                                    ? <Check className="w-3 h-3 text-success shrink-0" />
                                    : <Plus className="w-3 h-3 text-muted-foreground shrink-0" />}
                                </button>
                              );
                            })}
                            {onCreatePlaylist && (
                              <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
                                <input
                                  type="text"
                                  value={newPlaylistName}
                                  onChange={(e) => setNewPlaylistName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newPlaylistName.trim()) {
                                      onCreatePlaylist(newPlaylistName.trim(), [track.id]);
                                      setNewPlaylistName('');
                                      setAddingTrackId(null);
                                    }
                                  }}
                                  placeholder="New playlist…"
                                  className="flex-1 min-w-0 bg-muted/50 rounded px-2 py-1 text-[11px] outline-none"
                                />
                                <button
                                  onClick={() => {
                                    if (!newPlaylistName.trim()) return;
                                    onCreatePlaylist(newPlaylistName.trim(), [track.id]);
                                    setNewPlaylistName('');
                                    setAddingTrackId(null);
                                  }}
                                  disabled={!newPlaylistName.trim()}
                                  className="shrink-0 px-2 py-1 rounded text-[10px] bg-primary/15 text-primary disabled:opacity-40"
                                >
                                  Add
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Thin partial-width divider in tight mode */}
                        {isTight && virtualRow.index < sortedPlaylist.length - 1 && (
                          <div className="mx-[52px] border-t border-border/10" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* ─────────── Playlists tab ─────────── */
          <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="p-4 space-y-3">
              {onCreatePlaylist && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(); }}
                    placeholder="New playlist name…"
                    className="flex-1 min-w-0 bg-muted/50 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => handleCreatePlaylist()}
                    disabled={!newPlaylistName.trim()}
                    className="shrink-0 px-3 py-2 rounded-lg text-xs bg-primary/15 text-primary disabled:opacity-40 transition-opacity flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Create
                  </button>
                </div>
              )}

              {userPlaylists.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <ListMusic className="w-6 h-6 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No playlists yet</p>
                  <p className="text-[11px] text-muted-foreground/70 max-w-[220px] leading-snug">
                    Name one above, then add tracks with the + on any row — or filter the queue and save the results in one tap.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {userPlaylists.map((p) => {
                    const isActive = p.id === activePlaylistId;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                          isActive ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'
                        }`}
                      >
                        <button
                          onClick={() => { onPlayPlaylist?.(p.id); setTab('queue'); }}
                          disabled={p.trackIds.length === 0}
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-left disabled:opacity-50"
                        >
                          <Play className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                          <div className="min-w-0">
                            <p className={`text-sm truncate leading-tight ${isActive ? 'text-primary font-medium' : 'text-foreground'}`}>
                              {p.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground leading-tight">
                              {p.trackIds.length} {p.trackIds.length === 1 ? 'track' : 'tracks'}
                            </p>
                          </div>
                        </button>
                        {onDeletePlaylist && (
                          <button
                            onClick={() => {
                              if (confirm(`Delete playlist "${p.name}"? The tracks stay in your library.`)) {
                                onDeletePlaylist(p.id);
                              }
                            }}
                            aria-label={`Delete ${p.name}`}
                            className="shrink-0 p-1.5 text-muted-foreground/60 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
