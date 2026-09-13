/**
 * File: p2p-kids-marketplace/src/components/molecules/ImagePickerGrid.tsx
 * MODULE-13 SAFETY-P002: Multi-image picker with preview for listings
 *
 * Features:
 * - Pick up to 5 images from gallery or camera
 * - Show image previews in horizontal scroll
 * - Delete individual images
 * - Reorder images (first = primary/cover image)
 * - Validate file size (10 MB max per image, shared with photoService)
 */

import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Images, Plus } from 'phosphor-react-native';
// Single source of truth — ItemCreate / Bulk Listing / EditListing all share the
// same cap (photoService.MAX_FILE_SIZE_MB) so the surfaces can never drift again.
import { MAX_FILE_SIZE_MB } from '../../services/photoService';
// FIX-Task-29 item 7B: every colour comes from the Pass It Up token set, so no
// future caller can re-introduce an off-brand (e.g. iOS system blue) button here.
import { theme } from '../../theme';

const MAX_IMAGES = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export interface SelectedImage {
  id?: string;
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
}

interface ImagePickerGridProps {
  images: SelectedImage[];
  onImagesChange: (images: SelectedImage[]) => void;
  uploading?: boolean;
  maxImages?: number;
  testID?: string;
  /**
   * FIX-Task-29 item 7B: lets a caller pick the emphatic style. Defaults to
   * 'secondary' so a photo picker can never compete with a form's real submit
   * button — that was the defect: a filled blue "+ Add Photo" sat directly above
   * the green "Save Changes" on Edit Listing (two competing primaries, two palettes).
   */
  variant?: 'primary' | 'secondary';
}

export default function ImagePickerGrid({
  images,
  onImagesChange,
  uploading = false,
  maxImages = MAX_IMAGES,
  testID = 'image-picker-grid',
  variant = 'secondary',
}: ImagePickerGridProps) {
  const [showPhotoSourceModal, setShowPhotoSourceModal] = useState(false);

  const handleAddPhotoPress = () => {
    setShowPhotoSourceModal(true);
  };

  const pickFromGallery = async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limit Reached', `Maximum ${maxImages} images allowed`);
      return;
    }

    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library access is needed to select images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: maxImages - images.length,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        // Validate file sizes
        const validAssets: SelectedImage[] = [];
        for (const asset of result.assets) {
          if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_BYTES) {
            Alert.alert(
              'File Too Large',
              `Image ${asset.fileName || 'selected'} exceeds ${MAX_FILE_SIZE_MB} MB`
            );
            continue;
          }
          validAssets.push({
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            fileSize: asset.fileSize,
          });
        }

        if (validAssets.length > 0) {
          onImagesChange([...images, ...validAssets].slice(0, maxImages));
        }
      }
    } catch (error) {
      console.error('[ImagePickerGrid] pickFromGallery error:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const pickFromCamera = async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limit Reached', `Maximum ${maxImages} images allowed`);
      return;
    }

    try {
      // Request permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // Validate file size
        if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_BYTES) {
          Alert.alert('File Too Large', `Image must be under ${MAX_FILE_SIZE_MB} MB`);
          return;
        }

        onImagesChange([
          ...images,
          {
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            fileSize: asset.fileSize,
          },
        ]);
      }
    } catch (error) {
      console.error('[ImagePickerGrid] pickFromCamera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    const newImages = [...images];
    const [removed] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, removed);
    onImagesChange(newImages);
  };

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.label}>
          Photos ({images.length}/{maxImages})
        </Text>
        {images.length > 0 && <Text style={styles.hint}>First image will be the cover photo</Text>}
      </View>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.previewScroll}
          testID={`${testID}-preview-scroll`}
        >
          {images.map((img, index) => (
            <View key={`${img.uri}-${index}`} style={styles.previewContainer}>
              <Image source={{ uri: img.uri }} style={styles.previewImage} />

              {/* Primary badge for first image */}
              {index === 0 && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryText}>Cover</Text>
                </View>
              )}

              {/* Delete button */}
              <TouchableOpacity
                testID={`${testID}-remove-${index}`}
                style={styles.deleteButton}
                onPress={() => removeImage(index)}
                accessible
                accessibilityRole="button"
                disabled={uploading}
              >
                <Text style={styles.deleteText}>×</Text>
              </TouchableOpacity>

              {/* Reorder buttons (only show if more than 1 image) */}
              {images.length > 1 && (
                <View style={styles.reorderButtons}>
                  {index > 0 && (
                    <TouchableOpacity
                      testID={`${testID}-move-left-${index}`}
                      accessible
                      accessibilityRole="button"
                      style={styles.reorderButton}
                      onPress={() => moveImage(index, index - 1)}
                      disabled={uploading}
                    >
                      <Text style={styles.reorderText}>←</Text>
                    </TouchableOpacity>
                  )}
                  {index < images.length - 1 && (
                    <TouchableOpacity
                      testID={`${testID}-move-right-${index}`}
                      accessible
                      accessibilityRole="button"
                      style={styles.reorderButton}
                      onPress={() => moveImage(index, index + 1)}
                      disabled={uploading}
                    >
                      <Text style={styles.reorderText}>→</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Photo — a SECONDARY-outline dropzone by default (FIX-Task-29 item 7A1).
          It reads as "drop photos here", not "submit": the form's only filled
          primary is its real submit button. */}
      {images.length < maxImages && !uploading && (
        <TouchableOpacity
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Add photos. Up to ${maxImages} photos.`}
          testID={`${testID}-add-photo`}
          style={variant === 'primary' ? styles.addPhotoButtonPrimary : styles.addPhotoDropzone}
          onPress={handleAddPhotoPress}
          activeOpacity={0.7}
        >
          {variant === 'primary' ? (
            <Text style={styles.addPhotoButtonPrimaryText}>+ Add Photo</Text>
          ) : (
            <>
              <View style={styles.addPhotoIconWrap}>
                <Plus size={20} color={theme.colors.primary[600]} weight="bold" />
              </View>
              <Text style={styles.addPhotoDropzoneLabel}>Add photos</Text>
              <Text style={styles.addPhotoDropzoneHelper}>
                Choose from your library or take a new photo · up to {maxImages}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Uploading indicator */}
      {uploading && (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary[500]} />
          <Text style={styles.uploadingText}>Uploading images...</Text>
        </View>
      )}

      {/* Photo Source Modal — Camera or Library */}
      <Modal
        visible={showPhotoSourceModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPhotoSourceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Photo</Text>
            <Text style={styles.modalMessage}>Choose how you want to add a photo.</Text>

            {/* FIX-Task-29 item 7A2: secondary-outline rows with a leading branded
                icon and a one-line consequence hint. Only the recommended option
                (Library) carries the primary tint. */}
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowPhotoSourceModal(false);
                pickFromCamera();
              }}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Take Photo"
              testID={`${testID}-source-camera`}
            >
              <Camera size={20} color={theme.colors.neutral[700]} weight="regular" />
              <View style={styles.modalOptionTextWrap}>
                <Text style={styles.modalOptionTitle}>Take Photo</Text>
                <Text style={styles.modalOptionHint}>Opens the camera for a new photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              accessible
              accessibilityRole="button"
              accessibilityLabel="Photo Library"
              style={[styles.modalOption, styles.modalOptionPrimary]}
              onPress={() => {
                setShowPhotoSourceModal(false);
                pickFromGallery();
              }}
              testID={`${testID}-source-library`}
            >
              <Images size={20} color={theme.colors.primary[600]} weight="regular" />
              <View style={styles.modalOptionTextWrap}>
                <Text style={[styles.modalOptionTitle, styles.modalOptionTitlePrimary]}>
                  Photo Library
                </Text>
                <Text style={styles.modalOptionHint}>Pick photos you already have</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              accessible
              accessibilityRole="button"
              style={styles.modalCancelButton}
              onPress={() => setShowPhotoSourceModal(false)}
              testID={`${testID}-source-cancel`}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 16,
  },
  header: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.neutral[900],
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.neutral[500],
  },
  previewScroll: {
    marginBottom: 12,
  },
  previewContainer: {
    width: 120,
    height: 120,
    marginRight: 12,
    borderRadius: theme.borderRadius.small,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: theme.colors.neutral[100],
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  primaryBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.neutral.white,
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.error[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.neutral.white,
    lineHeight: 20,
  },
  reorderButtons: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reorderButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorderText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.neutral.white,
  },
  // FIX-Task-29 item 7A1: secondary-outline dropzone. Was a filled iOS-system-blue
  // primary button, which competed with the form's real submit button.
  addPhotoDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary[400],
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.backgroundColors.card,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  addPhotoDropzoneLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary[600],
  },
  addPhotoDropzoneHelper: {
    fontSize: 12,
    color: theme.colors.neutral[700],
    marginTop: 4,
    textAlign: 'center',
  },
  // variant="primary" keeps a filled treatment available for a future caller that
  // genuinely owns the screen's primary action — in brand green, never system blue.
  addPhotoButtonPrimary: {
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.borderRadius.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: theme.componentSize.buttonMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButtonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.neutral.white,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  uploadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.neutral[700],
  },

  // Photo Source Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.backgroundColors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '80%',
    backgroundColor: theme.colors.neutral.white,
    borderRadius: theme.borderRadius.large,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.neutral[900],
    marginBottom: 4,
  },
  modalMessage: {
    fontSize: 14,
    color: theme.colors.neutral[700],
    marginBottom: 20,
    textAlign: 'center',
  },
  // FIX-Task-29 item 7A2: outline by default; modalOptionPrimary marks the
  // recommended choice so exactly one row is emphasised.
  modalOption: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.backgroundColors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.neutral[200],
    marginBottom: 10,
  },
  modalOptionPrimary: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[100],
  },
  modalOptionTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  modalOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.neutral[900],
  },
  modalOptionTitlePrimary: {
    color: theme.colors.primary[600],
  },
  modalOptionHint: {
    fontSize: 12,
    color: theme.colors.neutral[700],
    marginTop: 2,
  },
  modalCancelButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 15,
    color: theme.colors.neutral[700],
    fontWeight: '500',
  },
});
