import { useState, useEffect, useCallback } from 'react';
import { Cart, CartItem, SellerSummary } from '@/types/extension';
import { dbGetAll, dbSet, dbDelete } from '@/lib/db';

function newId() {
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useCarts() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dbGetAll<Cart>('carts').then(all => {
      setCarts(all.sort((a, b) => b.updatedAt - a.updatedAt));
      setLoading(false);
    });
  }, []);

  const createCart = useCallback(async (name: string): Promise<Cart> => {
    const cart: Cart = {
      id: newId(),
      name,
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await dbSet('carts', cart);
    setCarts(prev => [cart, ...prev]);
    return cart;
  }, []);

  const renameCart = useCallback(async (id: string, name: string) => {
    setCarts(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, name, updatedAt: Date.now() } : c);
      const cart = updated.find(c => c.id === id);
      if (cart) dbSet('carts', cart);
      return updated;
    });
  }, []);

  const deleteCart = useCallback(async (id: string) => {
    await dbDelete('carts', id);
    setCarts(prev => prev.filter(c => c.id !== id));
  }, []);

  const addToCart = useCallback(async (cartId: string, item: Omit<CartItem, 'addedAt'>) => {
    setCarts(prev => {
      const updated = prev.map(c => {
        if (c.id !== cartId) return c;
        const already = c.items.some(i => i.releaseId === item.releaseId);
        if (already) return c;
        const newItem: CartItem = { ...item, addedAt: Date.now() };
        const updatedCart = { ...c, items: [...c.items, newItem], updatedAt: Date.now() };
        dbSet('carts', updatedCart);
        return updatedCart;
      });
      return updated;
    });
  }, []);

  const removeFromCart = useCallback(async (cartId: string, releaseId: number) => {
    setCarts(prev => {
      const updated = prev.map(c => {
        if (c.id !== cartId) return c;
        const updatedCart = { ...c, items: c.items.filter(i => i.releaseId !== releaseId), updatedAt: Date.now() };
        dbSet('carts', updatedCart);
        return updatedCart;
      });
      return updated;
    });
  }, []);

  const clearCart = useCallback(async (cartId: string) => {
    setCarts(prev => {
      const updated = prev.map(c => {
        if (c.id !== cartId) return c;
        const updatedCart = { ...c, items: [], updatedAt: Date.now() };
        dbSet('carts', updatedCart);
        return updatedCart;
      });
      return updated;
    });
  }, []);

  const getCartTotal = useCallback((cart: Cart): number => {
    return cart.items.reduce((sum, item) => sum + (item.price || 0), 0);
  }, []);

  const analyzeSellerCoverage = useCallback((cart: Cart, listings: Map<number, { seller: string; price: number }[]>): SellerSummary[] => {
    const sellerMap = new Map<string, SellerSummary>();

    cart.items.forEach(item => {
      const itemListings = listings.get(item.releaseId) || [];
      itemListings.forEach(listing => {
        if (!sellerMap.has(listing.seller)) {
          sellerMap.set(listing.seller, {
            seller: listing.seller,
            itemsAvailable: 0,
            releases: [],
            estimatedTotal: 0,
            listings: [],
          });
        }
        const summary = sellerMap.get(listing.seller)!;
        if (!summary.releases.includes(item.releaseId)) {
          summary.releases.push(item.releaseId);
          summary.itemsAvailable += 1;
          summary.estimatedTotal += listing.price;
        }
      });
    });

    return Array.from(sellerMap.values())
      .sort((a, b) => b.itemsAvailable - a.itemsAvailable || a.estimatedTotal - b.estimatedTotal);
  }, []);

  return {
    carts,
    loading,
    createCart,
    renameCart,
    deleteCart,
    addToCart,
    removeFromCart,
    clearCart,
    getCartTotal,
    analyzeSellerCoverage,
  };
}
