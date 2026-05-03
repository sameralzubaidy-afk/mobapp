/**
 * File: p2p-kids-marketplace/src/utils/photoHash.ts
 * MODULE-04 V3.1 UX overhaul (Decision 12) — perceptual photo hashing
 *
 * Strict client-side duplicate detection. We normalize each local image to a
 * deterministic thumbnail JPEG and compare the full normalized payload.
 *
 * This intentionally avoids "near duplicate" matching because it can produce
 * false positives. A DUP badge should only appear for true duplicates.
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystemLegacy from 'expo-file-system/legacy';

const HASH_TARGET_SIZE = 32;
const EXACT_DUPLICATE_DISTANCE = 0;

function isLocalUri(uri: string): boolean {
  return (
    uri.startsWith('file://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('content://') ||
    uri.startsWith('asset-library://') ||
    uri.startsWith('assets-library://')
  );
}

/**
 * Produce a normalized image fingerprint for the given image URI. Returns the
 * empty string on failure; callers should treat empty hashes as "unknown"
 * and skip duplicate detection rather than blocking the user.
 */
export async function computePhotoHash(uri: string): Promise<string> {
  if (!isLocalUri(uri)) return '';

  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: HASH_TARGET_SIZE, height: HASH_TARGET_SIZE } }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );
    const base64 = await FileSystemLegacy.readAsStringAsync(result.uri, {
      encoding: 'base64' as const,
    });
    // Use the full normalized payload for strict duplicate matching.
    return base64;
  } catch (error) {
    console.warn('[photoHash] failed to hash image', error);
    return '';
  }
}

/**
 * Hamming-style distance for two equal-length fingerprints.
 * Different-length inputs return a large distance to avoid false matches.
 */
export function hashDistance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) diff += 1;
  }
  return diff;
}

export function isNearDuplicate(a: string, b: string): boolean {
  return hashDistance(a, b) === EXACT_DUPLICATE_DISTANCE;
}

/**
 * Given a list of photo hashes (in pick order), return the indices that look
 * like duplicates of an earlier item.
 */
export function findDuplicateIndices(hashes: string[]): number[] {
  const dups: number[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < hashes.length; i += 1) {
    const current = hashes[i];
    if (!current) continue;

    if (seen.has(current)) {
      dups.push(i);
      continue;
    }

    seen.add(current);
  }

  return dups;
}

export const PHOTO_HASH_CONFIG = {
  HASH_TARGET_SIZE,
  EXACT_DUPLICATE_DISTANCE,
} as const;
