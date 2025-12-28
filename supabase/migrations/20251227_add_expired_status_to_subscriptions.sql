-- Migration to add 'expired' status to subscriptions table check constraint
-- This allows simulating subscription expiration in tests

-- Drop the existing check constraint
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;

-- Add the updated check constraint including 'expired'
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('free', 'trial', 'active', 'grace', 'canceled', 'expired'));

-- Verification query
SELECT conname, conrelid::regclass, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'subscriptions_status_check';