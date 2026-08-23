/**
 * File: p2p-kids-marketplace/src/components/modals/SPInfoTooltip.tsx
 * MODULE-04 LISTING-V3-011: SP Info Tooltip
 * Task: LISTING-V3-011 - SP earnings preview for single & bulk listing
 *
 * Purpose: "What is SP?" tooltip with "Learn More" link
 * UX Decision 5: Option C - Tooltip with link to full explanation
 *
 * @see BRD US-SUB-002: SP earnings preview requirement
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';

export interface SPInfoTooltipProps {
  visible: boolean;
  onClose: () => void;
  onLearnMore?: () => void;
  testID?: string;
}

/**
 * Tooltip explaining Swap Points (SP)
 * Shows brief explanation + "Learn More" link
 */
export function SPInfoTooltip({
  visible,
  onClose,
  onLearnMore,
  testID = 'sp-info-tooltip',
}: SPInfoTooltipProps) {
  const handleLearnMore = () => {
    onClose();
    onLearnMore?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Close tooltip"
      >
        <View style={styles.tooltipContainer}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={styles.contentScrollContainer}
              showsVerticalScrollIndicator
            >
              <Text style={styles.title}>What are Swap Points (SP)?</Text>

              <Text style={styles.paragraph}>
                <Text style={styles.bold}>Swap Points (SP)</Text> are rewards you earn when selling
                items on our marketplace.
              </Text>

              <Text style={styles.paragraph}>
                <Text style={styles.bold}>How it works:</Text>
              </Text>
              <Text style={styles.bulletPoint}>• You earn SP when your items sell</Text>
              <Text style={styles.bulletPoint}>
                • Different categories earn different SP rates (1.05x - 1.40x)
              </Text>
              <Text style={styles.bulletPoint}>
                • Buyers can use SP to pay for part of their purchase
              </Text>
              <Text style={styles.bulletPoint}>
                • Only Kids Club+ members can earn and spend SP
              </Text>

              <Text style={styles.paragraph}>
                <Text style={styles.bold}>Example:</Text> If you sell a toy for $30 in a category
                with 1.20x multiplier, you'll earn ~36 SP.
              </Text>

              <Text style={styles.disclaimer}>
                *SP estimates are based on your list price and current category multipliers. Actual
                SP earned may vary slightly based on final sale price and admin adjustments.
              </Text>
            </ScrollView>

            <View style={styles.actionsContainer}>
              {onLearnMore && (
                <TouchableOpacity
                  style={styles.learnMoreButton}
                  onPress={handleLearnMore}
                  accessibilityLabel="Learn more about Swap Points"
                  accessibilityRole="button"
                  testID="learn-more-button"
                  accessible
                >
                  <Text style={styles.learnMoreText}>Learn More About SP →</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                accessibilityLabel="Close tooltip"
                accessibilityRole="button"
                testID="close-button"
                accessible
              >
                <Text style={styles.closeButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tooltipContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    maxWidth: 420,
    width: '100%',
    maxHeight: '84%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  contentScroll: {
    maxHeight: 500,
  },
  contentScrollContainer: {
    paddingBottom: 8,
  },
  actionsContainer: {
    paddingTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 15,
    color: '#3F3F46',
    lineHeight: 22,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
  bulletPoint: {
    fontSize: 14,
    color: '#52525B',
    lineHeight: 20,
    marginLeft: 12,
    marginBottom: 6,
  },
  disclaimer: {
    fontSize: 13,
    color: '#71717A',
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 16,
  },
  learnMoreButton: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  learnMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5DBB8E',
  },
  closeButton: {
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
