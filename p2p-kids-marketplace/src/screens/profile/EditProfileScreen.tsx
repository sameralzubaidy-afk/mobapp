// File: p2p-kids-marketplace/src/screens/profile/EditProfileScreen.tsx
// AUTH-006: User Profile Editing

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  updateUserProfile,
  getUserProfile,
  uploadProfileAvatar,
  resolveAvatarUrl,
} from '@/services/profile';
import { getCurrentUser } from '@/services/supabase/auth';
import { addToWaitlist } from '@/services/waitlist';
import { requestPhoneVerification, verifyPhoneCode } from '@/services/phone';
import { supabase } from '@/services/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Modal } from 'react-native';
import type { ProfileUpdateData } from '@/types/profile.types';
// Temporary fallback: generated Database types may be missing in local dev.
// Use `any` here to unblock type-checking until DB types are generated.
type UserProfile = any;

const formatErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    const candidate = (error as Record<string, unknown>).message;
    if (typeof candidate === 'string') {
      return candidate;
    }
  }
  if (typeof error === 'string') {
    return error;
  }
  return JSON.stringify(error) || 'Unknown error';
};

export default function EditProfileScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [phoneVerification, setPhoneVerification] = useState<{
    visible: boolean;
    phone?: string;
    code?: string;
    sending?: boolean;
    verifying?: boolean;
    message?: string;
  }>({ visible: false });

  const { refreshSession } = useAuth();

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { user: authUser, error: authError } = await getCurrentUser();
      if (authError || !authUser) {
        throw new Error('Unable to get current user');
      }

      const { user: profile, error: profileError } = await getUserProfile(authUser.id);
      if (profileError || !profile) {
        throw new Error('Unable to load profile');
      }

      setCurrentUser(authUser);
      setCurrentProfile(profile);
      setDisplayName((profile as any)?.name || '');
      setBio((profile as any)?.bio || '');
      setZipCode((profile as any)?.zip_code || '');

      // Phone may exist on auth user top-level or inside user_metadata
      let phoneFromAuth = (authUser as any).phone || (authUser as any).user_metadata?.phone || '';

      // If phone not available on auth user, try to fetch the latest verified phone from phone_verification_codes
      if (!phoneFromAuth) {
        try {
          const { data: phoneData, error: phoneError } = await (
            supabase.from('phone_verification_codes') as any
          )
            .select('phone')
            .eq('user_id', authUser.id)
            .eq('verified', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!phoneError && phoneData?.phone) {
            phoneFromAuth = phoneData.phone;
          }
        } catch (e) {
          console.warn('Error fetching verified phone:', e);
        }
      }

      setPhone(phoneFromAuth || '');

      // Resolve avatar URL: profile.avatar_url could be a full URL or a storage path
      const resolvedAvatar = await resolveAvatarUrl(profile.avatar_url);
      setAvatarUrl(resolvedAvatar);
    } catch (error: any) {
      console.error('Load profile error:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (displayName.trim() && displayName.trim().length < 2) {
      newErrors.displayName = 'Display name must be at least 2 characters';
    }

    if (zipCode.trim() && !/^\d{5}$/.test(zipCode.trim())) {
      newErrors.zipCode = 'Zip code must be 5 digits';
    }

    if (phone.trim() && !/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Phone number must be 10 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePickImage = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photos to upload a profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLocalImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'User not found. Please try logging in again.');
      return;
    }

    setSaving(true);

    try {
      let uploadedAvatarPath: string | null = null;

      // Upload new avatar if user selected one
      if (localImageUri) {
        setUploadingImage(true);
        const {
          url,
          path,
          error: uploadError,
        } = await uploadProfileAvatar(currentUser.id, localImageUri);
        setUploadingImage(false);

        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
          const errorMsgRaw = formatErrorMessage(uploadError);
          let errorMsg = 'Failed to upload avatar.';
          if (errorMsgRaw.includes('Storage not configured')) {
            errorMsg = 'Storage service unavailable. Your profile will be saved without avatar.';
          } else if (errorMsgRaw.includes('Network')) {
            errorMsg =
              'Network connection issue. Try again or skip avatar. Profile will be saved without it.';
          } else if (errorMsgRaw.includes('retry')) {
            errorMsg =
              'Upload timed out. Try again or skip avatar. Profile will be saved without it.';
          }
          Alert.alert('Avatar Upload', errorMsg, [
            { text: 'Retry', onPress: () => handlePickImage() },
            { text: 'Skip Avatar', onPress: () => setLocalImageUri(null) },
          ]);
          // Don't block profile save if avatar fails
        } else {
          uploadedAvatarPath = path ?? null;
          if (url) setAvatarUrl(url);
        }
      }

      // Prepare update data (only include changed fields)
      const updates: ProfileUpdateData = {};

      if (displayName.trim() !== (currentProfile.name || '')) {
        updates.display_name = displayName.trim();
      }
      if (bio.trim() !== (currentProfile.bio || '')) {
        updates.bio = bio.trim();
      }
      let phoneChanged = false;
      if (phone.trim() !== (currentUser.phone || '')) {
        phoneChanged = true;
        // Do not include phone in updates until verified
      }
      if (zipCode.trim()) {
        // Only update zip code if user entered one
        updates.zip_code = zipCode.trim();
      }
      if (uploadedAvatarPath) {
        updates.avatar_url = uploadedAvatarPath;
      }

      // Only call update if there are changes
      if (Object.keys(updates).length === 0 && !localImageUri) {
        Alert.alert('No Changes', 'No changes were made to your profile.');
        return;
      }

      const {
        user,
        error,
        needsWaitlist,
        zipCode: updatedZip,
      } = await updateUserProfile(currentUser.id, updates);

      // If phone was changed, start verification flow (non-blocking)
      if (phoneChanged) {
        // Re-fetch auth user to get the canonical current phone
        const { user: latestAuthUser } = await getCurrentUser();
        const currentAuthPhone = latestAuthUser?.phone || '';

        // Check verified phone records for this user
        let alreadyVerified = false;
        try {
          const { data: verifiedRow } = await (supabase.from('phone_verification_codes') as any)
            .select('phone')
            .eq('user_id', (currentUser as any).id)
            .eq('verified', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (verifiedRow && (verifiedRow as any).phone) {
            alreadyVerified = (verifiedRow as any).phone === phone.trim();
          }
        } catch (e) {
          console.warn('Could not check verified phone records:', e);
        }

        if (phone.trim() === currentAuthPhone || alreadyVerified) {
          // Phone already present/verified — update local UI and don't trigger verification
          setPhone(phone.trim());
          Alert.alert('Info', 'This phone number is already verified and active on your account.');
        } else {
          setPhoneVerification({ visible: true, phone: phone.trim(), sending: true });
          const { success } = await requestPhoneVerification(currentUser.id, phone.trim());
          if (!success) {
            setPhoneVerification((prev) => ({
              ...prev,
              sending: false,
              message: 'Failed to send verification code.',
            }));
            Alert.alert('Warning', 'Failed to send verification code. Please try again.');
            return; // stop here, do not show success
          } else {
            setPhoneVerification((prev) => ({
              ...prev,
              sending: false,
              message: 'Verification code sent. Enter it below.',
            }));
            // Keep modal open and do not show overall success yet; wait for verification
            return;
          }
        }
      }

      if (error) {
        // Profile fields may have been updated but phone update could fail (auth update). Show a warning and continue.
        console.warn('Partial update warning:', error);
        // Update local phone if available from returned user
        if (user && user.phone) setPhone(user.phone);
        const errMsg =
          error instanceof Error
            ? error.message
            : (error && (error as any).message) || 'Some fields were not updated.';
        Alert.alert('Updated with Warning', errMsg, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        // Ensure verification modal remains if phone change in progress
        if (phoneChanged && phoneVerification.visible) {
          // no-op here; modal will handle verification
        }
        return;
      }

      // Update local phone from returned auth user to reflect change immediately
      if (user && user.phone) setPhone(user.phone);

      // If the updated zip code has no active node, prompt to join waitlist
      if (needsWaitlist && updatedZip) {
        Alert.alert(
          'Area Not Yet Available',
          `We're not live in your area (${updatedZip}) yet! Would you like to join the waitlist to be notified when we launch?`,
          [
            { text: 'Skip', style: 'cancel', onPress: () => navigation.goBack() },
            {
              text: 'Join Waitlist',
              onPress: async () => {
                const { success } = await addToWaitlist({
                  email: (currentUser as any)?.email || '',
                  phone: (currentUser as any)?.phone,
                  zip: updatedZip,
                });

                if (success) {
                  Alert.alert('Added to Waitlist!', "We'll notify you when we launch.", [
                    { text: 'OK', onPress: () => navigation.goBack() },
                  ]);
                } else {
                  Alert.alert('Info', 'Could not add to waitlist, but changes were saved.', [
                    { text: 'OK', onPress: () => navigation.goBack() },
                  ]);
                  if (phoneChanged && phoneVerification.visible) {
                    // If phone verification still pending, keep modal open
                  }
                }
              },
            },
          ]
        );
        return;
      }

      if (refreshSession) {
        try {
          await refreshSession();
        } catch (refreshError) {
          console.warn(
            '[EditProfileScreen] Failed to refresh session after profile update',
            refreshError
          );
        }
      }

      Alert.alert('Success', 'Your profile has been updated!', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
            // If phone verification is active, we keep the modal open for user
          },
        },
      ]);
    } catch (error: any) {
      console.error('Profile update error:', error);
      const errMsg =
        error instanceof Error
          ? error.message
          : String(error) || 'Failed to update profile. Please try again.';
      Alert.alert('Error', errMsg);
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  };

  // Phone verification handlers
  const handleVerifyCode = async () => {
    if (!phoneVerification.phone || !phoneVerification.code) {
      setPhoneVerification((prev) => ({ ...prev, message: 'Enter a valid code.' }));
      return;
    }
    setPhoneVerification((prev) => ({ ...prev, verifying: true }));
    const { success, message, error } = await verifyPhoneCode(
      currentUser!.id,
      phoneVerification.code!
    );
    setPhoneVerification((prev) => ({ ...prev, verifying: false }));
    if (!success) {
      const errMsg =
        error instanceof Error
          ? error.message
          : (error && (error as any).message) || 'Verification failed';
      setPhoneVerification((prev) => ({ ...prev, message: message || errMsg }));
      return;
    }

    // Refresh auth user to get updated phone
    const { user: refreshedUser } = await getCurrentUser();
    if (refreshedUser) setPhone(refreshedUser.phone || '');

    Alert.alert('Phone Verified', 'Your phone number has been verified and updated.', [
      {
        text: 'OK',
        onPress: () => {
          setPhoneVerification({ visible: false });
          navigation.goBack();
        },
      },
    ]);
  };

  const handleResendCode = async () => {
    if (!phoneVerification.phone || !currentUser) return;
    setPhoneVerification((prev) => ({ ...prev, sending: true }));
    const { success } = await requestPhoneVerification(currentUser.id, phoneVerification.phone!);
    setPhoneVerification((prev) => ({
      ...prev,
      sending: false,
      message: success ? 'Code resent' : 'Failed to send code',
    }));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
      </View>

      {/* Avatar Picker */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={handlePickImage}
          disabled={uploadingImage}
        >
          {localImageUri || avatarUrl ? (
            <Image
              source={{ uri: localImageUri || avatarUrl || undefined }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>📷</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handlePickImage} disabled={uploadingImage}>
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </TouchableOpacity>
        {uploadingImage && (
          <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 8 }} />
        )}
      </View>

      {/* Phone verification modal */}
      <Modal visible={phoneVerification.visible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(26, 26, 26, 0.4)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 }}>
              Verify Phone
            </Text>
            <Text style={{ color: '#6B6B6B', marginBottom: 12 }}>
              {phoneVerification.message ||
                `Enter the 6-digit code sent to ${phoneVerification.phone}`}
            </Text>
            <TextInput
              placeholder="Enter verification code"
              value={phoneVerification.code}
              onChangeText={(v) => setPhoneVerification((prev) => ({ ...prev, code: v }))}
              keyboardType="number-pad"
              style={{
                borderWidth: 0,
                backgroundColor: '#F0F0F0',
                color: '#1A1A1A',
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
              }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                onPress={() => setPhoneVerification({ visible: false })}
                style={{ padding: 10 }}
              >
                <Text style={{ color: '#6B6B6B' }}>Cancel</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  onPress={handleResendCode}
                  style={{ padding: 10, marginRight: 8 }}
                >
                  <Text style={{ color: '#5DBB8E' }}>Resend</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleVerifyCode} style={{ padding: 10 }}>
                  <Text style={{ color: '#5DBB8E' }}>
                    {phoneVerification.verifying ? 'Verifying...' : 'Verify'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Display Name */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={[styles.input, errors.displayName && styles.inputError]}
          placeholder="Enter your display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          maxLength={50}
        />
        {errors.displayName && <Text style={styles.errorText}>{errors.displayName}</Text>}
      </View>

      {/* Phone Number */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={[styles.input, errors.phone && styles.inputError]}
          placeholder="Enter your phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={14}
        />
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        <Text style={styles.helpText}>Format: (XXX) XXX-XXXX</Text>
      </View>

      {/* Zip Code */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Zip Code</Text>
        <TextInput
          style={[styles.input, errors.zipCode && styles.inputError]}
          placeholder="Enter your 5-digit zip code"
          value={zipCode}
          onChangeText={setZipCode}
          keyboardType="number-pad"
          maxLength={5}
        />
        {errors.zipCode && <Text style={styles.errorText}>{errors.zipCode}</Text>}
        <Text style={styles.helpText}>
          Changing zip code may reassign you to a different community node
        </Text>
      </View>

      {/* Bio */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Tell us a bit about yourself..."
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          maxLength={200}
          textAlignVertical="top"
        />
        <Text style={styles.helpText}>{bio.length}/200 characters</Text>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    marginBottom: 24,
    marginTop: 20,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3B82F6',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 40,
  },
  changePhotoText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 4,
  },
  helpText: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
