// File: p2p-kids-marketplace/src/utils/__tests__/dbTimestamp.test.ts
//
// FIX-Task-24 item 9 — the formatter must be TIMEZONE-INDEPENDENT: the same input
// renders the same string no matter what zone the test runner (or a device) is in.
// That is the regression the helper exists to prevent (QA read "Sep 11, 2026" for a
// `2026-09-12T01:46Z` row and filed a false data mismatch).

import { formatDbTimestamp, formatDbDate } from '../dbTimestamp';

describe('formatDbTimestamp', () => {
  it('renders an explicit UTC instant, not a local one', () => {
    expect(formatDbTimestamp('2026-09-12T01:46:00Z')).toBe('Sep 12, 2026, 1:46 AM UTC');
  });

  it('keeps the UTC calendar day even when local time would be the day before', () => {
    // 01:46 UTC is 2026-09-11 21:46 in UTC−4 — the exact near-miss this guards.
    expect(formatDbTimestamp('2026-09-12T01:46:00Z')).toContain('Sep 12, 2026');
    expect(formatDbTimestamp('2026-09-12T01:46:00Z')).not.toContain('Sep 11');
  });

  it('formats noon and midnight as 12 (never 0 AM/PM)', () => {
    expect(formatDbTimestamp('2026-09-12T00:05:00Z')).toBe('Sep 12, 2026, 12:05 AM UTC');
    expect(formatDbTimestamp('2026-09-12T12:05:00Z')).toBe('Sep 12, 2026, 12:05 PM UTC');
  });

  it('pads minutes and switches to PM in the afternoon', () => {
    expect(formatDbTimestamp('2026-09-12T13:07:00Z')).toBe('Sep 12, 2026, 1:07 PM UTC');
  });

  it('handles a non-UTC offset input by converting to UTC', () => {
    expect(formatDbTimestamp('2026-09-11T21:46:00-04:00')).toBe('Sep 12, 2026, 1:46 AM UTC');
  });

  it('returns null for empty or unparseable input so callers can skip rendering', () => {
    expect(formatDbTimestamp(null)).toBeNull();
    expect(formatDbTimestamp(undefined)).toBeNull();
    expect(formatDbTimestamp('')).toBeNull();
    expect(formatDbTimestamp('not-a-date')).toBeNull();
    expect(formatDbDate(null)).toBeNull();
    expect(formatDbDate('not-a-date')).toBeNull();
  });

  it('formatDbDate renders the UTC day with a zone marker', () => {
    expect(formatDbDate('2026-09-12T01:46:00Z')).toBe('Sep 12, 2026 (UTC)');
  });
});
