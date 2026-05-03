// =====================================================
// FILE: p2p-kids-marketplace/src/services/imageModeration.ts
// MODULE: MODULE-13-SAFETY-COMPLIANCE
// TASK: SAFETY-004 - Google Vision API Image Moderation
// DESCRIPTION:
//   Service to call moderate-image Edge Function for AI image moderation.
// =====================================================

import { supabase } from '../config/supabase';

export interface ModerationResult {
  success: boolean;
  decision: 'approved' | 'flagged' | 'rejected';
  flagged: boolean;
  categories: string[];
  confidence: number;
  details?: {
    adult: string;
    violence: string;
    racy: string;
    medical: string;
    spoof: string;
  };
}

export interface ModerationError {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Checks whether Google Vision image moderation is enabled via admin_config.
 * Defaults to enabled on config read failures to preserve safety behavior.
 */
export const isImageModerationEnabled = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'moderation_ai_enabled')
      .single();

    if (error || !data) {
      console.warn('[imageModeration] Could not read moderation_ai_enabled, defaulting to enabled');
      return true;
    }

    const rawValue = data.value;
    if (typeof rawValue === 'boolean') {
      return rawValue;
    }

    return String(rawValue).toLowerCase() === 'true';
  } catch (error) {
    console.warn(
      '[imageModeration] Error reading moderation_ai_enabled, defaulting to enabled:',
      error
    );
    return true;
  }
};

const extractFunctionsHttpErrorMessage = async (error: unknown): Promise<string> => {
  if (!(error instanceof Error)) {
    return 'Unknown image moderation error';
  }

  const maybeContext = (error as Error & { context?: Response }).context;
  if (!maybeContext) {
    return error.message;
  }

  try {
    const payload = await maybeContext.clone().json();
    const message = payload?.error?.message;
    const code = payload?.error?.code;
    if (message && code) {
      return `${code}: ${message}`;
    }
    if (message) {
      return String(message);
    }
  } catch {
    // Best effort only.
  }

  return error.message;
};

/**
 * Moderate a listing image using Google Vision API via Edge Function
 * @param itemId - Item ID
 * @param imageUrl - Public URL of the uploaded image
 * @returns Moderation result or throws error
 */
export const moderateListingImage = async (
  itemId: string,
  imageUrl: string
): Promise<ModerationResult> => {
  console.log('[imageModeration] Moderating image for item:', itemId);

  const { data, error } = await supabase.functions.invoke('moderate-image', {
    body: {
      itemId,
      imageUrl,
    },
  });

  if (error) {
    const detailedMessage = await extractFunctionsHttpErrorMessage(error);
    throw new Error(`Image moderation failed: ${detailedMessage}`);
  }

  // Check if response indicates an error
  if (data.error) {
    const errorData = data as ModerationError;
    throw new Error(`Image moderation failed: ${errorData.error.message}`);
  }

  const result = data as ModerationResult;

  console.log(
    `[imageModeration] Result: ${result.decision}, flagged: ${result.flagged}, confidence: ${result.confidence}`
  );

  return result;
};

/**
 * Moderate multiple listing images (run sequentially to avoid rate limits)
 * @param itemId - Item ID
 * @param imageUrls - Array of public image URLs
 * @returns Array of moderation results
 */
export const moderateListingImages = async (
  itemId: string,
  imageUrls: string[]
): Promise<ModerationResult[]> => {
  const results: ModerationResult[] = [];

  for (const imageUrl of imageUrls) {
    try {
      const result = await moderateListingImage(itemId, imageUrl);
      results.push(result);

      // If any image is flagged, we can optionally stop early
      // For now, we check all images
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown image moderation error';
      console.warn(`[imageModeration] Failed to moderate image ${imageUrl}: ${message}`);
      // Continue with other images even if one fails
      results.push({
        success: false,
        decision: 'approved', // Default to approved on error to not block listing
        flagged: false,
        categories: [],
        confidence: 0,
      });
    }
  }

  return results;
};
