// filepath: p2p-kids-marketplace/src/services/badgeUtils.ts

import { supabase } from '../config/supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export interface BadgeIconUploadResult {
  url: string | null;
  path: string | null;
  error: Error | null;
}

/**
 * Upload badge icon to Supabase Storage (Admin only)
 * @param badgeId - Badge ID to associate the icon with
 * @param fileUri - Local file URI from image picker
 * @returns Upload result with public URL
 */
export async function uploadBadgeIcon(
  badgeId: string,
  fileUri: string
): Promise<BadgeIconUploadResult> {
  try {
    // Generate unique file path
    const timestamp = Date.now();
    const extension = fileUri.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `icons/${badgeId}-${timestamp}.${extension}`;

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert to ArrayBuffer
    const arrayBuffer = decode(base64);

    // Determine content type
    let contentType = 'image/png';
    if (extension === 'jpg' || extension === 'jpeg') contentType = 'image/jpeg';
    if (extension === 'webp') contentType = 'image/webp';
    if (extension === 'svg') contentType = 'image/svg+xml';

    // Upload to storage
    const { data, error } = await supabase.storage
      .from('badge-icons')
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error('[badgeUtils.uploadBadgeIcon] Upload error:', error);
      return { url: null, path: null, error };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('badge-icons')
      .getPublicUrl(data.path);

    // Update badge with new icon URL
    const { error: updateError } = await supabase
      .from('badges')
      .update({ icon_url: publicUrl })
      .eq('id', badgeId);

    if (updateError) {
      console.error('[badgeUtils.uploadBadgeIcon] Update error:', updateError);
      return { url: null, path: null, error: updateError };
    }

    console.log('[badgeUtils.uploadBadgeIcon] Success:', publicUrl);
    return { url: publicUrl, path: data.path, error: null };
  } catch (e: any) {
    console.error('[badgeUtils.uploadBadgeIcon] Exception:', e);
    return { url: null, path: null, error: e as Error };
  }
}

/**
 * Get signed URL for badge icon (for temporary access)
 * @param path - Storage path of the icon
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Signed URL or null if error
 */
export async function getSignedBadgeIconUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('badge-icons')
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('[badgeUtils.getSignedBadgeIconUrl] Error:', error);
      return null;
    }

    return data.signedUrl;
  } catch (e) {
    console.error('[badgeUtils.getSignedBadgeIconUrl] Exception:', e);
    return null;
  }
}

/**
 * Delete badge icon from storage (Admin only)
 * @param path - Storage path of the icon
 * @returns Success boolean
 */
export async function deleteBadgeIcon(path: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from('badge-icons')
      .remove([path]);

    if (error) {
      console.error('[badgeUtils.deleteBadgeIcon] Error:', error);
      return false;
    }

    console.log('[badgeUtils.deleteBadgeIcon] Success:', path);
    return true;
  } catch (e) {
    console.error('[badgeUtils.deleteBadgeIcon] Exception:', e);
    return false;
  }
}

/**
 * Get public URL for badge icon (no authentication required)
 * @param path - Storage path of the icon
 * @returns Public URL
 */
export function getPublicBadgeIconUrl(path: string): string {
  const { data: { publicUrl } } = supabase.storage
    .from('badge-icons')
    .getPublicUrl(path);
  
  return publicUrl;
}
