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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { setupUserProfile, uploadProfileAvatar } from '@/services/profile';
import { getCurrentUser } from '@/services/supabase/auth';
import { addToWaitlist } from '@/services/waitlist';
import type { ProfileSetupData } from '@/types/profile.types';

export default function ProfileSetupScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [displayName, setDisplayName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos to upload a profile picture.');
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
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
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

      // Upload avatar if user selected one
      if (localImageUri) {
        setUploadingImage(true);
        const { url, error: uploadError } = await uploadProfileAvatar(currentUser.id, localImageUri);
        setUploadingImage(false);
        
        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
          Alert.alert('Warning', 'Profile will be created without avatar. You can add it later.');
        } else {
          uploadedAvatarUrl = url;
        }
      }

      // Setup profile
      const profileData: ProfileSetupData = {
        display_name: displayName.trim(),
        zip_code: zipCode.trim(),
        bio: bio.trim() || undefined,
        avatar_url: uploadedAvatarUrl || undefined,
      };

      const { user, error, needsWaitlist, zipCode: userZip } = await setupUserProfile(currentUser.id, profileData);

      if (error) {
        throw error;
      }

      // Check if user needs to be added to waitlist
      if (needsWaitlist && userZip) {
        Alert.alert(
          'Area Not Yet Available',
          `We're not live in your area (${userZip}) yet! Would you like to join the waitlist to be notified when we launch?`,
          [
            {
              text: 'Skip for Now',
              style: 'cancel',
              onPress: () => {
                // Continue to subscription choice
                navigation.replace('SubscriptionChoice', { userId: currentUser.id });
              },
            },
            {
              text: 'Join Waitlist',
              onPress: async () => {
                // Add user to waitlist
                const { success } = await addToWaitlist({
                  email: currentUser.email || '',
                  phone: currentUser.phone,
                  zip: userZip,
                });

                if (success) {
                  Alert.alert(
                    'Added to Waitlist!',
                    "We'll notify you as soon as we launch in your area. You can still explore the app!",
                    [{ text: 'OK', onPress: () => navigation.replace('SubscriptionChoice', { userId: currentUser.id }) }]
                  );
                } else {
                  Alert.alert('Info', 'Could not add to waitlist, but you can still use the app!', [
                    { text: 'OK', onPress: () => navigation.replace('SubscriptionChoice', { userId: currentUser.id }) },
                  ]);
                }
              },
            },
          ]
        );
      } else {
        // Profile created successfully - navigate to subscription choice
        Alert.alert('Success', 'Your profile has been created!', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to subscription choice screen
              navigation.replace('SubscriptionChoice', { userId: currentUser.id });
            },
          },
        ]);
      }
    } catch (error: any) {
      console.error('Profile setup error:', error);
      Alert.alert('Error', error.message || 'Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>
          Tell us a bit about yourself and we'll connect you to your local community
        </Text>
      </View>

      {/* Avatar Picker */}
      <View style={styles.avatarSection}>
        <TouchableOpacity style={styles.avatarButton} onPress={handlePickImage} disabled={uploadingImage}>
          {localImageUri ? (
            <Image source={{ uri: localImageUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>📷</Text>
              <Text style={styles.avatarPlaceholderSubtext}>Add Photo</Text>
            </View>
          )}
        </TouchableOpacity>
        {uploadingImage && (
          <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 8 }} />
        )}
      </View>

      {/* Display Name */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Display Name *</Text>
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

      {/* Zip Code */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Zip Code *</Text>
        <TextInput
          style={[styles.input, errors.zipCode && styles.inputError]}
          placeholder="Enter your 5-digit zip code"
          value={zipCode}
          onChangeText={setZipCode}
          keyboardType="number-pad"
          maxLength={5}
        />
        {errors.zipCode && <Text style={styles.errorText}>{errors.zipCode}</Text>}
        <Text style={styles.helpText}>We'll assign you to your nearest community node</Text>
      </View>

      {/* Bio (Optional) */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Bio (Optional)</Text>
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

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>Complete Setup</Text>
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
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
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
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 40,
  },
  avatarPlaceholderSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
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
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
