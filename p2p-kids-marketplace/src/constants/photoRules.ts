/**
 * File: p2p-kids-marketplace/src/constants/photoRules.ts
 * MODULE-04: Single source of truth for the photo validation contract.
 *
 * Deliberately dependency-free (no React Native / Expo / Supabase imports) so
 * every consumer — the draft path (`services/photoService.ts`) and the publish
 * path (`services/listing.ts`) — shares ONE definition of the size/MIME contract
 * and no path can drift from another (BP-27 / BP-94 leaf-module rule).
 *
 * Contract mirrors the `item-images` Storage bucket
 * (`supabase/migrations/20260824000001_update_item_images_bucket_file_size_limit.sql`
 * for the 10 MB cap and `20260918000009_fix_task_61_item_images_bucket_mime_alignment.sql`
 * for the MIME allow-list). If either side changes, change both.
 */

/** Maximum accepted photo size, in megabytes. Canonical client-side size cap. */
export const MAX_FILE_SIZE_MB = 10;

/** Minimum accepted photo width/height, in pixels. */
export const MIN_PHOTO_DIMENSION = 400;

/** Maximum photos attachable to a single listing. */
export const MAX_PHOTOS_PER_LISTING = 10;

/** Byte equivalent of MAX_FILE_SIZE_MB, for comparisons against raw file sizes. */
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Accepted image MIME types for listing photos.
 * Includes the iOS `public.*` UTI spellings that the picker returns for HEIC.
 */
export const SUPPORTED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'public.heic',
  'public.heif',
] as const;

/** File extension -> MIME type, used when the picker gave us no MIME type. */
export const PHOTO_EXTENSION_MIME_TYPES: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** Result of validating a photo against the contract. */
export interface PhotoValidation {
  valid: boolean;
  error?: string;
}

/** The photo fields the contract is evaluated against. All are optional. */
export interface PhotoMetadataInput {
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
}

/**
 * Derive a MIME type from a URI / path's file extension.
 * Returns null when the extension is unknown — callers must decide whether an
 * unknown type is acceptable (the Storage bucket is the final backstop).
 */
export function mimeTypeFromUri(uri: string): string | null {
  if (!uri) {
    return null;
  }

  // Strip query/hash so signed URLs and `?size=...` suffixes don't hide the extension.
  const withoutQuery = uri.split('?')[0].split('#')[0];
  const match = /\.([a-z0-9]+)$/i.exec(withoutQuery);
  if (!match) {
    return null;
  }

  return PHOTO_EXTENSION_MIME_TYPES[match[1].toLowerCase()] ?? null;
}

/**
 * Evaluate the photo contract.
 *
 * An UNKNOWN value is NOT treated as a pass or a fail — it is simply not checkable
 * at this layer, so the corresponding check is skipped and the Storage bucket
 * (which enforces both limits server-side) remains the backstop. This is why the
 * function takes a partial metadata object: the publish path has no dimensions,
 * while the draft path has no on-disk size probe.
 *
 * Messages are the canonical user-facing strings — callers must not re-word them.
 */
export function validatePhotoMetadata(input: PhotoMetadataInput): PhotoValidation {
  const { mimeType, fileSize, width, height } = input;

  // Check MIME type
  if (
    typeof mimeType === 'string' &&
    mimeType.trim().length > 0 &&
    !SUPPORTED_PHOTO_MIME_TYPES.includes(mimeType.toLowerCase() as never)
  ) {
    return {
      valid: false,
      error: 'Only JPEG, PNG, WebP, and HEIC images are supported',
    };
  }

  // Check file size
  if (typeof fileSize === 'number' && fileSize > 0 && fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image must be smaller than ${MAX_FILE_SIZE_MB}MB`,
    };
  }

  // Check dimensions
  if (
    (typeof width === 'number' && width < MIN_PHOTO_DIMENSION) ||
    (typeof height === 'number' && height < MIN_PHOTO_DIMENSION)
  ) {
    return {
      valid: false,
      error: `Image must be at least ${MIN_PHOTO_DIMENSION}×${MIN_PHOTO_DIMENSION} pixels`,
    };
  }

  return { valid: true };
}
