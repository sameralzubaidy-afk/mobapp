/**
 * File: p2p-kids-marketplace/src/services/waitlist.ts
 * NODE-003: Waitlist Management for Inactive ZIPs
 *
 * Handles:
 * - Adding users to ZIP waitlist when they request inactive area
 * - Tracking waitlist status
 * - Analytics event tracking
 * - RLS-compliant operations (users only access own entries)
 */

import { supabase } from './supabase/client';
import { trackEvent } from './analytics';

/**
 * Result of waitlist opt-in
 */
export type WaitlistOptInResult = {
  success: boolean;
  wasNewEntry: boolean;
  requestedZip: string;
  assignedNodeId: string | null;
};

/**
 * Add or update user entry in ZIP waitlist (NODE-003)
 * Called when user is assigned to fallback node and offered waitlist opt-in
 *
 * Uses UPSERT to handle idempotency:
 * - If user already on waitlist for this ZIP → update status
 * - If new → insert with status='pending'
 *
 * @param params - Waitlist parameters
 * @returns WaitlistOptInResult indicating success and whether it was a new entry
 */
export const upsertZipWaitlist = async (params: {
  userId: string;
  email: string;
  requestedZip: string;
  assignedNodeId?: string | null;
}): Promise<WaitlistOptInResult> => {
  try {
    const { userId, email, requestedZip, assignedNodeId } = params;

    // Use upsert: insert new or update if (user_id, requested_zip) exists
    const { data, error } = await supabase
      .from('zip_waitlist')
      .upsert(
        {
          user_id: userId,
          email,
          requested_zip: requestedZip,
          assigned_node_id: assignedNodeId || null,
          status: 'pending',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,requested_zip', // UPSERT on unique constraint
        }
      )
      .select('id, user_id')
      .single();

    if (error) {
      console.error('❌ Waitlist upsert error:', error.message);
      throw error;
    }

    // Determine if this was a new entry or update
    const wasNewEntry = !!data?.id;

    // Track analytics event
    trackEvent('waitlist_opt_in', {
      user_id: userId,
      requested_zip: requestedZip,
      assigned_node_id: assignedNodeId || null,
      was_new_entry: wasNewEntry,
    });

    return {
      success: true,
      wasNewEntry,
      requestedZip,
      assignedNodeId: assignedNodeId || null,
    };
  } catch (error) {
    const err = error as Error;
    console.error('❌ upsertZipWaitlist error:', err.message);
    throw err;
  }
};

/**
 * Check if user is already on waitlist for a specific ZIP (NODE-003 updated)
 *
 * @param userId - User UUID
 * @param requestedZip - ZIP code to check
 * @returns true if user has pending/notified entry for this ZIP
 */
export const isUserOnWaitlist = async (userId: string, requestedZip: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('zip_waitlist')
      .select('id')
      .eq('user_id', userId)
      .eq('requested_zip', requestedZip)
      .in('status', ['pending', 'notified'])
      .maybeSingle();

    if (error) {
      console.warn('⚠️ isUserOnWaitlist error:', error.message);
      return false;
    }

    return !!data;
  } catch (error) {
    const err = error as Error;
    console.error('❌ isUserOnWaitlist error:', err.message);
    return false;
  }
};

/**
 * Get user's waitlist entries (NODE-003 new)
 * Shows which ZIPs they've requested
 *
 * @param userId - User UUID
 * @returns Array of user's waitlist entries
 */
export const getUserWaitlistEntries = async (
  userId: string
): Promise<
  {
    id: string;
    requestedZip: string;
    assignedNodeId: string | null;
    status: 'pending' | 'notified' | 'joined';
    createdAt: string;
  }[]
> => {
  try {
    const { data, error } = await supabase
      .from('zip_waitlist')
      .select('id, requested_zip, assigned_node_id, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('⚠️ getUserWaitlistEntries error:', error.message);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      requestedZip: row.requested_zip,
      assignedNodeId: row.assigned_node_id,
      status: row.status as 'pending' | 'notified' | 'joined',
      createdAt: row.created_at,
    }));
  } catch (error) {
    const err = error as Error;
    console.error('❌ getUserWaitlistEntries error:', err.message);
    return [];
  }
};

// ============================================================================
// LEGACY SUPPORT (for backward compatibility)
// ============================================================================

export interface WaitlistEntry {
  email: string;
  phone?: string;
  zip: string;
  kids_count?: number;
  kids_ages?: string[];
}

/**
 * Add user to waitlist for unsupported zip code area (LEGACY)
 * @deprecated Use upsertZipWaitlist instead
 */
export const addToWaitlist = async (
  entry: WaitlistEntry
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    const { error } = await supabase.from('waitlist').insert({
      email: entry.email,
      phone: entry.phone || null,
      zip: entry.zip,
      kids_count: entry.kids_count || null,
      kids_ages: entry.kids_ages || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Waitlist insert error:', error.message);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (error) {
    const err = error as Error;
    console.error('Waitlist exception:', err.message);
    return { success: false, error: err };
  }
};

/**
 * Check if user is already on waitlist for a zip code (LEGACY)
 * @deprecated Use isUserOnWaitlist or upsertZipWaitlist instead
 */
export const checkWaitlistStatus = async (
  email: string,
  zip: string
): Promise<{ exists: boolean; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', email)
      .eq('zip', zip)
      .maybeSingle();

    if (error) {
      console.error('Waitlist check error:', error.message);
      return { exists: false, error: new Error(error.message) };
    }

    return { exists: !!data, error: null };
  } catch (error) {
    const err = error as Error;
    console.error('Waitlist check exception:', err.message);
    return { exists: false, error: err };
  }
};
