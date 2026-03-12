#!/bin/bash
# FILE: p2p-kids-marketplace/scripts/simulate-old-payment-failure.js
# Helper script for Maestro tests to simulate an old payment failure (>24 hours)

USER_EMAIL=${USER_EMAIL:-"test-payment-failure@example.com"}
HOURS_AGO=${HOURS_AGO:-26}

echo "Simulating old payment failure for $USER_EMAIL ($HOURS_AGO hours ago)"

# Run SQL to backdate payment_failed_at timestamp
cat <<EOF | npx supabase db execute
-- Backdate payment_failed_at for test user
UPDATE public.subscriptions
SET 
  payment_failed_at = NOW() - INTERVAL '$HOURS_AGO hours',
  payment_retry_count = 1
WHERE user_id = (SELECT id FROM auth.users WHERE email = '$USER_EMAIL');
EOF

echo "Old payment failure simulated"
