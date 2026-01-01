/**
 * Payout Contracts - Shared types for seller payout operations
 * File: supabase/functions/_shared/contracts/payouts.ts
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// ==================== ENUMS & CONSTANTS ====================

export const PayoutMethodTypeSchema = z.enum([
  'stripe_connect',
  'paypal',
  'venmo',
  'bank_ach'
]);

export type PayoutMethodType = z.infer<typeof PayoutMethodTypeSchema>;

export const PayoutStatusSchema = z.enum([
  'requires_action',
  'pending',
  'processing',
  'completed',
  'failed'
]);

export type PayoutStatus = z.infer<typeof PayoutStatusSchema>;

export const PayoutProviderSchema = z.enum(['stripe', 'paypal', 'ach']);
export type PayoutProvider = z.infer<typeof PayoutProviderSchema>;

// ==================== STRIPE CONNECT ====================

export const CreateStripeConnectAccountRequestSchema = z.object({
  userId: z.string().uuid()
});

export type CreateStripeConnectAccountRequest = z.infer<typeof CreateStripeConnectAccountRequestSchema>;

export const CreateStripeConnectAccountResponseSchema = z.object({
  success: z.boolean(),
  methodId: z.string().uuid(),
  stripeAccountId: z.string(),
  error: z.string().optional()
});

export type CreateStripeConnectAccountResponse = z.infer<typeof CreateStripeConnectAccountResponseSchema>;

export const CreateStripeAccountLinkRequestSchema = z.object({
  userId: z.string().uuid(),
  methodId: z.string().uuid(),
  returnUrl: z.string().url(),
  refreshUrl: z.string().url()
});

export type CreateStripeAccountLinkRequest = z.infer<typeof CreateStripeAccountLinkRequestSchema>;

export const CreateStripeAccountLinkResponseSchema = z.object({
  success: z.boolean(),
  url: z.string().url().optional(),
  error: z.string().optional()
});

export type CreateStripeAccountLinkResponse = z.infer<typeof CreateStripeAccountLinkResponseSchema>;

export const SyncStripeConnectStatusRequestSchema = z.object({
  methodId: z.string().uuid().optional(),
});

export type SyncStripeConnectStatusRequest = z.infer<typeof SyncStripeConnectStatusRequestSchema>;

export const SyncStripeConnectStatusResponseSchema = z.object({
  success: z.boolean(),
  syncedMethods: z
    .array(
      z.object({
        methodId: z.string().uuid(),
        stripeAccountId: z.string(),
        detailsSubmitted: z.boolean(),
        payoutsEnabled: z.boolean(),
        chargesEnabled: z.boolean(),
        stripeOnboardingComplete: z.boolean(),
        stripePayoutsEnabled: z.boolean(),
        isVerified: z.boolean(),
      })
    )
    .optional(),
  error: z.string().optional(),
});

export type SyncStripeConnectStatusResponse = z.infer<typeof SyncStripeConnectStatusResponseSchema>;

// ==================== PAYPAL/VENMO ====================

export const ProcessPayPalPayoutRequestSchema = z.object({
  payoutId: z.string().uuid(),
  idempotencyKey: z.string().optional()
});

export type ProcessPayPalPayoutRequest = z.infer<typeof ProcessPayPalPayoutRequestSchema>;

export const ProcessPayPalPayoutResponseSchema = z.object({
  success: z.boolean(),
  payoutId: z.string().uuid(),
  batchId: z.string().optional(),
  status: PayoutStatusSchema,
  error: z.string().optional()
});

export type ProcessPayPalPayoutResponse = z.infer<typeof ProcessPayPalPayoutResponseSchema>;

// ==================== PAYOUT METHOD MANAGEMENT ====================

export const AddPayoutMethodRequestSchema = z.object({
  userId: z.string().uuid(),
  methodType: PayoutMethodTypeSchema,
  paypalEmail: z.string().email().optional(),
  venmoHandle: z.string().optional(),
  venmoPhoneE164: z.string().regex(/^\+[1-9]\d{1,14}$/).optional()
});

export type AddPayoutMethodRequest = z.infer<typeof AddPayoutMethodRequestSchema>;

export const AddPayoutMethodResponseSchema = z.object({
  success: z.boolean(),
  methodId: z.string().uuid().optional(),
  error: z.string().optional()
});

export type AddPayoutMethodResponse = z.infer<typeof AddPayoutMethodResponseSchema>;

export const SetPrimaryPayoutMethodRequestSchema = z.object({
  userId: z.string().uuid(),
  methodId: z.string().uuid()
});

export type SetPrimaryPayoutMethodRequest = z.infer<typeof SetPrimaryPayoutMethodRequestSchema>;

// ==================== DATABASE TYPES ====================

export interface SellerPayoutMethod {
  id: string;
  user_id: string;
  method_type: PayoutMethodType;
  is_primary: boolean;
  is_verified: boolean;
  
  // Stripe Connect
  stripe_account_id?: string;
  stripe_onboarding_complete: boolean;
  stripe_payouts_enabled: boolean;
  
  // PayPal/Venmo
  paypal_email?: string;
  venmo_handle?: string;
  venmo_phone_e164?: string;
  
  // Bank ACH (Post-MVP)
  bank_account_token?: string;
  bank_account_last4?: string;
  bank_routing_last4?: string;
  bank_verification_status?: string;
  
  created_at: string;
  updated_at: string;
}

export interface SellerPayout {
  id: string;
  user_id: string;
  trade_id?: string;
  payout_method_id?: string;
  currency: string;
  gross_amount: number;
  platform_fee: number;
  payout_fee: number;
  net_amount: number;
  status: PayoutStatus;
  provider?: PayoutProvider;
  provider_reference_id?: string;
  idempotency_key?: string;
  initiated_at?: string;
  completed_at?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}
