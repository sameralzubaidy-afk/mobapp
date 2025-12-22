/**
 * File: p2p-kids-marketplace/src/services/items.ts
 * MODULE-03 NODE-006: Node-Specific Item Filtering
 * 
 * Handles:
 * - Item listing queries with node-based filtering
 * - Cross-node search within radius
 * - Item filtering by category, price, condition
 * - Analytics tracking for item browsing
 */

import { supabase } from './supabase';
import { trackEvent } from './analytics';

/**
 * Item filter options for browse/search
 */
export interface ItemFilters {
  node_id?: string;
  category_id?: string;
  condition?: string;
  min_price?: number;
  max_price?: number;
  search_query?: string;
  include_all_nodes?: boolean; // Cross-node search
  accepts_swap_points?: boolean; // Filter SP-eligible items (MODULE-04)
}

/**
 * Item details returned from queries
 */
export interface Item {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  category_id: string | null;
  condition: string | null;
  status: string;
  accepts_swap_points: boolean;
  created_at: string;
  updated_at: string;
  sold_at: string | null;
  relevance?: number; // Search relevance score (0-1)
  seller_node_id?: string; // Seller's node ID for distance calculations
  seller?: {
    id: string;
    name: string;
    avatar_url: string | null;
    node_id: string | null;
    node?: {
      id: string;
      name: string;
      city: string;
      state: string;
    } | null;
  };
  category?: {
    id: string;
    name: string;
    icon: string | null;
  } | null;
  images?: Array<{
    id: string;
    url: string;
    thumbnail_url: string | null;
    display_order: number;
  }>;
}

/**
 * Get items with filters (NODE-006: Node-based filtering)
 * 
 * @param filters - Filter criteria
 * @param userId - Current user ID (for analytics)
 * @returns Array of items
 */
export const getItems = async (
  filters: ItemFilters,
  userId: string
): Promise<Item[]> => {
  try {
    let query = supabase
      .from('items')
      .select('*')
      .eq('status', 'available')
      .order('created_at', { ascending: false });

    // Category filter
    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id);
    }

    // Condition filter
    if (filters.condition) {
      query = query.eq('condition', filters.condition);
    }

    // Price range filter
    if (filters.min_price !== undefined) {
      query = query.gte('price', filters.min_price);
    }
    if (filters.max_price !== undefined) {
      query = query.lte('price', filters.max_price);
    }

    // Swap Points filter (MODULE-04)
    if (filters.accepts_swap_points !== undefined) {
      query = query.eq('accepts_swap_points', filters.accepts_swap_points);
    }

    // Search query (title or description)
    if (filters.search_query) {
      query = query.or(
        `title.ilike.%${filters.search_query}%,description.ilike.%${filters.search_query}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Get items error:', error);
      throw new Error(error.message || 'Failed to fetch items');
    }

    let filteredItems = data || [];

    // NODE-006: Filter by node locally (default behavior)
    if (filters.node_id && !filters.include_all_nodes) {
      // Fetch seller profiles to filter by node
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, node_id')
        .eq('node_id', filters.node_id);

      const nodeUserIds = new Set((profiles || []).map(p => p.user_id));
      filteredItems = filteredItems.filter(item => nodeUserIds.has(item.seller_id));
    }

    // Track analytics (NODE-006)
    trackEvent('items_browsed', {
      user_id: userId,
      node_filter: filters.node_id,
      include_all_nodes: filters.include_all_nodes || false,
      category: filters.category_id,
      search_query: filters.search_query,
      accepts_swap_points: filters.accepts_swap_points,
      result_count: filteredItems.length,
    });

    return filteredItems as Item[];
  } catch (error: any) {
    console.error('❌ Get items error:', error);
    throw error;
  }
};

/**
 * Get items within distance radius (NODE-007: Cross-node search)
 * 
 * @param userNodeId - User's node ID
 * @param radiusMiles - Search radius in miles
 * @param userId - Current user ID
 * @param additionalFilters - Optional additional filters
 * @returns Array of items within radius
 */
export const getItemsWithinRadius = async (
  userNodeId: string,
  radiusMiles: number,
  userId: string,
  additionalFilters?: Omit<ItemFilters, 'node_id' | 'include_all_nodes'>
): Promise<Item[]> => {
  try {
    // Get user's node coordinates
    const { data: userNode, error: nodeError } = await supabase
      .from('nodes')
      .select('latitude, longitude')
      .eq('id', userNodeId)
      .maybeSingle();

    if (nodeError) {
      console.error('❌ Node lookup error:', nodeError);
      throw new Error(nodeError.message || 'Failed to lookup node');
    }

    // If node not found, return empty array (user may be on waitlist or node doesn't exist)
    if (!userNode) {
      console.warn(`⚠️ Node not found: ${userNodeId}. Returning empty results.`);
      return [];
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

    if (nodesError) {
      console.error('❌ Nearby nodes lookup error:', nodesError);
      throw new Error(nodesError.message || 'Failed to find nearby nodes');
    }

    const nodeIds = nearbyNodes.map((node: any) => node.id);

    console.log(`🔍 Found ${nodeIds.length} nodes within ${radiusMiles} miles`);

    // Get items from nearby nodes
    let query = supabase
      .from('items')
      .select(`
        *,
        seller:profiles(
          user_id,
          name,
          avatar_url,
          node_id,
          node:nodes(
            id,
            name,
            city,
            state
          )
        ),
        category:categories(id, name, icon),
        images:item_images(id, url, thumbnail_url, display_order)
      `)
      .eq('status', 'available')
      .in('seller.node_id', nodeIds)
      .order('created_at', { ascending: false });

    // Apply additional filters
    if (additionalFilters?.category_id) {
      query = query.eq('category_id', additionalFilters.category_id);
    }
    if (additionalFilters?.condition) {
      query = query.eq('condition', additionalFilters.condition);
    }
    if (additionalFilters?.min_price !== undefined) {
      query = query.gte('price', additionalFilters.min_price);
    }
    if (additionalFilters?.max_price !== undefined) {
      query = query.lte('price', additionalFilters.max_price);
    }
    if (additionalFilters?.accepts_swap_points !== undefined) {
      query = query.eq('accepts_swap_points', additionalFilters.accepts_swap_points);
    }
    if (additionalFilters?.search_query) {
      query = query.or(
        `title.ilike.%${additionalFilters.search_query}%,description.ilike.%${additionalFilters.search_query}%`
      );
    }

    const { data: items, error: itemsError } = await query;

    if (itemsError) {
      console.error('❌ Items within radius error:', itemsError);
      throw new Error(itemsError.message || 'Failed to fetch items within radius');
    }

    // Track analytics (NODE-007)
    trackEvent('items_browsed_by_radius', {
      user_id: userId,
      user_node_id: userNodeId,
      radius_miles: radiusMiles,
      nodes_searched: nodeIds.length,
      result_count: items?.length || 0,
    });

    return (items || []) as Item[];
  } catch (error: any) {
    console.error('❌ Get items within radius error:', error);
    throw error;
  }
};

/**
 * Get single item by ID
 * 
 * @param itemId - Item ID
 * @returns Item details
 */
export const getItemById = async (itemId: string): Promise<Item | null> => {
  try {
    // Try fetching with relationship expansion first
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        seller:profiles(
          user_id,
          name,
          avatar_url,
          node_id,
          node:nodes(
            id,
            name,
            city,
            state
          )
        ),
        category:categories(id, name, icon),
        images:item_images(id, url, thumbnail_url, display_order)
      `)
      .eq('id', itemId)
      .maybeSingle();

    if (error) {
      console.warn('⚠️ getItemById join failed, falling back to separate fetches:', error.message);
      
      // Fallback: Fetch item first, then related data (more resilient to schema cache issues)
      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .maybeSingle();

      if (itemError || !item) return null;

      const [sellerRes, categoryRes, imagesRes] = await Promise.all([
        supabase.from('profiles').select('*, node:nodes(*)').eq('user_id', item.seller_id).maybeSingle(),
        item.category_id ? supabase.from('categories').select('*').eq('id', item.category_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('item_images').select('*').eq('item_id', itemId).order('display_order', { ascending: true })
      ]);

      return {
        ...item,
        seller: sellerRes.data,
        category: categoryRes.data,
        images: imagesRes.data || []
      } as Item;
    }

    return data as Item;
  } catch (error: any) {
    console.error('❌ Get item by ID error:', error);
    return null;
  }
};

/**
 * Get all categories
 * 
 * @returns Array of categories
 */
export const getCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error: any) {
    console.error('❌ Get categories error:', error);
    return [];
  }
};

/**
 * Create new item listing
 * (Will be expanded in MODULE-04)
 * 
 * @param itemData - Item data
 * @returns Created item
 */
export const createItem = async (itemData: {
  title: string;
  description?: string;
  price: number;
  category_id?: string;
  condition?: string;
  accepts_swap_points?: boolean;
}): Promise<Item> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('items')
      .insert([
        {
          seller_id: user.id,
          ...itemData,
          status: 'available',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    trackEvent('item_created', {
      user_id: user.id,
      item_id: data.id,
      price: itemData.price,
      category_id: itemData.category_id,
      accepts_swap_points: itemData.accepts_swap_points || false,
    });

    return data as Item;
  } catch (error: any) {
    console.error('❌ Create item error:', error);
    throw error;
  }
};
