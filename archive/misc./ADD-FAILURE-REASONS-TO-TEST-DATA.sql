/**
 * Add failure reasons to test payout data
 * This script adds failure_reason values to failed payouts in the test data
 * Run this in Supabase SQL Editor to populate failure reasons for testing
 */

-- Update failed payouts to include failure reasons
UPDATE seller_payouts
SET failure_reason = CASE
    WHEN provider = 'stripe' THEN 'Your bank account was declined. Please verify your account details and try again.'
    WHEN provider = 'paypal' THEN 'PayPal payment failed due to insufficient funds. Please add funds to your PayPal account.'
    ELSE 'Payout failed due to an unknown error. Please contact support.'
END
WHERE status = 'failed' AND failure_reason IS NULL;

-- Verify the update worked
SELECT
    id,
    status,
    provider,
    failure_reason,
    net_amount_cents / 100.0 as net_amount_usd
FROM seller_payouts
WHERE status = 'failed'
ORDER BY created_at DESC;