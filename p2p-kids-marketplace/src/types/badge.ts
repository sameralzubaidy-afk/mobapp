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
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  awarded_at: string;
  badge?: Badge; // Joined badge details
}
