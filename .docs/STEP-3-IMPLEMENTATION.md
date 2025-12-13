# STEP 3: Wire Server Delete Flows to Purge Endpoint - Implementation Guide

**Status:** In Progress  
**Duration:** 2-3 hours  
**Branch:** `feature/step-3-delete-purge-wiring`

## Executive Summary

Step 3 wires all delete operations across the codebase to use the CDN purge endpoint, ensuring images are removed from both Supabase Storage and the Cloudflare cache in a coordinated manner.

**Current Status:**
- ✅ Mobile app (`p2p-kids-marketplace`): `deleteImage()` and `deleteMultipleImages()` already integrated with purge
- ✅ Admin panel (`p2p-kids-admin`): `deleteImageAndPurge()` helper created and API route ready
- ✅ Integration test framework established (`cloudflare-cache.integration.test.ts`)

**What's Left:**
- Verify all delete operations are wired correctly
- Add E2E tests for delete→purge flow
- Create PR and merge to main

## Architecture Overview

### Delete Flow

```
User Action (Delete Item/Profile/Message)
    ↓
Application Layer (React Native or Next.js)
    ↓
Storage Service (Supabase Storage client)
    ↓
Admin API Route or Storage Helper
    ↓
deleteImage() / deleteImageAndPurge()
    ↓
Supabase Storage (file deleted)
    ↓
Purge Endpoint (cache cleared)
    ↓
Cloudflare Worker (removes from cache)
    ↓
Success Response (no cache hit after deletion)
```

### Key Components

#### 1. Mobile App Storage Service
**File:** [p2p-kids-marketplace/src/services/supabase/storage.ts](p2p-kids-marketplace/src/services/supabase/storage.ts)

- **`deleteImage(bucket, path)`** — Deletes single image, purges CDN
- **`deleteMultipleImages(bucket, paths)`** — Batch delete, purges all CDN URLs
- Both use `SUPABASE_PURGE_ENDPOINT` and `SUPABASE_PURGE_X_API_KEY` from env
- Error handling: logs purge failures but doesn't block deletion

**Status:** ✅ **READY** — Already wired with purge integration

#### 2. Admin Panel Delete API Route
**File:** [p2p-kids-admin/src/app/api/delete-image/route.ts](p2p-kids-admin/src/app/api/delete-image/route.ts)

- JWT + role verification (admin-only)
- Calls `deleteImageAndPurge()` from `storageHelpers.ts`
- Returns structured error responses with audit logging
- Zod schema validation (bucket, path, idempotencyKey)

**Status:** ✅ **READY** — Fully implemented and hardened

#### 3. Admin Panel Storage Helper
**File:** [p2p-kids-admin/src/lib/storageHelpers.ts](p2p-kids-admin/src/lib/storageHelpers.ts)

- **`deleteImageAndPurge(bucket, path)`** — Core delete+purge logic
- Uses Supabase admin client (service role key)
- Constructs CDN URL via `getCdnUrlFromPublicUrl()`
- Purges to endpoint with x-api-key header
- Non-blocking purge failures (soft-delete fallback)

**Status:** ✅ **READY** — Fully implemented

#### 4. Integration Tests
**File:** [p2p-kids-marketplace/e2e/cloudflare-cache.integration.test.ts](p2p-kids-marketplace/e2e/cloudflare-cache.integration.test.ts)

- Tests upload → cache → verify HIT
- Tests cleanup (delete from storage)
- Validates CF-Cache-Status header

**Status:** ✅ **READY** — Can be extended for delete→purge verification

## Implementation Checklist

### Phase 1: Verification (Current)

- [x] Verify `deleteImage()` in mobile storage service
- [x] Verify `deleteMultipleImages()` in mobile storage service
- [x] Verify `deleteImageAndPurge()` in admin storage helper
- [x] Verify admin API route has authentication
- [x] Verify integration test framework exists
- [ ] Verify environment variables are documented

### Phase 2: E2E Test Enhancement

- [ ] Extend `cloudflare-cache.integration.test.ts` with delete→purge test
- [ ] Test: Upload file → Fetch via CDN (expect HIT) → Delete → Fetch again (expect MISS)
- [ ] Test: Batch delete with `deleteMultipleImages()`

### Phase 3: Documentation & Code Quality

- [ ] Update README with delete+purge flow diagram
- [ ] Add JSDoc comments to storage service functions
- [ ] Add error handling guidance for purge failures
- [ ] Document fallback behavior (delete succeeds even if purge fails)

### Phase 4: PR & Merge

- [ ] Create PR from `feature/step-3-delete-purge-wiring`
- [ ] Run CI checks (lint, TypeScript, tests)
- [ ] Merge to `main`

## Delete Operations Wiring Status

### Mobile App Delete Operations

| Operation | File | Status | Purge Integrated |
|-----------|------|--------|-----------------|
| Item listing deletion | `screens/listing/*.tsx` | Need to verify | Calls `deleteMultipleImages()` ✅ |
| Profile image update | `screens/profile/*.tsx` | Need to verify | Uses `deleteImage()` ✅ |
| Message attachment delete | `screens/messaging/*.tsx` | Need to verify | Uses `deleteImage()` ✅ |
| Trade images (completed) | Trade cleanup logic | Need to verify | Uses `deleteMultipleImages()` ✅ |

### Admin Panel Delete Operations

| Operation | File | Status | Purge Integrated |
|-----------|------|--------|-----------------|
| Admin image deletion | API route | ✅ Hardened | Calls `deleteImageAndPurge()` ✅ |

## Environment Variables Checklist

Ensure these are set in `.env.local`, GitHub secrets, and deployment platforms:

```
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_PURGE_ENDPOINT=https://project.supabase.co/functions/v1/purge-cache
SUPABASE_PURGE_X_API_KEY=r2eJ6QGlfEz1LzFfIAzK78smfZw+BUrHgV8vr8/rzmw=
EXPO_PUBLIC_CDN_URL=https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev
NEXT_PUBLIC_CDN_URL=https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev
```

**Verification:**
- [x] SUPABASE_URL — ✅ Set
- [x] SUPABASE_SERVICE_ROLE_KEY — ✅ Set
- [x] SUPABASE_PURGE_ENDPOINT — ✅ Set
- [x] SUPABASE_PURGE_X_API_KEY — ✅ Set (generated in Step 2)
- [x] CDN URLs — ✅ Set

## Testing Strategy

### Unit Tests
- Storage helper functions with mock Supabase client
- Verify purge endpoint is called with correct headers
- Verify CDN URL transformation

### Integration Tests
- End-to-end delete→purge flow
- Verify CF-Cache-Status headers after deletion
- Batch delete operations

### Manual Testing
1. Upload image via mobile app
2. View image in browser (cache HIT)
3. Delete image from mobile app
4. Fetch image URL again (expect 404 or MISS)
5. Verify Cloudflare logs show purge event

## Failure Scenarios & Handling

### Scenario 1: Supabase Delete Succeeds, Purge Fails
- **Current behavior:** Delete succeeds, purge error logged
- **Impact:** Image removed from storage but may still be cached (< TTL)
- **Mitigation:** Log error, alert admin, manual cache purge available

### Scenario 2: Purge Endpoint Unreachable
- **Current behavior:** Fetch times out, logged, delete completes
- **Impact:** Cache not cleared immediately
- **Mitigation:** Retry logic (future enhancement), manual purge available

### Scenario 3: Invalid API Key
- **Current behavior:** 403 response logged
- **Impact:** Purge fails, cached content remains
- **Mitigation:** Verify `SUPABASE_PURGE_X_API_KEY` in GitHub secrets

## Success Criteria

✅ **Delete Flow Verification:**
- [ ] All delete operations in mobile app call `deleteImage()` or `deleteMultipleImages()`
- [ ] All admin deletions call `deleteImageAndPurge()`
- [ ] Purge endpoint is called with correct headers and payload

✅ **E2E Test Coverage:**
- [ ] Test: Upload → Verify HIT → Delete → Verify MISS
- [ ] Test: Batch delete with multiple images
- [ ] Test: Delete non-existent file (graceful failure)

✅ **Documentation:**
- [ ] README updated with delete+purge flow
- [ ] JSDoc comments added to storage helpers
- [ ] Error handling documented

✅ **PR Ready:**
- [ ] All tests passing
- [ ] Lint/TypeScript checks passing
- [ ] Code review approved
- [ ] Ready to merge to main

## Rollback Plan

If issues arise:
1. Revert PR to previous commit
2. Purge will continue to work (endpoint still active)
3. Manual purge available via Cloudflare dashboard
4. No data loss (files remain in Supabase Storage)

## Next Steps (After Step 3)

**Step 4:** Fix e2e test environment (Babel plugin for react-native-worklets)
**Step 5:** Add e2e cache validation tests to CI/CD pipeline
**Step 6:** Update UI components to prefer `cdnUrl` for image rendering

---

**Last Updated:** 2025-12-12  
**Completed By:** Step 2 (CI/CD workflow & GitHub secrets)  
**Blocked By:** None  
**Dependencies:** Step 1 (Auth hardening), Step 2 (CI/CD workflow)
