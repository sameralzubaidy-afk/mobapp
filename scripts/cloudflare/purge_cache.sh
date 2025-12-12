#!/usr/bin/env bash
set -euo pipefail

# Purge Cloudflare cache for provided URLs
# Usage: purge_cache.sh <url1> [url2 ...]

if [[ -z "${CF_ZONE_ID:-}" || -z "${CF_API_TOKEN:-}" ]]; then
  echo "Please set CF_ZONE_ID and CF_API_TOKEN environment variables."
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <url1> [url2 ...]"
  exit 1
fi

ZONE_ID="$CF_ZONE_ID"
API_TOKEN="$CF_API_TOKEN"

URLS=("$@")

url_json=$(printf '%s\n' "${URLS[@]}" | jq -R -s -c 'split("\\n")[:-1]')
PAYLOAD="{\"files\": ${url_json}}"

echo "Purging cache for ${#URLS[@]} URL(s)"
curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -d "$PAYLOAD" | jq

echo "Purge request submitted"
