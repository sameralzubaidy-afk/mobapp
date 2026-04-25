/**
 * File: p2p-kids-marketplace/src/services/aiService.ts
 * MODULE-04 LISTING-V3: AI Analysis Service
 * Task: LISTING-V3-003 - AI batch invocation wrapper
 * 
 * Handles:
 * - Invoking batch-analyze-items Edge Function
 * - Parsing AI results with confidence filtering
 * - Determining confidence levels
 */

import { supabase } from '../config/supabase';
import { AIAnalysisResult, AIFieldResult } from '../types/listing';

// Confidence thresholds
const CONFIDENCE_HIGH = 0.70;
const CONFIDENCE_MEDIUM = 0.40;
const CONFIDENCE_LOW = 0.20;
const BATCH_TIMEOUT_MS = 25000;

class AIServiceTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIServiceTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new AIServiceTimeoutError(errorMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function fallbackSingleItemAnalysis(
  items: BatchAnalysisItem[],
  sellerId: string
): Promise<BatchAnalysisResult> {
  const fallbackResults = await Promise.all(
    items.map(async (item) => {
      try {
        const response = await withTimeout<{ data: AIAnalysisResult | null; error: { message?: string } | null }>(
          supabase.functions.invoke('analyze-item-image', {
            body: {
              photoUrl: item.primaryPhotoUrl,
              sellerId,
            },
          }),
          BATCH_TIMEOUT_MS,
          'Single item AI analysis timed out'
        );
        const { data, error } = response;

        if (error) {
          return {
            groupId: item.groupId,
            error: error.message || 'Single item analysis failed',
          };
        }

        const parsed = data ? parseAIResult(data as AIAnalysisResult) : undefined;
        if (!parsed) {
          return {
            groupId: item.groupId,
            error: 'No analysis result returned',
          };
        }

        return {
          groupId: item.groupId,
          analysis: parsed,
        };
      } catch (error: any) {
        return {
          groupId: item.groupId,
          error: error?.message || 'Single item analysis failed',
        };
      }
    })
  );

  return {
    results: fallbackResults,
    totalProcessed: fallbackResults.length,
    totalFailed: fallbackResults.filter((r) => r.error).length,
  };
}

/**
 * Batch analysis request item
 */
export interface BatchAnalysisItem {
  groupId: string;
  primaryPhotoUrl: string;
  allPhotoUrls: string[];
}

/**
 * Batch analysis request
 */
export interface BatchAnalysisRequest {
  items: BatchAnalysisItem[];
  sellerId: string;
}

/**
 * Batch analysis result
 */
export interface BatchAnalysisResult {
  results: {
    groupId: string;
    analysis?: AIAnalysisResult;
    error?: string;
  }[];
  totalProcessed: number;
  totalFailed: number;
}

/**
 * Analyze photos in batch using Edge Function
 * Invokes batch-analyze-items endpoint
 * Returns AIAnalysisResult[] in request order
 * Each entry may carry error
 * 
 * @param items - Items with photo URLs to analyze
 * @param sellerId - Current seller ID
 * @returns Batch analysis results
 */
export async function analyzePhotosBatch(
  items: BatchAnalysisItem[],
  sellerId: string
): Promise<BatchAnalysisResult> {
  try {
    const response = await withTimeout<{ data: any; error: { message?: string } | null }>(
      supabase.functions.invoke('batch-analyze-items', {
        body: {
          items,
          sellerId,
        },
      }),
      BATCH_TIMEOUT_MS,
      'Batch AI analysis timed out'
    );
    const { data, error } = response;

    if (error) {
      throw error;
    }

    // Parse response
    const results = data?.results || [];
    const totalProcessed = data?.totalProcessed || 0;
    const totalFailed = data?.totalFailed || 0;

    // Defensive parsing: strip low-confidence fields
    const parsedResults = results.map((result: any) => ({
      groupId: result.groupId,
      analysis: result.analysis ? parseAIResult(result.analysis) : undefined,
      error: result.error,
    }));

    return {
      results: parsedResults,
      totalProcessed,
      totalFailed,
    };
  } catch (error: any) {
    console.error('[aiService] Batch analysis error:', error);

    if (error instanceof AIServiceTimeoutError) {
      console.warn('[aiService] Falling back to direct analyze-item-image calls after batch timeout');
      return fallbackSingleItemAnalysis(items, sellerId);
    }
    
    // Return error for all items
    return {
      results: items.map(item => ({
        groupId: item.groupId,
        error: error.message || 'Analysis failed',
      })),
      totalProcessed: 0,
      totalFailed: items.length,
    };
  }
}

/**
 * Parse AI result and strip fields with confidence < 0.40
 * Defensive: Edge Function should already do this, but we double-check
 * 
 * @param raw - Raw AI analysis result
 * @returns Filtered AI analysis result
 */
export function parseAIResult(raw: AIAnalysisResult): AIAnalysisResult {
  const filtered: AIAnalysisResult = {};

  const meetsConfidence = (field?: AIFieldResult<any>, minConfidence = CONFIDENCE_MEDIUM): boolean => {
    return field !== undefined && field.confidence >= minConfidence;
  };

  // Filter each field by confidence
  if (meetsConfidence(raw.title)) {
    filtered.title = raw.title;
  }

  if (meetsConfidence(raw.category)) {
    filtered.category = raw.category;
  }

  if (meetsConfidence(raw.condition)) {
    filtered.condition = raw.condition;
  }

  if (meetsConfidence(raw.brand)) {
    filtered.brand = raw.brand;
  }

  if (meetsConfidence(raw.color, CONFIDENCE_LOW)) {
    filtered.color = raw.color;
  }

  if (meetsConfidence(raw.age_group, CONFIDENCE_LOW)) {
    filtered.age_group = raw.age_group;
  }

  if (meetsConfidence(raw.gender, CONFIDENCE_LOW)) {
    filtered.gender = raw.gender;
  }

  // Preserve raw labels and error if present
  if (raw.rawLabels) {
    filtered.rawLabels = raw.rawLabels;
  }

  if (raw.error) {
    filtered.error = raw.error;
  }

  return filtered;
}

/**
 * Get AI confidence level from score
 * Returns 'high' | 'medium' | 'low' per Rule 3
 * 
 * >= 0.70: high
 * 0.40-0.69: medium
 * < 0.40: low
 * 
 * @param score - Confidence score (0-1)
 * @returns Confidence level
 */
export function getAIConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= CONFIDENCE_HIGH) {
    return 'high';
  }
  
  if (score >= CONFIDENCE_MEDIUM) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Analyze single photo (wrapper for batch with 1 item)
 * 
 * @param photoUrl - Photo URL to analyze
 * @param sellerId - Current seller ID
 * @returns AI analysis result or error
 */
export async function analyzeSinglePhoto(
  photoUrl: string,
  sellerId: string
): Promise<AIAnalysisResult | { error: string }> {
  const result = await analyzePhotosBatch(
    [
      {
        groupId: 'single',
        primaryPhotoUrl: photoUrl,
        allPhotoUrls: [photoUrl],
      },
    ],
    sellerId
  );

  const firstResult = result.results[0];
  
  if (firstResult?.error) {
    return { error: firstResult.error };
  }
  
  if (firstResult?.analysis) {
    return firstResult.analysis;
  }
  
  return { error: 'No analysis result' };
}
