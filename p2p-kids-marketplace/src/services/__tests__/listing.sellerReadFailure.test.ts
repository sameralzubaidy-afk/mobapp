// File: src/services/__tests__/listing.sellerReadFailure.test.ts
// FIX-Task-27 item 4 (2026-09-13) — the `seller_read_failure` QA toggle.
//
// Item Detail reads the seller in a SECOND query (`getListingById`). FIX-Task-26
// item 4 made a failure there explicit (`seller: null` + `sellerLoadFailed: true`)
// so the screen can offer a retry card instead of silently deleting the whole
// Seller Info section — but the happy path was all QA could produce, because the
// failure branch needed a real gateway/RLS failure (QA F11 stayed unit-test-only).
//
// This pins the toggle's wiring: armed, the seller read is SKIPPED (no request)
// and the flag the screen keys off is set; disarmed, the read runs normally.

import { supabase } from '@/config/supabase';
import { getListingById } from '../listing';
import { setQaLocalValue, QA_SELLER_READ_FAILURE_KEY } from '../devTestingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/config/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('@/services/subscription', () => ({
  getSubscriptionSummary: jest.fn(),
  getSubscriptionStatusString: jest.fn(),
}));
jest.mock('@/services/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/services/adminConfig', () => ({ getAdminConfig: jest.fn(async () => null) }));
jest.mock('@/services/supabase/storage', () => ({
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
}));
jest.mock('@/services/safety', () => ({
  checkItemSafety: jest.fn(),
  isCpscCheckEnabled: jest.fn(async () => false),
}));
jest.mock('@/services/imageModeration', () => ({
  isImageModerationEnabled: jest.fn(async () => false),
  moderateListingImages: jest.fn(),
}));

const mockSupabase = supabase as unknown as { from: jest.Mock };

const ITEM = {
  id: 'listing-1',
  seller_id: 'seller-1',
  status: 'available',
  category_id: null,
  title: 'Bike',
};
const SELLER = { id: 'seller-1', name: 'Sara', avatar_url: null };

const buildChain = (single: unknown, awaited: unknown) => {
  const chain: any = {};
  for (const method of ['select', 'eq', 'neq', 'in', 'or', 'order', 'limit', 'range']) {
    chain[method] = () => chain;
  }
  chain.single = () => Promise.resolve({ data: single, error: null });
  chain.maybeSingle = () => Promise.resolve({ data: single, error: null });
  chain.then = (resolve: any) => Promise.resolve({ data: awaited, error: null }).then(resolve);
  return chain;
};

const mockTables = () => {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'items') return buildChain(ITEM, null);
    if (table === 'profiles') return buildChain(SELLER, null);
    if (table === 'item_images') return buildChain([], []);
    return buildChain(null, []);
  });
};

const calledTables = () => mockSupabase.from.mock.calls.map((c) => c[0]);

describe('getListingById — qa seller_read_failure toggle (FIX-Task-27 item 4)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockTables();
  });

  it('disarmed: reads the seller normally (baseline for the armed case)', async () => {
    await setQaLocalValue(QA_SELLER_READ_FAILURE_KEY, 'none');

    const listing = await getListingById('listing-1');

    expect(calledTables()).toContain('profiles');
    expect(listing?.seller).toEqual(SELLER);
    expect((listing as { sellerLoadFailed?: boolean })?.sellerLoadFailed).toBe(false);
  });

  it('armed: skips the seller read and raises the flag the retry card keys off', async () => {
    await setQaLocalValue(QA_SELLER_READ_FAILURE_KEY, 'read_failure');

    const listing = await getListingById('listing-1');

    // No request at all — the failure is injected before the query.
    expect(calledTables()).not.toContain('profiles');
    expect(listing?.seller).toBeNull();
    expect((listing as { sellerLoadFailed?: boolean })?.sellerLoadFailed).toBe(true);
    // The listing itself still loads, so the screen renders the card next to the
    // rest of the item rather than failing the whole page.
    expect(listing?.id).toBe('listing-1');
  });
});
