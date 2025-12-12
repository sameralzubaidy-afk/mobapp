# Cloudflare Setup

This doc describes Cloudflare CDN configuration for Supabase Storage images.

## Purge API

- Demo Supabase Edge Function: `/purge-cache` is included at `supabase/functions/purge-cache`.
- It accepts POST `{ urls: ["https://cdn/.../file.jpg"] }` and uses `CF_API_TOKEN` and `CF_ZONE_ID` from env.
- Ensure you set Edge Function secrets for `CF_API_TOKEN`, `CF_ZONE_ID` and add an API key header when calling.

## Page Rules

- Use `scripts/cloudflare/create_page_and_transform_rules.sh` to create a page rule for `https://<supabase>.supabase.co/storage/v1/object/public/*` that caches at Cloudflare's edge. Requires `CF_ZONE_ID`, `CF_API_TOKEN`, and `SUPABASE_URL` env vars.

## Purge cache

- Use `scripts/cloudflare/purge_cache.sh` to purge specific URLs from the CDN.
- For server-side calls, use the Edge Function or `infra/cloudflare-worker/purge_cache.js`.

## Dev worker

- We provide a Cloudflare Workers dev URL for testing: `https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev`. Set `EXPO_PUBLIC_CDN_URL` / `NEXT_PUBLIC_CDN_URL` to that URL in dev environments.

