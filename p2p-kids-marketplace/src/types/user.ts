// File: p2p-kids-marketplace/src/types/user.ts
// MODULE-03 AUTH-V2-001: User Schema & Authentication Types

/**
 * V2 User interface with subscription and SP wallet linkage
 */
export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  subscription_id?: string; // V2: Link to subscription
  sp_wallet_id?: string; // V2: Link to SP wallet
  onboarding_completed_at?: string; // V2: Onboarding completion timestamp
  parental_consent_verified: boolean; // V2: COPPA compliance
  age?: number; // V2: User age (5-17 for kids marketplace)
  created_at: string;
  updated_at: string;
}

/**
 * User profile with extended fields
 */
export interface UserProfile {
  id: string;
  user_id: string;
  email?: string;
  display_name?: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  node_id?: string;
  node?: {
    id: string;
    name: string;
    city: string;
    state: string;
    latitude: number;
    longitude: number;
  };
  
  // Profile completion
  profile_completed: boolean;
  onboarding_completed: boolean;
  
  // Verification
  phone_verified: boolean;
  phone_verified_at?: string;
  
  // V2 fields
  subscription_id?: string;
  sp_wallet_id?: string;
  onboarding_completed_at?: string;
  parental_consent_verified: boolean;
  age?: number;
  
  // Referral
  referral_code?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus = 'free' | 'trial' | 'active' | 'grace' | 'canceled';

/**
 * V2 Authentication session with subscription context
 * Enriched with subscription status and SP wallet info for client-side gating
 */
export interface AuthSession {
  user: UserProfile;
  access_token?: string;
  refresh_token?: string;
  
  // V2: Subscription context (from MODULE-11)
  subscription_status: SubscriptionStatus;
  can_spend_sp: boolean; // True for trial/active, false otherwise
  
  // V2: SP wallet context (from MODULE-09)
  available_points: number;
  pending_points: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

/**
 * Signup input (basic user registration - NO TRIAL)
 */
export interface SignupInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  dob?: string; // YYYY-MM-DD format
  age?: number;
  zipCode?: string;
  parentalEmail?: string;
  referralCode?: string;
}

/**
 * Subscription summary (from MODULE-11 integration)
 */
export interface SubscriptionSummary {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  trial_start_date?: string;
  trial_end_date?: string;
  current_period_start?: string;
  current_period_end?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * SP Wallet summary (from MODULE-09 integration)
 */
export interface SPWalletSummary {
  id: string;
  user_id: string;
  status: 'active' | 'frozen' | 'suspended';
  available_balance: number;
  pending_balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  last_activity_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Login credentials
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Auth error types
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
