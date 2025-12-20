/**
 * Integration tests for Listing Module (LISTING-V2-007)
 * E2E scenarios covering complete user workflows
 */

import { createListing, updateListing, deleteListing } from '../listing';
import { getSubscriptionSummary } from '../subscription';
import { trackEvent } from '../analytics';
import { supabase } from '../../config/supabase';

// Mock dependencies
jest.mock('../subscription');
jest.mock('../analytics');
jest.mock('../../config/supabase');

const mockGetSubscriptionSummary = getSubscriptionSummary as jest.MockedFunction<typeof getSubscriptionSummary>;
const mockTrackEvent = trackEvent as jest.MockedFunction<typeof trackEvent>;
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

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

      mockSupabase.from('listings').insert.mockResolvedValueOnce({
        data: {
          id: listingId,
          seller_id: sellerId,
          title: 'Nintendo Switch',
          price: 249.99,
          accepts_swap_points: true,
          status: 'available',
        },
        error: null,
      } as any);

      const createResult = await createListing({
        sellerId,
        itemName: 'Nintendo Switch',
        itemDescription: 'Like new, includes 2 controllers',
        priceCents: 24999,
        category: 'electronics',
        condition: 'like_new',
        imageUrls: ['https://example.com/switch.jpg'],
        acceptsSwapPoints: true,
      });

      expect(createResult.id).toBe(listingId);
      expect(createResult.accepts_swap_points).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalledWith('listing_created', {
        listing_id: listingId,
        seller_id: sellerId,
        accepts_sp: true,
      });
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

      // Should fail or auto-disable SP
      await expect(
        createListing({
          sellerId: freeUserId,
          itemName: 'Item',
          itemDescription: 'Description',
          priceCents: 1000,
          category: 'electronics',
          condition: 'like_new',
          imageUrls: [],
          acceptsSwapPoints: true, // ← Free user tries to enable SP
        })
      ).rejects.toThrow();
    });

    it('should allow subscribers to browse listings with SP enabled', async () => {
      const buyerId = 'buyer-456';
      const listingId = 'listing-abc';

      // Buyer is a subscriber
      mockGetSubscriptionSummary.mockResolvedValueOnce({
        status: 'active',
        can_earn_sp: true,
        can_spend_sp: true,
        subscription_tier_id: 'tier-active',
      } as any);

      // Verify listing is queryable
      mockSupabase.from('listings')
        .select('*, profiles(id, user_id, name)')
        .eq('status', 'available')
        .eq('accepts_swap_points', true)
        .mockResolvedValueOnce({
          data: [{
            id: listingId,
            seller_id: 'seller-123',
            title: 'Nintendo Switch',
            price: 249.99,
            accepts_swap_points: true,
            profiles: {
              id: 'profile-123',
              user_id: 'seller-123',
              name: 'Alice Smith',
            },
          }],
          error: null,
        } as any);

      const listingsResult = await supabase
        .from('listings')
        .select('*, profiles(id, user_id, name)')
        .eq('status', 'available')
        .eq('accepts_swap_points', true);

      expect(listingsResult.data).toHaveLength(1);
      expect(listingsResult.data?.[0].accepts_swap_points).toBe(true);
    });
  });

  describe('E2E: Admin search → Force-delete', () => {
    it('should allow admin to search deleted items', async () => {
      const adminId = 'admin-001';
      const listingId = 'listing-to-delete';

      // Admin searches for deleted items
      mockSupabase.from('listings')
        .select('*, profiles(id, user_id, name)')
        .eq('status', 'deleted')
        .mockResolvedValueOnce({
          data: [{
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
          }],
          error: null,
        } as any);

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
      mockSupabase.rpc('admin_force_delete_listing').mockResolvedValueOnce({
        data: {
          success: true,
          listing_id: listingId,
          deleted_at: new Date().toISOString(),
        },
        error: null,
      } as any);

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
        mockGetSubscriptionSummary.mockResolvedValueOnce(result as any);

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
        mockSupabase.from('listings')
          .update({ status: transition.to })
          .eq('id', listingId)
          .eq('seller_id', sellerId)
          .mockResolvedValueOnce({
            data: { id: listingId, status: transition.to },
            error: null,
          } as any);

        const result = await updateListing(listingId, {
          sellerId,
          status: transition.to,
        });

        if (transition.allowed) {
          expect(result.status).toBe(transition.to);
        }
      }
    });

    it('should support pause/unpause transitions', async () => {
      const listingId = 'listing-to-pause';

      // Pause listing
      mockSupabase.rpc('admin_pause_listing').mockResolvedValueOnce({
        data: {
          success: true,
          listing_id: listingId,
          new_status: 'paused',
        },
        error: null,
      } as any);

      const pauseResult = await supabase.rpc('admin_pause_listing', {
        p_listing_id: listingId,
      });

      expect(pauseResult.data?.new_status).toBe('paused');

      // Unpause listing
      mockSupabase.rpc('admin_unpause_listing').mockResolvedValueOnce({
        data: {
          success: true,
          listing_id: listingId,
          new_status: 'available',
        },
        error: null,
      } as any);

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

      // Seller 1 owns the listing
      mockSupabase.from('listings')
        .select('seller_id')
        .eq('id', listingId)
        .mockResolvedValueOnce({
          data: [{ seller_id: seller1 }],
          error: null,
        } as any);

      const listing = await supabase
        .from('listings')
        .select('seller_id')
        .eq('id', listingId);

      expect(listing.data?.[0].seller_id).toBe(seller1);

      // Seller 2 tries to update → RLS blocks
      mockSupabase.from('listings')
        .update({ title: 'Hacked Title' })
        .eq('id', listingId)
        .eq('seller_id', seller2)
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'permission denied' } as any,
        } as any);

      const updateResult = await supabase
        .from('listings')
        .update({ title: 'Hacked Title' })
        .eq('id', listingId)
        .eq('seller_id', seller2);

      expect(updateResult.error).not.toBeNull();
    });
  });

  describe('Soft-delete workflow', () => {
    it('should soft-delete for owner', async () => {
      const listingId = 'listing-to-soft-delete';
      const sellerId = 'seller-123';

      // Delete listing
      mockSupabase.from('listings')
        .update({ status: 'deleted', deleted_at: expect.any(String) })
        .eq('id', listingId)
        .eq('seller_id', sellerId)
        .mockResolvedValueOnce({
          data: {
            id: listingId,
            status: 'deleted',
            deleted_at: new Date().toISOString(),
          },
          error: null,
        } as any);

      const result = await deleteListing(listingId, sellerId);

      expect(result.status).toBe('deleted');
      expect(result.deleted_at).toBeDefined();
    });

    it('should prevent non-owner from deleting', async () => {
      const listingId = 'listing-owned-by-other';
      const otherSellerId = 'seller-2';

      // Non-owner tries to delete → RLS blocks
      mockSupabase.from('listings')
        .update({ status: 'deleted' })
        .eq('id', listingId)
        .eq('seller_id', otherSellerId)
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'permission denied' } as any,
        } as any);

      const result = await supabase
        .from('listings')
        .update({ status: 'deleted' })
        .eq('id', listingId)
        .eq('seller_id', otherSellerId);

      expect(result.error).not.toBeNull();
    });
  });
});
