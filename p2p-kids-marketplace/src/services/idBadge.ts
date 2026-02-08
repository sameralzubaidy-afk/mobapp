// File: p2p-kids-marketplace/src/services/idBadge.ts
// TASK BADGE-008: ID Badge Verification Service
// Module: MODULE-10-ID-BADGE-VERIFICATION-V2.md

import { supabase } from './supabase/client';
import * as FileSystem from 'expo-file-system';

const STORAGE_BUCKET = 'id-badge-verification-screenshots';

export interface IDVerificationStatus {
  status: 'pending' | 'approved' | 'rejected' | 'none';
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  rejectionNotes?: string;
}

export const idBadgeService = {
  /**
   * Fetch a configurable message by key
   */
  async getMessage(key: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('id_badge_verification_messages')
        .select('message_text')
        .eq('message_key', key)
        .single();

      if (error) {
        console.error('Error fetching message:', error);
        return '';
      }
      return data?.message_text || '';
    } catch (error) {
      console.error('Error fetching message:', error);
      return '';
    }
  },

  /**
   * Check if user has a pending verification request
   */
  async checkPendingRequest(userId: string) {
    try {
      const { data, error } = await supabase
        .from('id_badge_verification_requests')
        .select('id, status, submitted_at')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error checking pending request:', error);
      return null;
    }
  },

  /**
   * Submit ID verification request
   * 1. Get user profile for denormalization
   * 2. Upload screenshot to Storage
   * 3. Create submission record in database
   */
  async submitVerificationRequest(userId: string, imageUri: string): Promise<string> {
    try {
      // Get user profile for denormalization
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, phone, node_id, user_id')
        .eq('user_id', userId)
        .single();

      if (profileError) throw profileError;

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert to blob for upload
      const fileName = `${userId}-${Date.now()}.jpg`;
      const storagePath = `${userId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, decode(base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create submission record in database
      const { data, error: insertError } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: userId,
          status: 'pending',
          screenshot_path: storagePath,
          screenshot_upload_timestamp: new Date().toISOString(),
          first_name: profile?.first_name,
          last_name: profile?.last_name,
          email: profile?.email,
          phone_number: profile?.phone,
          node_id: profile?.node_id,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // TODO: Trigger submission notification (in-app + email)
      // TODO: Log analytics event
      // TODO: Send admin notification

      return data.id;
    } catch (error) {
      console.error('Error submitting verification request:', error);
      throw error;
    }
  },

  /**
   * Get user's ID verification status
   * Returns pending, approved, rejected, or none
   */
  async getVerificationStatus(userId: string): Promise<IDVerificationStatus> {
    try {
      // Check for pending request first
      const { data: pending } = await supabase
        .from('id_badge_verification_requests')
        .select('status, submitted_at, reviewed_at, rejection_reason, rejection_notes')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pending) {
        return {
          status: 'pending',
          submittedAt: pending.submitted_at,
        };
      }

      // Check for approved/rejected
      const { data: decided } = await supabase
        .from('id_badge_verification_requests')
        .select('status, submitted_at, reviewed_at, rejection_reason, rejection_notes')
        .eq('user_id', userId)
        .in('status', ['approved', 'rejected'])
        .order('reviewed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (decided) {
        return {
          status: decided.status as 'approved' | 'rejected',
          submittedAt: decided.submitted_at,
          reviewedAt: decided.reviewed_at || undefined,
          rejectionReason: decided.rejection_reason || undefined,
          rejectionNotes: decided.rejection_notes || undefined,
        };
      }

      return { status: 'none' };
    } catch (error) {
      console.error('Error fetching verification status:', error);
      return { status: 'none' };
    }
  },

  /**
   * Get verification request by ID (admin use)
   */
  async getRequestById(requestId: string) {
    try {
      const { data, error } = await supabase
        .from('id_badge_verification_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching request:', error);
      throw error;
    }
  },
};

// Helper to decode base64 to ArrayBuffer
function decode(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
