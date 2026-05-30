# BADGES-V2-006: Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Run Database Migration
```sql
-- In Supabase SQL Editor, run:
-- File: supabase/migrations/20260111000001_badge_icons_storage.sql
```

### 2. Verify Setup
```sql
-- Check bucket exists:
SELECT * FROM storage.buckets WHERE id = 'badge-icons';

-- Check RLS policies:
SELECT policyname FROM pg_policies 
WHERE tablename = 'objects' AND policyname LIKE '%badge icon%';
```

### 3. Run Tests
```bash
cd p2p-kids-marketplace
npm test src/services/__tests__/badgeUtils.test.ts
```

---

## 📖 Usage Examples

### Upload Badge Icon (Mobile)
```typescript
import { uploadBadgeIcon } from '../services/badgeUtils';

const result = await uploadBadgeIcon(badgeId, fileUri);
if (result.error) {
  console.error('Upload failed:', result.error);
} else {
  console.log('Uploaded to:', result.url);
}
```

### Upload Badge Icon (Admin Portal)
```typescript
import { uploadBadgeIcon } from '@/lib/badgeUtils';

const handleUpload = async (file: File) => {
  const result = await uploadBadgeIcon(badgeId, file);
  if (result.error) {
    alert('Upload failed: ' + result.error.message);
  } else {
    alert('Icon uploaded successfully!');
  }
};
```

### Display Badge Icon
```typescript
import { getPublicBadgeIconUrl } from '../services/badgeUtils';

// In your component:
const iconUrl = badge.icon_url || getPublicBadgeIconUrl('icons/default-badge.png');

<Image source={{ uri: iconUrl }} style={{ width: 50, height: 50 }} />
```

---

## ✅ Verification Checklist

Before testing:
- [ ] Migration executed in Supabase
- [ ] Badge-icons bucket visible in Storage
- [ ] Admin user has `is_admin` = true in metadata
- [ ] Environment variables configured

Manual tests:
- [ ] TC-001: Bucket exists
- [ ] TC-002: RLS policies created
- [ ] TC-003: Admin can upload
- [ ] TC-007: Public URL works
- [ ] TC-010: Non-admin blocked

---

## 🐛 Troubleshooting

**Upload fails with permission error:**
- Verify user has `raw_user_meta_data->>'is_admin' = 'true'`
- Check RLS policies exist on `storage.objects`

**Icons don't display:**
- Verify `icon_url` is saved to badge record
- Check URL format: `https://<supabase-url>/storage/v1/object/public/badge-icons/...`
- Confirm bucket is public

**Bucket doesn't exist:**
- Re-run migration SQL
- Check Supabase dashboard → Storage

---

## 📦 Files Summary

| File | Purpose |
|------|---------|
| `supabase/migrations/20260111000001_badge_icons_storage.sql` | Creates bucket + RLS |
| `p2p-kids-marketplace/src/services/badgeUtils.ts` | Mobile upload/delete functions |
| `p2p-kids-admin/src/lib/badgeUtils.ts` | Admin portal functions |
| `p2p-kids-marketplace/src/services/__tests__/badgeUtils.test.ts` | Unit tests |
| `p2p-kids-marketplace/src/__tests__/e2e/badgeIconManagement.e2e.ts` | E2E tests |
| `BADGES-V2-006-MANUAL-TESTING-GUIDE.md` | 14 test cases |

---

**Need Help?** See `BADGES-V2-006-IMPLEMENTATION-SUMMARY.md` for full details.
