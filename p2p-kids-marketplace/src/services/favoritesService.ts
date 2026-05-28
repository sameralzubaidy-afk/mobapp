/**
 * File: p2p-kids-marketplace/src/services/favoritesService.ts
 * MODULE-15.2 CART-015..017: Favorites service — wraps rpc_favorites_* RPCs.
 */

import { supabase } from '@/config/supabase';

export interface Favorite {
  favoriteId: string;
  listingId: string;
  createdAt: string;
  title: string;
  priceCents: number;
  status: string;
  acceptsSP: boolean;
  sellerId: string;
  sellerName: string | null;
  imageUrl: string | null;
}

export type FavResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };

function unwrap<T>(data: unknown, fn: string): FavResult<T> {
  const p = data as { success?: boolean; data?: T; error?: { code: string; message: string } } | null;
  if (!p) return { success: false, error: { code: 'EMPTY_RESPONSE', message: `${fn} returned no payload` } };
  if (p.success) return { success: true, data: p.data as T };
  return { success: false, error: p.error ?? { code: 'UNKNOWN_RPC_ERROR', message: `${fn} failed` } };
}

export async function addFavorite(listingId: string): Promise<FavResult<{ favoriteId: string }>> {
  const { data, error } = await supabase.rpc('rpc_favorites_add', { p_listing_id: listingId });
  if (error) return { success: false, error: { code: 'RPC_FAILED', message: error.message } };
  const w = unwrap<{ favorite_id: string }>(data, 'rpc_favorites_add');
  if (!w.success) return w;
  return { success: true, data: { favoriteId: w.data.favorite_id } };
}

export async function removeFavorite(listingId: string): Promise<FavResult<{ removed: boolean }>> {
  const { data, error } = await supabase.rpc('rpc_favorites_remove', { p_listing_id: listingId });
  if (error) return { success: false, error: { code: 'RPC_FAILED', message: error.message } };
  const w = unwrap<{ removed: number }>(data, 'rpc_favorites_remove');
  if (!w.success) return w;
  return { success: true, data: { removed: w.data.removed > 0 } };
}

export async function getFavorites(): Promise<FavResult<Favorite[]>> {
  const { data, error } = await supabase.rpc('rpc_favorites_get');
  if (error) return { success: false, error: { code: 'RPC_FAILED', message: error.message } };
  const w = unwrap<{ favorites: Record<string, unknown>[] }>(data, 'rpc_favorites_get');
  if (!w.success) return w;
  const favorites: Favorite[] = (w.data.favorites ?? []).map((r) => ({
    favoriteId: r['favorite_id'] as string,
    listingId:  r['listing_id'] as string,
    createdAt:  r['created_at'] as string,
    title:      r['title'] as string,
    priceCents: (r['price_cents'] as number) ?? 0,
    status:     r['status'] as string,
    acceptsSP:  r['accepts_swap_points'] as boolean,
    sellerId:   r['seller_id'] as string,
    sellerName: (r['seller_name'] as string) ?? null,
    imageUrl:   (r['image_url'] as string) ?? null,
  }));
  return { success: true, data: favorites };
}

export async function isFavorited(listingId: string): Promise<boolean> {
  const r = await getFavorites();
  if (!r.success) return false;
  return r.data.some((f) => f.listingId === listingId);
}

// CART-012: Toggle helper — adds if not favorited, removes if already favorited
export async function toggleFavorite(
  listingId: string,
  isCurrentlyFavorited: boolean,
): Promise<FavResult<{ favoriteId?: string; removed?: boolean }>> {
  if (isCurrentlyFavorited) {
    const r = await removeFavorite(listingId);
    if (!r.success) return r;
    return { success: true, data: { removed: r.data.removed } };
  }
  const r = await addFavorite(listingId);
  if (!r.success) return r;
  return { success: true, data: { favoriteId: r.data.favoriteId } };
}
