/**
 * Unit tests for fuzzyMatch utility
 * MODULE-05-DISCOVERY-V3: TASK DISCOVERY-V3-004
 */

import { levenshteinDistance, findClosestMatch } from '../../utils/fuzzyMatch';

describe('fuzzyMatch utilities', () => {
  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
      expect(levenshteinDistance('', '')).toBe(0);
    });

    it('should return string length for empty string comparison', () => {
      expect(levenshteinDistance('', 'abc')).toBe(3);
      expect(levenshteinDistance('abc', '')).toBe(3);
    });

    it('should calculate correct distance for single character changes', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('bicycle', 'bycicle')).toBe(2);
    });

    it('should handle case sensitivity', () => {
      expect(levenshteinDistance('Hello', 'hello')).toBe(1);
    });

    it('should calculate distance for completely different strings', () => {
      const dist = levenshteinDistance('abc', 'xyz');
      expect(dist).toBeGreaterThan(0);
    });
  });

  describe('findClosestMatch', () => {
    const candidates = ['bicycle', 'tricycle', 'scooter', 'skateboard'];

    it('should find exact match (distance 0)', () => {
      expect(findClosestMatch('bicycle', candidates, 3)).toBe('bicycle');
    });

    it('should find close typo match (distance 1)', () => {
      expect(findClosestMatch('bycicle', candidates, 3)).toBe('bicycle');
    });

    it('should return null when distance exceeds threshold', () => {
      expect(findClosestMatch('xyz', candidates, 2)).toBeNull();
    });

    it('should be case-insensitive', () => {
      expect(findClosestMatch('BICYCLE', candidates, 3)).toBe('bicycle');
      expect(findClosestMatch('BiCyClE', candidates, 3)).toBe('bicycle');
    });

    it('should handle empty query', () => {
      expect(findClosestMatch('', candidates, 3)).toBeNull();
      expect(findClosestMatch('   ', candidates, 3)).toBeNull();
    });

    it('should handle empty candidates array', () => {
      expect(findClosestMatch('bicycle', [], 3)).toBeNull();
    });

    it('should return the best match when multiple within threshold', () => {
      const result = findClosestMatch('bicycl', candidates, 3);
      expect(result).toBe('bicycle'); // closest match
    });

    it('should handle custom threshold', () => {
      // With threshold 1, 'scootr' is too far from 'scooter'
      expect(findClosestMatch('scootr', candidates, 1)).toBe('scooter');
      
      // With threshold 0, only exact matches work
      expect(findClosestMatch('bicycle', candidates, 0)).toBe('bicycle');
      expect(findClosestMatch('bycicle', candidates, 0)).toBeNull();
    });

    it('should trim whitespace from query', () => {
      expect(findClosestMatch('  bicycle  ', candidates, 3)).toBe('bicycle');
    });
  });
});
