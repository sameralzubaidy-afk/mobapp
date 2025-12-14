#!/bin/bash

# ============================================
# Staging Deployment Script
# ============================================
# This script automates the staging deployment process
# for both mobile app and admin panel
#
# Usage:
#   ./scripts/deploy-staging.sh [mobile|admin|all]
#
# Prerequisites:
#   - eas-cli installed: npm install -g eas-cli
#   - vercel-cli installed: npm install -g vercel
#   - Logged into EAS: eas login
#   - Logged into Vercel: vercel login
#   - GitHub SSH key configured
#
# Examples:
#   ./scripts/deploy-staging.sh mobile          # Deploy mobile only
#   ./scripts/deploy-staging.sh admin           # Deploy admin only
#   ./scripts/deploy-staging.sh all             # Deploy both

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Functions
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

check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check EAS CLI
    if ! command -v eas &> /dev/null; then
        print_error "eas-cli not found. Install with: npm install -g eas-cli"
        exit 1
    fi
    print_success "eas-cli found"

    # Check Vercel CLI
    if ! command -v vercel &> /dev/null; then
        print_error "vercel-cli not found. Install with: npm install -g vercel"
        exit 1
    fi
    print_success "vercel-cli found"

    # Check EAS login
    if ! eas whoami &> /dev/null; then
        print_error "Not logged into EAS. Run: eas login"
        exit 1
    fi
    print_success "EAS authenticated"

    # Check Vercel login
    if [ ! -d "$HOME/.vercel" ]; then
        print_error "Not logged into Vercel. Run: vercel login"
        exit 1
    fi
    print_success "Vercel authenticated"
}

deploy_mobile() {
    print_header "Deploying Mobile App (Staging)"

    cd "$PROJECT_ROOT/p2p-kids-marketplace"

    # Verify eas.json exists
    if [ ! -f "eas.json" ]; then
        print_error "eas.json not found in p2p-kids-marketplace"
        exit 1
    fi

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_warning "Installing dependencies..."
        npm install
    fi

    # Build iOS staging
    print_header "Building iOS Staging Build"
    eas build --platform ios --profile staging --non-interactive

    # Build Android staging
    print_header "Building Android Staging Build"
    eas build --platform android --profile staging --non-interactive

    print_success "Mobile app builds submitted"
    echo -e "${YELLOW}Check EAS dashboard for build progress:${NC}"
    echo "https://expo.dev/dashboard"
}

deploy_admin() {
    print_header "Deploying Admin Panel (Staging)"

    cd "$PROJECT_ROOT/p2p-kids-admin"

    # Verify package.json exists
    if [ ! -f "package.json" ]; then
        print_error "package.json not found in p2p-kids-admin"
        exit 1
    fi

    # Check if .env.staging exists
    if [ ! -f ".env.staging" ]; then
        print_warning ".env.staging not found. Copy .env.example to .env.staging and fill in values"
        exit 1
    fi

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_warning "Installing dependencies..."
        npm install
    fi

    # Build
    print_warning "Building admin panel..."
    npm run build

    # Deploy to Vercel
    print_warning "Deploying to Vercel staging..."
    vercel --prod --confirm

    print_success "Admin panel deployed to staging"
    echo "URL: https://admin-staging.p2pkidsmarketplace.com"
}

verify_staging() {
    print_header "Verifying Staging Deployment"

    # Check mobile builds
    echo -e "${BLUE}Mobile app builds:${NC}"
    eas build:list --platform ios --limit 5 || print_warning "Could not fetch iOS builds"
    eas build:list --platform android --limit 5 || print_warning "Could not fetch Android builds"

    # Check admin deployment
    echo -e "${BLUE}Admin panel deployment:${NC}"
    if curl -s -I https://admin-staging.p2pkidsmarketplace.com | grep -q "200\|301\|302"; then
        print_success "Admin panel accessible"
    else
        print_warning "Admin panel may not be accessible yet (DNS propagation can take time)"
    fi

    # Check Supabase
    echo -e "${BLUE}Supabase project:${NC}"
    if curl -s https://drntwgporzabmxdqykrp.supabase.co/rest/v1/listings?limit=1 2>/dev/null | grep -q "error\|id"; then
        print_success "Supabase accessible"
    else
        print_warning "Could not verify Supabase connection"
    fi
}

show_help() {
    cat << EOF
Staging Deployment Script

Usage: ./scripts/deploy-staging.sh [mobile|admin|all|verify]

Commands:
  mobile    Deploy mobile app (iOS + Android builds)
  admin     Deploy admin panel to Vercel
  all       Deploy both mobile and admin
  verify    Verify staging environment health

Examples:
  ./scripts/deploy-staging.sh mobile
  ./scripts/deploy-staging.sh admin
  ./scripts/deploy-staging.sh all
  ./scripts/deploy-staging.sh verify

Prerequisites:
  - eas-cli: npm install -g eas-cli
  - vercel-cli: npm install -g vercel
  - Logged into EAS: eas login
  - Logged into Vercel: vercel login

EOF
}

# Main script
if [ $# -eq 0 ]; then
    show_help
    exit 1
fi

case "$1" in
    mobile)
        check_prerequisites
        deploy_mobile
        ;;
    admin)
        check_prerequisites
        deploy_admin
        ;;
    all)
        check_prerequisites
        deploy_mobile
        deploy_admin
        ;;
    verify)
        verify_staging
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        show_help
        exit 1
        ;;
esac

print_success "Deployment script completed"
