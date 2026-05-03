/**
 * File: p2p-kids-marketplace/src/components/listing/PhotoUploadManager.tsx
 * MODULE-04 LISTING-V3-008: Photo Upload Manager Component
 * Task: LISTING-V3-008 - Step-1 photo grid with reorder capability
 *
 * Features:
 * - Max 10 photos
 * - First photo marked as "Cover"
 * - Add/remove photos
 */

import React from 'react';
import { View, Text, TouchableOpacity, Image, FlatList, StyleSheet } from 'react-native';
import { PhotoAsset } from '../../types/listing';

export interface PhotoUploadManagerProps {
  photos: PhotoAsset[];
  onAddPhotos: () => void;
  onRemovePhoto: (photoId: string) => void;
  onReorder: (newOrder: PhotoAsset[]) => void;
  maxPhotos?: number;
  testID?: string;
}

export function PhotoUploadManager({
  photos,
  onAddPhotos,
  onRemovePhoto,
  onReorder,
  maxPhotos = 10,
  testID = 'photo-upload-manager',
}: PhotoUploadManagerProps) {
  const canAddMore = photos.length < maxPhotos;

  const renderPhotoItem = ({ item, index }: { item: PhotoAsset; index: number }) => {
    const isCover = index === 0;

    return (
      <View style={styles.photoItem}>
        <Image source={{ uri: item.uri }} style={styles.photo} />
        {isCover && (
          <View style={styles.coverBadge}>
            <Text style={styles.coverText}>Cover</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemovePhoto(item.id)}
          accessibilityLabel={`Remove photo ${index + 1}`}
          accessibilityRole="button"
          testID={`remove-photo-${item.id}`}
        >
          <Text style={styles.removeText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>Photos *</Text>
      <Text style={styles.subtitle}>
        Add up to {maxPhotos} photos. First photo will be your cover image.
      </Text>

      <View style={styles.gridContainer}>
        <FlatList
          data={photos}
          renderItem={renderPhotoItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          scrollEnabled={false}
        />
      </View>

      {canAddMore && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={onAddPhotos}
          accessibilityLabel="Add photos"
          accessibilityHint={`You can add ${maxPhotos - photos.length} more photos`}
          accessibilityRole="button"
          testID="add-photos-button"
        >
          <Text style={styles.addButtonText}>+ Add Photos</Text>
          <Text style={styles.addButtonHint}>
            ({photos.length}/{maxPhotos} photos)
          </Text>
        </TouchableOpacity>
      )}

      {photos.length >= maxPhotos && (
        <Text style={styles.maxPhotosText}>Maximum {maxPhotos} photos reached</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  gridContainer: {
    marginBottom: 16,
  },
  grid: {
    gap: 8,
  },
  photoItem: {
    width: '31%',
    aspectRatio: 1,
    marginBottom: 8,
    marginRight: '2.5%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  coverText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonHint: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
    opacity: 0.8,
  },
  maxPhotosText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
