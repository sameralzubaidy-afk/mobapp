/**
 * FILE: supabase/functions/check-item-safety/index.ts
 * MODULE: MODULE-13-SAFETY-COMPLIANCE
 * TASK: SAFETY-002 - CPSC Recall Matching Logic
 * 
 * DESCRIPTION:
 * Edge Function to check item title/description against CPSC recalls.
 * If high-confidence match found, creates safety flag and updates item status.
 * 
 * INVOKED BY:
 * - Listing creation flow (mobile app)
 * - Admin manual re-check (future)
 * 
 * REQUIREMENTS:
 * - SUPABASE_URL env var
 * - SUPABASE_SERVICE_ROLE_KEY env var (for bypassing RLS)
 * 
 * RETURNS:
 * - { flagged: boolean, reason?: string, match?: RecallMatch }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Defaults used when admin_config values are missing/invalid
const DEFAULT_CPSC_MATCH_THRESHOLD = 0.5;
const DEFAULT_CPSC_CHECK_ENABLED = true;

interface CheckItemSafetyRequest {
  itemId: string;
  title: string;
  description?: string;
}

interface RecallMatch {
  recall_id: string;
  recall_number: string;
  product_name: string;
  manufacturer: string | null;
  hazard: string | null;
  similarity_score: number;
}

interface CheckItemSafetyResponse {
  success: boolean;
  flagged: boolean;
  reason?: string;
  match?: RecallMatch;
  confidence?: number;
  error?: string;
}

serve(async (req: Request): Promise<Response> => {
  const startTime = Date.now();

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CheckItemSafetyRequest = await req.json();
    const { itemId, title, description } = body;

    // Validate inputs
    if (!itemId || !title) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required fields: itemId, title' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-item-safety] Checking item ${itemId}`);
    console.log(`[check-item-safety] Title: "${title}"`);
    if (description) {
      console.log(`[check-item-safety] Description: "${description.substring(0, 100)}..."`);
    }

    // Create Supabase client with service role (bypass RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Resolve safety feature flags from admin_config (server-enforced)
    let cpscCheckEnabled = DEFAULT_CPSC_CHECK_ENABLED;
    let cpscMatchThreshold = DEFAULT_CPSC_MATCH_THRESHOLD;

    const { data: enabledConfig, error: enabledConfigError } = await supabaseClient
      .from('admin_config')
      .select('value')
      .eq('key', 'cpsc_recall_check_enabled')
      .maybeSingle();

    if (!enabledConfigError && enabledConfig?.value !== undefined && enabledConfig?.value !== null) {
      cpscCheckEnabled = String(enabledConfig.value).toLowerCase() === 'true';
    }

    const { data: thresholdConfig, error: thresholdConfigError } = await supabaseClient
      .from('admin_config')
      .select('value')
      .eq('key', 'cpsc_match_threshold')
      .maybeSingle();

    if (!thresholdConfigError && thresholdConfig?.value !== undefined && thresholdConfig?.value !== null) {
      const parsedThreshold = Number.parseFloat(String(thresholdConfig.value));
      if (!Number.isNaN(parsedThreshold) && parsedThreshold >= 0 && parsedThreshold <= 1) {
        cpscMatchThreshold = parsedThreshold;
      }
    }

    console.log(`[check-item-safety] Config: enabled=${cpscCheckEnabled}, threshold=${cpscMatchThreshold}`);

    if (!cpscCheckEnabled) {
      const response: CheckItemSafetyResponse = {
        success: true,
        flagged: false,
      };

      return new Response(
        JSON.stringify(response),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check against CPSC recalls using DB function
    console.log('[check-item-safety] Calling check_cpsc_recalls RPC...');
    const { data: matches, error: rpcError } = await supabaseClient.rpc('check_cpsc_recalls', {
      p_title: title,
      p_description: description || null,
    });

    if (rpcError) {
      console.error('[check-item-safety] RPC error:', rpcError);
      throw new Error(`Failed to check CPSC recalls: ${rpcError.message}`);
    }

    console.log(`[check-item-safety] Found ${matches?.length || 0} potential matches`);

    // Check if any high-confidence match exists
    if (matches && matches.length > 0) {
      const topMatch = matches[0] as RecallMatch;
      console.log(`[check-item-safety] Top match: "${topMatch.product_name}" (score: ${topMatch.similarity_score})`);

      // Flag item if confidence exceeds threshold
      const topScore = Number(topMatch.similarity_score ?? 0);
      if (topScore >= cpscMatchThreshold) {
        console.log(`[check-item-safety] ⚠️ High-confidence match detected, flagging item ${itemId}`);

        try {
          // Create safety flag
          const { error: flagError } = await supabaseClient.from('item_safety_flags').insert({
            item_id: itemId,
            flag_type: 'cpsc_recall',
            flag_reason: `Possible CPSC recall match: "${topMatch.product_name}"${topMatch.manufacturer ? ` by ${topMatch.manufacturer}` : ''}. Hazard: ${topMatch.hazard || 'Unknown'}`,
            confidence_score: topMatch.similarity_score,
            recall_id: topMatch.recall_id,
            status: 'pending',
          });

          if (flagError) {
            console.error('[check-item-safety] Failed to create safety flag:', flagError);
            throw flagError;
          }

          // Update item status to 'flagged'
          const { error: updateError } = await supabaseClient
            .from('items')
            .update({ 
              status: 'flagged',
              flagged_at: new Date().toISOString(),
            })
            .eq('id', itemId);

          if (updateError) {
            console.error('[check-item-safety] Failed to update item status:', updateError);
            throw updateError;
          }

          const duration = Date.now() - startTime;
          console.log(`[check-item-safety] ✅ Item ${itemId} flagged successfully in ${duration}ms`);

          const response: CheckItemSafetyResponse = {
            success: true,
            flagged: true,
            reason: 'cpsc_recall',
            match: topMatch,
            confidence: topScore,
          };

          return new Response(
            JSON.stringify(response),
            { 
              status: 200, 
              headers: { 'Content-Type': 'application/json' } 
            }
          );
        } catch (flaggingError) {
          console.error('[check-item-safety] Error during flagging process:', flaggingError);
          throw flaggingError;
        }
      } else {
        console.log(`[check-item-safety] Match score ${topScore} below threshold ${cpscMatchThreshold}, not flagging`);
      }
    } else {
      console.log('[check-item-safety] No CPSC recall matches found');
    }

    // No flagging needed
    const duration = Date.now() - startTime;
    console.log(`[check-item-safety] ✅ Safety check passed in ${duration}ms`);

    const response: CheckItemSafetyResponse = {
      success: true,
      flagged: false,
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[check-item-safety] ❌ Error:', error);
    console.error(`[check-item-safety] Failed after ${duration}ms`);

    const response: CheckItemSafetyResponse = {
      success: false,
      flagged: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

/* DEPLOYMENT:
 * 
 * 1. Deploy function:
 *    supabase functions deploy check-item-safety
 * 
 * 2. Set secrets (if not already set):
 *    supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
 *    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
 * 
 * 3. Test locally:
 *    supabase functions serve check-item-safety
 *    curl -X POST http://localhost:54321/functions/v1/check-item-safety \
 *      -H "Content-Type: application/json" \
 *      -d '{"itemId":"123","title":"Fisher-Price Baby Toy","description":"Colorful toy"}'
 * 
 * 4. Test production:
 *    curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/check-item-safety \
 *      -H "Content-Type: application/json" \
 *      -H "Authorization: Bearer YOUR_ANON_KEY" \
 *      -d '{"itemId":"real-uuid","title":"test item","description":"test"}'
 */
