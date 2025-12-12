#!/usr/bin/env bash
set -euo pipefail

# Purge CDN entries for a Supabase bucket+path after delete
# Usage: purge_on_delete.sh <bucket> <path>
if [[ -z "${EXPO_PUBLIC_CDN_URL:-}" && -z "${NEXT_PUBLIC_CDN_URL:-}" ]]; then
  echo "Please set EXPO_PUBLIC_CDN_URL or NEXT_PUBLIC_CDN_URL in your environment"
  exit 1
fi

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <bucket> <path>"
  exit 1
fi

CDN_URL=${EXPO_PUBLIC_CDN_URL:-$NEXT_PUBLIC_CDN_URL}
BUCKET=$1
PATH=$2

FULL_URL="${CDN_URL}/${BUCKET}/${PATH}"
echo "Purging CDN for $FULL_URL"
CF_ZONE_ID=${CF_ZONE_ID:-}
CF_API_TOKEN=${CF_API_TOKEN:-}
if [[ -z "$CF_ZONE_ID" || -z "$CF_API_TOKEN" ]]; then
  echo "CF_ZONE_ID and CF_API_TOKEN must be set to purge cache via API"
  exit 1
fi

./scripts/cloudflare/purge_cache.sh "$FULL_URL"
