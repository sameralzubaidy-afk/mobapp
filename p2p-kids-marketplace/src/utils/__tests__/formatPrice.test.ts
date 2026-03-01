/**
 * Unit tests for formatPrice utility
 * MODULE-11 TASK SUB-010
 */

import { formatPrice } from '../formatPrice';

describe('formatPrice', () => {
  it('should format cents to dollars correctly', () => {
    expect(formatPrice(499)).toBe('$4.99');
    expect(formatPrice(100)).toBe('$1.00');
    expect(formatPrice(1050)).toBe('$10.50');
    expect(formatPrice(12345)).toBe('$123.45');
  });

  it('should handle zero correctly', () => {
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('should handle null and undefined', () => {
    expect(formatPrice(null)).toBe('$0.00');
    expect(formatPrice(undefined)).toBe('$0.00');
  });

  it('should handle fractional cents by rounding', () => {
    expect(formatPrice(999)).toBe('$9.99');
    expect(formatPrice(1)).toBe('$0.01');
  });

  it('should handle large amounts', () => {
    expect(formatPrice(1000000)).toBe('$10000.00');
  });
});
