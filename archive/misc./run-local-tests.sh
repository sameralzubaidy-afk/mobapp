#!/bin/bash

# Script to run tests against local Supabase instance
# Usage: ./run-local-tests.sh

# Get local Supabase keys
echo "Getting local Supabase status..."
SUPABASE_STATUS=$(supabase status)

# Extract keys (this is a simple extraction, adjust if needed)
LOCAL_URL="http://localhost:54321"
LOCAL_ANON_KEY=$(echo "$SUPABASE_STATUS" | grep "anon key:" | sed 's/.*anon key: //' | tr -d '\n')
LOCAL_SERVICE_KEY=$(echo "$SUPABASE_STATUS" | grep "service_role key:" | sed 's/.*service_role key: //' | tr -d '\n')

if [ -z "$LOCAL_ANON_KEY" ] || [ -z "$LOCAL_SERVICE_KEY" ]; then
    echo "Failed to extract local Supabase keys. Run 'supabase status' manually."
    exit 1
fi

echo "Setting environment variables for local testing..."
export SUPABASE_URL="$LOCAL_URL"
export SUPABASE_ANON_KEY="$LOCAL_ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$LOCAL_SERVICE_KEY"
export EXPO_PUBLIC_SUPABASE_URL="$LOCAL_URL"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="$LOCAL_ANON_KEY"

echo "Running tests against local Supabase..."
cd p2p-kids-marketplace
RUN_SUPABASE_E2E=true yarn test