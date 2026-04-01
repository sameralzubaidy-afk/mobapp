---

## Prompt Addendum: OWASP ASVS, Rate Limits, Retention

### AI Prompt for Cursor (Safety & Compliance)
```typescript
/*
TASK: Formalize security checklist and controls

REQUIREMENTS:
1. OWASP ASVS mapping: checklist of endpoints and controls; store in `security_checklist` table.
2. Per-endpoint rate limits: implement middleware with per-user and per-IP thresholds; log exceed events.
3. Abuse detection thresholds: basic heuristics (message spam, listing spam); auto-throttle and queue for moderation.
4. Data retention schedules: define retention for logs, messages, and images; scheduled jobs to purge per policy.

FILES:
- admin/app/security/checklist/page.tsx (checklist viewer)
- supabase/migrations/security_checklist.sql (schema)
- src/middleware/rateLimit.ts (rate limiting)
*/
```

### Acceptance Criteria
- ASVS checklist documented, stored, and visible in admin
- Rate limiting active per endpoint with logs
- Abuse heuristics throttle suspicious activity
- Retention jobs configured and documented

# MODULE 13: SAFETY & COMPLIANCE

**Total Tasks:** 15 (3 prerequisite + 12 safety)  
**Estimated Time:** ~40 hours  
**Dependencies:** MODULE-02 (Authentication), MODULE-04 (Item Listing), MODULE-12 (Admin Panel)

> **⚠️ PREREQUISITE TASKS (SAFETY-P001 → P003)** must be completed BEFORE SAFETY-001. They close critical infrastructure gaps (storage bucket, image upload in listing screen, item-status schema) that downstream tasks depend on.

---

### Agent-Optimized Prompt Template (Claude Sonnet 4.5)

Add this preamble to each AI prompt block when running in Claude Sonnet 4.5 mode. It guides the agent to reason, verify, and produce tests alongside code.

```text
@agent: claude-sonnet-4.5
@mode: extended-reasoning
@autonomy: high

AGENT INSTRUCTIONS:
1. Read the entire task before generating code.
2. Produce a short plan (3-6 steps) and list any missing dependencies.
3. Generate the requested files exactly at the `filepath` locations.
4. Create unit tests for critical logic using the project's test framework.
5. Run a self-check list: type-check, lint, and run the new tests (if environment available).
6. Add concise TODO comments where manual verification is required (secrets, environment variables, or infra setup).

VERIFICATION STEPS (agent must print results):
- TypeScript type-check: `npm run type-check` (or `yarn tsc`)
- Linting: `npm run lint`
- Tests: `npm test -- --testPathPattern=<new tests>`

ERROR HANDLING RULES:
- If a required file/dependency is missing, stop and report exact missing paths.
- For runtime secrets (API keys), inject clear TODOs and do not attempt to store secrets in code.
- For database schema mismatches, add migration stubs and mark for manual review.

REASONING GUIDELINES:
- Provide brief chain-of-thought before producing complex SQL or payment flows.
- Flag performance, security, and privacy concerns.
```

---

---

## PREREQUISITE TASKS (must be completed before any SAFETY-0xx task)

These tasks close infrastructure gaps that MODULE-13 depends on.

---

## TASK SAFETY-P001: Create `item-images` Storage Bucket with RLS Policies (Supabase Migration)

**Duration:** 1.5 hours  
**Priority:** Critical (Blocker for SAFETY-004, SAFETY-005, SAFETY-008)  
**Dependencies:** INFRA-001 (Supabase setup), items table must exist (20251217000002 migration)

### Description
The `item_images` DB table and `storage.ts` service already reference an `item-images` bucket, but **no migration creates the Supabase Storage bucket or its RLS policies**. Without this bucket, users cannot upload listing photos, and SAFETY-004 (image moderation) has nothing to moderate.

Create an idempotent migration that:
1. Creates the `item-images` storage bucket (public, 5 MB file size limit)
2. Adds RLS policies so sellers can upload/delete their own listing images
3. Allows authenticated users to read any item image (listings are public)
4. Allows service_role full access (for moderation/admin)

---

### AI Prompt for Cursor (Generate item-images Storage Bucket)

```sql
/*
TASK: Create item-images storage bucket with RLS policies

CONTEXT:
- The `item_images` table already exists (migration 20251217000002).
- The `storage.ts` service in the mobile app already references bucket name 'item-images'.
- Other buckets exist as reference patterns: 'user-avatars' (migration 20241215000004),
  'chat-images' (migration 082), 'badge-icons' (migration 20260112000000).
- This migration MUST be idempotent (safe to re-run).

REQUIREMENTS:
1. Create `item-images` public storage bucket (5 MB max file size)
2. RLS policies:
   a. Authenticated users can upload to path `{user_id}/*` (own folder)
   b. Authenticated users can update/delete only their own files (`{user_id}/*`)
   c. Anyone (anon + authenticated) can read all item images (listings are public)
   d. Service role has full access (for moderation cleanup)
3. Bucket must be public (getPublicUrl works without signed URLs)
4. Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

==================================================
FILE: Supabase migration for item-images bucket
==================================================
*/

-- filepath: supabase/migrations/300_create_item_images_bucket.sql
-- Mode: idempotent (safe to re-run)

-- STEP 1: Create the bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-images',
  'item-images',
  TRUE,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- STEP 2: Drop existing policies (idempotent reset)
DROP POLICY IF EXISTS "Authenticated users can upload item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own item images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view item images" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access item images" ON storage.objects;

-- STEP 3: Create RLS policies

-- 3a. Upload: users can upload to their own folder
CREATE POLICY "Authenticated users can upload item images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- 3b. Update: users can update their own files
CREATE POLICY "Authenticated users can update own item images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- 3c. Delete: users can delete their own files
CREATE POLICY "Authenticated users can delete own item images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- 3d. Read: anyone can view item images (listings are public)
CREATE POLICY "Anyone can view item images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'item-images');

-- 3e. Service role: full access for moderation/admin
CREATE POLICY "Service role full access item images"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'item-images');

/*
==================================================
VERIFICATION QUERIES (run after migration)
==================================================
*/

-- Verify bucket exists
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets WHERE id = 'item-images';

-- Verify policies exist
-- SELECT policyname, cmd, roles
-- FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%item images%';

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ item-images bucket exists in Supabase Storage
✓ Bucket is public (getPublicUrl works)
✓ 5 MB file size limit enforced
✓ Only jpeg/png/webp/gif allowed
✓ Authenticated users can upload to their own folder
✓ Users can only delete their own uploads
✓ Anyone can view item images
✓ Service role has full access

==================================================
NEXT TASK
==================================================

SAFETY-P002: Add image picker to CreateListingScreen
*/
```

---

### Output Files

1. **supabase/migrations/300_create_item_images_bucket.sql** — Storage bucket + RLS policies

---

### Testing Steps

1. **Verify bucket creation:**
   - Run migration in Supabase SQL Editor
   - Check Storage tab → `item-images` bucket should appear
   - Verify public flag, file size limit, MIME types

2. **Test upload as authenticated user:**
   - Upload a JPEG via Supabase client to `{user_id}/test.jpg`
   - Verify upload succeeds
   - Verify `getPublicUrl` returns accessible URL

3. **Test RLS:**
   - Try uploading to another user's folder → should fail
   - Try deleting another user's image → should fail
   - Anonymous read → should succeed

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Write migration SQL | 30 min |
| Test in Supabase Studio | 30 min |
| Verify RLS policies (upload/read/delete) | 30 min |
| **Total** | **~1.5 hours** |

---

## TASK SAFETY-P002: Add Image Picker and Upload to CreateListingScreen (Mobile App)

**Duration:** 3 hours  
**Priority:** Critical (Blocker for SAFETY-004)  
**Dependencies:** SAFETY-P001 (item-images bucket), MODULE-04 (CreateListingScreen must exist)

### Description
The `CreateListingScreen` currently has a form for title, description, price, condition, and SP toggle — but **no image picker**. Users cannot attach photos to listings. This blocks SAFETY-004 (Google Vision image moderation) which requires images to exist.

Add:
1. Image picker component using `expo-image-picker` (already used in avatar upload flow)
2. Multi-image support (up to 5 photos)
3. Image preview with reorder and delete
4. Upload images to `item-images` bucket on listing creation
5. Insert image URLs into `item_images` table after item is created
6. Show upload progress indicator

---

### AI Prompt for Cursor (Generate Image Picker for Listings)

```typescript
/*
TASK: Add image picker and upload to CreateListingScreen

CONTEXT:
- CreateListingScreen exists at: p2p-kids-marketplace/src/screens/listing/CreateListingScreen.tsx
- Storage service exists at: p2p-kids-marketplace/src/services/supabase/storage.ts
  - Has uploadImage(bucket, path, fileUri) and uploadMultipleImages()
  - Bucket type 'item-images' is already defined in StorageBucket type
- item_images table exists with columns: id, item_id, url, thumbnail_url, display_order, created_at
- Avatar upload example in ProfileCompletionScreen.tsx uses expo-image-picker
- Maximum 5 images per listing
- First image = primary/cover image (display_order = 0)

REQUIREMENTS:
1. Add image picker using expo-image-picker (camera + gallery)
2. Allow up to 5 images per listing
3. Show image previews in a horizontal scroll with:
   - Tap to view full size (optional)
   - "X" button to remove
   - Drag-to-reorder (stretch goal: skip for MVP, use display_order from array index)
4. On listing creation:
   a. First create the item in DB (existing flow)
   b. Upload all images to item-images/{seller_id}/{item_id}/{index}.jpg
   c. Insert rows into item_images table with public URLs
5. Show upload progress (ActivityIndicator per image or overall progress)
6. Handle errors: if upload fails, still save listing but warn user about missing images
7. Validate: only image/* MIME types, max 5 MB per image

==================================================
FILE 1: Image picker component (reusable)
==================================================
*/

// filepath: p2p-kids-marketplace/src/components/molecules/ImagePickerGrid.tsx

import React from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const MAX_IMAGES = 5;
const MAX_FILE_SIZE_MB = 5;

export interface SelectedImage {
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
}

interface ImagePickerGridProps {
  images: SelectedImage[];
  onImagesChange: (images: SelectedImage[]) => void;
  uploading?: boolean;
  maxImages?: number;
}

export default function ImagePickerGrid({
  images,
  onImagesChange,
  uploading = false,
  maxImages = MAX_IMAGES,
}: ImagePickerGridProps) {
  const pickImage = async (source: 'camera' | 'gallery') => {
    if (images.length >= maxImages) {
      Alert.alert('Limit Reached', `Maximum ${maxImages} images allowed`);
      return;
    }

    // Request permission
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to take photos');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library access is needed to select images');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: maxImages - images.length,
      quality: 0.8,
      // Note: use launchCameraAsync for camera source
    });

    if (source === 'camera') {
      const cameraResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!cameraResult.canceled && cameraResult.assets.length > 0) {
        const asset = cameraResult.assets[0];
        // Validate file size
        if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_MB * 1024 * 1024) {
          Alert.alert('File Too Large', `Images must be under ${MAX_FILE_SIZE_MB} MB`);
          return;
        }
        onImagesChange([
          ...images,
          { uri: asset.uri, width: asset.width, height: asset.height, fileSize: asset.fileSize ?? undefined },
        ]);
      }
      return;
    }

    if (!result.canceled && result.assets.length > 0) {
      const validAssets = result.assets
        .filter((a) => {
          if (a.fileSize && a.fileSize > MAX_FILE_SIZE_MB * 1024 * 1024) {
            return false; // Skip oversized
          }
          return true;
        })
        .map((a) => ({ uri: a.uri, width: a.width, height: a.height, fileSize: a.fileSize ?? undefined }));

      if (validAssets.length < result.assets.length) {
        Alert.alert('Some Skipped', `${result.assets.length - validAssets.length} image(s) exceeded ${MAX_FILE_SIZE_MB} MB and were skipped`);
      }

      onImagesChange([...images, ...validAssets].slice(0, maxImages));
    }
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
        {images.map((img, idx) => (
          <View key={idx} style={styles.imageWrapper}>
            <Image source={{ uri: img.uri }} style={styles.thumbnail} />
            {idx === 0 && (
              <View style={styles.coverBadge}>
                <Text style={styles.coverBadgeText}>Cover</Text>
              </View>
            )}
            {!uploading && (
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(idx)}>
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            )}
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </View>
        ))}

        {images.length < maxImages && !uploading && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              Alert.alert('Add Photo', 'Choose a source', [
                { text: 'Camera', onPress: () => pickImage('camera') },
                { text: 'Photo Library', onPress: () => pickImage('gallery') },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
          >
            <Text style={styles.addButtonIcon}>📷</Text>
            <Text style={styles.addButtonText}>{images.length}/{maxImages}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {images.length === 0 && (
        <Text style={styles.hint}>Add at least one photo of your item</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollRow: { flexDirection: 'row', marginVertical: 8 },
  imageWrapper: { width: 100, height: 100, marginRight: 8, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  thumbnail: { width: '100%', height: '100%' },
  coverBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,122,255,0.8)', paddingVertical: 2 },
  coverBadgeText: { color: '#fff', fontSize: 10, textAlign: 'center', fontWeight: '600' },
  removeBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  addButton: { width: 100, height: 100, borderRadius: 8, borderWidth: 2, borderColor: '#ddd', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9' },
  addButtonIcon: { fontSize: 28 },
  addButtonText: { fontSize: 12, color: '#888', marginTop: 4 },
  hint: { color: '#888', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
});

/*
==================================================
FILE 2: Update CreateListingScreen to use ImagePickerGrid
==================================================
*/

// filepath: p2p-kids-marketplace/src/screens/listing/CreateListingScreen.tsx (UPDATE)

// ADD to imports:
// import ImagePickerGrid, { SelectedImage } from '../../components/molecules/ImagePickerGrid';
// import { uploadMultipleImages } from '../../services/supabase/storage';
// import { supabase } from '../../config/supabase';

// ADD to state:
// const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
// const [uploadingImages, setUploadingImages] = useState(false);

// ADD to JSX (after "Item Details" section title, before Title input):
// <Text style={styles.label}>Photos *</Text>
// <ImagePickerGrid
//   images={selectedImages}
//   onImagesChange={setSelectedImages}
//   uploading={uploadingImages}
// />

// UPDATE handleCreateListing to upload images after item creation:
// async function handleCreateListing() {
//   ... existing validation ...
//   if (selectedImages.length === 0) {
//     Alert.alert('Required', 'Please add at least one photo');
//     return;
//   }
//   ... create listing (existing code) ...
//   // After listing created successfully, upload images:
//   if (selectedImages.length > 0 && data?.id) {
//     setUploadingImages(true);
//     try {
//       const files = selectedImages.map((img, idx) => ({
//         path: `${session.user.id}/${data.id}/${idx}.jpg`,
//         fileUri: img.uri,
//       }));
//       const uploadResults = await uploadMultipleImages('item-images', files);
//       // Insert into item_images table
//       const imageRows = uploadResults
//         .filter((r) => r.url !== null)
//         .map((r, idx) => ({
//           item_id: data.id,
//           url: r.url!,
//           thumbnail_url: r.url, // TODO(UX): generate actual thumbnails
//           display_order: idx,
//         }));
//       if (imageRows.length > 0) {
//         await supabase.from('item_images').insert(imageRows);
//       }
//     } catch (imgError) {
//       console.error('[CreateListing] Image upload error:', imgError);
//       Alert.alert('Warning', 'Listing created but some images failed to upload.');
//     } finally {
//       setUploadingImages(false);
//     }
//   }
// }

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Image picker appears on CreateListingScreen
✓ User can select up to 5 images from gallery or camera
✓ Image previews shown in horizontal scroll
✓ Cover image badge on first image
✓ Remove button works
✓ Images uploaded to item-images/{user_id}/{item_id}/ path
✓ item_images rows created with public URLs
✓ Upload progress shown
✓ File size validation (max 5 MB)
✓ Error handling: listing saved even if image upload fails

==================================================
NEXT TASK
==================================================

SAFETY-P003: Extend items.status CHECK constraint
*/
```

---

### Output Files

1. **p2p-kids-marketplace/src/components/molecules/ImagePickerGrid.tsx** — Reusable image picker component
2. **p2p-kids-marketplace/src/screens/listing/CreateListingScreen.tsx** — Updated with image picker integration

---

### Testing Steps

1. **Image picker:**
   - Open CreateListingScreen → image picker section visible
   - Tap add → choose Camera or Gallery
   - Select images → previews appear
   - First image shows "Cover" badge
   - Tap ✕ → image removed
   - Try to add > 5 → "Limit Reached" alert

2. **Upload:**
   - Create listing with 2-3 images
   - Images uploaded to item-images bucket
   - item_images table has rows with correct URLs
   - Public URLs accessible in browser

3. **Error handling:**
   - Disconnect network mid-upload → listing created, warning shown
   - Upload 6 MB image → rejected with alert

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Build ImagePickerGrid component | 1 hour |
| Integrate into CreateListingScreen | 1 hour |
| Test upload flow + item_images insert | 45 min |
| Error handling + edge cases | 15 min |
| **Total** | **~3 hours** |

---

## TASK SAFETY-P003: Extend `items.status` CHECK Constraint + Add Seller Notification for Flagged/Rejected Items

**Duration:** 2 hours  
**Priority:** Critical (Blocker for SAFETY-002, SAFETY-004, SAFETY-005, SAFETY-008, SAFETY-009)  
**Dependencies:** items table must exist (20251217000002 migration)

### Description
The `items.status` CHECK constraint currently allows: `'draft', 'available', 'pending', 'sold', 'deleted', 'paused'`. MODULE-13 requires two additional statuses:
- `'flagged'` — Item flagged by CPSC match or AI moderation, under review
- `'rejected'` — Item rejected by admin after review

Also adds:
1. `items.flagged_at` and `items.rejected_at` timestamp columns for audit
2. `items.rejection_reason` text column for admin feedback
3. `items.appeal_count` integer for tracking seller resubmissions
4. A DB trigger-based notification that inserts into the `notifications` table when an item is flagged or rejected, so the seller is notified via push/in-app
5. Updates `ListingStatus` TypeScript type to include new statuses
6. Updates RLS: flagged/rejected items visible to seller + admins only

---

### AI Prompt for Cursor (Extend items.status + Seller Notifications)

```typescript
/*
TASK: Extend items.status CHECK constraint + add flagged/rejected support

CONTEXT:
- items table created in migration 20251217000002 with status CHECK:
  ('draft', 'available', 'pending', 'sold', 'deleted', 'paused')
- MODULE-13 SAFETY tasks need 'flagged' and 'rejected' statuses
- notifications table exists (migration 201_notifications_schema_v2.sql)
- send-push-notification Edge Function exists
- ListingStatus type in p2p-kids-marketplace/src/types/listing.ts needs updating

REQUIREMENTS:
1. ALTER items table: drop old CHECK, add new CHECK with 'flagged' + 'rejected'
2. Add columns: flagged_at, rejected_at, rejection_reason, appeal_count
3. Update RLS: flagged/rejected items visible to item owner + admins only
4. Create trigger: on status change to 'flagged' or 'rejected', insert notification
5. Update TypeScript ListingStatus type

==================================================
FILE 1: Migration to extend items.status
==================================================
*/

-- filepath: supabase/migrations/301_extend_items_status_for_safety.sql
-- Mode: idempotent (safe to re-run)

-- STEP 1: Drop the old CHECK constraint and add the extended one
-- The constraint name from 20251217000002 is auto-generated; find it dynamically.
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'items'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.items DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END
$$;

-- Add new CHECK with 'flagged' + 'rejected'
ALTER TABLE public.items
  ADD CONSTRAINT items_status_check
  CHECK (status IN ('draft', 'available', 'pending', 'sold', 'deleted', 'paused', 'flagged', 'rejected'));

-- STEP 2: Add safety-related columns (idempotent)
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS appeal_count INTEGER DEFAULT 0;

-- STEP 3: Update RLS policy for flagged/rejected visibility
-- Currently: "Anyone can view available items" ON items FOR SELECT
--   USING (status = 'available' OR seller_id = auth.uid())
-- This already lets the owner see their own flagged/rejected items.
-- Admins need access too:

DROP POLICY IF EXISTS "Admins can view all items" ON public.items;
CREATE POLICY "Admins can view all items" ON public.items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'moderator')
    )
  );

-- Admins can update item status (for approve/reject actions)
DROP POLICY IF EXISTS "Admins can update item status" ON public.items;
CREATE POLICY "Admins can update item status" ON public.items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'moderator')
    )
  );

-- STEP 4: Trigger to notify seller when item is flagged or rejected
CREATE OR REPLACE FUNCTION public.fn_notify_seller_on_item_flag()
RETURNS TRIGGER AS $$
-- SECURITY DEFINER needed because: inserts into notifications table on behalf of system
BEGIN
  -- Only fire when status changes TO 'flagged' or 'rejected'
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status IN ('flagged', 'rejected') THEN

    -- Set timestamp columns
    IF NEW.status = 'flagged' THEN
      NEW.flagged_at := NOW();
    END IF;
    IF NEW.status = 'rejected' THEN
      NEW.rejected_at := NOW();
    END IF;

    -- Insert in-app notification for seller
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.seller_id,
      CASE
        WHEN NEW.status = 'flagged' THEN 'item_flagged'
        WHEN NEW.status = 'rejected' THEN 'item_rejected'
      END,
      CASE
        WHEN NEW.status = 'flagged' THEN 'Item Under Review'
        WHEN NEW.status = 'rejected' THEN 'Item Rejected'
      END,
      CASE
        WHEN NEW.status = 'flagged' THEN 'Your listing "' || LEFT(NEW.title, 50) || '" has been flagged for review.'
        WHEN NEW.status = 'rejected' THEN 'Your listing "' || LEFT(NEW.title, 50) || '" has been rejected. ' || COALESCE(NEW.rejection_reason, 'Please review our guidelines.')
      END,
      jsonb_build_object('item_id', NEW.id, 'status', NEW.status, 'reason', COALESCE(NEW.rejection_reason, ''))
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_notify_seller_on_item_flag ON public.items;
CREATE TRIGGER tr_notify_seller_on_item_flag
  BEFORE UPDATE ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_seller_on_item_flag();

/*
==================================================
VERIFICATION QUERIES (run after migration)
==================================================
*/

-- Verify new CHECK constraint
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.items'::regclass AND contype = 'c';

-- Verify new columns
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'items' AND column_name IN ('flagged_at', 'rejected_at', 'rejection_reason', 'appeal_count');

-- Verify trigger
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public' AND trigger_name = 'tr_notify_seller_on_item_flag';

-- Verify RLS policies
-- SELECT policyname, cmd, permissive, roles, qual
-- FROM pg_policies WHERE tablename = 'items';

/*
==================================================
FILE 2: Update TypeScript types
==================================================
*/

// filepath: p2p-kids-marketplace/src/types/listing.ts (UPDATE)

// CHANGE:
// export type ListingStatus = 'draft' | 'available' | 'pending' | 'sold' | 'deleted';
// TO:
// export type ListingStatus = 'draft' | 'available' | 'pending' | 'sold' | 'deleted' | 'paused' | 'flagged' | 'rejected';

// ADD to Listing interface:
// flagged_at: string | null;
// rejected_at: string | null;
// rejection_reason: string | null;
// appeal_count: number;

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ items.status CHECK allows 'flagged' and 'rejected'
✓ flagged_at, rejected_at, rejection_reason, appeal_count columns added
✓ Admins can view/update all items (including flagged/rejected)
✓ Seller sees their own flagged/rejected items
✓ Notification inserted when item flagged or rejected
✓ Trigger sets timestamp columns automatically
✓ ListingStatus TypeScript type updated
✓ Migration is idempotent (safe to re-run)

==================================================
NEXT TASK
==================================================

SAFETY-001: CPSC API daily batch import
*/
```

---

### Output Files

1. **supabase/migrations/301_extend_items_status_for_safety.sql** — Schema changes + trigger + RLS
2. **p2p-kids-marketplace/src/types/listing.ts** — Updated `ListingStatus` type

---

### Testing Steps

1. **Verify status constraint:**
   - Insert item with status='flagged' → should succeed
   - Insert item with status='rejected' → should succeed
   - Insert item with status='invalid' → should fail

2. **Verify trigger:**
   - Update item status from 'available' to 'flagged'
   - Check notifications table → notification for seller exists
   - Verify flagged_at is set
   - Update item status from 'flagged' to 'rejected' with rejection_reason
   - Check notifications table → rejection notification exists
   - Verify rejected_at is set

3. **Verify RLS:**
   - As admin: can see flagged/rejected items
   - As seller (item owner): can see own flagged/rejected items
   - As other user: cannot see flagged/rejected items

4. **Verify TypeScript:**
   - `yarn typecheck` passes with updated ListingStatus

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Write migration SQL | 45 min |
| Test CHECK constraint + columns | 20 min |
| Test trigger + notifications | 30 min |
| Update TypeScript types | 10 min |
| Verify RLS policies | 15 min |
| **Total** | **~2 hours** |

---

---

## SAFETY TASKS (depend on prerequisites above)

---

## TASK SAFETY-001: Implement CPSC API Daily Batch Import (Supabase Edge Function + pg_cron)

**Duration:** 4 hours  
**Priority:** High  
**Dependencies:** INFRA-001 (Supabase setup)

### Description
Create Edge Function to fetch CPSC recalls from public API. Import recalls into cpsc_recalls table. Schedule daily via pg_cron. Store recall ID, product name, hazard description, recall date. Deduplicate existing recalls.

---

### AI Prompt for Cursor (Generate CPSC Batch Import)

```typescript
/*
TASK: Implement CPSC API daily batch import

CONTEXT:
CPSC publishes recall data via public API.
Import recalls daily to check against user listings.

REQUIREMENTS:
1. Create cpsc_recalls table
2. Edge Function to fetch recalls from CPSC API
3. Deduplicate existing recalls (by recall_number)
4. Schedule daily via pg_cron
5. Log import status

==================================================
FILE 1: Database migration for CPSC recalls
==================================================
*/

-- filepath: supabase/migrations/044_cpsc_recalls.sql

-- CPSC recalls table
CREATE TABLE cpsc_recalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_number TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  product_description TEXT,
  manufacturer TEXT,
  hazard TEXT,
  remedy TEXT,
  recall_date DATE NOT NULL,
  images JSONB DEFAULT '[]'::jsonb,
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX cpsc_recalls_recall_number_idx ON cpsc_recalls(recall_number);
CREATE INDEX cpsc_recalls_product_name_idx ON cpsc_recalls USING gin(to_tsvector('english', product_name));
CREATE INDEX cpsc_recalls_recall_date_idx ON cpsc_recalls(recall_date DESC);

-- CPSC import log
CREATE TABLE cpsc_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT CHECK (status IN ('success', 'failed', 'partial')),
  recalls_imported INTEGER DEFAULT 0,
  recalls_updated INTEGER DEFAULT 0,
  error_message TEXT,
  duration_seconds INTEGER
);

CREATE INDEX cpsc_import_log_import_date_idx ON cpsc_import_log(import_date DESC);

-- Auto-update trigger
CREATE TRIGGER update_cpsc_recalls_updated_at
  BEFORE UPDATE ON cpsc_recalls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies (public read, service role write)
ALTER TABLE cpsc_recalls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view recalls"
  ON cpsc_recalls FOR SELECT
  USING (TRUE);

CREATE POLICY "Service role can manage recalls"
  ON cpsc_recalls FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE cpsc_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view import log"
  ON cpsc_import_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'moderator')
    )
  );

/*
==================================================
FILE 2: Edge Function to import CPSC recalls
==================================================
*/

// filepath: supabase/functions/import-cpsc-recalls/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CPSC API endpoint (example - verify actual API)
const CPSC_API_URL = 'https://www.cpsc.gov/s3fs-public/api/recalls.json';

serve(async (req) => {
  const startTime = Date.now();

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Fetching CPSC recalls...');

    // Fetch recalls from CPSC API
    const response = await fetch(CPSC_API_URL);

    if (!response.ok) {
      throw new Error(`CPSC API error: ${response.status}`);
    }

    const data = await response.json();
    const recalls = data.recalls || data; // Adjust based on actual API structure

    let importedCount = 0;
    let updatedCount = 0;

    // Process each recall
    for (const recall of recalls) {
      const recallData = {
        recall_number: recall.recallNumber || recall.recall_id,
        product_name: recall.productName || recall.title,
        product_description: recall.description || null,
        manufacturer: recall.manufacturer || null,
        hazard: recall.hazard || recall.hazardDescription || null,
        remedy: recall.remedy || null,
        recall_date: recall.recallDate || recall.date,
        images: recall.images ? JSON.stringify(recall.images) : '[]',
        source_url: recall.url || null,
      };

      // Upsert recall (insert or update if exists)
      const { error, data: result } = await supabaseClient
        .from('cpsc_recalls')
        .upsert(recallData, {
          onConflict: 'recall_number',
          ignoreDuplicates: false,
        })
        .select();

      if (error) {
        console.error(`Error upserting recall ${recallData.recall_number}:`, error);
        continue;
      }

      if (result && result.length > 0) {
        // Check if it was an insert or update
        const { data: existing } = await supabaseClient
          .from('cpsc_recalls')
          .select('created_at, updated_at')
          .eq('recall_number', recallData.recall_number)
          .single();

        if (existing && existing.created_at !== existing.updated_at) {
          updatedCount++;
        } else {
          importedCount++;
        }
      }
    }

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    // Log import success
    await supabaseClient.from('cpsc_import_log').insert({
      status: 'success',
      recalls_imported: importedCount,
      recalls_updated: updatedCount,
      duration_seconds: durationSeconds,
    });

    console.log(`CPSC import complete: ${importedCount} new, ${updatedCount} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: importedCount,
        updated: updatedCount,
        duration: durationSeconds,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    // Log import failure
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseClient.from('cpsc_import_log').insert({
      status: 'failed',
      error_message: error.message,
      duration_seconds: durationSeconds,
    });

    console.error('CPSC import error:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/*
==================================================
FILE 3: Schedule daily import via pg_cron
==================================================
*/

-- filepath: supabase/migrations/045_schedule_cpsc_import.sql

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily CPSC import at 2 AM UTC
SELECT cron.schedule(
  'cpsc-daily-import',
  '0 2 * * *', -- Every day at 2 AM
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/import-cpsc-recalls',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY')
  );
  $$
);

-- TODO: Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with actual values

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ cpsc_recalls table created
✓ Edge Function fetches recalls from CPSC API
✓ Recalls deduplicated by recall_number
✓ Daily import scheduled via pg_cron
✓ Import status logged
✓ New recalls stored, existing updated

==================================================
NEXT TASK
==================================================

SAFETY-002: CPSC recall matching logic
*/
```

---

### Output Files

1. **supabase/migrations/044_cpsc_recalls.sql** - CPSC recalls schema
2. **supabase/functions/import-cpsc-recalls/index.ts** - Import Edge Function
3. **supabase/migrations/045_schedule_cpsc_import.sql** - Cron schedule

---

### Testing Steps

1. **Test CPSC import:**
   - Trigger Edge Function → Recalls imported
   - Check cpsc_recalls table → Data populated
   - Run again → Duplicates not created

2. **Test scheduling:**
   - Verify cron job created
   - Check import log next day

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create CPSC schema | 45 min |
| Build import Edge Function | 1.5 hours |
| Test CPSC API integration | 1 hour |
| Set up pg_cron schedule | 45 min |
| **Total** | **~4 hours** |

---

## TASK SAFETY-002: Create CPSC Recall Matching Logic (Check Item Title/Description Against Recall Database)

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** SAFETY-001 (CPSC import)

### Description
When item is listed, check title/description against CPSC recalls. Use full-text search or fuzzy matching. If match found, flag item for review. Store match confidence score. Notify seller of potential match.

---

### AI Prompt for Cursor (Generate CPSC Matching)

```typescript
/*
TASK: Implement CPSC recall matching

REQUIREMENTS:
1. Check item title/description against cpsc_recalls
2. Full-text search with PostgreSQL tsvector
3. Calculate confidence score
4. Flag item if match found (confidence > threshold)
5. Store match details in item_safety_flags table

==================================================
FILE 1: Safety flags table
==================================================
*/

-- filepath: supabase/migrations/046_item_safety_flags.sql

-- Item safety flags table
CREATE TABLE item_safety_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('cpsc_recall', 'ai_moderation', 'user_report')),
  flag_reason TEXT NOT NULL,
  confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
  recall_id UUID REFERENCES cpsc_recalls(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX item_safety_flags_item_id_idx ON item_safety_flags(item_id);
CREATE INDEX item_safety_flags_status_idx ON item_safety_flags(status);
CREATE INDEX item_safety_flags_flag_type_idx ON item_safety_flags(flag_type);

-- RLS policies
ALTER TABLE item_safety_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all flags"
  ON item_safety_flags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Sellers can view own item flags"
  ON item_safety_flags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = item_safety_flags.item_id
      AND items.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert flags"
  ON item_safety_flags FOR INSERT
  WITH CHECK (TRUE);

/*
==================================================
FILE 2: CPSC matching function
==================================================
*/

-- filepath: supabase/migrations/047_cpsc_matching_function.sql

-- Function to check item against CPSC recalls
CREATE OR REPLACE FUNCTION check_cpsc_recalls(
  p_item_id UUID,
  p_title TEXT,
  p_description TEXT
)
RETURNS TABLE(
  recall_id UUID,
  recall_number TEXT,
  product_name TEXT,
  similarity_score DECIMAL
) AS $$
BEGIN
  -- Full-text search against CPSC recalls
  RETURN QUERY
  SELECT
    cr.id,
    cr.recall_number,
    cr.product_name,
    GREATEST(
      similarity(p_title, cr.product_name),
      similarity(COALESCE(p_description, ''), COALESCE(cr.product_description, ''))
    ) AS similarity_score
  FROM cpsc_recalls cr
  WHERE
    -- Full-text search
    to_tsvector('english', cr.product_name) @@ plainto_tsquery('english', p_title)
    OR to_tsvector('english', COALESCE(cr.product_description, '')) @@ plainto_tsquery('english', COALESCE(p_description, ''))
    -- Fuzzy matching (if pg_trgm extension enabled)
    OR similarity(p_title, cr.product_name) > 0.3
  ORDER BY similarity_score DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- Enable pg_trgm for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

/*
==================================================
FILE 3: Edge Function to check item on creation
==================================================
*/

// filepath: supabase/functions/check-item-safety/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CPSC_MATCH_THRESHOLD = 0.5; // Flag if similarity > 50%

serve(async (req) => {
  try {
    const { itemId, title, description } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check against CPSC recalls
    const { data: matches, error } = await supabaseClient.rpc('check_cpsc_recalls', {
      p_item_id: itemId,
      p_title: title,
      p_description: description || '',
    });

    if (error) throw error;

    // Flag item if high-confidence match found
    if (matches && matches.length > 0) {
      const topMatch = matches[0];

      if (topMatch.similarity_score >= CPSC_MATCH_THRESHOLD) {
        // Create safety flag
        await supabaseClient.from('item_safety_flags').insert({
          item_id: itemId,
          flag_type: 'cpsc_recall',
          flag_reason: `Possible CPSC recall match: ${topMatch.product_name}`,
          confidence_score: topMatch.similarity_score,
          recall_id: topMatch.recall_id,
          status: 'pending',
        });

        // Update item status to 'flagged'
        await supabaseClient
          .from('items')
          .update({ status: 'flagged' })
          .eq('id', itemId);

        console.log(`Item ${itemId} flagged for CPSC recall match`);

        return new Response(
          JSON.stringify({
            flagged: true,
            reason: 'cpsc_recall',
            match: topMatch,
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ flagged: false }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Item checked against CPSC recalls on creation
✓ Full-text search matches product names
✓ Similarity score calculated
✓ Item flagged if confidence > threshold
✓ Safety flag created in database
✓ Item status updated to 'flagged'

==================================================
NEXT TASK
==================================================

SAFETY-003: Auto-flagging for CPSC matches
*/
```

### Time Breakdown: **~3 hours**

---

## TASK SAFETY-003: Implement Auto-Flagging for CPSC Matches (Queue for Admin Review)

**Duration:** 1.5 hours  
**Priority:** Medium  
**Dependencies:** SAFETY-002 (CPSC matching)

### Description
Already implemented in SAFETY-002. Verify auto-flagging works: item flagged → status='flagged' → appears in admin moderation queue. Seller notified of flag.

---

### Time Breakdown: **~1.5 hours** (verification + notifications)

---

## TASK SAFETY-004: Implement Google Vision API Image Moderation (Supabase Edge Function)

**Duration:** 3.5 hours  
**Priority:** High  
**Dependencies:** ITEM-002 (Image upload)

### Description
Use Google Vision API to check images for unsafe content. Detect: adult, violence, racy content. Flag images with high likelihood. Run on image upload. Store moderation results.

---

### AI Prompt for Cursor (Generate Google Vision Moderation)

```typescript
/*
TASK: Implement Google Vision API image moderation

REQUIREMENTS:
1. Call Google Vision Safe Search API
2. Check for: adult, violence, racy, medical, spoof
3. Flag if any category = LIKELY or VERY_LIKELY
4. Store results in ai_moderation_logs table
5. Update item status if flagged

==================================================
FILE 1: AI moderation logs table
==================================================
*/

-- filepath: supabase/migrations/048_ai_moderation_logs.sql

-- AI moderation logs table
CREATE TABLE ai_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  image_url TEXT,
  moderation_type TEXT CHECK (moderation_type IN ('image', 'text')),
  service TEXT, -- 'google_vision', 'custom_agent', 'gpt4'
  decision TEXT CHECK (decision IN ('approved', 'flagged', 'rejected')),
  confidence_score DECIMAL(3, 2),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX ai_moderation_logs_item_id_idx ON ai_moderation_logs(item_id);
CREATE INDEX ai_moderation_logs_decision_idx ON ai_moderation_logs(decision);
CREATE INDEX ai_moderation_logs_created_at_idx ON ai_moderation_logs(created_at DESC);

-- RLS policies
ALTER TABLE ai_moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view moderation logs"
  ON ai_moderation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "System can insert moderation logs"
  ON ai_moderation_logs FOR INSERT
  WITH CHECK (TRUE);

/*
==================================================
FILE 2: Google Vision moderation Edge Function
==================================================
*/

// filepath: supabase/functions/moderate-image/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY');
const GOOGLE_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

serve(async (req) => {
  try {
    const { itemId, imageUrl } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call Google Vision Safe Search API
    const visionResponse = await fetch(GOOGLE_VISION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { source: { imageUri: imageUrl } },
            features: [{ type: 'SAFE_SEARCH_DETECTION' }],
          },
        ],
      }),
    });

    const visionData = await visionResponse.json();
    const safeSearch = visionData.responses[0]?.safeSearchAnnotation;

    if (!safeSearch) {
      throw new Error('No Safe Search results returned');
    }

    // Check likelihood levels
    const flaggedCategories = [];
    let maxConfidence = 0;

    const categories = ['adult', 'violence', 'racy', 'medical', 'spoof'];
    const likelihoodScores = {
      UNKNOWN: 0,
      VERY_UNLIKELY: 0.1,
      UNLIKELY: 0.3,
      POSSIBLE: 0.5,
      LIKELY: 0.7,
      VERY_LIKELY: 0.9,
    };

    for (const category of categories) {
      const likelihood = safeSearch[category];
      const score = likelihoodScores[likelihood] || 0;

      if (score > maxConfidence) {
        maxConfidence = score;
      }

      if (likelihood === 'LIKELY' || likelihood === 'VERY_LIKELY') {
        flaggedCategories.push(category);
      }
    }

    const isFlagged = flaggedCategories.length > 0;
    const decision = isFlagged ? 'flagged' : 'approved';

    // Log moderation result
    await supabaseClient.from('ai_moderation_logs').insert({
      item_id: itemId,
      image_url: imageUrl,
      moderation_type: 'image',
      service: 'google_vision',
      decision,
      confidence_score: maxConfidence,
      details: {
        safe_search: safeSearch,
        flagged_categories: flaggedCategories,
      },
    });

    // Flag item if unsafe content detected
    if (isFlagged) {
      await supabaseClient.from('item_safety_flags').insert({
        item_id: itemId,
        flag_type: 'ai_moderation',
        flag_reason: `Unsafe image content detected: ${flaggedCategories.join(', ')}`,
        confidence_score: maxConfidence,
        status: 'pending',
      });

      await supabaseClient
        .from('items')
        .update({ status: 'flagged' })
        .eq('id', itemId);
    }

    return new Response(
      JSON.stringify({
        decision,
        flagged: isFlagged,
        categories: flaggedCategories,
        confidence: maxConfidence,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Google Vision API called for each image
✓ Safe Search results evaluated
✓ Item flagged if unsafe content detected
✓ Moderation log created
✓ Flagged categories stored in details

==================================================
NEXT TASK
==================================================

SAFETY-005: Custom AI agent for text review
*/
```

### Time Breakdown: **~3.5 hours**

---

## TASK SAFETY-005: Implement Custom AI Agent for Title/Description Review (Supabase Edge Function or External Service)

**Duration:** 4 hours  
**Priority:** High  
**Dependencies:** ITEM-001 (Item listing)

### Description
Custom AI agent to review item title/description for policy violations. Check for: prohibited items, offensive language, spam, misleading claims. Use OpenAI GPT-4 or custom model. Flag suspicious listings.

---

### AI Prompt for Cursor (Generate Custom AI Agent)

```typescript
/*
TASK: Implement custom AI text moderation agent

REQUIREMENTS:
1. Review item title and description
2. Check for: prohibited items, offensive language, spam, scams
3. Use GPT-4 API or custom model
4. Return decision + confidence + reasoning
5. Flag if high risk detected

==================================================
FILE: Edge Function for AI text moderation
==================================================
*/

// filepath: supabase/functions/moderate-text/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  try {
    const { itemId, title, description } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Construct AI moderation prompt
    const prompt = `You are a content moderation AI for a peer-to-peer marketplace. Analyze the following item listing for policy violations.

Title: "${title}"
Description: "${description}"

Check for:
1. Prohibited items (weapons, drugs, alcohol, tobacco, adult content, hazardous materials)
2. Offensive or hateful language
3. Spam or scam indicators
4. Misleading or deceptive claims
5. Personal information (phone numbers, emails, addresses)

Respond in JSON format:
{
  "decision": "approved" | "flagged" | "rejected",
  "confidence": 0.0 to 1.0,
  "violations": ["category1", "category2"],
  "reasoning": "Brief explanation"
}`;

    // Call OpenAI GPT-4
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a content moderation assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    const openaiData = await openaiResponse.json();
    const aiResult = JSON.parse(openaiData.choices[0].message.content);

    // Log moderation result
    await supabaseClient.from('ai_moderation_logs').insert({
      item_id: itemId,
      moderation_type: 'text',
      service: 'custom_agent',
      decision: aiResult.decision,
      confidence_score: aiResult.confidence,
      details: {
        violations: aiResult.violations,
        reasoning: aiResult.reasoning,
      },
    });

    // Flag item if violations detected
    if (aiResult.decision === 'flagged' || aiResult.decision === 'rejected') {
      await supabaseClient.from('item_safety_flags').insert({
        item_id: itemId,
        flag_type: 'ai_moderation',
        flag_reason: `Policy violations detected: ${aiResult.violations.join(', ')}`,
        confidence_score: aiResult.confidence,
        status: 'pending',
      });

      await supabaseClient
        .from('items')
        .update({ status: 'flagged' })
        .eq('id', itemId);
    }

    return new Response(
      JSON.stringify({
        decision: aiResult.decision,
        confidence: aiResult.confidence,
        violations: aiResult.violations,
        reasoning: aiResult.reasoning,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ AI agent reviews title and description
✓ Policy violations detected
✓ Decision with confidence score returned
✓ Item flagged if violations found
✓ Reasoning logged for review

==================================================
NEXT TASK
==================================================

SAFETY-006: AI moderation logging
*/
```

### Time Breakdown: **~4 hours**

---

## TASK SAFETY-006: Create AI Moderation Logging (Store All Decisions, Confidence Scores)

**Duration:** 1 hour  
**Priority:** Medium  
**Dependencies:** SAFETY-004 (Google Vision), SAFETY-005 (Custom AI)

### Description
Already implemented in SAFETY-004 and SAFETY-005. Verify ai_moderation_logs table populated with all moderation decisions. Admin can view logs.

---

### Time Breakdown: **~1 hour** (verification only)

---

## TASK SAFETY-007: Implement Fallback to GPT-4 for Low-Confidence Cases

**Duration:** 2.5 hours  
**Priority:** Medium  
**Dependencies:** SAFETY-005 (Custom AI)

### Description
If custom AI agent returns low confidence (< 0.7), escalate to GPT-4 for second opinion. Combine results. If both uncertain, queue for manual review.

---

### AI Prompt for Cursor (Generate GPT-4 Fallback)

```typescript
/*
TASK: Implement GPT-4 fallback for low-confidence moderation

REQUIREMENTS:
1. Check custom agent confidence score
2. If < 0.7, call GPT-4 for second opinion
3. Combine results (highest confidence wins)
4. Queue for manual review if both uncertain

FILE: supabase/functions/moderate-text/index.ts (UPDATE)
- Add fallback logic after custom agent
- Call GPT-4 if needed
- Combine decisions
*/
```

### Time Breakdown: **~2.5 hours**

---

## TASK SAFETY-008: Create Admin Review Workflow for Flagged Items (Approve/Reject/Request Edits)

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** ADMIN-006 (Moderation queue)

### Description
Admin can review flagged items in moderation queue. Actions: approve (go live), reject (delete), request edits (send back to seller). Seller notified of decision.

---

### AI Prompt for Cursor (Generate Admin Review Workflow)

```typescript
/*
TASK: Create admin review workflow for flagged items

REQUIREMENTS:
1. Display flagged item in moderation queue
2. Show flag reason and confidence
3. Actions: Approve, Reject, Request Edits
4. Update item status based on action
5. Notify seller of decision

FILES:
- admin/app/moderation/items/[id]/page.tsx
- admin/lib/moderationActions.ts (from ADMIN-007)
*/
```

### Time Breakdown: **~3 hours**

---

## TASK SAFETY-009: Implement Seller Appeal Workflow (Resubmit with Changes)

**Duration:** 2.5 hours  
**Priority:** Medium  
**Dependencies:** SAFETY-008 (Admin review)

### Description
Seller can appeal rejected item. Edit listing and resubmit. Item re-enters moderation queue. Admin can approve after edits. Track appeal history.

---

### AI Prompt for Cursor (Generate Seller Appeal)

```typescript
/*
TASK: Implement seller appeal workflow

REQUIREMENTS:
1. Seller views rejected item
2. "Edit and Resubmit" button
3. Update listing
4. Resubmit for review (status='pending_review')
5. Re-enters moderation queue
6. Track appeal count

FILES:
- src/screens/items/RejectedItemScreen.tsx
- admin/app/moderation/page.tsx (UPDATE - show appeals)
*/
```

### Time Breakdown: **~2.5 hours**

---

## TASK SAFETY-010: Implement Admin-Managed Terms of Service (TOS) System

**Duration:** 4.5 hours  
**Priority:** High  
**Dependencies:** AUTH-001 (User authentication), ADMIN-001 (Admin portal)

### Description
Create comprehensive TOS system with admin content management. Admin can create, edit, and publish TOS versions. Users must accept TOS on signup. Display TOS in app settings. Track acceptance history and version changes. Store TOS acceptance in database with timestamp and version.

---

### AI Prompt for Cursor (Generate Admin-Managed TOS System)

```typescript
/*
TASK: Implement admin-managed Terms of Service system

REQUIREMENTS:
1. Database table for storing policy versions
2. Admin UI to create/edit/publish TOS
3. Mobile screen to display TOS
4. Require TOS acceptance on signup
5. Track acceptance with version and timestamp
6. Support version history

==================================================
FILE 1: Platform policies table (stores all policy types)
==================================================
*/

-- filepath: supabase/migrations/049_platform_policies.sql

-- Platform policies table (TOS, Privacy Policy, Disclaimer)
CREATE TABLE platform_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_type TEXT NOT NULL CHECK (policy_type IN ('terms_of_service', 'privacy_policy', 'liability_disclaimer')),
  version TEXT NOT NULL, -- e.g., "1.0", "1.1", "2.0"
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Full markdown/HTML content
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  effective_date TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(policy_type, version)
);

CREATE INDEX platform_policies_type_status_idx ON platform_policies(policy_type, status);
CREATE INDEX platform_policies_effective_date_idx ON platform_policies(effective_date DESC);

-- Policy acceptance tracking
CREATE TABLE policy_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES platform_policies(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  UNIQUE(user_id, policy_id)
);

CREATE INDEX policy_acceptances_user_id_idx ON policy_acceptances(user_id);
CREATE INDEX policy_acceptances_policy_id_idx ON policy_acceptances(policy_id);
CREATE INDEX policy_acceptances_accepted_at_idx ON policy_acceptances(accepted_at DESC);

-- RLS policies for platform_policies
ALTER TABLE platform_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published policies"
  ON platform_policies FOR SELECT
  USING (status = 'published');

CREATE POLICY "Admins can manage all policies"
  ON platform_policies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS policies for policy_acceptances
ALTER TABLE policy_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own acceptances"
  ON policy_acceptances FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert acceptances"
  ON policy_acceptances FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all acceptances"
  ON policy_acceptances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

/*
==================================================
FILE 2: RPC functions for policy management
==================================================
*/

-- filepath: supabase/migrations/050_policy_management_rpc.sql

-- Get current published policy by type
CREATE OR REPLACE FUNCTION get_current_policy(p_policy_type TEXT)
RETURNS TABLE(
  id UUID,
  policy_type TEXT,
  version TEXT,
  title TEXT,
  content TEXT,
  effective_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id,
    pp.policy_type,
    pp.version,
    pp.title,
    pp.content,
    pp.effective_date
  FROM platform_policies pp
  WHERE pp.policy_type = p_policy_type
    AND pp.status = 'published'
  ORDER BY pp.effective_date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has accepted current policy
CREATE OR REPLACE FUNCTION has_accepted_current_policy(
  p_user_id UUID,
  p_policy_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_policy_id UUID;
  v_acceptance_exists BOOLEAN;
BEGIN
  -- Get current published policy ID
  SELECT id INTO v_current_policy_id
  FROM platform_policies
  WHERE policy_type = p_policy_type
    AND status = 'published'
  ORDER BY effective_date DESC
  LIMIT 1;

  -- Check if user has accepted this version
  SELECT EXISTS(
    SELECT 1 FROM policy_acceptances
    WHERE user_id = p_user_id
      AND policy_id = v_current_policy_id
  ) INTO v_acceptance_exists;

  RETURN COALESCE(v_acceptance_exists, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Publish policy (admin only)
CREATE OR REPLACE FUNCTION publish_policy(
  p_policy_id UUID,
  p_admin_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can publish policies';
  END IF;

  -- Archive previous published version of same type
  UPDATE platform_policies
  SET status = 'archived'
  WHERE policy_type = (SELECT policy_type FROM platform_policies WHERE id = p_policy_id)
    AND status = 'published'
    AND id != p_policy_id;

  -- Publish new version
  UPDATE platform_policies
  SET
    status = 'published',
    published_by = p_admin_id,
    published_at = NOW(),
    effective_date = COALESCE(effective_date, NOW())
  WHERE id = p_policy_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 3: Admin UI - Policy management page
==================================================
*/

// filepath: p2p-kids-admin/src/app/settings/policies/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PolicyType = 'terms_of_service' | 'privacy_policy' | 'liability_disclaimer';

interface Policy {
  id: string;
  policy_type: PolicyType;
  version: string;
  title: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  effective_date: string | null;
  created_at: string;
  published_at: string | null;
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Record<PolicyType, Policy[]>>({
    terms_of_service: [],
    privacy_policy: [],
    liability_disclaimer: [],
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_policies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const grouped = (data || []).reduce((acc, policy) => {
        if (!acc[policy.policy_type]) acc[policy.policy_type] = [];
        acc[policy.policy_type].push(policy);
        return acc;
      }, {} as Record<PolicyType, Policy[]>);

      setPolicies({
        terms_of_service: grouped.terms_of_service || [],
        privacy_policy: grouped.privacy_policy || [],
        liability_disclaimer: grouped.liability_disclaimer || [],
      });
    } catch (error) {
      console.error('Error fetching policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const publishPolicy = async (policyId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('publish_policy', {
        p_policy_id: policyId,
        p_admin_id: user.id,
      });

      if (error) throw error;

      alert('Policy published successfully');
      fetchPolicies();
    } catch (error) {
      console.error('Error publishing policy:', error);
      alert('Failed to publish policy');
    }
  };

  const PolicyList = ({ policyType, title }: { policyType: PolicyType; title: string }) => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Button onClick={() => window.location.href = `/settings/policies/new?type=${policyType}`}>
          Create New Version
        </Button>
      </div>

      {policies[policyType].map((policy) => (
        <Card key={policy.id}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-base">{policy.title}</CardTitle>
                <p className="text-sm text-gray-500">Version {policy.version}</p>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  policy.status === 'published'
                    ? 'bg-green-100 text-green-800'
                    : policy.status === 'draft'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {policy.status}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Created:</strong> {new Date(policy.created_at).toLocaleDateString()}
              </p>
              {policy.published_at && (
                <p>
                  <strong>Published:</strong> {new Date(policy.published_at).toLocaleDateString()}
                </p>
              )}
              {policy.effective_date && (
                <p>
                  <strong>Effective:</strong> {new Date(policy.effective_date).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.href = `/settings/policies/${policy.id}`}
              >
                View/Edit
              </Button>
              {policy.status === 'draft' && (
                <Button
                  size="sm"
                  onClick={() => publishPolicy(policy.id)}
                >
                  Publish
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {policies[policyType].length === 0 && (
        <p className="text-gray-500 text-center py-8">No policies created yet</p>
      )}
    </div>
  );

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Platform Policies</h1>

      <Tabs defaultValue="terms_of_service">
        <TabsList>
          <TabsTrigger value="terms_of_service">Terms of Service</TabsTrigger>
          <TabsTrigger value="privacy_policy">Privacy Policy</TabsTrigger>
          <TabsTrigger value="liability_disclaimer">Liability Disclaimer</TabsTrigger>
        </TabsList>

        <TabsContent value="terms_of_service" className="mt-6">
          <PolicyList policyType="terms_of_service" title="Terms of Service" />
        </TabsContent>

        <TabsContent value="privacy_policy" className="mt-6">
          <PolicyList policyType="privacy_policy" title="Privacy Policy" />
        </TabsContent>

        <TabsContent value="liability_disclaimer" className="mt-6">
          <PolicyList policyType="liability_disclaimer" title="Liability Disclaimer" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/*
==================================================
FILE 4: Admin UI - Policy editor (create/edit)
==================================================
*/

// filepath: p2p-kids-admin/src/app/settings/policies/[id]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PolicyEditorPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [policy, setPolicy] = useState({
    policy_type: 'terms_of_service',
    version: '',
    title: '',
    content: '',
    effective_date: '',
  });

  useEffect(() => {
    if (params.id && params.id !== 'new') {
      fetchPolicy();
    } else {
      setLoading(false);
    }
  }, [params.id]);

  const fetchPolicy = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_policies')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;

      setPolicy({
        policy_type: data.policy_type,
        version: data.version,
        title: data.title,
        content: data.content,
        effective_date: data.effective_date || '',
      });
    } catch (error) {
      console.error('Error fetching policy:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePolicy = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (params.id === 'new') {
        // Create new policy
        const { error } = await supabase.from('platform_policies').insert({
          ...policy,
          created_by: user.id,
          status: 'draft',
        });

        if (error) throw error;
      } else {
        // Update existing policy
        const { error } = await supabase
          .from('platform_policies')
          .update({
            version: policy.version,
            title: policy.title,
            content: policy.content,
            effective_date: policy.effective_date || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id);

        if (error) throw error;
      }

      alert('Policy saved successfully');
      router.push('/settings/policies');
    } catch (error) {
      console.error('Error saving policy:', error);
      alert('Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>
            {params.id === 'new' ? 'Create New Policy' : 'Edit Policy'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Policy Type</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={policy.policy_type}
              onChange={(e) => setPolicy({ ...policy, policy_type: e.target.value })}
              disabled={params.id !== 'new'}
            >
              <option value="terms_of_service">Terms of Service</option>
              <option value="privacy_policy">Privacy Policy</option>
              <option value="liability_disclaimer">Liability Disclaimer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Version</label>
            <Input
              placeholder="e.g., 1.0, 1.1, 2.0"
              value={policy.version}
              onChange={(e) => setPolicy({ ...policy, version: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <Input
              placeholder="e.g., Terms of Service"
              value={policy.title}
              onChange={(e) => setPolicy({ ...policy, title: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Effective Date (optional)</label>
            <Input
              type="date"
              value={policy.effective_date}
              onChange={(e) => setPolicy({ ...policy, effective_date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Content (Markdown supported)</label>
            <Textarea
              rows={20}
              placeholder="Enter policy content in Markdown format..."
              value={policy.content}
              onChange={(e) => setPolicy({ ...policy, content: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Use Markdown syntax for formatting. Preview will be shown in the mobile app.
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={savePolicy} disabled={saving}>
              {saving ? 'Saving...' : 'Save as Draft'}
            </Button>
            <Button variant="outline" onClick={() => router.push('/settings/policies')}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/*
==================================================
FILE 5: Mobile app - TOS screen
==================================================
*/

// filepath: p2p-kids-marketplace/src/screens/settings/TermsOfServiceScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/config/supabase';
import Markdown from 'react-native-markdown-display';

export default function TermsOfServiceScreen() {
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<any>(null);

  useEffect(() => {
    fetchTOS();
  }, []);

  const fetchTOS = async () => {
    try {
      const { data, error } = await supabase.rpc('get_current_policy', {
        p_policy_type: 'terms_of_service',
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setPolicy(data[0]);
      }
    } catch (error) {
      console.error('Error fetching TOS:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!policy) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Terms of Service not available</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{policy.title}</Text>
        <Text style={styles.version}>Version {policy.version}</Text>
        {policy.effective_date && (
          <Text style={styles.effectiveDate}>
            Effective: {new Date(policy.effective_date).toLocaleDateString()}
          </Text>
        )}
        
        <View style={styles.contentContainer}>
          <Markdown>{policy.content}</Markdown>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  effectiveDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  contentContainer: {
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
});

/*
==================================================
FILE 6: Mobile app - Update signup screen with TOS acceptance
==================================================
*/

// filepath: p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx (UPDATE)

// Add to existing imports:
import { Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Add state for TOS acceptance:
const [tosAccepted, setTosAccepted] = useState(false);
const [tosPolicy, setTosPolicy] = useState<any>(null);
const navigation = useNavigation();

// Add fetch TOS on mount:
useEffect(() => {
  fetchCurrentTOS();
}, []);

const fetchCurrentTOS = async () => {
  try {
    const { data, error } = await supabase.rpc('get_current_policy', {
      p_policy_type: 'terms_of_service',
    });

    if (error) throw error;
    if (data && data.length > 0) {
      setTosPolicy(data[0]);
    }
  } catch (error) {
    console.error('Error fetching TOS:', error);
  }
};

// Add TOS acceptance tracking in signup function:
const handleSignup = async () => {
  if (!tosAccepted) {
    alert('Please accept the Terms of Service to continue');
    return;
  }

  try {
    // ... existing signup logic ...

    // After successful signup, record TOS acceptance
    if (tosPolicy) {
      await supabase.from('policy_acceptances').insert({
        user_id: user.id,
        policy_id: tosPolicy.id,
        policy_type: 'terms_of_service',
        policy_version: tosPolicy.version,
        // Note: IP and user agent would need to be captured server-side for accuracy
      });
    }

    // ... rest of signup logic ...
  } catch (error) {
    console.error('Signup error:', error);
  }
};

// Add TOS checkbox in the JSX (before the signup button):
<View style={styles.tosContainer}>
  <Pressable
    style={styles.checkbox}
    onPress={() => setTosAccepted(!tosAccepted)}
  >
    <View style={[styles.checkboxInner, tosAccepted && styles.checkboxChecked]}>
      {tosAccepted && <Text style={styles.checkmark}>✓</Text>}
    </View>
  </Pressable>
  <Text style={styles.tosText}>
    I accept the{' '}
    <Text
      style={styles.tosLink}
      onPress={() => navigation.navigate('TermsOfService')}
    >
      Terms of Service
    </Text>
  </Text>
</View>

// Add styles:
tosContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 16,
  marginBottom: 8,
},
checkbox: {
  marginRight: 8,
},
checkboxInner: {
  width: 24,
  height: 24,
  borderWidth: 2,
  borderColor: '#007AFF',
  borderRadius: 4,
  justifyContent: 'center',
  alignItems: 'center',
},
checkboxChecked: {
  backgroundColor: '#007AFF',
},
checkmark: {
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
},
tosText: {
  fontSize: 14,
  color: '#333',
  flex: 1,
},
tosLink: {
  color: '#007AFF',
  textDecorationLine: 'underline',
},

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ platform_policies table created with versioning
✓ policy_acceptances table tracks user consent
✓ Admin can create/edit policy drafts
✓ Admin can publish policies (archives previous versions)
✓ RPC functions get current policy and check acceptance
✓ Mobile app displays current TOS
✓ Signup requires TOS acceptance
✓ Acceptance logged with version and timestamp
✓ Admin can view policy history and acceptance stats

==================================================
NEXT TASK
==================================================

SAFETY-011: Privacy Policy system
*/
```

---

### Output Files

1. **supabase/migrations/049_platform_policies.sql** - Policies and acceptances tables
2. **supabase/migrations/050_policy_management_rpc.sql** - Policy management functions
3. **p2p-kids-admin/src/app/settings/policies/page.tsx** - Admin policy list
4. **p2p-kids-admin/src/app/settings/policies/[id]/page.tsx** - Admin policy editor
5. **p2p-kids-marketplace/src/screens/settings/TermsOfServiceScreen.tsx** - Mobile TOS viewer
6. **p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx** - Updated with TOS acceptance

---

### Testing Steps

1. **Admin creates TOS:**
   - Login to admin portal
   - Navigate to Settings → Policies
   - Create new TOS version
   - Enter content in Markdown
   - Save as draft → Verify saved

2. **Admin publishes TOS:**
   - Click "Publish" on draft
   - Verify status changes to "published"
   - Previous version archived

3. **Mobile app displays TOS:**
   - Open app settings
   - Tap "Terms of Service"
   - Verify current version displayed
   - Verify Markdown renders correctly

4. **Signup requires acceptance:**
   - Start signup flow
   - Attempt signup without checking TOS → Error
   - Check TOS box → Signup succeeds
   - Verify acceptance recorded in database

5. **Acceptance tracking:**
   - Query policy_acceptances table
   - Verify user_id, policy_id, version, timestamp
   - Admin can view acceptance stats

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create platform_policies schema | 45 min |
| Build RPC functions | 45 min |
| Build admin policy list UI | 1 hour |
| Build admin policy editor UI | 1 hour |
| Build mobile TOS screen | 45 min |
| Update signup with TOS acceptance | 30 min |
| Testing and verification | 30 min |
| **Total** | **~4.5 hours** |

---

## TASK SAFETY-011: Implement Admin-Managed Privacy Policy System

**Duration:** 3.5 hours  
**Priority:** High  
**Dependencies:** SAFETY-010 (Platform policies table), AUTH-001 (User authentication)

### Description
Create Privacy Policy system using the same platform_policies infrastructure from SAFETY-010. Admin can create, edit, and publish Privacy Policy versions. Users can view Privacy Policy in app settings and during signup. Display link from signup screen. Track acceptance history. Reuse existing database tables and RPC functions.

---

### AI Prompt for Cursor (Generate Privacy Policy System)

```typescript
/*
TASK: Implement admin-managed Privacy Policy system

REQUIREMENTS:
1. Reuse platform_policies table from SAFETY-010
2. Admin UI to create/edit/publish Privacy Policy
3. Mobile screen to display Privacy Policy
4. Link from signup screen (optional acceptance)
5. Track views and acceptances
6. Support version history

==================================================
NOTE: Database tables already exist from SAFETY-010
- platform_policies (stores all policy types)
- policy_acceptances (tracks user consent)
- RPC functions: get_current_policy, has_accepted_current_policy, publish_policy
==================================================

FILE 1: Mobile app - Privacy Policy screen
==================================================
*/

// filepath: p2p-kids-marketplace/src/screens/settings/PrivacyPolicyScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/config/supabase';
import Markdown from 'react-native-markdown-display';

export default function PrivacyPolicyScreen() {
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<any>(null);

  useEffect(() => {
    fetchPrivacyPolicy();
  }, []);

  const fetchPrivacyPolicy = async () => {
    try {
      const { data, error } = await supabase.rpc('get_current_policy', {
        p_policy_type: 'privacy_policy',
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setPolicy(data[0]);
      }
    } catch (error) {
      console.error('Error fetching Privacy Policy:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!policy) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Privacy Policy not available</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{policy.title}</Text>
        <Text style={styles.version}>Version {policy.version}</Text>
        {policy.effective_date && (
          <Text style={styles.effectiveDate}>
            Effective: {new Date(policy.effective_date).toLocaleDateString()}
          </Text>
        )}
        
        <View style={styles.contentContainer}>
          <Markdown>{policy.content}</Markdown>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  effectiveDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  contentContainer: {
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
});

/*
==================================================
FILE 2: Add Privacy Policy link to Settings screen
==================================================
*/

// filepath: p2p-kids-marketplace/src/screens/settings/SettingsScreen.tsx (UPDATE)

// Add Privacy Policy link in the settings menu:
<Pressable
  style={styles.settingItem}
  onPress={() => navigation.navigate('PrivacyPolicy')}
>
  <Text style={styles.settingLabel}>Privacy Policy</Text>
  <Text style={styles.settingChevron}>›</Text>
</Pressable>

/*
==================================================
FILE 3: Add Privacy Policy link to signup screen
==================================================
*/

// filepath: p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx (UPDATE)

// Add below the TOS acceptance checkbox:
<View style={styles.policyLinksContainer}>
  <Text style={styles.policyText}>
    By signing up, you agree to our{' '}
    <Text
      style={styles.policyLink}
      onPress={() => navigation.navigate('TermsOfService')}
    >
      Terms of Service
    </Text>
    {' '}and{' '}
    <Text
      style={styles.policyLink}
      onPress={() => navigation.navigate('PrivacyPolicy')}
    >
      Privacy Policy
    </Text>
  </Text>
</View>

// Add styles:
policyLinksContainer: {
  marginTop: 12,
  marginBottom: 8,
},
policyText: {
  fontSize: 12,
  color: '#666',
  textAlign: 'center',
  lineHeight: 18,
},
policyLink: {
  color: '#007AFF',
  textDecorationLine: 'underline',
},

/*
==================================================
FILE 4: Add navigation route for Privacy Policy
==================================================
*/

// filepath: p2p-kids-marketplace/src/navigation/types.ts (UPDATE)

// Add to RootStackParamList:
export type RootStackParamList = {
  // ... existing routes
  TermsOfService: undefined;
  PrivacyPolicy: undefined; // ADD THIS
  // ... rest of routes
};

// filepath: p2p-kids-marketplace/src/navigation/AppNavigator.tsx (UPDATE)

import PrivacyPolicyScreen from '@/screens/settings/PrivacyPolicyScreen';

// Add route in the Stack.Navigator:
<Stack.Screen
  name="PrivacyPolicy"
  component={PrivacyPolicyScreen}
  options={{ title: 'Privacy Policy' }}
/>

/*
==================================================
FILE 5: Admin UI already exists from SAFETY-010
==================================================

Admin can manage Privacy Policy using:
- p2p-kids-admin/src/app/settings/policies/page.tsx
- Select "Privacy Policy" tab
- Create new version, edit, publish

No additional admin UI needed - same interface handles all policy types.

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Reuses platform_policies table from SAFETY-010
✓ Admin can create/edit/publish Privacy Policy
✓ Mobile app displays current Privacy Policy
✓ Privacy Policy linked from settings
✓ Privacy Policy linked from signup screen
✓ Navigation routes configured
✓ Markdown rendering works correctly
✓ Version history maintained

==================================================
NEXT TASK
==================================================

SAFETY-012: Liability Disclaimer system
*/
```

---

### Output Files

1. **p2p-kids-marketplace/src/screens/settings/PrivacyPolicyScreen.tsx** - Mobile Privacy Policy viewer
2. **p2p-kids-marketplace/src/screens/settings/SettingsScreen.tsx** - Updated with Privacy Policy link
3. **p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx** - Updated with Privacy Policy link
4. **p2p-kids-marketplace/src/navigation/types.ts** - Added PrivacyPolicy route
5. **p2p-kids-marketplace/src/navigation/AppNavigator.tsx** - Added PrivacyPolicy screen

---

### Testing Steps

1. **Admin creates Privacy Policy:**
   - Login to admin portal
   - Navigate to Settings → Policies → Privacy Policy tab
   - Create new version
   - Enter content in Markdown
   - Publish

2. **Mobile app displays Privacy Policy:**
   - Open app settings
   - Tap "Privacy Policy"
   - Verify current version displayed
   - Verify Markdown renders correctly

3. **Signup links to Privacy Policy:**
   - Start signup flow
   - Tap "Privacy Policy" link
   - Verify screen opens
   - Return to signup and complete

4. **Version management:**
   - Admin creates new version
   - Publish → Previous version archived
   - Mobile app shows latest version

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Build mobile Privacy Policy screen | 45 min |
| Add settings link | 15 min |
| Update signup screen with links | 30 min |
| Configure navigation routes | 30 min |
| Testing and verification | 45 min |
| Documentation | 15 min |
| **Total** | **~3.5 hours** |

---

## TASK SAFETY-012: Implement Admin-Managed Liability Disclaimer System

**Duration:** 4 hours  
**Priority:** Medium  
**Dependencies:** SAFETY-010 (Platform policies table), TRADE-003 (Trade confirmation)

### Description
Create Liability Disclaimer system using the same platform_policies infrastructure from SAFETY-010. Admin can create, edit, and publish Liability Disclaimer versions. Display disclaimer on trade confirmation screen before purchase. Users must acknowledge disclaimer to complete trade. Display in app settings. Track acknowledgments per transaction.

---

### AI Prompt for Cursor (Generate Liability Disclaimer System)

```typescript
/*
TASK: Implement admin-managed Liability Disclaimer system

REQUIREMENTS:
1. Reuse platform_policies table from SAFETY-010
2. Admin UI to create/edit/publish Liability Disclaimer
3. Mobile screen to display disclaimer
4. Display on trade confirmation (before purchase)
5. Require acknowledgment to complete trade
6. Track acknowledgments per transaction
7. Link from app settings

==================================================
NOTE: Database tables already exist from SAFETY-010
- platform_policies (stores all policy types)
- policy_acceptances (tracks user consent)
- RPC functions: get_current_policy, has_accepted_current_policy, publish_policy
==================================================

FILE 1: Transaction disclaimer tracking
==================================================
*/

-- filepath: supabase/migrations/051_transaction_disclaimer_tracking.sql

-- Add disclaimer acknowledgment to transactions table
ALTER TABLE transactions
ADD COLUMN disclaimer_acknowledged BOOLEAN DEFAULT FALSE,
ADD COLUMN disclaimer_policy_id UUID REFERENCES platform_policies(id) ON DELETE SET NULL,
ADD COLUMN disclaimer_acknowledged_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX transactions_disclaimer_idx ON transactions(disclaimer_acknowledged);

-- RPC function to acknowledge disclaimer and create transaction
CREATE OR REPLACE FUNCTION create_transaction_with_disclaimer(
  p_buyer_id UUID,
  p_seller_id UUID,
  p_item_id UUID,
  p_total_amount DECIMAL,
  p_disclaimer_policy_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Verify disclaimer policy exists and is published
  IF NOT EXISTS (
    SELECT 1 FROM platform_policies
    WHERE id = p_disclaimer_policy_id
      AND policy_type = 'liability_disclaimer'
      AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'Invalid disclaimer policy';
  END IF;

  -- Create transaction with disclaimer acknowledgment
  INSERT INTO transactions (
    buyer_id,
    seller_id,
    item_id,
    total_amount,
    status,
    disclaimer_acknowledged,
    disclaimer_policy_id,
    disclaimer_acknowledged_at
  ) VALUES (
    p_buyer_id,
    p_seller_id,
    p_item_id,
    p_total_amount,
    'pending',
    TRUE,
    p_disclaimer_policy_id,
    NOW()
  ) RETURNING id INTO v_transaction_id;

  -- Also record in policy_acceptances for audit
  INSERT INTO policy_acceptances (
    user_id,
    policy_id,
    policy_type,
    policy_version
  ) SELECT
    p_buyer_id,
    p_disclaimer_policy_id,
    'liability_disclaimer',
    version
  FROM platform_policies
  WHERE id = p_disclaimer_policy_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 2: Mobile app - Liability Disclaimer screen
==================================================
*/

// filepath: p2p-kids-marketplace/src/screens/settings/LiabilityDisclaimerScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/config/supabase';
import Markdown from 'react-native-markdown-display';

export default function LiabilityDisclaimerScreen() {
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<any>(null);

  useEffect(() => {
    fetchDisclaimer();
  }, []);

  const fetchDisclaimer = async () => {
    try {
      const { data, error } = await supabase.rpc('get_current_policy', {
        p_policy_type: 'liability_disclaimer',
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setPolicy(data[0]);
      }
    } catch (error) {
      console.error('Error fetching disclaimer:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!policy) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Liability Disclaimer not available</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{policy.title}</Text>
        <Text style={styles.version}>Version {policy.version}</Text>
        {policy.effective_date && (
          <Text style={styles.effectiveDate}>
            Effective: {new Date(policy.effective_date).toLocaleDateString()}
          </Text>
        )}
        
        <View style={styles.contentContainer}>
          <Markdown>{policy.content}</Markdown>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  effectiveDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  contentContainer: {
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
});

/*
==================================================
FILE 3: Trade confirmation - Disclaimer modal/section
==================================================
*/

// filepath: p2p-kids-marketplace/src/components/DisclaimerModal.tsx

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/config/supabase';
import Markdown from 'react-native-markdown-display';

interface DisclaimerModalProps {
  visible: boolean;
  onAccept: (policyId: string) => void;
  onCancel: () => void;
}

export default function DisclaimerModal({
  visible,
  onAccept,
  onCancel,
}: DisclaimerModalProps) {
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<any>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchDisclaimer();
      setAccepted(false); // Reset on open
    }
  }, [visible]);

  const fetchDisclaimer = async () => {
    try {
      const { data, error } = await supabase.rpc('get_current_policy', {
        p_policy_type: 'liability_disclaimer',
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setPolicy(data[0]);
      }
    } catch (error) {
      console.error('Error fetching disclaimer:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Liability Disclaimer</Text>
          <Pressable onPress={onCancel}>
            <Text style={styles.closeButton}>✕</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : !policy ? (
          <Text style={styles.errorText}>Disclaimer not available</Text>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <Text style={styles.version}>Version {policy.version}</Text>
              <View style={styles.contentContainer}>
                <Markdown>{policy.content}</Markdown>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                style={styles.checkbox}
                onPress={() => setAccepted(!accepted)}
              >
                <View style={[styles.checkboxInner, accepted && styles.checkboxChecked]}>
                  {accepted && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>
                  I have read and understand this disclaimer
                </Text>
              </Pressable>

              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.button, styles.cancelButton]}
                  onPress={onCancel}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.button,
                    styles.acceptButton,
                    !accepted && styles.buttonDisabled,
                  ]}
                  onPress={() => accepted && onAccept(policy.id)}
                  disabled={!accepted}
                >
                  <Text style={styles.acceptButtonText}>Accept & Continue</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  loader: {
    marginTop: 32,
  },
  scrollContent: {
    padding: 16,
  },
  version: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  contentContainer: {
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  acceptButton: {
    backgroundColor: '#007AFF',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

/*
==================================================
FILE 4: Update Trade Confirmation Screen
==================================================
*/

// filepath: p2p-kids-marketplace/src/screens/trade/TradeConfirmationScreen.tsx (UPDATE)

import DisclaimerModal from '@/components/DisclaimerModal';

// Add state for disclaimer:
const [showDisclaimer, setShowDisclaimer] = useState(false);
const [disclaimerPolicyId, setDisclaimerPolicyId] = useState<string | null>(null);

// Update the confirm purchase function:
const handleConfirmPurchase = () => {
  // Show disclaimer before creating transaction
  setShowDisclaimer(true);
};

const handleDisclaimerAccept = async (policyId: string) => {
  setDisclaimerPolicyId(policyId);
  setShowDisclaimer(false);
  
  try {
    // Create transaction with disclaimer acknowledgment
    const { data, error } = await supabase.rpc('create_transaction_with_disclaimer', {
      p_buyer_id: currentUser.id,
      p_seller_id: item.seller_id,
      p_item_id: item.id,
      p_total_amount: totalAmount,
      p_disclaimer_policy_id: policyId,
    });

    if (error) throw error;

    // Continue with payment flow...
    navigation.navigate('PaymentScreen', { transactionId: data });
  } catch (error) {
    console.error('Error creating transaction:', error);
    alert('Failed to create transaction');
  }
};

// Add modal to JSX:
<DisclaimerModal
  visible={showDisclaimer}
  onAccept={handleDisclaimerAccept}
  onCancel={() => setShowDisclaimer(false)}
/>

/*
==================================================
FILE 5: Add disclaimer link to Settings screen
==================================================
*/

// filepath: p2p-kids-marketplace/src/screens/settings/SettingsScreen.tsx (UPDATE)

// Add Liability Disclaimer link in the settings menu:
<Pressable
  style={styles.settingItem}
  onPress={() => navigation.navigate('LiabilityDisclaimer')}
>
  <Text style={styles.settingLabel}>Liability Disclaimer</Text>
  <Text style={styles.settingChevron}>›</Text>
</Pressable>

/*
==================================================
FILE 6: Add navigation route
==================================================
*/

// filepath: p2p-kids-marketplace/src/navigation/types.ts (UPDATE)

// Add to RootStackParamList:
export type RootStackParamList = {
  // ... existing routes
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
  LiabilityDisclaimer: undefined; // ADD THIS
  // ... rest of routes
};

// filepath: p2p-kids-marketplace/src/navigation/AppNavigator.tsx (UPDATE)

import LiabilityDisclaimerScreen from '@/screens/settings/LiabilityDisclaimerScreen';

// Add route in the Stack.Navigator:
<Stack.Screen
  name="LiabilityDisclaimer"
  component={LiabilityDisclaimerScreen}
  options={{ title: 'Liability Disclaimer' }}
/>

/*
==================================================
FILE 7: Admin UI already exists from SAFETY-010
==================================================

Admin can manage Liability Disclaimer using:
- p2p-kids-admin/src/app/settings/policies/page.tsx
- Select "Liability Disclaimer" tab
- Create new version, edit, publish

No additional admin UI needed - same interface handles all policy types.

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Reuses platform_policies table from SAFETY-010
✓ Admin can create/edit/publish Liability Disclaimer
✓ Mobile app displays current disclaimer
✓ Disclaimer modal shown before trade confirmation
✓ User must acknowledge disclaimer to continue
✓ Acknowledgment tracked per transaction
✓ Disclaimer linked from settings
✓ Navigation routes configured
✓ Markdown rendering works in modal
✓ Transaction creation includes disclaimer_policy_id

==================================================
NEXT SECTION
==================================================

MODULE 13 SUMMARY (already exists below)
*/
```

---

### Output Files

1. **supabase/migrations/051_transaction_disclaimer_tracking.sql** - Transaction disclaimer fields and RPC
2. **p2p-kids-marketplace/src/screens/settings/LiabilityDisclaimerScreen.tsx** - Settings viewer
3. **p2p-kids-marketplace/src/components/DisclaimerModal.tsx** - Trade confirmation modal
4. **p2p-kids-marketplace/src/screens/trade/TradeConfirmationScreen.tsx** - Updated with disclaimer flow
5. **p2p-kids-marketplace/src/screens/settings/SettingsScreen.tsx** - Updated with disclaimer link
6. **p2p-kids-marketplace/src/navigation/types.ts** - Added LiabilityDisclaimer route
7. **p2p-kids-marketplace/src/navigation/AppNavigator.tsx** - Added LiabilityDisclaimer screen

---

### Testing Steps

1. **Admin creates Liability Disclaimer:**
   - Login to admin portal
   - Navigate to Settings → Policies → Liability Disclaimer tab
   - Create new version
   - Enter content (e.g., "Platform not responsible for item quality, safety, or condition...")
   - Publish

2. **Trade confirmation displays disclaimer:**
   - Select item to purchase
   - Proceed to checkout
   - Click "Confirm Purchase"
   - Verify disclaimer modal opens

3. **Disclaimer acceptance required:**
   - Try to accept without checking box → Button disabled
   - Check "I have read and understand" box
   - Click "Accept & Continue"
   - Verify transaction created
   - Verify disclaimer_acknowledged = TRUE in DB

4. **Acknowledgment tracking:**
   - Query transactions table
   - Verify disclaimer_policy_id populated
   - Verify disclaimer_acknowledged_at timestamp
   - Query policy_acceptances table
   - Verify audit record created

5. **Settings link works:**
   - Open app settings
   - Tap "Liability Disclaimer"
   - Verify current version displayed

6. **Version updates:**
   - Admin publishes new version
   - Next trade shows updated disclaimer
   - Previous transactions still reference old version

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create transaction disclaimer fields + RPC | 1 hour |
| Build mobile disclaimer screen | 45 min |
| Build disclaimer modal component | 1 hour |
| Update trade confirmation flow | 45 min |
| Add settings link and navigation | 15 min |
| Testing and verification | 45 min |
| **Total** | **~4 hours** |

---

---

## MODULE 13 SUMMARY

**Total Tasks:** 15 (3 prerequisite + 12 safety)  
**Estimated Time:** ~49 hours

### Task Breakdown

| Task | Description | Duration | Status | Blocks |
|------|-------------|----------|--------|--------|
| **SAFETY-P001** | **Create item-images storage bucket** | **1.5h** | ✅ Documented | P002, SAFETY-004 |
| **SAFETY-P002** | **Image picker in CreateListingScreen** | **3h** | ✅ Documented | SAFETY-004 |
| **SAFETY-P003** | **Extend items.status + seller notifications** | **2h** | ✅ Documented | SAFETY-002→009 |
| SAFETY-001 | CPSC API daily batch import | 4h | ✅ Documented | |
| SAFETY-002 | CPSC recall matching logic | 3h | ✅ Documented | |
| SAFETY-003 | Auto-flagging for CPSC matches | 1.5h | ✅ Documented | |
| SAFETY-004 | Google Vision image moderation | 3.5h | ✅ Documented | |
| SAFETY-005 | Custom AI text moderation | 4h | ✅ Documented | |
| SAFETY-006 | AI moderation logging | 1h | ✅ Documented | |
| SAFETY-007 | GPT-4 fallback for low confidence | 2.5h | ✅ Documented | |
| SAFETY-008 | Admin review workflow | 3h | ✅ Documented | |
| SAFETY-009 | Seller appeal workflow | 2.5h | ✅ Documented | |
| SAFETY-010 | Admin-managed Terms of Service system | 4.5h | ✅ Documented | |
| SAFETY-011 | Admin-managed Privacy Policy system | 3.5h | ✅ Documented | |
| SAFETY-012 | Admin-managed Liability Disclaimer system | 4h | ✅ Documented |

---

### Key Features

**CPSC Integration:**
- Daily recall import from public API
- Full-text search matching
- Auto-flagging of recalled products
- Manual import trigger for admins

**AI Moderation:**
- Google Vision for image safety
- Custom GPT-4 agent for text review
- Confidence scoring
- Multi-stage review (custom → GPT-4 → manual)

**Safety Workflow:**
- Automated flagging (CPSC + AI)
- Admin moderation queue
- Approve/reject/request edits
- Seller appeal process

**Compliance:**
- Terms of Service acceptance
- Privacy Policy disclosure
- Liability disclaimer

---

### Database Tables

0. **storage.buckets: item-images** - Storage bucket for listing photos (SAFETY-P001)
1. **cpsc_recalls** - CPSC recall database
2. **cpsc_import_log** - Import status tracking
3. **item_safety_flags** - Flagged items queue
4. **ai_moderation_logs** - AI moderation decisions
5. **platform_policies** - All platform policies (TOS, Privacy, Disclaimer) with versioning (SAFETY-010)
6. **policy_acceptances** - User policy acceptance tracking with version history (SAFETY-010)
7. **items (altered)** - Added 'flagged'/'rejected' statuses, flagged_at, rejected_at, rejection_reason, appeal_count (SAFETY-P003)
8. **transactions (altered)** - Added disclaimer_acknowledged, disclaimer_policy_id, disclaimer_acknowledged_at (SAFETY-012)

---

### AI Services Used

**Google Vision API:**
- Safe Search detection
- Categories: adult, violence, racy, medical, spoof
- Likelihood scoring (VERY_UNLIKELY to VERY_LIKELY)

**OpenAI GPT-4:**
- Text content moderation
- Policy violation detection
- Confidence scoring with reasoning
- Fallback for low-confidence cases

---

### Safety Categories

**Prohibited Items:**
- Weapons, drugs, alcohol, tobacco
- Adult content, hazardous materials
- Recalled products (CPSC matches)

**Content Violations:**
- Offensive or hateful language
- Spam or scam indicators
- Misleading claims
- Personal information exposure

---

### Moderation Flow

1. **Item Created** → AI checks (image + text)
2. **AI Flags** → Item status = 'flagged'
3. **Admin Reviews** → Approve/Reject/Request Edits
4. **If Rejected** → Seller can appeal and resubmit
5. **If Approved** → Item goes live

---

### Cost Analysis

**Google Vision API:**
- Safe Search: $1.50 per 1,000 images
- 1,000 items × 3 images = $4.50

**OpenAI GPT-4:**
- Text moderation: ~$0.03 per 1,000 tokens
- 1,000 items × ~200 tokens = $6

**CPSC API:**
- Free public API
- Daily import: ~5 minutes processing

**Total Monthly Cost (10,000 new items):**
- Google Vision: $45
- GPT-4: $60
- **Total: ~$105/month**

---

### Security Considerations

**API Keys:**
- Store in Supabase secrets
- Never expose in client code
- Rotate regularly

**Moderation Bias:**
- Log all AI decisions for audit
- Manual review for edge cases
- Track false positive/negative rates

**Privacy:**
- Don't store user images permanently
- Anonymize moderation logs
- GDPR compliance for EU users

---

### Analytics Events

1. `item_flagged_cpsc` - CPSC recall match found
2. `item_flagged_ai_image` - Unsafe image detected
3. `item_flagged_ai_text` - Text violation detected
4. `item_approved_admin` - Admin approved flagged item
5. `item_rejected_admin` - Admin rejected item
6. `item_appeal_submitted` - Seller appealed rejection
7. `tos_accepted` - User accepted Terms of Service
8. `tos_viewed` - User viewed TOS (from settings or signup)
9. `privacy_policy_viewed` - User viewed Privacy Policy
10. `disclaimer_acknowledged` - User acknowledged Liability Disclaimer (during trade)
11. `policy_published` - Admin published new policy version

---

### Testing Checklist

**CPSC Import:**
- [ ] Daily import runs successfully
- [ ] Recalls deduplicated
- [ ] Import log updated

**CPSC Matching:**
- [ ] Item matched against recalls
- [ ] High-confidence match flagged
- [ ] Safety flag created

**Image Moderation:**
- [ ] Google Vision API called
- [ ] Unsafe images flagged
- [ ] Moderation log created

**Text Moderation:**
- [ ] Custom AI reviews text
- [ ] Policy violations detected
- [ ] Item flagged if violations found
- [ ] GPT-4 fallback for low confidence

**Admin Review:**
- [ ] Flagged items appear in queue
- [ ] Admin can approve/reject
- [ ] Seller notified of decision

**Seller Appeal:**
- [ ] Rejected item shown to seller
- [ ] Seller can edit and resubmit
- [ ] Item re-enters moderation queue

**Policy Management - Terms of Service:**
- [ ] Admin can create TOS draft
- [ ] Admin can edit TOS content (Markdown supported)
- [ ] Admin can publish TOS (previous version archived)
- [ ] Mobile app displays current published TOS
- [ ] Signup requires TOS acceptance
- [ ] TOS checkbox validation works
- [ ] Acceptance recorded in policy_acceptances table
- [ ] Policy version tracked with acceptance
- [ ] TOS accessible from settings

**Policy Management - Privacy Policy:**
- [ ] Admin can create Privacy Policy draft
- [ ] Admin can publish Privacy Policy
- [ ] Mobile app displays current Privacy Policy
- [ ] Privacy Policy linked from signup screen
- [ ] Privacy Policy accessible from settings
- [ ] Markdown rendering works correctly
- [ ] Version history maintained

**Policy Management - Liability Disclaimer:**
- [ ] Admin can create Liability Disclaimer draft
- [ ] Admin can publish Liability Disclaimer
- [ ] Disclaimer modal appears before trade confirmation
- [ ] Cannot proceed without acknowledging disclaimer
- [ ] Acknowledgment tracked per transaction
- [ ] Transaction includes disclaimer_policy_id
- [ ] Disclaimer accessible from settings
- [ ] Version changes reflected in modal

**Policy Version Management:**
- [ ] Multiple versions can exist (draft/published/archived)
- [ ] Only one published version per policy type
- [ ] Publishing new version archives previous
- [ ] Admin can view all versions
- [ ] Effective dates work correctly
- [ ] Users always see latest published version

**Policy Acceptance Tracking:**
- [ ] Acceptance logged with user_id, policy_id, version
- [ ] Timestamp recorded accurately
- [ ] Admin can view acceptance statistics
- [ ] RPC function has_accepted_current_policy works
- [ ] Users can view their acceptance history

---

### Future Enhancements (Post-MVP)

1. **Machine Learning** - Train custom model on moderation history
2. **Crowdsourced Moderation** - Trusted users help flag content
3. **Proactive Scanning** - Periodic re-scan of existing items
4. **NCMEC Integration** - Child safety image hashing (PhotoDNA)
5. **Blockchain Verification** - Immutable moderation audit trail
6. **Multi-Language Support** - Moderation in multiple languages
7. **Seller Reputation** - Auto-approve trusted sellers
8. **Real-Time Alerts** - Notify admins of critical violations
9. **Batch Moderation** - Admin can process multiple items at once
10. **Appeal Arbitration** - Third-party review for disputed cases

---

**MODULE 13: SAFETY & COMPLIANCE - COMPLETE**
