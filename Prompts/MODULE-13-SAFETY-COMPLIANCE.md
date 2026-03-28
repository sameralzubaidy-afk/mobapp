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

## TASK SAFETY-010: Add Placeholder for Terms of Service (TOS) in Settings

**Duration:** 1 hour  
**Priority:** Low  
**Dependencies:** AUTH-001 (User authentication)

### Description
Add TOS link in app settings. Display placeholder TOS page. Users must accept TOS on signup. Store acceptance in database.

---

### AI Prompt for Cursor (Generate TOS Placeholder)

```typescript
/*
TASK: Add Terms of Service placeholder

REQUIREMENTS:
1. TOS link in app settings
2. Display TOS page (placeholder text)
3. Require acceptance on signup
4. Store acceptance in users table (tos_accepted_at)

FILES:
- src/screens/settings/TermsOfServiceScreen.tsx
- src/screens/auth/SignupScreen.tsx (UPDATE - TOS checkbox)
*/
```

### Time Breakdown: **~1 hour**

---

## TASK SAFETY-011: Add Placeholder for Privacy Policy in Settings

**Duration:** 1 hour  
**Priority:** Low  
**Dependencies:** AUTH-001 (User authentication)

### Description
Add Privacy Policy link in settings. Display placeholder policy page. Link from signup screen.

---

### Time Breakdown: **~1 hour**

---

## TASK SAFETY-012: Add Placeholder for Insurance/Liability Disclaimer in Settings

**Duration:** 1 hour  
**Priority:** Low  
**Dependencies:** None

### Description
Add liability disclaimer in settings. Display disclaimer on trade confirmation. Clarify platform not responsible for item quality/safety.

---

### Time Breakdown: **~1 hour**

---

---

## MODULE 13 SUMMARY

**Total Tasks:** 15 (3 prerequisite + 12 safety)  
**Estimated Time:** ~38.5 hours

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
| SAFETY-010 | Terms of Service placeholder | 1h | ✅ Documented | |
| SAFETY-011 | Privacy Policy placeholder | 1h | ✅ Documented | |
| SAFETY-012 | Liability disclaimer placeholder | 1h | ✅ Documented |

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
5. **items (altered)** - Added 'flagged'/'rejected' statuses, flagged_at, rejected_at, rejection_reason, appeal_count (SAFETY-P003)

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

**Compliance:**
- [ ] TOS displayed and accepted
- [ ] Privacy Policy accessible
- [ ] Liability disclaimer shown

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
