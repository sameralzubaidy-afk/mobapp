// File: p2p-kids-marketplace/src/screens/profile/EditProfileScreen.tsx
// AUTH-006: User Profile Editing
// TASK FLOW-15: UI Redesign - Phosphor icons, filled inputs, green theme

import React, { useState, useEffect, useCallback } from 'react';
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
  Modal,
} from 'react-native';
import {
  User,
  Camera,
  MapPin,
  Phone,
  CaretLeft,
  CalendarBlank,
  EnvelopeSimple,
  Question,
} from 'phosphor-react-native';
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
import { LoadingSpinner, OTPInput } from '@/components/ui';
import type { ProfileUpdateData } from '@/types/profile.types';
// Temporary fallback: generated Database types may be missing in local dev.
// Use `any` here to unblock type-checking until DB types are generated.
type UserProfile = any;
const SUPPORT_CONTACT_EMAIL = 'admin-support@kidsmarketplace.app';

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

export default function EditProfileScreen({ navigation, route }: any) {
  const preloadedUser = route?.params?.preloadedUser;
  const preloadedProfile = route?.params?.preloadedProfile;

  const [loading, setLoading] = useState(!(preloadedUser && preloadedProfile));
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [originalPhone, setOriginalPhone] = useState('');
  const [originalZipCode, setOriginalZipCode] = useState('');
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
  const [resendCountdown, setResendCountdown] = useState(0);

  const { refreshSession } = useAuth();

  const normalizePhone = useCallback((value: string) => value.replace(/\D/g, ''), []);

  useEffect(() => {
    if (!phoneVerification.visible || resendCountdown <= 0) {
      return;
    }

    const timer = setTimeout(() => setResendCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [phoneVerification.visible, resendCountdown]);

  const hydrateForm = useCallback((authUser: any, profile: any, overridePhone?: string) => {
    setCurrentUser(authUser);
    setCurrentProfile(profile);
    setDisplayName((profile as any)?.name || '');
    setDob(
      (profile as any)?.dob ||
        (profile as any)?.date_of_birth ||
        (authUser as any)?.user_metadata?.dob ||
        ''
    );
    const initialEmail = (authUser as any)?.email || (profile as any)?.email || '';
    setEmail(initialEmail);
    setOriginalEmail(initialEmail);
    setBio((profile as any)?.bio || '');
    const initialZip = (profile as any)?.zip_code || '';
    setZipCode(initialZip);
    setOriginalZipCode(initialZip);

    const phoneFromAuth =
      overridePhone || (authUser as any)?.phone || (authUser as any)?.user_metadata?.phone || '';
    const initialPhone = phoneFromAuth || '';
    setPhone(initialPhone);
    setOriginalPhone(initialPhone);

    const profileAvatar = (profile as any)?.avatar_url;
    const metadataAvatar = (authUser as any)?.user_metadata?.avatar_url;
    const immediateAvatar =
      typeof profileAvatar === 'string' && profileAvatar.startsWith('http')
        ? profileAvatar
        : metadataAvatar || null;
    setAvatarUrl(immediateAvatar);
  }, []);

  const loadUserProfile = useCallback(
    async ({ showLoader = true }: { showLoader?: boolean } = {}) => {
      if (showLoader) {
        setLoading(true);
      }

      try {
        const { user: authUser, error: authError } = await getCurrentUser();
        if (authError || !authUser) {
          throw new Error('Unable to get current user');
        }

        const { user: profile, error: profileError } = await getUserProfile(authUser.id);
        if (profileError || !profile) {
          throw new Error('Unable to load profile');
        }

        // Phone may exist on auth user top-level or inside user_metadata
        let phoneFromAuth =
          (authUser as any).phone ||
          (authUser as any).user_metadata?.phone ||
          (profile as any)?.phone ||
          '';

        // Render key fields immediately for faster UX.
        hydrateForm(authUser, profile, phoneFromAuth);

        if (showLoader) {
          setLoading(false);
        }

        // Run slower enrichments in background without blocking first render.
        void Promise.allSettled([
          (async () => {
            // Always reconcile with the latest verified phone row because auth metadata can be stale.

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
                const verifiedPhone = phoneData.phone;
                if (normalizePhone(verifiedPhone) !== normalizePhone(phoneFromAuth)) {
                  phoneFromAuth = verifiedPhone;
                  setPhone(verifiedPhone);
                  setOriginalPhone(verifiedPhone);
                }
              }
            } catch (e) {
              console.warn('Error fetching verified phone:', e);
            }
          })(),
          (async () => {
            // Resolve avatar URL: profile.avatar_url could be a full URL or a storage path.
            try {
              const resolvedAvatar = await resolveAvatarUrl((profile as any)?.avatar_url);
              if (resolvedAvatar) {
                setAvatarUrl(resolvedAvatar);
              }
            } catch (e) {
              console.warn('Error resolving avatar URL:', e);
            }
          })(),
        ]);
      } catch (error: any) {
        console.error('Load profile error:', error);
        Alert.alert('Error', 'Failed to load profile. Please try again.');
        navigation.goBack();
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [hydrateForm, navigation, normalizePhone]
  );

  useEffect(() => {
    // Instant hydration from Profile screen navigation params, then background refresh.
    if (preloadedUser && preloadedProfile) {
      hydrateForm(preloadedUser, preloadedProfile);
      setLoading(false);
      void loadUserProfile({ showLoader: false });
      return;
    }

    void loadUserProfile({ showLoader: true });
  }, [preloadedUser, preloadedProfile, hydrateForm, loadUserProfile]);

  const navigateToProfile = useCallback(() => {
    navigation.navigate('Profile');
  }, [navigation]);

  const showContactSupportAlert = useCallback(() => {
    Alert.alert('Contact Support', `For profile help, contact ${SUPPORT_CONTACT_EMAIL}.`);
  }, []);

  const formatDobForDisplay = useCallback((value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return 'Not provided';
    }

    const parsedDob = new Date(trimmedValue);
    if (Number.isNaN(parsedDob.getTime())) {
      return trimmedValue;
    }

    return parsedDob.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (zipCode.trim() && !/^\d{5}$/.test(zipCode.trim())) {
      newErrors.zipCode = 'Zip code must be 5 digits';
    }

    if (phone.trim() && !/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Phone number must be 10 digits';
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
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
      const trimmedDisplayName = displayName.trim();
      const trimmedBio = bio.trim();
      const trimmedZip = zipCode.trim();
      const trimmedPhone = phone.trim();
      const trimmedEmail = email.trim().toLowerCase();
      const phoneChanged = normalizePhone(trimmedPhone) !== normalizePhone(originalPhone);
      const emailChanged = trimmedEmail !== (originalEmail || '').trim().toLowerCase();
      const shouldDeferAvatarUpload = Boolean(localImageUri) && !phoneChanged;

      let uploadedAvatarPath: string | null = null;
      let uploadedAvatarUrl: string | null = null;

      // Upload new avatar if user selected one
      if (localImageUri && !shouldDeferAvatarUpload) {
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
          uploadedAvatarUrl = url ?? null;
          if (url) setAvatarUrl(url);
        }
      }

      // Prepare update data (only include changed fields)
      const updates: ProfileUpdateData = {};

      if (trimmedBio !== (currentProfile.bio || '')) {
        updates.bio = trimmedBio;
      }
      if (trimmedZip !== originalZipCode) {
        updates.zip_code = trimmedZip;
      }
      if (uploadedAvatarPath) {
        updates.avatar_url = uploadedAvatarPath;
      }

      // Treat phone change as a real change even when no profile fields changed.
      if (Object.keys(updates).length === 0 && !localImageUri && !phoneChanged && !emailChanged) {
        Alert.alert('No Changes', 'No changes were made to your profile.', [
          {
            text: 'OK',
            onPress: navigateToProfile,
          },
        ]);
        return;
      }

      let user: any = null;
      let error: any = null;
      let needsWaitlist = false;
      let updatedZip: string | undefined;

      if (Object.keys(updates).length > 0) {
        const updateResult = await updateUserProfile(currentUser.id, updates, {
          includeAuthUser: false,
        });
        user = updateResult.user;
        error = updateResult.error;
        needsWaitlist = Boolean(updateResult.needsWaitlist);
        updatedZip = updateResult.zipCode;
      }

      if (emailChanged) {
        const { error: emailUpdateError } = await supabase.auth.updateUser({
          email: trimmedEmail,
        } as any);

        if (emailUpdateError) {
          error = emailUpdateError;
        } else {
          setEmail(trimmedEmail);
          setOriginalEmail(trimmedEmail);

          const { error: profileEmailUpdateError } = await supabase
            .from('profiles')
            .update({ email: trimmedEmail })
            .eq('user_id', currentUser.id);

          if (profileEmailUpdateError) {
            console.warn('Failed to sync profile email after auth email update:', profileEmailUpdateError);
          }
        }
      }

      // If phone was changed, start verification flow (non-blocking)
      if (phoneChanged) {
        const currentAuthPhone = normalizePhone(originalPhone);

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
              alreadyVerified =
                normalizePhone((verifiedRow as any).phone || '') === normalizePhone(trimmedPhone);
          }
        } catch (e) {
          console.warn('Could not check verified phone records:', e);
        }

        if (normalizePhone(trimmedPhone) === currentAuthPhone || alreadyVerified) {
          // Phone already present/verified — update local UI and don't trigger verification
          setPhone(trimmedPhone);
          setOriginalPhone(trimmedPhone);
          Alert.alert('Info', 'This phone number is already verified and active on your account.');
        } else {
          setPhoneVerification({
            visible: true,
            phone: trimmedPhone,
            code: '',
            sending: true,
            message: undefined,
          });
          const { success } = await requestPhoneVerification(currentUser.id, trimmedPhone);
          if (!success) {
            setPhoneVerification((prev) => ({
              ...prev,
              sending: false,
              message: 'Failed to send verification code. Please try again.',
            }));
            return; // stop here, do not show success
          } else {
            setResendCountdown(60);
            setPhoneVerification((prev) => ({
              ...prev,
              sending: false,
              message: undefined,
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
      if (user && user.phone) {
        setPhone(user.phone);
        setOriginalPhone(user.phone);
      }

      // Keep original zip in sync after successful update.
      setOriginalZipCode(trimmedZip);

      const optimisticProfilePatch = {
        name: trimmedDisplayName || (currentProfile as any)?.name || '',
        bio: trimmedBio,
        zip_code: trimmedZip || (currentProfile as any)?.zip_code || '',
        avatar_url:
          uploadedAvatarUrl ||
          localImageUri ||
          avatarUrl ||
          (currentProfile as any)?.avatar_url ||
          null,
      };

      const optimisticUserPatch = {
        phone: trimmedPhone,
        email: trimmedEmail || (currentUser as any)?.email || '',
      };

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
        void refreshSession().catch((refreshError) => {
          console.warn(
            '[EditProfileScreen] Failed to refresh session after profile update',
            refreshError
          );
        });
      }

      // Return immediately for smooth UX and let Profile screen show optimistic changes.
      navigation.navigate('Profile', {
        optimisticProfilePatch,
        optimisticUserPatch,
        profileUpdatedAt: Date.now(),
      });

      if (shouldDeferAvatarUpload && localImageUri) {
        const deferredAvatarUri = localImageUri;

        void (async () => {
          const { url, path, error: deferredUploadError } = await uploadProfileAvatar(
            currentUser.id,
            deferredAvatarUri
          );

          if (deferredUploadError) {
            console.error('Deferred avatar upload error:', deferredUploadError);
            Alert.alert(
              'Avatar Upload Failed',
              'Profile details were saved, but avatar upload failed. Please try uploading the avatar again.'
            );
            return;
          }

          if (path) {
            const avatarUpdateResult = await updateUserProfile(
              currentUser.id,
              { avatar_url: path },
              { includeAuthUser: false }
            );

            if (avatarUpdateResult.error) {
              console.error('Deferred avatar DB update error:', avatarUpdateResult.error);
              return;
            }
          }

          navigation.navigate('Profile', {
            optimisticProfilePatch: {
              avatar_url: url || deferredAvatarUri,
            },
            profileUpdatedAt: Date.now(),
          });
        })();
      }

      return;
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
    if (!phoneVerification.phone || !phoneVerification.code || phoneVerification.code.length !== 6) {
      setPhoneVerification((prev) => ({ ...prev, message: 'Please enter all 6 digits.' }));
      return;
    }
    setPhoneVerification((prev) => ({ ...prev, verifying: true }));
    const { success, message, error } = await verifyPhoneCode(
      currentUser!.id,
      phoneVerification.code!,
      phoneVerification.phone
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

    const verifiedPhone = phoneVerification.phone || '';
    if (verifiedPhone) {
      setPhone(verifiedPhone);
      setOriginalPhone(verifiedPhone);
    }

    // Auto-redirect to Profile after successful verification (no extra confirmation tap)
    setResendCountdown(0);
    setPhoneVerification({ visible: false });
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'Profile',
          params: {
            optimisticUserPatch: {
              phone: verifiedPhone,
            },
            profileUpdatedAt: Date.now(),
          },
        },
      ],
    });
  };

  const handleResendCode = async () => {
    if (!phoneVerification.phone || !currentUser || resendCountdown > 0) return;
    setPhoneVerification((prev) => ({ ...prev, sending: true }));
    const { success } = await requestPhoneVerification(currentUser.id, phoneVerification.phone!);
    if (success) {
      setResendCountdown(60);
    }
    setPhoneVerification((prev) => ({
      ...prev,
      sending: false,
      message: success ? undefined : 'Failed to send verification code. Please try again.',
    }));
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <LoadingSpinner fullScreen text="Loading profile..." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={navigateToProfile} style={styles.backButton}>
          <CaretLeft size={20} color="#5DBB8E" weight="bold" style={{ marginRight: 4 }} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
      </View>

      {/* Avatar Picker */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarContainer}>
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
                <User size={40} color="#6B6B6B" weight="regular" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.cameraOverlay}>
            <Camera size={14} color="#FFFFFF" weight="regular" />
          </View>
        </View>
        <TouchableOpacity onPress={handlePickImage} disabled={uploadingImage}>
          <Text style={styles.changePhotoText}>Tap to change</Text>
        </TouchableOpacity>
        {uploadingImage && (
          <ActivityIndicator size="small" color="#5DBB8E" style={{ marginTop: 8 }} />
        )}
      </View>

      {/* Phone verification modal */}
      <Modal
        visible={phoneVerification.visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setResendCountdown(0);
          setPhoneVerification({ visible: false });
        }}
      >
        <View style={styles.verificationContainer}>
          <View style={styles.verificationHeader}>
            <TouchableOpacity
              onPress={() => {
                setResendCountdown(0);
                setPhoneVerification({ visible: false });
              }}
              style={styles.verificationBackButton}
            >
              <Text style={styles.verificationBackButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.verificationTitle}>Verify Your Phone</Text>
            <View style={styles.verificationHeaderSpacer} />
          </View>

          <View style={styles.verificationContent}>
            <Text style={styles.verificationSubtitle}>
              We sent a 6-digit code to{`\n`}
              <Text style={styles.verificationPhone}>{phoneVerification.phone}</Text>
            </Text>

            <View style={styles.verificationOtpContainer}>
              <OTPInput
                length={6}
                value={phoneVerification.code || ''}
                onChange={(newCode) =>
                  setPhoneVerification((prev) => ({ ...prev, code: newCode, message: undefined }))
                }
                error={Boolean(phoneVerification.message)}
              />
            </View>

            {__DEV__ && (
              <Text style={styles.verificationDevHint}>Dev mode: use 123456 to skip SMS.</Text>
            )}

            {phoneVerification.message && (
              <Text style={styles.verificationErrorText}>{phoneVerification.message}</Text>
            )}

            <TouchableOpacity
              style={[
                styles.verificationPrimaryButton,
                (phoneVerification.verifying || (phoneVerification.code || '').length !== 6) &&
                  styles.verificationPrimaryButtonDisabled,
              ]}
              onPress={handleVerifyCode}
              disabled={phoneVerification.verifying || (phoneVerification.code || '').length !== 6}
            >
              {phoneVerification.verifying ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verificationPrimaryButtonText}>Verify</Text>
              )}
            </TouchableOpacity>

            <View style={styles.verificationResendContainer}>
              {phoneVerification.sending ? (
                <Text style={styles.verificationTimerText}>Sending...</Text>
              ) : resendCountdown > 0 ? (
                <Text style={styles.verificationTimerText}>Resend code in {resendCountdown}s</Text>
              ) : (
                <TouchableOpacity onPress={handleResendCode}>
                  <Text style={styles.verificationResendText}>Resend Code</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.verificationChangePhoneButton}
              onPress={() => {
                setResendCountdown(0);
                setPhoneVerification({ visible: false });
              }}
            >
              <Text style={styles.verificationChangePhoneText}>Change Phone Number</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full Name (locked) */}
      <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>FULL NAME (CANNOT BE CHANGED)</Text>
          <TouchableOpacity
            style={styles.supportIconButton}
            onPress={showContactSupportAlert}
            accessibilityLabel="Contact support to change full name"
          >
            <Question size={16} color="#5DBB8E" weight="fill" />
          </TouchableOpacity>
        </View>
        <View style={[styles.inputWrapper, styles.inputDisabled]}>
          <User size={20} color="#999999" weight="regular" style={{ marginRight: 12 }} />
          <TextInput style={[styles.input, styles.inputTextDisabled]} value={displayName} editable={false} />
        </View>
      </View>

      {/* Date of Birth (locked) */}
      <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>DATE OF BIRTH (CANNOT BE CHANGED)</Text>
          <TouchableOpacity
            style={styles.supportIconButton}
            onPress={showContactSupportAlert}
            accessibilityLabel="Contact support to change date of birth"
          >
            <Question size={16} color="#5DBB8E" weight="fill" />
          </TouchableOpacity>
        </View>
        <View style={[styles.inputWrapper, styles.inputDisabled]}>
          <CalendarBlank size={20} color="#999999" weight="regular" style={{ marginRight: 12 }} />
          <TextInput
            style={[styles.input, styles.inputTextDisabled]}
            value={formatDobForDisplay(dob)}
            editable={false}
          />
        </View>
      </View>

      {/* Email Address */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>EMAIL ADDRESS</Text>
        <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
          <EnvelopeSimple size={20} color="#6B6B6B" weight="regular" style={{ marginRight: 12 }} />
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#999999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      {/* Phone Number */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>PHONE NUMBER</Text>
        <View style={[styles.inputWrapper, errors.phone && styles.inputError]}>
          <Phone size={20} color="#6B6B6B" weight="regular" style={{ marginRight: 12 }} />
          <TextInput
            style={styles.input}
            placeholder="(XXX) XXX-XXXX"
            placeholderTextColor="#999999"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={14}
          />
        </View>
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
      </View>

      {/* Zip Code */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>ZIP CODE (CANNOT BE CHANGED)</Text>
        <View style={[styles.inputWrapper, styles.inputDisabled]}>
          <MapPin size={20} color="#999999" weight="regular" style={{ marginRight: 12 }} />
          <TextInput
            style={[styles.input, styles.inputTextDisabled]}
            value={zipCode}
            editable={false}
          />
        </View>
        <Text style={styles.helperText}>Zip codes are locked to your node.</Text>
      </View>

      {/* Bio */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>BIO</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Tell us a bit about yourself..."
          placeholderTextColor="#999999"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          maxLength={200}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{bio.length}/200 characters</Text>
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
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B6B6B',
  },
  header: {
    marginBottom: 24,
    marginTop: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#5DBB8E',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    width: 96,
    height: 96,
    marginBottom: 8,
  },
  avatarButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#5DBB8E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    textTransform: 'uppercase',
    color: '#6B6B6B',
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  supportIconButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#E85D75',
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.8,
  },
  inputTextDisabled: {
    color: '#999999',
  },
  helperText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  textArea: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    minHeight: 100,
  },
  errorText: {
    color: '#E85D75',
    fontSize: 14,
    marginTop: 4,
  },
  charCount: {
    color: '#999999',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  saveButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  verificationContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginTop: 20,
  },
  verificationBackButton: {
    paddingVertical: 4,
  },
  verificationBackButtonText: {
    fontSize: 16,
    color: '#5DBB8E',
  },
  verificationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  verificationHeaderSpacer: {
    width: 52,
  },
  verificationContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  verificationSubtitle: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  verificationPhone: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
  verificationOtpContainer: {
    marginBottom: 12,
  },
  verificationErrorText: {
    fontSize: 14,
    color: '#E85D75',
    textAlign: 'center',
    marginBottom: 8,
  },
  verificationDevHint: {
    fontSize: 13,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 8,
  },
  verificationPrimaryButton: {
    height: 56,
    borderRadius: 26,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  verificationPrimaryButtonDisabled: {
    opacity: 0.5,
  },
  verificationPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  verificationResendContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  verificationResendText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  verificationTimerText: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  verificationChangePhoneButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  verificationChangePhoneText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B6B6B',
  },
});
