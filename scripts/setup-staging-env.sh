#!/bin/bash

# ============================================
# Environment Configuration Script
# ============================================
# Manages staging environment variables across
# mobile app, admin panel, and EAS
#
# Usage:
#   ./scripts/setup-staging-env.sh [init|update|verify]
#
# Examples:
#   ./scripts/setup-staging-env.sh init      # Initialize staging env variables
#   ./scripts/setup-staging-env.sh update    # Update existing variables
#   ./scripts/setup-staging-env.sh verify    # Verify all variables are set

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

init_staging_env() {
    print_header "Initializing Staging Environment Variables"

    # Mobile app .env.staging
    if [ ! -f "$PROJECT_ROOT/p2p-kids-marketplace/.env.staging" ]; then
        print_warning "Creating .env.staging for mobile app..."
        cat > "$PROJECT_ROOT/p2p-kids-marketplace/.env.staging" << 'EOF'
# Staging Environment Variables - Mobile App
APP_ENV=staging
EXPO_PUBLIC_ENVIRONMENT=staging
EXPO_PUBLIC_SUPABASE_URL=https://drntwgporzabmxdqykrp.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_jB2O2EoLoNrZxFdVVqxrZQ_GbOuv3HB
EXPO_PUBLIC_SENTRY_DSN=https://c40f622af126bb57a43c9912f3b50c45@o4510507009114112.ingest.us.sentry.io/4510514140610560
EXPO_PUBLIC_SENTRY_ENVIRONMENT=staging
EXPO_PUBLIC_SENTRY_TRACES_RATE=0.1
EXPO_PUBLIC_AMPLITUDE_API_KEY=f0b9815a57209e8ffb4a396bfc764133
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
EXPO_PUBLIC_DOMAIN=staging.p2pkidsmarketplace.com
EXPO_PUBLIC_APP_URL=https://staging.p2pkidsmarketplace.com
EXPO_PUBLIC_ADMIN_URL=https://admin-staging.p2pkidsmarketplace.com
EXPO_PUBLIC_ENABLE_ANALYTICS=true
EXPO_PUBLIC_ENABLE_ERROR_TRACKING=true
EXPO_PUBLIC_DEBUG_MODE=true
EOF
        print_success "Created .env.staging for mobile app"
    else
        print_warning ".env.staging already exists for mobile app"
    fi

    # Admin panel .env.staging
    if [ ! -f "$PROJECT_ROOT/p2p-kids-admin/.env.staging" ]; then
        print_warning "Creating .env.staging for admin panel..."
        cat > "$PROJECT_ROOT/p2p-kids-admin/.env.staging" << 'EOF'
# Staging Environment Variables - Admin Panel
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_SUPABASE_URL=https://drntwgporzabmxdqykrp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_jB2O2EoLoNrZxFdVVqxrZQ_GbOuv3HB
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3NzU2NSwiZXhwIjoyMDgwODUzNTY1fQ.YOURCUSTOMTOKEN
NEXT_PUBLIC_SENTRY_DSN=https://c40f622af126bb57a43c9912f3b50c45@o4510507009114112.ingest.us.sentry.io/4510514140610560
NEXT_PUBLIC_SENTRY_ENVIRONMENT=staging
SENTRY_AUTH_TOKEN=YOUR_SENTRY_AUTH_TOKEN
NEXT_PUBLIC_AMPLITUDE_API_KEY=f0b9815a57209e8ffb4a396bfc764133
NEXT_PUBLIC_DOMAIN=admin-staging.p2pkidsmarketplace.com
NEXT_PUBLIC_APP_URL=https://staging.p2pkidsmarketplace.com
NEXT_PUBLIC_FEATURE_ANALYTICS=true
NEXT_PUBLIC_FEATURE_ERROR_TRACKING=true
EOF
        print_success "Created .env.staging for admin panel"
    else
        print_warning ".env.staging already exists for admin panel"
    fi

    # Create .env.example files if they don't exist
    if [ ! -f "$PROJECT_ROOT/p2p-kids-marketplace/.env.local.example" ]; then
        cp "$PROJECT_ROOT/p2p-kids-marketplace/.env.staging" "$PROJECT_ROOT/p2p-kids-marketplace/.env.local.example"
        print_success "Created .env.local.example for mobile app"
    fi

    print_success "Environment initialization complete"
}

verify_staging_env() {
    print_header "Verifying Staging Environment Variables"

    local missing=0

    # Check mobile app
    echo -e "${BLUE}Mobile App (.env.staging):${NC}"
    local mobile_vars=(
        "APP_ENV"
        "EXPO_PUBLIC_ENVIRONMENT"
        "EXPO_PUBLIC_SUPABASE_URL"
        "EXPO_PUBLIC_SUPABASE_ANON_KEY"
        "EXPO_PUBLIC_SENTRY_DSN"
    )

    if [ -f "$PROJECT_ROOT/p2p-kids-marketplace/.env.staging" ]; then
        for var in "${mobile_vars[@]}"; do
            if grep -q "^$var=" "$PROJECT_ROOT/p2p-kids-marketplace/.env.staging"; then
                echo -e "${GREEN}  ✓ $var${NC}"
            else
                echo -e "${RED}  ✗ $var (missing)${NC}"
                ((missing++))
            fi
        done
    else
        print_error "Mobile app .env.staging not found"
        ((missing++))
    fi

    # Check admin panel
    echo -e "${BLUE}Admin Panel (.env.staging):${NC}"
    local admin_vars=(
        "NEXT_PUBLIC_ENVIRONMENT"
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
    )

    if [ -f "$PROJECT_ROOT/p2p-kids-admin/.env.staging" ]; then
        for var in "${admin_vars[@]}"; do
            if grep -q "^$var=" "$PROJECT_ROOT/p2p-kids-admin/.env.staging"; then
                echo -e "${GREEN}  ✓ $var${NC}"
            else
                echo -e "${RED}  ✗ $var (missing)${NC}"
                ((missing++))
            fi
        done
    else
        print_error "Admin panel .env.staging not found"
        ((missing++))
    fi

    # Check EAS secrets
    echo -e "${BLUE}EAS Secrets:${NC}"
    if command -v eas &> /dev/null && eas whoami &> /dev/null; then
        echo "Checking EAS project secrets..."
        if eas secret:list 2>/dev/null | grep -q "SUPABASE_URL"; then
            echo -e "${GREEN}  ✓ EAS secrets configured${NC}"
        else
            echo -e "${YELLOW}  ⚠ EAS secrets not yet created${NC}"
            echo "    Run: eas secret:create --scope project --name SUPABASE_URL --value 'https://...'"
        fi
    else
        echo -e "${YELLOW}  ⚠ EAS not authenticated${NC}"
    fi

    if [ $missing -eq 0 ]; then
        print_success "All environment variables verified"
    else
        print_error "$missing environment variables missing or incorrect"
        exit 1
    fi
}

update_staging_env() {
    print_header "Update Staging Environment Variables"

    echo -e "${YELLOW}Enter values to update (or press Enter to skip):${NC}"

    read -p "Supabase URL [$(grep EXPO_PUBLIC_SUPABASE_URL "$PROJECT_ROOT/p2p-kids-marketplace/.env.staging" | cut -d= -f2)]: " supabase_url
    if [ -n "$supabase_url" ]; then
        sed -i '' "s|^EXPO_PUBLIC_SUPABASE_URL=.*|EXPO_PUBLIC_SUPABASE_URL=$supabase_url|" "$PROJECT_ROOT/p2p-kids-marketplace/.env.staging"
        sed -i '' "s|^NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$supabase_url|" "$PROJECT_ROOT/p2p-kids-admin/.env.staging"
        print_success "Updated Supabase URL"
    fi

    read -p "Stripe Publishable Key: " stripe_key
    if [ -n "$stripe_key" ]; then
        sed -i '' "s|^EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=.*|EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=$stripe_key|" "$PROJECT_ROOT/p2p-kids-marketplace/.env.staging"
        print_success "Updated Stripe key"
    fi

    print_success "Environment variables updated"
}

show_help() {
    cat << EOF
Staging Environment Setup Script

Usage: ./scripts/setup-staging-env.sh [command]

Commands:
  init      Initialize staging environment variables
  update    Update existing variables (interactive)
  verify    Verify all variables are properly set

Examples:
  ./scripts/setup-staging-env.sh init
  ./scripts/setup-staging-env.sh verify
  ./scripts/setup-staging-env.sh update

EOF
}

# Main
case "${1:-help}" in
    init)
        init_staging_env
        ;;
    update)
        update_staging_env
        ;;
    verify)
        verify_staging_env
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
