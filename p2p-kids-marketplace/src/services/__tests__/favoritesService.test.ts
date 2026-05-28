/**
 * File: p2p-kids-marketplace/src/services/__tests__/favoritesService.test.ts
 * MODULE-15.2 CART-019: Unit tests for favoritesService.
 */

import { addFavorite, removeFavorite, getFavorites, isFavorited, toggleFavorite } from '../favoritesService';

const mockRpc = jest.fn();

jest.mock('@/config/supabase', () => ({
  supabase: { rpc: (fn: string, params?: unknown) => mockRpc(fn, params) },
}));

beforeEach(() => jest.clearAllMocks());

function ok<T>(data: T) {
  return { data: { success: true, data }, error: null };
}
function fail(code: string, message: string) {
  return { data: { success: false, error: { code, message } }, error: null };
}

describe('favoritesService.addFavorite', () => {
  it('calls rpc_favorites_add with p_listing_id', async () => {
    mockRpc.mockResolvedValueOnce(ok({ favorite_id: 'F-1' }));
    const r = await addFavorite('L-9');
    expect(mockRpc).toHaveBeenCalledWith('rpc_favorites_add', { p_listing_id: 'L-9' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.favoriteId).toBe('F-1');
  });

  it('surfaces ALREADY_FAVORITED', async () => {
    mockRpc.mockResolvedValueOnce(fail('ALREADY_FAVORITED', 'Already favorited'));
    const r = await addFavorite('L-9');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('ALREADY_FAVORITED');
  });
});

describe('favoritesService.removeFavorite', () => {
  it('returns removed=true when RPC reports 1', async () => {
    mockRpc.mockResolvedValueOnce(ok({ removed: 1 }));
    const r = await removeFavorite('L-9');
    expect(mockRpc).toHaveBeenCalledWith('rpc_favorites_remove', { p_listing_id: 'L-9' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.removed).toBe(true);
  });

  it('returns removed=false when RPC reports 0', async () => {
    mockRpc.mockResolvedValueOnce(ok({ removed: 0 }));
    const r = await removeFavorite('L-9');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.removed).toBe(false);
  });
});

describe('favoritesService.getFavorites', () => {
  it('maps RPC rows to Favorite[]', async () => {
    mockRpc.mockResolvedValueOnce(
      ok({
        favorites: [
          {
            favorite_id: 'F-1', listing_id: 'L-1', created_at: '2026-05-28T00:00:00Z',
            title: 'Trike', price_cents: 4500, status: 'available',
            accepts_swap_points: true, seller_id: 'S-1', seller_name: 'Alice',
            image_url: 'http://img/1.jpg',
          },
        ],
      }),
    );
    const r = await getFavorites();
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toHaveLength(1);
    expect(r.data[0]).toMatchObject({
      favoriteId: 'F-1', listingId: 'L-1', title: 'Trike', priceCents: 4500, acceptsSP: true,
    });
  });

  it('returns empty list when payload has no favorites array', async () => {
    mockRpc.mockResolvedValueOnce(ok({ favorites: [] }));
    const r = await getFavorites();
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual([]);
  });
});

describe('favoritesService.isFavorited', () => {
  it('returns true when listing in favorites', async () => {
    mockRpc.mockResolvedValueOnce(
      ok({
        favorites: [{
          favorite_id: 'F-1', listing_id: 'L-1', created_at: '', title: '',
          price_cents: 0, status: 'available', accepts_swap_points: false,
          seller_id: 'S', seller_name: null, image_url: null,
        }],
      }),
    );
    expect(await isFavorited('L-1')).toBe(true);
  });

  it('returns false when not present', async () => {
    mockRpc.mockResolvedValueOnce(ok({ favorites: [] }));
    expect(await isFavorited('L-99')).toBe(false);
  });

  it('returns false when RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await isFavorited('L-1')).toBe(false);
  });
});

describe('favoritesService.toggleFavorite', () => {
  it('calls addFavorite when isCurrentlyFavorited=false', async () => {
    mockRpc.mockResolvedValueOnce(ok({ favorite_id: 'F-new' }));
    const r = await toggleFavorite('L-5', false);
    expect(mockRpc).toHaveBeenCalledWith('rpc_favorites_add', { p_listing_id: 'L-5' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.favoriteId).toBe('F-new');
  });

  it('calls removeFavorite when isCurrentlyFavorited=true', async () => {
    mockRpc.mockResolvedValueOnce(ok({ removed: 1 }));
    const r = await toggleFavorite('L-5', true);
    expect(mockRpc).toHaveBeenCalledWith('rpc_favorites_remove', { p_listing_id: 'L-5' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.removed).toBe(true);
  });

  it('surfaces RPC error during toggle', async () => {
    mockRpc.mockResolvedValueOnce(fail('RPC_FAILED', 'boom'));
    const r = await toggleFavorite('L-5', false);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('RPC_FAILED');
  });
});
