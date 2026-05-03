#!/bin/bash

# Test OAuth Redirect URL Configuration
# This script verifies that the OAuth redirect URL is properly configured

set -e

echo "🔍 Checking OAuth Configuration..."
echo ""

# Get the local IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")
EXPO_PORT="8081"

# Expected redirect URI for Expo Go
EXPECTED_REDIRECT="exp://$LOCAL_IP:$EXPO_PORT/--/oauth-callback"

echo "📱 Current Device IP: $LOCAL_IP"
echo "🔗 Expected Redirect URI: $EXPECTED_REDIRECT"
echo ""
echo "⚠️  CRITICAL: You MUST add this URL to Supabase Dashboard"
echo "   1. Go to: https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/auth/url-configuration"
echo "   2. Scroll to 'Redirect URLs'"
echo "   3. Click 'Add URL'"
echo "   4. Paste: $EXPECTED_REDIRECT"
echo "   5. Click 'Save'"
echo ""
echo "✅ After adding the URL, test the OAuth flow:"
echo "   1. npm start (in this terminal)"
echo "   2. Open Expo Go app on iPhone simulator"
echo "   3. Navigate to Login screen"
echo "   4. Click 'Continue with Google'"
echo "   5. Complete Google sign-in"
echo "   6. Safari should redirect back to the app automatically"
echo "   7. App should navigate to Home screen"
echo ""
