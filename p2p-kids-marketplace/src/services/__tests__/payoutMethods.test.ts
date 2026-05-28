/**
 * Unit Tests for Payout Methods Service
 * Module: MODULE-06-TRADE-FLOW-sellerpayouts.md
 * Task: PAY-003
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { supabase } from '../../config/supabase';
import {
  listPayoutMethods,
  createPayoutMethod,
  updatePayoutMethod,
  deletePayoutMethod,
  checkPayoutEligibility,
  formatPayoutMethodDisplay,
} from '../payoutMethods';
import type { SellerPayoutMethod } from '../../types/payout.types';

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

describe('PayoutMethods Service', () => {
  const mockUserId = 'user_123';
  const mockUser = { id: mockUserId, email: 'seller@example.com' };

  const mockPayoutMethod: SellerPayoutMethod = {
    id: 'method_1',
    user_id: mockUserId,
    method_type: 'paypal',
    is_primary: true,
    is_verified: true,
    stripe_account_id: null,
    stripe_onboarding_complete: false,
    stripe_payouts_enabled: false,
    paypal_email: 'seller@paypal.com',
    venmo_handle: null,
    venmo_phone_e164: null,
    bank_account_token: null,
    bank_account_last4: null,
    bank_routing_last4: null,
    bank_verification_status: null,
    created_at: '2025-12-28T00:00:00Z',
    updated_at: '2025-12-28T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authenticated user
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe('listPayoutMethods', () => {
    it('should return payout methods for authenticated user', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [mockPayoutMethod],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await listPayoutMethods();

      expect(result.methods).toEqual([mockPayoutMethod]);
      expect(result.primary_method).toEqual(mockPayoutMethod);
      expect(result.has_verified_method).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('seller_payout_methods');
    });

    it('should handle no methods gracefully', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await listPayoutMethods();

      expect(result.methods).toEqual([]);
      expect(result.primary_method).toBeNull();
      expect(result.has_verified_method).toBe(false);
    });

    it('should throw error when not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(listPayoutMethods()).rejects.toThrow('User not authenticated');
    });
  });

  describe('createPayoutMethod', () => {
    it('should create PayPal payout method successfully', async () => {
      const mockInsert = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockPayoutMethod, is_primary: false, is_verified: false },
          error: null,
        }),
      };

      // set_as_primary is false, so no unsetPrimaryMethod call should occur
      (supabase.from as jest.Mock).mockReturnValueOnce(mockInsert);

      const result = await createPayoutMethod({
        method_type: 'paypal',
        paypal_email: 'seller@paypal.com',
        set_as_primary: false,
      });

      expect(result.method_type).toBe('paypal');
      expect(result.paypal_email).toBe('seller@paypal.com');
    });

    it('should validate PayPal email format', async () => {
      await expect(
        createPayoutMethod({
          method_type: 'paypal',
          paypal_email: 'invalid-email',
        })
      ).rejects.toThrow('Invalid PayPal email format');
    });

    it('should validate Venmo handle requirement', async () => {
      await expect(
        createPayoutMethod({
          method_type: 'venmo',
        })
      ).rejects.toThrow('Venmo handle or phone number is required');
    });

    it('should validate E.164 phone format for Venmo', async () => {
      await expect(
        createPayoutMethod({
          method_type: 'venmo',
          venmo_phone_e164: '1234567890', // Missing +
        })
      ).rejects.toThrow('Invalid phone number format');
    });

    it('should create Stripe Connect method without account ID', async () => {
      const mockInsert = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockPayoutMethod, method_type: 'stripe_connect', stripe_account_id: null },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValueOnce(mockInsert);

      const result = await createPayoutMethod({
        method_type: 'stripe_connect',
      });

      expect(result.method_type).toBe('stripe_connect');
      expect(result.stripe_account_id).toBeNull();
    });
  });

  describe('updatePayoutMethod', () => {
    it('should update payout method successfully', async () => {
      const mockGet = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockPayoutMethod,
          error: null,
        }),
      };

      const mockUpdate = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockPayoutMethod, is_verified: true },
          error: null,
        }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(mockGet) // First call for getPayoutMethod
        .mockReturnValueOnce(mockUpdate); // Second call for update

      const result = await updatePayoutMethod({
        method_id: 'method_1',
        is_verified: true,
      });

      expect(result.is_verified).toBe(true);
    });

    it("should throw error when updating another user's method", async () => {
      const mockGet = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockPayoutMethod, user_id: 'other_user' },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockGet);

      await expect(
        updatePayoutMethod({
          method_id: 'method_1',
          is_verified: true,
        })
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('deletePayoutMethod', () => {
    it('should prevent deleting primary method', async () => {
      const mockGet = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockPayoutMethod, is_primary: true },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockGet);

      await expect(deletePayoutMethod('method_1')).rejects.toThrow(
        'Cannot delete primary payout method'
      );
    });

    it('should delete non-primary method successfully', async () => {
      const mockGet = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockPayoutMethod, is_primary: false },
          error: null,
        }),
      };

      const mockDelete = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValueOnce(mockGet).mockReturnValueOnce(mockDelete);

      await expect(deletePayoutMethod('method_1')).resolves.not.toThrow();
    });
  });

  describe('checkPayoutEligibility', () => {
    it('should return eligible when primary verified method exists', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [mockPayoutMethod],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await checkPayoutEligibility();

      expect(result.can_receive_payouts).toBe(true);
      expect(result.has_verified_method).toBe(true);
      expect(result.blocking_reason).toBeNull();
    });

    it('should return not eligible when no verified method', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [{ ...mockPayoutMethod, is_verified: false }],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const result = await checkPayoutEligibility();

      expect(result.can_receive_payouts).toBe(false);
      expect(result.has_verified_method).toBe(false);
      expect(result.blocking_reason).toBe('No verified payout method configured');
    });
  });

  describe('formatPayoutMethodDisplay', () => {
    it('should format PayPal method correctly', () => {
      const display = formatPayoutMethodDisplay(mockPayoutMethod);

      expect(display.label).toBe('PayPal (seller@paypal.com)');
      expect(display.status_message).toBe('Verified');
      expect(display.is_primary).toBe(true);
    });

    it('should format Stripe Connect method correctly', () => {
      const stripeMethod: SellerPayoutMethod = {
        ...mockPayoutMethod,
        method_type: 'stripe_connect',
        stripe_account_id: 'acct_1234567890',
        stripe_onboarding_complete: true,
        stripe_payouts_enabled: true,
        paypal_email: null,
      };

      const display = formatPayoutMethodDisplay(stripeMethod);

      expect(display.label).toBe('Stripe (acct_****7890)');
      expect(display.status_message).toBe('Verified & Active');
    });

    it('should show onboarding required for incomplete Stripe', () => {
      const stripeMethod: SellerPayoutMethod = {
        ...mockPayoutMethod,
        method_type: 'stripe_connect',
        stripe_account_id: null,
        stripe_onboarding_complete: false,
        stripe_payouts_enabled: false,
        is_verified: false,
        paypal_email: null,
      };

      const display = formatPayoutMethodDisplay(stripeMethod);

      expect(display.status_message).toBe('Onboarding required');
    });

    it('should format Venmo method correctly', () => {
      const venmoMethod: SellerPayoutMethod = {
        ...mockPayoutMethod,
        method_type: 'venmo',
        venmo_handle: '@johndoe',
        paypal_email: null,
      };

      const display = formatPayoutMethodDisplay(venmoMethod);

      expect(display.label).toBe('Venmo (@johndoe)');
    });

    it('should format bank account method correctly', () => {
      const bankMethod: SellerPayoutMethod = {
        ...mockPayoutMethod,
        method_type: 'bank_ach',
        bank_account_last4: '1234',
        paypal_email: null,
      };

      const display = formatPayoutMethodDisplay(bankMethod);

      expect(display.label).toBe('Bank Account (****1234)');
    });
  });
});
