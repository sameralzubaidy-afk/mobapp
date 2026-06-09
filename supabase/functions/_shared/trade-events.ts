// File: supabase/functions/_shared/trade-events.ts
// TFV2-019: Shared helper for writing to trade_events table.
// Used by create-trade-offer, cancel-trade, complete-trade, trade-payment, etc.

export type TradeEventType =
  | 'offer_submitted'
  | 'offer_accepted'
  | 'offer_cancelled'
  | 'seller_cancelled'
  | 'trade_completed'
  | 'trade_disputed'
  | 'payment_captured'
  | 'payment_failed'
  | 'payout_initiated'
  | 'payout_sent'
  | 'payout_failed';

/**
 * Write an event to trade_events (non-blocking — errors logged but not thrown).
 */
export async function logTradeEvent(
  supabase: { from: (table: string) => any },
  tradeId: string,
  eventType: TradeEventType,
  actorId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase.from('trade_events').insert({
      trade_id: tradeId,
      event_type: eventType,
      actor_id: actorId,
      metadata: metadata ?? {},
    });
    if (error) {
      console.warn(`[logTradeEvent] failed to write event=${eventType} trade=${tradeId}:`, error.message);
    }
  } catch (err) {
    console.warn(`[logTradeEvent] unexpected error:`, err);
  }
}
