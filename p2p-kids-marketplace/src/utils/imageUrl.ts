/**
 * Image URL utilities for CDN optimization
 * 
 * Prefers Cloudflare Worker CDN URLs for cached images,
 * falls back to direct Supabase Storage if CDN unavailable
 */

const CDN_URL = process.env.EXPO_PUBLIC_CDN_URL || '';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

/**
 * Transform a Supabase Storage publicUrl to use CDN if available
 * 
 * Example:
 * Input:  https://drntwgporzabmxdqykrp.supabase.co/storage/v1/object/public/item-images/abc.jpg
 * Output: https://p2p-kids-cf-worker-dev.samer-alzubaidy.workers.dev/item-images/abc.jpg
 *         (or original URL if CDN unavailable)
 * 
 * @param publicUrl - Supabase Storage public URL
 * @returns CDN URL if available and valid, otherwise publicUrl
 */
export function transformToCdnUrl(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null;

  // If CDN not configured, return original URL
  if (!CDN_URL) {
    return publicUrl;
  }

  try {
    const url = new URL(publicUrl);

    // Check if this is a Supabase Storage URL
    if (!url.pathname.includes('/storage/v1/object/public/')) {
      return publicUrl; // Not a storage URL, return as-is
    }

    // Extract bucket and path from Supabase URL
    // /storage/v1/object/public/{bucket}/{path}
    const parts = url.pathname.split('/storage/v1/object/public/');
    if (parts.length !== 2) return publicUrl;

    const bucketAndPath = parts[1]; // e.g., "item-images/user-123/abc.jpg"

    // Construct CDN URL
    const cdnUrl = `${CDN_URL}/${bucketAndPath}`;
    return cdnUrl;
  } catch (error) {
    console.warn(`[imageUrl] Failed to transform URL: ${publicUrl}`, error);
    return publicUrl;
  }
}

/**
 * Get CDN or fallback URL for an image
 * 
 * If you have both cdnUrl and publicUrl, prefers cdnUrl
 * If you only have publicUrl, attempts to transform it
 * If you only have cdnUrl, uses it directly
 * 
 * @param cdnUrl - Cloudflare Worker CDN URL (preferred)
 * @param publicUrl - Supabase Storage public URL (fallback)
 * @returns Best available URL, or null if neither provided
 */
export function getImageUrl(
  cdnUrl?: string | null,
  publicUrl?: string | null
): string | null {
  // Prefer explicit CDN URL
  if (cdnUrl) {
    return cdnUrl;
  }

  // Transform public URL if available
  if (publicUrl) {
    return transformToCdnUrl(publicUrl);
  }

  return null;
}

/**
 * Check if URL is already a CDN URL
 * 
 * @param url - URL to check
 * @returns true if URL appears to be a Cloudflare Worker URL
 */
export function isCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('workers.dev') || url.includes(CDN_URL);
}

/**
 * Get fallback placeholder URL
 * Used when image loading fails
 * 
 * @returns Placeholder image URL or null
 */
export function getImagePlaceholder(): string | null {
  // For now, return null and let UI handle placeholder
  // Later, could be replaced with actual placeholder image URL
  return null;
}
