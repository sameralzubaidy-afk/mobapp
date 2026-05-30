#!/bin/bash

echo "═══════════════════════════════════════════════════════════════"
echo "✅ ADMIN CONFIG PHASE 1 - VERIFICATION REPORT"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check 1: Migration files exist
echo "1️⃣  Checking migration files..."
if [ -f "supabase/migrations/20251216_fix_rpc_admin_config_schema.sql" ]; then
  echo "   ✅ 20251216_fix_rpc_admin_config_schema.sql exists"
else
  echo "   ❌ 20251216_fix_rpc_admin_config_schema.sql MISSING"
fi

if [ -f "supabase/migrations/20250117_fix_hardcoded_trial_days.sql" ]; then
  echo "   ✅ 20250117_fix_hardcoded_trial_days.sql exists (NEW)"
else
  echo "   ❌ 20250117_fix_hardcoded_trial_days.sql MISSING"
fi

echo ""

# Check 2: adminConfig service exists
echo "2️⃣  Checking adminConfig.ts service..."
if [ -f "p2p-kids-marketplace/src/services/adminConfig.ts" ]; then
  echo "   ✅ adminConfig.ts exists"
  
  # Count key functions
  FUNC_COUNT=$(grep -c "^export async function" p2p-kids-marketplace/src/services/adminConfig.ts)
  echo "   ✅ Found $FUNC_COUNT exported functions"
else
  echo "   ❌ adminConfig.ts MISSING"
fi

echo ""

# Check 3: SubscriptionChoiceScreen updated
echo "3️⃣  Checking SubscriptionChoiceScreen.tsx updates..."
if [ -f "p2p-kids-marketplace/src/screens/onboarding/SubscriptionChoiceScreen.tsx" ]; then
  echo "   ✅ SubscriptionChoiceScreen.tsx exists"
  
  if grep -q "getSPMaxPercentage" p2p-kids-marketplace/src/screens/onboarding/SubscriptionChoiceScreen.tsx; then
    echo "   ✅ getSPMaxPercentage imported"
  else
    echo "   ❌ getSPMaxPercentage NOT imported"
  fi
  
  if grep -q '${spMaxPercentage}' p2p-kids-marketplace/src/screens/onboarding/SubscriptionChoiceScreen.tsx; then
    echo "   ✅ Dynamic SP percentage in template"
  else
    echo "   ❌ Dynamic SP percentage NOT found"
  fi
  
  if grep -q "invalidateConfigCache()" p2p-kids-marketplace/src/screens/onboarding/SubscriptionChoiceScreen.tsx; then
    echo "   ✅ Cache invalidation implemented"
  else
    echo "   ❌ Cache invalidation MISSING"
  fi
else
  echo "   ❌ SubscriptionChoiceScreen.tsx MISSING"
fi

echo ""

# Check 4: Documentation files created
echo "4️⃣  Checking documentation..."
DOCS=(
  "ADMIN-CONFIG-COMPREHENSIVE-AUDIT.md"
  "ADMIN-CONFIG-IMPLEMENTATION-ROADMAP.md"
  "ADMIN-CONFIG-TESTING-CHECKLIST.md"
  "ADMIN-CONFIG-PHASE1-SUMMARY.md"
  "ADMIN-CONFIG-QUICK-START.md"
)

for doc in "${DOCS[@]}"; do
  if [ -f "$doc" ]; then
    echo "   ✅ $doc"
  else
    echo "   ❌ $doc MISSING"
  fi
done

echo ""

# Check 5: Verification script
echo "5️⃣  Checking verification script..."
if [ -f "scripts/verify-admin-config.sh" ]; then
  echo "   ✅ verify-admin-config.sh exists"
else
  echo "   ❌ verify-admin-config.sh MISSING"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ VERIFICATION COMPLETE"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "NEXT STEPS:"
echo "1. Deploy migrations to Supabase"
echo "2. Run tests from ADMIN-CONFIG-TESTING-CHECKLIST.md"
echo "3. Verify app works with dynamic config values"
echo "4. Approve Phase 2 (fee calculations)"
echo ""
