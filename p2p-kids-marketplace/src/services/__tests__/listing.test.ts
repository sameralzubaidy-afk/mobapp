/**
 * File: p2p-kids-marketplace/src/services/__tests__/listing.test.ts
 * MODULE-04 LISTING-V2: Unit tests for listing service
 * 
 * Tests:
 * - LISTING-V2-002: Create listing with SP payment preference
 * - LISTING-V2-003: Edit and delete listing with V2 rules
 */

import { createListing, updateListing, deleteListing } from '../listing';
import { getSubscriptionSummary } from '../subscription';
import { supabase } from '../../config/supabase';
import { trackEvent } from '../analytics';

// Mock dependencies
jest.mock('../../config/supabase');
jest.mock('../subscription');
jest.mock('../analytics');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockGetSubscriptionSummary = getSubscriptionSummary as jest.MockedFunction<typeof getSubscriptionSummary>;
const mockTrackEvent = trackEvent as jest.MockedFunction<typeof trackEvent>;

describe('listing service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createListing', () => {
    it('should create listing with SP payment for active subscriber', async () => {
      // Mock: User is active subscriber
      mockGetSubscriptionSummary.mockResolvedValue({
        status: 'active',
        can_earn_sp: true,
        can_spend_sp: true,
        subscription_tier_id: 'tier-123',
        subscription_expires_at: null,
      });

      // Mock: Supabase insert success
      const mockListing = {
        id: 'listing-123',
        seller_id: 'user-123',
        title: 'LEGO Set',
        description: 'Like new LEGO',
        price: 29.99,
        category_id: 'cat-toys',
        condition: 'like_new',
        status: 'pending',
        accepts_swap_points: true,
        seller_subscription_status_at_creation: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sold_at: null,
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockListing,
              error: null,
            }),
          }),
        }),
      });

      const result = await createListing({
        seller_id: 'user-123',
        title: 'LEGO Set',
        description: 'Like new LEGO',
        price: 29.99,
        category_id: 'cat-toys',
        condition: 'like_new',
        accepts_swap_points: true,
      });

      expect(result).toEqual(mockListing);
      expect(mockGetSubscriptionSummary).toHaveBeenCalledWith('user-123');
      expect(mockTrackEvent).toHaveBeenCalledWith('listing_created', expect.objectContaining({
        listing_id: 'listing-123',
        accepts_swap_points: true,
      }));
    });

    it('should reject SP payment for non-subscriber', async () => {
      // Mock: User is NOT a subscriber
      mockGetSubscriptionSummary.mockResolvedValue({
        status: 'none',
        can_earn_sp: false,
        can_spend_sp: false,
        subscription_tier_id: null,
        subscription_expires_at: null,
      });

      await expect(
        createListing({
          seller_id: 'user-456',
          title: 'LEGO Set',
          description: 'Like new LEGO',
          price: 29.99,
          condition: 'like_new',
          accepts_swap_points: true, // Non-subscriber trying to enable SP
        })
      ).rejects.toThrow('Only Kids Club+ subscribers can accept Swap Points');
    });

    it('should reject invalid price', async () => {
      await expect(
        createListing({
          seller_id: 'user-123',
          title: 'LEGO Set',
          description: 'Like new LEGO',
          price: 0, // Invalid: must be > 0
          condition: 'like_new',
          accepts_swap_points: false,
        })
      ).rejects.toThrow('Price must be greater than $0');
    });

    it('should reject invalid title length', async () => {
      await expect(
        createListing({
          seller_id: 'user-123',
          title: 'Ab', // Invalid: too short (< 3 chars)
          description: 'Test',
          price: 10,
          condition: 'like_new',
          accepts_swap_points: false,
        })
      ).rejects.toThrow('Title must be between 3 and 100 characters');
    });
  });

  describe('updateListing', () => {
    it('should update listing for owner', async () => {
      // Mock: Fetch listing (ownership check)
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'listing-123',
                seller_id: 'user-123',
                title: 'Old Title',
              },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'listing-123',
                  seller_id: 'user-123',
                  title: 'New Title',
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await updateListing({
        listing_id: 'listing-123',
        user_id: 'user-123',
        title: 'New Title',
      });

      expect(result.title).toBe('New Title');
      expect(mockTrackEvent).toHaveBeenCalledWith('listing_updated', expect.objectContaining({
        listing_id: 'listing-123',
      }));
    });

    it('should reject update from non-owner', async () => {
      // Mock: Fetch listing (different seller)
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'listing-123',
                seller_id: 'user-123', // Owner
              },
              error: null,
            }),
          }),
        }),
      });

      await expect(
        updateListing({
          listing_id: 'listing-123',
          user_id: 'user-456', // Different user (not owner)
          title: 'Hacked Title',
        })
      ).rejects.toThrow('You are not authorized to edit this listing');
    });

    it('should auto-transition needs_edits listing back to pending when seller edits fields', async () => {
      const fetchBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'listing-123',
            seller_id: 'user-123',
            status: 'needs_edits',
            title: 'Old Title',
          },
          error: null,
        }),
      } as any;

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'listing-123',
            seller_id: 'user-123',
            status: 'pending',
            title: 'New Title',
          },
          error: null,
        }),
      } as any;

      mockSupabase.from.mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

      const result = await updateListing({
        listing_id: 'listing-123',
        user_id: 'user-123',
        title: 'New Title',
      });

      expect(result.status).toBe('pending');
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          flagged_at: null,
          edited_since_rejection: false,
          edited_since_rejection_at: null,
        })
      );
    });

    it('should re-validate subscription when toggling SP', async () => {
      // Mock: Fetch listing
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'listing-123',
                seller_id: 'user-123',
                accepts_swap_points: false,
              },
              error: null,
            }),
          }),
        }),
      });

      // Mock: User is now a non-subscriber
      mockGetSubscriptionSummary.mockResolvedValue({
        status: 'expired',
        can_earn_sp: false,
        can_spend_sp: false,
        subscription_tier_id: null,
        subscription_expires_at: null,
      });

      await expect(
        updateListing({
          listing_id: 'listing-123',
          user_id: 'user-123',
          accepts_swap_points: true, // Trying to enable SP with expired subscription
        })
      ).rejects.toThrow('Only Kids Club+ subscribers can accept Swap Points');
    });
  });

  describe('deleteListing', () => {
    it('should soft-delete listing for owner', async () => {
      // Mock: Fetch listing
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'listing-123',
                seller_id: 'user-123',
                status: 'available',
              },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      await deleteListing('listing-123', 'user-123');

      // Verify soft delete (update to status='deleted')
      expect(mockSupabase.from).toHaveBeenCalledWith('items');
      expect(mockTrackEvent).toHaveBeenCalledWith('listing_deleted', expect.objectContaining({
        listing_id: 'listing-123',
      }));
    });

    it('should reject delete from non-owner', async () => {
      // Mock: Fetch listing
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'listing-123',
                seller_id: 'user-123', // Owner
                status: 'available',
              },
              error: null,
            }),
          }),
        }),
      });

      await expect(
        deleteListing('listing-123', 'user-456') // Different user (not owner)
      ).rejects.toThrow('You are not authorized to delete this listing');
    });
  });
});
