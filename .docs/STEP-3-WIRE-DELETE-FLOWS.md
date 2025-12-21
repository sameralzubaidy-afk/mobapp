# Step 3: Wire Server Delete Flows to Purge Endpoint

## Overview
All delete operations that remove images from Supabase Storage must call the purge endpoint to invalidate cache. This prevents stale images from being served.

## Current State
✅ **Already Implemented:**
- `deleteImageAndPurge()` helper in `storageHelpers.ts`
- `/api/delete-image` route with admin auth
- Purge Edge Function with x-api-key validation

## Delete Operations to Wire

### 1. Item/Listing Deletion
**Location:** Admin dashboard item management  
**Flow:** User deletes item → Delete item record + all images → Purge cache

**Files to identify:**
- Item delete API route (if exists)
- Item management page component
- Storage cleanup function for item images

**Action:**
- Ensure all item images are deleted via `deleteImageAndPurge()`
- Add error handling with soft-delete fallback

### 2. Profile Image Deletion  
**Location:** User profile management  
**Files to identify:**
- Profile update route
- Avatar upload component
- Profile cleanup on account deletion

**Action:**
- When profile picture is updated/removed, call `deleteImageAndPurge()`
- Handle grace period for old images (5-10 minutes)

### 3. Message Attachment Deletion
**Location:** Messaging system
**Files to identify:**
- Message deletion/expiry handler
- Attachment cleanup
- Conversation deletion

**Action:**
- When messages are deleted, purge attached images
- Implement message retention policy (soft-delete then hard-delete)

### 4. Trade/Transaction Image Cleanup
**Location:** Trade flow completion
**Files to identify:**
- Trade completion handler
- Trade item image cleanup
- Dispute resolution image cleanup

**Action:**
- Archive/purge images after trade completion (configurable retention)
- Handle dispute images separately

### 5. Admin Image Management
**Location:** Admin panel - image gallery
**Action:**
- Delete functionality must use `deleteImageAndPurge()`
- Bulk delete operations
- Cleanup on content moderation actions

## Implementation Pattern

```typescript
// Pattern for all delete operations

// ❌ OLD - Just delete from storage
await adminClient.storage.from('bucket').remove([path]);

// ✅ NEW - Delete and purge cache
import { deleteImageAndPurge } from '@/lib/storageHelpers';

const result = await deleteImageAndPurge('bucket-name', 'path/to/image');
if (result.error) {
  // Handle error: log to monitoring, optionally retry
  console.error('Delete/purge failed:', result.error);
  // Data is already soft-deleted in DB, just log for manual cleanup
}
```

## Error Handling Strategy

### Level 1: Immediate Delete
- Delete from Supabase Storage (happens first)
- Mark as deleted in database

### Level 2: Cache Purge
- Call purge endpoint
- If purge fails, log but don't block user
- Stale cache will eventually expire (TTL: 1 month max)

### Level 3: Fallback Cleanup
- Manual purge script can be run later
- `supabase/functions/purge-cache` can be called with list of URLs

## Testing Checklist

For each delete operation:
- [ ] Delete operation removes file from storage
- [ ] Purge endpoint is called with correct URL
- [ ] CF-Cache-Status shows MISS after purge
- [ ] Database records are marked as deleted
- [ ] Error handling doesn't block user actions
- [ ] Audit logging shows delete + purge attempts

## Audit Logging

Each delete operation should log:
```
[DELETE-IMAGE] Admin {userId} deleted: {bucket}/{path}
[PURGE-CACHE] Purge requested for: {urls}
[PURGE-CACHE] Purge result: {status} (idempotencyKey: {key})
```

## Timeline

- **Immediate:** Wire up 2-3 most critical delete flows
- **Week 1:** Complete all identified delete operations
- **Week 2:** Add comprehensive tests + monitoring

## Blocked By

Nothing! All infrastructure is ready:
- ✅ `deleteImageAndPurge()` exists
- ✅ `/api/delete-image` route hardened with auth
- ✅ Purge Edge Function deployed
- ✅ GitHub secrets set

## Next Steps After Completion

1. **Step 4:** Fix e2e test environment (Babel plugin)
2. **Step 5:** Add e2e cache validation tests
3. **Step 6:** Update UI to prefer cdnUrl for images
4. **Step 7:** Add delete+purge integration tests
