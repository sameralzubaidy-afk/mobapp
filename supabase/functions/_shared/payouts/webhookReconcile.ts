// File: supabase/functions/_shared/payouts/webhookReconcile.ts

export type SellerPayoutStatus =
  | 'requires_action'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export type SellerPayoutUpdate = {
  status: SellerPayoutStatus;
  initiated_at?: string;
  completed_at?: string;
  failure_reason?: string;
  updated_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function mapStripePayoutEventToUpdate(eventType: string, payout: { failure_message?: string | null }): SellerPayoutUpdate | null {
  const updated_at = nowIso();

  switch (eventType) {
    case 'payout.created':
    case 'payout.updated':
      return {
        status: 'processing',
        initiated_at: nowIso(),
        updated_at,
      };

    case 'payout.paid':
      return {
        status: 'completed',
        completed_at: nowIso(),
        updated_at,
      };

    case 'payout.failed':
      return {
        status: 'failed',
        failure_reason: payout.failure_message || 'Payout failed',
        updated_at,
      };

    default:
      return null;
  }
}

export function extractPayPalProviderReferenceId(resource: any): string | null {
  // Most PayPal Payouts item events include `payout_batch_id`.
  if (resource?.payout_batch_id) return String(resource.payout_batch_id);

  // Some webhook payloads include a batch header.
  if (resource?.batch_header?.payout_batch_id) return String(resource.batch_header.payout_batch_id);

  return null;
}

export function mapPayPalEventToUpdate(eventType: string, resource: any): SellerPayoutUpdate | null {
  const updated_at = nowIso();

  switch (eventType) {
    case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED':
      return {
        status: 'completed',
        completed_at: nowIso(),
        updated_at,
      };

    case 'PAYMENT.PAYOUTS-ITEM.PROCESSING':
    case 'PAYMENT.PAYOUTSBATCH.PROCESSING':
      return {
        status: 'processing',
        initiated_at: nowIso(),
        updated_at,
      };

    case 'PAYMENT.PAYOUTS-ITEM.FAILED': {
      const errors = Array.isArray(resource?.errors) ? resource.errors : [];
      const failure_reason = errors.map((e: any) => e?.message).filter(Boolean).join('; ') || 'Payout failed';
      return {
        status: 'failed',
        failure_reason,
        updated_at,
      };
    }

    case 'PAYMENT.PAYOUTS-ITEM.BLOCKED':
    case 'PAYMENT.PAYOUTS-ITEM.CANCELED':
    case 'PAYMENT.PAYOUTS-ITEM.DENIED':
    case 'PAYMENT.PAYOUTS-ITEM.RETURNED':
    case 'PAYMENT.PAYOUTS-ITEM.HELD': {
      const failure_reason = `${eventType}: ${resource?.transaction_status || 'Unknown'}`;
      return {
        status: 'failed',
        failure_reason,
        updated_at,
      };
    }

    default:
      return null;
  }
}
