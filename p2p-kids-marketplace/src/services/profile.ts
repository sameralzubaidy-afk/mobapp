// File: p2p-kids-marketplace/src/services/profile.ts
// Profile management service for AUTH-005, AUTH-006, AUTH-007

import { supabase } from './supabase/client';
import type {
  UploadAvatarResult,
  User,
  ProfileSetupData,
  ProfileUpdateData,
  NodeAssignment,
} from '@/types/profile.types';
import { assignNodeByZipCode } from './location';
import { getImageUrl } from '@/utils/imageUrl';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode as decodeBase64ArrayBuffer } from 'base64-arraybuffer';
import { getSimulatedAvatarUploadError } from './devTestingService';

const AVATAR_BUCKET = 'user-avatars';

/**
 * NODE-003: Find the nearest active node based on ZIP code
 * Uses the new resolve_active_node_for_signup RPC that:
 * - Returns exact match if active node exists for ZIP
 * - Returns nearest active node if ZIP is not active
 * - Signals if ZIP is not active (match_type='nearest') for waitlist popup
 *
 * IMPORTANT: This function DOES NOT show the popup.
 * The calling code (ProfileSetupScreen) handles the popup logic.
 */
export const findNearestNode = async (zipCode: string): Promise<NodeAssignment | null> => {
  try {
    // Use the new NODE-003 assignment function that handles exact match or nearest
    const result = await assignNodeByZipCode(zipCode);

    return {
      node_id: result.nodeId,
      node_name: result.nodeName,
      distance_miles: result.distanceMiles || 0,
      // NEW: Signal if ZIP is inactive (for popup logic)
      is_exact_match: result.matchType === 'zip',
    };
  } catch (error) {
    const err = error as Error;
    console.error('❌ [NODE-003] Node assignment error:', err);
    // Return null if NO active nodes exist anywhere
    // This will trigger the "no active nodes" flow
    if (err.message?.includes('not currently active')) {
      return null;
    }
    return null;
  }
};

/**
 * AUTH-005: Complete user profile setup after phone verification
 * NODE-003: Updated to use new node assignment flow with waitlist support
 */
export const setupUserProfile = async (
  userId: string,
  profileData: ProfileSetupData
): Promise<{
  user: User | null;
  error: Error | object | null;
  needsWaitlist?: boolean;
  zipCode?: string;
  matchType?: 'zip' | 'nearest'; // NODE-003: Signal if ZIP is inactive
  assignedNodeId?: string;
  assignedNodeName?: string;
}> => {
  try {
    // Step 1: NODE-003 - Find nearest active node (exact match or fallback)
    const nodeAssignment = await findNearestNode(profileData.zip_code);

    let needsWaitlist = false;
    let assignedNodeId: string | null = null;
    let matchType: 'zip' | 'nearest' | undefined = undefined;

    if (!nodeAssignment) {
      needsWaitlist = true;
      // Don't return error - allow profile creation to continue
    } else {
      assignedNodeId = nodeAssignment.node_id;
      // NODE-003: Check if this was an exact match or fallback
      matchType = nodeAssignment.is_exact_match ? 'zip' : 'nearest';

      // NODE-003: If fallback (inactive ZIP), signal waitlist needed
      if (matchType === 'nearest') {
        needsWaitlist = true;
      }
    }

    // Step 2: Create or update user profile in database
    // Note: A trigger auto-creates a minimal profile on signup, so we use upsert
    // We explicitly include email and phone here to ensure they are captured even if the trigger fails

    // CRITICAL: Preserve referral fields set by auth trigger
    // The trigger sets referral_code + referred_by on signup, and we must not overwrite them
    await supabase
      .from('profiles')
      .select('referral_code, referred_by')
      .eq('user_id', userId)
      .maybeSingle();

    const dbProfileData: Record<string, any> = {
      user_id: userId,
      name: profileData.display_name,
      email: profileData.email || null,
      phone: profileData.phone || null,
      avatar_url: profileData.avatar_url || null,
      bio: profileData.bio || null,
      zip_code: profileData.zip_code,
      node_id: assignedNodeId, // Can be null if no node found
      profile_completed: true,
      // Set to false here; the live OnboardingScreen carousel flips the gate by
      // setting onboarding_completed_at (Get Started) or onboarding_skipped_at (Skip).
      onboarding_completed: false,
      phone_verified: true,
      phone_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // PROTECTED FIELDS: Removed to prevent overwriting trigger-generated values
      // We do not send referral_code/referred_by here.
      // If the row exists (trigger created it): Supabase update will leave them alone.
      // If the row is new (trigger failed): They will be null (correct default).
    };

    const { error: insertError } = await supabase
      .from('profiles')
      .upsert(dbProfileData, {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Profile insert error:', insertError);
      return { user: null, error: insertError };
    }

    // Return the user data (we'll need to get it from auth.users)
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { user: null, error: userError };
    }

    return {
      user: userData.user as User,
      error: null,
      needsWaitlist,
      zipCode: profileData.zip_code,
      matchType,
      assignedNodeId: assignedNodeId || undefined,
      assignedNodeName: nodeAssignment?.node_name || undefined,
    };
  } catch (error) {
    console.error('Setup profile exception:', error);
    return { user: null, error: error as Error };
  }
};

/**
 * AUTH-006: Update user profile
 * Allows editing name, avatar, bio, phone, zip code
 * Changing zip code may reassign to different node
 */
export const updateUserProfile = async (
  userId: string,
  updates: ProfileUpdateData,
  options?: { includeAuthUser?: boolean }
): Promise<{
  user: User | null;
  error: Error | object | null;
  needsWaitlist?: boolean;
  zipCode?: string;
}> => {
  try {
    const includeAuthUser = options?.includeAuthUser ?? true;
    const updatePayload: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };
    let needsWaitlist = false;
    let userZip: string | undefined = undefined;
    // Add fields that are being updated
    if (updates.display_name !== undefined) {
      updatePayload.name = updates.display_name;
    }
    if (updates.avatar_url !== undefined) {
      updatePayload.avatar_url = updates.avatar_url;
    }
    if (updates.bio !== undefined) {
      updatePayload.bio = updates.bio;
    }
    // Phone number is stored on the auth user, update separately
    let phoneUpdateError: Error | object | null = null;
    if (updates.phone !== undefined) {
      try {
        // Call server-side Edge Function to update auth user phone using service role
        const invokeRes = await supabase.functions.invoke('auth-update-phone', {
          body: { user_id: userId, phone: updates.phone },
        });
        const fnData = invokeRes?.data;
        const fnError = invokeRes?.error;
        if (fnError) {
          console.error('Failed to update auth user phone via function (SDK error):', fnError);
          phoneUpdateError = fnError;
        }
        if (fnData && fnData.error) {
          console.error(
            'Failed to update auth user phone via function (function error):',
            fnData.error
          );
          // If the function is not configured (missing service role key), fall back to updating the profile record locally
          if (typeof fnData.error === 'string' && fnData.error.includes('service role')) {
            console.warn(
              'auth-update-phone not configured; updating phone on profiles table as fallback'
            );
            const { error: profileErr } = await supabase
              .from('profiles')
              .update({
                phone: updates.phone,
                phone_verified: true,
                phone_verified_at: new Date().toISOString(),
              })
              .eq('user_id', userId);
            if (profileErr) {
              console.error('Fallback profile phone update failed:', profileErr);
              phoneUpdateError = profileErr;
            } else {
              phoneUpdateError = null; // we succeeded in fallback
            }
          } else {
            phoneUpdateError = fnData.error;
          }
        }
      } catch (e) {
        console.error('Exception invoking auth-update-phone:', e);
        phoneUpdateError = e as Error;
      }
    }

    // If zip code is changing, reassign node
    if (updates.zip_code !== undefined) {
      const nodeAssignment = await findNearestNode(updates.zip_code);
      if (!nodeAssignment) {
        // No node found; do not block update. Set node_id to null and signal waitlist
        needsWaitlist = true;
        userZip = updates.zip_code;
        updatePayload.node_id = null;
      } else {
        updatePayload.node_id = nodeAssignment.node_id;
      }
    }

    // Update the user profile
    // NOTE: We NEVER update referral_code or referred_by here - they are managed by auth trigger
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Profile update error:', updateError);
      return { user: null, error: updateError };
    }

    // Fast path for UI flows that do not need auth user payload immediately.
    if (!includeAuthUser) {
      if (phoneUpdateError) {
        return {
          user: null,
          error: phoneUpdateError,
          needsWaitlist,
          zipCode: userZip,
        };
      }

      return { user: null, error: null, needsWaitlist, zipCode: userZip };
    }

    // Fetch current auth user to return updated info
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { user: null, error: userError };
    }

    // If phone update failed earlier, surface that as a partial error while returning user
    if (phoneUpdateError) {
      return {
        user: userData.user as User,
        error: phoneUpdateError,
        needsWaitlist,
        zipCode: userZip,
      };
    }

    return { user: userData.user as User, error: null, needsWaitlist, zipCode: userZip };
  } catch (error) {
    console.error('Update profile exception:', error);
    return { user: null, error: error as Error };
  }
};

export const resolveAvatarUrl = async (avatarPathOrUrl?: string | null): Promise<string | null> => {
  if (!avatarPathOrUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(avatarPathOrUrl)) {
    return getImageUrl(undefined, avatarPathOrUrl) || avatarPathOrUrl;
  }

  try {
    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPathOrUrl);
    const publicUrl = urlData?.publicUrl || null;
    if (!publicUrl) return null;
    return getImageUrl(undefined, publicUrl) || publicUrl;
  } catch (error) {
    console.warn('[profile.resolveAvatarUrl] public URL fallback failed', error);
  }

  // Fallback: if public URLs are not available (bucket is private), try a signed URL.
  try {
    const { data: signedData, error: signedError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(avatarPathOrUrl, 60);

    if (!signedError && signedData?.signedUrl) {
      return signedData.signedUrl;
    }
  } catch (error) {
    console.debug('[profile.resolveAvatarUrl] signed URL failed', error);
  }

  return null;
};

/**
 * Get current user profile from database
 */
export const getUserProfile = async (
  userId: string
): Promise<{ user: User | null; error: Error | object | null }> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Get user profile error:', error);
      return { user: null, error };
    }

    return { user: data as unknown as User, error: null };
  } catch (error) {
    console.error('Get user profile exception:', error);
    return { user: null, error: error as Error };
  }
};

export interface ProfileStats {
  listingsCount: number;
  tradesCount: number;
  completedTradesCount: number;
}

/**
 * Get live profile counters for listings/trades cards.
 */
export const getProfileStats = async (
  userId: string
): Promise<{ stats: ProfileStats | null; error: Error | object | null }> => {
  try {
    const participantFilter = `buyer_id.eq.${userId},seller_id.eq.${userId}`;

    const [listingsResponse, tradesResponse, completedTradesResponse] = await Promise.all([
      supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', userId)
        .neq('status', 'deleted'),
      supabase
        .from('trades')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'payment_failed', 'in_progress', 'completed'])
        .or(participantFilter),
      supabase
        .from('trades')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .or(participantFilter),
    ]);

    const stats: ProfileStats = {
      listingsCount: listingsResponse.count ?? 0,
      tradesCount: tradesResponse.count ?? 0,
      completedTradesCount: completedTradesResponse.count ?? 0,
    };

    if (listingsResponse.error || tradesResponse.error || completedTradesResponse.error) {
      console.error('Get profile stats error:', {
        listingsError: listingsResponse.error,
        tradesError: tradesResponse.error,
        completedTradesError: completedTradesResponse.error,
      });

      return {
        stats,
        error: listingsResponse.error || tradesResponse.error || completedTradesResponse.error,
      };
    }

    return { stats, error: null };
  } catch (error) {
    console.error('Get profile stats exception:', error);
    return { stats: null, error: error as Error };
  }
};

/**
 * Upload profile avatar to Supabase Storage
 * Returns the public URL of the uploaded image
 * Includes retry logic with exponential backoff for network resilience
 */
export const uploadProfileAvatar = async (
  userId: string,
  imageUri: string,
  maxRetries: number = 3
): Promise<UploadAvatarResult> => {
  let lastError: Error | null = null;

  // AUTH-TC-H03 (dev-only): allow QA to force an avatar-upload failure via the
  // `qa_avatar_upload_failure` admin_config toggle (mirrors the S03/S04
  // `qa_reset_error_simulation` pattern). Fail-closed — release builds and
  // unset/unknown toggles always run the real upload. A simulated error flows
  // through ProfileSetupScreen's existing non-blocking branch (Warning alert →
  // profile created without avatar).
  const simulatedUploadError = await getSimulatedAvatarUploadError();
  if (simulatedUploadError) {
    console.warn('[profile] QA avatar-upload failure simulation active');
    return { url: null, path: null, error: simulatedUploadError };
  }

  // Normalize the picked image into a small JPEG and upload as ArrayBuffer.
  // This avoids Android-specific failures when trying to `fetch()` a local `file://` or `content://` URI.
  const timestamp = Date.now();
  const fileName = `${userId}-${timestamp}.jpg`;
  const filePath = `avatars/${fileName}`;
  const contentType = 'image/jpeg';

  let uploadBody: ArrayBuffer | null = null;
  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 512, height: 512 } }],
      {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!manipulated.base64) {
      return {
        url: null,
        path: null,
        error: new Error('Unable to read image data for upload (missing base64)'),
      };
    }

    uploadBody = decodeBase64ArrayBuffer(manipulated.base64);
  } catch (error) {
    console.error('❌ Avatar preprocess failed:', error);
    return {
      url: null,
      path: null,
      error: error as Error,
    };
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Upload to Supabase Storage
      const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(filePath, uploadBody, {
        contentType,
        upsert: true,
      });

      if (error) {
        lastError = error as Error;
        console.error(`❌ Avatar upload error (attempt ${attempt + 1}/${maxRetries}):`, {
          message: error.message,
          status: (error as any).status,
          statusCode: (error as any).statusCode,
        });

        // Diagnose error type
        if (error.message?.includes('Network')) {
          console.error('→ NETWORK ERROR: Retrying with backoff...');
        } else if (
          error.message?.includes('row-level security') ||
          error.message?.includes('violates')
        ) {
          console.error('→ RLS ERROR: Storage policies may be misconfigured');
          return {
            url: null,
            path: null,
            error: new Error(
              'Storage not configured. Please contact support. (Profile will be created without avatar)'
            ),
          };
        } else if (error.message?.includes('not found')) {
          console.error('→ BUCKET ERROR: Storage bucket not found');
          return { url: null, path: null, error };
        }

        // Retry if not a permanent error
        if (attempt < maxRetries - 1) {
          const waitMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`⏳ Retrying in ${waitMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        return { url: null, path: null, error };
      }

      // Get public URL; use fallback if not provided
      const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

      // The publicUrl property exists on the data object returned by getPublicUrl
      const publicUrl =
        urlData?.publicUrl ||
        `${process.env.EXPO_PUBLIC_SUPABASE_URL || (supabase as any).url}/storage/v1/object/public/user-avatars/${filePath}`;

      console.log('✅ Avatar uploaded successfully');
      return { url: publicUrl, path: filePath, error: null };
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ Upload avatar exception (attempt ${attempt + 1}/${maxRetries}):`, error);

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (typeof supabaseUrl === 'string') {
        if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
          console.error(
            '⚠️ Supabase URL points to localhost. Uploads will fail on a physical device. ' +
              'Use your machine LAN IP (or a hosted Supabase URL) in EXPO_PUBLIC_SUPABASE_URL.'
          );
        }
        if (supabaseUrl.startsWith('http://')) {
          console.error(
            '⚠️ Supabase URL is http://. Android may block cleartext traffic depending on config. ' +
              'Prefer https:// Supabase URL.'
          );
        }
      }

      if (attempt < maxRetries - 1) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.warn(`⏳ Retrying in ${waitMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
    }
  }

  console.error('❌ Avatar upload failed after maximum retries');
  return {
    url: null,
    path: null,
    error: lastError || new Error('Upload failed after maximum retries'),
  };
};
