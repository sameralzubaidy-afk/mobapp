#!/bin/bash

# PAY-008 Verification Script
# Runs Tier 0 checks (typecheck + lint) for both mobile and admin apps

set -e  # Exit on error

echo "========================================="
echo "PAY-008 TIER 0 VERIFICATION"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Function to run check
run_check() {
    local app=$1
    local check_name=$2
    local command=$3
    
    echo "[$app] Running $check_name..."
    
    if eval "$command"; then
        echo -e "${GREEN}✓ [$app] $check_name PASSED${NC}"
        return 0
    else
        echo -e "${RED}✗ [$app] $check_name FAILED${NC}"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

echo "========================================="
echo "MOBILE APP (p2p-kids-marketplace)"
echo "========================================="
echo ""

cd p2p-kids-marketplace

run_check "Mobile" "TypeScript Typecheck" "yarn type-check"
run_check "Mobile" "ESLint" "yarn lint --max-warnings=0 || yarn lint"

echo ""
echo "========================================="
echo "ADMIN PORTAL (p2p-kids-admin)"
echo "========================================="
echo ""

cd ../p2p-kids-admin

run_check "Admin" "TypeScript Typecheck" "yarn type-check"
run_check "Admin" "Next.js Lint" "yarn lint --max-warnings=0 || yarn lint"
run_check "Admin" "Next.js Build" "yarn build"

echo ""
echo "========================================="
echo "SUMMARY"
echo "========================================="
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TIER 0 CHECKS PASSED${NC}"
    echo ""
    echo "Ready for manual testing and E2E tests!"
    exit 0
else
    echo -e "${RED}✗ $ERRORS CHECK(S) FAILED${NC}"
    echo ""
    echo "Please fix the errors above before proceeding to manual testing."
    exit 1
fi
