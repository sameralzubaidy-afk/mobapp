#!/bin/bash

# File: p2p-kids-marketplace/scripts/test-coverage-module-06.sh
# TASK TRADE-V2-010: Test coverage report for MODULE-06

set -e

echo "=================================================="
echo "MODULE-06 TRADE FLOW V2: Test Coverage Report"
echo "=================================================="
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."

echo "📊 Running unit tests with coverage for trade services..."
npm test -- --coverage --testPathPattern=trade --collectCoverageFrom='src/services/trade.ts' --collectCoverageFrom='src/services/payoutMethods.ts' --collectCoverageFrom='src/services/sellerBalance.ts'

echo ""
echo "=================================================="
echo "✅ Coverage report generated"
echo "=================================================="
echo ""
echo "📁 View detailed report at: coverage/lcov-report/index.html"
echo ""
echo "Target: ≥80% coverage for trade services"
echo ""
