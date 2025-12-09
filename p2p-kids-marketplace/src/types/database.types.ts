// Supabase database types placeholder — regenerate from live DB
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          display_name: string | null;
          email: string | null;
          phone: string | null;
          bio: string | null;
          avatar_url: string | null;
          node_id: string | null;
          role: string | null;
          subscription_tier_id: string | null;
          swap_points_balance: number | null;
          lifetime_swap_points_earned: number | null;
          is_banned: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          display_name?: string | null;
          email?: string | null;
          phone?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          node_id?: string | null;
          role?: string | null;
          subscription_tier_id?: string | null;
          swap_points_balance?: number | null;
          lifetime_swap_points_earned?: number | null;
          is_banned?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          email?: string | null;
          phone?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          node_id?: string | null;
          role?: string | null;
          subscription_tier_id?: string | null;
          swap_points_balance?: number | null;
          lifetime_swap_points_earned?: number | null;
          is_banned?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      nodes: {
        Row: {
          id: string;
          name: string;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          latitude: number | null;
          longitude: number | null;
          radius_miles: number | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          radius_miles?: number | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          radius_miles?: number | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      items: {
        Row: {
          id: string;
          seller_id: string;
          node_id: string | null;
          title: string;
          description: string | null;
          price_cents: number | null;
          currency: string | null;
          accepts_swap_points: boolean | null;
          donate_to_nonprofit: boolean | null;
          category: string | null;
          condition: string | null;
          images: Json | null;
          status: string | null;
          is_boosted: boolean | null;
          boost_ends_at: string | null;
          favorites_count: number | null;
          created_at: string | null;
          updated_at: string | null;
          seller_reputation_score: number | null;
        };
        Insert: {
          id?: string;
          seller_id: string;
          node_id?: string | null;
          title: string;
          description?: string | null;
          price_cents?: number | null;
          currency?: string | null;
          accepts_swap_points?: boolean | null;
          donate_to_nonprofit?: boolean | null;
          category?: string | null;
          condition?: string | null;
          images?: Json | null;
          status?: string | null;
          is_boosted?: boolean | null;
          boost_ends_at?: string | null;
          favorites_count?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
          seller_reputation_score?: number | null;
        };
        Update: {
          id?: string;
          seller_id?: string;
          node_id?: string | null;
          title?: string;
          description?: string | null;
          price_cents?: number | null;
          currency?: string | null;
          accepts_swap_points?: boolean | null;
          donate_to_nonprofit?: boolean | null;
          category?: string | null;
          condition?: string | null;
          images?: Json | null;
          status?: string | null;
          is_boosted?: boolean | null;
          boost_ends_at?: string | null;
          favorites_count?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
          seller_reputation_score?: number | null;
        };
      };

      trades: {
        Row: {
          id: string;
          item_id: string;
          buyer_id: string;
          seller_id: string;
          status: string | null;
          payment_method: string | null;
          swap_points_used: number | null;
          price_cents: number | null;
          platform_fee_cents: number | null;
          node_id: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          item_id: string;
          buyer_id: string;
          seller_id: string;
          status?: string | null;
          payment_method?: string | null;
          swap_points_used?: number | null;
          price_cents?: number | null;
          platform_fee_cents?: number | null;
          node_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          item_id?: string;
          buyer_id?: string;
          seller_id?: string;
          status?: string | null;
          payment_method?: string | null;
          swap_points_used?: number | null;
          price_cents?: number | null;
          platform_fee_cents?: number | null;
          node_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      messages: {
        Row: {
          id: string;
          trade_id: string | null;
          sender_id: string;
          recipient_id: string | null;
          content: string | null;
          image_url: string | null;
          is_read: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          trade_id?: string | null;
          sender_id: string;
          recipient_id?: string | null;
          content?: string | null;
          image_url?: string | null;
          is_read?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          trade_id?: string | null;
          sender_id?: string;
          recipient_id?: string | null;
          content?: string | null;
          image_url?: string | null;
          is_read?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          expires_at?: string | null;
        };
      };

      reviews: {
        Row: {
          id: string;
          trade_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment: string | null;
          is_anonymous: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          trade_id: string;
          reviewer_id: string;
          reviewee_id: string;
          rating: number;
          comment?: string | null;
          is_anonymous?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          trade_id?: string;
          reviewer_id?: string;
          reviewee_id?: string;
          rating?: number;
          comment?: string | null;
          is_anonymous?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      subscription_tiers: {
        Row: {
          id: string;
          name: string;
          price_monthly: number | null;
          max_active_listings: number | null;
          max_boost_listings: number | null;
          priority_support: boolean | null;
          early_access_features: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          price_monthly?: number | null;
          max_active_listings?: number | null;
          max_boost_listings?: number | null;
          priority_support?: boolean | null;
          early_access_features?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          price_monthly?: number | null;
          max_active_listings?: number | null;
          max_boost_listings?: number | null;
          priority_support?: boolean | null;
          early_access_features?: boolean | null;
          created_at?: string | null;
        };
      };

      points_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          reason: string | null;
          related_trade_id: string | null;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          reason?: string | null;
          related_trade_id?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          reason?: string | null;
          related_trade_id?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
      };

      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          referee_id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          referrer_id: string;
          referee_id: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          referrer_id?: string;
          referee_id?: string;
          created_at?: string | null;
        };
      };

      favorites: {
        Row: {
          id: string;
          user_id: string;
          item_id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_id: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          item_id?: string;
          created_at?: string | null;
        };
      };

      moderation_queue: {
        Row: {
          id: string;
          item_id: string | null;
          reported_by: string | null;
          reason: string | null;
          status: string | null;
          created_at: string | null;
          resolved_at: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          item_id?: string | null;
          reported_by?: string | null;
          reason?: string | null;
          status?: string | null;
          created_at?: string | null;
          resolved_at?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          item_id?: string | null;
          reported_by?: string | null;
          reason?: string | null;
          status?: string | null;
          created_at?: string | null;
          resolved_at?: string | null;
          notes?: string | null;
        };
      };

      ai_moderation_logs: {
        Row: {
          id: string;
          item_id: string | null;
          model: string | null;
          result: Json | null;
          confidence: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          item_id?: string | null;
          model?: string | null;
          result?: Json | null;
          confidence?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          item_id?: string | null;
          model?: string | null;
          result?: Json | null;
          confidence?: number | null;
          created_at?: string | null;
        };
      };

      cpsc_recalls: {
        Row: {
          id: string;
          product_name: string;
          recall_date: string | null;
          description: string | null;
          product_codes: string[] | null;
          keywords: unknown | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          product_name: string;
          recall_date?: string | null;
          description?: string | null;
          product_codes?: string[] | null;
          keywords?: unknown | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          product_name?: string;
          recall_date?: string | null;
          description?: string | null;
          product_codes?: string[] | null;
          keywords?: unknown | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      boost_listings: {
        Row: {
          id: string;
          user_id: string;
          item_id: string;
          duration_minutes: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_id: string;
          duration_minutes?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          item_id?: string;
          duration_minutes?: number | null;
          created_at?: string | null;
        };
      };

      admin_config: {
        Row: {
          key: string;
          value: string | null;
          description: string | null;
          created_at: string | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value?: string | null;
          description?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          value?: string | null;
          description?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      calculate_distance: {
        Args: [number, number, number, number];
        Returns: number;
      };
      get_user_rating: {
        Args: [string];
        Returns: number;
      };
      get_user_trade_count: {
        Args: [string];
        Returns: number;
      };
      calculate_points_balance: {
        Args: [string];
        Returns: number;
      };
    };
    Enums: Record<string, never>;
  };
}
