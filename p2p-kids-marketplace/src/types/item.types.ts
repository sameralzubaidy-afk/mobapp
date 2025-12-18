/**
 * Item Types
 * Shared types for item listing, browsing, and filtering
 * Used across mobile app and backend services
 */

export enum ItemCondition {
  LIKE_NEW = 'like_new',
  GOOD = 'good',
  FAIR = 'fair',
  FOR_PARTS = 'for_parts',
}

export enum ItemStatus {
  AVAILABLE = 'available',
  PENDING = 'pending',
  SOLD = 'sold',
  EXPIRED = 'expired',
  DELETED = 'deleted',
}

export enum PaymentPreference {
  CASH_ONLY = 'cash_only',
  ACCEPT_SWAP_POINTS = 'accept_swap_points',
  DONATE = 'donate',
}

/**
 * Item with seller and node information
 */
export interface Item {
  id: string;
  title: string;
  description?: string;
  condition: ItemCondition;
  status: ItemStatus;
  price_cents: number;
  currency: string;
  category?: string;
  seller_id: string;
  node_id?: string;
  accepts_swap_points: boolean;
  donate_to_nonprofit: boolean;
  is_boosted: boolean;
  boost_ends_at?: string;
  images?: string[];
  favorites_count: number;
  seller_reputation_score?: number;
  created_at: string;
  updated_at: string;
  // Nested relations
  seller?: {
    id: string;
    name: string;
    avatar_url?: string;
    node_id?: string;
    node?: NodeInfo;
  };
  node?: NodeInfo;
}

/**
 * Node information for item display
 */
export interface NodeInfo {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  radius_miles?: number;
}

/**
 * Item filters for querying
 */
export interface ItemFilters {
  node_id?: string;
  category_id?: string;
  condition?: ItemCondition;
  min_price?: number;
  max_price?: number;
  search_query?: string;
  include_all_nodes?: boolean;
  status?: ItemStatus;
  accepted_payment?: PaymentPreference;
}

/**
 * Item query result with pagination
 */
export interface ItemsQueryResult {
  items: Item[];
  total_count: number;
  has_more: boolean;
}

/**
 * Nearby node with distance
 */
export interface NearbyNode {
  id: string;
  name: string;
  city: string;
  state: string;
  distance_miles: number;
}

/**
 * Analytics event for item browsing
 */
export interface ItemBrowseAnalyticsEvent {
  user_id: string;
  node_filter?: string;
  include_all_nodes: boolean;
  category?: string;
  search_query?: string;
  result_count: number;
  radius_miles?: number;
  timestamp: string;
}
