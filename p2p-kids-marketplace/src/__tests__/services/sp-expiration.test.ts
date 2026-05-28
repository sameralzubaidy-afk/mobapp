// File: p2p-kids-marketplace/src/__tests__/services/sp-expiration.test.ts
// MODULE-09 SP-004: Unit tests for SP expiration service

import { describe, it, expect, jest } from '@jest/globals';
import {
  calculateExpirationDate,
  formatDaysUntilExpiry,
  getExpirationWarningColor,
} from '@/services/sp/expiration';

// Mock Supabase client
jest.mock('@/config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe('SP Expiration Service Unit Tests', () => {
  describe('calculateExpirationDate', () => {
    it('should calculate expiration date from current date', () => {
      const daysUntilExpiry = 90;
      const result = calculateExpirationDate(daysUntilExpiry);

      // Use UTC for expected date to match service implementation
      const expectedDate = new Date();
      expectedDate.setUTCDate(expectedDate.getUTCDate() + daysUntilExpiry);

      // Allow 1 hour tolerance for test execution time and timezone boundaries
      const diff = Math.abs(result.getTime() - expectedDate.getTime());
      expect(diff).toBeLessThan(3600000); // 1 hour in milliseconds
    });

    it('should calculate expiration date from custom start date', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const daysUntilExpiry = 30;
      const result = calculateExpirationDate(daysUntilExpiry, startDate);

      const expectedDate = new Date('2024-01-31T00:00:00Z');
      expect(result.toISOString()).toBe(expectedDate.toISOString());
    });

    it('should handle zero days', () => {
      const startDate = new Date('2024-01-01T12:00:00Z');
      const result = calculateExpirationDate(0, startDate);

      expect(result.toISOString()).toBe(startDate.toISOString());
    });

    it('should handle large day counts', () => {
      const daysUntilExpiry = 365;
      const result = calculateExpirationDate(daysUntilExpiry);

      // Use UTC for expected date to match service implementation
      const expectedDate = new Date();
      expectedDate.setUTCDate(expectedDate.getUTCDate() + 365);

      // Allow 1 hour tolerance for timezone boundaries
      const diff = Math.abs(result.getTime() - expectedDate.getTime());
      expect(diff).toBeLessThan(3600000); // 1 hour in milliseconds
    });
  });

  describe('formatDaysUntilExpiry', () => {
    it('should format single day correctly', () => {
      expect(formatDaysUntilExpiry(1)).toBe('Expires in 1 day');
    });

    it('should format multiple days correctly', () => {
      expect(formatDaysUntilExpiry(7)).toBe('Expires in 7 days');
      expect(formatDaysUntilExpiry(30)).toBe('Expires in 30 days');
    });

    it('should handle today expiration', () => {
      expect(formatDaysUntilExpiry(0)).toBe('Expires today');
    });

    it('should handle past expiration', () => {
      expect(formatDaysUntilExpiry(-1)).toBe('Expired 1 day ago');
      expect(formatDaysUntilExpiry(-7)).toBe('Expired 7 days ago');
    });

    it('should handle large day counts', () => {
      expect(formatDaysUntilExpiry(90)).toBe('Expires in 90 days');
      expect(formatDaysUntilExpiry(365)).toBe('Expires in 365 days');
    });
  });

  describe('getExpirationWarningColor', () => {
    it('should return red for urgent warnings (7 days or less)', () => {
      expect(getExpirationWarningColor(0)).toBe('#EF4444');
      expect(getExpirationWarningColor(1)).toBe('#EF4444');
      expect(getExpirationWarningColor(7)).toBe('#EF4444');
    });

    it('should return orange for moderate warnings (8-30 days)', () => {
      expect(getExpirationWarningColor(8)).toBe('#F59E0B');
      expect(getExpirationWarningColor(14)).toBe('#F59E0B');
      expect(getExpirationWarningColor(30)).toBe('#F59E0B');
    });

    it('should return green for distant expirations (31+ days)', () => {
      expect(getExpirationWarningColor(31)).toBe('#10B981');
      expect(getExpirationWarningColor(60)).toBe('#10B981');
      expect(getExpirationWarningColor(90)).toBe('#10B981');
    });

    it('should handle expired batches (negative days)', () => {
      expect(getExpirationWarningColor(-1)).toBe('#EF4444');
      expect(getExpirationWarningColor(-30)).toBe('#EF4444');
    });

    it('should handle boundary conditions', () => {
      expect(getExpirationWarningColor(7)).toBe('#EF4444'); // Last day of red
      expect(getExpirationWarningColor(8)).toBe('#F59E0B'); // First day of orange
      expect(getExpirationWarningColor(30)).toBe('#F59E0B'); // Last day of orange
      expect(getExpirationWarningColor(31)).toBe('#10B981'); // First day of green
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle typical expiration workflow', () => {
      // Scenario: User receives 100 SP today with 90-day expiration
      // Use UTC to avoid DST/timezone issues
      const issueDate = new Date('2024-01-15T00:00:00Z');
      const expiryDate = calculateExpirationDate(90, issueDate);

      // Calculate days remaining at various points using floor division (UTC-safe)
      const day1 = new Date('2024-01-16T00:00:00Z');
      const daysRemaining1 = Math.floor(
        (expiryDate.getTime() - day1.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysRemaining1).toBe(89);

      const day60 = new Date('2024-03-15T00:00:00Z');
      const daysRemaining60 = Math.floor(
        (expiryDate.getTime() - day60.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysRemaining60).toBe(30); // March 15 to April 14 = 30 days

      const day83 = new Date('2024-04-07T00:00:00Z');
      const daysRemaining83 = Math.floor(
        (expiryDate.getTime() - day83.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysRemaining83).toBe(7); // April 7 to April 14 = 7 days

      // Check warning colors at each point
      expect(getExpirationWarningColor(daysRemaining1)).toBe('#10B981'); // Green
      expect(getExpirationWarningColor(daysRemaining60)).toBe('#F59E0B'); // Orange
      expect(getExpirationWarningColor(daysRemaining83)).toBe('#EF4444'); // Red
    });

    it('should handle multiple batches with different expiration dates', () => {
      const today = new Date();
      const batches = [
        { sp: 50, days: 7, source: 'reward' },
        { sp: 100, days: 30, source: 'challenge' },
        { sp: 150, days: 60, source: 'starter_pack' },
      ];

      const batchData = batches.map((batch) => ({
        sp_amount: batch.sp,
        expires_at: calculateExpirationDate(batch.days, today),
        days_until_expiry: batch.days,
        formatted_expiry: formatDaysUntilExpiry(batch.days),
        warning_color: getExpirationWarningColor(batch.days),
      }));

      // Verify urgent batch (7 days)
      expect(batchData[0].warning_color).toBe('#EF4444');
      expect(batchData[0].formatted_expiry).toBe('Expires in 7 days');

      // Verify moderate batch (30 days)
      expect(batchData[1].warning_color).toBe('#F59E0B');
      expect(batchData[1].formatted_expiry).toBe('Expires in 30 days');

      // Verify distant batch (60 days)
      expect(batchData[2].warning_color).toBe('#10B981');
      expect(batchData[2].formatted_expiry).toBe('Expires in 60 days');
    });
  });

  describe('Edge Cases', () => {
    it('should handle DST transitions', () => {
      // Use UTC-based dates to test DST robustness
      // Since we use setUTCDate, DST transitions should not affect the calculation
      const beforeDST = new Date('2024-03-10T00:00:00Z');
      const afterDST = calculateExpirationDate(1, beforeDST);

      // Should be exactly 24 hours (86400000 ms) with UTC math
      const hoursDiff = (afterDST.getTime() - beforeDST.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBe(24);
    });

    it('should handle leap year calculations', () => {
      // 2024 is a leap year, Feb has 29 days
      const leapYearDate = new Date('2024-02-28T00:00:00Z');
      const result = calculateExpirationDate(2, leapYearDate);

      // Feb 28 + 2 days = March 1 (skipping Feb 29)
      // Using UTC: should get UTC date
      expect(result.getUTCDate()).toBe(1);
      expect(result.getUTCMonth()).toBe(2); // March (0-indexed)
      expect(result.getUTCFullYear()).toBe(2024);
    });

    it('should handle year boundaries', () => {
      const endOfYear = new Date('2024-12-31T00:00:00Z');
      const result = calculateExpirationDate(2, endOfYear);

      // Dec 31 + 2 days = Jan 2 of next year
      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCMonth()).toBe(0); // January
      expect(result.getUTCDate()).toBe(2);
    });
  });
});
