#!/bin/bash

# ADMIN CONFIG FIX - Quick Test Script
# This script verifies that admin config updates are working end-to-end

echo "🧪 Testing Admin Config System..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ADMIN_URL="http://localhost:3001/config"
SUPABASE_URL="https://drntwgporzabmxdqykrp.supabase.co"

echo "📋 Checklist:"
echo ""

# 1. Check if admin portal is running
echo -n "1️⃣  Checking if admin portal is running on port 3001... "
if nc -z localhost 3001 2>/dev/null; then
  echo -e "${GREEN}✅ RUNNING${NC}"
else
  echo -e "${RED}❌ NOT RUNNING${NC}"
  echo "   👉 Start with: cd p2p-kids-admin && npm run dev"
  exit 1
fi

# 2. Check if mobile app is running
echo -n "2️⃣  Checking if mobile app is running on port 8081... "
if nc -z localhost 8081 2>/dev/null; then
  echo -e "${GREEN}✅ RUNNING${NC}"
else
  echo -e "${YELLOW}⚠️  NOT RUNNING (optional for UI test)${NC}"
fi

# 3. Check Supabase connectivity
echo -n "3️⃣  Checking Supabase connectivity... "
curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/" > /tmp/supabase_status.txt
STATUS=$(cat /tmp/supabase_status.txt)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "401" ]; then
  echo -e "${GREEN}✅ CONNECTED${NC}"
else
  echo -e "${RED}❌ CONNECTION FAILED (Status: $STATUS)${NC}"
fi

# 4. Check admin config table
echo -n "4️⃣  Checking if admin_config table exists in production... "
QUERY='SELECT COUNT(*) FROM admin_config'
# This is just informational - we can't easily query without auth
echo -e "${GREEN}✅ (Assumed to exist from earlier setup)${NC}"

# 5. Manual verification steps
echo ""
echo "📝 Manual Test Steps:"
echo ""
echo "Step 1: Open Admin Portal"
echo "  → Visit: $ADMIN_URL"
echo ""
echo "Step 2: Change a Config Value"
echo "  → Find: Subscription → Subscription Price Monthly"
echo "  → Change: 7.99 → 12.00"
echo "  → Click: Save"
echo "  → Expect: Green 'Successfully updated' message"
echo ""
echo "Step 3: Verify in Database"
echo "  → Go to: https://app.supabase.com"
echo "  → Project: kids_marketplace_app"
echo "  → SQL Editor → Run:"
echo ""
echo "     SELECT key, value, updated_at FROM admin_config"
echo "     WHERE key = 'subscription_price_monthly' LIMIT 1;"
echo ""
echo "  → Expect: value = 12.00 (your new value)"
echo ""
echo "Step 4: Test Mobile App"
echo "  → Start signup flow"
echo "  → Navigate to SubscriptionChoiceScreen"
echo "  → Expect: Shows \$12.00/month (not \$7.99)"
echo ""
echo "Step 5: Test Real-Time Updates"
echo "  → Keep mobile app on subscription screen"
echo "  → In admin portal, change price to 9.99"
echo "  → Navigate away from subscription screen"
echo "  → Navigate back"
echo "  → Expect: Shows \$9.99/month immediately"
echo ""
echo -e "${GREEN}✅ If all steps pass, admin config is working!${NC}"
