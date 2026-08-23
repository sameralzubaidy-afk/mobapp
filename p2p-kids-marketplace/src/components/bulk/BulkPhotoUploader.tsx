import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { WarningCircle } from 'phosphor-react-native';
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
          accessibilityHint="Lets you take a photo or choose multiple photos from your library"
          testID="bulk-image-picker-button"
          accessible
          accessibilityRole="button"
        >
          <Text style={styles.pickButtonText}>Add photos from camera or library</Text>
        </TouchableOpacity>
      )}

      {hasPhotos && onAddMore && (
        <TouchableOpacity
          style={[styles.addMoreButton, atCap && styles.disabledButton]}
          onPress={onAddMore}
          disabled={atCap || uploading}
          accessibilityLabel="Add more photos"
          accessibilityHint="Lets you take a photo or choose from your library"
          testID="bulk-image-picker-add-more"
          accessible
          accessibilityRole="button"
        >
          <Text style={styles.addMoreText}>+ Add from camera or library</Text>
        </TouchableOpacity>
      )}

      {uploading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#5DBB8E" />
          <Text style={styles.loadingText}>Uploading photos…</Text>
        </View>
      )}

      {duplicateCount > 0 && (
        <View style={styles.dupBanner} testID="bulk-duplicate-warning">
          <View style={styles.dupRow}>
            <View style={styles.dupIconWrap}>
              <WarningCircle size={16} color="#B45309" weight="fill" />
            </View>
            <Text style={styles.dupText}>
              <Text style={styles.dupTextStrong}>
                {duplicateCount} possible duplicate photo{duplicateCount === 1 ? '' : 's'} detected.
              </Text>{' '}
              Review highlighted photos below.
            </Text>
          </View>
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
    fontWeight: '600',
    color: '#1A1A1A',
  },
  counter: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  pickButton: {
    minHeight: 52,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreButton: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6B6B6B',
    backgroundColor: 'transparent',
  },
  addMoreText: {
    color: '#6B6B6B',
    fontWeight: '500',
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.5,
  },
  pickButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: '#FFFAEB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  dupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dupIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
  },
  dupText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#92400E',
  },
  dupTextStrong: {
    fontWeight: '700',
  },
});
