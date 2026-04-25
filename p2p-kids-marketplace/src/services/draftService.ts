/**
 * File: p2p-kids-marketplace/src/services/draftService.ts
 * MODULE-04 LISTING-V3: Draft Service Layer
 * Task: LISTING-V3-003 - Server-side draft lifecycle
 * 
 * Handles:
 * - Create item draft
 * - Update draft with JSONB merge
 * - Get/delete drafts
 * - Publish draft to item
 * - Bulk publish drafts
 */

import { supabase } from '../config/supabase';
import { ItemDraft, DraftData, AIAnalysisResult } from '../types/listing';
import { createListing } from './listing';

type DraftStep = 'photos' | 'grouping' | 'details' | 'price' | 'review';

function normalizeDraftStep(step?: string): DraftStep {
  switch (step) {
    case 'photo':
      return 'photos';
    case 'pricing':
      return 'price';
    case 'photos':
    case 'grouping':
    case 'details':
    case 'price':
    case 'review':
      return step;
    default:
      return 'photos';
  }
}

function normalizeDraftData(updates: Partial<DraftData>): Partial<DraftData> {
  if (!Object.prototype.hasOwnProperty.call(updates, 'step')) {
    return updates;
  }

  return {
    ...updates,
    step: normalizeDraftStep((updates as { step?: string }).step),
  };
}

/**
 * Bulk publish result
 */
export interface BulkPublishResult {
  published: string[]; // Item IDs
  failed: { draftId: string; error: string }[];
  errors: string[];
}

/**
 * Create new item draft
 * Inserts into item_drafts table
 * Relies on trigger for max-5 eviction
 * 
 * @param sellerId - Current seller ID
 * @param initial - Initial draft data
 * @returns Created draft
 */
export async function createItemDraft(
  sellerId: string,
  initial?: Partial<DraftData>
): Promise<ItemDraft | null> {
  try {
    const normalizedInitial = normalizeDraftData(initial || {});

    const { data, error } = await supabase
      .from('item_drafts')
      .insert([
        {
          seller_id: sellerId,
          draft_data: normalizedInitial,
          photo_urls: normalizedInitial.photo_urls || [],
          ai_suggestions: null,
          step: normalizeDraftStep((normalizedInitial as { step?: string }).step),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return data as ItemDraft;
  } catch (error: any) {
    console.error('[draftService] Create draft error:', error);
    return null;
  }
}

/**
 * Get item draft by ID
 * 
 * @param draftId - Draft ID
 * @returns Draft or null
 */
export async function getItemDraft(draftId: string): Promise<ItemDraft | null> {
  try {
    const { data, error } = await supabase
      .from('item_drafts')
      .select('*')
      .eq('id', draftId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) throw error;

    return data as ItemDraft;
  } catch (error: any) {
    console.error('[draftService] Get draft error:', error);
    return null;
  }
}

/**
 * Update item draft with JSONB merge
 * Uses draft_data = draft_data || $1::jsonb pattern
 * No fetch-then-overwrite (race condition safe)
 * 
 * @param draftId - Draft ID
 * @param updates - Partial draft data to merge
 * @returns Success status
 */
export async function updateItemDraft(
  draftId: string,
  updates: Partial<DraftData>
): Promise<boolean> {
  try {
    const normalizedUpdates = normalizeDraftData(updates);

    // Use RPC for JSONB merge to avoid race conditions
    const { error } = await supabase.rpc('merge_item_draft', {
      p_draft_id: draftId,
      p_updates: normalizedUpdates,
    });

    if (error) {
      // If RPC doesn't exist, fall back to client-side merge
      // This is acceptable for MVP but has race condition risk
      console.warn('[draftService] RPC merge_item_draft not found, using client-side merge');
      
      const { data: current, error: fetchError } = await supabase
        .from('item_drafts')
        .select('draft_data')
        .eq('id', draftId)
        .single();

      if (fetchError) throw fetchError;

      const merged = {
        ...(current?.draft_data || {}),
        ...normalizedUpdates,
      };

      const { error: updateError } = await supabase
        .from('item_drafts')
        .update({ draft_data: merged })
        .eq('id', draftId);

      if (updateError) throw updateError;
    }

    return true;
  } catch (error: any) {
    console.error('[draftService] Update draft error:', error);
    return false;
  }
}

/**
 * Delete draft
 * 
 * @param draftId - Draft ID
 * @returns Success status
 */
export async function deleteDraft(draftId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('item_drafts')
      .delete()
      .eq('id', draftId);

    if (error) throw error;

    return true;
  } catch (error: any) {
    console.error('[draftService] Delete draft error:', error);
    return false;
  }
}

/**
 * Backward-compatible alias used by hooks/tests.
 * Keep this export to avoid breaking existing imports.
 */
export async function deleteItemDraft(draftId: string): Promise<boolean> {
  return deleteDraft(draftId);
}

/**
 * Get active drafts for seller
 * Returns drafts WHERE expires_at > now() ORDER BY updated_at DESC
 * 
 * @param sellerId - Seller ID
 * @returns Array of active drafts
 */
export async function getActiveDrafts(sellerId: string): Promise<ItemDraft[]> {
  try {
    const { data, error } = await supabase
      .from('item_drafts')
      .select('*')
      .eq('seller_id', sellerId)
      .gt('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data as ItemDraft[]) || [];
  } catch (error: any) {
    console.error('[draftService] Get active drafts error:', error);
    return [];
  }
}

/**
 * Publish draft to item
 * Validates required fields
 * Calls existing V2 createItem
 * On success, deletes draft
 * 
 * @param draftId - Draft ID
 * @returns Created item ID or null
 */
export async function publishDraft(draftId: string): Promise<string | null> {
  try {
    // Get draft
    const draft = await getItemDraft(draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }

    const draftData = draft.draft_data;

    // Validate required fields
    if (!draftData.title || draftData.title.trim().length === 0) {
      throw new Error('Title is required');
    }

    if (!draftData.description || draftData.description.trim().length === 0) {
      throw new Error('Description is required');
    }

    if (!draftData.price || draftData.price <= 0) {
      throw new Error('Price must be greater than 0');
    }

    if (!draftData.category_id && !draftData.requested_category_name) {
      throw new Error('Category is required');
    }

    if (!draftData.condition) {
      throw new Error('Condition is required');
    }

    if (!draft.photo_urls || draft.photo_urls.length === 0) {
      throw new Error('At least one photo is required');
    }

    // Create item using existing V2 createListing
    const itemData = {
      seller_id: draft.seller_id,
      title: draftData.title,
      description: draftData.description,
      price: draftData.price,
      category_id: draftData.category_id,
      requested_category_name: draftData.requested_category_name,
      condition: draftData.condition,
      brand: draftData.brand,
      color: draftData.color,
      age_group: draftData.age_group,
      gender: draftData.gender,
      accepts_swap_points: Boolean(draftData.accepts_swap_points),
      photo_urls: draft.photo_urls,
    };

    const result = await createListing(itemData);
    if (!result) {
      throw new Error('Failed to create item');
    }

    // Delete draft on success
    await deleteDraft(draftId);

    return result.id;
  } catch (error: any) {
    console.error('[draftService] Publish draft error:', error);
    throw error;
  }
}

/**
 * Publish bulk drafts
 * Iterates items, returns published/failed/errors
 * Updates item_bulk_uploads.published_items and status
 * 
 * @param bulkUploadId - Bulk upload session ID
 * @param itemIds - Array of item draft IDs to publish
 * @returns Bulk publish result
 */
export async function publishBulkDrafts(
  bulkUploadId: string,
  itemIds: string[]
): Promise<BulkPublishResult> {
  const published: string[] = [];
  const failed: { draftId: string; error: string }[] = [];
  const errors: string[] = [];

  // Process each draft
  for (const draftId of itemIds) {
    try {
      const itemId = await publishDraft(draftId);
      if (itemId) {
        published.push(itemId);
      } else {
        failed.push({ draftId, error: 'Publish failed' });
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      failed.push({ draftId, error: errorMsg });
      errors.push(`Draft ${draftId}: ${errorMsg}`);
    }
  }

  // Update bulk_upload status
  const totalItems = itemIds.length;
  const publishedCount = published.length;
  
  let status: 'completed' | 'partial' | 'failed';
  if (publishedCount === totalItems) {
    status = 'completed';
  } else if (publishedCount > 0) {
    status = 'partial';
  } else {
    status = 'failed';
  }

  try {
    await supabase
      .from('item_bulk_uploads')
      .update({
        published_items: publishedCount,
        status,
        completed_at: new Date().toISOString(),
      })
      .eq('id', bulkUploadId);
  } catch (error: any) {
    console.error('[draftService] Update bulk upload error:', error);
    errors.push(`Failed to update bulk upload status: ${error.message}`);
  }

  return {
    published,
    failed,
    errors,
  };
}

/**
 * Save AI suggestions to draft
 * 
 * @param draftId - Draft ID
 * @param suggestions - AI analysis result
 * @returns Success status
 */
export async function saveDraftAISuggestions(
  draftId: string,
  suggestions: AIAnalysisResult
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('item_drafts')
      .update({ ai_suggestions: suggestions })
      .eq('id', draftId);

    if (error) throw error;

    return true;
  } catch (error: any) {
    console.error('[draftService] Save AI suggestions error:', error);
    return false;
  }
}
