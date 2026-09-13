// File: p2p-kids-marketplace/src/utils/dbTimestamp.ts
//
// FIX-Task-24 item 9 (2026-09-12) — one explicit timezone convention for
// AUDIT/HISTORICAL database timestamps shown to users.
//
// WHY: the buyer's refund card rendered `trade_refunds.created_at` with
// `toLocaleDateString('en-US', ...)`, i.e. in the DEVICE's local zone. QA read
// "Refunded on Sep 11, 2026" while the row's `created_at` was `2026-09-12T01:46Z`
// and filed it as a data mismatch — it was the same instant rendered in UTC−4.
// Every other timestamp in that comparison came from a UTC reading, so the surface
// was the ambiguous one. Rendering the zone explicitly removes the ambiguity for
// good, without depending on the reader's device settings.
//
// SCOPE / DELIBERATE NON-GOAL: this formatter is for AUDIT timestamps (when
// something happened — a refund, a capture, an event). It is intentionally NOT
// applied to DEADLINES (auto-complete / pickup windows / trial end), where local
// time is the correct convention because the user must act by their own clock.
// See the FIX-Task-24 handoff note.
//
// SQL equivalent: `to_char(created_at AT TIME ZONE 'UTC', 'Mon DD, YYYY, HH12:MI AM') || ' UTC'`.

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Format a DB timestamp as an unambiguously-zoned audit string:
 *   `2026-09-12T01:46:00Z` -> `Sep 12, 2026, 1:46 AM UTC`
 *
 * Uses the UTC getters directly (never `toLocale*`), so the output is identical on
 * every device and timezone — the whole point of the helper.
 *
 * @param value ISO timestamp (or anything `new Date()` accepts). Null/undefined/
 *              unparseable input returns `null` so callers can skip rendering
 *              without a truthiness guess.
 */
export function formatDbTimestamp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const hours24 = date.getUTCHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const month = MONTHS[date.getUTCMonth()];

  return `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}, ${hours12}:${minutes} ${suffix} UTC`;
}

/**
 * Date-only variant for audit stamps where the time adds noise but the zone still
 * matters for comparison against a `created_at::date` read:
 *   `2026-09-12T01:46:00Z` -> `Sep 12, 2026 (UTC)`
 */
export function formatDbDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()} (UTC)`;
}
