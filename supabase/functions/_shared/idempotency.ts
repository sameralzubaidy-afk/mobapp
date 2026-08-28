// File: supabase/functions/_shared/idempotency.ts
// Shared helper for building deterministic Stripe idempotency keys.
//
// WHY THIS EXISTS:
//   Stripe idempotency keys must be stable across retries of the SAME logical
//   operation (so a double-tap / timeout-retry is deduped) but DIFFERENT for
//   distinct operations (so a legitimately different request gets a new key).
//   `hashContent` deterministically folds the content fields of a request into
//   a short string so callers can build content-derived keys like
//   `refund_${tradeId}_${hashContent(price, fee, tax)}`.
//
// Canonical source: this is the shared home for the djb2 helper that previously
// lived only as a LOCAL copy in `create-trade-offer/index.ts` (L158). New code
// should import from here. djb2 is fast, stable, and only used to build a key
// string — never for crypto.

export function hashContent(...parts: Array<string | number>): string {
  let h = 5381;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    }
  }
  return h.toString(36);
}
