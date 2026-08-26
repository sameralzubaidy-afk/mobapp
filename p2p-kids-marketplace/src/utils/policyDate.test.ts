// File: p2p-kids-marketplace/src/utils/policyDate.test.ts
// Unit tests for formatPolicyEffectiveDate — verifies the "Last updated" date
// never shifts across the UTC boundary (ACC-TC-J03/J04 off-by-one fix).

import { formatPolicyEffectiveDate } from './policyDate';

describe('formatPolicyEffectiveDate', () => {
  it('formats a date-only value without a UTC→local day shift', () => {
    // The exact regression case from the QA run: stored 2026-04-02 must render
    // as 4/2/2026 in every timezone (previously showed 4/1/2026 in UTC-x zones).
    expect(formatPolicyEffectiveDate('2026-04-02')).toBe('4/2/2026');
  });

  it('formats an ISO datetime string by its date component', () => {
    expect(formatPolicyEffectiveDate('2026-01-01T00:00:00Z')).toBe('1/1/2026');
    expect(formatPolicyEffectiveDate('2026-03-15T00:00:00Z')).toBe('3/15/2026');
  });

  it('keeps single-digit months/days unpadded to match the app date style', () => {
    expect(formatPolicyEffectiveDate('2026-01-05')).toBe('1/5/2026');
    expect(formatPolicyEffectiveDate('2024-12-25')).toBe('12/25/2024');
  });

  it('falls back to a locale render for a full datetime value', () => {
    const result = formatPolicyEffectiveDate('2026-04-02T00:00:00.000Z');
    expect(result).toBe('4/2/2026');
  });

  it('returns the raw value when the date is unparseable (no crash)', () => {
    expect(formatPolicyEffectiveDate('not-a-date')).toBe('not-a-date');
    expect(formatPolicyEffectiveDate('')).toBe('');
  });
});
