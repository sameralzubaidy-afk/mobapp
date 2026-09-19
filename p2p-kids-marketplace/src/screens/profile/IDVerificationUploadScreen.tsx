// File: p2p-kids-marketplace/src/screens/profile/IDVerificationUploadScreen.tsx
// TASK BADGE-009 + MODULE-15.1 FLOW-21: ID Badge Upload Screen
// Module: MODULE-10-ID-BADGE-VERIFICATION-V2.md + MODULE-15.1-UI-redesign.md
// REDESIGN: Visual-only restyle — all business logic preserved

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
} from 'react-native';
import { IdentificationCard, Camera, CheckCircle, Clock } from 'phosphor-react-native';
import { idBadgeService, IDVerificationStatus } from '@/services/idBadge';
import { captureException } from '@/services/errorReporter';
import { getCurrentUser } from '@/services/supabase/auth';
import { colors } from '@/theme/colors';
import { LoadingSpinner } from '@/components/ui';
import * as ImagePicker from 'expo-image-picker';
import ScreenLayout from '@/components/ScreenLayout';
// FIX-Task-66 item 3: shared bottom clearance (pill + Sell FAB overlay the content).
import { TAB_BAR_PINNED_CLEARANCE } from '@/constants/layout';
// FIX-Task-66 item 4: single-source photo-picker failure copy (the canonical wording).
import { PHOTO_PICK_FAILED_COPY, PHOTO_TAKE_FAILED_COPY } from '@/constants/uiCopy';

interface UploadState {
  selectedImage: string | null;
  uploading: boolean;
  error: string | null;
}

export default function IDVerificationUploadScreen({ navigation }: any) {
  const [user, setUser] = useState<any>(null);
  const [state, setState] = useState<UploadState>({
    selectedImage: null,
    uploading: false,
    error: null,
  });
  const [disclaimerText, setDisclaimerText] = useState(
    'We will not store your ID image. It will be deleted after verification.'
  );
  const [submitButtonLabel, setSubmitButtonLabel] = useState('Submit for Verification');
  const [verificationStatus, setVerificationStatus] = useState<IDVerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserAndStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserAndStatus = async () => {
    setLoading(true);
    try {
      const { user: authUser, error: authError } = await getCurrentUser();
      if (authError || !authUser) {
        navigation.goBack();
        return;
      }
      setUser(authUser);

      // Fetch configurable messages + verification status from DB
      const [disclaimer, submitLabel, status] = await Promise.all([
        idBadgeService.getMessage('upload_disclaimer'),
        idBadgeService.getMessage('submit_button_label'),
        idBadgeService.getVerificationStatus(authUser.id),
      ]);

      if (disclaimer) setDisclaimerText(disclaimer);
      if (submitLabel) setSubmitButtonLabel(submitLabel);
      setVerificationStatus(status);
    } catch (error) {
      captureException(error, {
        tags: { screen: 'IDVerificationUploadScreen', action: 'load_status' },
      });
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
    } catch {
      setState((prev) => ({
        ...prev,
        // FIX-Task-65 item 11 (symmetric): give the user an immediate next step.
        // FIX-Task-66 item 4: hoisted to constants/uiCopy.ts (single source).
        error: PHOTO_PICK_FAILED_COPY,
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
    } catch {
      setState((prev) => ({
        ...prev,
        // FIX-Task-65 item 11: was the terse 'Failed to take photo'.
        // FIX-Task-66 item 4: this is now the CANONICAL string, shared with
        // ImagePickerGrid — hoisted to constants/uiCopy.ts.
        error: PHOTO_TAKE_FAILED_COPY,
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

    if (verificationStatus?.status === 'pending') {
      Alert.alert(
        'Pending Request',
        'You already have a pending verification request. Please wait for the admin to review it.'
      );
      return;
    }

    setState((prev) => ({ ...prev, uploading: true, error: null }));

    try {
      await idBadgeService.submitVerificationRequest(user!.id, state.selectedImage);

      setVerificationStatus({ status: 'pending' });
      setState((prev) => ({ ...prev, uploading: false, selectedImage: null }));

      Alert.alert(
        'Submitted Successfully',
        'Your verification request has been submitted. We will review it within 24 hours and notify you of the decision via email and push notification.'
      );
    } catch (error) {
      setState((prev) => ({
        ...prev,
        uploading: false,
        error: error instanceof Error ? error.message : 'Upload failed. Please try again.',
      }));
    }
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ScreenLayout variant="detail" title="ID Verification">
        <View style={styles.centeredContainer} testID="id-verification-loading">
          <LoadingSpinner />
        </View>
      </ScreenLayout>
    );
  }

  // ─── STATE C: Verified ─────────────────────────────────────────────────────
  if (verificationStatus?.status === 'approved') {
    return (
      <ScreenLayout variant="detail" title="ID Verification">
        <View style={styles.centeredContainer} testID="id-verification-verified-state">
          <CheckCircle size={64} color="#5DBB8E" />
          <Text style={[styles.heading, styles.headingVerified]}>Identity Verified</Text>
          <View
            style={[styles.statusPill, styles.statusPillVerified]}
            testID="id-verification-status-pill-verified"
          >
            <Text style={[styles.statusPillText, styles.statusPillTextVerified]}>Verified ✓</Text>
          </View>
        </View>
      </ScreenLayout>
    );
  }

  // ─── STATE B: Pending Review ───────────────────────────────────────────────
  if (verificationStatus?.status === 'pending') {
    return (
      <ScreenLayout variant="detail" title="ID Verification">
        <View style={styles.centeredContainer} testID="id-verification-pending-state">
          <Clock size={64} color="#F59E0B" />
          <Text style={styles.heading}>Verification Pending</Text>
          <Text style={styles.subtext}>We'll review your ID within 24–48 hours</Text>
          <View style={styles.statusPill} testID="id-verification-status-pill-pending">
            <Text style={styles.statusPillText}>Under Review</Text>
          </View>
          <TouchableOpacity
            testID="id-verification-back-profile-btn"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Id verification back profile btn"
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back to Profile</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  // ─── STATE A: Unverified (default + rejected) ──────────────────────────────
  return (
    <ScreenLayout variant="detail" title="ID Verification">
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        testID="id-verification-unverified-state"
      >
        <View style={styles.centeredSection}>
          <IdentificationCard size={64} color="#6B6B6B" />
          <Text style={styles.heading}>Verify Your Identity</Text>
          <Text style={styles.subtext}>{disclaimerText}</Text>
        </View>

        {/* DEV-TASK-101 (UX): after an admin rejection the user returns to this
            upload state with no inline context. Brief amber note so resubmitting
            users understand why without opening the Notification Center. */}
        {verificationStatus?.status === 'rejected' && (
          <View style={styles.rejectedNote} testID="id-verification-rejected-note">
            <Text style={styles.rejectedNoteText}>
              Your previous submission wasn't approved — see the reason in your
              notifications.
            </Text>
          </View>
        )}

        {state.selectedImage ? (
          <View style={styles.imagePreview} testID="id-verification-image-preview">
            <Image source={{ uri: state.selectedImage }} style={styles.image} />
            <TouchableOpacity
              testID="id-verification-change-image-btn"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Id verification change image btn"
              style={styles.changeButton}
              onPress={() => setState((prev) => ({ ...prev, selectedImage: null }))}
            >
              <Text style={styles.changeButtonText}>Change Image</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            testID="id-verification-upload-area"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Id verification upload area"
            style={styles.uploadArea}
            onPress={pickImage}
            activeOpacity={0.7}
          >
            <Camera size={28} color="#5DBB8E" />
            <Text style={styles.uploadText}>Tap to upload ID photo</Text>
          </TouchableOpacity>
        )}

        <View style={styles.cameraRow}>
          <TouchableOpacity
            testID="id-verification-take-photo-btn"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Id verification take photo btn"
            style={styles.cameraButton}
            onPress={takePhoto}
          >
            <Text style={styles.cameraButtonText}>Use Camera</Text>
          </TouchableOpacity>

          {/* FIX-Task-65 item 10: "Use Camera" is offered even where no camera exists
              (simulator / some devices) and dead-ends the user. Offer the library
              path on the same row instead of forcing them to hunt for it. */}
          <TouchableOpacity
            testID="id-verification-choose-library-btn"
            accessible
            accessibilityRole="button"
            accessibilityLabel="Or choose from your library"
            style={styles.libraryLink}
            onPress={pickImage}
            activeOpacity={0.7}
          >
            <Text style={styles.libraryLinkText}>or choose from your library</Text>
          </TouchableOpacity>
        </View>

        {state.error && (
          <View style={styles.errorBox} testID="id-verification-error">
            <Text style={styles.errorText}>{state.error}</Text>
          </View>
        )}

        <TouchableOpacity
          testID="id-verification-submit-btn"
          accessible
          accessibilityRole="button"
          accessibilityLabel="Id verification submit btn"
          style={[
            styles.submitButton,
            state.selectedImage ? styles.submitButtonActive : styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!state.selectedImage || state.uploading}
          accessibilityState={{ disabled: !state.selectedImage || state.uploading }}
        >
          {state.uploading ? (
            <ActivityIndicator color="#fff" testID="id-verification-uploading-indicator" />
          ) : (
            <Text style={styles.submitButtonText}>{submitButtonLabel}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.helpText}>
          Tips: Make sure your ID is clearly visible, well-lit, and the photo is in focus.
        </Text>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    // FIX-Task-66 item 3 (F3): `id-verification-submit-btn` is the last control
    // (was 48).
    paddingBottom: TAB_BAR_PINNED_CLEARANCE,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  centeredSection: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },

  // DEV-TASK-101 (UX): rejected-submission inline note. Amber warning treatment
  // (distinct from the hard-error red errorBox below), matches statusPill palette.
  rejectedNote: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  rejectedNoteText: {
    fontSize: 14,
    // FIX-Task-65 item 5: was the raw Tailwind amber #B45309.
    color: colors.warning[800],
    lineHeight: 20,
  },

  // ── Header ───────────────────────────────────────────────────────────────────
  // NOTE (FIX-Task-65): headerRow / headerBackButton / headerTitle / safeArea below are
  // DEAD styles — nothing in this file references them (the header is rendered by
  // ScreenLayout). Kept for now; the divider hex was tokenized anyway so the dead block
  // no longer carries off-token colour.
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    minHeight: 56,
  },
  headerBackButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // ── Typography ───────────────────────────────────────────────────────────────
  heading: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  headingVerified: {
    color: '#5DBB8E',
  },
  subtext: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Status Pill ───────────────────────────────────────────────────────────────
  statusPill: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'center',
  },
  statusPillVerified: {
    backgroundColor: '#E8F5F0',
  },
  statusPillText: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '500',
  },
  statusPillTextVerified: {
    color: '#5DBB8E',
  },

  // ── Upload Area (dashed) ──────────────────────────────────────────────────────
  uploadArea: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  uploadText: {
    fontSize: 14,
    color: '#6B6B6B',
  },

  // ── Image Preview ─────────────────────────────────────────────────────────────
  imagePreview: {
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  changeButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  changeButtonText: {
    color: '#5DBB8E',
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Camera Button ─────────────────────────────────────────────────────────────
  // FIX-Task-65 item 10: the camera pill and a library fallback share one row, so the
  // pill is no longer full-width (it carries its own horizontal padding) and the row
  // owns the bottom margin. Both controls keep a >=44pt touch target.
  cameraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  cameraButton: {
    borderWidth: 1.5,
    borderColor: colors.primary[500],
    borderRadius: 26,
    height: 48,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButtonText: {
    fontSize: 15,
    color: colors.primary[500],
    fontWeight: '500',
  },
  libraryLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  libraryLinkText: {
    fontSize: 14,
    color: colors.primary[500],
    textDecorationLine: 'underline',
  },

  // ── Error ────────────────────────────────────────────────────────────────────
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    // FIX-Task-65 item 5: was the raw Tailwind red #EF4444 (a 3.44:1 fail on the
    // #FEF2F2 tint). error[700] is the AA-safe error-TEXT step — 5.16:1 here.
    color: colors.error[700],
  },

  // ── Submit Button ─────────────────────────────────────────────────────────────
  submitButton: {
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonActive: {
    backgroundColor: '#5DBB8E',
  },
  submitButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // ── Help Text ─────────────────────────────────────────────────────────────────
  helpText: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Back Button (Pending / Verified states) ────────────────────────────────
  // DT97 (Item 5-3): secondary OUTLINE affordance (navigation, not an action) —
  // white fill + 2px brand-green border per design-system-passitup.md §4.2.
  backButton: {
    borderRadius: 26,
    height: 52,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#5DBB8E',
    marginTop: 8,
    minWidth: 200,
  },
  backButtonText: {
    fontSize: 15,
    color: '#5DBB8E',
    fontWeight: '600',
  },
});
