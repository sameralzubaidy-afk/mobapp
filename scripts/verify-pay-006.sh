#!/bin/bash
# PAY-006 Verification Script
# Runs type-check and unit tests for payout router implementation

echo "========================================="
echo "PAY-006 Verification Script"
echo "========================================="
echo ""

cd p2p-kids-marketplace

echo "Step 1: TypeScript Type Check..."
npm run type-check
if [ $? -ne 0 ]; then
  echo "❌ Type check failed"
  exit 1
fi
echo "✅ Type check passed"
echo ""

echo "Step 2: ESLint Check..."
npm run lint
if [ $? -ne 0 ]; then
  echo "⚠️  Lint warnings/errors detected (non-blocking)"
fi
echo "✅ Lint check completed"
echo ""

echo "Step 3: Run Payout Router Unit Tests..."
npm test -- src/services/__tests__/payoutRouter.test.ts
if [ $? -ne 0 ]; then
  echo "❌ Unit tests failed"
  exit 1
fi
echo "✅ Unit tests passed"
echo ""

echo "========================================="
echo "✅ All verification checks passed!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Apply migrations to Supabase production:"
echo "   - supabase/migrations/077_add_auto_payout_admin_config.sql"
echo "   - supabase/migrations/078_payout_router_integration.sql"
echo ""
echo "2. Run manual tests:"
echo "   - Follow .docs/PAY-006-MANUAL-TESTS.md"
echo ""
echo "3. Test in iOS Simulator / Android Emulator:"
echo "   - Complete a trade and verify payout creation"
echo ""
