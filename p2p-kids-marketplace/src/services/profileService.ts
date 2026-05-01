// File: p2p-kids-marketplace/src/services/profileService.ts
// AUTH-V3-005: ProfileService — Auto-Fill + Avatar Download
// Module: MODULE-03-AUTH-V3-SOCIAL-LOGIN.md

import { supabase } from './supabase/client';
import * as ImageManipulator from 'expo-image-manipulator';

const AVATAR_BUCKET = 'user-avatars';
const DOWNLOAD_TIMEOUT_MS = 5000;
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const MIN_DIMENSION_PX = 100;

/**
 * Provider profile extracted from OAuth callback
 */
export interface ProviderProfile {
  name?: string;
  avatar?: string;
  email?: string;
  provider?: 'google' | 'facebook' | 'apple';
}

/**
 * AUTO-FILL PROFILE
 * 
 * UPSERTs `profiles` with `{ name: profile.name, auto_filled_from_provider: true }`
 * — never overwrites an already-set `name` unless the row is newly created.
 * 
 * Rule 5: NEVER throws — returns { success: boolean; error?: string }
 * 
 * @param profile - Provider profile data
 * @returns Success indicator with optional error message
 */
export async function autoFillProfile(profile: ProviderProfile): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.warn('[profileService.autoFillProfile] No authenticated user:', userError);
      return { success: false, error: 'Not authenticated' };
    }

    if (!profile.name) {
      // No name to auto-fill — skip gracefully
      return { success: true };
    }

    // Check if profile already has a name
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.warn('[profileService.autoFillProfile] Error fetching profile:', fetchError);
      return { success: false, error: fetchError.message };
    }

    // Only auto-fill if name is not set
    if (existingProfile?.name) {
      console.log('[profileService.autoFillProfile] Profile name already set, skipping auto-fill');
      return { success: true };
    }

    // Try with auto_filled_from_provider when the optional column exists.
    // Fallback to base payload when the column is missing in prod schema.
    const payloadBase = {
      user_id: user.id,
      name: profile.name,
    };

    let upsertError: { message: string } | null = null;

    const { error: upsertWithFlagError } = await supabase
      .from('profiles')
      .upsert(
        {
          ...payloadBase,
          auto_filled_from_provider: true,
        },
        {
          onConflict: 'user_id',
        }
      );

    if (upsertWithFlagError) {
      const missingColumnError = /column .*auto_filled_from_provider.* does not exist/i.test(
        upsertWithFlagError.message
      );

      if (!missingColumnError) {
        upsertError = upsertWithFlagError;
      } else {
        const { error: upsertBaseError } = await supabase
          .from('profiles')
          .upsert(payloadBase, {
            onConflict: 'user_id',
          });

        if (upsertBaseError) {
          upsertError = upsertBaseError;
        }
      }
    }

    if (upsertError) {
      console.warn('[profileService.autoFillProfile] Upsert failed:', upsertError);
      return { success: false, error: upsertError.message };
    }

    console.log('[profileService.autoFillProfile] ✅ Auto-filled profile name:', profile.name);
    return { success: true };
  } catch (error) {
    console.warn('[profileService.autoFillProfile] Exception:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * DOWNLOAD PROVIDER AVATAR
 * 
 * Fetches the provider avatar, validates it (jpeg/png, ≤ 2 MB, ≥ 100×100),
 * uploads to `user-avatars/{userId}/social_avatar.{ext}`, and returns the public URL.
 * 
 * Rule 5: NEVER throws — any failure returns `null` and logs via `console.warn`
 * 
 * @param url - Provider avatar URL (optional)
 * @param userId - User ID for storage path
 * @returns Public URL or null on failure
 */
export async function downloadProviderAvatar(
  url: string | undefined,
  userId: string
): Promise<string | null> {
  try {
    // Apple payloads (no avatar URL) return null without attempting fetch
    if (!url) {
      console.log('[profileService.downloadProviderAvatar] No avatar URL provided (Apple?), skipping');
      return null;
    }

    // Fetch with AbortController timeout = 5000ms
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if ((fetchError as Error).name === 'AbortError') {
        console.warn('[profileService.downloadProviderAvatar] Fetch timeout');
        return null;
      }
      console.warn('[profileService.downloadProviderAvatar] Fetch failed:', fetchError);
      return null;
    }

    if (!response.ok) {
      console.warn('[profileService.downloadProviderAvatar] HTTP error:', response.status);
      return null;
    }

    // Validate content-type (image/jpeg | image/png)
    const contentType = response.headers.get('content-type');
    if (!contentType || !['image/jpeg', 'image/png'].includes(contentType)) {
      console.warn('[profileService.downloadProviderAvatar] Invalid content-type:', contentType);
      return null;
    }

    // Get blob and check size (≤ 2 MB)
    const blob = await response.blob();
    if (blob.size > MAX_AVATAR_SIZE_BYTES) {
      console.warn('[profileService.downloadProviderAvatar] Image too large:', blob.size, 'bytes');
      return null;
    }

    // Convert blob to base64 for ImageManipulator
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = reject;
    });
    reader.readAsDataURL(blob);
    const base64Uri = await base64Promise;

    // Validate dimensions (≥ 100×100)
    let imageInfo: { width: number; height: number };
    try {
      // Use ImageManipulator to get dimensions without manipulation
      const manipulated = await ImageManipulator.manipulateAsync(
        base64Uri,
        [], // no actions — just get info
        { compress: 1 }
      );
      imageInfo = { width: manipulated.width, height: manipulated.height };
    } catch (error) {
      console.warn('[profileService.downloadProviderAvatar] Failed to read image dimensions:', error);
      return null;
    }

    if (imageInfo.width < MIN_DIMENSION_PX || imageInfo.height < MIN_DIMENSION_PX) {
      console.warn('[profileService.downloadProviderAvatar] Image too small:', imageInfo);
      return null;
    }

    // Determine file extension from content-type
    const ext = contentType === 'image/png' ? 'png' : 'jpg';
    const storagePath = `${userId}/social_avatar.${ext}`;

    // Upload to Supabase Storage with upsert: true
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(storagePath, blob, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn('[profileService.downloadProviderAvatar] Upload failed:', uploadError);
      return null;
    }

    // Get public URL
    const { data } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(storagePath);

    if (!data?.publicUrl) {
      console.warn('[profileService.downloadProviderAvatar] Failed to get public URL');
      return null;
    }

    console.log('[profileService.downloadProviderAvatar] ✅ Uploaded avatar:', data.publicUrl);
    return data.publicUrl;
  } catch (error) {
    console.warn('[profileService.downloadProviderAvatar] Exception:', error);
    return null;
  }
}
