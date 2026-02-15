/**
 * File: supabase/functions/_shared/contracts/subscriptions.ts
 * MODULE-11 TASK SUB-002: Zod Schemas for Subscription RPCs
 */

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// get_subscription_status
export const SubscriptionStatusSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  tier_id: z.string().uuid(),
  status: z.enum(['trial', 'active', 'paused', 'grace_period', 'expired', 'cancelled']),
  stripe_subscription_id: z.string().nullable(),
  trial_start_date: z.string().nullable(),
  trial_end_date: z.string().nullable(),
  has_used_trial: z.boolean(),
  auto_renew_enabled: z.boolean(),
  payment_retry_count: z.number().int(),
  grace_ends_at: z.string().nullable(),
});

export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

// record_payment_attempt
export const RecordPaymentAttemptInputSchema = z.object({
  p_user_id: z.string().uuid(),
  p_success: z.boolean(),
  p_amount: z.number().int().optional(),
  p_charge_id: z.string().optional(),
});

export const RecordPaymentAttemptOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  payment_succeeded: z.boolean().optional(),
  payment_failed: z.boolean().optional(),
  retry_count: z.number().int().optional(),
  retry_count_reset: z.boolean().optional(),
  max_retries_reached: z.boolean().optional(),
});

// update_subscription_status
export const UpdateSubscriptionStatusInputSchema = z.object({
  p_user_id: z.string().uuid(),
  p_status: z.enum(['trial', 'active', 'paused', 'grace_period', 'expired', 'cancelled']).optional(),
  p_tier_id: z.string().uuid().optional(),
  p_stripe_subscription_id: z.string().optional(),
  p_has_used_trial: z.boolean().optional(),
  p_auto_renew_enabled: z.boolean().optional(),
  p_payment_retry_count: z.number().int().optional(),
  p_grace_started_at: z.string().optional(),
  p_grace_ends_at: z.string().optional(),
  p_cancelled_at: z.string().optional(),
  p_cancel_reason: z.string().optional(),
  p_next_billing_date: z.string().optional(),
  p_last_payment_date: z.string().optional(),
  p_last_payment_amount: z.number().int().optional(),
});
