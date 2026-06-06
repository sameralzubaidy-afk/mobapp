/**
 * File: p2p-kids-marketplace/src/components/molecules/ImagePickerGrid.tsx
 * MODULE-13 SAFETY-P002: Multi-image picker with preview for listings
 *
 * Features:
 * - Pick up to 5 images from gallery or camera
 * - Show image previews in horizontal scroll
 * - Delete individual images
 * - Reorder images (first = primary/cover image)
 * - Validate file size (5 MB max per image)
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

const MAX_IMAGES = 5;
const MAX_FILE_SIZE_MB = 5;
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
}

export default function ImagePickerGrid({
  images,
  onImagesChange,
  uploading = false,
  maxImages = MAX_IMAGES,
  testID = 'image-picker-grid',
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

      {/* Add Photo Button */}
      {images.length < maxImages && !uploading && (
        <TouchableOpacity
          testID={`${testID}-add-photo`}
          style={styles.addPhotoButton}
          onPress={handleAddPhotoPress}
        >
          <Text style={styles.addPhotoButtonText}>+ Add Photo</Text>
        </TouchableOpacity>
      )}

      {/* Uploading indicator */}
      {uploading && (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
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

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowPhotoSourceModal(false);
                pickFromCamera();
              }}
              testID={`${testID}-source-camera`}
            >
              <Text style={styles.modalOptionText}>📸 Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowPhotoSourceModal(false);
                pickFromGallery();
              }}
              testID={`${testID}-source-library`}
            >
              <Text style={styles.modalOptionText}>🖼️ Photo Library</Text>
            </TouchableOpacity>

            <TouchableOpacity
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
    color: '#333',
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: '#999',
  },
  previewScroll: {
    marginBottom: 12,
  },
  previewContainer: {
    width: 120,
    height: 120,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f0f0f0',
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
    backgroundColor: '#007AFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
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
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  addPhotoButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  addPhotoButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
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
    color: '#666',
  },

  // Photo Source Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  modalMessage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    marginBottom: 10,
    alignItems: 'center',
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  modalCancelButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
});
