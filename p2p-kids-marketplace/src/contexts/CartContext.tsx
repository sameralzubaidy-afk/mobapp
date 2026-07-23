/**
 * File: p2p-kids-marketplace/src/contexts/CartContext.tsx
 * Persistent cart count context — provides a live cart item count to the
 * PersistentTabBar (and any other consumer) without each screen needing to
 * fetch it independently.
 *
 * Usage:
 *   <CartProvider>
 *     <RestOfApp />
 *   </CartProvider>
 *
 *   const { cartCount, refreshCartCount } = useCartContext();
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/config/supabase';
import { getCartItems } from '@/services/cartService';
import { AuthContext } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartContextValue {
  /** Number of items currently in the active cart (0 if empty or loading). */
  cartCount: number;
  /** Force a refetch from the server. Use on pull-to-refresh or after mutations. */
  refreshCartCount: () => Promise<void>;
  /** True during the initial fetch. */
  loading: boolean;
}

const CartContext = createContext<CartContextValue>({
  cartCount: 0,
  refreshCartCount: async () => {},
  loading: true,
});

export const useCartContext = () => useContext(CartContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);
  const realtimeSub = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { session } = useContext(AuthContext);

  // ── Fetch cart count ──────────────────────────────────────────────────────────
  const refreshCartCount = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCartCount(0);
        return;
      }
      userIdRef.current = user.id;

      const result = await getCartItems();
      if (result.success) {
        setCartCount(result.data.items.length);
      } else {
        // Silent fail — cart count stays at previous value
        console.warn('[CartContext] getCartItems failed:', result.error?.code);
      }
    } catch (err) {
      console.warn('[CartContext] refreshCartCount error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Subscribe to realtime cart changes ────────────────────────────────────────
  const subscribeToCart = useCallback(async () => {
    // Clean up previous subscription
    if (realtimeSub.current) {
      await supabase.removeChannel(realtimeSub.current);
      realtimeSub.current = null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    userIdRef.current = user.id;

    // Subscribe to changes in cart_items for this user
    const channel = supabase
      .channel('cart-count-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cart_items',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Any change (insert/update/delete) — refetch count
          void refreshCartCount();
        },
      )
      .subscribe((status: string) => {
        if (status !== 'SUBSCRIBED') {
          console.warn('[CartContext] Realtime subscription status:', status);
        }
      });

    realtimeSub.current = channel;
  }, [refreshCartCount]);

  // ── Initial fetch + realtime subscription ────────────────────────────────────
  // Depends on session?.user?.id so it re-fetches when auth state changes
  // (e.g., CartProvider mounts before session is restored on app startup).
  useEffect(() => {
    void refreshCartCount();
    void subscribeToCart();

    return () => {
      if (realtimeSub.current) {
        supabase.removeChannel(realtimeSub.current).catch(() => {});
        realtimeSub.current = null;
      }
    };
  }, [session?.user?.id, refreshCartCount, subscribeToCart]);

  // ── Refresh on app foreground ────────────────────────────────────────────────
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Re-subscribe may be needed after background
        void subscribeToCart();
        void refreshCartCount();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [subscribeToCart, refreshCartCount]);

  return (
    <CartContext.Provider value={{ cartCount, refreshCartCount, loading }}>
      {children}
    </CartContext.Provider>
  );
}

export default CartProvider;
