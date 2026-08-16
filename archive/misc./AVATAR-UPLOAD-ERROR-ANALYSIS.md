# 🔴 Avatar Upload Error Analysis & Fix

**Date:** January 15, 2026  
**Error:** `StorageUnknownError: Network request failed`  
**Affected File:** `profile.ts:333` (in `uploadProfileAvatar`)  
**Root Cause:** Network connectivity issue between Android Emulator and Supabase Storage

---

## 📍 Error Details

```
profile.ts:333 ❌ Avatar upload error: StorageUnknownError: Network request failed
EditProfileScreen.tsx:180 Avatar upload error: StorageUnknownError: Network request failed
```

**Stack Trace:** Native error in Supabase Storage upload operation

---

## 🔍 Root Cause Analysis

### Issue 1: Android Emulator Network Isolation
- Android Emulator runs in a sandboxed environment
- Cannot access `localhost` or `127.0.0.1` by default
- Production Supabase URL (`https://drntwgporzabmxdqykrp.supabase.co`) should work, but may have firewall/CORS issues

### Issue 2: Possible Causes (in order of probability)

| # | Cause | Evidence | Fix |
|---|-------|----------|-----|
| 1 | **Emulator network isolation** | Emulator at `http://10.0.0.58:8082/` can't reach external URLs reliably | Use localhost forwarding or test on physical device |
| 2 | **Supabase Storage not accessible** | RLS policies misconfigured or bucket not public | Verify RLS policies in Supabase console |
| 3 | **CORS headers missing** | Browser/Expo is blocking cross-origin requests | Check Supabase CORS settings |
| 4 | **Storage bucket doesn't exist** | `user-avatars` bucket may not be created | Verify bucket in Supabase Storage |
| 5 | **No internet connection** | Emulator network connectivity issue | Restart emulator or use physical device |

---

## ✅ Step-by-Step Fix

### Step 1: Verify Supabase Storage Bucket Exists

**Go to Supabase Dashboard:**
1. Open [Supabase Console](https://app.supabase.com)
2. Navigate to: **Storage** → **Buckets**
3. Verify `user-avatars` bucket exists
4. If missing, create it:
   - Click "Create a new bucket"
   - Name: `user-avatars`
   - Public: **No** (we use signed URLs)
   - Click "Create"

---

### Step 2: Check Storage RLS Policies

**Current policies (from migration):**

```sql
-- Should allow authenticated users to upload
-- Should allow public to view with signed URLs
```

**Verify in Supabase Console:**
1. Go to **Storage** → **user-avatars** → **Policies**
2. Confirm these 4 policies exist:
   - ✅ "Users can upload their own avatars" (INSERT)
   - ✅ "Users can update their own avatars" (UPDATE)
   - ✅ "Users can delete their own avatars" (DELETE)
   - ✅ "Anyone can view avatars" (SELECT)

If policies are missing, run [Migration: 20251215000004](#migration-script) below.

---

### Step 3: Test Avatar Upload (Step-by-Step)

#### Option A: Test on Physical Device (Recommended)
- Connect Android/iOS device via USB
- Build and run on device
- Test avatar upload
- **Why:** Physical devices have proper network routing

#### Option B: Use Android Emulator with Proxy
```bash
# Forward network requests through your machine
adb reverse tcp:443 tcp:443
adb reverse tcp:80 tcp:80
```

#### Option C: Test via Supabase Functions (Workaround)
Create a new Edge Function to handle avatar upload:
```typescript
// supabase/functions/avatar-upload/index.ts
```
See [Proposed Fix](#proposed-fix) below.

---

### Step 4: Enable Detailed Error Logging

Update `profile.ts:333` to log the full error object:

```typescript
if (error) {
  console.error('❌ Avatar upload error:', {
    message: error.message,
    status: error.status,
    statusCode: error.statusCode,
    code: (error as any).error_code,
    fullError: JSON.stringify(error, null, 2),
  });
  
  // Check if it's RLS, network, or bucket issue
  if (error.message?.includes('Network')) {
    console.error('→ NETWORK ERROR: Check emulator connectivity');
  } else if (error.message?.includes('violates row-level')) {
    console.error('→ RLS ERROR: Storage policies misconfigured');
  } else if (error.message?.includes('not found')) {
    console.error('→ BUCKET ERROR: Storage bucket missing');
  }
  
  return { url: null, error };
}
```

---

## 🔧 Proposed Fix: Add Retry Logic with Exponential Backoff

Update `profile.ts` to retry failed uploads:

```typescript
export const uploadProfileAvatar = async (
  userId: string,
  imageUri: string,
  maxRetries: number = 3
): Promise<UploadAvatarResult> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      const fileExt = imageUri.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const fileName = `${userId}-${timestamp}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { data, error } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (error) {
        if (attempt < maxRetries - 1) {
          const waitMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`❌ Avatar upload failed (attempt ${attempt + 1}/${maxRetries}). Retrying in ${waitMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue; // Retry
        }
        
        // Final attempt failed
        console.error('❌ Avatar upload error (final):', error);
        return {
          url: null,
          error,
        };
      }

      // Success!
      const { data: urlData } = supabase.storage.from('user-avatars').getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl || 
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/user-avatars/${filePath}`;

      return { url: publicUrl, path: filePath, error: null };
    } catch (error) {
      if (attempt < maxRetries - 1) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.warn(`❌ Exception during upload (attempt ${attempt + 1}/${maxRetries}). Retrying in ${waitMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      
      console.error('❌ Upload avatar exception (final):', error);
      return { url: null, path: null, error: error as Error };
    }
  }

  return { url: null, path: null, error: new Error('Upload failed after maximum retries') };
};
```

---

## 🚀 Proposed Fix: Alternative - Use Edge Function (Recommended)

Instead of uploading directly from the mobile app (which has network issues), use an Edge Function:

### Create: `supabase/functions/avatar-upload/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

interface AvatarUploadRequest {
  base64Image: string;
  fileName: string;
  contentType: string;
}

serve(async (req) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create Supabase client with service role (runs server-side)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // Verify JWT and extract user_id
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const userId = userData.user.id;

    // Parse request body
    const body: AvatarUploadRequest = await req.json();
    const { base64Image, fileName, contentType } = body;

    if (!base64Image || !fileName) {
      return new Response(JSON.stringify({ error: 'Missing image data or file name' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Decode base64 to binary
    const binaryString = atob(base64Image);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to storage
    const timestamp = Date.now();
    const filePath = `avatars/${userId}-${timestamp}-${fileName}`;
    
    const { data, error } = await supabase.storage
      .from('user-avatars')
      .upload(filePath, bytes, {
        contentType,
        upsert: true,
      })

    if (error) {
      console.error('Storage upload error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-avatars')
      .getPublicUrl(filePath)

    return new Response(JSON.stringify({
      success: true,
      path: filePath,
      url: urlData?.publicUrl,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Avatar upload error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

### Update Mobile App to Use Edge Function

Update `profile.ts`:

```typescript
export const uploadProfileAvatar = async (
  userId: string,
  imageUri: string
): Promise<UploadAvatarResult> => {
  try {
    // Fetch image and convert to base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64Image = await blobToBase64(blob);
    
    const fileExt = imageUri.split('.').pop() || 'jpg';
    const fileName = `avatar-${Date.now()}.${fileExt}`;
    const contentType = `image/${fileExt}`;

    // Call Edge Function instead of uploading directly
    const { data, error } = await supabase.functions.invoke('avatar-upload', {
      body: {
        base64Image,
        fileName,
        contentType,
      },
    })

    if (error) {
      console.error('❌ Avatar upload via function error:', error);
      return { url: null, error };
    }

    if (data?.error) {
      console.error('❌ Avatar upload function returned error:', data.error);
      return { url: null, error: new Error(data.error) };
    }

    return {
      url: data?.url,
      path: data?.path,
      error: null,
    };
  } catch (error) {
    console.error('❌ Upload avatar exception:', error);
    return { url: null, path: null, error: error as Error };
  }
};

// Helper to convert blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

---

## 📋 Quick Troubleshooting Checklist

- [ ] **Bucket exists?** Check Supabase Storage → Buckets
- [ ] **RLS policies exist?** Check Supabase Storage → user-avatars → Policies
- [ ] **User authenticated?** Check JWT is valid
- [ ] **Network works?** Test on physical device or use Edge Function
- [ ] **Emulator has internet?** Restart emulator with internet access
- [ ] **Error logs visible?** Check console for detailed error messages

---

## 🎯 Recommended Action

**For immediate fix:**
1. Test on physical device (Option A in Step 3)
2. If that works → issue is emulator network isolation
3. If it still fails → implement Edge Function approach

**Long-term solution:**
- Use Edge Function for avatar uploads (server-side, more reliable)
- Add retry logic with exponential backoff
- Improve error logging and user messaging

---

## 📞 Support

If avatar upload still fails after these steps:
1. Share the detailed error logs from console
2. Verify Supabase project is active (check Storage quota)
3. Test connectivity: `curl https://drntwgporzabmxdqykrp.supabase.co/health`

