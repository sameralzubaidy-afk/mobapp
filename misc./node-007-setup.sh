#!/bin/bash

# NODE-007: Distance Radius Filter - Database Setup & Verification Script
# 
# This script helps you apply the database migration and verify NODE-007 setup
# Usage: ./node-007-setup.sh
#
# IMPORTANT: This script uses Supabase prod environment
# You must have Supabase CLI installed: npm install -g supabase

echo "=================================="
echo "NODE-007: Distance Radius Filter"
echo "Database Setup Script"
echo "=================================="
echo ""

# Step 1: Verify Supabase CLI
echo "Step 1: Checking Supabase CLI..."
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    echo "Install with: npm install -g supabase"
    exit 1
fi
echo "✅ Supabase CLI found"
echo ""

# Step 2: Check migrations folder
echo "Step 2: Checking migrations..."
MIGRATION_FILE="supabase/migrations/20251217000003_user_preferences_and_distance_NODE007.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi
echo "✅ Migration file found: $MIGRATION_FILE"
echo ""

# Step 3: Apply migration to prod
echo "Step 3: Applying migration to Supabase prod..."
echo "⚠️  WARNING: This modifies your PRODUCTION database"
echo "⚠️  Make sure you have a backup!"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Run migration via Supabase
echo ""
echo "Pushing migration..."
# Note: You may need to manually run this in Supabase SQL Editor
# supabase db push  # This pushes to local (not prod)
echo "📋 To apply to PRODUCTION:"
echo "1. Go to: https://app.supabase.com/project/YOUR_PROJECT_ID/sql/new"
echo "2. Paste contents of: $MIGRATION_FILE"
echo "3. Run the SQL"
echo ""

# Step 4: Verification queries
echo "Step 4: Verification queries"
echo "After applying migration, run these in Supabase SQL Editor:"
echo ""
echo "--- Verify user_preferences table ---"
echo "SELECT table_name FROM information_schema.tables WHERE table_name = 'user_preferences';"
echo ""
echo "--- Verify calculate_node_distance function ---"
echo "SELECT proname, pronargs FROM pg_proc WHERE proname = 'calculate_node_distance';"
echo ""
echo "--- Verify RLS policies ---"
echo "SELECT policyname, tablename FROM pg_policies WHERE tablename = 'user_preferences';"
echo ""
echo "--- Verify indexes ---"
echo "SELECT indexname FROM pg_indexes WHERE tablename = 'user_preferences';"
echo ""

# Step 5: Admin config
echo "Step 5: Configure admin settings"
echo ""
echo "Run these SQL statements to set admin config:"
echo ""
cat << 'EOF'
INSERT INTO admin_config (key, value, data_type, description) VALUES
  ('default_radius_miles', '10', 'integer', 'Default search radius for all users'),
  ('min_user_radius_miles', '5', 'integer', 'Minimum radius users can select'),
  ('max_user_radius_miles', '25', 'integer', 'Maximum radius users can select'),
  ('allow_user_radius_adjustment', 'true', 'boolean', 'Allow users to change search radius')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();
EOF
echo ""

echo "✅ Setup script complete!"
echo ""
echo "Next steps:"
echo "1. Apply the migration via Supabase SQL Editor"
echo "2. Run verification queries above"
echo "3. Configure admin settings"
echo "4. Run manual tests from: NODE-007-MANUAL-TEST-GUIDE.md"
echo ""
