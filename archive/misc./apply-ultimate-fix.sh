#!/bin/bash

# Apply the ultimate test alignment fix migration
echo "Applying ultimate test alignment fix migration..."

cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Apply the migration
supabase db push

echo "Migration applied. Now running tests..."

# Run the failing test suites
npm test -- --testPathPattern="referral-rewards-v2.e2e.ts|payout-router-integration.test.ts|referrals-v2.e2e.ts|referral-listing-bonus.e2e.ts|referralCodeV2.test.ts|referralListingBonus.test.ts|referralRewards.test.ts" --verbose