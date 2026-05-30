/**
 * FILE: supabase/functions/analyze-item-image/index.ts
 * MODULE: MODULE-04-ITEM-LISTING-V3
 * TASK: LISTING-V3-002 - AI Image Analysis Edge Function
 * 
 * Analyzes item photos using Google Vision API and returns:
 * - Title (from labels/OCR)
 * - Category (fuzzy matched against DB categories)
 * - Condition (new, like_new, good, fair, worn)
 * - Brand (matched against predefined list)
 * - Color (dominant colors)
 * - Age group (0-2, 3-5, 6-8, 9-12, 13+)
 * - Gender (boy, girl, unisex)
 * 
 * All fields include confidence scores. Fields with confidence < 0.40 are omitted.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { 
  AIAnalysisResult, 
  AIFieldResult, 
  AnalyzeImageRequest 
} from '../_shared/aiTypes.ts';

const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY');
const GOOGLE_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MIN_CONFIDENCE = 0.40;
const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const VISION_FEATURES = [
  { type: 'LABEL_DETECTION', maxResults: 20 },
  { type: 'TEXT_DETECTION', maxResults: 5 },
  { type: 'IMAGE_PROPERTIES', maxResults: 1 },
  { type: 'LOGO_DETECTION', maxResults: 5 },
];

// Cache for categories
let categoriesCache: { data: any[]; timestamp: number } | null = null;

// Predefined brands for logo matching
const PREDEFINED_BRANDS = [
  'LEGO', 'Fisher-Price', 'Mattel', 'Hasbro', 'Disney', 'Barbie',
  'Hot Wheels', 'Play-Doh', 'Nerf', 'Crayola', 'Melissa & Doug',
  'Little Tikes', 'VTech', 'LeapFrog', 'Baby Einstein', 'Skip Hop',
  'Carter\'s', 'OshKosh', 'Gap Kids', 'Old Navy', 'H&M', 'Zara Kids',
  'Nike', 'Adidas', 'Converse', 'Vans', 'Stride Rite', 'Crocs'
];

function getPrimaryVisionResponse(visionData: any): any {
  return visionData?.responses?.[0] || {};
}

function hasVisionSignals(visionData: any): boolean {
  const primary = getPrimaryVisionResponse(visionData);
  return Boolean(
    (primary.labelAnnotations && primary.labelAnnotations.length > 0) ||
    (primary.logoAnnotations && primary.logoAnnotations.length > 0) ||
    (primary.textAnnotations && primary.textAnnotations.length > 0) ||
    (primary.imagePropertiesAnnotation?.dominantColors?.colors &&
      primary.imagePropertiesAnnotation.dominantColors.colors.length > 0)
  );
}

function shouldUseInlineFallback(visionData: any): boolean {
  const primary = getPrimaryVisionResponse(visionData);
  if (primary.error) {
    return true;
  }

  // Some Vision responses return no error but still have no usable annotations.
  return !hasVisionSignals(visionData);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return base64Encode(new Uint8Array(buffer));
}

/**
 * Levenshtein distance algorithm for fuzzy string matching
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find closest match using Levenshtein distance
 */
function findClosestMatch(
  query: string,
  candidates: string[],
  maxDistance: number = 3
): string | null {
  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  const lowerQuery = query.toLowerCase();

  for (const candidate of candidates) {
    const distance = levenshteinDistance(lowerQuery, candidate.toLowerCase());
    if (distance <= maxDistance && distance < bestDistance) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

/**
 * Fetch categories from database with caching
 */
async function getCategories(): Promise<any[]> {
  const now = Date.now();
  
  if (categoriesCache && (now - categoriesCache.timestamp) < CATEGORY_CACHE_TTL_MS) {
    return categoriesCache.data;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[analyze-item-image] Error fetching categories:', error);
    return [];
  }

  categoriesCache = { data: data || [], timestamp: now };
  return data || [];
}

/**
 * Call Google Vision API with exponential backoff retry
 */
async function callGoogleVision(imageUrl: string, retryCount = 0): Promise<any> {
  const maxRetries = 3;
  const retryDelays = [1000, 2000, 4000]; // 1s, 2s, 4s

  try {
    const response = await fetch(GOOGLE_VISION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: imageUrl } },
          features: VISION_FEATURES
        }]
      })
    });

    if (response.status === 429 && retryCount < maxRetries) {
      // Rate limit - exponential backoff
      const delay = retryDelays[retryCount];
      console.log(`[analyze-item-image] Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGoogleVision(imageUrl, retryCount + 1);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Vision API error: ${response.status} ${errorText}`);
    }

    const visionData = await response.json();

    if (shouldUseInlineFallback(visionData)) {
      const primary = getPrimaryVisionResponse(visionData);
      const reason = primary.error
        ? `${primary.error.code || 'VISION_ERROR'}: ${primary.error.message || 'Unknown error'}`
        : 'No usable labels/properties returned for URL source';

      console.warn(`[analyze-item-image] URL-source Vision response weak, retrying with inline image bytes: ${reason}`);

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image for inline Vision fallback: ${imageResponse.status}`);
      }

      const imageArrayBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = arrayBufferToBase64(imageArrayBuffer);
      
      console.log(`[analyze-item-image] Downloaded image, size: ${imageArrayBuffer.byteLength} bytes, base64 length: ${imageBase64.length}`);
      
      if (imageArrayBuffer.byteLength === 0) {
        throw new Error('Downloaded image is exactly 0 bytes');
      }

      const inlineResponse = await fetch(GOOGLE_VISION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: VISION_FEATURES,
          }],
        }),
      });

      if (!inlineResponse.ok) {
        const inlineErrorText = await inlineResponse.text();
        throw new Error(`Google Vision inline fallback failed: ${inlineResponse.status} ${inlineErrorText}`);
      }

      const inlineData = await inlineResponse.json();
      const inlinePrimary = getPrimaryVisionResponse(inlineData);
      if (inlinePrimary.error) {
        throw new Error(
          `Google Vision inline response error: ${inlinePrimary.error.code || 'VISION_ERROR'} ${inlinePrimary.error.message || ''}`
        );
      }

      return inlineData;
    }

    return visionData;
  } catch (error) {
    if (retryCount < maxRetries) {
      const delay = retryDelays[retryCount];
      console.log(`[analyze-item-image] Error, retrying in ${delay}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGoogleVision(imageUrl, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Extract title from Vision API labels and OCR
 */
function extractTitle(visionData: any): AIFieldResult<string> | null {
  const labels = visionData.responses[0]?.labelAnnotations || [];

  // Product-related keywords for high confidence
  const productKeywords = [
    'toy',
    'book',
    'clothing',
    'shoe',
    'game',
    'doll',
    'car',
    'bike',
    'bicycle',
    'scooter',
    'puzzle',
  ];

  // Try to build a title from top labels
  if (labels.length > 0) {
    const topLabel = labels[0];
    const hasProductKeyword = productKeywords.some(keyword => 
      topLabel.description.toLowerCase().includes(keyword)
    );

    if (hasProductKeyword && topLabel.score >= 0.7) {
      return {
        value: topLabel.description.charAt(0).toUpperCase() + topLabel.description.slice(1),
        confidence: Math.min(topLabel.score, 0.95)
      };
    }

    // Combine top 2-3 labels for a descriptive title
    const titleParts = labels.slice(0, 3).map((l: any) => l.description);
    const title = titleParts.join(' ');
    return {
      value: title.charAt(0).toUpperCase() + title.slice(1),
      confidence: Math.max(labels[0].score * 0.8, MIN_CONFIDENCE)
    };
  }

  return null;
}

/**
 * Match category using fuzzy matching
 */
async function matchCategory(visionData: any): Promise<AIFieldResult<{ label: string; categoryId: string | null }> | null> {
  const labels = visionData.responses[0]?.labelAnnotations || [];
  if (labels.length === 0) return null;

  const categories = await getCategories();
  if (categories.length === 0) return null;

  const categoryNames = categories.map(c => c.name);

  // Try exact match first
  for (const label of labels) {
    const exactMatch = categories.find(c => 
      c.name.toLowerCase() === label.description.toLowerCase()
    );
    if (exactMatch) {
      return {
        value: { label: exactMatch.name, categoryId: exactMatch.id },
        confidence: 1.0
      };
    }
  }

  // Try fuzzy match
  for (const label of labels) {
    const closestMatch = findClosestMatch(label.description, categoryNames, 3);
    if (closestMatch) {
      const category = categories.find(c => c.name === closestMatch);
      if (category) {
        const distance = levenshteinDistance(
          label.description.toLowerCase(), 
          closestMatch.toLowerCase()
        );
        const confidence = Math.max(0.4, 1.0 - (distance * 0.2)); // Linear scale
        
        return {
          value: { label: category.name, categoryId: category.id },
          confidence: Math.min(confidence, 0.9)
        };
      }
    }
  }

  const keywordFallbacks: Array<{ keywords: string[]; label: string; confidence: number }> = [
    { keywords: ['bike', 'bicycle', 'cycling'], label: 'Bikes', confidence: 0.72 },
    { keywords: ['toy', 'plaything', 'doll'], label: 'Toys', confidence: 0.70 },
    { keywords: ['book', 'reading'], label: 'Books', confidence: 0.70 },
    { keywords: ['shoe', 'sneaker', 'boot', 'sandal'], label: 'Shoes', confidence: 0.70 },
  ];

  const allLabelsText = labels.map((l: any) => String(l.description || '').toLowerCase()).join(' ');
  for (const fallback of keywordFallbacks) {
    if (fallback.keywords.some((keyword) => allLabelsText.includes(keyword))) {
      return {
        value: { label: fallback.label, categoryId: null },
        confidence: fallback.confidence,
      };
    }
  }

  // Return best label without category match
  const topLabel = labels[0];
  return {
    value: { label: topLabel.description, categoryId: null },
    confidence: Math.max(topLabel.score * 0.75, 0.45)
  };
}

/**
 * Infer condition from labels
 */
function inferCondition(visionData: any): AIFieldResult<'new' | 'like_new' | 'good' | 'fair' | 'worn'> | null {
  const labels = visionData.responses[0]?.labelAnnotations || [];
  const texts = visionData.responses[0]?.textAnnotations || [];

  const allText = [...labels.map((l: any) => l.description), ...texts.map((t: any) => t.description)]
    .join(' ')
    .toLowerCase();

  const conditionKeywords: Record<string, { keywords: string[]; confidence: number }> = {
    new: { keywords: ['new', 'nwt', 'sealed', 'unopened', 'brand new'], confidence: 0.85 },
    like_new: { keywords: ['like new', 'excellent', 'mint', 'pristine'], confidence: 0.80 },
    good: { keywords: ['good', 'gently used', 'lightly used'], confidence: 0.75 },
    fair: { keywords: ['fair', 'used', 'played with', 'some wear'], confidence: 0.70 },
    worn: { keywords: ['worn', 'heavy use', 'damaged', 'broken'], confidence: 0.75 }
  };

  for (const [condition, { keywords, confidence }] of Object.entries(conditionKeywords)) {
    for (const keyword of keywords) {
      if (allText.includes(keyword)) {
        return {
          value: condition as any,
          confidence
        };
      }
    }
  }

  return null;
}

/**
 * Match brand from logos and labels
 */
function matchBrand(visionData: any): AIFieldResult<string> | null {
  const logos = visionData.responses[0]?.logoAnnotations || [];
  const labels = visionData.responses[0]?.labelAnnotations || [];

  // Check logo matches first (high confidence)
  if (logos.length > 0) {
    const logo = logos[0];
    const brandMatch = findClosestMatch(logo.description, PREDEFINED_BRANDS, 2);
    if (brandMatch) {
      return {
        value: brandMatch,
        confidence: 0.90
      };
    }
  }

  // Check labels for brand keywords
  for (const label of labels) {
    const brandMatch = findClosestMatch(label.description, PREDEFINED_BRANDS, 2);
    if (brandMatch) {
      return {
        value: brandMatch,
        confidence: label.score * 0.8
      };
    }
  }

  return null;
}

/**
 * Extract dominant colors
 */
function extractColors(visionData: any): AIFieldResult<string[]> | null {
  const imageProps = visionData.responses[0]?.imagePropertiesAnnotation;
  if (!imageProps?.dominantColors?.colors) return null;

  const COLOR_MAP: Record<string, string> = {
    'Red': 'Red',
    'Blue': 'Blue',
    'Green': 'Green',
    'Yellow': 'Yellow',
    'Orange': 'Orange',
    'Purple': 'Purple',
    'Pink': 'Pink',
    'Brown': 'Brown',
    'Black': 'Black',
    'White': 'White',
    'Gray': 'Gray',
    'Beige': 'Beige'
  };

  const dominantColors = imageProps.dominantColors.colors
    .filter((c: any) => c.pixelFraction >= 0.02) // At least 2% of pixels
    .slice(0, 3) // Top 3 colors
    .map((c: any) => {
      const rgb = c.color;
      // Simple color name mapping based on RGB
      if (rgb.red > 200 && rgb.green < 100 && rgb.blue < 100) return 'Red';
      if (rgb.red < 100 && rgb.green < 100 && rgb.blue > 200) return 'Blue';
      if (rgb.red < 100 && rgb.green > 200 && rgb.blue < 100) return 'Green';
      if (rgb.red > 200 && rgb.green > 200 && rgb.blue < 100) return 'Yellow';
      if (rgb.red > 200 && rgb.green < 150 && rgb.blue > 150) return 'Pink';
      if (rgb.red > 200 && rgb.green > 150 && rgb.blue < 100) return 'Orange';
      if (rgb.red > 150 && rgb.green < 100 && rgb.blue > 150) return 'Purple';
      if (rgb.red < 50 && rgb.green < 50 && rgb.blue < 50) return 'Black';
      if (rgb.red > 200 && rgb.green > 200 && rgb.blue > 200) return 'White';
      if (rgb.red > 100 && rgb.green > 100 && rgb.blue > 100 && rgb.red < 150) return 'Gray';
      if (rgb.red > 150 && rgb.green > 100 && rgb.blue < 100) return 'Brown';
      return 'Beige';
    })
    .filter((c: string, i: number, arr: string[]) => arr.indexOf(c) === i); // Unique colors

  if (dominantColors.length === 0) return null;

  return {
    value: dominantColors,
    confidence: 0.75
  };
}

/**
 * Infer age group from labels
 */
function inferAgeGroup(visionData: any): AIFieldResult<'0-2' | '3-5' | '6-8' | '9-12' | '13+'> | null {
  const labels = visionData.responses[0]?.labelAnnotations || [];
  const allLabels = labels.map((l: any) => l.description.toLowerCase()).join(' ');

  const ageKeywords: Record<string, string[]> = {
    '0-2': ['baby', 'infant', 'newborn', 'toddler', 'crib', 'nursery'],
    '3-5': ['preschool', 'toddler', 'kindergarten', 'young child'],
    '6-8': ['child', 'elementary', 'school age', 'kid'],
    '9-12': ['tween', 'preteen', 'middle school'],
    '13+': ['teen', 'teenager', 'adolescent', 'young adult']
  };

  for (const [ageGroup, keywords] of Object.entries(ageKeywords)) {
    for (const keyword of keywords) {
      if (allLabels.includes(keyword)) {
        return {
          value: ageGroup as any,
          confidence: 0.65
        };
      }
    }
  }

  return null;
}

/**
 * Infer gender from labels
 */
function inferGender(visionData: any): AIFieldResult<'boy' | 'girl' | 'unisex'> | null {
  const labels = visionData.responses[0]?.labelAnnotations || [];
  const allLabels = labels.map((l: any) => l.description.toLowerCase()).join(' ');

  if (allLabels.includes('boy') || allLabels.includes('boys')) {
    return { value: 'boy', confidence: 0.70 };
  }

  if (allLabels.includes('girl') || allLabels.includes('girls')) {
    return { value: 'girl', confidence: 0.70 };
  }

  return null;
}

/**
 * Main handler
 */
serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }

  try {
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
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired bearer token',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const requestBody = await req.json();
    const hasBatchPayload = Array.isArray(requestBody?.items);

    // Accept both photoUrl and primaryPhotoUrl for single-image analysis compatibility.
    // If the payload is a batch request, return an explicit guidance error.
    const photoUrl = requestBody?.photoUrl ?? requestBody?.primaryPhotoUrl;
    const sellerId = requestBody?.sellerId;
    const requestFields = requestBody?.requestFields;

    if (hasBatchPayload) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'WRONG_ENDPOINT_FOR_BATCH_PAYLOAD',
            message: 'Detected batch payload. Use /functions/v1/batch-analyze-items for items[] requests.',
            details: {
              receivedFields: Object.keys(requestBody || {}),
              expectedSinglePayload: ['photoUrl', 'sellerId', 'requestFields?'],
              expectedBatchEndpoint: '/functions/v1/batch-analyze-items'
            }
          }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!photoUrl || !sellerId) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'Missing photoUrl (or primaryPhotoUrl) or sellerId',
            details: {
              hasPhotoUrl: Boolean(photoUrl),
              hasSellerId: Boolean(sellerId),
              expectedFields: ['photoUrl', 'sellerId', 'requestFields?']
            }
          }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (authData.user.id !== sellerId) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'ANALYZE_OWNERSHIP_DENIED',
            message: 'You can only analyze images for your own seller profile.',
          },
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!GOOGLE_VISION_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Google Vision API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-item-image] Analyzing photo for seller ${sellerId}`);

    // Call Google Vision API
    const visionData = await callGoogleVision(photoUrl);

    // Extract raw labels for debugging
    const rawLabels = (visionData.responses[0]?.labelAnnotations || [])
      .map((l: any) => l.description);

    // Build result based on requested fields (default to all)
    const fields = requestFields || ['title', 'category', 'condition', 'brand', 'color', 'age_group', 'gender'];
    const result: AIAnalysisResult = { rawLabels };

    if (fields.includes('title')) {
      const title = extractTitle(visionData);
      if (title && title.confidence >= MIN_CONFIDENCE) {
        result.title = title;
      }
    }

    if (fields.includes('category')) {
      const category = await matchCategory(visionData);
      if (category && category.confidence >= MIN_CONFIDENCE) {
        result.category = category;
      }
    }

    if (fields.includes('condition')) {
      const condition = inferCondition(visionData);
      if (condition && condition.confidence >= MIN_CONFIDENCE) {
        result.condition = condition;
      }
    }

    if (fields.includes('brand')) {
      const brand = matchBrand(visionData);
      if (brand && brand.confidence >= MIN_CONFIDENCE) {
        result.brand = brand;
      }
    }

    if (fields.includes('color')) {
      const color = extractColors(visionData);
      if (color && color.confidence >= MIN_CONFIDENCE) {
        result.color = color;
      }
    }

    if (fields.includes('age_group')) {
      const ageGroup = inferAgeGroup(visionData);
      if (ageGroup && ageGroup.confidence >= MIN_CONFIDENCE) {
        result.age_group = ageGroup;
      }
    }

    if (fields.includes('gender')) {
      const gender = inferGender(visionData);
      if (gender && gender.confidence >= MIN_CONFIDENCE) {
        result.gender = gender;
      }
    }

    console.log(`[analyze-item-image] Analysis complete:`, {
      fieldsExtracted: Object.keys(result).length,
      rawLabelsCount: rawLabels.length
    });

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );

  } catch (error: any) {
    console.error('[analyze-item-image] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        rawLabels: []
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
});
