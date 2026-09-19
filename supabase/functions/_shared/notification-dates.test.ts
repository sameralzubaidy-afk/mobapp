// File: supabase/functions/_shared/notification-dates.test.ts
//
// FIX-Task-66 item 1 (2026-09-18): regression tests for the subscription
// notification date guard.
//
// Run with: cd /Users/sameralzubaidi/Desktop/kids_marketplace_app && deno test --allow-env supabase/functions/_shared/notification-dates.test.ts
//
// These tests import the REAL implementation (not a mirrored copy), so removing
// the guard genuinely fails them — that is what makes this regression evidence.
//
// TZ note: `toLocaleDateString` renders in the runtime's local timezone, so the
// happy-path assertions check the rendered SHAPE and the presence of the date
// clause rather than a fixed calendar string (which would break in some timezones).
// The guard assertions below are timezone-independent.

import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  buildCancellationNotificationCopy,
  buildRenewalNotificationCopy,
  formatNotificationDate,
  resolveNotificationDeadline,
} from './notification-dates.ts';

const VALID_DATE = '2026-04-30T12:00:00.000Z';
const DATE_CLAUSE_PATTERN = /[A-Z][a-z]+ \d{1,2}, \d{4}/;

// ─────────────────────────────────────────────────────────────────────────────
// formatNotificationDate — the guard itself
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('formatNotificationDate: returns null for absent input (the F1 defect)', () => {
  assertEquals(formatNotificationDate(null), null);
  assertEquals(formatNotificationDate(undefined), null);
});

Deno.test('formatNotificationDate: returns null for blank input (the F1 defect)', () => {
  // `new Date('').toLocaleDateString()` would return the literal "Invalid Date".
  assertEquals(formatNotificationDate(''), null);
  assertEquals(formatNotificationDate('   '), null);
});

Deno.test('formatNotificationDate: returns null for unparseable input (the F1 defect)', () => {
  assertEquals(formatNotificationDate('not-a-date'), null);
  assertEquals(formatNotificationDate('Invalid Date'), null);
  assertEquals(formatNotificationDate('2026-13-45T99:99:99Z'), null);
});

Deno.test('formatNotificationDate: never returns the literal "Invalid Date"', () => {
  const inputs: Array<string | null | undefined> = [
    null,
    undefined,
    '',
    '   ',
    'not-a-date',
    'NaN',
    '0',
    'Invalid Date',
  ];

  for (const input of inputs) {
    const result = formatNotificationDate(input);
    assert(
      result === null || !/invalid|nan/i.test(result),
      `formatNotificationDate(${JSON.stringify(input)}) must not render a placeholder, got: ${result}`,
    );
  }
});

Deno.test('formatNotificationDate: formats a valid ISO timestamp', () => {
  const formatted = formatNotificationDate(VALID_DATE);
  assert(formatted !== null, 'a valid ISO timestamp must produce a formatted date');
  assertMatch(formatted as string, DATE_CLAUSE_PATTERN);
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveNotificationDeadline — precedence / fallback chain
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('resolveNotificationDeadline: first usable candidate wins', () => {
  const resolved = resolveNotificationDeadline([
    null,
    '',
    VALID_DATE,
    '2026-01-01T00:00:00.000Z',
  ]);
  assertEquals(resolved, VALID_DATE);
});

Deno.test('resolveNotificationDeadline: skips unusable candidates and returns null when none work', () => {
  assertEquals(resolveNotificationDeadline([null, undefined, '', 'nope']), null);
  assertEquals(resolveNotificationDeadline([]), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation copy — the exact user-visible defect
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('cancellation copy: valid deadline keeps the date clause (no happy-path regression)', () => {
  const copy = buildCancellationNotificationCopy(VALID_DATE);

  assertEquals(copy.formattedDate !== null, true);
  assertMatch(copy.body, DATE_CLAUSE_PATTERN);
  assert(
    copy.body.includes("You'll have access until"),
    'the happy path must still state the access-until date',
  );
  assertMatch(copy.pushBody, DATE_CLAUSE_PATTERN);
  assert(!/invalid date/i.test(copy.body), 'body must not contain "Invalid Date"');
  assert(!/invalid date/i.test(copy.pushBody), 'push body must not contain "Invalid Date"');
});

Deno.test('cancellation copy: absent deadline OMITS the clause and reads naturally', () => {
  for (const input of [null, undefined, '', 'not-a-date']) {
    const copy = buildCancellationNotificationCopy(input);
    const label = JSON.stringify(input);

    assertEquals(copy.formattedDate, null, `${label}: formattedDate must be null`);
    assert(
      !/invalid/i.test(copy.body),
      `${label}: body must not contain a placeholder — got: ${copy.body}`,
    );
    assert(
      !/invalid/i.test(copy.pushBody),
      `${label}: push body must not contain a placeholder — got: ${copy.pushBody}`,
    );
    assert(
      !copy.body.includes("You'll have access until"),
      `${label}: the date clause must be omitted, not left dangling`,
    );
    assert(
      !copy.pushBody.includes("You'll have access until"),
      `${label}: the push date clause must be omitted, not left dangling`,
    );

    // Still a complete, natural sentence about the grace period.
    assert(
      copy.body.includes('Your Kids Club+ subscription has been cancelled.'),
      `${label}: body must still announce the cancellation`,
    );
    assert(
      copy.body.includes('you can still spend your Swap Points'),
      `${label}: body must still explain the grace period`,
    );
    assert(
      copy.body.trim().endsWith('.'),
      `${label}: body must be a complete sentence — got: ${copy.body}`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Renewal copy — the same class, second call site
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('renewal copy: valid deadline keeps the date clause', () => {
  const copy = buildRenewalNotificationCopy(VALID_DATE);

  assertMatch(copy.body, DATE_CLAUSE_PATTERN);
  assert(
    copy.body.includes('Your next billing date is'),
    'the happy path must still state the next billing date',
  );
});

Deno.test('renewal copy: absent deadline OMITS the clause and reads naturally', () => {
  for (const input of [null, undefined, '', 'not-a-date']) {
    const copy = buildRenewalNotificationCopy(input);
    const label = JSON.stringify(input);

    assertEquals(copy.formattedDate, null, `${label}: formattedDate must be null`);
    assert(
      !/invalid/i.test(copy.body),
      `${label}: body must not contain a placeholder — got: ${copy.body}`,
    );
    assert(
      !copy.body.includes('Your next billing date is'),
      `${label}: the dangling date clause must be omitted`,
    );
    assert(
      copy.body.includes('Your Kids Club+ subscription has been renewed.'),
      `${label}: body must still announce the renewal`,
    );
    assert(
      copy.body.trim().endsWith('.'),
      `${label}: body must be a complete sentence — got: ${copy.body}`,
    );
  }
});
