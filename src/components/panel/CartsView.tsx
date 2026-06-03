import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, ShoppingCart, ExternalLink, TrendingDown, Users } from 'lucide-react';
import { Cart, CartItem, DiscogsRelease } from '@/types/extension';
import { useCarts } from '@/hooks/useCarts';
import { useMarketplace } from '@/hooks/useMarketplace';

interface CartsViewProps {
  currentRelease?: DiscogsRelease | null;
}

export function CartsView({ currentRelease }: CartsViewProps) {
  const { carts, loading, createCart, renameCart, deleteCart, addToCart, removeFromCart, clearCart, getCartTotal } = useCarts();
  const { getMarketplaceStats, openMarketplacePage, loading: mktLoading } = useMarketplace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [statuses, setStatuses] = useState<Map<number, { lowestPrice: number | null; numForSale: number }>>(new Map());

  const activeCart = carts.find(c => c.id === selectedId);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const cart = await createCart(newName.trim());
    setNewName('');
    setAdding(false);
    setSelectedId(cart.id);
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    await renameCart(id, editName.trim());
    setEditingId(null);
  };

  const addCurrentToCart = async (cartId: string) => {
    if (!currentRelease) return;
    await addToCart(cartId, {
      releaseId: currentRelease.id,
      title: currentRelease.title,
      artist: currentRelease.artist,
      year: currentRelease.year,
      coverUrl: currentRelease.coverUrl,
    });
  };

  const loadStats = async (item: CartItem) => {
    if (statuses.has(item.releaseId)) return;
    const stats = await getMarketplaceStats(item.releaseId);
    if (stats) {
      setStatuses(prev => new Map(prev).set(item.releaseId, {
        lowestPrice: stats.lowestPrice,
        numForSale: stats.numForSale,
      }));
    }
  };

  const loadAllStats = async (cart: Cart) => {
    await Promise.all(cart.items.map(loadStats));
  };

  const estimateTotal = (cart: Cart) => {
    let total = 0;
    let known = 0;
    cart.items.forEach(item => {
      const s = statuses.get(item.releaseId);
      if (s?.lowestPrice) { total += s.lowestPrice; known++; }
    });
    return { total, known, missing: cart.items.length - known };
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;

  if (selectedId && activeCart) {
    const est = estimateTotal(activeCart);

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
          <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
          <ShoppingCart className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm flex-1 truncate">{activeCart.name}</h3>
          <span className="text-xs text-muted-foreground">{activeCart.items.length} items</span>
          <button
            onClick={() => loadAllStats(activeCart)}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
            disabled={mktLoading}
          >
            <TrendingDown className="w-3 h-3" />
            Prices
          </button>
        </div>

        {currentRelease && (
          <div className="px-3 py-2 bg-primary/5 border-b border-border/20 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground truncate">Current: {currentRelease.title}</span>
            <button
              onClick={() => addCurrentToCart(activeCart.id)}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
        )}

        {est.known > 0 && (
          <div className="px-3 py-1.5 bg-secondary/20 border-b border-border/20 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Est. total ({est.known}/{activeCart.items.length} priced)
            </span>
            <span className="text-xs font-bold text-primary">
              ${est.total.toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {activeCart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <ShoppingCart className="w-8 h-8 opacity-30" />
              <p className="text-xs">Cart is empty</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {activeCart.items.map(item => {
                const stats = statuses.get(item.releaseId);
                return (
                  <div key={item.releaseId} className="flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/20 group">
                    <img
                      src={item.coverUrl || '/placeholder.svg'}
                      alt={item.title}
                      className="w-9 h-9 rounded object-cover shrink-0 border border-border/20"
                      onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{item.artist}</p>
                      {stats ? (
                        <p className="text-[9px] text-primary">
                          {stats.numForSale > 0 ? `${stats.numForSale} for sale • from $${stats.lowestPrice?.toFixed(2) || '?'}` : 'Not for sale'}
                        </p>
                      ) : (
                        <button
                          onClick={() => loadStats(item)}
                          className="text-[9px] text-muted-foreground/60 hover:text-primary"
                        >
                          Check price
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openMarketplacePage(item.releaseId)}
                        className="p-1 text-primary hover:text-primary/80"
                        title="View on Discogs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeFromCart(activeCart.id, item.releaseId)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {activeCart.items.length > 0 && (
          <div className="border-t border-border/40 px-3 py-2 flex gap-2">
            <button
              onClick={() => openMarketplacePage(activeCart.items[0]?.releaseId)}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-primary text-primary-foreground rounded py-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              Shop on Discogs
            </button>
            <button
              onClick={() => clearCart(activeCart.id)}
              className="px-3 text-xs text-muted-foreground hover:text-destructive border border-border/40 rounded py-1.5"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <h2 className="font-semibold text-sm">Carts</h2>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
          <Plus className="w-3.5 h-3.5" />
          New Cart
        </button>
      </div>

      {adding && (
        <div className="px-3 py-2 border-b border-border/40 bg-secondary/10">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Cart name…"
            className="w-full bg-secondary/40 border border-border/40 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/60 mb-2"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex-1 text-xs bg-primary text-primary-foreground rounded py-1">Create</button>
            <button onClick={() => setAdding(false)} className="flex-1 text-xs bg-secondary text-foreground rounded py-1">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {carts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <ShoppingCart className="w-10 h-10 opacity-20" />
            <p className="text-xs">No carts yet</p>
            <p className="text-[10px] opacity-60">Create carts to track releases to buy</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {carts.map(cart => (
              <div
                key={cart.id}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary/20 group cursor-pointer"
                onClick={() => setSelectedId(cart.id)}
              >
                <div className="w-8 h-8 rounded bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  {editingId === cart.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleRename(cart.id); if (e.key === 'Escape') setEditingId(null); }}
                      onClick={e => e.stopPropagation()}
                      className="w-full bg-secondary/40 border border-primary/40 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                    />
                  ) : (
                    <>
                      <p className="text-xs font-medium truncate">{cart.name}</p>
                      <p className="text-[10px] text-muted-foreground">{cart.items.length} items</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  {currentRelease && (
                    <button onClick={() => addCurrentToCart(cart.id)} className="p-1 text-primary hover:text-primary/80">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => { setEditingId(cart.id); setEditName(cart.name); }} className="p-1 text-muted-foreground hover:text-foreground">
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button onClick={() => deleteCart(cart.id)} className="p-1 text-muted-foreground hover:text-destructive">
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
