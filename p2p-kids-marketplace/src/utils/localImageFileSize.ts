/**
 * File: p2p-kids-marketplace/src/utils/localImageFileSize.ts
 * MODULE-04: Resolve the on-disk size of a LOCAL image URI.
 *
 * Why this exists: the publish path (`services/listing.ts` -> `uploadListingImages`)
 * historically received bare URI strings with no `fileSize` metadata, so it could
 * not apply the 10 MB contract at all (AUTH Android R3, FINDING F1 second limb).
 * `expo-image-picker` also leaves `fileSize` undefined in some Android picker
 * paths, which made the draft-path size check fail OPEN
 * (`if (asset.fileSize)` in the old `validatePhoto`).
 *
 * A URI we cannot measure is reported as `null` — NOT as 0 and NOT as an error.
 * Callers treat "unknown" as "not checkable at this layer" and fall back to the
 * Storage bucket's server-side limit, exactly as they treat an unknown MIME type.
 */

import * as FileSystemLegacy from 'expo-file-system/legacy';

/**
 * Returns the size of a local image in bytes, or null when it cannot be determined
 * (unsupported scheme, missing file, or a platform that does not report `size`).
 *
 * Note: expo-file-system's legacy `InfoOptions` exposes only `md5`, NOT a `size`
 * flag — `getInfoAsync` already returns `size: number` on the `exists: true` branch
 * of `FileInfo`. Requesting `{ size: true }` is a type error and is deliberately
 * not used here.
 */
export async function getLocalImageSizeBytes(uri: string): Promise<number | null> {
  if (!uri || uri.startsWith('data:')) {
    // A data: URI carries no filesystem entry; its byte length is not a file size
    // and must never be compared against the 10 MB file cap.
    return null;
  }

  try {
    const info = await FileSystemLegacy.getInfoAsync(uri);
    if (!info.exists) {
      return null;
    }

    return typeof info.size === 'number' && info.size > 0 ? info.size : null;
  } catch (error) {
    // e.g. an `ph://` / `assets-library://` URI on a platform that cannot stat it.
    console.warn('[localImageFileSize] Could not determine file size for a local image:', error);
    return null;
  }
}
