/**
 * File: p2p-kids-marketplace/src/utils/uploadFailureFormat.ts
 * MODULE-04: Shared formatting for per-photo upload failures.
 *
 * Extracted from `screens/BulkListingCreateScreen.tsx` (FIX-Task-61 item 1) so the
 * ItemCreate draft path — which previously reported upload failures to telemetry
 * ONLY, with no user-facing branch at all (AUTH Android R3, FINDING F1) — can use
 * the same proven copy shape instead of inventing a second one.
 *
 * `buildUploadFailureMessage` is a byte-for-byte behaviour-preserving move: the
 * Bulk screen's wording and truncation rules are unchanged.
 */

/** Minimal photo shape needed to label a failed entry. */
export interface LabelledPhoto {
  uri: string;
}

/** One failed photo as returned by `uploadPhotoBatch`. */
export interface UploadFailureEntry {
  index: number;
  error: string;
}

/** Max individual failures listed before collapsing into a "+N more" line. */
const MAX_LISTED_FAILURES = 3;

/** Human label for a failed photo: the file name when we have one, else its position. */
export function photoLabelFromUri(uri: string, index: number): string {
  const tail = uri.split('/').pop();
  if (tail && tail.trim().length > 0) return tail;
  return `Photo ${index + 1}`;
}

/**
 * Bulk-listing copy: the failed photos were skipped and the item can proceed.
 * Verbatim move of the former BulkListingCreateScreen local helper — do not
 * re-word without checking that screen's cases.
 */
export function buildUploadFailureMessage(
  errors: UploadFailureEntry[],
  picked: LabelledPhoto[]
): string {
  const header =
    errors.length === 1
      ? '1 photo failed to upload and was skipped.'
      : `${errors.length} photos failed to upload and were skipped.`;
  const details = errors.slice(0, MAX_LISTED_FAILURES).map((entry) => {
    const label = photoLabelFromUri(picked[entry.index]?.uri || '', entry.index);
    return `- ${label}: ${entry.error}`;
  });
  const remainder =
    errors.length > MAX_LISTED_FAILURES
      ? `\n- +${errors.length - MAX_LISTED_FAILURES} more failure(s)`
      : '';
  return `${header}\n${details.join('\n')}${remainder}\nUse "+ Add more photos" to retry.`;
}

/** Structured form of the ItemCreate rejection copy, for inline cards. */
export interface RejectedPhotoSummary {
  heading: string;
  details: string[];
  overflowLine: string | null;
  instruction: string;
}

/**
 * ItemCreate copy: the rejected photos are NOT silently dropped — they stay in the
 * strip, visibly marked, and block Publish until the seller removes or replaces
 * them (owner decision, FIX-Task-61 item 1).
 */
export function summarizeRejectedPhotos(
  errors: UploadFailureEntry[],
  photos: LabelledPhoto[]
): RejectedPhotoSummary {
  const heading =
    errors.length === 1 ? "1 photo can't be uploaded" : `${errors.length} photos can't be uploaded`;

  const details = errors.slice(0, MAX_LISTED_FAILURES).map((entry) => {
    const label = photoLabelFromUri(photos[entry.index]?.uri || '', entry.index);
    return `${label}: ${entry.error}`;
  });

  return {
    heading,
    details,
    overflowLine:
      errors.length > MAX_LISTED_FAILURES
        ? `+${errors.length - MAX_LISTED_FAILURES} more photo(s) couldn't upload`
        : null,
    instruction:
      errors.length === 1
        ? 'Remove or replace it, then try again.'
        : 'Remove or replace them, then try again.',
  };
}

/** Flat multi-line form of `summarizeRejectedPhotos`, for a blocking Alert. */
export function buildRejectedPhotoMessage(
  errors: UploadFailureEntry[],
  photos: LabelledPhoto[]
): string {
  const summary = summarizeRejectedPhotos(errors, photos);
  const lines = [
    summary.heading,
    ...summary.details.map((detail) => `- ${detail}`),
    ...(summary.overflowLine ? [`- ${summary.overflowLine}`] : []),
    summary.instruction,
  ];
  return lines.join('\n');
}
