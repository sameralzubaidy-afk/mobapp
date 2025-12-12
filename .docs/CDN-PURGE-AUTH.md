# CDN Purge Setup & Admin Auth

## Overview

This document describes the security architecture and operational setup for the Cloudflare CDN cache purge flow with admin-only authorization.

## Architecture

### Request Flow

```
Admin Client
    ↓
POST /api/delete-image (with JWT token)
    ↓
Admin Auth Check (verify JWT + admin role)
    ↓
Server-side deleteImageAndPurge()
    ↓
Supabase Storage: delete image
    ↓
Supabase Edge Function: POST /functions/v1/purge-cache
    ↓
API Key Verification (x-api-key header)
    ↓
Request Validation (Zod schema)
    ↓
Cloudflare API: purge_cache endpoint
    ↓
Response: { success: true, files_purged: N }
```

## Security Layers

### 1. API Route Auth (`/api/delete-image`)

**Location:** `p2p-kids-admin/src/app/api/delete-image/route.ts`

**Protection:**
- ✅ JWT token verification (Authorization header)
- ✅ User role check (admin-only)
- ✅ Request payload validation (Zod)
- ✅ Structured error responses
- ✅ Audit logging

**Headers Required:**
```bash
Authorization: Bearer <JWT_TOKEN>
```

**Request Body:**
```json
{
  "bucket": "item-images",
  "path": "user-123/image-abc.jpg",
  "idempotencyKey": "optional-unique-id"
}
```

**Responses:**
- 200: Image deleted and purged
- 400: Invalid parameters
- 401: Missing/invalid JWT
- 403: User is not admin
- 500: Server error

### 2. Edge Function Auth (`/functions/v1/purge-cache`)

**Location:** `supabase/functions/purge-cache/index.ts`

**Protection:**
- ✅ API key verification (x-api-key header)
- ✅ Request validation (validatePurgeRequest)
- ✅ Cloudflare secrets verification
- ✅ Structured error responses
- ✅ Audit logging

**Headers Required:**
```bash
x-api-key: <SUPABASE_PURGE_X_API_KEY>
Content-Type: application/json
```

**Request Body:**
```json
{
  "urls": [
    "https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev/storage/v1/object/public/item-images/user-123/image-abc.jpg"
  ],
  "idempotencyKey": "optional-unique-id"
}
```

**Responses:**
- 200: Cache purged successfully
- 400: Invalid URL format
- 401: Invalid API key
- 405: Non-POST request
- 500: Cloudflare API error

## Environment Setup

### Admin App (Next.js)

Required environment variables in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://drntwgporzabmxdqykrp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# CDN Purge
SUPABASE_PURGE_ENDPOINT=https://drntwgporzabmxdqykrp.supabase.co/functions/v1/purge-cache
SUPABASE_PURGE_X_API_KEY=<your-purge-api-key>

# CDN Configuration
NEXT_PUBLIC_CDN_URL=https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev
```

### Supabase Edge Function

Set environment variables in Supabase dashboard (Functions → purge-cache → Configuration):

```bash
CF_API_TOKEN=<cloudflare-api-token>
CF_ZONE_ID=<cloudflare-zone-id>
SUPABASE_PURGE_X_API_KEY=<your-purge-api-key>
```

**⚠️ Important:** Never commit these secrets to version control. Use GitHub Secrets and Supabase environment configuration.

## GitHub Secrets Setup

Set these secrets in your GitHub repository settings:

```bash
CF_ACCOUNT_ID              # Cloudflare account ID
CF_API_TOKEN               # Cloudflare API token (with purge_cache scope)
CF_ZONE_ID                 # Cloudflare zone ID
SUPABASE_SERVICE_ROLE_KEY  # Supabase service role key
SUPABASE_PURGE_X_API_KEY   # Purge endpoint API key
```

**Script to set secrets:**
```bash
gh secret set CF_ACCOUNT_ID -b "your-account-id"
gh secret set CF_API_TOKEN -b "your-api-token"
gh secret set CF_ZONE_ID -b "your-zone-id"
gh secret set SUPABASE_SERVICE_ROLE_KEY -b "your-service-role-key"
gh secret set SUPABASE_PURGE_X_API_KEY -b "your-purge-api-key"
```

## Testing the Purge Flow

### 1. Test API Route Locally

```bash
# 1. Get a valid JWT token from your admin account
# 2. Call the API route with the token

curl -X POST http://localhost:3000/api/delete-image \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "bucket": "item-images",
    "path": "test/test.jpg"
  }'
```

### 2. Test Edge Function

```bash
# Call the purge-cache function directly
curl -X POST https://drntwgporzabmxdqykrp.supabase.co/functions/v1/purge-cache \
  -H "x-api-key: <SUPABASE_PURGE_X_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev/storage/v1/object/public/item-images/test/test.jpg"
    ]
  }'
```

### 3. End-to-End Test

1. Upload an image via the admin panel
2. Get the image URL from the storage bucket
3. Call `DELETE /api/delete-image` with the image path
4. Verify in Supabase: image should be deleted from storage
5. Check Cloudflare Analytics: cache should be purged (status = MISS on next request)

## Audit Logging

All operations are logged with prefixes for easy tracking:

- `[DELETE-IMAGE]` - Admin delete API route
- `[PURGE-CACHE]` - Cache purge Edge Function

**Log Examples:**
```
[DELETE-IMAGE] Admin user-123 deleting image: item-images/user-456/abc.jpg
[DELETE-IMAGE] Successfully deleted and purged: item-images/user-456/abc.jpg
[PURGE-CACHE] Purging 1 URL(s)
[PURGE-CACHE] Successfully purged 1 URL(s)
```

Monitor logs in:
- **Admin App:** `npx vercel logs` (production)
- **Edge Function:** Supabase dashboard → Functions → purge-cache → Logs

## Error Handling & Retry Logic

### Current Behavior

- **Soft Failure:** If purge fails, the image is still deleted from storage. Cache remains until TTL expires.
- **Logging:** All errors are logged with details for ops review.

### Future: Async Purge Queue

For production, consider implementing:
- Background queue for purge retries (BullMQ, Supabase job queue)
- Idempotency tracking to prevent duplicate purges
- Dead-letter queue for failed purges

**TODO:** Implement async purge retry logic in Phase 3b.

## FAQ

**Q: What if the purge API fails but the image is deleted?**
A: The image is gone from the storage bucket, but the CDN cache remains. Cached version expires after TTL (24 hours default). A new upload with the same path will be cached separately.

**Q: Can non-admins call the delete API?**
A: No. The API verifies both JWT token and admin role. Non-admin users get a 403 Forbidden error.

**Q: What if I don't set the SUPABASE_PURGE_X_API_KEY?**
A: The purge step is silently skipped with a warning log. Image is still deleted. Set the key to enable purging.

**Q: How do I rotate the purge API key?**
A: Update `SUPABASE_PURGE_X_API_KEY` in Supabase Edge Function environment variables and GitHub Secrets. Both must be in sync.

## Domain Migration (Month 4)

When your domain is ready:

1. Update `NEXT_PUBLIC_CDN_URL` to point to your Cloudflare domain
2. No code changes needed—only env var update
3. See `CDN-SETUP.md` for full domain migration checklist
