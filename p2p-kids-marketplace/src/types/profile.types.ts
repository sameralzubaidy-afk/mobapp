// File: p2p-kids-marketplace/src/types/profile.types.ts
// Profile-related type definitions for AUTH-005, AUTH-006

import { Database } from './database.types';

export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type Node = Database['public']['Tables']['nodes']['Row'];

export interface ProfileSetupData {
  display_name: string;
  avatar_url?: string;
  zip_code: string;
  bio?: string;
}

export interface ProfileUpdateData {
  display_name?: string;
  avatar_url?: string;
  zip_code?: string;
  bio?: string;
  phone?: string;
}

export interface NodeAssignment {
  node_id: string;
  node_name: string;
  distance_miles?: number;
}
