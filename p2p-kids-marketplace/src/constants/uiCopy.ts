/**
 * File: p2p-kids-marketplace/src/constants/uiCopy.ts
 *
 * Shared user-facing strings that appear on MORE THAN ONE surface.
 *
 * FIX-Task-29 item 9: the "this seller has more items" promise is shown from the
 * Trade Basket banner and from the Item Detail CTA. Keeping that call-to-action in
 * one place means both entry points read identically and can never drift apart.
 */

/**
 * Second line / link label for a "this seller has more items" affordance.
 * FIX-Task-29 item 6: replaces the bare verb "View" on the Trade Basket banner,
 * which told the shopper nothing about where the link went.
 */
export const MORE_FROM_SELLER_BROWSE_CTA = 'Browse all items from this seller';

/**
 * FIX-Task-66 item 4 (2026-09-18): ONE actionable string per photo-picker FAILURE.
 *
 * Two divergent "Failed to take photo" strings existed for the same camera failure
 * (`ImagePickerGrid.tsx` — terse; `IDVerificationUploadScreen.tsx` — actionable), plus
 * three divergent library-failure strings across `ImagePickerGrid`,
 * `IDVerificationUploadScreen`, `EditProfileScreen` and `ProfileSetupScreen`. A parent
 * who hit a terse one was told nothing about what to do next.
 *
 * The FIX-Task-65 item 11 wording is canonical because it names the next step.
 *
 * DELIBERATELY NOT CONSOLIDATED: the permission-DENIED strings. The manual-testing
 * guides assert "Please allow camera access." verbatim for ID Verification, so
 * changing that string would be a guide-breaking copy change (and the library-permission
 * branch is unreachable on Android 13+ anyway — see MSG-TC-A10).
 */
export const PHOTO_TAKE_FAILED_COPY =
  'Failed to take photo. Please try again, or upload a photo from your library.';

export const PHOTO_PICK_FAILED_COPY =
  'Failed to pick image. Please try again, or use the camera.';

/**
 * FIX-Task-66 item 6 (2026-09-18): shown on a LOCKED badge's detail modal IN ADDITION
 * to the badge's requirement text.
 *
 * Guide MSG-TC-B02 expects "a locked one shows a lock icon and encouragement to keep
 * going". Previously this string was only a fallback used when the badge had no
 * description, so a locked badge with a requirement (e.g. "Completed 50 trades")
 * showed no encouragement at all.
 */
export const LOCKED_BADGE_ENCOURAGEMENT = 'Keep going to unlock this badge!';
