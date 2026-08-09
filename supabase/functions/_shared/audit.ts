// File: supabase/functions/_shared/audit.ts
// N2 — Idempotency & Audit (Cross-Cutting): shared helper to write to the
// unified `financial_audit_log` journal via the `fn_log_financial_audit` RPC.
//
// WHY THIS EXISTS:
//   Every payment / SP / fee / tax state transition must land an audit row so a
//   retried mutation can never double-charge, double-issue SP, or double-log.
//   The RPC is idempotent (ON CONFLICT (idempotency_key) DO NOTHING), so callers
//   pass a deterministic idempotency_key (usually derived from the trade id) and
//   a retry with the same key is a no-op.
//
// Mirrors the logTradeEvent pattern: BEST-EFFORT — errors are logged, never
// thrown, so the audit write can never break the primary operation.

export type FinancialMutationType =
  | 'offer_created'
  | 'payment_intent_created'
  | 'payment_captured'
  | 'payment_capture_failed'
  | 'payment_cancelled'
  | 'refund_issued'
  | 'refund_voided'
  | 'payout_initiated'
  | 'payout_paid'
  | 'payout_requires_action'
  | 'payout_failed'
  | 'sp_reserved'
  | 'sp_restored'
  | 'sp_released'
  | 'sp_issued'
  | 'sp_deducted'
  | 'sp_frozen'
  | 'sp_unfrozen'
  | 'sp_expired'
  | 'buyer_fee_charged'
  | 'seller_fee_deducted'
  | 'tax_quoted'
  | 'tax_collected'
  | 'tax_voided'
  | 'tax_refunded'
  | 'trade_cancelled'
  | 'trade_completed';

export interface FinancialAuditInput {
  mutationType: FinancialMutationType;
  /** e.g. 'trade' | 'refund' | 'payment' | 'payout' | 'wallet' | 'listing' */
  entityType?: string;
  entityId?: string | null;
  /** auth.users.id; null for cron/system events */
  actorId?: string | null;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  /** signed: + credit, - debit */
  amountCents?: number | null;
  /** deterministic key derived from the mutation (e.g. `offer_<tradeId>`); a
   *  retried call with the same key never double-logs. */
  idempotencyKey?: string | null;
  /** N6 node id (resolved by DB trigger when omitted) */
  nodeId?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuditClient = { rpc: (fn: string, args: Record<string, unknown>) => any };

/**
 * Write a financial audit row (non-blocking — errors logged but not thrown).
 * Idempotent: same `idempotencyKey` twice => single row.
 */
export async function logFinancialAudit(
  supabase: AuditClient,
  input: FinancialAuditInput,
): Promise<void> {
  try {
    const { error } = (await supabase.rpc('fn_log_financial_audit', {
      p_mutation_type: input.mutationType,
      p_entity_type: input.entityType ?? null,
      p_entity_id: input.entityId ?? null,
      p_actor_id: input.actorId ?? null,
      p_before_state: input.beforeState ?? {},
      p_after_state: input.afterState ?? {},
      p_amount_cents: input.amountCents ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
      p_node_id: input.nodeId ?? null,
    })) ?? { error: null };

    if (error) {
      console.warn(
        `[logFinancialAudit] failed mutation=${input.mutationType} entity=${input.entityId}:`,
        error.message,
      );
    }
  } catch (err) {
    console.warn('[logFinancialAudit] unexpected error:', err);
  }
}
