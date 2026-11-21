import type { ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { FACET_KEYS, FACET_LABELS, type FacetKey, type FacetSelections } from '@/lib/facets';

export type SortKey = 'none' | 'artist' | 'title' | 'genre' | 'year' | 'label';

export const SORT_LABELS: Record<SortKey, string> = {
  none: 'Queue order',
  artist: 'Artist A–Z',
  title: 'Title A–Z',
  genre: 'Genre',
  year: 'Year',
  label: 'Label',
};

export type PickerTarget = FacetKey | 'sort';

interface FacetRailProps {
  selections: FacetSelections;
  /** Facets worth offering (the lead computes this; hide the others). */
  availableFacets: FacetKey[];
  sortBy: SortKey;
  onOpen: (target: PickerTarget) => void;
  onRemoveValue: (facet: FacetKey, value: string) => void;
  onClearAll: () => void;
  /** Extra chips appended to the end of the rail (source toggles). */
  railEnd?: ReactNode;
  /** Extra content appended to the end of the applied row (save-as-playlist). */
  appliedEnd?: ReactNode;
}

const ROW_CLASS =
  'flex gap-1.5 overflow-x-auto whitespace-nowrap -mx-4 px-4 [&::-webkit-scrollbar]:hidden';
const ROW_STYLE = { scrollbarWidth: 'none' } as const;
const CHIP_BASE =
  'shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs border transition-colors';
const CHIP_ON = 'bg-primary/15 text-primary border-primary';
const CHIP_OFF = 'bg-muted text-muted-foreground border-transparent';

export function FacetRail({
  selections,
  availableFacets,
  sortBy,
  onOpen,
  onRemoveValue,
  onClearAll,
  railEnd,
  appliedEnd,
}: FacetRailProps) {
  const applied = FACET_KEYS.flatMap((facet) =>
    selections[facet].map((value) => ({ facet, value })),
  );
  const showApplied = applied.length > 0 || Boolean(appliedEnd);

  return (
    <div className="flex flex-col gap-1.5">
      <div className={ROW_CLASS} style={ROW_STYLE}>
        <button
          type="button"
          onClick={() => onOpen('sort')}
          className={`${CHIP_BASE} ${sortBy !== 'none' ? CHIP_ON : CHIP_OFF}`}
        >
          {sortBy === 'none' ? 'Sort' : SORT_LABELS[sortBy]}
          <ChevronDown className="w-3 h-3" aria-hidden="true" />
        </button>
        {availableFacets.map((facet) => {
          const n = selections[facet].length;
          return (
            <button
              key={facet}
              type="button"
              onClick={() => onOpen(facet)}
              className={`${CHIP_BASE} ${n > 0 ? CHIP_ON : CHIP_OFF}`}
            >
              {FACET_LABELS[facet]}
              {n > 0 ? ` · ${n}` : ''}
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            </button>
          );
        })}
        {railEnd}
      </div>

      {showApplied && (
        <div className={ROW_CLASS} style={ROW_STYLE}>
          {applied.map(({ facet, value }) => (
            <button
              key={`${facet}:${value}`}
              type="button"
              aria-label={`Remove filter ${value}`}
              onClick={() => onRemoveValue(facet, value)}
              className={`${CHIP_BASE} ${CHIP_ON}`}
            >
              <span className="max-w-[150px] truncate">{value}</span>
              <X className="w-3 h-3 shrink-0" aria-hidden="true" />
            </button>
          ))}
          {applied.length >= 2 && (
            <button
              type="button"
              onClick={onClearAll}
              className="shrink-0 h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          )}
          {appliedEnd}
        </div>
      )}
    </div>
  );
}
