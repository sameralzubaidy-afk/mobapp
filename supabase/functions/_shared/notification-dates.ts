// File: supabase/functions/_shared/notification-dates.ts
//
// FIX-Task-66 item 1 (2026-09-18): NaN-safe date formatting + copy builders for
// user-facing subscription notification bodies.
//
// WHY THIS EXISTS
// `new Date(<absent|unparseable>).toLocaleDateString()` does not throw — it returns
// the LITERAL string "Invalid Date". That leaked into the subscription
// entitlement-deadline notification shipped by `stripe-webhook-subscriptions`
// ("You'll have access until Invalid Date"), which renders verbatim in the app's
// Notification Center. It is reachable because Stripe reports NULL
// `current_period_end` for this environment's subscriptions (systemic — see the
// DEV-TASK-88 note inside `handleSubscriptionUpdated`).
//
// CONTRACT
// Never return a placeholder and never invent a date. `formatNotificationDate`
// returns `null` when the value is unavailable so callers OMIT the date clause
// entirely and the sentence still reads naturally.
//
// The copy builders live here (not in the Edge Function) so Tier 0 unit tests can
// import the REAL implementation instead of a mirrored copy — a mirrored copy
// cannot fail when the guard is removed, so it is not regression evidence.

/**
 * Format an ISO timestamp for notification copy.
 *
 * @returns the formatted date (e.g. "April 30, 2026"), or `null` when `value` is
 *          absent, blank, or unparseable.
 */
export function formatNotificationDate(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Pick the best available access/renewal deadline from an ordered candidate list.
 *
 * Precedence is the caller's responsibility (the ORDER of `candidates`); the first
 * value that formats successfully wins. Returns `null` when none is usable, so the
 * caller omits the date clause.
 *
 * Intended order for a cancellation (see `handleSubscriptionUpdated`):
 *   webhook `current_period_end` -> `subscriptions.current_period_end`
 *   -> `subscriptions.next_billing_date` -> `subscriptions.grace_ends_at`
 */
export function resolveNotificationDeadline(
  candidates: Array<string | null | undefined>,
): string | null {
  for (const candidate of candidates) {
    if (formatNotificationDate(candidate) !== null) {
      return candidate as string;
    }
  }

  return null;
}

export interface NotificationCopy {
  /** Rendered formatted date, or `null` when the date clause was omitted. */
  formattedDate: string | null;
  /** In-app (`user_notifications.body`) copy. */
  body: string;
  /** Push notification copy (shorter). */
  pushBody: string;
}

/**
 * Cancellation-confirmation copy.
 *
 * FIX-Task-50 item 1 (class sweep, 2026-09-17) wording retained: R6 model — during
 * grace the wallet stays SPENDABLE and only new EARNING stops; it freezes when the
 * grace window ends. The hardcoded "90-day" stays dropped because the window length
 * is `admin_config.grace_period_days` (30 on staging).
 */
export function buildCancellationNotificationCopy(
  accessUntil: string | null | undefined,
): NotificationCopy {
  const formattedDate = formatNotificationDate(accessUntil);

  return {
    formattedDate,
    body: formattedDate
      ? `Your Kids Club+ subscription has been cancelled. You'll have access until ${formattedDate}, then a grace period where you can still spend your Swap Points but won't earn new ones.`
      : `Your Kids Club+ subscription has been cancelled. You'll have a grace period where you can still spend your Swap Points but won't earn new ones.`,
    pushBody: formattedDate
      ? `You'll have access until ${formattedDate}. After that you can still spend your Swap Points, but you won't earn new ones.`
      : `Your Kids Club+ subscription has been cancelled. You'll have a grace period where you can still spend your Swap Points, but you won't earn new ones.`,
  };
}

/** Renewal-confirmation copy. */
export function buildRenewalNotificationCopy(
  nextBillingDate: string | null | undefined,
): NotificationCopy {
  const formattedDate = formatNotificationDate(nextBillingDate);

  return {
    formattedDate,
    body: formattedDate
      ? `Your Kids Club+ subscription has been renewed. Your next billing date is ${formattedDate}.`
      : 'Your Kids Club+ subscription has been renewed. Open Manage Kids Club+ to see your next billing date.',
    pushBody: formattedDate
      ? `Your Kids Club+ subscription has been renewed. Next billing: ${formattedDate}.`
      : 'Your Kids Club+ subscription has been renewed. Open Manage Kids Club+ to see your next billing date.',
  };
}
