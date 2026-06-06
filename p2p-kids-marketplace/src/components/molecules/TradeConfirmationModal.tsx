/**
 * File: p2p-kids-marketplace/src/components/molecules/TradeConfirmationModal.tsx
 * Whisk Design System: Trade flow confirmation modal
 * Replaces native Alert.alert() with styled modal using app colors.
 *
 * Colors:
 *   Primary green: #5DBB8E
 *   Danger red:    #EF4444
 *   Text primary:  #1A1A1A
 *   Text secondary:#6B6B6B
 *   Background:    #FFFFFF
 *   Border:        #F0F0F0
 */

import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export type ConfirmVariant = 'accept' | 'decline' | 'default';

interface TradeConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  hideCancel?: boolean;
}

export function TradeConfirmationModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
  hideCancel = false,
}: TradeConfirmationModalProps) {
  const confirmBgColor =
    variant === 'accept' ? '#5DBB8E' :
    variant === 'decline' ? '#EF4444' :
    '#5DBB8E';

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Buttons */}
          <View style={hideCancel ? styles.singleButtonRow : styles.buttonRow}>
            {!hideCancel && (
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
                disabled={loading}
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: confirmBgColor }]}
              onPress={onConfirm}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text style={styles.confirmButtonText}>
                {loading ? 'Processing...' : confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  dialog: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 24,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'Inter-Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#6B6B6B',
    fontFamily: 'Inter-Regular',
    lineHeight: 21,
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  singleButtonRow: {
    flexDirection: 'row',
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B6B6B',
    fontFamily: 'Inter-SemiBold',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
});
