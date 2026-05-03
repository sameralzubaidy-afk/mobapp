/**
 * File: p2p-kids-marketplace/src/hooks/useDebouncedValue.ts
 * MODULE-05-DISCOVERY-V3: Debounced Value Hook
 * Task: DISCOVERY-V3-005 - DiscoverScreen (Unified)
 *
 * Custom hook to debounce a value with configurable delay
 */

import { useState, useEffect } from 'react';

/**
 * Debounce a value by delaying updates until the value stops changing
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 *
 * @example
 * const [query, setQuery] = useState('');
 * const debouncedQuery = useDebouncedValue(query, 200);
 *
 * // debouncedQuery only updates 200ms after user stops typing
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up on value change or unmount
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
