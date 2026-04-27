import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { PhotoAsset } from '../../types/listing';

interface BulkPhotoUploaderProps {
  photos: PhotoAsset[];
  maxPhotos?: number;
  uploading?: boolean;
  onPickPhotos: () => void;
  /** V3.1 UX overhaul (Decision 6): show "Add more" affordance once any photo is picked */
  onAddMore?: () => void;
  /** V3.1 UX overhaul (Decision 12): inline duplicate-photo warning */
  duplicateCount?: number;
}

export function BulkPhotoUploader({
  photos,
  maxPhotos = 30,
  uploading = false,
  onPickPhotos,
  onAddMore,
  duplicateCount = 0,
}: BulkPhotoUploaderProps) {
  const hasPhotos = photos.length > 0;
  const atCap = photos.length >= maxPhotos;
  return (
    <View style={styles.container} testID="bulk-photo-uploader">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Photos</Text>
        <Text style={styles.counter}>
          {photos.length}/{maxPhotos}
        </Text>
      </View>

      {!hasPhotos && (
        <TouchableOpacity
          style={[styles.pickButton, atCap && styles.disabledButton]}
          onPress={onPickPhotos}
          disabled={atCap || uploading}
          accessibilityLabel="Pick multiple listing photos"
          accessibilityHint="Opens your photo library and allows selecting up to 30 photos"
          testID="bulk-image-picker-button"
        >
          <Text style={styles.pickButtonText}>Select up to {maxPhotos} photos</Text>
        </TouchableOpacity>
      )}

      {hasPhotos && onAddMore && (
        <TouchableOpacity
          style={[styles.addMoreButton, atCap && styles.disabledButton]}
          onPress={onAddMore}
          disabled={atCap || uploading}
          accessibilityLabel="Add more photos"
          accessibilityHint="Opens the photo library to add more photos to this bulk session"
          testID="bulk-image-picker-add-more"
        >
          <Text style={styles.addMoreText}>+ Add more photos</Text>
        </TouchableOpacity>
      )}

      {uploading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Uploading photos…</Text>
        </View>
      )}

      {duplicateCount > 0 && (
        <View style={styles.dupBanner} testID="bulk-duplicate-warning">
          <Text style={styles.dupText}>
            ⚠️ {duplicateCount} possible duplicate photo{duplicateCount === 1 ? '' : 's'} detected.
            Tap to review.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  counter: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  pickButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addMoreButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#fff',
  },
  addMoreText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
  pickButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#4B5563',
  },
  dupBanner: {
    marginTop: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  dupText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
});
