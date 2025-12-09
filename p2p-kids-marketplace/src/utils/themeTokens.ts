// File: p2p-kids-marketplace/src/utils/themeTokens.ts
import { useToken } from 'native-base';

/**
 * Safely resolves NativeBase theme tokens to actual values.
 * Prevents "Unable to convert string to floating point value" errors
 * by ensuring tokens are resolved before passing to native components.
 */
export function useResolvedToken<T = any>(tokenKey: string, fallback?: T): T {
  try {
    // useToken will throw if token doesn't exist, so we catch and return fallback
    return useToken(tokenKey) as T;
  } catch {
    return fallback as T;
  }
}

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