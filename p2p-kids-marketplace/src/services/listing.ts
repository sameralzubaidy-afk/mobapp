/**
 * File: p2p-kids-marketplace/src/services/listing.ts
 * MODULE-04 LISTING-V2: Service functions for item listing management
 *
 * Implements:
 * - LISTING-V2-002: Create listing with SP payment preference
 * - LISTING-V2-003: Edit and delete listing with V2 rules
 * - LISTING-V2-004: Browse and filter SP-eligible listings
 */

import { supabase } from '../config/supabase';
import { getSubscriptionSummary, getSubscriptionStatusString } from './subscription';
import {
  Listing,
  CreateListingInput,
  UpdateListingInput,
  ListingFilters,
  ListingSummary,
} from '../types/listing';
import { trackEvent } from './analytics';
import { getAdminConfig } from './adminConfig';
import { uploadImage, deleteImage } from './supabase/storage';
import { checkItemSafety, isCpscCheckEnabled } from './safety';
import { isImageModerationEnabled, moderateListingImages } from './imageModeration';

export interface ListingImageDraft {
  id?: string;
  uri: string;
}

const DEFAULT_MODERATION_APPEAL_MAX_ATTEMPTS = 3;
const DEFAULT_MODERATION_APPEAL_WINDOW_DAYS = 14;

const toPositiveInteger = (rawValue: unknown, fallbackValue: number): number => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }

  const integerValue = Math.floor(parsed);
  if (integerValue <= 0) {
    return fallbackValue;
  }

  return integerValue;
};

const isSchemaDriftForEditedTracking = (
  error: { code?: string; message?: string } | null
): boolean => {
  if (!error) {
    return false;
  }

  const message = (error.message ?? '').toLowerCase();
  if (error.code !== 'PGRST204') {
    return false;
  }

  return (
    message.includes('edited_since_rejection') || message.includes('edited_since_rejection_at')
  );
};

const isSchemaDriftForRequestedCategoryName = (
  error: { code?: string; message?: string } | null
): boolean => {
  if (!error) {
    return false;
  }

  if (error.code !== 'PGRST204') {
    return false;
  }

  const message = (error.message ?? '').toLowerCase();
  return message.includes('requested_category_name');
};

const wasEditedAfterRejection = (
  rejectedAt: string | null | undefined,
  updatedAt: string | null | undefined
): boolean => {
  if (!rejectedAt || !updatedAt) {
    return false;
  }

  const rejectedAtMs = Date.parse(rejectedAt);
  const updatedAtMs = Date.parse(updatedAt);
  if (!Number.isFinite(rejectedAtMs) || !Number.isFinite(updatedAtMs)) {
    return false;
  }

  return updatedAtMs > rejectedAtMs;
};

const wasEditedAfterReference = (
  referenceAt: string | null | undefined,
  updatedAt: string | null | undefined
): boolean => {
  if (!referenceAt || !updatedAt) {
    return false;
  }

  const referenceAtMs = Date.parse(referenceAt);
  const updatedAtMs = Date.parse(updatedAt);
  if (!Number.isFinite(referenceAtMs) || !Number.isFinite(updatedAtMs)) {
    return false;
  }

  return updatedAtMs > referenceAtMs;
};

const isRlsPolicyError = (message: string | undefined): boolean => {
  const lower = (message ?? '').toLowerCase();
  return (
    lower.includes('row-level security policy') || lower.includes('violates row-level security')
  );
};

const isLocalImageUri = (uri: string): boolean => {
  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library://') ||
    uri.startsWith('data:image/')
  );
};

const extractStorageObjectPath = (publicUrl: string): string | null => {
  const marker = '/item-images/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) {
    return null;
  }

  return publicUrl.substring(idx + marker.length);
};

const uploadListingImageWithFallback = async (
  listingId: string,
  sellerId: string,
  imageUri: string,
  index: number,
  total: number
): Promise<{ publicUrl: string; storagePath: string }> => {
  const fileName = `${index}.jpg`;
  const preferredStoragePath = `${sellerId}/${listingId}/${fileName}`;
  const legacyStoragePath = `${listingId}/${fileName}`;
  let storagePathUsed = preferredStoragePath;

  console.log(`[listing] 📤 Uploading image ${index + 1}/${total}:`);
  console.log(`[listing]    URI: ${imageUri.substring(0, 80)}...`);
  console.log(`[listing]    Preferred path: item-images/${preferredStoragePath}`);

  let uploadResult = await uploadImage('item-images', preferredStoragePath, imageUri, {
    upsert: true,
  });

  // Backward compatibility for environments still using legacy item-images RLS path checks.
  if (uploadResult.error && isRlsPolicyError(uploadResult.error.message)) {
    console.warn('[listing] ⚠️ Preferred storage path denied by RLS, trying legacy path format');
    console.warn(`[listing]    Legacy path: item-images/${legacyStoragePath}`);
    storagePathUsed = legacyStoragePath;
    uploadResult = await uploadImage('item-images', legacyStoragePath, imageUri, { upsert: true });
  }

  if (uploadResult.error) {
    console.error(`[listing] ❌ Failed to upload image ${index}:`, uploadResult.error);
    console.error(`[listing]    Error type: ${uploadResult.error.name}`);
    console.error(`[listing]    Error message: ${uploadResult.error.message}`);
    throw new Error(`Failed to upload image ${index + 1}: ${uploadResult.error.message}`);
  }

  if (!uploadResult.url) {
    throw new Error(`Failed to get public URL for image ${index + 1}`);
  }

  return {
    publicUrl: uploadResult.url,
    storagePath: storagePathUsed,
  };
};

/**
 * LISTING-V2-002: Create a new listing with SP payment preference
 *
 * V2 Rules:
 * 1. Only subscribers (trial/active) can enable accepts_swap_points
 * 2. Price must be > 0
 * 3. Captures seller subscription status for audit trail
 *
 * @param input - Listing creation data
 * @returns Created listing object
 * @throws Error if validation fails or user is not authorized
 */
export async function createListing(input: CreateListingInput): Promise<Listing> {
  const {
    seller_id,
    title,
    description,
    price,
    category_id,
    requested_category_name,
    condition,
    accepts_swap_points,
    brand,
    color,
    age_group,
    gender,
  } = input;

  // Validate price
  if (price <= 0) {
    throw new Error('Price must be greater than $0');
  }

  // Validate against admin-configurable minimum listing price floor
  // forceRefresh=true to bypass 5-min cache — admin change must take effect immediately
  const adminConfig = await getAdminConfig(true);
  const mlp = adminConfig.min_listing_price;
  // Defensive parse: ensure numeric even if data_type is missing from DB row
  const effectiveMinPrice = typeof mlp === 'number' && Number.isFinite(mlp) ? mlp : Number(mlp) || 0;
  console.log('[createListing] min_listing_price check:', {
    price,
    min_listing_price: mlp,
    effectiveMinPrice,
    typeof: typeof mlp,
  });
  if (effectiveMinPrice > 0 && price < effectiveMinPrice) {
    throw new Error(
      `Price must be at least $${effectiveMinPrice.toFixed(2)} to be listed`
    );
  }

  // Validate title length
  if (title.length < 3 || title.length > 100) {
    throw new Error('Title must be between 3 and 100 characters');
  }

  // Check seller subscription status (MODULE-11 dependency)
  const subscriptionSummary = await getSubscriptionSummary(seller_id);

  // V2 Rule: Only subscribers (trial/active) can enable SP payment
  if (accepts_swap_points && !subscriptionSummary.can_spend_sp) {
    throw new Error(
      'Only Kids Club+ subscribers can accept Swap Points. Please subscribe to enable this option.'
    );
  }

  // Capture seller subscription status for audit trail
  const sellerSubStatus = await getSubscriptionStatusString(seller_id);

  // Starter Pack eligibility check (metadata only)
  // Listing creation is always 'pending' and requires admin review.
  let isEligibleForStarterPack = false;
  let eligibilityError: Error | null = null;

  try {
    const rpcResult = await supabase.rpc('is_eligible_for_starter_pack', {
      p_seller_id: seller_id,
    });

    isEligibleForStarterPack = Boolean(rpcResult?.data);
    eligibilityError = rpcResult?.error ?? null;
  } catch (error) {
    console.warn('[listing] ⚠️ is_eligible_for_starter_pack RPC threw an exception:', error);
  }

  if (eligibilityError) {
    console.warn('[listing] ⚠️ is_eligible_for_starter_pack RPC failed:', eligibilityError);
  }

  // Create listing in database
  const normalizedRequestedCategoryName =
    requested_category_name && requested_category_name.trim().length > 0
      ? requested_category_name.trim()
      : null;
  const normalizedBrand = brand && brand.trim().length > 0 ? brand.trim() : null;
  const normalizedColor = color && color.length > 0 ? color : null;

  const { data, error } = await supabase
    .from('items')
    .insert({
      seller_id,
      title,
      description,
      price, // DB stores as DECIMAL, not cents
      category_id,
      requested_category_name: normalizedRequestedCategoryName,
      condition,
      brand: normalizedBrand,
      color: normalizedColor,
      age_group: age_group || null,
      gender: gender || null,
      status: 'pending',
      accepts_swap_points,
      seller_subscription_status_at_creation: sellerSubStatus, // V2: Audit trail
      eligible_for_starter_pack: Boolean(isEligibleForStarterPack),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    const err = error as Error;
    console.error('[listing] createListing error:', err.message);
    throw new Error(`Failed to create listing: ${error.message}`);
  }

  // Track analytics event
  await trackEvent('listing_created', {
    listing_id: data.id,
    accepts_swap_points,
    price,
    category_id: category_id || 'none',
    seller_subscription_status: sellerSubStatus,
  });

  // MODULE-13 SAFETY-002: Check item against CPSC recalls
  // This runs async and may flag the item after creation
  // We don't block listing creation, but the item may be flagged shortly after
  const cpscEnabled = await isCpscCheckEnabled();
  if (cpscEnabled) {
    console.log(`[listing] 🔍 Initiating CPSC safety check for listing ${data.id}`);

    // Fire-and-forget safety check (don't block return)
    checkItemSafety(data.id, title, description || undefined)
      .then((result) => {
        if (result.flagged) {
          console.warn(
            `[listing] ⚠️ Listing ${data.id} flagged for CPSC recall match:`,
            result.reason
          );
          console.warn(
            `[listing] Match: ${result.match?.product_name} (confidence: ${result.confidence})`
          );
        } else {
          console.log(`[listing] ✅ Listing ${data.id} passed CPSC safety check`);
        }
      })
      .catch((error) => {
        console.error(`[listing] ❌ CPSC safety check failed for listing ${data.id}:`, error);
        // Don't throw - safety check failure shouldn't prevent listing creation
      });
  } else {
    console.log('[listing] CPSC recall checking is disabled via admin config');
  }

  return data as Listing;
}

/**
 * SAFETY-P002: Upload images for a listing
 *
 * Rules:
 * 1. Upload to item-images/{seller_id}/{listing_id}/{index}.jpg
 * 2. Insert rows into item_images table with public URLs
 * 3. First image (index 0) is the primary/cover image
 * 4. Support up to 10 images per listing
 *
 * @param listing_id - The listing ID to attach images to
 * @param seller_id - The seller user ID (for storage path)
 * @param imageUris - Array of local image URIs to upload
 * @returns Array of uploaded image URLs with display_order
 * @throws Error if upload fails
 */
export async function uploadListingImages(
  listing_id: string,
  seller_id: string,
  imageUris: string[]
): Promise<{ url: string; display_order: number }[]> {
  if (imageUris.length === 0) {
    return [];
  }

  if (imageUris.length > 10) {
    throw new Error('Maximum 10 images allowed per listing');
  }

  const uploadedImages: { url: string; display_order: number }[] = [];

  try {
    console.log(
      `[listing] 📤 Starting upload of ${imageUris.length} images for listing ${listing_id}`
    );

    // Upload each image to storage
    for (let i = 0; i < imageUris.length; i++) {
      const imageUri = imageUris[i];

      // Resumed drafts can already contain uploaded public URLs. Reuse them directly
      // instead of re-uploading as local files.
      if (!isLocalImageUri(imageUri)) {
        const { error: insertRemoteError } = await supabase
          .from('item_images')
          .insert({
            item_id: listing_id,
            url: imageUri,
            thumbnail_url: imageUri,
            display_order: i,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertRemoteError) {
          console.error(
            `[listing] ❌ Failed to insert remote image ${i} into DB:`,
            insertRemoteError
          );
          throw new Error(`Failed to save image ${i + 1} reference: ${insertRemoteError.message}`);
        }

        uploadedImages.push({
          url: imageUri,
          display_order: i,
        });

        console.log(`[listing] ✅ Reused existing remote image ${i + 1}/${imageUris.length}`);
        continue;
      }

      const upload = await uploadListingImageWithFallback(
        listing_id,
        seller_id,
        imageUri,
        i,
        imageUris.length
      );

      // Insert into item_images table
      const { error: insertError } = await supabase
        .from('item_images')
        .insert({
          item_id: listing_id,
          url: upload.publicUrl,
          thumbnail_url: upload.publicUrl, // TODO: Generate actual thumbnails in future
          display_order: i,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[listing] ❌ Failed to insert image ${i} into DB:`, insertError);
        // Try to clean up uploaded file
        await deleteImage('item-images', upload.storagePath);
        throw new Error(`Failed to save image ${i + 1} reference: ${insertError.message}`);
      }

      uploadedImages.push({
        url: upload.publicUrl,
        display_order: i,
      });

      console.log(`[listing] ✅ Image ${i + 1} uploaded successfully`);
    }

    console.log(`[listing] ✅ All ${uploadedImages.length} images uploaded successfully`);

    // MODULE-13 SAFETY-004: Moderate images with Google Vision AI
    // Run moderation async - don't block the return (fire-and-forget)
    // If images are flagged, the item status will be updated to 'flagged' by the Edge Function
    if (uploadedImages.length > 0) {
      const aiModerationEnabled = await isImageModerationEnabled();

      if (!aiModerationEnabled) {
        console.log(
          `[listing] ⏭️ AI image moderation is disabled by admin config for listing ${listing_id}`
        );
      } else {
        console.log(`[listing] 🔍 Initiating AI image moderation for listing ${listing_id}`);
        const imageUrls = uploadedImages.map((img) => img.url);

        moderateListingImages(listing_id, imageUrls)
          .then((results) => {
            const flaggedCount = results.filter((r) => r.flagged).length;
            if (flaggedCount > 0) {
              console.warn(
                `[listing] ⚠️ ${flaggedCount}/${results.length} images flagged for listing ${listing_id}`
              );
            } else {
              console.log(
                `[listing] ✅ All ${results.length} images passed AI moderation for listing ${listing_id}`
              );
            }
          })
          .catch((error) => {
            console.error(`[listing] ❌ AI moderation failed for listing ${listing_id}:`, error);
            // Don't throw - moderation failure shouldn't prevent listing creation
          });
      }
    }

    return uploadedImages;
  } catch (error) {
    console.error('[listing] ❌ uploadListingImages error:', error);
    throw error;
  }
}

/**
 * Sync listing images during edit flow.
 * Supports adding new photos, removing existing photos, and reordering all photos.
 */
export async function syncListingImages(
  listing_id: string,
  seller_id: string,
  images: ListingImageDraft[]
): Promise<void> {
  if (images.length > 10) {
    throw new Error('Maximum 10 images allowed per listing');
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('item_images')
    .select('id, url, display_order')
    .eq('item_id', listing_id)
    .order('display_order', { ascending: true });

  if (existingError) {
    throw new Error(`Failed to load listing images: ${existingError.message}`);
  }

  const currentRows = (existingRows ?? []) as { id: string; url: string; display_order: number }[];
  const existingById = new Map(currentRows.map((row) => [row.id, row]));
  const finalExistingIds = new Set(images.filter((img) => img.id).map((img) => img.id as string));
  let hasImageChanges = false;

  // Delete images removed by user.
  const rowsToDelete = currentRows.filter((row) => !finalExistingIds.has(row.id));
  if (rowsToDelete.length > 0) {
    hasImageChanges = true;
    for (const row of rowsToDelete) {
      const storagePath = extractStorageObjectPath(row.url);
      if (storagePath) {
        await deleteImage('item-images', storagePath);
      }
    }

    const idsToDelete = rowsToDelete.map((row) => row.id);
    const { error: deleteRowsError } = await supabase
      .from('item_images')
      .delete()
      .in('id', idsToDelete);

    if (deleteRowsError) {
      throw new Error(`Failed to remove old listing images: ${deleteRowsError.message}`);
    }
  }

  // Apply final order and upload any new local files.
  for (let i = 0; i < images.length; i++) {
    const image = images[i];

    if (image.id && existingById.has(image.id)) {
      const existing = existingById.get(image.id);
      if (existing && existing.display_order !== i) {
        hasImageChanges = true;
        const { error: reorderError } = await supabase
          .from('item_images')
          .update({ display_order: i })
          .eq('id', image.id);

        if (reorderError) {
          throw new Error(`Failed to reorder listing images: ${reorderError.message}`);
        }
      }
      continue;
    }

    if (!isLocalImageUri(image.uri)) {
      hasImageChanges = true;
      const { error: insertRemoteError } = await supabase.from('item_images').insert({
        item_id: listing_id,
        url: image.uri,
        thumbnail_url: image.uri,
        display_order: i,
        created_at: new Date().toISOString(),
      });

      if (insertRemoteError) {
        throw new Error(`Failed to save listing image reference: ${insertRemoteError.message}`);
      }
      continue;
    }

    hasImageChanges = true;
    const upload = await uploadListingImageWithFallback(
      listing_id,
      seller_id,
      image.uri,
      i,
      images.length
    );

    const { error: insertError } = await supabase.from('item_images').insert({
      item_id: listing_id,
      url: upload.publicUrl,
      thumbnail_url: upload.publicUrl,
      display_order: i,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      await deleteImage('item-images', upload.storagePath);
      throw new Error(`Failed to save image ${i + 1} reference: ${insertError.message}`);
    }
  }

  if (hasImageChanges) {
    const { error: markEditedError } = await supabase
      .from('items')
      .update({
        edited_since_rejection: true,
        edited_since_rejection_at: new Date().toISOString(),
      })
      .eq('id', listing_id)
      .eq('seller_id', seller_id)
      .in('status', ['rejected', 'needs_edits']);

    if (markEditedError) {
      console.warn(
        '[listing] Unable to mark listing as edited since rejection:',
        markEditedError.message
      );
    }
  }
}

/**
 * LISTING-V2-003: Update an existing listing
 *
 * V2 Rules:
 * 1. Only listing owner can edit
 * 2. Cannot edit listings with active trades (integrity constraint)
 * 3. If updating accepts_swap_points, re-validate seller subscription
 * 4. Updates updated_at timestamp automatically (DB trigger)
 *
 * @param input - Listing update data with user_id for ownership check
 * @returns Updated listing object
 * @throws Error if not authorized or active trades exist
 */
export async function updateListing(input: UpdateListingInput): Promise<Listing> {
  const { listing_id, user_id, ...updates } = input;
  const updatePayload: Record<string, unknown> = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined)
  );

  // Fetch listing to check ownership
  const { data: listing, error: fetchError } = await supabase
    .from('items')
    .select('*')
    .eq('id', listing_id)
    .single();

  if (fetchError || !listing) {
    throw new Error('Listing not found');
  }

  // Verify ownership
  if (listing.seller_id !== user_id) {
    throw new Error('You are not authorized to edit this listing');
  }

  // TODO(MODULE-06): Check for active trades (integrity constraint)
  // For now, commented out since transactions/trades table may not exist yet
  /*
  const { data: activeTrades } = await supabase
    .from('transactions')
    .select('id')
    .eq('listing_id', listing_id)
    .in('status', ['pending', 'in_progress']);

  if (activeTrades && activeTrades.length > 0) {
    throw new Error('Cannot edit listing with active trades');
  }
  */

  // If updating accepts_swap_points, re-validate subscription
  if (typeof updatePayload.accepts_swap_points === 'boolean') {
    const sub = await getSubscriptionSummary(user_id);
    if (updatePayload.accepts_swap_points && !sub.can_spend_sp) {
      throw new Error('Only Kids Club+ subscribers can accept Swap Points');
    }
  }

  // Validate price if being updated
  if (typeof updatePayload.price === 'number') {
    if (updatePayload.price <= 0) {
      throw new Error('Price must be greater than $0');
    }
    // Validate against admin-configurable minimum listing price floor.
    // forceRefresh=true to bypass the 5-min cache — matches the createListing
    // path, so a price edit re-validates against the CURRENT floor (a floor
    // raise is forward-only: it never auto-pauses existing listings, but an
    // active PRICE EDIT must still respect the current minimum — Dev Task 86).
    const adminConfig = await getAdminConfig(true);
    if (
      adminConfig.min_listing_price > 0 &&
      updatePayload.price < adminConfig.min_listing_price
    ) {
      throw new Error(
        `Price must be at least $${adminConfig.min_listing_price.toFixed(2)} to be listed`
      );
    }
  }

  const editableFieldKeys = [
    'title',
    'description',
    'price',
    'category_id',
    'requested_category_name',
    'condition',
    'accepts_swap_points',
    'brand',
    'color',
    'age_group',
    'gender',
  ] as const;

  const hasSellerEdits = editableFieldKeys.some(
    (field) =>
      Object.prototype.hasOwnProperty.call(updatePayload, field) &&
      updatePayload[field] !== listing[field]
  );

  if (hasSellerEdits && listing.status === 'needs_edits') {
    // Align seller edit flow with SAFETY-008: once seller addresses requested edits,
    // move listing back to pending moderation automatically.
    updatePayload.status = 'pending';
    updatePayload.appeal_count = Number(listing.appeal_count ?? 0) + 1;
    updatePayload.edited_since_rejection = false;
    updatePayload.edited_since_rejection_at = null;
  } else if (hasSellerEdits && listing.status === 'rejected') {
    updatePayload.edited_since_rejection = true;
    updatePayload.edited_since_rejection_at = new Date().toISOString();
  } else if (hasSellerEdits && listing.status === 'available') {
    // SAFETY-008 / LISTING-V2-003: Editing an approved listing requires re-approval.
    // Set status to pending so admin must review changes before the listing is visible again.
    updatePayload.status = 'pending';
    updatePayload.approved_at = null;
    updatePayload.approved_by = null;
  }

  const containsEditedTrackingFields =
    Object.prototype.hasOwnProperty.call(updatePayload, 'edited_since_rejection') ||
    Object.prototype.hasOwnProperty.call(updatePayload, 'edited_since_rejection_at');

  const runUpdate = async (payload: Record<string, unknown>) =>
    supabase.from('items').update(payload).eq('id', listing_id).select().single();

  // Update listing (updated_at is set by DB trigger)
  let { data, error } = await runUpdate(updatePayload);

  if (error && containsEditedTrackingFields && isSchemaDriftForEditedTracking(error)) {
    const fallbackPayload = { ...updatePayload };
    delete fallbackPayload.edited_since_rejection;
    delete fallbackPayload.edited_since_rejection_at;
    ({ data, error } = await runUpdate(fallbackPayload));
  }

  if (error && isSchemaDriftForRequestedCategoryName(error)) {
    const fallbackPayload = { ...updatePayload };
    delete fallbackPayload.requested_category_name;
    ({ data, error } = await runUpdate(fallbackPayload));
  }

  if (error) {
    const err = error as Error;
    console.error('[listing] updateListing error:', err.message);
    throw new Error(`Failed to update listing: ${error.message}`);
  }

  // Track analytics event
  await trackEvent('listing_updated', {
    listing_id,
    fields_updated: Object.keys(updatePayload),
  });

  return data as Listing;
}

/**
 * SAFETY-P003: Seller appeal flow for rejected listings
 *
 * Rules:
 * 1. Only listing owner can submit an appeal
 * 2. Listing must currently be in 'rejected' status
 * 3. Appeal requires seller reason text for admin context
 * 4. Appeal transitions listing back to 'flagged' for admin re-review
 */
export async function submitListingAppeal(
  listing_id: string,
  seller_id: string,
  appeal_reason: string
): Promise<Listing> {
  const trimmedAppealReason = appeal_reason.trim();
  if (!trimmedAppealReason) {
    throw new Error('Appeal reason is required');
  }

  if (trimmedAppealReason.length < 10) {
    throw new Error('Appeal reason must be at least 10 characters');
  }

  let { data: listing, error: fetchError } = await supabase
    .from('items')
    .select(
      'id, seller_id, status, appeal_count, appeal_reason, rejected_at, edited_since_rejection, updated_at'
    )
    .eq('id', listing_id)
    .single();

  // Backward-compatibility fallback while migration/schema cache catches up.
  if (fetchError && isSchemaDriftForEditedTracking(fetchError)) {
    const fallbackResult = await supabase
      .from('items')
      .select('id, seller_id, status, appeal_count, appeal_reason, rejected_at, updated_at')
      .eq('id', listing_id)
      .single();

    listing = fallbackResult.data as {
      id: string;
      seller_id: string;
      status: string;
      appeal_count: number | null;
      appeal_reason: string | null;
      rejected_at: string | null;
      updated_at: string | null;
      edited_since_rejection?: boolean;
    } | null;
    fetchError = fallbackResult.error;

    if (!fetchError && listing) {
      listing.edited_since_rejection = wasEditedAfterRejection(
        listing.rejected_at,
        listing.updated_at
      );
    }
  }

  if (fetchError) {
    throw new Error(`Failed to load listing for appeal: ${fetchError.message}`);
  }

  if (!listing) {
    throw new Error('Listing not found');
  }

  if (listing.seller_id !== seller_id) {
    throw new Error('You are not authorized to appeal this listing');
  }

  if (listing.status !== 'rejected') {
    throw new Error('Only rejected listings can be appealed');
  }

  const config = await getAdminConfig(true);
  const maxAppealAttempts = toPositiveInteger(
    config.moderation_appeal_max_attempts,
    DEFAULT_MODERATION_APPEAL_MAX_ATTEMPTS
  );
  const appealWindowDays = toPositiveInteger(
    config.moderation_appeal_window_days,
    DEFAULT_MODERATION_APPEAL_WINDOW_DAYS
  );

  const currentAppealCount = Number(listing.appeal_count ?? 0);
  if (currentAppealCount >= maxAppealAttempts) {
    throw new Error(`Appeal limit reached. Maximum allowed appeals: ${maxAppealAttempts}.`);
  }

  if (!listing.rejected_at) {
    throw new Error('Appeal window cannot be validated for this listing. Please contact support.');
  }

  const rejectedAtMs = Date.parse(listing.rejected_at);
  if (!Number.isFinite(rejectedAtMs)) {
    throw new Error('Appeal window cannot be validated for this listing. Please contact support.');
  }

  const appealDeadlineMs = rejectedAtMs + appealWindowDays * 24 * 60 * 60 * 1000;
  if (Date.now() > appealDeadlineMs) {
    throw new Error(
      `Appeal window has expired. Appeals must be submitted within ${appealWindowDays} days of rejection.`
    );
  }

  const editedSinceRejection =
    listing.edited_since_rejection ??
    wasEditedAfterRejection(listing.rejected_at, listing.updated_at);

  if (!editedSinceRejection) {
    throw new Error('Please edit your listing before submitting an appeal.');
  }

  const { data, error } = await supabase
    .from('items')
    .update({
      status: 'flagged',
      flagged_at: new Date().toISOString(),
      appealed_at: new Date().toISOString(),
      appeal_reason: trimmedAppealReason,
    })
    .eq('id', listing_id)
    .eq('seller_id', seller_id)
    .select()
    .single();

  if (error) {
    const err = error as Error;
    console.error('[listing] submitListingAppeal error:', err.message);
    throw new Error(`Failed to submit appeal: ${error.message}`);
  }

  await trackEvent('listing_appeal_submitted', {
    listing_id,
    seller_id,
    appeal_count: data.appeal_count ?? listing.appeal_count ?? 0,
    appeal_reason_length: trimmedAppealReason.length,
    max_appeal_attempts: maxAppealAttempts,
    appeal_window_days: appealWindowDays,
  });

  return data as Listing;
}

/**
 * SAFETY-008 + SAFETY-P003: Seller resubmission flow for needs_edits listings
 *
 * Rules:
 * 1. Only listing owner can resubmit
 * 2. Listing must currently be in 'needs_edits' status
 * 3. Seller must have made at least one edit since admin request
 * 4. Resubmission transitions listing to 'pending' for standard admin review queue
 */
export async function submitListingNeedsEditsReReview(
  listing_id: string,
  seller_id: string
): Promise<Listing> {
  let { data: listing, error: fetchError } = await supabase
    .from('items')
    .select('id, seller_id, status, appeal_count, edited_since_rejection, rejected_at, updated_at')
    .eq('id', listing_id)
    .single();

  if (fetchError && isSchemaDriftForEditedTracking(fetchError)) {
    const fallbackResult = await supabase
      .from('items')
      .select('id, seller_id, status, rejected_at, flagged_at, created_at, updated_at')
      .eq('id', listing_id)
      .single();

    listing = fallbackResult.data as {
      id: string;
      seller_id: string;
      status: string;
      appeal_count?: number | null;
      rejected_at: string | null;
      flagged_at: string | null;
      created_at: string | null;
      updated_at: string | null;
      edited_since_rejection?: boolean;
    } | null;
    fetchError = fallbackResult.error;

    if (!fetchError && listing) {
      const referenceAt = listing.flagged_at ?? listing.rejected_at ?? listing.created_at;
      listing.edited_since_rejection = wasEditedAfterReference(referenceAt, listing.updated_at);
    }
  }

  if (fetchError) {
    throw new Error(`Failed to load listing for re-review: ${fetchError.message}`);
  }

  if (!listing) {
    throw new Error('Listing not found');
  }

  if (listing.seller_id !== seller_id) {
    throw new Error('You are not authorized to resubmit this listing');
  }

  if (listing.status !== 'needs_edits') {
    throw new Error('Only listings in needs edits status can be resubmitted');
  }

  const editedSinceRejection =
    listing.edited_since_rejection ??
    wasEditedAfterRejection(listing.rejected_at, listing.updated_at);

  if (!editedSinceRejection) {
    throw new Error('Please make at least one edit before submitting for re-review.');
  }

  const runResubmitUpdate = async (payload: Record<string, unknown>) =>
    supabase
      .from('items')
      .update(payload)
      .eq('id', listing_id)
      .eq('seller_id', seller_id)
      .select()
      .single();

  let { data, error } = await runResubmitUpdate({
    status: 'pending',
    appeal_count: Number(listing.appeal_count ?? 0) + 1,
    edited_since_rejection: false,
    edited_since_rejection_at: null,
  });

  if (error && isSchemaDriftForEditedTracking(error)) {
    ({ data, error } = await runResubmitUpdate({
      status: 'pending',
      appeal_count: Number(listing.appeal_count ?? 0) + 1,
    }));
  }

  if (error) {
    const err = error as Error;
    console.error('[listing] submitListingNeedsEditsReReview error:', err.message);
    throw new Error(`Failed to submit for re-review: ${error.message}`);
  }

  // Defensive guard for environments with unexpected server-side status rewrites.
  if (data?.status !== 'pending') {
    const retryResult = await runResubmitUpdate({
      status: 'pending',
      appeal_count: Number(listing.appeal_count ?? 0) + 1,
    });

    if (retryResult.error) {
      const err = retryResult.error as Error;
      console.error('[listing] submitListingNeedsEditsReReview retry error:', err.message);
      throw new Error(`Failed to submit for re-review: ${retryResult.error.message}`);
    }

    data = retryResult.data;
  }

  await trackEvent('listing_resubmitted_for_review', {
    listing_id,
    seller_id,
    previous_status: 'needs_edits',
    next_status: 'pending',
  });

  return data as Listing;
}

/**
 * LISTING-V2-003: Delete a listing (soft delete)
 *
 * V2 Rules:
 * 1. Only listing owner can delete
 * 2. Soft delete: marks status as 'deleted' instead of removing row
 * 3. Preserves audit trail
 *
 * @param listing_id - ID of listing to delete
 * @param user_id - User ID for ownership verification
 * @throws Error if not authorized
 */
export async function deleteListing(listing_id: string, user_id: string): Promise<void> {
  // Fetch listing to check ownership
  const { data: listing, error: fetchError } = await supabase
    .from('items')
    .select('*')
    .eq('id', listing_id)
    .single();

  if (fetchError || !listing) {
    throw new Error('Listing not found');
  }

  // Verify ownership
  if (listing.seller_id !== user_id) {
    throw new Error('You are not authorized to delete this listing');
  }

  // Soft delete (mark as deleted, updated_at set by DB trigger)
  const { error } = await supabase
    .from('items')
    .update({
      status: 'deleted',
    })
    .eq('id', listing_id);

  if (error) {
    const err = error as Error;
    console.error('[listing] deleteListing error:', err.message);
    throw new Error(`Failed to delete listing: ${error.message}`);
  }

  // Track analytics event
  await trackEvent('listing_deleted', {
    listing_id,
  });
}

/**
 * LISTING-V2-004: Fetch listings with filters
 *
 * V2 Features:
 * - Filter by SP eligibility (accepts_swap_points = true)
 * - Filter by category, price range, condition
 * - Search by title/description
 * - Node-based filtering (if node_id provided)
 *
 * @param filters - Filter criteria
 * @returns Array of listings matching filters
 */
export async function fetchListings(filters: ListingFilters = {}): Promise<Listing[]> {
  // Query just the items table without relationship expansion to avoid PostgREST cache issues
  let query: any = supabase.from('items');

  const applyQuery = (method: string, ...args: any[]) => {
    if (!query) {
      return;
    }

    const fn = query[method];
    if (typeof fn === 'function') {
      query = fn.apply(query, args);
    } else {
      console.warn(`[listing] Supabase builder missing ${method}, skipping this clause.`, args);
    }
  };

  applyQuery('eq', 'status', 'available'); // Only show active listings
  applyQuery('order', 'created_at', { ascending: false });

  // Category filter
  if (filters.category_id) {
    applyQuery('eq', 'category_id', filters.category_id);
  }

  // Price range filter
  if (filters.min_price !== undefined) {
    applyQuery('gte', 'price', filters.min_price);
  }

  if (filters.max_price !== undefined) {
    applyQuery('lte', 'price', filters.max_price);
  }

  // Condition filter
  if (filters.condition) {
    applyQuery('eq', 'condition', filters.condition);
  }

  // V2: SP eligibility filter
  if (filters.sp_eligible_only) {
    applyQuery('eq', 'accepts_swap_points', true);
  }

  // Text search (if supported by DB)
  if (filters.search_query) {
    // Using ilike for case-insensitive search
    applyQuery(
      'or',
      `title.ilike.%${filters.search_query}%,description.ilike.%${filters.search_query}%`
    );
  }

  applyQuery('select', '*');
  const { data: items, error } = await query;

  if (error) {
    const err = error as Error;
    console.error('[listing] fetchListings error:', err.message);
    throw new Error(`Failed to fetch listings: ${error.message}`);
  }

  if (!items || items.length === 0) {
    return [];
  }

  // Fetch all related data in parallel for performance
  const categoryIds = [
    ...new Set(
      items
        .filter((i: { category_id: string | null }) => i.category_id)
        .map((i: { category_id: string | null }) => i.category_id as string)
    ),
  ];
  const sellerIds = [...new Set(items.map((i: { seller_id: string }) => i.seller_id))];

  const [categoriesData, sellersData] = await Promise.all([
    categoryIds.length > 0
      ? supabase.from('categories').select('*').in('id', categoryIds)
      : Promise.resolve({ data: [] }),
    sellerIds.length > 0
      ? supabase.from('profiles').select('id, user_id, name, avatar_url').in('user_id', sellerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const categoriesMap = new Map((categoriesData.data || []).map((c: { id: string }) => [c.id, c]));
  const sellersMap = new Map(
    (sellersData.data || []).map((s: { user_id: string }) => [s.user_id, s])
  );

  // Combine data and return as Listing[]
  return items.map(
    (item: Record<string, unknown>) =>
      ({
        ...item,
        category: categoriesMap.get(item.category_id as string) || null,
        seller: sellersMap.get(item.seller_id as string) || null,
        images: [],
      }) as unknown as Listing
  );
}

/**
 * Fetch a single listing by ID
 *
 * @param listing_id - Listing ID
 * @param options.asOwnerUserId - When the caller is this listing's OWNER, allow
 *   loading the listing regardless of status (flagged / rejected / needs_edits)
 *   — used by the Safety Review + Edit Listing flows. The bypass is only honored
 *   when the fetched row's seller_id matches this id, so the general-purpose
 *   strict available-only filter is unchanged for every other caller.
 * @returns Listing object with related data
 */
export async function getListingById(
  listing_id: string,
  options?: { asOwnerUserId?: string }
): Promise<Listing | null> {
  try {
    // First, fetch the item without relationship expansion to avoid PostgREST cache issues
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('*')
      .eq('id', listing_id)
      .maybeSingle();

    if (itemError) {
      console.error('[listing] getListingById item error:', itemError.message);
      console.error('[listing] getListingById item error details:', itemError); // Log full error for debugging
      return null;
    }

    if (!item) {
      console.warn('[listing] getListingById - no item found for id:', listing_id);
      // MODULE-15.5 PROD-004: Fallback to SECURITY DEFINER RPC to bypass node-scoped RLS.
      // The items_select_same_node_or_own policy blocks viewing items from other nodes,
      // but get_recommendations() (SECURITY DEFINER) can return items from any node.
      // This fallback ensures users can view item details from recommendations.
      return getListingByIdFallback(listing_id, options);
    }

    // ⭐ FIX: Don't show items that are no longer available (sold, removed, etc.)
    // DEV-TASK-101: A listing owner may load their OWN non-available (flagged /
    // rejected / needs_edits) listing for the Safety Review / Edit flows. RLS
    // (items_select_available_or_own) already limits the direct read to owner or
    // available rows, so matching seller_id here is belt-and-suspenders and keeps
    // the strict filter for every non-owner caller.
    const isOwnerContext =
      Boolean(options?.asOwnerUserId) && item.seller_id === options?.asOwnerUserId;
    if (item.status !== 'available' && !isOwnerContext) {
      console.log('[listing] getListingById - item not available (status=' + item.status + '), returning null');
      return null;
    }

    console.log('[listing] getListingById fetched item:', item); // Log the fetched item

    // Fetch category separately with better error handling
    let category = null;
    if (item.category_id) {
      try {
        const { data: categoryData, error: catError } = await supabase
          .from('categories')
          .select('*')
          .eq('id', item.category_id)
          .single();

        if (catError) {
          console.warn('[listing] ⚠️ Category fetch error:', catError.message);
        } else {
          category = categoryData;
        }
      } catch (err) {
        const error = err as Error;
        console.error('[listing] ❌ Category fetch exception:', error.message);
      }
    }

    // Fetch seller separately with better error handling
    // NOTE: Use a public/unrestricted approach to get seller public profiles
    // since any user should be able to see who's selling an item
    let seller: { id: string; name: string; avatar_url: string | null } | null = null;
    if (item.seller_id) {
      try {
        // Try fetching with regular client first (respects RLS for privacy)
        const result = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .eq('user_id', item.seller_id)
          .single();

        let sellerData = result.data as {
          id: string;
          name: string;
          avatar_url: string | null;
        } | null;
        const sellerError = result.error;

        // If RLS blocks it, try with a more permissive approach
        if (sellerError?.code === 'PGRST116' || sellerError?.message?.includes('0 rows')) {
          // Query profiles table directly as a workaround for RLS issues
          // This fetches only the public profile info needed for listing display
          const { data: profiles, error: fallbackError } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .eq('user_id', item.seller_id);

          if (!fallbackError && profiles && profiles.length > 0) {
            sellerData = profiles[0] as { id: string; name: string; avatar_url: string | null };
          } else if (fallbackError) {
            console.warn('[listing] ⚠️ Fallback also failed:', fallbackError.message);
          }
        } else if (sellerError) {
          console.warn('[listing] ⚠️ Seller fetch error:', sellerError.message);
        }

        seller = sellerData;
      } catch (err) {
        const error = err as Error;
        console.error('[listing] ❌ Seller fetch exception:', error.message);
      }
    }

    // Fetch images separately
    const { data: images = [] } = await supabase
      .from('item_images')
      .select('*')
      .eq('item_id', listing_id)
      .order('display_order', { ascending: true });

    // Combine all data into listing object
    const listing: Listing = {
      ...item,
      category,
      seller,
      images,
    } as unknown as Listing;

    return listing;
  } catch (err) {
    const error = err as Error;
    console.error('[listing] ❌ getListingById fatal error:', error.message);
    return null;
  }
}

/**
 * Fallback for getListingById when direct query returns null due to RLS.
 * Uses SECURITY DEFINER RPC to bypass node-scoped RLS (items_select_same_node_or_own policy).
 * This is needed because get_recommendations() bypasses RLS and can return items from any node.
 * MODULE-15.5 PROD-004
 */
async function getListingByIdFallback(
  listing_id: string,
  options?: { asOwnerUserId?: string }
): Promise<Listing | null> {
  try {
    console.log('[listing] getListingByIdFallback - trying RPC bypass for id:', listing_id);
    const { data, error } = await supabase.rpc('get_listing_by_id', {
      p_listing_id: listing_id,
    });

    if (error) {
      console.error('[listing] getListingByIdFallback RPC error:', error.message);
      return null;
    }

    if (!data) {
      console.warn('[listing] getListingByIdFallback - no data returned for id:', listing_id);
      return null;
    }

    // Parse the JSONB response into a Listing object
    const listing: Listing = {
      id: data.id,
      seller_id: data.seller_id,
      title: data.title,
      description: data.description,
      price: typeof data.price === 'string' ? parseFloat(data.price) : data.price,
      category_id: data.category_id,
      tax_category_id: data.tax_category_id ?? null,
      condition: data.condition,
      status: data.status,
      accepts_swap_points: data.accepts_swap_points ?? false,
      seller_subscription_status_at_creation: data.seller_subscription_status_at_creation,
      brand: data.brand,
      color: data.color,
      age_group: data.age_group,
      gender: data.gender,
      requested_category_name: data.requested_category_name,
      flagged_at: data.flagged_at,
      flagged_reason: data.flagged_reason,
      rejected_at: data.rejected_at,
      rejection_reason: data.rejection_reason,
      moderation_note: data.moderation_note,
      appeal_count: data.appeal_count ?? 0,
      appeal_reason: data.appeal_reason,
      appealed_at: data.appealed_at,
      edited_since_rejection: data.edited_since_rejection,
      edited_since_rejection_at: data.edited_since_rejection_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
      sold_at: data.sold_at,
      category: data.category,
      seller: data.seller,
      images: data.images ?? [],
    };

    // ⭐ FIX: Don't show items that are no longer available
    // DEV-TASK-101: For an owner-scoped read, permit the owner's own non-available
    // listing. This RPC is SECURITY DEFINER and returns ANY item to an authed user,
    // so an explicit seller_id match is REQUIRED before honoring the bypass —
    // otherwise a non-owner could read another user's flagged/rejected row by id.
    const isOwnerContext =
      Boolean(options?.asOwnerUserId) && data.seller_id === options?.asOwnerUserId;
    if (data.status !== 'available' && !isOwnerContext) {
      console.log('[listing] getListingByIdFallback - item not available (status=' + data.status + '), returning null');
      return null;
    }

    console.log('[listing] getListingByIdFallback - successfully fetched listing:', listing.id);
    return listing;
  } catch (err) {
    const error = err as Error;
    console.error('[listing] ❌ getListingByIdFallback fatal error:', error.message);
    return null;
  }
}

/**
 * Fetch all listings for a specific seller
 * Used by "My Listings" screen
 *
 * @param seller_id - Seller user ID
 * @returns Array of seller's listings (all statuses except deleted)
 */
export async function getMyListings(seller_id: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*, category:categories(*), images:item_images(*)')
    .eq('seller_id', seller_id)
    .neq('status', 'deleted') // Exclude soft-deleted listings
    .order('created_at', { ascending: false });

  if (error) {
    const err = error as Error;
    console.error('[listing] getMyListings error:', err.message);
    throw new Error(`Failed to fetch your listings: ${err.message}`);
  }

  return data as Listing[];
}

/**
 * Get summary stats for a seller's listings
 * Used by "My Listings" screen header
 *
 * @param seller_id - Seller user ID
 * @returns Summary statistics
 */
export async function getListingSummary(seller_id: string): Promise<ListingSummary> {
  const { data, error } = await supabase
    .from('items')
    .select('status, price, sold_at')
    .eq('seller_id', seller_id)
    .neq('status', 'deleted');

  if (error) {
    const err = error as Error;
    console.error('[listing] getListingSummary error:', err.message);
    throw new Error(`Failed to fetch listing summary: ${err.message}`);
  }

  type ItemSummaryRow = { status: string | null; price: number; sold_at: string | null };
  const rows: ItemSummaryRow[] = data || [];
  const active = rows.filter((l: ItemSummaryRow) => l.status === 'available').length;
  const sold = rows.filter((l: ItemSummaryRow) => l.status === 'sold').length;
  const earnings = rows
    .filter((l: ItemSummaryRow) => l.status === 'sold' && l.sold_at)
    .reduce((sum: number, l: ItemSummaryRow) => sum + l.price, 0);

  return {
    total_active: active,
    total_sold: sold,
    total_earnings_dollars: earnings,
  };
}

/**
 * SELLER-GROUP-006: Get approved listings for a specific seller — MASKED.
 *
 * Returns only status='available' items. NEVER includes seller identity fields
 * (name, avatar, email, phone, city, state, ZIP, bio). Safe for buyer-facing
 * "More from this seller" display without revealing seller identity.
 *
 * @param seller_id - Seller user ID (from auth.users)
 * @param exclude_listing_id - Optional listing ID to exclude (the current item)
 * @returns Array of masked listing summaries
 */
export interface MaskedSellerListing {
  id: string;
  title: string;
  price: number;
  condition: string | null;
  category_id: string | null;
  accepts_swap_points: boolean;
  created_at: string;
  image_url: string | null;
}

export async function getMaskedSellerListings(
  seller_id: string,
  exclude_listing_id?: string,
  options?: { limit?: number; offset?: number },
): Promise<{ listings: MaskedSellerListing[]; total_count: number }> {
  let query = supabase
    .from('items')
    .select('id, title, price, condition, category_id, accepts_swap_points, created_at', { count: 'exact' })
    .eq('seller_id', seller_id)
    .eq('status', 'available')
    .order('created_at', { ascending: false });

  if (exclude_listing_id) {
    query = query.neq('id', exclude_listing_id);
  }

  // Optional pagination: when limit+offset are supplied, fetch just that page.
  // `count: 'exact'` still returns the TOTAL matching count (not the page size),
  // so callers can compute "has more" as listings.length < total_count.
  if (options?.limit != null && options?.offset != null) {
    query = query.range(options.offset, options.offset + options.limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[listing] getMaskedSellerListings error:', error.message);
    throw new Error(`Failed to fetch seller listings: ${error.message}`);
  }

  const rows = (data || []) as {
    id: string; title: string; price: number; condition: string | null;
    category_id: string | null; accepts_swap_points: boolean; created_at: string;
  }[];

  // Fetch first image for each listing (batch)
  const listingIds = rows.map((r) => r.id);
  const imageMap: Map<string, string> = new Map();
  if (listingIds.length > 0) {
    const { data: images } = await supabase
      .from('item_images')
      .select('item_id, url')
      .in('item_id', listingIds)
      .order('display_order', { ascending: true });

    for (const img of (images || [])) {
      if (!imageMap.has(img.item_id)) {
        imageMap.set(img.item_id, img.url);
      }
    }
  }

  const listings: MaskedSellerListing[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    price: r.price,
    condition: r.condition,
    category_id: r.category_id,
    accepts_swap_points: r.accepts_swap_points,
    created_at: r.created_at,
    image_url: imageMap.get(r.id) || null,
  }));

  return { listings, total_count: count ?? listings.length };
}
