#!/bin/bash

# Apply the critical SP scoring fix directly to Supabase
# This script recreates the get_recommendations RPC function with corrected scoring logic

set -e  # Exit on error

echo "================================================================"
echo "CRITICAL FIX: SP Prioritization Scoring in Recommendations RPC"
echo "================================================================"
echo ""
echo "⚠️  This fix addresses:"
echo "    1. Items NOT being sorted by SP eligibility for subscribers"
echo "    2. All items showing Score: 10.0 (no SP bonus applied)"
echo "    3. SP-eligible items getting lower priority than expected"
echo ""
echo "Running fix in Supabase using updated migration..."
echo ""

cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Run the updated migration
echo "1️⃣  Applying SQL migration with corrected RPC..."
supabase db push

echo ""
echo "2️⃣  Testing the fix..."

# Test the function with a known subscriber
SUBSCRIBER_ID="5861bf0e-a925-4f2e-8e36-5db45e10608d"

echo ""
echo "Testing with subscriber: $SUBSCRIBER_ID"
echo "Expected: SP-eligible items should have score > 100"
echo "Expected: Cash-only items should have score = 10"
echo ""

# This would need to be run in Supabase SQL Editor manually, but we'll output the query
echo "Copy and paste this into Supabase SQL Editor to verify:"
echo ""
cat << 'EOF'
SELECT 
  id,
  title,
  accepts_swap_points,
  price,
  score
FROM get_recommendations('5861bf0e-a925-4f2e-8e36-5db45e10608d'::UUID, 10)
ORDER BY score DESC, title ASC;
EOF

echo ""
echo "✅ Migration applied!"
echo ""
echo "NEXT STEPS:"
echo "1. Open Supabase SQL Editor (supabase.com → SQL Editor)"
echo "2. Paste the test query above"
echo "3. Expected results:"
echo "   - SP-eligible items: score >= 110"
echo "   - Cash-only items: score = 10"
echo ""
echo "4. Go to the app and refresh the Recommendations carousel"
echo "5. Verify SP-eligible items appear first"
echo ""
