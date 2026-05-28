/**
 * File: p2p-kids-marketplace/src/constants/fees.ts
 *
 * Platform fees are now driven by admin_config:
 *   key=transaction_fee_subscriber_cents     (default: 99  = $0.99)
 *   key=transaction_fee_non_subscriber_cents (default: 299 = $2.99)
 *
 * Use getPlatformFeeCents(isSubscriber) from @/services/adminConfig
 * wherever a platform fee is needed. These constants have been removed.
 */

export const SP_CAP_PERCENT = 0.5; // 50% max of item price payable with SP
