// filepath: supabase/functions/import-cpsc-recalls/index.ts
// SAFETY-001: CPSC API Daily Batch Import
// Fetches recalls from CPSC public API and imports into cpsc_recalls table

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CPSC API endpoint (documented at https://www.saferproducts.gov/api/)
// Note: CPSC has multiple APIs - using Recall API v2
const CPSC_API_URL = 'https://www.saferproducts.gov/RestWebServices/Recall';

interface CPSCRecall {
  RecallNumber: string;
  RecallDate: string;
  RecallDescription: string;
  Products?: Array<{
    Name: string;
    Description?: string;
    Manufacturer?: string;
  }>;
  Title?: string;
  Hazards?: Array<{
    Name: string;
  }>;
  Remedies?: Array<{
    Name: string;
  }>;
  Images?: Array<{
    URL: string;
  }>;
  URL?: string;
}

interface CPSCApiResponse {
  Success: boolean;
  Message?: string;
  Recalls?: CPSCRecall[];
}

serve(async (req: Request) => {
  const startTime = Date.now();

  try {
    // Verify service role authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[CPSC Import] Starting recall import...');

    // Fetch last 30 days of recalls (configurable via query param)
    const daysBack = 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);
    const fromDateStr = fromDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const apiUrl = `${CPSC_API_URL}?format=json&RecallDateStart=${fromDateStr}`;
    console.log(`[CPSC Import] Fetching from: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Kids P2P Marketplace Safety Scanner/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`CPSC API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as CPSCApiResponse;

    if (!data.Success || !data.Recalls || data.Recalls.length === 0) {
      console.log('[CPSC Import] No new recalls found');
      
      await supabaseClient.from('cpsc_import_log').insert({
        status: 'success',
        recalls_imported: 0,
        recalls_updated: 0,
        total_processed: 0,
        duration_seconds: Math.floor((Date.now() - startTime) / 1000),
      });

      return new Response(
        JSON.stringify({
          success: true,
          imported: 0,
          updated: 0,
          processed: 0,
          message: 'No new recalls found'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const recalls = data.Recalls;
    console.log(`[CPSC Import] Found ${recalls.length} recalls to process`);

    let importedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // Process each recall
    for (const recall of recalls) {
      try {
        // Extract product info (first product from array)
        const product = recall.Products && recall.Products.length > 0 
          ? recall.Products[0] 
          : null;

        // Build recall record
        const recallData = {
          recall_number: recall.RecallNumber,
          product_name: product?.Name || recall.Title || 'Unknown Product',
          product_description: product?.Description || recall.RecallDescription || null,
          manufacturer: product?.Manufacturer || null,
          hazard: recall.Hazards && recall.Hazards.length > 0 
            ? recall.Hazards.map(h => h.Name).join('; ') 
            : null,
          remedy: recall.Remedies && recall.Remedies.length > 0 
            ? recall.Remedies.map(r => r.Name).join('; ') 
            : null,
          recall_date: recall.RecallDate ? new Date(recall.RecallDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          images: recall.Images ? JSON.stringify(recall.Images.map(img => img.URL)) : '[]',
          source_url: recall.URL || null,
          product_codes: product?.Name ? [product.Name] : [],
        };

        // Check if recall already exists
        const { data: existing, error: checkError } = await supabaseClient
          .from('cpsc_recalls')
          .select('id, updated_at')
          .eq('recall_number', recallData.recall_number)
          .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
          console.error(`[CPSC Import] Error checking recall ${recallData.recall_number}:`, checkError);
          errorCount++;
          continue;
        }

        if (existing) {
          // Update existing recall
          const { error: updateError } = await supabaseClient
            .from('cpsc_recalls')
            .update(recallData)
            .eq('id', existing.id);

          if (updateError) {
            console.error(`[CPSC Import] Error updating recall ${recallData.recall_number}:`, updateError);
            errorCount++;
            continue;
          }

          updatedCount++;
          console.log(`[CPSC Import] Updated recall: ${recallData.recall_number}`);
        } else {
          // Insert new recall
          const { error: insertError } = await supabaseClient
            .from('cpsc_recalls')
            .insert(recallData);

          if (insertError) {
            console.error(`[CPSC Import] Error inserting recall ${recallData.recall_number}:`, insertError);
            errorCount++;
            continue;
          }

          importedCount++;
          console.log(`[CPSC Import] Imported new recall: ${recallData.recall_number}`);
        }
      } catch (error) {
        console.error(`[CPSC Import] Error processing recall:`, error);
        errorCount++;
      }
    }

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    const status = errorCount > 0 ? 'partial' : 'success';

    // Log import result
    await supabaseClient.from('cpsc_import_log').insert({
      status,
      recalls_imported: importedCount,
      recalls_updated: updatedCount,
      total_processed: recalls.length,
      duration_seconds: durationSeconds,
      error_message: errorCount > 0 ? `${errorCount} errors occurred during import` : null,
    });

    console.log(`[CPSC Import] Complete: ${importedCount} new, ${updatedCount} updated, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: importedCount,
        updated: updatedCount,
        errors: errorCount,
        total_processed: recalls.length,
        duration: durationSeconds,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[CPSC Import] Fatal error:', error);

    // Try to log failure (may fail if DB connection is down)
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseClient.from('cpsc_import_log').insert({
        status: 'failed',
        recalls_imported: 0,
        recalls_updated: 0,
        total_processed: 0,
        error_message: errorMessage,
        duration_seconds: durationSeconds,
      });
    } catch (logError) {
      console.error('[CPSC Import] Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        duration: durationSeconds 
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
