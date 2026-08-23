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
import { Camera } from 'phosphor-react-native';
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
  onReorder: _onReorder,
  maxPhotos = 10,
  testID = 'photo-upload-manager',
}: PhotoUploadManagerProps) {
  const canAddMore = photos.length < maxPhotos;
  const visibleAddSlots = canAddMore ? Math.min(maxPhotos - photos.length, 3) : 0;

  const gridItems: (
    | { kind: 'photo'; key: string; photo: PhotoAsset; photoIndex: number }
    | { kind: 'add'; key: string; slotIndex: number }
  )[] = [
    ...photos.map((photo, index) => ({
      kind: 'photo' as const,
      key: photo.id,
      photo,
      photoIndex: index,
    })),
    ...Array.from({ length: visibleAddSlots }, (_, index) => ({
      kind: 'add' as const,
      key: `add-slot-${index}`,
      slotIndex: index,
    })),
  ];

  const renderGridItem = ({
    item,
  }: {
    item:
      | { kind: 'photo'; key: string; photo: PhotoAsset; photoIndex: number }
      | { kind: 'add'; key: string; slotIndex: number };
  }) => {
    if (item.kind === 'add') {
      const isPrimaryAddSlot = item.slotIndex === 0;

      return (
        <TouchableOpacity
          style={styles.emptySlot}
          onPress={onAddPhotos}
          accessibilityLabel={isPrimaryAddSlot ? 'Add photos' : undefined}
          accessibilityHint={
            isPrimaryAddSlot ? `You can add ${maxPhotos - photos.length} more photos` : undefined
          }
          accessibilityRole="button"
          accessible={isPrimaryAddSlot}
          testID={isPrimaryAddSlot ? 'add-photos-button' : `photo-slot-empty-${item.slotIndex}`}
        >
          <Camera
            size={32}
            color="#6B6B6B"
            weight="regular"
            testID={isPrimaryAddSlot ? 'camera-icon-photo-slot' : undefined}
          />
        </TouchableOpacity>
      );
    }

    const isCover = item.photoIndex === 0;

    return (
      <View style={styles.photoItem} testID={`photo-slot-filled-${item.photoIndex}`}>
        <Image source={{ uri: item.photo.uri }} style={styles.photo} />
        {isCover && (
          <View style={styles.coverBadge}>
            <Text style={styles.coverText}>Cover</Text>
          </View>
        )}
        <TouchableOpacity
          accessible
          style={styles.removeButton}
          onPress={() => onRemovePhoto(item.photo.id)}
          accessibilityLabel={`Remove photo ${item.photoIndex + 1}`}
          accessibilityRole="button"
          testID={`remove-photo-${item.photo.id}`}
        >
          <Text style={styles.removeText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Photos *</Text>
        <Text style={styles.photoCount}>
          ({photos.length}/{maxPhotos} photos)
        </Text>
      </View>
      <Text style={styles.subtitle}>
        Add up to {maxPhotos} photos. First photo will be your cover image.
      </Text>

      <View style={styles.gridContainer}>
        <FlatList
          data={gridItems}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.key}
          numColumns={3}
          contentContainerStyle={styles.grid}
          scrollEnabled={false}
        />
      </View>

      {photos.length >= maxPhotos && (
        <Text style={styles.maxPhotosText}>Maximum {maxPhotos} photos reached</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  photoCount: {
    fontSize: 14,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B6B6B',
    lineHeight: 24,
    marginBottom: 16,
  },
  gridContainer: {
    marginBottom: 16,
  },
  grid: {
    gap: 10,
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
  emptySlot: {
    width: '31%',
    aspectRatio: 1,
    marginBottom: 8,
    marginRight: '2.5%',
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
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
  maxPhotosText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
