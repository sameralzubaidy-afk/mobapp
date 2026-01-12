// filepath: p2p-kids-marketplace/src/types/badge.ts

export type BadgeCategory = 'sp_earning' | 'sp_spending' | 'trades' | 'subscription' | 'special';

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  icon_url?: string;
  threshold: number;
  created_at: string;
  is_active: boolean;
  sort_order: number;
  is_archived?: boolean;
  updated_at?: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  awarded_at: string;
  badge?: Badge; // Joined badge details
}

// Admin configuration types
export type BadgeChangeType = 'threshold' | 'name' | 'description' | 'is_active' | 'multiple';

export interface BadgeConfigHistory {
  id: string;
  badge_id: string;
  badge_name?: string;
  admin_id: string;
  admin_name?: string;
  old_threshold?: number;
  new_threshold?: number;
  old_name?: string;
  new_name?: string;
  old_description?: string;
  new_description?: string;
  old_is_active?: boolean;
  new_is_active?: boolean;
  change_type: BadgeChangeType;
  changed_at: string;
}

export type BadgeAuditActionType = 'manual_award' | 'manual_revoke' | 'config_change' | 'bulk_award';

export interface BadgeAuditLog {
  id: string;
  badge_id?: string;
  badge_name?: string;
  user_id: string;
  user_name?: string;
  admin_id: string;
  admin_name?: string;
  action_type: BadgeAuditActionType;
  reason?: string;
  metadata?: Record<string, any>;
  created_at: string;
}
