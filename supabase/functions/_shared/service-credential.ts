// File: supabase/functions/_shared/service-credential.ts
//
// FIX-Task-34 item 4 (2026-09-14) — drift-proof acceptance of a service-role caller.
//
// WHY THIS EXISTS
// ---------------
// The established pattern in several money Edge Functions (`trade-refund`,
// `admin-trade-action`, `complete-trade`, `transactions-update`) is:
//
//     const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
//     const isServiceRole = (presentedBearer === svcKey);
//
// That only ever works while the key the CALLER holds is the exact same string
// as the key the platform INJECTS into the function's environment. It is not:
//
//   * `p2p-kids-marketplace/.env` holds the project's legacy service JWT, and
//     that same key is what the DB triggers/cron post (it is stored in
//     `admin_config.supabase_service_role_key` — see BP-87);
//   * the platform-injected `SUPABASE_SERVICE_ROLE_KEY` is the project's CURRENT
//     service key, which can be a different string (e.g. a rotated JWT, or a
//     new-style `sb_secret_...` key).
//
// Result: the caller's key is perfectly valid for the project — `PostgREST`
// returns HTTP 200 for it — while the function returns `401 UNAUTHORIZED`
// because the strings differ (verified live 2026-09-14: the `.env` service key
// got `200` from `/rest/v1/admin_config` and `401` from `trade-refund`, while
// `release-payment` / `initiate-payout` — which never compare — accepted it).
// This is the same failure shape BP-87 documents for DB-trigger callers.
//
// THE FIX — VERIFY, DON'T COMPARE
// ------------------------------
// Instead of string-comparing the credential to our own env var, ask the PROJECT
// whether the credential is a real service credential: an admin-only Auth call
// (`/auth/v1/admin/users`) succeeds **only** for a valid service-role key. This
// is drift-proof (it accepts any of the project's current service keys) and it
// cannot be spoofed (a forged JWT fails the platform's own signature check).
//
// Fail CLOSED: any error — network, timeout, non-2xx — returns `false`, so the
// caller falls through to the normal user-JWT path and gets a 401/403 rather
// than being let in.
//
// COST: one extra HTTP request, and ONLY when the presented token already looks
// like a service credential (`decodeJwtRole` pre-filter). A normal user JWT is
// rejected locally with zero network calls.

/** Base64url-decode a JWT payload and return its `role` claim. Never throws. */
export function decodeJwtRole(token: string): string | null {
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * Cheap local pre-filter. Keeps us from making an Auth round-trip for every
 * ordinary user JWT. Deliberately narrow: a false NEGATIVE only costs the
 * caller a 401 (visible, safe), whereas a false POSITIVE would add a network
 * hop — so anything unrecognised is rejected here, not accepted.
 */
export function looksLikeServiceCredential(token: string): boolean {
  if (!token) return false;
  if (token.startsWith('sb_secret_')) return true; // new-style secret key
  return decodeJwtRole(token) === 'service_role';
}

/** Injectable for tests — mirrors `fetch`'s signature. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Authoritative check: is `token` a service credential for THIS project?
 * Fail-closed on every error path.
 */
export async function isValidServiceCredential(
  supabaseUrl: string,
  token: string,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  if (!supabaseUrl || !looksLikeServiceCredential(token)) return false;
  try {
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, apikey: token },
    });
    return res.ok;
  } catch {
    return false;
  }
}
