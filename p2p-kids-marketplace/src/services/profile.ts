// File: p2p-kids-marketplace/src/services/profile.ts
// Profile management service for AUTH-005, AUTH-006, AUTH-007

import { supabase } from './supabase/client';
import type { User, ProfileSetupData, ProfileUpdateData, NodeAssignment } from '@/types/profile.types';
import { assignNodeByZipCode, incrementNodeMemberCount } from './location';

/**
 * NODE-003: Find the nearest active node based on ZIP code
 * Uses the new resolve_active_node_for_signup RPC that:
 * - Returns exact match if active node exists for ZIP
 * - Returns nearest active node if ZIP is not active
 * - Signals if ZIP is not active (match_type='nearest') for waitlist popup
 * 
 * IMPORTANT: This function DOES NOT show the popup.
 * The calling code (LocationPickerScreen) handles the popup logic.
 */
export const findNearestNode = async (zipCode: string): Promise<NodeAssignment | null> => {
  try {
    console.log('🔍 [NODE-003] Looking up node for zip code:', zipCode);
    
    // Use the new NODE-003 assignment function that handles exact match or nearest
    const result = await assignNodeByZipCode(zipCode);
    
    console.log('✅ [NODE-003] Node assignment result:', {
      nodeId: result.nodeId,
      nodeName: result.nodeName,
      matchType: result.matchType,
      distanceMiles: result.distanceMiles,
    });
    
    return {
      node_id: result.nodeId,
      node_name: result.nodeName,
      distance_miles: result.distanceMiles || 0,
      // NEW: Signal if ZIP is inactive (for popup logic)
      is_exact_match: result.matchType === 'zip',
    };
  } catch (error: any) {
    console.error('❌ [NODE-003] Node assignment error:', error);
    // Return null if NO active nodes exist anywhere
    // This will trigger the "no active nodes" flow
    if (error.message?.includes('not currently active')) {
      return null;
    }
    return null;
  }
};

/**
 * AUTH-005: Complete user profile setup after phone verification
 * NODE-003: Updated to use new node assignment flow with waitlist support
 */
export const setupUserProfile = async (
  userId: string,
  profileData: ProfileSetupData
): Promise<{ 
  user: User | null; 
  error: any | null; 
  needsWaitlist?: boolean; 
  zipCode?: string;
  matchType?: 'zip' | 'nearest';  // NODE-003: Signal if ZIP is inactive
  assignedNodeId?: string;
  assignedNodeName?: string;
}> => {
  try {
    console.log('🔍 [NODE-003] setupUserProfile called with ZIP:', profileData.zip_code);
    
    // Step 1: NODE-003 - Find nearest active node (exact match or fallback)
    const nodeAssignment = await findNearestNode(profileData.zip_code);
    
    let needsWaitlist = false;
    let assignedNodeId: string | null = null;
    let matchType: 'zip' | 'nearest' | undefined = undefined;

    if (!nodeAssignment) {
      console.log('⚠️ No node found for zip code:', profileData.zip_code);
      console.log('🎯 User will be prompted to join waitlist but can continue registration');
      needsWaitlist = true;
      // Don't return error - allow profile creation to continue
    } else {
      assignedNodeId = nodeAssignment.node_id;
      // NODE-003: Check if this was an exact match or fallback
      matchType = nodeAssignment.is_exact_match ? 'zip' : 'nearest';
      
      console.log(`✅ [NODE-003] Node assigned: ${nodeAssignment.node_name} (${matchType})`);
      
      // NODE-003: If fallback (inactive ZIP), signal waitlist needed
      if (matchType === 'nearest') {
        needsWaitlist = true;
        console.log('⚠️ [NODE-003] ZIP is inactive - waitlist popup should be shown');
      }
    }

    // Step 2: Create or update user profile in database
    // Note: A trigger auto-creates a minimal profile on signup, so we use upsert
    const dbProfileData: Record<string, any> = {
      user_id: userId,
      name: profileData.display_name,
      avatar_url: profileData.avatar_url || null,
      bio: profileData.bio || null,
      zip_code: profileData.zip_code,
      node_id: assignedNodeId, // Can be null if no node found
      profile_completed: true,
      onboarding_completed: true,
      phone_verified: true,
      phone_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .upsert(dbProfileData, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (insertError) {
      console.error('Profile insert error:', insertError);
      return { user: null, error: insertError };
    }

    // NODE-003: Increment node member count if node assigned
    if (assignedNodeId) {
      try {
        await incrementNodeMemberCount(assignedNodeId);
        console.log('✅ [NODE-003] Node member count incremented:', assignedNodeId);
      } catch (error) {
        console.error('❌ [NODE-003] Failed to increment member count (non-fatal):', error);
        // Non-fatal error - continue
      }
    }

    // Return the user data (we'll need to get it from auth.users)
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { user: null, error: userError };
    }

    return { 
      user: userData.user as User, 
      error: null,
      needsWaitlist,
      zipCode: profileData.zip_code,
      matchType,
      assignedNodeId: assignedNodeId || undefined,
      assignedNodeName: nodeAssignment?.node_name || undefined,
    };
  } catch (error) {
    console.error('Setup profile exception:', error);
    return { user: null, error };
  }
};

/**
 * AUTH-006: Update user profile
 * Allows editing name, avatar, bio, phone, zip code
 * Changing zip code may reassign to different node
 */
export const updateUserProfile = async (
  userId: string,
  updates: ProfileUpdateData
): Promise<{ user: User | null; error: any | null; needsWaitlist?: boolean; zipCode?: string }> => {
  try {
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };
    let needsWaitlist = false;
    let userZip: string | undefined = undefined;
    // Add fields that are being updated
    if (updates.display_name !== undefined) {
      updatePayload.name = updates.display_name;
    }
    if (updates.avatar_url !== undefined) {
      updatePayload.avatar_url = updates.avatar_url;
    }
    if (updates.bio !== undefined) {
      updatePayload.bio = updates.bio;
    }
    // Phone number is stored on the auth user, update separately
    let phoneUpdateError: any = null;
    if (updates.phone !== undefined) {
      try {
        // Call server-side Edge Function to update auth user phone using service role
        const invokeRes = await supabase.functions.invoke('auth-update-phone', { body: { user_id: userId, phone: updates.phone } });
        const fnData = (invokeRes as any)?.data;
        const fnError = (invokeRes as any)?.error;
        if (fnError) {
          console.error('Failed to update auth user phone via function (SDK error):', fnError);
          phoneUpdateError = fnError;
        }
        if (fnData && fnData.error) {
          console.error('Failed to update auth user phone via function (function error):', fnData.error);
          // If the function is not configured (missing service role key), fall back to updating the profile record locally
          if (typeof fnData.error === 'string' && fnData.error.includes('service role')) {
            console.warn('auth-update-phone not configured; updating phone on profiles table as fallback');
            const { error: profileErr } = await supabase.from('profiles').update({ phone: updates.phone, phone_verified: true, phone_verified_at: new Date().toISOString() }).eq('user_id', userId);
            if (profileErr) {
              console.error('Fallback profile phone update failed:', profileErr);
              phoneUpdateError = profileErr;
            } else {
              phoneUpdateError = null; // we succeeded in fallback
            }
          } else {
            phoneUpdateError = fnData.error;
          }
        }
      } catch (e) {
        console.error('Exception invoking auth-update-phone:', e);
        phoneUpdateError = e;
      }
    }

    // If zip code is changing, reassign node
    if (updates.zip_code !== undefined) {
      const nodeAssignment = await findNearestNode(updates.zip_code);
      if (!nodeAssignment) {
        // No node found; do not block update. Set node_id to null and signal waitlist
        console.log('⚠️ No node found for updated zip code:', updates.zip_code);
        needsWaitlist = true;
        userZip = updates.zip_code;
        updatePayload.node_id = null;
      } else {
        updatePayload.node_id = nodeAssignment.node_id;
      }
    }

    // Update the user profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Profile update error:', updateError);
      return { user: null, error: updateError };
    }

    // Fetch current auth user to return updated info
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { user: null, error: userError };
    }

    // If phone update failed earlier, surface that as a partial error while returning user
    if (phoneUpdateError) {
      return { user: userData.user as User, error: phoneUpdateError, needsWaitlist, zipCode: userZip };
    }

    return { user: userData.user as User, error: null, needsWaitlist, zipCode: userZip };
  } catch (error) {
    console.error('Update profile exception:', error);
    return { user: null, error };
  }
};

/**
 * Get current user profile from database
 */
export const getUserProfile = async (userId: string): Promise<{ user: any | null; error: any | null }> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Get user profile error:', error);
      return { user: null, error };
    }

    return { user: data, error: null };
  } catch (error) {
    console.error('Get user profile exception:', error);
    return { user: null, error };
  }
};

/**
 * Upload profile avatar to Supabase Storage
 * Returns the public URL of the uploaded image
 */
export const uploadProfileAvatar = async (
  userId: string,
  imageUri: string
): Promise<{ url: string | null; error: any | null }> => {
  try {
    // Convert image URI to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Generate unique filename with user ID prefix for RLS
    const fileExt = imageUri.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const fileName = `${userId}-${timestamp}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    console.log(`📤 Uploading avatar: ${filePath}`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('user-avatars')
      .upload(filePath, blob, {
        contentType: `image/${fileExt}`,
        upsert: true, // Allow overwriting if file exists
      });

    if (error) {
      console.error('❌ Avatar upload error:', error);
      // If it's an RLS error, provide helpful message
      if (error.message?.includes('row-level security') || error.message?.includes('violates')) {
        return {
          url: null,
          error: new Error('Storage not configured. Please contact support. (Profile will be created without avatar)')
        };
      }
      return { url: null, error };
    }

    console.log('✅ Avatar uploaded successfully:', data.path);

    // Get public URL; use fallback if not provided
    const { data: urlData } = supabase.storage.from('user-avatars').getPublicUrl(filePath);
    const publicUrl = (urlData && (urlData.publicUrl || (urlData as any).public_url))
      ? (urlData.publicUrl || (urlData as any).public_url)
      : `${process.env.EXPO_PUBLIC_SUPABASE_URL || (supabase as any).url}/storage/v1/object/public/user-avatars/${filePath}`;

    console.log('🔗 Avatar URL:', publicUrl);

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error('❌ Upload avatar exception:', error);
    return { url: null, error };
  }
};
