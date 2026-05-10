/**
 * File: p2p-kids-marketplace/src/components/bulk/PhotoSelectGrid.tsx
 * MODULE-04 V3.1 UX overhaul (Decisions 4 & 6) — multi-select grouping grid
 *
 * Replaces the arrow-based "drag" UI from V3.0. Supports:
 *   - long-press on any photo to enter selection mode
 *   - tap-to-select / tap-to-deselect while in selection mode
 *   - bottom action bar with Merge / Move to item… / Delete
 *   - per-item header with rename / delete-item / split / add-photos / set-cover
 *
 * The grid renders one row per group, each row is a small horizontal strip of
 * the photos in that group. This keeps the visual model "photos belong to an
 * item" front and centre.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { PhotoAsset, PhotoGroup } from '../../types/listing';

export interface PhotoSelectGridProps {
  groups: PhotoGroup[];
  /** photoIds currently in selection mode */
  selectedPhotoIds: string[];
  duplicatePhotoIds?: string[];
  onTogglePhotoSelection: (photoId: string) => void;
  onLongPressPhoto: (photoId: string) => void;
  onSetCover: (groupId: string, photoIndex: number) => void;
  onDeletePhoto: (photoId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onSplitGroup: (groupId: string) => void;
  onAddPhotosToGroup: (groupId: string) => void;
}

export function PhotoSelectGrid({
  groups,
  selectedPhotoIds,
  duplicatePhotoIds = [],
  onTogglePhotoSelection,
  onLongPressPhoto,
  onSetCover,
  onDeletePhoto,
  onDeleteGroup,
  onSplitGroup,
  onAddPhotosToGroup,
}: PhotoSelectGridProps) {
  const selectionMode = selectedPhotoIds.length > 0;
  const selectedSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds]);
  const dupSet = useMemo(() => new Set(duplicatePhotoIds), [duplicatePhotoIds]);

  return (
    <View style={styles.container} testID="photo-select-grid">
      {groups.map((group, groupIndex) => (
        <View key={group.groupId} style={styles.groupCard} testID={`group-card-${groupIndex}`}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle} testID={`group-title-${groupIndex}`}>
              Item {groupIndex + 1}
            </Text>
            <View style={styles.groupActions}>
              <TouchableOpacity
                onPress={() => onAddPhotosToGroup(group.groupId)}
                accessibilityLabel={`Add more photos to item ${groupIndex + 1}`}
                accessibilityHint="Opens the photo picker so you can add more photos to this item"
                testID={`group-add-photos-${groupIndex}`}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonText}>+ Photos</Text>
              </TouchableOpacity>
              {group.photos.length > 1 && (
                <TouchableOpacity
                  onPress={() => onSplitGroup(group.groupId)}
                  accessibilityLabel={`Split item ${groupIndex + 1} into separate items`}
                  accessibilityHint="Each photo becomes its own item"
                  testID={`group-split-${groupIndex}`}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionButtonText}>Split</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => onDeleteGroup(group.groupId)}
                accessibilityLabel={`Delete item ${groupIndex + 1}`}
                accessibilityHint="Removes this item and all its photos"
                testID={`group-delete-${groupIndex}`}
                style={[styles.actionButton, styles.actionDanger]}
              >
                <Text style={[styles.actionButtonText, styles.actionDangerText]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoStrip}
          >
            {group.photos.map((photo, photoIndex) => {
              const selected = selectedSet.has(photo.id);
              const isCover = group.primaryPhotoIndex === photoIndex;
              const isDuplicate = dupSet.has(photo.id);
              return (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  selected={selected}
                  isCover={isCover}
                  isDuplicate={isDuplicate}
                  selectionMode={selectionMode}
                  onPress={() => {
                    if (selectionMode) {
                      onTogglePhotoSelection(photo.id);
                    } else {
                      onSetCover(group.groupId, photoIndex);
                    }
                  }}
                  onLongPress={() => onLongPressPhoto(photo.id)}
                  onDelete={() => onDeletePhoto(photo.id)}
                  testID={`photo-tile-${groupIndex}-${photoIndex}`}
                />
              );
            })}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

interface PhotoTileProps {
  photo: PhotoAsset;
  selected: boolean;
  isCover: boolean;
  isDuplicate: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
  testID: string;
}

function PhotoTile({
  photo,
  selected,
  isCover,
  isDuplicate,
  selectionMode,
  onPress,
  onLongPress,
  onDelete,
  testID,
}: PhotoTileProps) {
  const [imageError, setImageError] = useState(false);
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      style={[styles.tile, selected && styles.tileSelected, isDuplicate && styles.tileDuplicate]}
      accessibilityLabel={
        selectionMode
          ? selected
            ? 'Deselect this photo'
            : 'Select this photo'
          : 'Tap to set as cover, long-press to start a selection'
      }
      accessibilityHint={
        selectionMode
          ? 'Toggles this photo in the current selection'
          : 'Long press to enter selection mode for grouping or deletion'
      }
      testID={testID}
    >
      {imageError ? (
        <View style={[styles.image, styles.imageFallback]}>
          <Text style={styles.imageFallbackText}>No preview</Text>
        </View>
      ) : (
        <Image
          source={{ uri: photo.uri }}
          style={styles.image}
          onError={() => setImageError(true)}
        />
      )}
      {isCover && (
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeText}>COVER</Text>
        </View>
      )}
      {selected && (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>✓</Text>
        </View>
      )}
      {isDuplicate && !selected && (
        <View style={styles.duplicateBadge}>
          <Text style={styles.duplicateBadgeText}>DUP?</Text>
        </View>
      )}
      {!selectionMode && (
        <TouchableOpacity
          onPress={onDelete}
          style={styles.deleteChip}
          accessibilityLabel="Delete this photo"
          testID={`${testID}-delete`}
        >
          <Text style={styles.deleteChipText}>×</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  groupCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  groupActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  actionDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E85D75',
  },
  actionDangerText: {
    color: '#E85D75',
  },
  photoStrip: {
    gap: 8,
  },
  tile: {
    width: 88,
    height: 88,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  tileSelected: {
    borderColor: '#5DBB8E',
  },
  tileDuplicate: {
    borderColor: '#F59E0B',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(17,24,39,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  duplicateBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  duplicateBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  deleteChip: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(17,24,39,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteChipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
});
