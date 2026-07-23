/**
 * File: p2p-kids-marketplace/src/components/listing/PriceAdjustmentModal.tsx
 * Price Adjustment Modal
 *
 * Replaces native Alert.alert() for minimum-listing-price validation.
 * Shows trust-building copy and a single "Update Price" button that,
 * on dismiss, triggers auto-scroll + auto-focus to the price field.
 *
 * Colors match the Whisk Design System (#5DBB8E green).
 * App name is "Pass It Up".
 */

import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

interface PriceAdjustmentModalProps {
  visible: boolean;
  minPrice: number;
  /** Called when the user taps "Update Price" — caller should scroll + focus */
  onUpdatePrice: () => void;
}

export function PriceAdjustmentModal({
  visible,
  minPrice,
  onUpdatePrice,
}: PriceAdjustmentModalProps) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onUpdatePrice}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Title */}
          <Text style={styles.title}>Let's Adjust Your Price</Text>

          {/* Body */}
          <Text style={styles.message}>
            To keep Pass It Up full of quality items buyers can trust, listings
            must be priced at ${minPrice.toFixed(2)} or more. Update your price
            to publish this listing.
          </Text>

          {/* Single action button */}
          <TouchableOpacity
            style={styles.button}
            onPress={onUpdatePrice}
            accessibilityRole="button"
            accessibilityLabel="Update Price"
            testID="price-adjustment-update-btn"
          >
            <Text style={styles.buttonText}>Update Price</Text>
          </TouchableOpacity>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
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
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#5DBB8E',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
