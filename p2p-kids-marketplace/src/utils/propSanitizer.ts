import { resolveStyleValue } from './themeTokens';

/**
 * Detects props that should keep string enum values (e.g. sheet/detent props)
 */
export function isDetentProp(propKey?: string): boolean {
  if (!propKey || typeof propKey !== 'string') return false;
  return /detent|sheet/i.test(propKey);
}

/**
 * Sanitize a single prop value for passing to native: convert theme tokens to numbers
 * for numeric style props, but leave detent/sheet values as-is (they are string enums).
 */
export function sanitizePropValue(propKey: string | undefined, value: any, fallback?: number): any {
  // Keep detent/sheet props unchanged (native expects string enum values)
  if (isDetentProp(propKey)) {
    return value;
  }

  // If value is an array, sanitize each element
  if (Array.isArray(value)) {
    return value.map((v) => sanitizePropValue(propKey, v, fallback));
  }

  // For strings, try to resolve numeric tokens and numeric strings.
  if (typeof value === 'string') {
    // First try parsing a numeric string (e.g. '18' -> 18)
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return parsed;
    }

    // Ask resolveStyleValue to resolve token -> number, but pass NaN as fallback
    // so we can detect when nothing was resolved.
    const resolved = resolveStyleValue(value, NaN);
    if (!isNaN(resolved)) {
      return resolved;
    }

    // Unknown strings should remain unchanged (e.g. 'auto')
    return value;
  }

  // Everything else (numbers, objects, booleans) are returned unchanged
  return value;
}

/**
 * Sanitize a props object shallowly: map through keys and sanitize values.
 * Use this when preparing prop objects destined for native components.
 */
export function sanitizePropsObject<T extends Record<string, any>>(props: T, fallbackNumeric = 0): T {
  const out: Record<string, any> = {};
  for (const key of Object.keys(props)) {
    out[key] = sanitizePropValue(key, props[key], fallbackNumeric);
  }
  return out as T;
}

export default sanitizePropValue;
