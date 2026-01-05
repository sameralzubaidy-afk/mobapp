#!/bin/bash
# MSG-001 Automated Test Runner
# Run this script from the repository root

set -e  # Exit on error

echo "======================================"
echo "MSG-001: Real-time Chat Testing"
echo "======================================"
echo ""

# Navigate to mobile app
cd p2p-kids-marketplace

echo "Step 1: TypeScript Type Check..."
yarn type-check
if [ $? -eq 0 ]; then
  echo "✅ Type check PASSED"
else
  echo "❌ Type check FAILED"
  exit 1
fi

echo ""
echo "Step 2: ESLint..."
yarn lint
if [ $? -eq 0 ]; then
  echo "✅ Lint PASSED"
else
  echo "❌ Lint FAILED"
  exit 1
fi

echo ""
echo "Step 3: Unit Tests (Chat Service)..."
yarn test src/__tests__/services/chat.test.ts
if [ $? -eq 0 ]; then
  echo "✅ Unit tests PASSED"
else
  echo "❌ Unit tests FAILED"
  exit 1
fi

echo ""
echo "======================================"
echo "Tier 0 Tests: ALL PASSED ✅"
echo "======================================"
echo ""
echo "Next Steps:"
echo "1. Apply database migration: supabase/migrations/080_messages_table.sql"
echo "2. Run E2E tests: yarn test src/__tests__/e2e/msg-001-realtime-chat.e2e.ts"
echo "3. Manual testing: See MSG-001-MANUAL-TESTING-GUIDE.md"
echo ""
