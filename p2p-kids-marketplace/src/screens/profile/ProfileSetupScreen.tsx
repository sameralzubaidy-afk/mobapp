// File: p2p-kids-marketplace/src/screens/profile/ProfileSetupScreen.tsx
// AUTH-005: User Profile Creation after phone verification

import React, { useState } from 'react';
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
import { setupUserProfile, uploadProfileAvatar } from '@/services/profile';
import { captureException } from '@/services/errorReporter';
import { getCurrentUser } from '@/services/supabase/auth';
import { upsertZipWaitlist } from '@/services/waitlist';
import type { ProfileSetupData } from '@/types/profile.types';
import { useAuth } from '@/hooks/useAuth';
import { User, Camera, MapPin } from 'phosphor-react-native';
import * as FileSystem from 'expo-file-system/legacy';

export default function ProfileSetupScreen({ navigation: _navigation }: any) {
  const { refreshSession } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isWaitlistPromptVisible, setIsWaitlistPromptVisible] = useState(false);
  const [isWaitlistConfirmedVisible, setIsWaitlistConfirmedVisible] = useState(false);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [waitlistContext, setWaitlistContext] = useState<{
    userId: string;
    email: string;
    requestedZip: string;
    assignedNodeId: string | null;
    assignedNodeName: string;
  } | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [bio, setBio] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const continueToPostAuthFlow = async () => {
    // RootNavigator owns first-run onboarding gating. After profile setup,
    // refresh auth context and let RootNavigator route to EDU carousel/Home.
    await refreshSession(false);
  };

  const handleJoinWaitlist = async () => {
    if (!waitlistContext || isJoiningWaitlist) {
      return;
    }

    setIsJoiningWaitlist(true);

    try {
      await upsertZipWaitlist({
        userId: waitlistContext.userId,
        email: waitlistContext.email,
        requestedZip: waitlistContext.requestedZip,
        assignedNodeId: waitlistContext.assignedNodeId,
      });

      setIsWaitlistPromptVisible(false);
      setIsWaitlistConfirmedVisible(true);
    } catch (error) {
      captureException(error, {
        tags: { screen: 'ProfileSetupScreen', action: 'waitlist_error' },
      });
      setIsWaitlistPromptVisible(false);
      Alert.alert('Info', 'Could not add to waitlist, but you can still use the app!', [
        {
          text: 'OK',
          onPress: () => {
            void continueToPostAuthFlow();
          },
        },
      ]);
    } finally {
      setIsJoiningWaitlist(false);
    }
  };

  const handleZipCodeChange = async (zip: string) => {
    setZipCode(zip);

    // Auto-lookup city and state when ZIP is 5 digits
    if (zip.length === 5) {
      try {
        const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
        if (response.ok) {
          const data = await response.json();
          setCity(data.places[0]['place name']);
          setState(data.places[0]['state abbreviation']);
        } else {
          setCity('');
          setState('');
        }
      } catch (error) {
        captureException(error, {
          tags: { screen: 'ProfileSetupScreen', action: 'zip_lookup' },
        });
        setCity('');
        setState('');
      }
    } else {
      setCity('');
      setState('');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    } else if (displayName.trim().length < 2) {
      newErrors.displayName = 'Display name must be at least 2 characters';
    }

    if (!zipCode.trim()) {
      newErrors.zipCode = 'Zip code is required';
    } else if (!/^\d{5}$/.test(zipCode.trim())) {
      newErrors.zipCode = 'Zip code must be 5 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePickImage = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');

      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photos to upload a profile picture.'
        );
        return;
      }

      // Pick image
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
        tags: { screen: 'ProfileSetupScreen', action: 'image_picker' },
      });
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // DEV-ONLY fixture: inject a bundled avatar into localImageUri, bypassing the
  // native photo-picker crop editor (expo-image-picker allowsEditing), which is
  // undrivable by QA automation — same limitation class as the documented
  // CategorySelectModal issue. Gated by __DEV__ — never in release builds.
  // Local state only (no direct upload), so the avatar preview update becomes
  // toolset-verifiable without the native picker.
  //
  // The bundled asset is COPIED into the app cache first so the resulting URI is
  // a local file:// path (identical to a real expo-image-picker result): the
  // rest of the avatar pipeline (uploadProfileAvatar →
  // ImageManipulator.manipulateAsync) can only read LOCAL file URIs, not the raw
  // Metro dev-server asset URL (Expo Go: http://localhost:8081/assets/...) or
  // the file:// bundle path (dev-client build). Without this copy, the upload
  // silently fails and avatar_url stays null in the DB.
  const handleDevSetAvatar = async () => {
    try {
      const source = Image.resolveAssetSource(require('../../../assets/adaptive-icon.png'));
      const uri = source?.uri;
      if (!uri) {
        console.warn('[ProfileSetupScreen] Dev avatar fixture: bundled asset unresolved');
        return;
      }

      const cacheDirectory = FileSystem.cacheDirectory;
      if (!cacheDirectory) {
        console.warn('[ProfileSetupScreen] Dev avatar fixture: cache directory unavailable');
        return;
      }

      const destUri = `${cacheDirectory}dev-avatar-${Date.now()}.png`;
      // Local bundle path (dev-client build) → copy; remote Metro asset URL
      // (Expo Go) → download. Both land on a file:// cache path that the
      // ImageManipulator-based upload can read.
      if (uri.startsWith('file://')) {
        await FileSystem.copyAsync({ from: uri, to: destUri });
      } else {
        await FileSystem.downloadAsync(uri, destUri);
      }

      setLocalImageUri(destUri);
    } catch (error) {
      console.warn('[ProfileSetupScreen] Dev avatar fixture: failed to prepare local asset', error);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Get current user
      const { user: currentUser, error: userError } = await getCurrentUser();
      if (userError || !currentUser) {
        throw new Error('Unable to get current user. Please try logging in again.');
      }

      let uploadedAvatarUrl: string | null = null;
      let uploadedAvatarPath: string | null = null;

      // Upload avatar if user selected one
      if (localImageUri) {
        setUploadingImage(true);
        const {
          url,
          path,
          error: uploadError,
        } = await uploadProfileAvatar(currentUser.id, localImageUri);
        setUploadingImage(false);

        if (uploadError) {
          captureException(uploadError, {
            tags: { screen: 'ProfileSetupScreen', action: 'avatar_upload' },
          });
          Alert.alert('Warning', 'Profile will be created without avatar. You can add it later.');
        } else {
          uploadedAvatarUrl = url;
          uploadedAvatarPath = path ?? null;
        }
      }

      // Setup profile
      const profileData: ProfileSetupData = {
        display_name: displayName.trim(),
        zip_code: zipCode.trim(),
        bio: bio.trim() || undefined,
        avatar_url: uploadedAvatarPath || uploadedAvatarUrl || undefined,
        email: currentUser.email,
        phone: currentUser.user_metadata?.phone || currentUser.phone,
      };

      const {
        error,
        needsWaitlist,
        zipCode: userZip,
        matchType,
        assignedNodeId,
        assignedNodeName,
      } = await setupUserProfile(currentUser.id, profileData);

      if (error) {
        throw error;
      }

      // NODE-003: Check if user needs to be added to waitlist
      if (needsWaitlist && userZip && matchType === 'nearest') {
        console.log('⚠️ [NODE-003] Showing waitlist popup for inactive ZIP:', userZip);

        setWaitlistContext({
          userId: currentUser.id,
          email: currentUser.email || '',
          requestedZip: userZip,
          assignedNodeId: assignedNodeId || null,
          assignedNodeName: assignedNodeName || 'your assigned area',
        });
        setIsWaitlistPromptVisible(true);
      } else {
        // Profile created successfully - let RootNavigator choose next screen.
        Alert.alert('Success', 'Your profile has been created!', [
          {
            text: 'OK',
            onPress: () => {
              void continueToPostAuthFlow();
            },
          },
        ]);
      }
    } catch (error: any) {
      captureException(error, {
        tags: { screen: 'ProfileSetupScreen', action: 'profile_setup' },
        extra: { message: error?.message },
      });
      Alert.alert('Error', error.message || 'Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      testID="profile-setup-screen"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>
          Tell us a bit about yourself and we'll connect you to your local community
        </Text>
      </View>

      {/* Avatar Picker */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={handlePickImage}
          disabled={uploadingImage}
          testID="avatar-upload-button"
          accessible
          accessibilityRole="button"
          accessibilityLabel="Avatar upload button"
        >
          {localImageUri ? (
            <Image source={{ uri: localImageUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Camera size={40} color="#6B6B6B" weight="regular" />
            </View>
          )}
        </TouchableOpacity>
        {uploadingImage && (
          <ActivityIndicator size="small" color="#5DBB8E" style={{ marginTop: 8 }} />
        )}

        {/* DEV-ONLY: bypass the native photo-picker crop editor (undrivable by QA
            automation — same class as the documented CategorySelectModal issue)
            so the avatar-preview update is verifiable without the native picker.
            Gated by __DEV__ — never rendered in release builds. Local state only
            (sets localImageUri to a cache file:// path); the normal Complete
            Setup flow performs the actual upload. */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.devAvatarButton}
            onPress={handleDevSetAvatar}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Set test avatar (dev only)"
            testID="dev-set-avatar"
          >
            <Text style={styles.devAvatarButtonText}>Dev: Set Test Avatar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Display Name */}
      <View style={styles.inputGroup}>
        <Text style={styles.label} testID="display-name-label">
          DISPLAY NAME
        </Text>
        <View style={[styles.inputWrapper, errors.displayName && styles.inputError]}>
          <User size={20} color="#6B6B6B" weight="regular" style={{ marginRight: 12 }} />
          <TextInput
            style={styles.input}
            placeholder="Enter your display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholderTextColor="#999999"
            autoCapitalize="words"
            maxLength={50}
            testID="profile-setup-display-name-input"
          />
        </View>
        {errors.displayName && (
          <Text style={styles.errorText} testID="display-name-error">
            {errors.displayName}
          </Text>
        )}
      </View>

      {/* Zip Code */}
      <View style={styles.inputGroup}>
        <Text style={styles.label} testID="zip-code-label">
          ZIP CODE
        </Text>
        <View style={[styles.inputWrapper, errors.zipCode && styles.inputError]}>
          <MapPin size={20} color="#6B6B6B" weight="regular" style={{ marginRight: 12 }} />
          <TextInput
            style={styles.input}
            placeholder="Enter your 5-digit zip code"
            value={zipCode}
            onChangeText={handleZipCodeChange}
            placeholderTextColor="#999999"
            keyboardType="number-pad"
            maxLength={5}
            testID="zip-code-input"
          />
        </View>
        {errors.zipCode && (
          <Text style={styles.errorText} testID="zip-code-error">
            {errors.zipCode}
          </Text>
        )}
        {city && state && (
          <Text style={styles.cityState} testID="city-state-display">
            📍 {city}, {state}
          </Text>
        )}
        <Text style={styles.helpText}>We'll assign you to your nearest community node</Text>
      </View>

      {/* Bio (Optional) */}
      <View style={styles.inputGroup}>
        <Text style={styles.label} testID="bio-label">
          BIO (OPTIONAL)
        </Text>
        <View style={[styles.inputWrapper, styles.textArea]}>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            placeholder="Tell us a bit about yourself..."
            value={bio}
            onChangeText={setBio}
            placeholderTextColor="#999999"
            multiline
            numberOfLines={4}
            maxLength={200}
            testID="profile-setup-bio-input"
          />
        </View>
        <Text style={styles.helpText} testID="bio-char-count">
          {bio.length}/200 characters
        </Text>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        testID="complete-setup-button"
        accessible
        accessibilityRole="button"
        accessibilityLabel="Complete setup button"
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>Complete Setup</Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={isWaitlistPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isJoiningWaitlist) {
            setIsWaitlistPromptVisible(false);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.waitlistModalCard}>
            <Text style={styles.waitlistModalTitle}>We're Coming Soon!</Text>
            <Text style={styles.waitlistModalBody}>
              We're not quite active in {waitlistContext?.requestedZip} yet, but we're coming soon!
              In the meantime, we've connected you with traders in{' '}
              {waitlistContext?.assignedNodeName || 'a nearby area'}.
            </Text>
            <Text style={styles.waitlistModalPrompt}>
              Want to be notified when we launch in your area?
            </Text>

            <View style={styles.waitlistButtonRow}>
              <TouchableOpacity
                style={[
                  styles.waitlistSecondaryButton,
                  isJoiningWaitlist && styles.waitlistButtonDisabled,
                ]}
                onPress={() => {
                  setIsWaitlistPromptVisible(false);
                  void continueToPostAuthFlow();
                }}
                disabled={isJoiningWaitlist}
                testID="waitlist-continue-trading"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Continue Trading"
              >
                <Text style={styles.waitlistSecondaryButtonText}>Continue Trading</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.waitlistPrimaryButton,
                  isJoiningWaitlist && styles.waitlistButtonDisabled,
                ]}
                onPress={() => {
                  void handleJoinWaitlist();
                }}
                disabled={isJoiningWaitlist}
                testID="waitlist-join-button"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Join Waitlist"
              >
                {isJoiningWaitlist ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.waitlistPrimaryButtonText}>Join Waitlist</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isWaitlistConfirmedVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsWaitlistConfirmedVisible(false);
          void continueToPostAuthFlow();
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.waitlistModalCard}>
            <Text style={styles.waitlistModalTitle}>Waitlist Confirmed</Text>
            <Text style={styles.waitlistModalBody}>
              Thank you! We've added you to the waitlist for {waitlistContext?.requestedZip}. We'll
              notify you as soon as we launch in your area.
            </Text>
            <Text style={styles.waitlistModalBody}>
              In the meantime, you can trade items with users in{' '}
              {waitlistContext?.assignedNodeName || 'your assigned area'}.
            </Text>

            <TouchableOpacity
              style={styles.waitlistSinglePrimaryButton}
              onPress={() => {
                setIsWaitlistConfirmedVisible(false);
                void continueToPostAuthFlow();
              }}
              testID="waitlist-confirmed-got-it"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Got it"
            >
              <Text style={styles.waitlistSinglePrimaryButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B6B6B',
    lineHeight: 22,
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
  devAvatarButton: {
    backgroundColor: '#EAF7F0',
    borderColor: '#5DBB8E',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  devAvatarButtonText: {
    color: '#2E7D5B',
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B6B6B',
    textTransform: 'uppercase',
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
  textArea: {
    height: 120,
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingBottom: 16,
  },
  errorText: {
    color: '#E85D75',
    fontSize: 14,
    marginTop: 4,
  },
  cityState: {
    color: '#5DBB8E',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  helpText: {
    color: '#999999',
    fontSize: 14,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  waitlistModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
  },
  waitlistModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 14,
  },
  waitlistModalBody: {
    fontSize: 15,
    color: '#6B6B6B',
    lineHeight: 20,
    marginBottom: 14,
  },
  waitlistModalPrompt: {
    fontSize: 15,
    color: '#6B6B6B',
    lineHeight: 22,
    marginBottom: 20,
  },
  waitlistButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  waitlistSecondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#C9CDD3',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  waitlistPrimaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#5DBB8E', // Match app primary green
  },
  waitlistSinglePrimaryButton: {
    minHeight: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#5DBB8E',
  },
  waitlistSecondaryButtonText: {
    color: '#4D5560',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  waitlistPrimaryButtonText: {
    color: '#FFFFFF', // White text on solid green background
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  waitlistSinglePrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  waitlistButtonDisabled: {
    opacity: 0.7,
  },
});
