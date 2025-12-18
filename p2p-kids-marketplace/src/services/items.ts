/**
 * Items Service
 * Handles item queries with node filtering
 * Supports node-based and radius-based filtering for NODE-006
 */

import { supabase } from './supabase/client';
import { trackEvent } from './analytics';
import type {
  Item,
  ItemFilters,
  ItemsQueryResult,
  NearbyNode,
} from '@/types/item.types';

/**
 * Build Supabase query for items
 * Applies filters and returns paginated results
 */
const buildItemsQuery = (filters: ItemFilters) => {
  let query = supabase
    .from('items')
    .select(
      `
      id,
      title,
      description,
      condition,
      status,
      price_cents,
      currency,
      category,
      seller_id,
      node_id,
      accepts_swap_points,
      donate_to_nonprofit,
      is_boosted,
      boost_ends_at,
      images,
      favorites_count,
      seller_reputation_score,
      created_at,
      updated_at
    `,
      { count: 'exact' }
    )
    .eq('status', 'available');

  // Filter by node (default behavior - show only user's node items)
  if (filters.node_id && !filters.include_all_nodes) {
    query = query.eq('node_id', filters.node_id);
  }

  // Category filter
  if (filters.category_id) {
    query = query.eq('category', filters.category_id);
  }

  // Condition filter
  if (filters.condition) {
    query = query.eq('condition', filters.condition);
  }

  // Price range filter
  if (filters.min_price !== undefined) {
    query = query.gte('price_cents', filters.min_price);
  }
  if (filters.max_price !== undefined) {
    query = query.lte('price_cents', filters.max_price);
  }

  // Search query (full-text search on title and description)
  if (filters.search_query && filters.search_query.trim()) {
    const searchTerm = `%${filters.search_query.trim()}%`;
    query = query.or(
      `title.ilike.${searchTerm},description.ilike.${searchTerm}`
    );
  }

  // Payment preference filter (if subscriber-only feature)
  if (filters.accepted_payment === 'accept_swap_points') {
    query = query.eq('accepts_swap_points', true);
  }
  if (filters.accepted_payment === 'donate') {
    query = query.eq('donate_to_nonprofit', true);
  }

  // Sort by created_at (newest first), then by boosted items
  query = query
    .order('is_boosted', { ascending: false })
    .order('created_at', { ascending: false });

  return query;
};

/**
 * Get items with filters (node-based by default)
 * @param filters - Item filter criteria
 * @param userId - Current user ID for analytics
 * @returns Items with pagination info
 * @throws Error if query fails
 */
export const getItems = async (
  filters: ItemFilters,
  userId: string
): Promise<ItemsQueryResult> => {
  try {
    const query = buildItemsQuery(filters);

    const { data, error, count } = await query.limit(20).range(0, 19);

    if (error) {
      console.error('❌ Get items error:', error);
      throw error;
    }

    // Track analytics
    await trackEvent('items_browsed', {
      user_id: userId,
      node_filter: filters.node_id,
      include_all_nodes: filters.include_all_nodes || false,
      category: filters.category_id,
      search_query: filters.search_query ? '[redacted]' : undefined,
      result_count: data?.length || 0,
      timestamp: new Date().toISOString(),
    });

    return {
      items: (data as Item[]) || [],
      total_count: count || 0,
      has_more: (count || 0) > 20,
    };
  } catch (error) {
    console.error('❌ getItems error:', error);
    throw error;
  }
};

/**
 * Get items within distance radius (cross-node search)
 * @param userNodeId - User's current node ID
 * @param radiusMiles - Search radius in miles
 * @param userId - Current user ID for analytics
 * @returns Items within radius with node info
 * @throws Error if query fails
 */
export const getItemsWithinRadius = async (
  userNodeId: string,
  radiusMiles: number,
  userId: string
): Promise<ItemsQueryResult> => {
  try {
    // TODO: For now, just get all items (RPC function pending deployment)
    // In production, this will use the get_nodes_within_radius RPC function
    // For MVP, "Show All Nodes" simply queries all available items across all nodes
    
    const { data, error: itemsError, count } = await supabase
      .from('items')
      .select(
        `
        id,
        title,
        description,
        condition,
        status,
        price_cents,
        currency,
        category,
        seller_id,
        node_id,
        accepts_swap_points,
        donate_to_nonprofit,
        is_boosted,
        boost_ends_at,
        images,
        favorites_count,
        seller_reputation_score,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .eq('status', 'available')
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20)
      .range(0, 19);

    if (itemsError) {
      console.error('❌ Failed to get items:', itemsError);
      throw itemsError;
    }

    // Track analytics
    await trackEvent('items_browsed_by_radius', {
      user_id: userId,
      user_node_id: userNodeId,
      radius_miles: radiusMiles,
      nodes_searched: 0,
      result_count: data?.length || 0,
      timestamp: new Date().toISOString(),
    });

    return {
      items: (data as Item[]) || [],
      total_count: count || 0,
      has_more: (count || 0) > 20,
    };
  } catch (error) {
    console.error('❌ getItemsWithinRadius error:', error);
    throw error;
  }
};

/**
 * Get nearby nodes within radius
 * @param nodeId - User's node ID
 * @param radiusMiles - Search radius in miles
 * @returns Nearby nodes with distance info
 * @throws Error if query fails
 */
export const getNearbyNodes = async (
  nodeId: string,
  radiusMiles: number
): Promise<NearbyNode[]> => {
  try {
    // Get user's node coordinates
    const { data: userNode, error: nodeError } = await supabase
      .from('nodes')
      .select('latitude, longitude')
      .eq('id', nodeId)
      .single();

    if (nodeError) throw nodeError;

    if (!userNode?.latitude || !userNode?.longitude) {
      throw new Error('Node missing coordinates');
    }

    // Find all nodes within radius
    const { data: nearbyNodes, error: nodesError } = await supabase.rpc(
      'get_nodes_within_radius',
      {
        center_lat: userNode.latitude,
        center_lng: userNode.longitude,
        radius_miles: radiusMiles,
      }
    );

    if (nodesError) throw nodesError;

    return (nearbyNodes as NearbyNode[]) || [];
  } catch (error) {
    console.error('❌ getNearbyNodes error:', error);
    throw error;
  }
};

/**
 * Get single item by ID
 * @param itemId - Item ID
 * @returns Item with seller and node info
 * @throws Error if not found
 */
export const getItemById = async (itemId: string): Promise<Item> => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select(
        `
        id,
        title,
        description,
        condition,
        status,
        price_cents,
        currency,
        category,
        seller_id,
        node_id,
        accepts_swap_points,
        donate_to_nonprofit,
        is_boosted,
        boost_ends_at,
        images,
        favorites_count,
        seller_reputation_score,
        created_at,
        updated_at
      `
      )
      .eq('id', itemId)
      .single();

    if (error) throw error;
    return data as Item;
  } catch (error) {
    console.error('❌ getItemById error:', error);
    throw error;
  }
};

/**
 * Calculate distance between two nodes in miles
 * @param node1 - First node with coordinates
 * @param node2 - Second node with coordinates
 * @returns Distance in miles
 */
export const calculateDistance = (
  node1: { latitude: number; longitude: number },
  node2: { latitude: number; longitude: number }
): number => {
  // Haversine formula for distance calculation
  const R = 3959; // Earth radius in miles
  const dLat = ((node2.latitude - node1.latitude) * Math.PI) / 180;
  const dLng = ((node2.longitude - node1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((node1.latitude * Math.PI) / 180) *
      Math.cos((node2.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
