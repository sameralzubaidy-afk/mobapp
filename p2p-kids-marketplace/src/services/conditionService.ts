/**
 * File: p2p-kids-marketplace/src/services/conditionService.ts
 * MODULE-04 LISTING-V3: Condition Service Layer
 * Task: LISTING-V3-003 - Condition guide and color palette
 *
 * Handles:
 * - Condition guide with photo examples
 * - Popular colors from MODULE-05 V3 COLOR_PALETTE
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLOR_PALETTE } from '../types/discovery';

/**
 * Condition definition with guide
 */
export interface ConditionGuide {
  code: 'new' | 'like_new' | 'good' | 'fair' | 'worn';
  label: string;
  description: string;
  examplePhotoUrl?: string;
  keywords: string[];
}

// Cache key for condition guides
const CONDITION_GUIDE_CACHE_KEY = '@kids_marketplace:condition_guide';

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Condition guides with detailed descriptions
 * These help sellers accurately assess item condition
 */
const CONDITION_GUIDES: ConditionGuide[] = [
  {
    code: 'new',
    label: 'New with Tags',
    description: 'Brand new, never worn or used. Original tags still attached.',
    keywords: ['new', 'nwt', 'new with tags', 'brand new', 'unused'],
  },
  {
    code: 'like_new',
    label: 'Like New',
    description:
      'Excellent condition. May have been worn once or twice, but looks brand new. No visible flaws.',
    keywords: ['like new', 'excellent', 'pristine', 'mint', 'barely used'],
  },
  {
    code: 'good',
    label: 'Good',
    description:
      'Gently used with minor signs of wear. May have slight pilling, fading, or light marks. Still in great shape.',
    keywords: ['good', 'gently used', 'used', 'normal wear'],
  },
  {
    code: 'fair',
    label: 'Fair',
    description:
      'More noticeable wear. May have stains, holes, missing parts, or significant fading. Still functional.',
    keywords: ['fair', 'well used', 'worn', 'stained', 'faded'],
  },
  {
    code: 'worn',
    label: 'Worn',
    description:
      'Heavy wear and tear. Multiple issues like stains, holes, broken parts. May need repairs.',
    keywords: ['worn', 'damaged', 'heavy wear', 'needs repair', 'poor'],
  },
];

/**
 * Get condition guide
 * Returns guides with photo examples
 * Cached for 24 hours in AsyncStorage
 *
 * @returns Array of condition guides
 */
export async function getConditionGuide(): Promise<ConditionGuide[]> {
  try {
    // Check cache first
    const cached = await AsyncStorage.getItem(CONDITION_GUIDE_CACHE_KEY);

    if (cached) {
      const { timestamp, guides } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      // Return cached if within TTL
      if (age < CACHE_TTL_MS) {
        return guides;
      }
    }

    // In future, could fetch real marketplace photo examples from backend
    // For now, return static guides
    const guides = CONDITION_GUIDES;

    // Cache the guides
    await AsyncStorage.setItem(
      CONDITION_GUIDE_CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        guides,
      })
    );

    return guides;
  } catch (error) {
    console.error('[conditionService] Get condition guide error:', error);
    return CONDITION_GUIDES;
  }
}

/**
 * Get condition label by code
 *
 * @param code - Condition code
 * @returns Condition label
 */
export function getConditionLabel(code: string): string {
  const guide = CONDITION_GUIDES.find((g) => g.code === code);
  return guide?.label || code;
}

/**
 * Get popular colors
 * Returns 12-color palette from MODULE-05 V3
 * Re-exports COLOR_PALETTE names
 *
 * @returns Array of color names
 */
export function getPopularColors(): string[] {
  return COLOR_PALETTE.map((color) => color.label);
}

/**
 * Get color hex by ID
 *
 * @param colorId - Color ID
 * @returns Hex color code or null
 */
export function getColorHex(colorId: string): string | null {
  const color = COLOR_PALETTE.find((c) => c.id === colorId);
  return color?.hex || null;
}

/**
 * Get full color palette
 * Returns the complete MODULE-05 V3 color palette
 *
 * @returns Array of color objects
 */
export function getColorPalette() {
  return COLOR_PALETTE;
}

/**
 * Match color name to palette
 * Finds closest match in palette (case-insensitive)
 *
 * @param colorName - Color name from AI or user input
 * @returns Matched color ID or null
 */
export function matchColorToPalette(colorName: string): string | null {
  const normalized = colorName.toLowerCase().trim();

  // Try exact match first
  const exactMatch = COLOR_PALETTE.find(
    (c) => c.label.toLowerCase() === normalized || c.id.toLowerCase() === normalized
  );

  if (exactMatch) {
    return exactMatch.id;
  }

  // Try partial match
  const partialMatch = COLOR_PALETTE.find(
    (c) => c.label.toLowerCase().includes(normalized) || normalized.includes(c.label.toLowerCase())
  );

  return partialMatch?.id || null;
}

/**
 * Validate condition code
 *
 * @param code - Condition code to validate
 * @returns True if valid
 */
export function isValidCondition(code: string): boolean {
  return CONDITION_GUIDES.some((g) => g.code === code);
}
