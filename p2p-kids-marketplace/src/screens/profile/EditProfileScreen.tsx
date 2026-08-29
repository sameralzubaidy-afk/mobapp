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
import {
  sendPhoneVerificationCode,
  verifyPhoneCode,
  OTPRateLimitError,
  OTPExpiredError,
} from '@/services/phoneService';
import {
  requestEmailChange,
  resendEmailChangeCode,
  verifyEmailChangeCode,
} from '@/services/emailChange';
import { captureException } from '@/services/errorReporter';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner, OTPInput } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';
import type { ProfileUpdateData } from '@/types/profile.types';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';
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

// Format the verify-modal resend countdown so it can express long rate-limit
// retry windows (>1h, e.g. the send-phone-otp 86400s daily cap) without dumping
// a huge raw-seconds number. The underlying value is never truncated — we only
// change how it is displayed, keeping it in agreement with the sibling
// "Too many attempts..." message that reports the same retryAfterSeconds.
const formatResendCountdown = (seconds: number): string => {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${seconds}s`;
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

  // Email re-verification state (Dev Task B02 / ACC-TC-B02): changing the email
  // does NOT apply immediately — a 6-digit code is emailed to the NEW address and
  // the OLD email stays active until verified. This modal drives that flow.
  const [emailVerification, setEmailVerification] = useState<{
    visible: boolean;
    newEmail?: string;
    code?: string;
    sending?: boolean;
    verifying?: boolean;
    message?: string;
  }>({ visible: false });
  const [emailResendCountdown, setEmailResendCountdown] = useState(0);
  // If the parent changed BOTH email and phone in one save, the phone verification
  // is deferred until the email code is verified (handleVerifyEmailCode resumes it).
  const [deferredPhoneChange, setDeferredPhoneChange] = useState<{
    newPhone: string;
    prevPhone: string;
  } | null>(null);

  const { refreshSession } = useAuth();

  const normalizePhone = useCallback((value: string) => value.replace(/\D/g, ''), []);

  // Convert a phone to E.164 for the Twilio/SMS send + verify boundary. The
  // send-phone-otp Edge Function requires +<country><number>; the Edit Profile
  // form uses plain digits (guide ACC-TC-B03: "the phone normalizes to digits"),
  // so we normalize only at the send/verify boundary and store/display digits.
  const toE164 = useCallback(
    (value: string): string => {
      const digits = normalizePhone(value);
      if (!digits) {
        return value;
      }
      if (digits.length === 10) {
        return `+1${digits}`;
      }
      if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`;
      }
      return value.trim().startsWith('+') ? value.trim() : `+${digits}`;
    },
    [normalizePhone]
  );

  useEffect(() => {
    if (!phoneVerification.visible || resendCountdown <= 0) {
      return;
    }

    const timer = setTimeout(() => setResendCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [phoneVerification.visible, resendCountdown]);

  useEffect(() => {
    if (!emailVerification.visible || emailResendCountdown <= 0) {
      return;
    }

    const timer = setTimeout(() => setEmailResendCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [emailVerification.visible, emailResendCountdown]);

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
        const phoneFromAuth =
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
        // NOTE: The legacy `phone_verification_codes.verified` column was removed by the
        // AUTH-V3 migration (20260420000014) — the table now stores only hashed OTP codes.
        // "Already verified" phone state is sourced from auth.users.phone and
        // profiles.phone_verified (see handleSave), so the old verified-row reconciliation
        // below queried a dropped column, errored silently, and is removed (ACC-TC-B09).
        void Promise.allSettled([
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
        captureException(error, {
          tags: { screen: 'EditProfileScreen', action: 'load_profile' },
        });
        Alert.alert('Error', 'Failed to load profile. Please try again.');
        navigation.goBack();
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [hydrateForm, navigation]
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

  const navigateToContactSupport = useCallback(() => {
    navigation.navigate('ContactSupport');
  }, [navigation]);

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
      captureException(error, {
        tags: { screen: 'EditProfileScreen', action: 'image_picker' },
      });
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Opens the phone verification modal when the phone changed. Returns true if
  // the modal is now open (caller should stop and wait for verification). Used
  // by handleSave and by handleVerifyEmailCode for the deferred
  // email-then-phone case (Dev Task B02).
  const startPhoneVerificationFlow = async (newPhone: string, prevPhone: string) => {
    const currentAuthPhone = normalizePhone(prevPhone);

    // Determine which phone numbers are already verified & active on this account.
    // The legacy `phone_verification_codes.verified` column no longer exists (removed
    // by the AUTH-V3 migration 20260420000014), so querying it used to error silently
    // and always open the OTP modal even for an already-active phone (ACC-TC-B09).
    // Verified-phone state now lives in auth.users.phone (set by auth-update-phone
    // after OTP) and profiles.phone + profiles.phone_verified.
    const accountVerifiedPhones = [
      normalizePhone((currentUser as any)?.phone || ''),
      ...(currentProfile?.phone_verified
        ? [normalizePhone((currentProfile as any)?.phone || '')]
        : []),
    ].filter((normalized) => normalized.length > 0);

    const alreadyVerified =
      accountVerifiedPhones.length > 0 && accountVerifiedPhones.includes(normalizePhone(newPhone));

    if (normalizePhone(newPhone) === currentAuthPhone || alreadyVerified) {
      // Phone already present/verified — update local UI and don't trigger verification
      setPhone(newPhone);
      setOriginalPhone(newPhone);
      Alert.alert('Info', 'This phone number is already verified and active on your account.');
      return false;
    }

    setPhoneVerification({
      visible: true,
      phone: newPhone,
      code: '',
      sending: true,
      message: undefined,
    });
    // Use the canonical phone-OTP stack (send-phone-otp Edge Function: Twilio SMS,
    // bcrypt-hashed codes, server-enforced rate limits) — same as the listing-gate
    // flow (ACC-TC-B03). The legacy direct-DB insert path (phone.ts) referenced
    // dropped columns (code/verified) and never sent an SMS in production.
    try {
      await sendPhoneVerificationCode(toE164(newPhone));
      setResendCountdown(60);
      setPhoneVerification((prev) => ({
        ...prev,
        sending: false,
        message: undefined,
      }));
      // Keep modal open and do not show overall success yet; wait for verification
      return true;
    } catch (err) {
      if (err instanceof OTPRateLimitError) {
        // Use the real retry window (no 3600s cap) so the countdown agrees with
        // the message below — the EF can return up to 86400s (daily cap).
        setResendCountdown(err.retryAfterSeconds);
        setPhoneVerification((prev) => ({
          ...prev,
          sending: false,
          message: `Too many attempts. Please try again in ${err.retryAfterSeconds} seconds.`,
        }));
        return false;
      }
      setPhoneVerification((prev) => ({
        ...prev,
        sending: false,
        message: 'Failed to send verification code. Please try again.',
      }));
      return false;
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
          captureException(uploadError, {
            tags: { screen: 'EditProfileScreen', action: 'avatar_upload' },
          });
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

      if (Object.keys(updates).length > 0) {
        const updateResult = await updateUserProfile(currentUser.id, updates, {
          includeAuthUser: false,
        });
        user = updateResult.user;
        error = updateResult.error;
      }

      // Email change requires re-verification (Dev Task B02 / ACC-TC-B02): do NOT
      // call supabase.auth.updateUser directly. Request a 6-digit code emailed to
      // the NEW address; the OLD email stays active on auth + profiles until the
      // code is verified, then the Edge Function applies the change.
      let emailVerificationPending = false;
      if (emailChanged) {
        const emailResult = await requestEmailChange(trimmedEmail);

        if (!emailResult.success) {
          error = new Error(
            emailResult.error?.message || "We couldn't update your email. Please try again."
          );
        } else {
          emailVerificationPending = true;
          setDeferredPhoneChange(
            phoneChanged ? { newPhone: trimmedPhone, prevPhone: originalPhone } : null
          );
          setEmailVerification({
            visible: true,
            newEmail: trimmedEmail,
            code: '',
            sending: false,
            message: undefined,
          });
          setEmailResendCountdown(60);
        }
      }

      // If phone was changed, start verification flow (non-blocking).
      // If the email also changed on the same save, defer phone verification until
      // after the email code is verified (handleVerifyEmailCode resumes it).
      if (phoneChanged && !emailVerificationPending) {
        const phoneModalOpened = await startPhoneVerificationFlow(trimmedPhone, originalPhone);
        if (phoneModalOpened) {
          return; // keep modal open, do not show success yet
        }
      }

      // Email verification is in progress — the code modal is open; do not navigate
      // away (and do not show the partial-update warning) until the code is verified.
      if (emailVerificationPending) {
        return;
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

      // NOTE: The waitlist prompt ("Area Not Yet Available") used to live here, reached only
      // when `updateUserProfile` returned needsWaitlist=true. That path is unreachable on
      // this screen: the ZIP input is locked (editable={false} — "Zip codes are locked to
      // your node."), so `updates.zip_code` is never sent and needsWaitlist stays false.
      // Removed as dead code (ACC-TC-B08); the waitlist prompt remains active on the
      // signup/ProfileSetup flow where ZIP is first entered.

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
          const {
            url,
            path,
            error: deferredUploadError,
          } = await uploadProfileAvatar(currentUser.id, deferredAvatarUri);

          if (deferredUploadError) {
            captureException(deferredUploadError, {
              tags: { screen: 'EditProfileScreen', action: 'deferred_avatar_upload' },
            });
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
              captureException(avatarUpdateResult.error, {
                tags: { screen: 'EditProfileScreen', action: 'deferred_avatar_db_update' },
              });
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
      captureException(error, {
        tags: { screen: 'EditProfileScreen', action: 'profile_update' },
      });
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
    if (
      !phoneVerification.phone ||
      !phoneVerification.code ||
      phoneVerification.code.length !== 6
    ) {
      setPhoneVerification((prev) => ({ ...prev, message: 'Please enter all 6 digits.' }));
      return;
    }
    const verifiedPhone = phoneVerification.phone || '';
    setPhoneVerification((prev) => ({ ...prev, verifying: true }));
    try {
      // Canonical verify: bcrypt compare via the verify_otp_code RPC; on success it
      // marks profiles.phone_verified/phone_verified_at/phone_verification_method
      // (ACC-TC-B03).
      await verifyPhoneCode(toE164(verifiedPhone), phoneVerification.code!);

      // Persist the verified phone as the account phone — auth.users.phone via the
      // auth-update-phone Edge Function (the canonical profile-service path). The
      // canonical verifyPhoneCode only marks the phone verified; it does not move
      // the account phone, which the Edit Profile hydration reads first.
      const persistResult = await updateUserProfile(
        currentUser!.id,
        { phone: normalizePhone(verifiedPhone) },
        { includeAuthUser: false }
      );
      setPhoneVerification((prev) => ({ ...prev, verifying: false }));

      if (persistResult.error) {
        // Code verified, but the account phone could not be saved — keep the modal
        // open so the user can retry rather than silently dropping the change.
        setPhoneVerification((prev) => ({
          ...prev,
          message:
            'Your code was verified, but we couldn\u2019t save the new phone. Please try again.',
        }));
        return;
      }

      if (verifiedPhone) {
        setPhone(verifiedPhone);
        setOriginalPhone(verifiedPhone);
      }
    } catch (err) {
      setPhoneVerification((prev) => ({ ...prev, verifying: false }));
      const message =
        err instanceof OTPExpiredError
          ? 'Code expired. Please request a new one.'
          : err instanceof Error
            ? err.message
            : 'Invalid verification code. Please try again.';
      setPhoneVerification((prev) => ({ ...prev, message }));
      return;
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
    try {
      await sendPhoneVerificationCode(toE164(phoneVerification.phone!));
      setResendCountdown(60);
      setPhoneVerification((prev) => ({ ...prev, sending: false, message: undefined }));
    } catch (err) {
      if (err instanceof OTPRateLimitError) {
        // Use the real retry window (no 3600s cap) so the countdown agrees with
        // the message below — the EF can return up to 86400s (daily cap).
        setResendCountdown(err.retryAfterSeconds);
        setPhoneVerification((prev) => ({
          ...prev,
          sending: false,
          message: `Too many attempts. Please try again in ${err.retryAfterSeconds} seconds.`,
        }));
        return;
      }
      setPhoneVerification((prev) => ({
        ...prev,
        sending: false,
        message: 'Failed to send verification code. Please try again.',
      }));
    }
  };

  // Email verification handlers (Dev Task B02 / ACC-TC-B02)
  const handleVerifyEmailCode = async () => {
    if (!emailVerification.code || emailVerification.code.length !== 6) {
      setEmailVerification((prev) => ({ ...prev, message: 'Please enter all 6 digits.' }));
      return;
    }
    setEmailVerification((prev) => ({ ...prev, verifying: true }));
    const result = await verifyEmailChangeCode(emailVerification.code!);
    setEmailVerification((prev) => ({ ...prev, verifying: false }));

    if (!result.success) {
      setEmailVerification((prev) => ({
        ...prev,
        message: result.error?.message || 'Verification failed. Please try again.',
      }));
      return;
    }

    const newEmail = result.newEmail || emailVerification.newEmail || '';
    setEmail(newEmail);
    setOriginalEmail(newEmail);
    setEmailResendCountdown(0);
    setEmailVerification({ visible: false });

    // Refresh the session so auth.user.email reflects the new address.
    // Promise.resolve guards against a non-Promise (or absent) refreshSession.
    Promise.resolve(refreshSession?.()).catch((refreshError) => {
      console.warn(
        '[EditProfileScreen] Failed to refresh session after email change',
        refreshError
      );
    });

    // If a phone change was deferred on the same save, resume it now.
    if (deferredPhoneChange) {
      const phoneModalOpened = await startPhoneVerificationFlow(
        deferredPhoneChange.newPhone,
        deferredPhoneChange.prevPhone
      );
      if (phoneModalOpened) {
        return; // keep the phone modal open, wait for phone verification
      }
      setDeferredPhoneChange(null);
    }

    // Auto-redirect to Profile after successful email verification.
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'Profile',
          params: {
            optimisticUserPatch: { email: newEmail },
            profileUpdatedAt: Date.now(),
          },
        },
      ],
    });
  };

  const handleResendEmailCode = async () => {
    if (!emailVerification.newEmail || emailResendCountdown > 0) return;
    setEmailVerification((prev) => ({ ...prev, sending: true, message: undefined }));
    const result = await resendEmailChangeCode();
    if (result.success) {
      setEmailResendCountdown(60);
    }
    setEmailVerification((prev) => ({
      ...prev,
      sending: false,
      message: result.success
        ? undefined
        : result.error?.message || 'Failed to resend the code. Please try again.',
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
    <ScreenLayout variant="detail" title="Edit Profile" onBack={navigateToProfile}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Avatar Picker */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              testID="edit-profile-avatar-button"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
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
                testID="edit-profile-phone-verify-cancel"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Cancel"
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
                  testID="edit-profile-phone-otp-input"
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
                testID="edit-profile-phone-verify-button"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Verify phone"
                style={[
                  styles.verificationPrimaryButton,
                  (phoneVerification.verifying || (phoneVerification.code || '').length !== 6) &&
                    styles.verificationPrimaryButtonDisabled,
                ]}
                onPress={handleVerifyCode}
                disabled={
                  phoneVerification.verifying || (phoneVerification.code || '').length !== 6
                }
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
                  <Text style={styles.verificationTimerText}>
                    Resend code in {formatResendCountdown(resendCountdown)}
                  </Text>
                ) : (
                  <TouchableOpacity
                    testID="edit-profile-phone-resend-button"
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="Resend verification code"
                    onPress={handleResendCode}
                  >
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

        {/* Email verification modal (Dev Task B02) — OLD email stays active until verified */}
        <Modal
          visible={emailVerification.visible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => {
            setEmailResendCountdown(0);
            setEmailVerification({ visible: false });
          }}
        >
          <View style={styles.verificationContainer}>
            <View style={styles.verificationHeader}>
              <TouchableOpacity
                testID="edit-profile-email-verify-cancel"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={() => {
                  setEmailResendCountdown(0);
                  setEmailVerification({ visible: false });
                }}
                style={styles.verificationBackButton}
              >
                <Text style={styles.verificationBackButtonText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.verificationTitle}>Verify Your Email</Text>
              <View style={styles.verificationHeaderSpacer} />
            </View>

            <View style={styles.verificationContent}>
              <Text style={styles.verificationSubtitle}>
                We sent a 6-digit code to{`\n`}
                <Text style={styles.verificationPhone}>{emailVerification.newEmail}</Text>
              </Text>

              <View style={styles.verificationOtpContainer}>
                <OTPInput
                  length={6}
                  testID="edit-profile-email-otp-input"
                  value={emailVerification.code || ''}
                  onChange={(newCode) =>
                    setEmailVerification((prev) => ({ ...prev, code: newCode, message: undefined }))
                  }
                  error={Boolean(emailVerification.message)}
                />
              </View>

              {__DEV__ && (
                <Text style={styles.verificationDevHint}>
                  Dev/QA mode: the code is 123456 on staging.
                </Text>
              )}

              {emailVerification.message && (
                <Text style={styles.verificationErrorText}>{emailVerification.message}</Text>
              )}

              <TouchableOpacity
                testID="edit-profile-email-verify-button"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Verify email"
                style={[
                  styles.verificationPrimaryButton,
                  (emailVerification.verifying || (emailVerification.code || '').length !== 6) &&
                    styles.verificationPrimaryButtonDisabled,
                ]}
                onPress={handleVerifyEmailCode}
                disabled={
                  emailVerification.verifying || (emailVerification.code || '').length !== 6
                }
              >
                {emailVerification.verifying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.verificationPrimaryButtonText}>Verify</Text>
                )}
              </TouchableOpacity>

              <View style={styles.verificationResendContainer}>
                {emailVerification.sending ? (
                  <Text style={styles.verificationTimerText}>Sending...</Text>
                ) : emailResendCountdown > 0 ? (
                  <Text style={styles.verificationTimerText}>
                    Resend code in {formatResendCountdown(emailResendCountdown)}
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResendEmailCode}>
                    <Text style={styles.verificationResendText}>Resend Code</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* Full Name (locked) */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>FULL NAME (CANNOT BE CHANGED)</Text>
            <TouchableOpacity
              testID="edit-profile-full-name-help"
              accessible
              accessibilityRole="button"
              style={styles.supportIconButton}
              onPress={navigateToContactSupport}
              accessibilityLabel="Contact support to change full name"
            >
              <Question size={16} color="#5DBB8E" weight="fill" />
            </TouchableOpacity>
          </View>
          <View style={[styles.inputWrapper, styles.inputDisabled]}>
            <User size={20} color="#999999" weight="regular" style={{ marginRight: 12 }} />
            <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
              style={[styles.input, styles.inputTextDisabled]}
              value={displayName}
              editable={false}
            />
          </View>
        </View>

        {/* Date of Birth (locked) */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>DATE OF BIRTH (CANNOT BE CHANGED)</Text>
            <TouchableOpacity
              testID="edit-profile-dob-help"
              accessible
              accessibilityRole="button"
              style={styles.supportIconButton}
              onPress={navigateToContactSupport}
              accessibilityLabel="Contact support to change date of birth"
            >
              <Question size={16} color="#5DBB8E" weight="fill" />
            </TouchableOpacity>
          </View>
          <View style={[styles.inputWrapper, styles.inputDisabled]}>
            <CalendarBlank size={20} color="#999999" weight="regular" style={{ marginRight: 12 }} />
            <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
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
            <EnvelopeSimple
              size={20}
              color="#6B6B6B"
              weight="regular"
              style={{ marginRight: 12 }}
            />
            <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
              testID="edit-profile-email-input"
              accessibilityLabel="Email address"
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
            <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
              testID="edit-profile-phone-input"
              accessibilityLabel="Phone number"
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
            <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
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
          <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
            testID="edit-profile-bio-input"
            accessibilityLabel="Bio"
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
          testID="edit-profile-save-button"
          accessible
          accessibilityRole="button"
          accessibilityLabel="Save Changes"
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
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 20,
    // Clear the floating pill bottom nav (PersistentTabBar) so the Save Changes
    // button scrolls fully above it — matches the app-wide 100px clearance used
    // by Profile/Home/Cart etc.
    paddingBottom: 100,
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
    // ≥44pt touch target (accessibility minimum) so the AX-reported frame and the
    // tappable region coincide. The button was previously only ~27pt tall
    // (paddingVertical 4 + fontSize-16 text): the reported AX frame center missed
    // the actual touch region in the fullScreen verify modal, and QA's empirically
    // working tap (~pt y=58) landed exactly at the center of a 44pt target.
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
