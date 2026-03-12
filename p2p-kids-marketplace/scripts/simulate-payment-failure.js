#!/bin/bash
# FILE: p2p-kids-marketplace/scripts/simulate-payment-failure.js
# Helper script for Maestro tests to simulate payment failures

USER_EMAIL=${USER_EMAIL:-"test-payment-failure@example.com"}
RETRY_COUNT=${RETRY_COUNT:-1}

echo "Simulating payment failure for $USER_EMAIL (retry_count=$RETRY_COUNT)"

# Run SQL to simulate payment failure
cat <<EOF | npx supabase db execute
-- Simulate payment failure for test user
SELECT public.record_payment_attempt(
  p_user_id := (SELECT id FROM auth.users WHERE email = '$USER_EMAIL'),
  p_success := false
);
EOF

echo "Payment failure simulated successfully"
