#!/usr/bin/env bash
set -euo pipefail

# Setup script to create repo, initial branches and add branch protection using GitHub CLI
# Run this from project root: ./scripts/setup-github-repo.sh <repo-name> <visibility>

REPO_NAME=${1:-p2p-kids-marketplace}
VISIBILITY=${2:-private}

echo "Initializing git and creating GitHub repo: $REPO_NAME (visibility: $VISIBILITY)"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh (GitHub CLI) is required - please install it (https://cli.github.com/)"
  exit 1
fi

git init 2>/dev/null || true
git add .
git commit -m "chore: initial commit" || true

echo "Creating remote repo (if it does not exist)..."
gh repo create "$REPO_NAME" --${VISIBILITY} --source=. --remote=origin --push || true

echo "Creating develop branch and pushing both branches"
git checkout -B develop
git push -u origin develop || true
git checkout -B main
git push -u origin main || true

echo "Setting branch protection on main branch (requires repo admin)"
OWNER=$(gh repo view --json owner -q .owner.login)
REPO=$(gh repo view --json name -q .name)

gh api repos/$OWNER/$REPO/branches/main/protection -X PUT -f required_status_checks='{"strict":true,"contexts":[]}' -f enforce_admins=true -f required_pull_request_reviews='{"required_approving_review_count":1}' -f restrictions=null || true

echo "✅ Repo setup done. Please add secrets (EXPO_TOKEN, SUPABASE_SERVICE_ROLE_KEY, SENTRY_AUTH_TOKEN) via GitHub UI or gh secret set"
echo "Example: gh secret set EXPO_TOKEN -b \"<token>\""
