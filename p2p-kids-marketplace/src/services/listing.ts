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
    condition,
    accepts_swap_points,
  } = input;

  // Validate price
  if (price <= 0) {
    throw new Error('Price must be greater than $0');
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

  // Create listing in database
  const { data, error } = await supabase
    .from('items')
    .insert({
      seller_id,
      title,
      description,
      price, // DB stores as DECIMAL, not cents
      category_id,
      condition,
      status: 'available', // New listings are immediately active
      accepts_swap_points,
      seller_subscription_status_at_creation: sellerSubStatus, // V2: Audit trail
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[listing] createListing error:', error);
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

  return data as Listing;
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
    .in('status', ['pending', 'payment_processing', 'in_progress']);

  if (activeTrades && activeTrades.length > 0) {
    throw new Error('Cannot edit listing with active trades');
  }
  */

  // If updating accepts_swap_points, re-validate subscription
  if (updates.accepts_swap_points !== undefined) {
    const sub = await getSubscriptionSummary(user_id);
    if (updates.accepts_swap_points && !sub.can_spend_sp) {
      throw new Error('Only Kids Club+ subscribers can accept Swap Points');
    }
  }

  // Validate price if being updated
  if (updates.price !== undefined && updates.price <= 0) {
    throw new Error('Price must be greater than $0');
  }

  // Update listing (updated_at is set by DB trigger)
  const { data, error } = await supabase
    .from('items')
    .update(updates)
    .eq('id', listing_id)
    .select()
    .single();

  if (error) {
    console.error('[listing] updateListing error:', error);
    throw new Error(`Failed to update listing: ${error.message}`);
  }

  // Track analytics event
  await trackEvent('listing_updated', {
    listing_id,
    fields_updated: Object.keys(updates),
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
    console.error('[listing] deleteListing error:', error);
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
  let query = supabase
    .from('items')
    .select('*')
    .eq('status', 'available') // Only show active listings
    .order('created_at', { ascending: false });

  // Category filter
  if (filters.category_id) {
    query = query.eq('category_id', filters.category_id);
  }

  // Price range filter
  if (filters.min_price !== undefined) {
    query = query.gte('price', filters.min_price);
  }

  if (filters.max_price !== undefined) {
    query = query.lte('price', filters.max_price);
  }

  // Condition filter
  if (filters.condition) {
    query = query.eq('condition', filters.condition);
  }

  // V2: SP eligibility filter
  if (filters.sp_eligible_only) {
    query = query.eq('accepts_swap_points', true);
  }

  // Text search (if supported by DB)
  if (filters.search_query) {
    // Using ilike for case-insensitive search
    query = query.or(`title.ilike.%${filters.search_query}%,description.ilike.%${filters.search_query}%`);
  }

  const { data: items, error } = await query;

  if (error) {
    console.error('[listing] fetchListings error:', error);
    throw new Error(`Failed to fetch listings: ${error.message}`);
  }

  if (!items || items.length === 0) {
    return [];
  }

  // Fetch all related data in parallel for performance
  const categoryIds = [...new Set(items.filter((i: any) => i.category_id).map((i: any) => i.category_id))];
  const sellerIds = [...new Set(items.map((i: any) => i.seller_id))];

  const [categoriesData, sellersData] = await Promise.all([
    categoryIds.length > 0 
      ? supabase
          .from('categories')
          .select('*')
          .in('id', categoryIds)
      : Promise.resolve({ data: [] }),
    sellerIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', sellerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const categoriesMap = new Map(
    (categoriesData.data || []).map((c: any) => [c.id, c])
  );
  const sellersMap = new Map(
    (sellersData.data || []).map((s: any) => [s.id, s])
  );

  // Combine data and return as Listing[]
  return items.map((item: any) => ({
    ...item,
    category: categoriesMap.get(item.category_id) || null,
    seller: sellersMap.get(item.seller_id) || null,
    images: [],
  } as Listing));
}

/**
 * Fetch a single listing by ID
 * 
 * @param listing_id - Listing ID
 * @returns Listing object with related data
 */
export async function getListingById(listing_id: string): Promise<Listing | null> {
  try {
    // First, fetch the item without relationship expansion to avoid PostgREST cache issues
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('*')
      .eq('id', listing_id)
      .single();

    if (itemError) {
      console.error('[listing] getListingById item error:', itemError);
      return null;
    }

    if (!item) {
      console.error('[listing] getListingById: item not found');
      return null;
    }

    console.log('[listing] 📋 Item found:', { id: item.id, title: item.title, seller_id: item.seller_id, category_id: item.category_id });

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
          console.warn('[listing] ⚠️ Category fetch error:', catError);
        } else {
          category = categoryData;
          console.log('[listing] ✅ Category fetched:', categoryData);
        }
      } catch (err) {
        console.error('[listing] ❌ Category fetch exception:', err);
      }
    }

    // Fetch seller separately with better error handling
    // NOTE: Use a public/unrestricted approach to get seller public profiles
    // since any user should be able to see who's selling an item
    let seller = null;
    if (item.seller_id) {
      try {
        // Try fetching with regular client first (respects RLS for privacy)
        const { data: sellerData, error: sellerError } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .eq('id', item.seller_id)
          .single();
        
        // If RLS blocks it, try with a more permissive approach
        if (sellerError?.code === 'PGRST116' || sellerError?.message?.includes('0 rows')) {
          console.warn('[listing] ⚠️ RLS blocking profile fetch, using fallback query...');
          
          // Query profiles table directly as a workaround for RLS issues
          // This fetches only the public profile info needed for listing display
          const { data: profiles, error: fallbackError } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .eq('id', item.seller_id);
          
          if (!fallbackError && profiles && profiles.length > 0) {
            sellerData = profiles[0];
            console.log('[listing] ✅ Seller fetched via fallback:', sellerData);
          } else {
            console.warn('[listing] ⚠️ Fallback also failed:', fallbackError);
          }
        } else if (sellerError) {
          console.warn('[listing] ⚠️ Seller fetch error:', sellerError);
        } else {
          console.log('[listing] ✅ Seller fetched:', sellerData);
        }
        
        seller = sellerData;
      } catch (err) {
        console.error('[listing] ❌ Seller fetch exception:', err);
      }
    }

    // Fetch images separately
    const { data: images = [] } = await supabase
      .from('item_images')
      .select('*')
      .eq('item_id', listing_id);

    // Combine all data into listing object
    const listing: Listing = {
      ...item,
      category,
      seller,
      images,
    } as Listing;

    console.log('[listing] 📦 Complete listing object:', { 
      id: listing.id, 
      title: listing.title,
      hasSeller: !!seller,
      hasCategory: !!category,
      hasImages: images.length > 0
    });

    return listing;
  } catch (err) {
    console.error('[listing] ❌ getListingById fatal error:', err);
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
    console.error('[listing] getMyListings error:', error);
    throw new Error(`Failed to fetch your listings: ${error.message}`);
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
    console.error('[listing] getListingSummary error:', error);
    throw new Error(`Failed to fetch listing summary: ${error.message}`);
  }

  const active = data.filter((l) => l.status === 'available').length;
  const sold = data.filter((l) => l.status === 'sold').length;
  const earnings = data
    .filter((l) => l.status === 'sold' && l.sold_at)
    .reduce((sum, l) => sum + l.price, 0);

  return {
    total_active: active,
    total_sold: sold,
    total_earnings_dollars: earnings,
  };
}
