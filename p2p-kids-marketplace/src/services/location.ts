/**
 * File: p2p-kids-marketplace/src/services/location.ts
 * NODE-003: Automatic Node Assignment on Signup
 * 
 * Handles:
 * - ZIP code to coordinates lookup (Zippopotam API)
 * - Automatic node assignment (exact ZIP or nearest active)
 * - Node member count tracking via RPC
 * - Analytics event tracking
 * - Error handling & Sentry reporting
 */

import { supabase } from './supabase';
import { trackEvent } from './analytics';

/**
 * Result of node assignment during signup
 */
export type NodeAssignmentResult = {
  nodeId: string;
  nodeName: string;
  nodeZipCode: string | null;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  distanceMiles: number | null; // null when exact ZIP match
  matchType: 'zip' | 'nearest'; // 'zip' = active in same ZIP, 'nearest' = fallback
};

/**
 * ZIP code coordinates response from Zippopotam API
 */
type ZipCodeResponse = {
  country: string;
  places: {
    latitude: string;
    longitude: string;
    place_name: string;
    state: string;
  }[];
  'post code': string;
};

/**
 * Assign user to node based on their ZIP code during signup/profile creation
 * 
 * Logic:
 * 1. If ZIP has active node → assign to that node (exact match)
 * 2. If ZIP is NOT active → assign to nearest active node (fallback)
 * 3. If no active nodes exist → throw error (user offered waitlist)
 * 
 * @param zipCode - 5-digit US ZIP code (e.g., "06850")
 * @param userId - Optional user ID for tracking
 * @returns NodeAssignmentResult with node details and match type
 * @throws Error if ZIP invalid, no active nodes exist, or API fails
 */
export const assignNodeByZipCode = async (
  zipCode: string,
  userId?: string
): Promise<NodeAssignmentResult> => {
  try {
    // Validate ZIP format
    if (!/^\d{5}$/.test(zipCode)) {
      throw new Error('Invalid ZIP code format. Must be 5 digits.');
    }

    // Step 1: Get coordinates from ZIP code
    const coordinates = await getZipCodeCoordinates(zipCode);
    if (!coordinates) {
      throw new Error(
        'Invalid ZIP code or unable to lookup coordinates. Please check your ZIP code and try again.'
      );
    }

    const { latitude, longitude } = coordinates;


    // Step 2: Call RPC to find best active node (exact match or nearest)
    const { data, error } = await supabase.rpc('resolve_active_node_for_signup', {
      requested_zip: zipCode,
      user_lat: latitude,
      user_lng: longitude,
    });

    if (error) {
      console.error('❌ resolve_active_node_for_signup error:', error);
      throw error;
    }

    // If no active nodes found anywhere, offer waitlist
    if (!data || data.length === 0) {
      const message =
        'We are not currently active in your area yet. Would you like to join our waitlist?';
      console.warn('⚠️ No active nodes available for ZIP:', zipCode);
      throw new Error(message);
    }

    const row = data[0];
    const distanceKm: number | null = row.distance_km ?? null;
    const distanceMiles = distanceKm === null ? null : distanceKm * 0.621371;


    // Step 3: Warn if fallback node is far (>50 miles)
    if (distanceMiles !== null && distanceMiles > 50) {
      console.warn('⚠️ Distance warning: user >50 miles from assigned node', {
        distanceMiles,
        nodeId: row.id,
        zipCode,
      });
    }

    const result: NodeAssignmentResult = {
      nodeId: row.id,
      nodeName: row.name,
      nodeZipCode: row.zip_code,
      city: row.city,
      state: row.state,
      latitude: row.latitude,
      longitude: row.longitude,
      distanceMiles,
      matchType: row.match_type,
    };

    // Step 4: Track analytics event
    if (userId) {
      trackEvent('node_assigned', {
        user_id: userId,
        node_id: result.nodeId,
        node_name: result.nodeName,
        match_type: result.matchType,
        zip_code: zipCode,
        distance_miles: result.distanceMiles ?? 0,
      });
    }

    return result;
  } catch (error: any) {
    console.error('❌ assignNodeByZipCode error:', error);
    throw error;
  }
};

/**
 * Convert ZIP code to latitude/longitude using Zippopotam API
 * Handles US ZIP codes only.
 * 
 * @param zipCode - 5-digit ZIP code
 * @returns Object with latitude and longitude, or null if lookup fails
 */
export const getZipCodeCoordinates = async (
  zipCode: string
): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);

    if (!response.ok) {
      console.warn(`⚠️ ZIP code lookup failed with status ${response.status}:`, zipCode);
      return null;
    }

    const data: ZipCodeResponse = await response.json();

    if (!data.places || data.places.length === 0) {
      console.warn('⚠️ No places found for ZIP code:', zipCode);
      return null;
    }

    // Use first place (usually the most central)
    const place = data.places[0];
    return {
      latitude: parseFloat(place.latitude),
      longitude: parseFloat(place.longitude),
    };
  } catch (error) {
    console.error('❌ ZIP code lookup error:', error);
    return null;
  }
};

/**
 * Increment node member count after user assignment
 * Uses RPC for atomic operation
 * 
 * @param nodeId - Geographic node UUID
 */
export const incrementNodeMemberCount = async (nodeId: string): Promise<void> => {
  try {
    if (!nodeId) {
      console.warn('⚠️ incrementNodeMemberCount called with null nodeId');
      return;
    }
    const { error } = await supabase.rpc('increment_node_member_count', {
      node_id: nodeId,
    });
    if (error) {
      // Check if this is a "no rows updated" scenario (valid, just didn't find node)
      if (error.message?.includes('no rows') || error.message?.includes('not found')) {
        console.warn('⚠️ Node not found for increment:', nodeId);
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error('❌ Increment node member count error:', error);
    // Don't throw - this is non-critical for signup flow
  }
};

/**
 * Decrement node member count (e.g., when user deletes profile or changes nodes)
 * Uses RPC for atomic operation
 * 
 * @param nodeId - Geographic node UUID
 */
export const decrementNodeMemberCount = async (nodeId: string): Promise<void> => {
  try {
    if (!nodeId) {
      console.warn('⚠️ decrementNodeMemberCount called with null nodeId');
      return;
    }
    const { error } = await supabase.rpc('decrement_node_member_count', {
      node_id: nodeId,
    });
    if (error) {
      // Check if this is a "no rows updated" scenario (valid, just didn't find node)
      if (error.message?.includes('no rows') || error.message?.includes('not found')) {
        console.warn('⚠️ Node not found for decrement:', nodeId);
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error('❌ Decrement node member count error:', error);
    // Don't throw - this is non-critical
  }
};

/**
 * Check if a specific ZIP code has an active node
 * Used to determine if waitlist popup should be shown
 * 
 * @param zipCode - ZIP code to check
 * @returns true if active node exists for this ZIP
 */
export const checkZipCodeHasActiveNode = async (zipCode: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('nodes')
      .select('id')
      .eq('zip_code', zipCode)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.warn('⚠️ checkZipCodeHasActiveNode error:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('❌ checkZipCodeHasActiveNode error:', error);
    return false;
  }
};

/**
 * NODE-007: Get user's preferred search radius (or default)
 * 
 * @param userId - User ID
 * @returns Preferred radius in miles, or 10 as default
 */
export const getUserPreferredRadius = async (userId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('preferred_radius_miles')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('⚠️ getUserPreferredRadius error:', error);
      return 10; // Default radius
    }

    return data?.preferred_radius_miles ?? 10;
  } catch (error) {
    console.error('❌ getUserPreferredRadius error:', error);
    return 10;
  }
};

/**
 * NODE-007: Save user's preferred search radius
 * Creates or updates user_preferences row
 * 
 * @param userId - User ID
 * @param radiusMiles - Radius in miles
 */
export const saveUserPreferredRadius = async (
  userId: string,
  radiusMiles: number
): Promise<void> => {
  try {
    if (!userId || radiusMiles < 0) {
      throw new Error('Invalid userId or radiusMiles');
    }

    // Use upsert with explicit onConflict to handle duplicate key gracefully
    const { error } = await supabase.from('user_preferences').upsert(
      {
        user_id: userId,
        preferred_radius_miles: radiusMiles,
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      // If still getting constraint error, use update instead
      if (error.code === '23505') {
        console.warn('⚠️ Duplicate key detected, updating existing preference...');
        const { error: updateError } = await supabase
          .from('user_preferences')
          .update({ preferred_radius_miles: radiusMiles })
          .eq('user_id', userId);
        if (updateError) throw updateError;
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ saveUserPreferredRadius error:', error);
    throw error;
  }
};

/**
 * NODE-007: Calculate distance between two nodes using PostGIS
 * Returns distance in miles
 * 
 * @param node1Id - First node UUID
 * @param node2Id - Second node UUID
 * @returns Distance in miles, or null if calculation fails
 */
export const calculateDistanceBetweenNodes = async (
  node1Id: string,
  node2Id: string
): Promise<number | null> => {
  try {
    if (node1Id === node2Id) {
      return 0;
    }

    const { data, error } = await supabase.rpc('calculate_node_distance', {
      node1_id: node1Id,
      node2_id: node2Id,
    });

    if (error) {
      console.warn(
        `⚠️ Distance calculation error between ${node1Id} and ${node2Id}:`,
        error
      );
      return null;
    }

    return data as number | null;
  } catch (error) {
    console.error('❌ calculateDistanceBetweenNodes error:', error);
    return null;
  }
};
