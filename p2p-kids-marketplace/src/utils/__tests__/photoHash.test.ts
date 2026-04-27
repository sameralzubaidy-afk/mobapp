/**
 * Unit tests for photoHash utility (LISTING-V3-006 V3.1, Decision 12).
 * Pure-function tests — does not exercise the native image manipulator.
 */
import {
  hashDistance,
  isNearDuplicate,
  findDuplicateIndices,
  PHOTO_HASH_CONFIG,
} from '../photoHash';

describe('hashDistance', () => {
  it('returns 0 for identical hashes', () => {
    expect(hashDistance('abc123', 'abc123')).toBe(0);
  });

  it('counts differing characters', () => {
    expect(hashDistance('abc123', 'abc124')).toBe(1);
    expect(hashDistance('abcd', 'wxyz')).toBe(4);
  });

  it('returns MAX_SAFE_INTEGER for different-length inputs', () => {
    expect(hashDistance('abc', 'abcd')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('returns MAX_SAFE_INTEGER when either input is empty', () => {
    expect(hashDistance('', 'abc')).toBe(Number.MAX_SAFE_INTEGER);
    expect(hashDistance('abc', '')).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('isNearDuplicate', () => {
  it('returns true only for exact matches', () => {
    const a = 'a'.repeat(20);
    const b = 'a'.repeat(20);
    expect(isNearDuplicate(a, b)).toBe(true);
  });

  it('returns false for non-identical values', () => {
    const a = 'a'.repeat(20);
    const b = 'a'.repeat(19) + 'b';
    expect(isNearDuplicate(a, b)).toBe(false);
  });

  it('exposes exact duplicate distance as 0', () => {
    expect(PHOTO_HASH_CONFIG.EXACT_DUPLICATE_DISTANCE).toBe(0);
  });
});

describe('findDuplicateIndices', () => {
  it('returns empty array for empty input', () => {
    expect(findDuplicateIndices([])).toEqual([]);
  });

  it('returns empty array when all hashes differ', () => {
    expect(findDuplicateIndices(['aaaaaaaa', 'zzzzzzzz', 'bbbbbbbb'])).toEqual([]);
  });

  it('detects exact duplicates after first occurrence', () => {
    const hash = 'a'.repeat(32);
    const result = findDuplicateIndices([hash, hash, hash]);
    expect(result).toEqual([1, 2]);
  });

  it('does not flag near values as duplicates', () => {
    const result = findDuplicateIndices(['abc123', 'abc124', 'abc125']);
    expect(result).toEqual([]);
  });

  it('skips empty (unknown) hashes without false matches', () => {
    const hash = 'a'.repeat(32);
    const result = findDuplicateIndices([hash, '', hash]);
    // Index 1 has empty hash -> skipped; index 2 still detected as dup of 0
    expect(result).toEqual([2]);
  });
});
