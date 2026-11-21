import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowUpToLine, Ban, ChevronLeft, GripVertical, MinusCircle, Play, Plus,
  Shuffle, Trash2,
} from 'lucide-react';
import type { Track } from '@/types/track';
import type { UserPlaylist } from '@/hooks/useUserPlaylists';
import type { ContextStart } from '@/hooks/usePlayer';
import { formatRuntime } from '@/lib/facets';
import { AddTracksPicker } from './AddTracksPicker';

/**
 * One playlist, opened from the Playlists tab.
 *
 * Listen by default: rows play on tap, and each row carries the running set
 * length (where the set clock stands when that track ends). `Edit` switches
 * to an explicit edit mode — rename, a red remove control on the left, a drag
 * handle on the right, "Move to position…" from the row number, and adding
 * from the library. Every destructive or reordering step offers Undo.
 *
 * Reordering is a handle-only pointer drag. The handle has `touch-action:
 * none`, so on iOS the rest of the row still scrolls the list and nothing
 * competes with the panel's edge swipe. Rows are a fixed height in edit mode,
 * which keeps the drag maths to a division.
 */

const ROW_H = 56;
const ROW_H_TIGHT = 48;
/** Pointer distance from the list's top/bottom edge that starts auto-scroll. */
const AUTOSCROLL_EDGE = 56;

interface PlaylistEditorProps {
  playlist: UserPlaylist;
  /** The playlist resolved against the library, in playlist order. */
  tracks: Track[];
  library: Track[];
  /** This playlist is what the player is playing right now. */
  isActive: boolean;
  currentTrackId?: string | null;
  isTight: boolean;
  onBack: () => void;
  onPlay: (start?: ContextStart) => void;
  onRename: (name: string) => void;
  /** Move `trackId` to sit where `beforeTrackId` is (null = end). */
  onMove: (trackId: string, beforeTrackId: string | null) => void;
  onSetTracks: (trackIds: string[]) => void;
  onAdd: (trackId: string) => void;
  onRemove: (trackId: string) => void;
  onDelete: () => void;
  /** Show the panel's Undo bar. */
  showUndo: (message: string, undo: () => void) => void;
}

interface RowProps {
  track: Track;
  index: number;
  count: number;
  rowHeight: number;
  isTight: boolean;
  editing: boolean;
  isCurrent: boolean;
  /** Running set length at the end of this track, pre-formatted. */
  clock: string;
  /** -1 / 0 / 1 row heights to shift while another row is being dragged. */
  shift: number;
  isDragging: boolean;
  animate: boolean;
  moveOpen: boolean;
  onTap: (track: Track) => void;
  onRemove: (track: Track) => void;
  onToggleMove: (trackId: string) => void;
  onMoveTo: (trackId: string, index: number) => void;
  onHandleDown: (e: React.PointerEvent<HTMLButtonElement>, trackId: string, index: number) => void;
  onHandleMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onHandleEnd: (e: React.PointerEvent<HTMLButtonElement>, commit: boolean) => void;
}

const EditorRow = memo(function EditorRow({
  track, index, count, rowHeight, isTight, editing, isCurrent, clock, shift, isDragging, animate,
  moveOpen, onTap, onRemove, onToggleMove, onMoveTo, onHandleDown, onHandleMove, onHandleEnd,
}: RowProps) {
  const [position, setPosition] = useState(String(index + 1));
  useEffect(() => { if (moveOpen) setPosition(String(index + 1)); }, [moveOpen, index]);

  const isNonWorking = track.workingStatus === 'non_working';
  const hasCover = track.coverUrl && !track.coverUrl.includes('placeholder');
  const coverSize = isTight ? 'w-8 h-8' : 'w-10 h-10';
  const target = Math.max(1, Math.min(count, parseInt(position, 10) || index + 1));

  const cover = (
    <div className={`${coverSize} rounded overflow-hidden bg-muted shrink-0 relative`}>
      {hasCover ? (
        <img
          src={track.coverUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs bg-gradient-to-br from-primary/20 to-accent/20">🎵</div>
      )}
      {isNonWorking && (
        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-background/80 rounded-tl flex items-center justify-center">
          <Ban className="w-2 h-2 text-muted-foreground" />
        </div>
      )}
    </div>
  );

  const text = (
    <div className="flex-1 min-w-0">
      <p className={`${isTight ? 'text-xs' : 'text-sm'} truncate leading-tight ${isCurrent ? 'text-primary font-medium' : 'text-foreground'}`}>
        {track.title}
      </p>
      <p className={`${isTight ? 'text-[10px]' : 'text-xs'} text-muted-foreground truncate leading-tight`}>{track.artist}</p>
    </div>
  );

  return (
    <div
      data-row={track.id}
      className={`relative ${isDragging ? 'z-10' : ''}`}
      style={{
        transform: !isDragging && shift ? `translateY(${shift * rowHeight}px)` : undefined,
        transition: animate && !isDragging ? 'transform 150ms ease' : undefined,
        contentVisibility: isDragging || moveOpen ? undefined : 'auto',
        containIntrinsicSize: `auto ${rowHeight}px`,
      }}
    >
      {editing ? (
        <div
          className={`flex items-center gap-1.5 pl-1 pr-1 ${
            isDragging ? 'bg-popover shadow-lg ring-1 ring-primary/40 rounded-md' : isCurrent ? 'bg-primary/10' : ''
          }`}
          style={{ height: rowHeight }}
        >
          <button
            type="button"
            onClick={() => onRemove(track)}
            aria-label={`Remove ${track.title} from playlist`}
            className="shrink-0 w-10 h-11 flex items-center justify-center text-destructive"
          >
            <MinusCircle className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleMove(track.id)}
            aria-label={`Position ${index + 1} of ${count}. Move ${track.title} to a position`}
            aria-expanded={moveOpen}
            className={`shrink-0 min-w-[30px] h-8 px-1.5 rounded-md text-[11px] font-mono tabular-nums border transition-colors ${
              moveOpen ? 'bg-primary/15 text-primary border-primary' : 'bg-muted text-muted-foreground border-transparent'
            }`}
          >
            {index + 1}
          </button>
          {cover}
          {text}
          <button
            type="button"
            aria-label={`Reorder ${track.title}. Drag, or use the arrow keys`}
            onPointerDown={(e) => onHandleDown(e, track.id, index)}
            onPointerMove={onHandleMove}
            onPointerUp={(e) => onHandleEnd(e, true)}
            onPointerCancel={(e) => onHandleEnd(e, false)}
            onKeyDown={(e) => {
              // stopPropagation: the player's global shortcuts also bind the
              // arrow keys (skip release) and must not fire while reordering.
              if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); onMoveTo(track.id, index - 1); }
              if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); onMoveTo(track.id, index + 1); }
            }}
            className="shrink-0 w-10 h-11 flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing select-none"
            style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
          >
            <GripVertical className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onTap(track)}
          disabled={isNonWorking}
          className={`w-full flex items-center gap-2.5 pl-4 pr-3 text-left transition-colors ${
            isCurrent ? 'bg-primary/10 border-l-2 border-primary' : isNonWorking ? 'opacity-50' : 'hover:bg-muted/50'
          }`}
          style={{ minHeight: rowHeight }}
        >
          <span className="w-5 text-center shrink-0 text-[10px] text-muted-foreground tabular-nums">
            {isCurrent ? <span className="text-primary text-base leading-none">•</span> : index + 1}
          </span>
          {cover}
          {text}
          <span className="shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground/80" title="Running set length">
            {clock}
          </span>
        </button>
      )}

      {editing && moveOpen && (
        <form
          onSubmit={(e) => { e.preventDefault(); onMoveTo(track.id, target - 1); }}
          className="flex items-center gap-1.5 px-3 pb-2 pt-1 bg-muted/40"
        >
          <label className="text-[11px] text-muted-foreground shrink-0" htmlFor={`move-${track.id}`}>Move to</label>
          <input
            id={`move-${track.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={count}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="w-14 h-9 rounded-md bg-background border border-border px-2 text-sm text-center tabular-nums outline-none focus:border-primary"
          />
          <span className="text-[11px] text-muted-foreground shrink-0">of {count}</span>
          <button
            type="submit"
            className="h-9 px-3 rounded-md text-xs font-medium bg-primary text-primary-foreground"
          >
            Move
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => onMoveTo(track.id, 0)}
            disabled={index === 0}
            aria-label="Move to top"
            className="w-9 h-9 flex items-center justify-center rounded-md bg-muted text-muted-foreground disabled:opacity-40"
          >
            <ArrowUpToLine className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMoveTo(track.id, count - 1)}
            disabled={index === count - 1}
            aria-label="Move to end"
            className="w-9 h-9 flex items-center justify-center rounded-md bg-muted text-muted-foreground disabled:opacity-40"
          >
            <ArrowDownToLine className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
});

export function PlaylistEditor({
  playlist, tracks, library, isActive, currentTrackId, isTight,
  onBack, onPlay, onRename, onMove, onSetTracks, onAdd, onRemove, onDelete, showUndo,
}: PlaylistEditorProps) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nameDraft, setNameDraft] = useState(playlist.name);
  const [moveOpenId, setMoveOpenId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; from: number; to: number } | null>(null);

  const rowHeight = isTight ? ROW_H_TIGHT : ROW_H;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    id: string; from: number; to: number; startY: number; startScroll: number;
    pointerY: number; el: HTMLElement; raf: number | null;
  } | null>(null);

  // Latest values for handlers that must stay referentially stable (rows are
  // memoized; a 500-track playlist should not re-render on every pointermove).
  const live = useRef({ tracks, trackIds: playlist.trackIds, rowHeight });
  live.current = { tracks, trackIds: playlist.trackIds, rowHeight };

  useEffect(() => { setNameDraft(playlist.name); }, [playlist.name]);

  const commitName = useCallback(() => {
    const name = nameDraft.trim();
    if (name && name !== playlist.name) onRename(name);
    else setNameDraft(playlist.name);
  }, [nameDraft, playlist.name, onRename]);

  // Running set length — where the clock stands when each track ends.
  const clocks = useMemo(() => {
    let total = 0;
    return tracks.map((t) => {
      total += t.duration || 0;
      return formatRuntime(total);
    });
  }, [tracks]);
  const totalSeconds = useMemo(() => tracks.reduce((s, t) => s + (t.duration || 0), 0), [tracks]);
  const unresolved = playlist.trackIds.length - tracks.length;

  const moveTo = useCallback((trackId: string, toIndex: number) => {
    const { tracks: list, trackIds } = live.current;
    const from = list.findIndex((t) => t.id === trackId);
    const to = Math.max(0, Math.min(list.length - 1, toIndex));
    setMoveOpenId(null);
    if (from === -1 || from === to) return;
    const without = list.filter((t) => t.id !== trackId);
    onMove(trackId, without[to]?.id ?? null);
    showUndo(`Moved to position ${to + 1}`, () => onSetTracks(trackIds));
  }, [onMove, onSetTracks, showUndo]);

  const handleRemove = useCallback((track: Track) => {
    const { trackIds } = live.current;
    setMoveOpenId(null);
    onRemove(track.id);
    showUndo(`Removed “${track.title}”`, () => onSetTracks(trackIds));
  }, [onRemove, onSetTracks, showUndo]);

  const handleTap = useCallback((track: Track) => {
    onPlay({ startTrackId: track.id });
  }, [onPlay]);

  const toggleMove = useCallback((trackId: string) => {
    setMoveOpenId((prev) => (prev === trackId ? null : trackId));
  }, []);

  // ── Drag reorder ─────────────────────────────────────────────────────────
  const applyDrag = useCallback(() => {
    const d = dragRef.current;
    const sc = scrollRef.current;
    if (!d || !sc) return;
    const { tracks: list, rowHeight: h } = live.current;
    const raw = d.pointerY - d.startY + (sc.scrollTop - d.startScroll);
    const dy = Math.max(-d.from * h, Math.min((list.length - 1 - d.from) * h, raw));
    d.el.style.transform = `translateY(${dy}px)`;
    const to = Math.round((d.from * h + dy) / h);
    if (to !== d.to) {
      d.to = to;
      setDrag({ id: d.id, from: d.from, to });
    }
  }, []);

  const autoScroll = useCallback(() => {
    const d = dragRef.current;
    const sc = scrollRef.current;
    if (!d || !sc) return;
    const rect = sc.getBoundingClientRect();
    let v = 0;
    if (d.pointerY < rect.top + AUTOSCROLL_EDGE) v = -Math.ceil((rect.top + AUTOSCROLL_EDGE - d.pointerY) / 5);
    else if (d.pointerY > rect.bottom - AUTOSCROLL_EDGE) v = Math.ceil((d.pointerY - (rect.bottom - AUTOSCROLL_EDGE)) / 5);
    if (v) {
      sc.scrollTop += v;
      applyDrag();
    }
    d.raf = requestAnimationFrame(autoScroll);
  }, [applyDrag]);

  const onHandleDown = useCallback((e: React.PointerEvent<HTMLButtonElement>, trackId: string, index: number) => {
    const sc = scrollRef.current;
    const el = e.currentTarget.closest<HTMLElement>('[data-row]');
    if (!sc || !el || dragRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setMoveOpenId(null);
    dragRef.current = {
      id: trackId, from: index, to: index, startY: e.clientY, startScroll: sc.scrollTop,
      pointerY: e.clientY, el, raf: null,
    };
    setDrag({ id: trackId, from: index, to: index });
    dragRef.current.raf = requestAnimationFrame(autoScroll);
  }, [autoScroll]);

  const onHandleMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    d.pointerY = e.clientY;
    applyDrag();
  }, [applyDrag]);

  const onHandleEnd = useCallback((e: React.PointerEvent<HTMLButtonElement>, commit: boolean) => {
    const d = dragRef.current;
    if (!d) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (d.raf !== null) cancelAnimationFrame(d.raf);
    d.el.style.transform = '';
    dragRef.current = null;
    setDrag(null);
    if (commit && d.to !== d.from) moveTo(d.id, d.to);
  }, [moveTo]);

  // A drag in flight must not outlive the component (panel closed mid-drag).
  useEffect(() => () => {
    const d = dragRef.current;
    if (d && d.raf !== null) cancelAnimationFrame(d.raf);
    dragRef.current = null;
  }, []);

  const leaveEdit = () => {
    commitName();
    setMoveOpenId(null);
    setEditing(false);
  };

  if (adding) {
    return (
      <AddTracksPicker
        library={library}
        playlistName={playlist.name}
        trackIdsInPlaylist={playlist.trackIds}
        onAdd={onAdd}
        onRemove={onRemove}
        onDone={() => setAdding(false)}
        isTight={isTight}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Bar: back · Edit/Done */}
      <div className="flex items-center justify-between shrink-0 pl-1 pr-2 border-b border-border/60">
        <button
          type="button"
          onClick={() => { if (editing) commitName(); onBack(); }}
          className="flex items-center h-11 pr-3 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          Playlists
        </button>
        <button
          type="button"
          onClick={() => (editing ? leaveEdit() : setEditing(true))}
          className="h-11 px-3 text-sm font-medium text-primary"
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {/* Name + set length */}
      <div className="px-4 pt-2.5 pb-2 shrink-0">
        {editing ? (
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            aria-label="Playlist name"
            maxLength={80}
            className="w-full h-10 rounded-lg bg-muted/50 px-3 text-base font-bold outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <h3 className="font-sans text-base font-bold truncate leading-tight">{playlist.name}</h3>
        )}
        <p className="text-xs text-muted-foreground pt-1">
          {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
          {totalSeconds > 0 && <span> · set length {formatRuntime(totalSeconds)}</span>}
          {isActive && <span className="text-primary"> · playing</span>}
        </p>
        {unresolved > 0 && (
          <p className="text-[10px] text-muted-foreground/70 pt-0.5">
            {unresolved} more {unresolved === 1 ? 'is' : 'are'} not in the loaded library and will reappear when {unresolved === 1 ? 'it is' : 'they are'}.
          </p>
        )}
      </div>

      {/* Rows */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
            <p className="text-xs text-muted-foreground">
              {playlist.trackIds.length === 0 ? 'This playlist is empty' : 'None of these tracks are in the loaded library yet'}
            </p>
            <button
              type="button"
              onClick={() => { setEditing(true); setAdding(true); }}
              className="h-11 px-4 rounded-lg text-sm bg-primary/15 text-primary flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add tracks from library
            </button>
          </div>
        ) : (
          tracks.map((track, index) => {
            let shift = 0;
            if (drag && drag.id !== track.id) {
              if (drag.from < index && index <= drag.to) shift = -1;
              else if (drag.to <= index && index < drag.from) shift = 1;
            }
            return (
              <EditorRow
                key={track.id}
                track={track}
                index={index}
                count={tracks.length}
                rowHeight={rowHeight}
                isTight={isTight}
                editing={editing}
                isCurrent={isActive && track.id === currentTrackId}
                clock={clocks[index]}
                shift={shift}
                isDragging={drag?.id === track.id}
                animate={drag !== null}
                moveOpen={moveOpenId === track.id}
                onTap={handleTap}
                onRemove={handleRemove}
                onToggleMove={toggleMove}
                onMoveTo={moveTo}
                onHandleDown={onHandleDown}
                onHandleMove={onHandleMove}
                onHandleEnd={onHandleEnd}
              />
            );
          })
        )}
      </div>

      {/* Bottom bar — within thumb reach */}
      {tracks.length > 0 && (
        <div
          className="shrink-0 flex gap-2 p-3 border-t border-border"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex-1 h-11 rounded-lg text-sm font-medium bg-primary/15 text-primary flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add tracks from library
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete playlist ${playlist.name}`}
                className="w-11 h-11 rounded-lg bg-muted text-destructive flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onPlay()}
                className="flex-1 h-11 rounded-lg text-sm font-medium bg-primary text-primary-foreground flex items-center justify-center gap-1.5"
              >
                <Play className="w-4 h-4" /> Play in order
              </button>
              <button
                type="button"
                onClick={() => onPlay({ shuffle: true })}
                className="h-11 px-4 rounded-lg text-sm bg-muted text-foreground flex items-center justify-center gap-1.5"
              >
                <Shuffle className="w-4 h-4" /> Shuffle
              </button>
            </>
          )}
        </div>
      )}
      {tracks.length === 0 && editing && (
        <div className="shrink-0 flex justify-end p-3 border-t border-border">
          <button
            type="button"
            onClick={onDelete}
            className="h-11 px-4 rounded-lg text-sm bg-muted text-destructive flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" /> Delete playlist
          </button>
        </div>
      )}
    </div>
  );
}
