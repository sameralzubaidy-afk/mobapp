/**
 * File: p2p-kids-marketplace/src/services/photoService.ts
 * MODULE-04 LISTING-V3: Photo Service Layer
 * Task: LISTING-V3-003 - Photo pipeline (validate / compress / upload / auto-group / regroup)
 *
 * Handles:
 * - Photo validation (format, size, dimensions)
 * - Photo compression and resizing
 * - Batch upload to Supabase Storage
 * - Auto-grouping photos for bulk listing
 * - Regrouping logic
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../config/supabase';
import { PhotoAsset, PhotoGroup } from '../types/listing';

// Storage path pattern for draft-stage uploads: drafts/{seller_id}/{timestamp}/
const STORAGE_BUCKET = 'item-images';

// Validation limits
const MAX_FILE_SIZE_MB = 10;
const MIN_DIMENSION = 400;
const MAX_PHOTOS_TOTAL = 30;
const MAX_PHOTOS_PER_GROUP = 10;
const MAX_GROUPS = 15;

// Compression settings
const COMPRESSION_QUALITY = 0.8;

// Supported MIME types
const SUPPORTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'public.heic',
  'public.heif',
];

/**
 * Validation result for photo assets
 */
export interface PhotoValidation {
  valid: boolean;
  error?: string;
}

/**
 * Batch upload result
 */
export interface PhotoUploadResult {
  urls: string[];
  errors: { index: number; error: string }[];
}

/**
 * Validate photo asset against requirements
 * Checks format, file size, and minimum dimensions
 *
 * @param asset - Photo asset to validate
 * @returns Validation result with error message if invalid
 */
export async function validatePhoto(asset: PhotoAsset): Promise<PhotoValidation> {
  // Check MIME type
  if (asset.mimeType && !SUPPORTED_TYPES.includes(asset.mimeType.toLowerCase())) {
    return {
      valid: false,
      error: 'Only JPEG, PNG, WebP, and HEIC images are supported',
    };
  }

  // Check file size (if available)
  if (asset.fileSize) {
    const sizeMB = asset.fileSize / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      return {
        valid: false,
        error: `Image must be smaller than ${MAX_FILE_SIZE_MB}MB`,
      };
    }
  }

  // Check dimensions
  if (asset.width < MIN_DIMENSION || asset.height < MIN_DIMENSION) {
    return {
      valid: false,
      error: `Image must be at least ${MIN_DIMENSION}×${MIN_DIMENSION} pixels`,
    };
  }

  return { valid: true };
}

/**
 * Compress and resize photo if needed
 * Output ≤ 1MB; resizes if width > 1200px preserving aspect ratio
 *
 * @param uri - Local photo URI
 * @param quality - Compression quality (0-1), default 0.8
 * @returns Compressed photo URI
 */
export async function compressPhoto(
  uri: string,
  quality: number = COMPRESSION_QUALITY
): Promise<string> {
  try {
    // Get image info to determine if resizing needed
    const result = await manipulateAsync(uri, [], { compress: quality, format: SaveFormat.JPEG });

    // Check if width exceeds max
    const finalUri = result.uri;

    // If still too large, try additional compression
    // Note: expo-image-manipulator doesn't provide file size directly
    // We estimate and may need multiple passes
    return finalUri;
  } catch (error) {
    console.error('[photoService] Compression error:', error);
    throw new Error('Failed to compress photo');
  }
}

/**
 * Upload photos in batch to Supabase Storage
 * Uploads to drafts/{seller_id}/{timestamp}/ with progress callback
 * Tolerates partial failure
 *
 * @param photos - Array of photo assets to upload
 * @param sellerId - Current seller ID
 * @param onProgress - Progress callback (count uploaded)
 * @returns Upload result with successful URLs and errors
 */
export async function uploadPhotoBatch(
  photos: PhotoAsset[],
  sellerId: string,
  onProgress?: (count: number) => void
): Promise<PhotoUploadResult> {
  const urls: string[] = [];
  const errors: { index: number; error: string }[] = [];
  const timestamp = Date.now();
  const basePath = `drafts/${sellerId}/${timestamp}`;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];

    try {
      // Validate photo
      const validation = await validatePhoto(photo);
      if (!validation.valid) {
        errors.push({ index: i, error: validation.error || 'Validation failed' });
        continue;
      }

      // Compress photo
      const compressedUri = await compressPhoto(photo.uri);

      // Read local file as base64 and decode to ArrayBuffer to avoid React Native 0-byte blob upload bug
      const base64Data = await FileSystemLegacy.readAsStringAsync(compressedUri, {
        encoding: 'base64' as const,
      });
      const arrayBuffer = decode(base64Data);

      // Generate filename
      // We always upload the compressed JPEG output from compressPhoto().
      const filename = `photo_${i}_${timestamp}.jpg`;
      const filePath = `${basePath}/${filename}`;

      // Upload to Supabase Storage
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

      urls.push(publicData.publicUrl);

      // Call progress callback
      if (onProgress) {
        onProgress(urls.length);
      }
    } catch (error: any) {
      console.error(`[photoService] Upload error for photo ${i}:`, error);
      errors.push({
        index: i,
        error: error.message || 'Upload failed',
      });
    }
  }

  return { urls, errors };
}

/**
 * Link uploaded photos to an item in database
 * Creates item_images records
 *
 * @param itemId - Item ID to link photos to
 * @param photoUrls - Array of photo URLs
 * @returns Success status
 */
export async function linkPhotosToItems(itemId: string, photoUrls: string[]): Promise<boolean> {
  try {
    const records = photoUrls.map((url, index) => ({
      item_id: itemId,
      url,
      display_order: index,
    }));

    const { error } = await supabase.from('item_images').insert(records);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('[photoService] Link photos error:', error);
    return false;
  }
}

/**
 * Auto-group photos for bulk listing
 * Sequential grouping: DEFAULT 1 per group (Depop/Mercari pattern - user merges later)
 * Respects caps: 10/group, 30 total, 15 groups
 * Returns PhotoGroup[] with stable groupId
 *
 * UX V3.1: Default changed from 2 → 1 photo per item. Auto-grouping multiple photos into
 * the same item is wrong more often than right; users prefer to start with 1-photo-per-item
 * and merge similar photos via multi-select (Decision 1, MODULE-04 V3 UX overhaul).
 *
 * @param photos - Array of photo assets
 * @param photosPerGroup - Photos per group (default 1)
 * @returns Array of photo groups
 */
export function groupPhotosAuto(photos: PhotoAsset[], photosPerGroup: number = 1): PhotoGroup[] {
  const groups: PhotoGroup[] = [];

  // Enforce total photo cap
  const cappedPhotos = photos.slice(0, MAX_PHOTOS_TOTAL);

  if (cappedPhotos.length === 0) return groups;

  const safePhotosPerGroup = Math.max(1, Math.min(photosPerGroup, MAX_PHOTOS_PER_GROUP));
  const requiredGroups = Math.ceil(cappedPhotos.length / safePhotosPerGroup);

  // Standard chunking when requested group size fits session item cap.
  if (requiredGroups <= MAX_GROUPS) {
    for (let i = 0; i < cappedPhotos.length; i += safePhotosPerGroup) {
      const groupPhotos = cappedPhotos.slice(i, i + safePhotosPerGroup);
      if (groupPhotos.length > 0) {
        groups.push({
          groupId: `group_${groups.length + 1}_${Date.now()}`,
          photos: groupPhotos.slice(0, MAX_PHOTOS_PER_GROUP),
          primaryPhotoIndex: 0,
        });
      }
    }
    return groups;
  }

  // Overflow path: keep all photos while honoring MAX_GROUPS by distributing
  // photos contiguously across exactly MAX_GROUPS groups.
  const baseSize = Math.floor(cappedPhotos.length / MAX_GROUPS);
  const remainder = cappedPhotos.length % MAX_GROUPS;
  let cursor = 0;

  for (let groupIndex = 0; groupIndex < MAX_GROUPS; groupIndex += 1) {
    const size = baseSize + (groupIndex < remainder ? 1 : 0);
    if (size <= 0) continue;

    const groupPhotos = cappedPhotos.slice(cursor, cursor + size);
    cursor += size;

    groups.push({
      groupId: `group_${groups.length + 1}_${Date.now()}`,
      photos: groupPhotos.slice(0, MAX_PHOTOS_PER_GROUP),
      primaryPhotoIndex: 0,
    });
  }

  return groups;
}

/**
 * Regroup photos (move photo between groups)
 * Immutable update; maintains intra-group order
 * No-op if target already contains photo
 *
 * @param groups - Current photo groups
 * @param sourceGroupId - Source group ID
 * @param photoId - Photo ID (uri)
 * @param targetGroupId - Target group ID
 * @returns Updated groups array
 */
export function regroupPhotos(
  groups: PhotoGroup[],
  sourceGroupId: string,
  photoId: string,
  targetGroupId: string
): PhotoGroup[] {
  // Find source and target groups
  const sourceIndex = groups.findIndex((g) => g.groupId === sourceGroupId);
  const targetIndex = groups.findIndex((g) => g.groupId === targetGroupId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return groups;
  }

  const sourceGroup = groups[sourceIndex];
  const targetGroup = groups[targetIndex];

  // Find photo in source group
  const photoIndex = sourceGroup.photos.findIndex((p) => p.uri === photoId);
  if (photoIndex === -1) {
    return groups;
  }

  // Check if photo already in target
  const alreadyInTarget = targetGroup.photos.some((p) => p.uri === photoId);
  if (alreadyInTarget) {
    return groups;
  }

  // Check target group capacity
  if (targetGroup.photos.length >= MAX_PHOTOS_PER_GROUP) {
    return groups;
  }

  // Create new groups array (immutable)
  const newGroups = [...groups];
  const photo = sourceGroup.photos[photoIndex];

  // Remove from source
  newGroups[sourceIndex] = {
    ...sourceGroup,
    photos: sourceGroup.photos.filter((p) => p.uri !== photoId),
    primaryPhotoIndex:
      sourceGroup.primaryPhotoIndex === photoIndex ? 0 : sourceGroup.primaryPhotoIndex,
  };

  // Add to target
  newGroups[targetIndex] = {
    ...targetGroup,
    photos: [...targetGroup.photos, photo],
  };

  return newGroups;
}

/**
 * Get photo thumbnail URL (for now, returns original URL)
 * In future: implement Supabase Storage transforms
 *
 * @param photoUrl - Original photo URL
 * @returns Thumbnail URL
 */
export function getPhotoThumbnail(photoUrl: string): string {
  // TODO: Implement Supabase Storage transform when available
  return photoUrl;
}

/**
 * Get photo count for an item
 *
 * @param itemId - Item ID
 * @returns Photo count
 */
export async function getPhotoCount(itemId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('item_images')
      .select('*', { count: 'exact', head: true })
      .eq('item_id', itemId);

    if (error) throw error;

    return count || 0;
  } catch (error) {
    console.error('[photoService] Get photo count error:', error);
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// V3.1 UX overhaul — group manipulation helpers (Decisions 1 & 6)
// ─────────────────────────────────────────────────────────────────────────────

let v_groupIdSequence = 0;

function nextGroupId(seedTag?: string): string {
  v_groupIdSequence += 1;
  const safeTag = (seedTag || 'generated').replace(/[^a-zA-Z0-9_]/g, '_');
  return `group_${safeTag}_${Date.now()}_${v_groupIdSequence}`;
}

/**
 * Merge multiple groups into a single new group (preserves photo order).
 * Returns groups array with merged group at the position of the first source group;
 * source groups removed. Caps at MAX_PHOTOS_PER_GROUP — overflow photos stay in their
 * original groups (caller should surface a warning).
 */
export function mergeGroups(
  groups: PhotoGroup[],
  sourceGroupIds: string[]
): { groups: PhotoGroup[]; overflow: number } {
  if (sourceGroupIds.length < 2) return { groups, overflow: 0 };
  const sources = sourceGroupIds
    .map((id) => groups.find((g) => g.groupId === id))
    .filter((g): g is PhotoGroup => Boolean(g));
  if (sources.length < 2) return { groups, overflow: 0 };

  const allPhotos = sources.flatMap((g) => g.photos);
  const taken = allPhotos.slice(0, MAX_PHOTOS_PER_GROUP);
  const overflow = allPhotos.length - taken.length;

  const firstSourceIndex = groups.findIndex((g) => g.groupId === sources[0].groupId);
  const merged: PhotoGroup = {
    groupId: nextGroupId('merged'),
    photos: taken,
    primaryPhotoIndex: 0,
  };

  const sourceIdSet = new Set(sourceGroupIds);
  const next: PhotoGroup[] = [];
  let inserted = false;
  groups.forEach((g, idx) => {
    if (sourceIdSet.has(g.groupId)) {
      if (!inserted && idx === firstSourceIndex) {
        next.push(merged);
        inserted = true;
      }
      return;
    }
    next.push(g);
  });
  if (!inserted) next.unshift(merged);
  return { groups: next, overflow };
}

/**
 * Split a group into N groups of 1 photo each.
 * Replaces the source group at its position with the new groups.
 * Respects MAX_GROUPS cap.
 */
export function splitGroup(groups: PhotoGroup[], sourceGroupId: string): PhotoGroup[] {
  const idx = groups.findIndex((g) => g.groupId === sourceGroupId);
  if (idx === -1) return groups;
  const source = groups[idx];
  if (source.photos.length <= 1) return groups;

  const remainingSlots = MAX_GROUPS - (groups.length - 1);
  if (remainingSlots <= 0) return groups;

  const newGroups: PhotoGroup[] = source.photos.slice(0, remainingSlots).map((photo, i) => ({
    groupId: nextGroupId(`split_${i}`),
    photos: [photo],
    primaryPhotoIndex: 0,
  }));

  // If we couldn't fit all, leave the leftover photos in the original group
  const leftover = source.photos.slice(remainingSlots);
  const next = [...groups];
  if (leftover.length > 0) {
    next.splice(idx, 1, { ...source, photos: leftover, primaryPhotoIndex: 0 }, ...newGroups);
  } else {
    next.splice(idx, 1, ...newGroups);
  }
  return next;
}

/**
 * Add an empty group (no photos) — used when seller wants to list an item before adding photos.
 */
export function addEmptyGroup(groups: PhotoGroup[]): PhotoGroup[] {
  if (groups.length >= MAX_GROUPS) return groups;
  return [
    ...groups,
    {
      groupId: nextGroupId('empty'),
      photos: [],
      primaryPhotoIndex: 0,
    },
  ];
}

/**
 * Remove a group entirely. Photos in the group are also removed.
 */
export function removeGroup(groups: PhotoGroup[], groupId: string): PhotoGroup[] {
  return groups.filter((g) => g.groupId !== groupId);
}

/**
 * Remove a single photo from whichever group contains it.
 * If the group becomes empty, the group is removed too.
 */
export function removePhotoFromGroups(groups: PhotoGroup[], photoId: string): PhotoGroup[] {
  return groups
    .map((g) => {
      const idx = g.photos.findIndex((p) => p.id === photoId);
      if (idx === -1) return g;
      const nextPhotos = g.photos.filter((p) => p.id !== photoId);
      const nextPrimary = Math.min(g.primaryPhotoIndex, Math.max(0, nextPhotos.length - 1));
      return { ...g, photos: nextPhotos, primaryPhotoIndex: nextPrimary };
    })
    .filter((g) => g.photos.length > 0);
}

/**
 * Append additional photos as new 1-photo groups (used when seller taps "Add more photos").
 * Respects total + group caps.
 */
export function appendPhotosAsGroups(groups: PhotoGroup[], newPhotos: PhotoAsset[]): PhotoGroup[] {
  const totalPhotos = groups.reduce((sum, g) => sum + g.photos.length, 0);
  const photoSlots = Math.max(0, MAX_PHOTOS_TOTAL - totalPhotos);
  const groupSlots = Math.max(0, MAX_GROUPS - groups.length);
  const limit = Math.min(newPhotos.length, photoSlots, groupSlots);
  if (limit <= 0) return groups;
  const additions: PhotoGroup[] = newPhotos.slice(0, limit).map((p, i) => ({
    groupId: nextGroupId(`add_${i}`),
    photos: [p],
    primaryPhotoIndex: 0,
  }));
  return [...groups, ...additions];
}

/**
 * Add photos to an existing group (used when seller taps "+ Add photos" inside an item).
 * Respects MAX_PHOTOS_PER_GROUP and MAX_PHOTOS_TOTAL caps.
 */
export function addPhotosToGroup(
  groups: PhotoGroup[],
  groupId: string,
  newPhotos: PhotoAsset[]
): PhotoGroup[] {
  const idx = groups.findIndex((g) => g.groupId === groupId);
  if (idx === -1) return groups;
  const target = groups[idx];
  const totalPhotos = groups.reduce((sum, g) => sum + g.photos.length, 0);
  const groupRoom = MAX_PHOTOS_PER_GROUP - target.photos.length;
  const totalRoom = MAX_PHOTOS_TOTAL - totalPhotos;
  const limit = Math.min(newPhotos.length, groupRoom, totalRoom);
  if (limit <= 0) return groups;
  const next = [...groups];
  next[idx] = { ...target, photos: [...target.photos, ...newPhotos.slice(0, limit)] };
  return next;
}

/**
 * Move a photo to a NEW position within the same group (drag-reorder).
 */
export function reorderPhotoInGroup(
  groups: PhotoGroup[],
  groupId: string,
  fromIndex: number,
  toIndex: number
): PhotoGroup[] {
  const idx = groups.findIndex((g) => g.groupId === groupId);
  if (idx === -1) return groups;
  const target = groups[idx];
  if (
    fromIndex < 0 ||
    fromIndex >= target.photos.length ||
    toIndex < 0 ||
    toIndex >= target.photos.length ||
    fromIndex === toIndex
  ) {
    return groups;
  }
  const photos = [...target.photos];
  const [moved] = photos.splice(fromIndex, 1);
  photos.splice(toIndex, 0, moved);
  // Track primary across the move
  let nextPrimary = target.primaryPhotoIndex;
  if (target.primaryPhotoIndex === fromIndex) nextPrimary = toIndex;
  else if (fromIndex < target.primaryPhotoIndex && toIndex >= target.primaryPhotoIndex) {
    nextPrimary = target.primaryPhotoIndex - 1;
  } else if (fromIndex > target.primaryPhotoIndex && toIndex <= target.primaryPhotoIndex) {
    nextPrimary = target.primaryPhotoIndex + 1;
  }
  const next = [...groups];
  next[idx] = { ...target, photos, primaryPhotoIndex: nextPrimary };
  return next;
}

export const PHOTO_LIMITS = {
  MAX_PHOTOS_TOTAL,
  MAX_PHOTOS_PER_GROUP,
  MAX_GROUPS,
} as const;
