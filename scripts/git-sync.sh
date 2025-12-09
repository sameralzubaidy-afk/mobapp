#!/usr/bin/env bash
set -euo pipefail

# git-sync.sh
# Helper script to sync the current branch with origin while handling
# deleted/absent remote branches gracefully.

branch=$(git rev-parse --abbrev-ref HEAD)

echo "Current branch: $branch"

if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  echo "Remote branch origin/$branch exists — pulling updates..."
  git pull --rebase origin "$branch"
else
  echo "Remote branch origin/$branch not found — creating and pushing upstream..."
  git push --set-upstream origin "$branch"
fi

echo "Done."
