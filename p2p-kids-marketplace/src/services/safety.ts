/**
 * FILE: p2p-kids-marketplace/src/services/safety.ts
 * MODULE: MODULE-13-SAFETY-COMPLIANCE
 * TASK: SAFETY-002 - CPSC Recall Matching Logic
 *
 * DESCRIPTION:
 * Service functions for safety checks and recall matching.
 * Calls Edge Function to check items against CPSC recall database.
 *
 * USAGE:
 * import { checkItemSafety } from './services/safety';
 * const result = await checkItemSafety(itemId, title, description);
 * if (result.flagged) { // Handle flagged item }
 */

import { supabase } from '../config/supabase';

export interface SafetyCheckResult {
  success: boolean;
  flagged: boolean;
  reason?: string;
  match?: {
    recall_id: string;
    recall_number: string;
    product_name: string;
    manufacturer: string | null;
    hazard: string | null;
    similarity_score: number;
  };
  confidence?: number;
  error?: string;
}

export interface ItemSafetyFlag {
  id: string;
  item_id: string;
  flag_type: 'cpsc_recall' | 'ai_moderation' | 'user_report';
  flag_reason: string;
  confidence_score: number | null;
  recall_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Check item title/description against CPSC recalls
 *
 * @param itemId - UUID of the item to check
 * @param title - Item title
 * @param description - Item description (optional)
 * @returns SafetyCheckResult with flagging status
 *
 * @example
 * const result = await checkItemSafety(
 *   '123e4567-e89b-12d3-a456-426614174000',
 *   'Fisher-Price Baby Toy',
 *   'Colorful plastic toy with small parts'
 * );
 *
 * if (result.flagged) {
 *   console.log(`Item flagged: ${result.reason}`);
 *   console.log(`Match: ${result.match?.product_name}`);
 *   console.log(`Confidence: ${result.confidence}`);
 * }
 */
export async function checkItemSafety(
  itemId: string,
  title: string,
  description?: string
): Promise<SafetyCheckResult> {
  try {
    console.log(`[safety] Checking item safety: ${itemId}`);
    console.log(`[safety] Title: "${title}"`);

    const { data, error } = await supabase.functions.invoke('check-item-safety', {
      body: {
        itemId,
        title,
        description: description || undefined,
      },
    });

    if (error) {
      console.error('[safety] Edge Function error:', error);
      return {
        success: false,
        flagged: false,
        error: error.message || 'Failed to check item safety',
      };
    }

    console.log(`[safety] Safety check result:`, data);

    return {
      success: data.success ?? true,
      flagged: data.flagged ?? false,
      reason: data.reason,
      match: data.match,
      confidence: data.confidence,
      error: data.error,
    };
  } catch (error) {
    console.error('[safety] Exception during safety check:', error);
    return {
      success: false,
      flagged: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get safety flags for a specific item
 *
 * @param itemId - UUID of the item
 * @returns Array of safety flags
 */
export async function getItemSafetyFlags(itemId: string): Promise<ItemSafetyFlag[]> {
  try {
    const { data, error } = await supabase
      .from('item_safety_flags')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[safety] Error fetching safety flags:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[safety] Exception fetching safety flags:', error);
    return [];
  }
}

/**
 * Get all pending safety flags for admin review
 * (Admin-only, requires RLS policy)
 *
 * @returns Array of pending safety flags with item details
 */
export async function getPendingSafetyFlags(): Promise<(ItemSafetyFlag & { item: any })[]> {
  try {
    const { data, error } = await supabase
      .from('item_safety_flags')
      .select(
        `
        *,
        item:items(
          id,
          title,
          description,
          seller_id,
          status,
          created_at
        )
      `
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[safety] Error fetching pending flags:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[safety] Exception fetching pending flags:', error);
    return [];
  }
}

/**
 * Check if CPSC recall checking is enabled (admin config)
 *
 * @returns boolean indicating if feature is enabled
 */
export async function isCpscCheckEnabled(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'cpsc_recall_check_enabled')
      .single();

    if (error) {
      console.warn('[safety] Could not check CPSC config, assuming enabled:', error);
      return true; // Default to enabled if config not found
    }

    return data?.value === 'true';
  } catch (error) {
    console.warn('[safety] Exception checking CPSC config, assuming enabled:', error);
    return true;
  }
}

/**
 * Get CPSC match threshold from admin config
 *
 * @returns Confidence threshold (0.0 - 1.0) for automatic flagging
 */
export async function getCpscMatchThreshold(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'cpsc_match_threshold')
      .single();

    if (error || !data) {
      console.warn('[safety] Could not get CPSC threshold, using default 0.5');
      return 0.5;
    }

    const threshold = parseFloat(data.value);
    return isNaN(threshold) ? 0.5 : threshold;
  } catch (_error) {
    console.warn('[safety] Exception getting CPSC threshold, using default 0.5');
    return 0.5;
  }
}
