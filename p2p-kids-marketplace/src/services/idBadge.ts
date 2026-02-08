// File: p2p-kids-marketplace/src/services/idBadge.ts
// TASK BADGE-008: ID Badge Verification Service
// Module: MODULE-10-ID-BADGE-VERIFICATION-V2.md

import { supabase } from './supabase/client';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';

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
        .select('name, email, phone, node_id, user_id')
        .eq('user_id', userId)
        .single();

      if (profileError) throw profileError;

      // Normalize the picked image into a small JPEG and convert to base64
      // This avoided "Cannot read property 'Base64' of undefined" and also
      // reduces upload size for faster submissions.
      const manipulated = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1024, height: 1024 } }], // Good quality but manageable size
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (!manipulated.base64) {
        throw new Error('Unable to process image for upload');
      }

      // Convert to blob for upload using base64-arraybuffer decode
      const fileName = `${userId}-${Date.now()}.jpg`;
      const storagePath = `${userId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, decode(manipulated.base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Handle name splitting for denormalization
      const fullName = profile?.name || '';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Create submission record in database
      const { data, error: insertError } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: userId,
          status: 'pending',
          screenshot_path: storagePath,
          screenshot_upload_timestamp: new Date().toISOString(),
          first_name: firstName,
          last_name: lastName,
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
