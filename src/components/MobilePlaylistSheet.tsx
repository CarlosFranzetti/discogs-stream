import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Track } from '@/types/track';
import { Music, Heart, ShoppingCart, Disc3, User, Ban, Search, Filter, X } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useWantlistPrices } from '@/hooks/useWantlistPrices';
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
}: MobilePlaylistSheetProps) {
  const retryingId = null;
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'none' | 'artist' | 'title' | 'genre'>('none');
  const [showFilters, setShowFilters] = useState(false);
  const [facetSelections, setFacetSelections] = useState<FacetSelections>(EMPTY_FACETS);
  const { settings } = useSettings();
  const isTight = settings.playlistSize === 'tight';

  // Determine which sources are present in the playlist
  const hasCollection = playlist.some(t => t.source === 'collection');
  const hasWantlist = playlist.some(t => t.source === 'wantlist');
  const showSourceFilter = (hasCollection && hasWantlist) && activeSources !== undefined;

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

  // OR within a facet, AND across facets. Display-only, like search — the
  // real playlist indices are preserved for onSelectTrack.
  const matchesFacets = (track: Track) =>
    (Object.entries(facetSelections) as [FacetKey, string[]][]).every(([facet, selected]) => {
      if (selected.length === 0) return true;
      const value = facetValue(track, facet);
      return value !== undefined && selected.includes(value);
    });

  const displayedPlaylist = playlist.filter(t =>
    (!searchQuery.trim() ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (activeFacetCount === 0 || matchesFacets(t))
  );

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
  const totalSeconds = displayedPlaylist.reduce((sum, t) => sum + (t.duration || 0), 0);
  const totalRuntime = totalSeconds >= 3600
    ? `${Math.floor(totalSeconds / 3600)}h ${String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')}m`
    : `${Math.floor(totalSeconds / 60)}:${String(Math.floor(totalSeconds % 60)).padStart(2, '0')}`;

  const sortedPlaylist = sortBy === 'none'
    ? displayedPlaylist
    : [...displayedPlaylist].sort((a, b) => {
        let va = '', vb = '';
        if (sortBy === 'artist') { va = a.artist; vb = b.artist; }
        else if (sortBy === 'title') { va = a.title; vb = b.title; }
        else if (sortBy === 'genre') { va = a.genre || ''; vb = b.genre || ''; }
        return va.localeCompare(vb);
      });

  const handleTrackClick = (track: Track, index: number) => {
    // Non-working tracks are display-only — not clickable
    if (track.workingStatus === 'non_working') return;

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

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-[320px] sm:w-[380px] p-0 flex flex-col"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Music className="w-4 h-4 text-primary" />
            Up Next
          </SheetTitle>
          {/* Track count + user info */}
          <div className="flex items-center gap-3 pt-0.5">
            <p className="text-xs text-muted-foreground">
              {displayedPlaylist.length !== playlist.length
                ? `${displayedPlaylist.length} of ${playlist.length} tracks`
                : `${playlist.length} tracks in queue`}
              {totalSeconds > 0 && <span className="text-muted-foreground/70"> · {totalRuntime}</span>}
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
        </SheetHeader>

        {/* Search + sort chips — at the top of the playlist so they're never
            obscured by activity messages docked at the bottom of the screen. */}
        <div className="px-4 py-2 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search tracks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm flex-1 outline-none text-foreground placeholder:text-muted-foreground"
            />
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
        </div>

        <ScrollArea className="flex-1">
          <div className={isTight ? 'py-1' : 'py-2'}>
            {sortedPlaylist.map((track, idx) => {
              const index = playlist.indexOf(track);
              const isNonWorking = track.workingStatus === 'non_working';
              const isPending = !track.youtubeId && track.workingStatus !== 'working' && !isNonWorking;
              void retryingId; // unused, kept for future retry UX
              const opacityClass = isNonWorking ? 'opacity-50' : isPending ? 'opacity-75' : '';
              const coverSize = isTight ? 'w-8 h-8' : 'w-10 h-10';
              const entryPadding = isTight ? 'py-1.5' : 'py-2.5';

              return (
                <div key={track.id}>
                  <button
                    onClick={() => handleTrackClick(track, index)}
                    className={`w-full flex items-center gap-2.5 px-4 ${entryPadding} transition-colors text-left ${
                      index === currentIndex
                        ? 'bg-primary/10 border-l-2 border-primary'
                        : isNonWorking
                        ? ''
                        : 'hover:bg-muted/50'
                    } ${opacityClass} ${isNonWorking ? 'cursor-not-allowed select-none' : 'cursor-pointer'}`}
                  >
                    {/* Track number / playing indicator */}
                    <div className="w-5 text-center shrink-0">
                      {index === currentIndex ? (
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
                          alt={track.title}
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
                      <p className={`${isTight ? 'text-xs' : 'text-sm'} truncate leading-tight ${index === currentIndex ? 'text-primary font-medium' : 'text-foreground'}`}>
                        {track.title}
                      </p>
                      <p className={`${isTight ? 'text-[10px]' : 'text-xs'} text-muted-foreground truncate leading-tight`}>{track.artist}</p>
                    </div>

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
                  </button>

                  {/* Thin partial-width divider in tight mode */}
                  {isTight && idx < sortedPlaylist.length - 1 && (
                    <div className="mx-[52px] border-t border-border/10" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

      </SheetContent>
    </Sheet>
  );
}
