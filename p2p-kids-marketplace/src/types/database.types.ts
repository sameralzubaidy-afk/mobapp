export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: any;
      nodes: any;
      items: any;
      trades: any;
      messages: any;
      reviews: any;
      subscription_tiers: any;
      points_transactions: any;
      referrals: any;
      favorites: any;
      moderation_queue: any;
      ai_moderation_logs: any;
      cpsc_recalls: any;
      boost_listings: any;
      admin_config: any;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
