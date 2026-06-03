import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Music, ShoppingCart, Disc3, Copy } from 'lucide-react';
import { Crate, DiscogsRelease } from '@/types/extension';
import { useCrates } from '@/hooks/useCrates';

const CRATE_COLORS = ['#06b6d4', '#8b5cf6', '#f97316', '#22c55e', '#ec4899', '#eab308'];

interface CratesViewProps {
  onPlayRelease?: (release: DiscogsRelease) => void;
  onAddToCart?: (cartId: string, release: DiscogsRelease) => void;
  currentRelease?: DiscogsRelease | null;
}

export function CratesView({ onPlayRelease, onAddToCart, currentRelease }: CratesViewProps) {
  const { crates, loading, createCrate, renameCrate, deleteCrate, removeReleaseFromCrate, removeDuplicatesFromCrate, addReleaseToCrate } = useCrates();
  const [selectedCrate, setSelectedCrate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newCrateName, setNewCrateName] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedColor, setSelectedColor] = useState(CRATE_COLORS[0]);

  const activeCrate = crates.find(c => c.id === selectedCrate);

  const handleCreate = async () => {
    if (!newCrateName.trim()) return;
    await createCrate(newCrateName.trim(), selectedColor);
    setNewCrateName('');
    setAdding(false);
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    await renameCrate(id, editName.trim());
    setEditingId(null);
  };

  const handleAddCurrentToCrate = async (crateId: string) => {
    if (!currentRelease) return;
    await addReleaseToCrate(crateId, currentRelease);
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading crates…</div>;

  if (selectedCrate && activeCrate) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
          <button onClick={() => setSelectedCrate(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: activeCrate.color || CRATE_COLORS[0] }}
          />
          <h3 className="font-semibold text-sm flex-1 truncate">{activeCrate.name}</h3>
          <span className="text-xs text-muted-foreground">{activeCrate.releases.length} releases</span>
          <button
            onClick={() => removeDuplicatesFromCrate(activeCrate.id)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            title="Remove duplicates"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        {currentRelease && (
          <div className="px-3 py-2 bg-primary/5 border-b border-border/20 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Disc3 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground truncate">Current: {currentRelease.title}</span>
            </div>
            <button
              onClick={() => handleAddCurrentToCrate(activeCrate.id)}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {activeCrate.releases.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <Disc3 className="w-8 h-8 opacity-30" />
              <p className="text-xs">Crate is empty</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {activeCrate.releases.map(release => (
                <div key={release.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/20 group">
                  <img
                    src={release.coverUrl || '/placeholder.svg'}
                    alt={release.title}
                    className="w-9 h-9 rounded object-cover shrink-0 border border-border/20"
                    onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{release.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{release.artist} {release.year > 0 ? `• ${release.year}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onPlayRelease && (
                      <button onClick={() => onPlayRelease(release)} className="p-1 text-primary hover:text-primary/80">
                        <Music className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onAddToCart && (
                      <button onClick={() => onAddToCart('', release)} className="p-1 text-muted-foreground hover:text-foreground">
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => removeReleaseFromCrate(activeCrate.id, release.id)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
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
        <h2 className="font-semibold text-sm">Crates</h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
        >
          <Plus className="w-3.5 h-3.5" />
          New Crate
        </button>
      </div>

      {adding && (
        <div className="px-3 py-2 border-b border-border/40 bg-secondary/10">
          <input
            autoFocus
            type="text"
            value={newCrateName}
            onChange={e => setNewCrateName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Crate name…"
            className="w-full bg-secondary/40 border border-border/40 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/60 mb-2"
          />
          <div className="flex items-center gap-1.5 mb-2">
            {CRATE_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                className="w-4 h-4 rounded-full transition-transform"
                style={{
                  background: c,
                  transform: selectedColor === c ? 'scale(1.3)' : 'scale(1)',
                  boxShadow: selectedColor === c ? `0 0 6px ${c}80` : 'none',
                }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex-1 text-xs bg-primary text-primary-foreground rounded py-1">Create</button>
            <button onClick={() => setAdding(false)} className="flex-1 text-xs bg-secondary text-foreground rounded py-1">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {crates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <Disc3 className="w-10 h-10 opacity-20" />
            <p className="text-xs">No crates yet</p>
            <p className="text-[10px] opacity-60">Create crates to organise releases</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {crates.map(crate => (
              <div key={crate.id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary/20 group cursor-pointer"
                onClick={() => setSelectedCrate(crate.id)}
              >
                <div
                  className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                  style={{ background: `${crate.color || CRATE_COLORS[0]}20`, border: `1px solid ${crate.color || CRATE_COLORS[0]}40` }}
                >
                  <Disc3 className="w-4 h-4" style={{ color: crate.color || CRATE_COLORS[0] }} />
                </div>

                <div className="flex-1 min-w-0">
                  {editingId === crate.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleRename(crate.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      className="w-full bg-secondary/40 border border-primary/40 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                    />
                  ) : (
                    <>
                      <p className="text-xs font-medium truncate">{crate.name}</p>
                      <p className="text-[10px] text-muted-foreground">{crate.releases.length} releases</p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  {editingId === crate.id ? (
                    <>
                      <button onClick={() => handleRename(crate.id)} className="p-1 text-primary"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(crate.id); setEditName(crate.name); }} className="p-1 text-muted-foreground hover:text-foreground">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {currentRelease && (
                        <button onClick={() => handleAddCurrentToCrate(crate.id)} className="p-1 text-primary hover:text-primary/80" title="Add current release">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => deleteCrate(crate.id)} className="p-1 text-muted-foreground hover:text-destructive">
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
