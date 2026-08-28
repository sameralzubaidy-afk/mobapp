// File: p2p-kids-marketplace/src/utils/submissionNonce.ts
// DT-18 (2026-08-28): per-submission nonce for the Stripe PaymentIntent idempotency key.
// Each NEW offer/checkout submission must get a genuinely unique nonce (so a re-offer after
// a cancelled trade doesn't collide with the prior attempt's Stripe key — 409 "same
// parameters"), while retries of the SAME submission reuse it (double-tap still dedupes to
// one hold).
//
// Uses expo-crypto's randomUUID when available; falls back to a time+random string so the
// helper is stable under jest-expo (where Crypto.randomUUID() resolves to undefined) and on
// any device where the native module is unavailable.
import * as Crypto from 'expo-crypto';

export function generateSubmissionNonce(): string {
  try {
    const uuid = Crypto.randomUUID();
    if (typeof uuid === 'string' && uuid.length > 0) return uuid;
  } catch {
    // fall through to the time+random fallback below
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
