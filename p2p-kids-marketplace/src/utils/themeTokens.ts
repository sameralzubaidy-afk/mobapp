// File: p2p-kids-marketplace/src/utils/themeTokens.ts

/**
 * Resolves a token synchronously if possible, with fallback
 * For cases where hooks can't be used
 */
export function resolveToken(token: string | number, fallback: number): number {
  if (typeof token === 'number') {
    return token;
  }

  // Common size tokens that should map to numbers
  const sizeMap: Record<string, number> = {
    'xs': 12,
    'sm': 16,
    'md': 20,
    'lg': 24,
    'xl': 32,
    '2xl': 40,
    'small': 16,
    'large': 24,
  };

  return sizeMap[token] ?? fallback;
}

/**
 * Safe wrapper for style properties that might receive theme tokens
 */
export function resolveStyleValue(value: string | number, fallback: number = 0): number {
  if (typeof value === 'number') {
    return value;
  }

  // Try to parse as number first
  const parsed = parseFloat(value);
  if (!isNaN(parsed)) {
    return parsed;
  }

  // Fall back to token resolution
  return resolveToken(value, fallback);
}