// File: p2p-kids-marketplace/src/screens/profile/IDVerificationUploadScreen.tsx
// TASK BADGE-009: ID Badge Upload Screen
// Module: MODULE-10-ID-BADGE-VERIFICATION-V2.md

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { idBadgeService } from '@/services/idBadge';
import { getCurrentUser } from '@/services/supabase/auth';

interface UploadState {
  selectedImage: string | null;
  uploading: boolean;
  error: string | null;
  submitted: boolean;
  pendingRequestId: string | null;
}

export default function IDVerificationUploadScreen({ navigation }: any) {
  const [user, setUser] = useState<any>(null);
  const [state, setState] = useState<UploadState>({
    selectedImage: null,
    uploading: false,
    error: null,
    submitted: false,
    pendingRequestId: null,
  });
  const [disclaimerText, setDisclaimerText] = useState('');
  const [hasActivePending, setHasActivePending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserAndStatus();
  }, []);

  const loadUserAndStatus = async () => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        navigation.goBack();
        return;
      }
      setUser(currentUser);

      // Fetch configurable disclaimer message
      const disclaimer = await idBadgeService.getMessage('upload_disclaimer');
      setDisclaimerText(
        disclaimer ||
          'We will not store your ID image. It will be deleted after verification.'
      );

      // Check if user has pending request
      const pending = await idBadgeService.checkPendingRequest(currentUser.id);
      setHasActivePending(pending !== null);
    } catch (error) {
      console.error('Error loading:', error);
      setDisclaimerText(
        'We will not store your ID image. It will be deleted after verification.'
      );
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setState((prev) => ({
          ...prev,
          selectedImage: result.assets[0].uri,
          error: null,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to pick image',
      }));
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setState((prev) => ({
          ...prev,
          selectedImage: result.assets[0].uri,
          error: null,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to take photo',
      }));
    }
  };

  const handleSubmit = async () => {
    if (!state.selectedImage) {
      setState((prev) => ({
        ...prev,
        error: 'Please select an image',
      }));
      return;
    }

    if (hasActivePending) {
      Alert.alert(
        'Pending Request',
        'You already have a pending verification request. Please wait for the admin to review it.'
      );
      return;
    }

    setState((prev) => ({ ...prev, uploading: true, error: null }));

    try {
      const requestId = await idBadgeService.submitVerificationRequest(
        user!.id,
        state.selectedImage
      );

      setState((prev) => ({
        ...prev,
        uploading: false,
        submitted: true,
        pendingRequestId: requestId,
      }));

      Alert.alert(
        'Submitted Successfully',
        'Your verification request has been submitted. We will review it within 24 hours.'
      );

      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        uploading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Upload failed. Please try again.',
      }));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </SafeAreaView>
    );
  }

  if (hasActivePending && !state.submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Verification Pending</Text>
        <Text style={styles.message}>
          You already have a pending verification request. We will review it
          within 24 hours and notify you of the decision.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back to Profile</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (state.submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.successTitle}>✓ Submitted Successfully</Text>
        <Text style={styles.successMessage}>
          Your verification request has been submitted. We will review it within
          24 hours and notify you of the decision via email and push
          notification.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back to Profile</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Verify Your Identity</Text>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerTitle}>Your Privacy is Important</Text>
          <Text style={styles.disclaimerText}>{disclaimerText}</Text>
        </View>

        {state.selectedImage ? (
          <View style={styles.imagePreview}>
            <Image
              source={{ uri: state.selectedImage }}
              style={styles.image}
            />
            <TouchableOpacity
              style={styles.changeButton}
              onPress={() =>
                setState((prev) => ({ ...prev, selectedImage: null }))
              }
            >
              <Text style={styles.changeButtonText}>Change Image</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.imagePickerButtons}>
            <TouchableOpacity style={styles.button} onPress={takePhoto}>
              <Text style={styles.buttonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={pickImage}
            >
              <Text style={styles.secondaryButtonText}>
                Choose from Gallery
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {state.error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{state.error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.submitButton,
            !state.selectedImage && styles.disabledButton,
          ]}
          onPress={handleSubmit}
          disabled={!state.selectedImage || state.uploading}
        >
          {state.uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit for Verification</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.helpText}>
          Tips: Make sure your ID is clearly visible, well-lit, and the photo is
          in focus.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  disclaimerBox: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    padding: 12,
    marginBottom: 20,
    borderRadius: 4,
  },
  disclaimerTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  imagePreview: {
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 12,
  },
  changeButton: {
    paddingVertical: 8,
  },
  changeButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  imagePickerButtons: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  secondaryButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 12,
    marginBottom: 16,
    borderRadius: 4,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#10B981',
  },
  successMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 24,
  },
});
