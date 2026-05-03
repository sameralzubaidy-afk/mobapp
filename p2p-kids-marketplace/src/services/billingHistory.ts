// File: p2p-kids-marketplace/src/services/billingHistory.ts
// SUB-014: Billing History Service

import { supabase } from '../config/supabase';
import type {
  BillingHistory,
  CreateBillingHistoryParams,
  BillingHistoryFilters,
  BillingHistorySummary,
  BillingStatus,
} from '../types/billingHistory.types';

/**
 * Get billing history for a user
 * @param filters - Optional filters (user_id, subscription_id, status, date range, limit)
 * @returns Array of billing history records
 */
export async function getBillingHistory(filters: BillingHistoryFilters): Promise<BillingHistory[]> {
  try {
    let query = supabase
      .from('billing_history')
      .select('*')
      .order('charged_at', { ascending: false });

    // Apply filters
    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters.subscription_id) {
      query = query.eq('subscription_id', filters.subscription_id);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.start_date) {
      query = query.gte('charged_at', filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte('charged_at', filters.end_date);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getBillingHistory] Error fetching billing history:', error);
      throw new Error(`Failed to fetch billing history: ${error.message}`);
    }

    return data || [];
  } catch (err) {
    console.error('[getBillingHistory] Unexpected error:', err);
    throw err;
  }
}

/**
 * Get a single billing record by charge_id
 * @param charge_id - Stripe charge ID
 * @returns Billing history record or null
 */
export async function getBillingRecordByChargeId(
  charge_id: string
): Promise<BillingHistory | null> {
  try {
    const { data, error } = await supabase
      .from('billing_history')
      .select('*')
      .eq('charge_id', charge_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('[getBillingRecordByChargeId] Error fetching record:', error);
      throw new Error(`Failed to fetch billing record: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error('[getBillingRecordByChargeId] Unexpected error:', err);
    throw err;
  }
}

/**
 * Create a billing history record (typically called by webhooks/service role)
 * NOTE: This requires service role permissions in production
 * @param params - Billing record parameters
 * @returns Created billing history record
 */
export async function createBillingRecord(
  params: CreateBillingHistoryParams
): Promise<BillingHistory> {
  try {
    const { data, error } = await supabase
      .from('billing_history')
      .insert({
        user_id: params.user_id,
        subscription_id: params.subscription_id,
        charge_id: params.charge_id,
        stripe_invoice_id: params.stripe_invoice_id || null,
        amount: params.amount,
        currency: params.currency || 'usd',
        status: params.status,
        charged_at: params.charged_at || new Date().toISOString(),
        description: params.description || null,
        error_message: params.error_message || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[createBillingRecord] Error creating billing record:', error);
      throw new Error(`Failed to create billing record: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error('[createBillingRecord] Unexpected error:', err);
    throw err;
  }
}

/**
 * Update billing record status (e.g., from pending to succeeded/failed)
 * NOTE: Typically called by webhooks/service role
 * @param charge_id - Stripe charge ID
 * @param status - New status
 * @param error_message - Optional error message if failed
 * @returns Updated billing record
 */
export async function updateBillingRecordStatus(
  charge_id: string,
  status: BillingStatus,
  error_message?: string
): Promise<BillingHistory> {
  try {
    const updateData: { status: BillingStatus; error_message?: string | null } = { status };

    if (error_message) {
      updateData.error_message = error_message;
    }

    const { data, error } = await supabase
      .from('billing_history')
      .update(updateData)
      .eq('charge_id', charge_id)
      .select()
      .single();

    if (error) {
      console.error('[updateBillingRecordStatus] Error updating billing record:', error);
      throw new Error(`Failed to update billing record: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error('[updateBillingRecordStatus] Unexpected error:', err);
    throw err;
  }
}

/**
 * Get billing summary for a user (totals, counts, most recent charge)
 * @param user_id - User ID
 * @returns Billing summary statistics
 */
export async function getBillingHistorySummary(user_id: string): Promise<BillingHistorySummary> {
  try {
    // Fetch all billing records for user
    const records = await getBillingHistory({ user_id });

    // Calculate summary statistics
    const summary: BillingHistorySummary = {
      total_charges: records.length,
      successful_charges: records.filter((r) => r.status === 'succeeded').length,
      failed_charges: records.filter((r) => r.status === 'failed').length,
      refunded_charges: records.filter((r) => r.status === 'refunded').length,
      total_amount_cents: records
        .filter((r) => r.status === 'succeeded')
        .reduce((sum, r) => sum + r.amount, 0),
      total_refunded_cents: records
        .filter((r) => r.status === 'refunded')
        .reduce((sum, r) => sum + r.amount, 0),
      most_recent_charge: records.length > 0 ? records[0] : null,
    };

    return summary;
  } catch (err) {
    console.error('[getBillingHistorySummary] Unexpected error:', err);
    throw err;
  }
}

/**
 * Get recent billing history for a user (last N records)
 * @param user_id - User ID
 * @param limit - Number of records to return (default: 10)
 * @returns Recent billing history records
 */
export async function getRecentBillingHistory(
  user_id: string,
  limit: number = 10
): Promise<BillingHistory[]> {
  return getBillingHistory({ user_id, limit });
}
