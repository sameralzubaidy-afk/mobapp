// File: p2p-kids-marketplace/src/utils/policyDate.ts
// Shared date formatting for the legal policy screens (TOS / Privacy / Disclaimer).
//
// Why this exists (ACC-TC-J03/J04 "Last updated" day-off bug): policies store
// `effective_date` as a date-only value (e.g. '2026-04-02'). `new Date('2026-04-02')`
// parses it as UTC midnight, and `toLocaleDateString()` then renders it in the
// device's local timezone — so in a timezone behind UTC the displayed date is
// one day earlier than the stored value (4/1/2026 vs 4/2/2026). We format from
// the raw YYYY-MM-DD components instead, so the displayed date can never shift
// across the UTC boundary and is identical on every device/timezone.

/**
 * Format a policy `effective_date` (date-only 'YYYY-MM-DD' or an ISO datetime
 * string) as `M/D/YYYY` without any UTC→local day shift.
 *
 * - Parses the leading `YYYY-MM-DD` from the value and formats the components
 *   directly (no `Date`/`Intl` timezone conversion).
 * - Falls back to a best-effort locale render only when the value is not a
 *   parseable date (legacy/edge data), so callers never crash.
 */
export function formatPolicyEffectiveDate(effectiveDate: string): string {
  const datePart = (effectiveDate || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);

  if (!match) {
    const parsed = new Date(effectiveDate);
    if (Number.isNaN(parsed.getTime())) {
      return effectiveDate;
    }
    return parsed.toLocaleDateString();
  }

  const [, year, month, day] = match;
  return `${Number(month)}/${Number(day)}/${year}`;
}
