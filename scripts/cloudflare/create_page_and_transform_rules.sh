#!/usr/bin/env bash
set -euo pipefail

# Create Cloudflare Page Rule for caching Supabase Storage images
# and optional Transform/Response Rule to add CORS headers (if not using the worker)

if [[ -z "${CF_ZONE_ID:-}" || -z "${CF_API_TOKEN:-}" || -z "${SUPABASE_URL:-}" ]]; then
  echo "Please set CF_ZONE_ID, CF_API_TOKEN, and SUPABASE_URL environment variables."
  exit 1
fi

ZONE_ID="$CF_ZONE_ID"
API_TOKEN="$CF_API_TOKEN"
SUPABASE_HOST="$SUPABASE_URL"

echo "Creating page rule for Supabase Storage caching: ${SUPABASE_HOST}/storage/v1/object/public/*"

PAGE_RULE_PAYLOAD=$(cat <<EOF
{
  "targets": [
    { "target": "url", "constraint": { "operator": "matches", "value": "${SUPABASE_HOST}/storage/v1/object/public/*" } }
  ],
  "actions": [
    { "id": "cache_level", "value": "cache_everything" },
    { "id": "edge_cache_ttl", "value": 2592000 },
    { "id": "origin_cache_control", "value": "off" }
  ],
  "priority": 1,
  "status": "active"
}
EOF
)

echo "Page rule payload:"
echo "$PAGE_RULE_PAYLOAD"

curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/pagerules" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -d "$PAGE_RULE_PAYLOAD" | jq

echo "Done. Note: To add Response Header modifications or Transform rules, prefer using Workers or Rulesets in Cloudflare UI."
