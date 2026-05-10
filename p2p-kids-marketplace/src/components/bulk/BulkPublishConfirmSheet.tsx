import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { BulkEditableItem } from './BulkItemCard';

interface BulkPublishConfirmSheetProps {
  visible: boolean;
  items: BulkEditableItem[];
  errors?: string[];
  onCancel: () => void;
  onConfirm: () => void;
  publishing?: boolean;
}

export function BulkPublishConfirmSheet({
  visible,
  items,
  errors = [],
  onCancel,
  onConfirm,
  publishing = false,
}: BulkPublishConfirmSheetProps) {
  const includedItems = items.filter((item) => item.includeInPublish);

  return (
    <Modal visible={visible} animationType="slide" transparent testID="bulk-publish-confirm-sheet">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Confirm Submission</Text>
          <Text style={styles.subtitle}>Items to submit for review: {includedItems.length}</Text>

          <ScrollView style={styles.list}>
            {items.map((item, index) => {
              const disabled = !item.includeInPublish || item.missingRequired.length > 0;
              return (
                <View
                  key={item.groupId}
                  style={[styles.row, disabled && styles.disabledRow]}
                  testID={`publish-summary-row-${index}`}
                >
                  {item.coverPhotoUri ? (
                    <Image
                      source={{ uri: item.coverPhotoUri }}
                      style={styles.thumb}
                      testID={`publish-summary-thumb-${index}`}
                    />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]} />
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title?.trim() ? item.title : `Item ${index + 1}`}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {!item.includeInPublish
                        ? 'Excluded from submission'
                        : item.missingRequired.length > 0
                          ? `Missing: ${item.missingRequired.join(', ')}`
                          : `$${item.price || '—'} • Ready`}
                    </Text>
                  </View>
                </View>
              );
            })}

            {errors.length > 0 && (
              <View style={styles.errorWrap}>
                <Text style={styles.errorTitle}>Failed Items</Text>
                {errors.map((error, idx) => (
                  <Text key={`${error}-${idx}`} style={styles.errorText}>
                    • {error}
                  </Text>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              testID="bulk-publish-cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, publishing && styles.confirmButtonDisabled]}
              disabled={publishing}
              onPress={onConfirm}
              testID="bulk-publish-confirm"
            >
              <Text style={styles.confirmText}>
                {publishing ? 'Submitting...' : 'Submit for Review'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '75%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B6B6B',
    marginBottom: 10,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  thumbPlaceholder: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  rowText: {
    flex: 1,
  },
  list: {
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  disabledRow: {
    backgroundColor: '#F3F4F6',
    opacity: 0.9,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  rowMeta: {
    fontSize: 12,
    color: '#6B6B6B',
    marginTop: 2,
  },
  errorWrap: {
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
  },
  errorTitle: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    marginBottom: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#5DBB8E',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelText: {
    color: '#5DBB8E',
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 26,
    backgroundColor: '#5DBB8E',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  confirmButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  confirmText: {
    color: '#fff',
    fontWeight: '700',
  },
});
