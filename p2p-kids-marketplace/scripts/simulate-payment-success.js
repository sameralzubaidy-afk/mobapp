#!/bin/bash
# FILE: p2p-kids-marketplace/scripts/simulate-payment-success.js
# Helper script for Maestro tests to simulate successful payment

USER_EMAIL=${USER_EMAIL:-"test-payment-failure@example.com"}

echo "Simulating successful payment for $USER_EMAIL"

# Run SQL to simulate successful payment (resets retry count)
cat <<EOF | npx supabase db execute
-- Simulate successful payment for test user
SELECT public.record_payment_attempt(
  p_user_id := (SELECT id FROM auth.users WHERE email = '$USER_EMAIL'),
  p_success := true
);
EOF

echo "Successful payment simulated"
