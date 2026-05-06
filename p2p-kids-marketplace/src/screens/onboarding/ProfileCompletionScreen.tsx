// File: src/screens/onboarding/ProfileCompletionScreen.tsx
// AUTH-008: User completes profile with avatar, display name, and bio

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { User, Camera } from 'phosphor-react-native';

interface RouteParams {
  userId: string;
}

export default function ProfileCompletionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params as RouteParams;

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handlePickImage = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
      console.error('Image picker error:', error);
    }
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarUri) return null;

    try {
      setUploading(true);

      // Convert URI to blob
      const response = await fetch(avatarUri);
      const blob = await response.blob();

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `avatars/${userId}-${timestamp}.jpg`;

      // Upload to Supabase Storage
      const { error } = await supabase.storage.from('user-avatars').upload(filename, blob, {
        cacheControl: '3600',
        upsert: false,
      });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage.from('user-avatars').getPublicUrl(filename);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Avatar upload error:', error);
      Alert.alert('Error', 'Failed to upload avatar');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleContinue = async () => {
    // Validation
    if (!displayName.trim()) {
      Alert.alert('Required', 'Please enter a display name');
      return;
    }

    if (displayName.trim().length < 2) {
      Alert.alert('Invalid', 'Display name must be at least 2 characters');
      return;
    }

    if (bio.trim().length > 200) {
      Alert.alert('Invalid', 'Bio must be 200 characters or less');
      return;
    }

    setLoading(true);

    try {
      // Upload avatar if selected
      let avatarUrl: string | null = null;
      if (avatarUri) {
        avatarUrl = await uploadAvatar();
      }

      // Update user profile
      const { error } = await supabase
        .from('profiles')
        .update({
          name: displayName.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
          profile_completed: true,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('user_id', userId);

      if (error) throw error;

      console.log('✅ Profile completed successfully');

      // TODO: Track analytics event
      // trackEvent('profile_completed', { user_id: userId });

      // Navigate to subscription choice (MODULE-03 AUTH-V2-003)
      // User will choose between Free Tier or Kids Club+ Trial
      (navigation as any).navigate('SubscriptionChoice', { userId });
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="profile-completion-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Progress bar */}
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '40%' }]} />
            </View>

            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              Add a photo, display name, and bio so other traders can get to know you
            </Text>

            {/* Avatar section */}
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handlePickImage}
              disabled={uploading}
              testID="avatar-upload-button"
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Camera size={40} color="#6B6B6B" weight="regular" />
                </View>
              )}
            </TouchableOpacity>

            {uploading && (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="small" color="#5DBB8E" />
                <Text style={styles.uploadingText}>Uploading...</Text>
              </View>
            )}

            {/* Display Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label} testID="display-name-label">
                DISPLAY NAME
              </Text>
              <View style={styles.inputWrapper}>
                <User size={20} color="#6B6B6B" weight="regular" style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your display name"
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholderTextColor="#999999"
                  editable={!loading}
                  maxLength={50}
                  testID="display-name-input"
                />
              </View>
              <Text style={styles.charCount} testID="display-name-char-count">
                {displayName.length}/50
              </Text>
            </View>

            {/* Bio */}
            <View style={styles.formGroup}>
              <Text style={styles.label} testID="bio-label">
                BIO (OPTIONAL)
              </Text>
              <View style={[styles.inputWrapper, styles.bioInput]}>
                <TextInput
                  style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                  placeholder="Tell other traders about yourself..."
                  value={bio}
                  onChangeText={setBio}
                  placeholderTextColor="#999999"
                  editable={!loading}
                  maxLength={200}
                  multiline
                  numberOfLines={4}
                  testID="bio-input"
                />
              </View>
              <Text style={styles.charCount} testID="bio-char-count">
                {bio.length}/200
              </Text>
            </View>

            {/* Continue button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleContinue}
              disabled={loading || uploading}
              testID="save-profile-button"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </TouchableOpacity>

            {/* Skip button */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => {
                (navigation as any).navigate('LocationPicker', { userId });
              }}
              disabled={loading || uploading}
              testID="skip-button"
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 30,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5DBB8E',
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
    lineHeight: 24,
    marginBottom: 30,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    marginBottom: 20,
  },
  uploadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B6B6B',
  },
  formGroup: {
    marginBottom: 20,
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
  bioInput: {
    height: 120,
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingBottom: 16,
  },
  charCount: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    color: '#6B6B6B',
  },
});
