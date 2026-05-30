#!/bin/bash
# Quick deployment script for referral attribution fix
# Run this from the repo root: bash QUICK-DEPLOY-REFERRAL-FIX.sh

set -e  # Exit on error

echo "=========================================="
echo "Referral Attribution Fix - Deployment"
echo "=========================================="
echo ""

# ============================================================================
# STEP 1: Preflight Checks
# ============================================================================
echo "Step 1: Running preflight checks..."
echo ""

echo "→ Checking mobile app compilation..."
cd p2p-kids-marketplace
yarn type-check
if [ $? -ne 0 ]; then
  echo "❌ Type check failed! Fix errors before deploying."
  exit 1
fi
echo "✅ Type check passed"

echo "→ Checking mobile app linting..."
yarn lint
if [ $? -ne 0 ]; then
  echo "⚠️  Lint warnings detected (non-blocking)"
fi
echo "✅ Lint check complete"

cd ..

# ============================================================================
# STEP 2: Database Migration (choose one option)
# ============================================================================
echo ""
echo "Step 2: Database migration"
echo ""
echo "Choose deployment method:"
echo "  [1] Supabase CLI (local development)"
echo "  [2] Supabase Dashboard SQL Editor (staging/production)"
echo "  [3] Skip (already applied)"
echo ""
read -p "Enter choice [1-3]: " DB_CHOICE

case $DB_CHOICE in
  1)
    echo "→ Applying migration via Supabase CLI..."
    supabase db push
    if [ $? -eq 0 ]; then
      echo "✅ Migration applied successfully"
    else
      echo "❌ Migration failed! Check Supabase CLI output."
      exit 1
    fi
    ;;
  2)
    echo ""
    echo "📋 Copy this file and run in Supabase Dashboard SQL Editor:"
    echo "   supabase/migrations/20260204000002_fix_referral_with_logging.sql"
    echo ""
    read -p "Press Enter after applying migration in dashboard..."
    ;;
  3)
    echo "⏭️  Skipping database migration"
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

# ============================================================================
# STEP 3: Verify Database State
# ============================================================================
echo ""
echo "Step 3: Verifying database state..."
echo ""
echo "Run these queries in Supabase SQL Editor to verify:"
echo ""
echo "-- Check trigger exists:"
echo "SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'on_auth_user_created';"
echo ""
echo "-- Check debug_logs table exists:"
echo "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'debug_logs';"
echo ""
read -p "✅ Confirm database is ready (press Enter)..."

# ============================================================================
# STEP 4: Mobile App Testing (Development)
# ============================================================================
echo ""
echo "Step 4: Testing mobile app locally"
echo ""
echo "Choose testing method:"
echo "  [1] Test on iOS Simulator"
echo "  [2] Test on Android Emulator"
echo "  [3] Skip to production build"
echo ""
read -p "Enter choice [1-3]: " TEST_CHOICE

case $TEST_CHOICE in
  1)
    echo "→ Starting iOS Simulator..."
    cd p2p-kids-marketplace
    yarn ios &
    echo ""
    echo "📱 Manual testing checklist:"
    echo "   1. Get a valid referral code from an existing user"
    echo "   2. Sign up a new test user WITH that referral code"
    echo "   3. Complete the onboarding flow"
    echo "   4. Check profile in database (see VERIFY-REFERRAL-FIX.sql)"
    echo ""
    read -p "Press Enter after testing complete..."
    cd ..
    ;;
  2)
    echo "→ Starting Android Emulator..."
    cd p2p-kids-marketplace
    yarn android &
    echo ""
    echo "📱 Manual testing checklist:"
    echo "   1. Get a valid referral code from an existing user"
    echo "   2. Sign up a new test user WITH that referral code"
    echo "   3. Complete the onboarding flow"
    echo "   4. Check profile in database (see VERIFY-REFERRAL-FIX.sql)"
    echo ""
    read -p "Press Enter after testing complete..."
    cd ..
    ;;
  3)
    echo "⏭️  Skipping local testing (proceeding to build)"
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

# ============================================================================
# STEP 5: Production Build (optional)
# ============================================================================
echo ""
echo "Step 5: Production build"
echo ""
read -p "Build for production? [y/N]: " BUILD_PROD

if [[ $BUILD_PROD =~ ^[Yy]$ ]]; then
  echo ""
  echo "Choose build profile:"
  echo "  [1] Staging"
  echo "  [2] Production"
  echo ""
  read -p "Enter choice [1-2]: " BUILD_PROFILE
  
  cd p2p-kids-marketplace
  
  case $BUILD_PROFILE in
    1)
      echo "→ Building for staging..."
      eas build --profile staging --platform all
      ;;
    2)
      echo "→ Building for production..."
      eas build --profile production --platform all
      ;;
    *)
      echo "❌ Invalid choice"
      exit 1
      ;;
  esac
  
  cd ..
  echo "✅ Build submitted to EAS"
else
  echo "⏭️  Skipping production build"
fi

# ============================================================================
# FINAL SUMMARY
# ============================================================================
echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "📄 Summary of changes:"
echo "   - Database migration applied (with logging)"
echo "   - Mobile app updated (preserves referral fields)"
echo ""
echo "📋 Next steps:"
echo "   1. Monitor debug logs:"
echo "      SELECT * FROM public.debug_logs"
echo "      WHERE process_name LIKE '%referral%'"
echo "      ORDER BY created_at DESC;"
echo ""
echo "   2. Verify new signups have referral_code:"
echo "      SELECT user_id, email, referral_code, referred_by"
echo "      FROM public.profiles"
echo "      WHERE created_at > NOW() - INTERVAL '1 hour';"
echo ""
echo "   3. Check for errors:"
echo "      SELECT * FROM public.debug_logs"
echo "      WHERE error_message IS NOT NULL"
echo "      ORDER BY created_at DESC LIMIT 20;"
echo ""
echo "📚 Documentation:"
echo "   - Root cause analysis: REFERRAL-ATTRIBUTION-ROOT-CAUSE.md"
echo "   - Complete summary: REFERRAL-FIX-COMPLETE-SUMMARY.md"
echo "   - Verification guide: VERIFY-REFERRAL-FIX.sql"
echo "   - Diagnostics: DIAGNOSE-REFERRAL-ISSUE.sql"
echo ""
echo "=========================================="
