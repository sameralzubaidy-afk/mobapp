/**
 * FILE: supabase/functions/_shared/aiTypes.ts
 * MODULE: MODULE-04-ITEM-LISTING-V3
 * TASK: LISTING-V3-002 - AI Analysis Types (shared between edge functions and client)
 * 
 * Shared TypeScript types for AI analysis results.
 * Must match client-side types in p2p-kids-marketplace/src/types/listing.ts
 */

/**
 * Generic AI field result with value and confidence score
 */
export interface AIFieldResult<T> {
  value: T;
  confidence: number;
}

/**
 * Complete AI analysis result for an item photo
 * All fields are optional - only fields with confidence >= 0.40 are included
 */
export interface AIAnalysisResult {
  /** Item title extracted from labels/OCR */
  title?: AIFieldResult<string>;
  
  /** Matched category with fuzzy matching */
  category?: AIFieldResult<{ 
    label: string; 
    categoryId: string | null; 
  }>;
  
  /** Item condition inferred from labels */
  condition?: AIFieldResult<'new' | 'like_new' | 'good' | 'fair' | 'worn'>;
  
  /** Brand name (matched against PREDEFINED_BRANDS or from labels) */
  brand?: AIFieldResult<string>;
  
  /** Dominant colors from image */
  color?: AIFieldResult<string[]>;
  
  /** Age group inferred from labels */
  age_group?: AIFieldResult<'0-2' | '3-5' | '6-8' | '9-12' | '13+'>;
  
  /** Gender inferred from labels */
  gender?: AIFieldResult<'boy' | 'girl' | 'unisex'>;
  
  /** Raw Google Vision labels for debugging */
  rawLabels?: string[];
  
  /** Error message if analysis failed */
  error?: string;
}

/**
 * Request format for analyze-item-image
 */
export interface AnalyzeImageRequest {
  photoUrl: string;
  sellerId: string;
  requestFields?: ('title' | 'category' | 'condition' | 'brand' | 'color' | 'age_group' | 'gender')[];
}

/**
 * Request format for batch-analyze-items
 */
export interface BatchAnalyzeRequest {
  items: Array<{
    groupId: string;
    primaryPhotoUrl: string;
    allPhotoUrls?: string[];
  }>;
  sellerId: string;
}

/**
 * Response format for batch-analyze-items
 */
export interface BatchAnalyzeResponse {
  results: Array<{
    groupId: string;
    analysis?: AIAnalysisResult;
    error?: string;
  }>;
  totalProcessed: number;
  totalFailed: number;
}
