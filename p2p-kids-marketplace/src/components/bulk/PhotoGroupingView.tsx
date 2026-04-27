import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList } from 'react-native';
import { PhotoAsset, PhotoGroup } from '../../types/listing';

interface PhotoGroupingViewProps {
  groups: PhotoGroup[];
  maxPerGroup?: number;
  onReorderInGroup: (groupId: string, photos: PhotoAsset[]) => void;
  onMovePhotoBetweenGroups: (photoId: string, fromGroupId: string, toGroupId: string) => void;
  onSetPrimary: (groupId: string, index: number) => void;
  onConfirmGrouping: () => void;
}

export function PhotoGroupingView({
  groups,
  maxPerGroup = 10,
  onReorderInGroup,
  onMovePhotoBetweenGroups,
  onSetPrimary,
  onConfirmGrouping,
}: PhotoGroupingViewProps) {
  const renderPhotoItem =
    (group: PhotoGroup, groupIndex: number) =>
    ({ item, index }: { item: PhotoAsset; index: number }) => {
      const photoIndex = index + 1;
      const totalPhotos = group.photos.length;

      return (
        <View style={styles.photoCard}>
          <Image source={{ uri: item.uri }} style={styles.photo} />

          <View style={styles.photoActions}>
            <View style={styles.reorderRow}>
              <TouchableOpacity
                onPress={() => {
                  if (index === 0) return;
                  const reordered = [...group.photos];
                  const temp = reordered[index - 1];
                  reordered[index - 1] = reordered[index];
                  reordered[index] = temp;
                  onReorderInGroup(group.groupId, reordered);
                }}
                style={styles.smallButton}
                accessibilityLabel={`Drag photo ${photoIndex} of ${totalPhotos} in item ${groupIndex + 1}`}
                accessibilityHint="Moves this photo left within the current item group"
                testID={`drag-handle-${group.groupId}-${item.id}`}
              >
                <Text style={styles.smallButtonText}>◀</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (index >= group.photos.length - 1) return;
                  const reordered = [...group.photos];
                  const temp = reordered[index + 1];
                  reordered[index + 1] = reordered[index];
                  reordered[index] = temp;
                  onReorderInGroup(group.groupId, reordered);
                }}
                style={styles.smallButton}
                accessibilityLabel={`Drag photo ${photoIndex} of ${totalPhotos} in item ${groupIndex + 1}`}
                accessibilityHint="Moves this photo right within the current item group"
                testID={`drag-handle-next-${group.groupId}-${item.id}`}
              >
                <Text style={styles.smallButtonText}>▶</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => onSetPrimary(group.groupId, index)}
              style={styles.smallButton}
              accessibilityLabel="Set cover photo"
              accessibilityHint="Sets this photo as the primary image for the item"
              testID={`set-cover-${group.groupId}-${item.id}`}
            >
              <Text style={styles.smallButtonText}>Cover</Text>
            </TouchableOpacity>

            <View style={styles.moveButtonsRow}>
              {groupIndex > 0 && (
                <TouchableOpacity
                  onPress={() => onMovePhotoBetweenGroups(item.id, group.groupId, groups[groupIndex - 1].groupId)}
                  style={styles.moveButton}
                  testID={`move-prev-${group.groupId}-${item.id}`}
                >
                  <Text style={styles.moveButtonText}>← Item {groupIndex}</Text>
                </TouchableOpacity>
              )}
              {groupIndex < groups.length - 1 && (
                <TouchableOpacity
                  onPress={() => onMovePhotoBetweenGroups(item.id, group.groupId, groups[groupIndex + 1].groupId)}
                  style={styles.moveButton}
                  testID={`move-next-${group.groupId}-${item.id}`}
                >
                  <Text style={styles.moveButtonText}>Item {groupIndex + 2} →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      );
    };

  return (
    <View style={styles.container} testID="photo-grouping-view">
      <Text style={styles.title}>Group Photos Into Items</Text>
      <Text style={styles.subtitle}>Reorder with left/right controls. Move photos between groups with item arrows.</Text>

      {groups.map((group, index) => (
        <View key={group.groupId} style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>Item {index + 1}</Text>
            <Text style={styles.groupMeta}>{group.photos.length}/{maxPerGroup} photos</Text>
          </View>

          <FlatList
            data={group.photos}
            horizontal
            keyExtractor={(item) => item.id}
            renderItem={renderPhotoItem(group, index)}
            contentContainerStyle={styles.groupList}
            testID={`group-list-${group.groupId}`}
          />
        </View>
      ))}

      <TouchableOpacity style={styles.confirmButton} onPress={onConfirmGrouping} testID="confirm-grouping-button">
        <Text style={styles.confirmButtonText}>Confirm Grouping</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    color: '#6B7280',
  },
  groupCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    marginBottom: 10,
    padding: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  groupMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  groupList: {
    gap: 8,
  },
  photoCard: {
    width: 162,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 6,
  },
  reorderRow: {
    flexDirection: 'row',
    gap: 4,
  },
  photo: {
    width: '100%',
    height: 88,
    borderRadius: 6,
  },
  photoActions: {
    marginTop: 6,
    gap: 4,
  },
  smallButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  smallButtonText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  moveButtonsRow: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  moveButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  moveButtonText: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  confirmButton: {
    marginTop: 4,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
