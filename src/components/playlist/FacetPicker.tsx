import { useMemo, useState } from 'react';
import { Check, ChevronLeft, X } from 'lucide-react';
import {
  FACET_LABELS,
  facetOptions,
  filterTracks,
  type FacetKey,
  type FacetOption,
  type FacetSelections,
} from '@/lib/facets';
import type { Track } from '@/types/track';
import { SORT_LABELS, type PickerTarget, type SortKey } from './FacetRail';

interface FacetPickerProps {
  target: PickerTarget; // a facet key, or 'sort'
  tracks: Track[]; // the unfiltered queue
  searchTerms: string[]; // the queue's current search terms
  selections: FacetSelections; // currently APPLIED selections
  sortBy: SortKey;
  onApply: (facet: FacetKey, values: string[]) => void;
  onSort: (key: SortKey) => void;
  onCancel: () => void;
}

const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[];
const SEARCH_THRESHOLD = 8;
const MAX_UNSEARCHED = 50;

function PickerHeader({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div className="flex items-center justify-between h-11 shrink-0 border-b border-border">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center h-11 pr-3 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        Filters
      </button>
      <span className="text-sm font-bold">{title}</span>
      {/* Spacer, same width as the back button, keeps the title centred. */}
      <span aria-hidden="true" className="invisible flex items-center h-11 pr-3 text-xs">
        <ChevronLeft className="w-4 h-4" />
        Filters
      </span>
    </div>
  );
}

function SortMode({
  sortBy,
  onSort,
  onCancel,
}: Pick<FacetPickerProps, 'sortBy' | 'onSort' | 'onCancel'>) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PickerHeader title="Sort" onCancel={onCancel} />
      <div
        role="radiogroup"
        aria-label="Sort order"
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
      >
        {SORT_KEYS.map((key) => {
          const active = key === sortBy;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSort(key)}
              className={`flex items-center justify-between w-full min-h-[44px] px-4 text-sm text-left ${
                active ? 'bg-primary/10' : ''
              }`}
            >
              <span className="truncate">{SORT_LABELS[key]}</span>
              {active && <Check className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface FacetModeProps {
  facet: FacetKey;
  tracks: Track[];
  searchTerms: string[];
  selections: FacetSelections;
  onApply: (facet: FacetKey, values: string[]) => void;
  onCancel: () => void;
}

function FacetMode({ facet, tracks, searchTerms, selections, onApply, onCancel }: FacetModeProps) {
  const [draft, setDraft] = useState<string[]>(() => selections[facet]);
  const [query, setQuery] = useState('');

  const draftSelections = useMemo<FacetSelections>(
    () => ({ ...selections, [facet]: draft }),
    [selections, facet, draft],
  );

  // Row order is fixed from the initial draft so rows don't jump while tapping.
  const [order] = useState<string[]>(() =>
    facetOptions(tracks, searchTerms, selections, facet).map((o) => o.value),
  );

  const options = useMemo(
    () => facetOptions(tracks, searchTerms, draftSelections, facet),
    [tracks, searchTerms, draftSelections, facet],
  );

  const rows = useMemo<FacetOption[]>(() => {
    const byValue = new Map(options.map((o) => [o.value, o]));
    const ordered = order.map(
      (value) => byValue.get(value) ?? { value, count: 0, selected: false },
    );
    const known = new Set(order);
    const extras = options.filter((o) => !known.has(o.value));
    return [...ordered, ...extras];
  }, [options, order]);

  const label = FACET_LABELS[facet];
  const showSearch = order.length > SEARCH_THRESHOLD;
  const q = query.trim().toLowerCase();
  const matches = q ? rows.filter((r) => r.value.toLowerCase().includes(q)) : rows;
  const visible = q ? matches : matches.slice(0, MAX_UNSEARCHED);
  const hiddenCount = q ? 0 : matches.length - visible.length;

  const resultCount = useMemo(
    () => filterTracks(tracks, searchTerms, draftSelections).length,
    [tracks, searchTerms, draftSelections],
  );

  const toggle = (value: string) =>
    setDraft((d) => (d.includes(value) ? d.filter((v) => v !== value) : [...d, value]));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PickerHeader title={label} onCancel={onCancel} />

      {showSearch && (
        <div className="relative shrink-0 px-3 py-2">
          <input
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Find a ${label.toLowerCase()}…`}
            aria-label={`Find a ${label.toLowerCase()}`}
            className="w-full h-10 rounded-lg bg-muted/50 pl-3 pr-9 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-muted-foreground"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div
        role="group"
        aria-label={label}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
      >
        {visible.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="checkbox"
            aria-checked={opt.selected}
            onClick={() => toggle(opt.value)}
            className={`flex items-center justify-between gap-3 w-full min-h-[44px] px-4 text-sm text-left ${
              opt.selected ? 'bg-primary/10' : ''
            }`}
          >
            <span className="truncate">{opt.value}</span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground tabular-nums">{opt.count}</span>
              <span className="w-4 h-4 flex items-center justify-center">
                {opt.selected && <Check className="w-4 h-4 text-primary" aria-hidden="true" />}
              </span>
            </span>
          </button>
        ))}
        {visible.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No matches</p>
        )}
        {hiddenCount > 0 && (
          <p className="px-4 py-3 text-xs text-muted-foreground text-center">
            {hiddenCount} more — type to search
          </p>
        )}
      </div>

      <div
        className="shrink-0 border-t border-border p-3 flex gap-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={() => setDraft([])}
          disabled={draft.length === 0}
          className="min-h-[44px] px-4 rounded-lg text-sm bg-muted text-muted-foreground disabled:opacity-40"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => onApply(facet, draft)}
          disabled={resultCount === 0}
          className="flex-1 min-h-[44px] bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-40"
        >
          {resultCount === 0
            ? 'No tracks'
            : `Show ${resultCount} ${resultCount === 1 ? 'track' : 'tracks'}`}
        </button>
      </div>
    </div>
  );
}

export function FacetPicker({
  target,
  tracks,
  searchTerms,
  selections,
  sortBy,
  onApply,
  onSort,
  onCancel,
}: FacetPickerProps) {
  if (target === 'sort') {
    return <SortMode sortBy={sortBy} onSort={onSort} onCancel={onCancel} />;
  }
  return (
    <FacetMode
      key={target}
      facet={target}
      tracks={tracks}
      searchTerms={searchTerms}
      selections={selections}
      onApply={onApply}
      onCancel={onCancel}
    />
  );
}
