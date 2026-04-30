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
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';

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
                <Text style={styles.bold}>Swap Points (SP)</Text> are rewards you earn when selling items on our marketplace.
              </Text>

              <Text style={styles.paragraph}>
                <Text style={styles.bold}>How it works:</Text>
              </Text>
              <Text style={styles.bulletPoint}>• You earn SP when your items sell</Text>
              <Text style={styles.bulletPoint}>• Different categories earn different SP rates (1.05x - 1.40x)</Text>
              <Text style={styles.bulletPoint}>• Buyers can use SP to pay for part of their purchase</Text>
              <Text style={styles.bulletPoint}>• Only Kids Club+ members can earn and spend SP</Text>

              <Text style={styles.paragraph}>
                <Text style={styles.bold}>Example:</Text> If you sell a toy for $30 in a category with 1.20x multiplier, you'll earn ~36 SP.
              </Text>

              <Text style={styles.disclaimer}>
                *SP estimates are based on your list price and current category multipliers. 
                Actual SP earned may vary slightly based on final sale price and admin adjustments.
              </Text>
            </ScrollView>

            <View style={styles.actionsContainer}>
              {onLearnMore && (
                <TouchableOpacity
                  style={styles.learnMoreButton}
                  onPress={onLearnMore}
                  accessibilityLabel="Learn more about Swap Points"
                  accessibilityRole="button"
                  testID="learn-more-button"
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tooltipContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    maxWidth: 400,
    width: '100%',
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  contentScroll: {
    maxHeight: 520,
  },
  contentScrollContainer: {
    paddingBottom: 8,
  },
  actionsContainer: {
    paddingTop: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '600',
    color: '#000000',
  },
  bulletPoint: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
    marginLeft: 8,
    marginBottom: 6,
  },
  disclaimer: {
    fontSize: 12,
    color: '#888888',
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: 12,
    marginBottom: 16,
  },
  learnMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  learnMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
