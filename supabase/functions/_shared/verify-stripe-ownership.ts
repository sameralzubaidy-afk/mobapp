// File: supabase/functions/_shared/verify-stripe-ownership.ts
//
// PROD-005: Defense-in-depth ownership verification for Stripe Connect accounts.
//
// Threat model: an authenticated user MUST NOT be able to operate on a Stripe
// Connect account owned by a different user. The existing edge functions
// already enforce this implicitly via `.eq('user_id', user.id)` joins, but
// this helper makes the check explicit, audit-loggable, and reusable for any
// future function that needs it.
//
// Schema: `seller_payout_methods.stripe_account_id` is the source of truth.
// (NOT `profiles.stripe_connect_account_id` — that column does not exist.)

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export interface OwnershipCheck {
  owned: boolean;
  /** Method row id when found, for downstream queries / logging. */
  methodId?: string;
  /** Human-readable failure reason. */
  error?: string;
}

/**
 * Verify the given Stripe Connect account id belongs to the authenticated user.
 * Uses a service-role-scoped Supabase client (RLS bypass) because this is a
 * security check that must succeed even if RLS would have hidden the row.
 *
 * Logs an explicit warning on mismatch for security audit (grep
 * `[verify-stripe-ownership] OWNERSHIP MISMATCH`).
 */
export async function verifyStripeAccountOwnership(
  supabase: SupabaseLike,
  userId: string,
  stripeAccountId: string,
): Promise<OwnershipCheck> {
  if (!userId || !stripeAccountId) {
    return { owned: false, error: 'Missing userId or stripeAccountId' };
  }

  const { data, error } = await supabase
    .from('seller_payout_methods')
    .select('id, user_id, stripe_account_id')
    .eq('stripe_account_id', stripeAccountId)
    .eq('method_type', 'stripe_connect')
    .maybeSingle();

  if (error) {
    console.error('[verify-stripe-ownership] Lookup failed:', {
      userId,
      stripeAccountId,
      error: error.message,
    });
    return { owned: false, error: 'Lookup failed' };
  }

  if (!data) {
    console.warn('[verify-stripe-ownership] OWNERSHIP MISMATCH (no row):', {
      userId,
      stripeAccountId,
    });
    return { owned: false, error: 'Stripe account not found' };
  }

  if (data.user_id !== userId) {
    console.warn('[verify-stripe-ownership] OWNERSHIP MISMATCH:', {
      requestedBy: userId,
      stripeAccountId,
      actualOwner: data.user_id,
    });
    return { owned: false, error: 'Stripe account does not belong to this user' };
  }

  return { owned: true, methodId: data.id };
}

/**
 * Standard 403 response for ownership verification failure.
 */
export function ownershipDeniedResponse(
  detail: string,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'STRIPE_ACCOUNT_OWNERSHIP_DENIED',
        message: 'You do not have permission to access this Stripe account.',
        details: detail,
      },
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
    },
  );
}
