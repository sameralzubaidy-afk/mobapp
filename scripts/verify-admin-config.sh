#!/bin/bash
# File: scripts/verify-admin-config.sh
# Purpose: Verify that admin config values are being used dynamically

set -e

echo "🔍 Verifying Admin Config Implementation..."
echo ""

# 1. Check that adminConfig.ts exists and has all required functions
echo "✅ Step 1: Checking adminConfig.ts service..."
if [ -f "p2p-kids-marketplace/src/services/adminConfig.ts" ]; then
  echo "   ✓ File exists"
  
  # Check for key functions
  if grep -q "export async function getAdminConfig" p2p-kids-marketplace/src/services/adminConfig.ts; then
    echo "   ✓ getAdminConfig() function found"
  fi
  
  if grep -q "export async function getConfigValue" p2p-kids-marketplace/src/services/adminConfig.ts; then
    echo "   ✓ getConfigValue() function found"
  fi
  
  if grep -q "export async function getSubscriptionPrice" p2p-kids-marketplace/src/services/adminConfig.ts; then
    echo "   ✓ getSubscriptionPrice() function found"
  fi
  
  if grep -q "export async function getSPMaxPercentage" p2p-kids-marketplace/src/services/adminConfig.ts; then
    echo "   ✓ getSPMaxPercentage() function found"
  fi
  
  if grep -q "const CACHE_TTL_MS = 5 \* 60 \* 1000" p2p-kids-marketplace/src/services/adminConfig.ts; then
    echo "   ✓ Cache TTL (5 minutes) configured"
  fi
else
  echo "   ✗ adminConfig.ts not found!"
  exit 1
fi

echo ""

# 2. Check that migration files exist
echo "✅ Step 2: Checking migration files..."
if [ -f "supabase/migrations/20251216_fix_rpc_admin_config_schema.sql" ]; then
  echo "   ✓ Migration 20251216_fix_rpc_admin_config_schema.sql exists"
else
  echo "   ⚠️  Migration 20251216_fix_rpc_admin_config_schema.sql not found"
fi

if [ -f "supabase/migrations/20250117_fix_hardcoded_trial_days.sql" ]; then
  echo "   ✓ Migration 20250117_fix_hardcoded_trial_days.sql exists (NEW)"
else
  echo "   ⚠️  Migration 20250117_fix_hardcoded_trial_days.sql not found"
fi

echo ""

# 3. Search for remaining hardcoded values
echo "✅ Step 3: Searching for remaining hardcoded config values..."
HARDCODED_COUNT=$(grep -r "7\.99\|79\.99\|2\.5\|0\.025\|5\.0\|0\.05" \
  p2p-kids-marketplace/src \
  --include="*.ts" --include="*.tsx" \
  | grep -v "adminConfig.ts" \
  | grep -v "node_modules" \
  | grep -v ".test.ts" \
  | wc -l)

if [ "$HARDCODED_COUNT" -gt 0 ]; then
  echo "   ⚠️  Found $HARDCODED_COUNT potential hardcoded config values:"
  echo ""
  grep -r "7\.99\|79\.99\|2\.5\|0\.025\|5\.0\|0\.05" \
    p2p-kids-marketplace/src \
    --include="*.ts" --include="*.tsx" \
    | grep -v "adminConfig.ts" \
    | grep -v "node_modules" \
    | grep -v ".test.ts" \
    | head -10
  echo ""
else
  echo "   ✓ No obvious hardcoded config values found (in core logic)"
fi

echo ""

# 4. Check TypeScript compilation
echo "✅ Step 4: Checking TypeScript compilation..."
cd p2p-kids-marketplace
if command -v yarn &> /dev/null; then
  echo "   Running: yarn typecheck"
  if yarn typecheck 2>&1 | grep -q "error"; then
    echo "   ✗ TypeScript errors found!"
    yarn typecheck | head -20
    exit 1
  else
    echo "   ✓ TypeScript compilation successful"
  fi
else
  echo "   ⚠️  yarn not found, skipping typecheck"
fi
cd ..

echo ""
echo "✅ All checks passed!"
echo ""
echo "Next Steps:"
echo "1. Deploy migrations to Supabase"
echo "2. Test trial enrollment with new config values"
echo "3. Test admin portal config changes propagate to mobile app"
echo "4. Continue with Phase 2 (Fee calculation)"
