// =====================================================
// FILE: supabase/functions/moderate-image/index.ts
// MODULE: MODULE-13-SAFETY-COMPLIANCE
// TASK: SAFETY-004 - Google Vision API Image Moderation
// DESCRIPTION:
//   Edge Function to moderate listing images using Google Vision API Safe Search.
//   Detects: adult, violence, racy, medical, spoof content.
//   Flags items with LIKELY or VERY_LIKELY scores.
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as encodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

interface ModerationRequest {
  itemId?: string;
  imageUrl?: string;
  item_id?: string;
  image_url?: string;
  url?: string;
}

interface GoogleVisionResponse {
  responses: Array<{
    safeSearchAnnotation?: {
      adult: string;
      violence: string;
      racy: string;
      medical: string;
      spoof: string;
    };
  }>;
}

interface SafeSearchAnnotation {
  adult: string;
  violence: string;
  racy: string;
  medical: string;
  spoof: string;
}

const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY');
const GOOGLE_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

// Google Vision likelihood levels mapped to numeric scores
const LIKELIHOOD_SCORES: Record<string, number> = {
  UNKNOWN: 0.0,
  VERY_UNLIKELY: 0.1,
  UNLIKELY: 0.2,
  POSSIBLE: 0.5,
  LIKELY: 0.7,
  VERY_LIKELY: 0.9,
};

const callVisionSafeSearch = async (
  imagePayload: { source?: { imageUri: string }; content?: string }
): Promise<SafeSearchAnnotation> => {
  const visionResponse = await fetch(GOOGLE_VISION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: imagePayload,
          features: [{ type: 'SAFE_SEARCH_DETECTION', maxResults: 1 }],
        },
      ],
    }),
  });

  if (!visionResponse.ok) {
    const errorText = await visionResponse.text();
    throw new Error(`Google Vision API error: ${visionResponse.status} ${errorText}`);
  }

  const visionData: GoogleVisionResponse = await visionResponse.json();
  const safeSearch = visionData.responses[0]?.safeSearchAnnotation;

  if (!safeSearch) {
    throw new Error('No Safe Search results returned from Google Vision API');
  }

  return safeSearch;
};

const parseSupabaseStoragePublicUrl = (
  imageUrl: string
): { bucket: string; path: string } | null => {
  try {
    const url = new URL(imageUrl);
    const marker = '/storage/v1/object/public/';
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;

    const suffix = url.pathname.substring(idx + marker.length);
    const slashIdx = suffix.indexOf('/');
    if (slashIdx === -1) return null;

    const bucket = suffix.substring(0, slashIdx);
    const path = suffix.substring(slashIdx + 1);
    if (!bucket || !path) return null;

    return { bucket, path };
  } catch {
    return null;
  }
};

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Validate environment
    if (!GOOGLE_VISION_API_KEY) {
      throw new Error('GOOGLE_VISION_API_KEY not configured');
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = authHeader.replace(/Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing bearer token',
          },
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Parse request (support both camelCase and snake_case keys)
    let requestBody: ModerationRequest;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON.',
          },
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const itemId = requestBody.itemId ?? requestBody.item_id;
    const imageUrl = requestBody.imageUrl ?? requestBody.image_url ?? requestBody.url;

    if (!itemId || !imageUrl) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required fields. Provide itemId (or item_id) and imageUrl (or image_url).',
            details: {
              expected: {
                itemId: '<uuid>',
                imageUrl: 'https://...'
              },
              acceptedAliases: {
                itemId: ['itemId', 'item_id'],
                imageUrl: ['imageUrl', 'image_url', 'url']
              },
              receivedKeys: Object.keys(requestBody ?? {}),
            },
          },
        }),
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log(`[moderate-image] Processing item ${itemId}, image: ${imageUrl}`);

    // Initialize Supabase client (service role for inserting logs/flags)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired bearer token',
          },
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const { data: itemOwner, error: itemOwnerError } = await supabaseClient
      .from('items')
      .select('seller_id')
      .eq('id', itemId)
      .maybeSingle();

    if (itemOwnerError || !itemOwner) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'ITEM_NOT_FOUND',
            message: 'Item not found for moderation',
          },
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    if (itemOwner.seller_id !== authData.user.id) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'MODERATION_OWNERSHIP_DENIED',
            message: 'You can only moderate images for your own items.',
          },
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Call Google Vision API Safe Search.
    // First try imageUri; if provider cannot fetch the URL, fallback to loading bytes from Supabase storage.
    console.log('[moderate-image] Calling Google Vision API with imageUri...');
    let safeSearch: SafeSearchAnnotation;
    try {
      safeSearch = await callVisionSafeSearch({ source: { imageUri: imageUrl } });
    } catch (imageUriError) {
      const storageRef = parseSupabaseStoragePublicUrl(imageUrl);
      if (!storageRef) {
        throw imageUriError;
      }

      console.warn('[moderate-image] imageUri moderation failed; attempting storage download fallback');
      const { data: fileBlob, error: downloadError } = await supabaseClient.storage
        .from(storageRef.bucket)
        .download(storageRef.path);

      if (downloadError || !fileBlob) {
        throw new Error(
          `Google Vision imageUri failed and storage download fallback failed: ${downloadError?.message ?? 'unknown error'}`
        );
      }

      const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());
      const contentBase64 = encodeBase64(fileBytes);
      safeSearch = await callVisionSafeSearch({ content: contentBase64 });
    }

    console.log('[moderate-image] Safe Search response:', JSON.stringify(safeSearch));

    // Analyze Safe Search results
    const flaggedCategories: string[] = [];
    let maxConfidence = 0.0;

    const categories = ['adult', 'violence', 'racy', 'medical', 'spoof'] as const;

    for (const category of categories) {
      const likelihood = safeSearch[category];
      const score = LIKELIHOOD_SCORES[likelihood] || 0.0;

      if (score > maxConfidence) {
        maxConfidence = score;
      }

      // Flag if LIKELY or VERY_LIKELY
      if (likelihood === 'LIKELY' || likelihood === 'VERY_LIKELY') {
        flaggedCategories.push(category);
      }
    }

    const isFlagged = flaggedCategories.length > 0;
    const decision = isFlagged ? 'flagged' : 'approved';

    console.log(
      `[moderate-image] Decision: ${decision}, flagged categories: [${flaggedCategories.join(', ')}], max confidence: ${maxConfidence}`
    );

    // Insert moderation log
    const logPayload = {
      item_id: itemId,
      image_url: imageUrl,
      moderation_type: 'image',
      service: 'google_vision',
      decision,
      flagged: isFlagged,
      confidence_score: maxConfidence,
      details: {
        safe_search: safeSearch,
        flagged_categories: flaggedCategories,
      },
    };

    let { error: logError } = await supabaseClient.from('ai_moderation_logs').insert(logPayload);

    // Backward compatibility for environments where schema drift exists.
    if (logError && logError.code === '42703' && logError.message?.includes('flagged')) {
      console.warn('[moderate-image] ai_moderation_logs.flagged missing, retrying insert without flagged column');
      const { flagged: _ignored, ...legacyPayload } = logPayload;
      const retry = await supabaseClient.from('ai_moderation_logs').insert(legacyPayload);
      logError = retry.error;
    }

    // Handle legacy schemas where image_url was named differently.
    if (logError && logError.code === 'PGRST204' && logError.message?.includes("'image_url'")) {
      console.warn('[moderate-image] ai_moderation_logs.image_url missing, retrying with url column');
      const { image_url: _imageUrl, ...withoutImageUrl } = logPayload;
      const retryWithUrl = await supabaseClient.from('ai_moderation_logs').insert({
        ...withoutImageUrl,
        url: imageUrl,
      });
      logError = retryWithUrl.error;

      if (logError && logError.code === 'PGRST204' && logError.message?.includes("'url'")) {
        console.warn('[moderate-image] ai_moderation_logs.url missing, retrying with image_uri column');
        const retryWithImageUri = await supabaseClient.from('ai_moderation_logs').insert({
          ...withoutImageUrl,
          image_uri: imageUrl,
        });
        logError = retryWithImageUri.error;
      }
    }

    if (logError) {
      console.error('[moderate-image] Error inserting moderation log:', logError);
      throw new Error(`Failed to insert moderation log: ${logError.message}`);
    }

    // If flagged, create safety flag and update item status
    if (isFlagged) {
      console.log('[moderate-image] Image flagged, creating safety flag...');

      // Insert safety flag
      const { error: flagError } = await supabaseClient.from('item_safety_flags').insert({
        item_id: itemId,
        flag_type: 'ai_moderation',
        flag_reason: `Unsafe image content detected: ${flaggedCategories.join(', ')}`,
        confidence_score: maxConfidence,
        status: 'pending',
      });

      if (flagError) {
        console.error('[moderate-image] Error inserting safety flag:', flagError);
      }

      // Update item status to 'flagged'
      const { error: updateError } = await supabaseClient
        .from('items')
        .update({ status: 'flagged', flagged_at: new Date().toISOString() })
        .eq('id', itemId);

      if (updateError) {
        console.error('[moderate-image] Error updating item status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        decision,
        flagged: isFlagged,
        categories: flaggedCategories,
        confidence: maxConfidence,
        details: safeSearch,
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('[moderate-image] Error:', error);
    return new Response(
      JSON.stringify({
        error: {
          code: 'MODERATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
