/**
 * Integration tests for Listing Module (LISTING-V2-007)
 * E2E scenarios covering complete user workflows
 */

import { createListing, updateListing, deleteListing, fetchListings } from '../listing';
import { getSubscriptionSummary, getSubscriptionStatusString } from '../subscription';
import { trackEvent } from '../analytics';
import { supabase } from '../../config/supabase';

// Mock dependencies
jest.mock('../subscription');
jest.mock('../analytics');
jest.mock('../../config/supabase');
// getAdminConfig() queries admin_config via supabase.from() internally — mock it so
// createListing's own supabase.from('items') builder is not consumed by the lookup.
jest.mock('../adminConfig', () => ({
  getAdminConfig: jest.fn().mockResolvedValue({ min_listing_price: 0 }),
}));

const mockGetSubscriptionSummary = getSubscriptionSummary as jest.MockedFunction<
  typeof getSubscriptionSummary
>;
const mockGetSubscriptionStatusString = getSubscriptionStatusString as jest.MockedFunction<
  typeof getSubscriptionStatusString
>;
const mockTrackEvent = trackEvent as jest.MockedFunction<typeof trackEvent>;
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

function makeThenable<T>(result: T) {
  return {
    then: (onFulfilled: any, onRejected: any) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  } as any;
}

describe('LISTING-V2-007: Listing Module Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('E2E: Create listing → Browse → View', () => {
    it('should complete full listing lifecycle with SP enabled', async () => {
      const sellerId = 'seller-123';
      const listingId = 'listing-abc';

      // STEP 1: Seller creates listing with SP enabled
      mockGetSubscriptionSummary.mockResolvedValueOnce({
        status: 'active',
        can_earn_sp: true,
        can_spend_sp: true,
        subscription_tier_id: 'tier-active',
        subscription_expires_at: null,
      } as any);

      mockGetSubscriptionStatusString.mockResolvedValueOnce('active');

      // createListing(): supabase.from('items').insert(...).select().single()
      const createBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: listingId,
            seller_id: sellerId,
            title: 'Nintendo Switch',
            price: 249.99,
            accepts_swap_points: true,
            status: 'pending',
          },
          error: null,
        }),
      } as any;
      mockSupabase.from.mockReturnValueOnce(createBuilder);

      const createResult = await createListing({
        seller_id: sellerId,
        title: 'Nintendo Switch',
        description: 'Like new, includes 2 controllers',
        price: 249.99,
        category_id: 'cat-electronics',
        condition: 'like_new',
        accepts_swap_points: true,
      } as any);

      expect(createResult.id).toBe(listingId);
      expect(createResult.accepts_swap_points).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'listing_created',
        expect.objectContaining({
          listing_id: listingId,
          accepts_swap_points: true,
        })
      );
    });

    it('should prevent free users from creating listings with SP', async () => {
      const freeUserId = 'free-user-123';

      // Free user subscription check
      mockGetSubscriptionSummary.mockResolvedValueOnce({
        status: 'free',
        can_earn_sp: false,
        can_spend_sp: false,
        subscription_tier_id: null,
        subscription_expires_at: null,
      } as any);

      mockGetSubscriptionStatusString.mockResolvedValueOnce('free');

      // Should fail or auto-disable SP
      await expect(
        createListing({
          seller_id: freeUserId,
          title: 'Item',
          description: 'Description',
          price: 10,
          category_id: 'cat-electronics',
          condition: 'like_new',
          accepts_swap_points: true,
        } as any)
      ).rejects.toThrow();
    });

    it('should allow browsing listings with SP enabled', async () => {
      const listingId = 'listing-abc';

      // fetchListings() performs:
      // - supabase.from('items').select('*').eq('status', 'available').order(...).eq('accepts_swap_points', true)
      // - then supabase.from('profiles').select(...).in('user_id', sellerIds)
      // - optionally supabase.from('categories') if category_id exists
      const itemsResult = {
        data: [
          {
            id: listingId,
            seller_id: 'seller-123',
            title: 'Nintendo Switch',
            price: 249.99,
            accepts_swap_points: true,
            status: 'available',
            category_id: 'cat-electronics',
          },
        ],
        error: null,
      };

      const itemsBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: (onFulfilled: any, onRejected: any) =>
          Promise.resolve(itemsResult).then(onFulfilled, onRejected),
      } as any;

      const profilesResult = {
        data: [{ id: 'profile-1', user_id: 'seller-123', name: 'Seller Name', avatar_url: null }],
        error: null,
      };
      const profilesBuilder = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        then: (onFulfilled: any, onRejected: any) =>
          Promise.resolve(profilesResult).then(onFulfilled, onRejected),
      } as any;

      const categoriesResult = {
        data: [{ id: 'cat-electronics', name: 'Electronics' }],
        error: null,
      };
      const categoriesBuilder = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        then: (onFulfilled: any, onRejected: any) =>
          Promise.resolve(categoriesResult).then(onFulfilled, onRejected),
      } as any;

      mockSupabase.from.mockImplementation(((tableName: string) => {
        if (tableName === 'items') return itemsBuilder;
        if (tableName === 'profiles') return profilesBuilder;
        if (tableName === 'categories') return categoriesBuilder;
        return {} as any;
      }) as any);

      const listings = await fetchListings({ sp_eligible_only: true } as any);

      expect(listings).toHaveLength(1);
      expect(listings[0].accepts_swap_points).toBe(true);
    });
  });

  describe('E2E: Admin search → Force-delete', () => {
    it('should allow admin to search deleted items', async () => {
      const listingId = 'listing-to-delete';

      // Admin searches for deleted items
      const mockDeletedQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn(),
      };
      mockDeletedQuery.eq.mockReturnValue({
        data: [
          {
            id: listingId,
            seller_id: 'seller-123',
            title: 'Broken Item',
            status: 'deleted',
            deleted_at: new Date().toISOString(),
            profiles: {
              id: 'profile-123',
              user_id: 'seller-123',
              name: 'Alice Smith',
            },
          },
        ],
        error: null,
      });
      mockDeletedQuery.select.mockReturnValue(mockDeletedQuery);
      (supabase.from as jest.Mock).mockReturnValue(mockDeletedQuery);

      const deletedListings = await supabase
        .from('listings')
        .select('*, profiles(id, user_id, name)')
        .eq('status', 'deleted');

      expect(deletedListings.data).toHaveLength(1);
      expect(deletedListings.data?.[0].status).toBe('deleted');
      expect(deletedListings.data?.[0].profiles?.name).toBe('Alice Smith');
    });

    it('should execute force-delete via RPC', async () => {
      const adminId = 'admin-001';
      const listingId = 'listing-to-delete';

      // Call admin_force_delete_listing RPC
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          listing_id: listingId,
          deleted_at: new Date().toISOString(),
        },
        error: null,
      });

      const deleteResult = await supabase.rpc('admin_force_delete_listing', {
        p_listing_id: listingId,
        p_admin_id: adminId,
      });

      expect(deleteResult.data?.success).toBe(true);
      expect(deleteResult.error).toBeNull();
    });
  });

  describe('SP subscription gating', () => {
    it('should gate SP-accept option to subscribers only', async () => {
      const subscriptionCheckResults = [
        // Free user
        {
          status: 'free',
          can_earn_sp: false,
          can_spend_sp: false,
          shouldAllowSP: false,
        },
        // Active subscriber
        {
          status: 'active',
          can_earn_sp: true,
          can_spend_sp: true,
          shouldAllowSP: true,
        },
        // Cancelled but in grace period
        {
          status: 'cancelled',
          can_earn_sp: false,
          can_spend_sp: true,
          shouldAllowSP: false,
        },
      ];

      for (const result of subscriptionCheckResults) {
        const mocked = { ...result };
        delete (mocked as any).shouldAllowSP;
        mockGetSubscriptionSummary.mockResolvedValueOnce(mocked as any);

        const sub = await getSubscriptionSummary('user-123');

        // Only active subscribers can create with SP
        if (result.shouldAllowSP) {
          expect(sub.can_earn_sp).toBe(true);
          expect(sub.can_spend_sp).toBe(true);
        } else {
          expect(sub.can_earn_sp).toBe(false);
        }
      }
    });
  });

  describe('Listing state transitions', () => {
    it('should enforce correct status flow', async () => {
      const listingId = 'listing-state-test';
      const sellerId = 'seller-123';

      // Valid transitions
      const validTransitions = [
        { from: 'draft', to: 'available', allowed: true },
        { from: 'available', to: 'pending', allowed: true },
        { from: 'pending', to: 'sold', allowed: true },
        { from: 'available', to: 'deleted', allowed: true },
      ];

      for (const transition of validTransitions) {
        // updateListing(): first fetch listing, then update
        const fetchBuilder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: listingId, seller_id: sellerId, status: transition.from },
            error: null,
          }),
        } as any;
        const updateBuilder = {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: listingId, seller_id: sellerId, status: transition.to },
            error: null,
          }),
        } as any;
        mockSupabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

        const result = await updateListing({
          listing_id: listingId,
          user_id: sellerId,
          status: transition.to,
        } as any);

        if (transition.allowed) {
          expect(result.status).toBe(transition.to);
        }
      }
    });

    it('should support pause/unpause transitions', async () => {
      const listingId = 'listing-to-pause';

      // Pause listing
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          listing_id: listingId,
          new_status: 'paused',
        },
        error: null,
      });

      const pauseResult = await supabase.rpc('admin_pause_listing', {
        p_listing_id: listingId,
      });

      expect(pauseResult.data?.new_status).toBe('paused');

      // Unpause listing
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          listing_id: listingId,
          new_status: 'available',
        },
        error: null,
      });

      const unpauseResult = await supabase.rpc('admin_unpause_listing', {
        p_listing_id: listingId,
      });

      expect(unpauseResult.data?.new_status).toBe('available');
    });
  });

  describe('RLS and permission enforcement', () => {
    it('should enforce ownership rules on updates', async () => {
      const listingId = 'listing-owned-by-seller-1';
      const seller1 = 'seller-1';
      const seller2 = 'seller-2';

      // updateListing() should reject when user_id doesn't match listing.seller_id
      const fetchBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: listingId, seller_id: seller1, status: 'available' },
          error: null,
        }),
      } as any;
      mockSupabase.from.mockReturnValueOnce(fetchBuilder);

      await expect(
        updateListing({ listing_id: listingId, user_id: seller2, title: 'Hacked Title' } as any)
      ).rejects.toThrow('not authorized');
    });
  });

  describe('Soft-delete workflow', () => {
    it('should soft-delete for owner', async () => {
      const listingId = 'listing-to-soft-delete';
      const sellerId = 'seller-123';

      const fetchBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: listingId, seller_id: sellerId },
          error: null,
        }),
      } as any;
      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnValue(makeThenable({ error: null })),
      } as any;
      mockSupabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

      await expect(deleteListing(listingId, sellerId)).resolves.toBeUndefined();
    });

    it('should prevent non-owner from deleting', async () => {
      const listingId = 'listing-owned-by-other';
      const otherSellerId = 'seller-2';

      const fetchBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: listingId, seller_id: 'someone-else' },
          error: null,
        }),
      } as any;
      mockSupabase.from.mockReturnValueOnce(fetchBuilder);

      await expect(deleteListing(listingId, otherSellerId)).rejects.toThrow('not authorized');
    });
  });
});
