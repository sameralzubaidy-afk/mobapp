/**
 * File: p2p-kids-marketplace/src/components/bulk/GroupingHelpTooltip.tsx
 * One-time "How grouping works" tooltip for the Group step of the bulk flow.
 *
 * Shown only on first entry to the Group step (the screen persists a
 * once-per-device AsyncStorage flag), in addition to the inline 💡 hint.
 * Modal presentation (SPInfoTooltip style) so it is hard to miss even when
 * the item list is long. Dismissible via the "Got it" button or tap-outside.
 */

import React from 'react';
import { Modal, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface GroupingHelpTooltipProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export function GroupingHelpTooltip({
  visible,
  onClose,
  testID = 'bulk-grouping-tooltip',
}: GroupingHelpTooltipProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      testID={testID}
    >
      {/* Overlay is non-accessible so it does not swallow the whole AX tree;
          it only catches outside taps to dismiss. */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        accessible={false}
        testID={`${testID}-overlay`}
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={1}
          onPress={(event) => event.stopPropagation()}
          accessible={false}
        >
          <Text style={styles.title}>How grouping works</Text>
          <ScrollView style={styles.body}>
            <Text style={styles.paragraph}>
              Each group of photos becomes one item. Add a few photos to one item so buyers can see
              every angle.
            </Text>
            <Text style={styles.bullet}>
              • <Text style={styles.bulletBold}>Tap a photo</Text> to set it as the item's cover.
            </Text>
            <Text style={styles.bullet}>
              • <Text style={styles.bulletBold}>Long-press a photo</Text> to start selecting, then
              tap more photos to merge them into one item.
            </Text>
            <Text style={styles.bullet}>
              • <Text style={styles.bulletBold}>Use the ◀ ▶ arrows</Text> to reorder photos within
              an item — the cover stays on the same photo.
            </Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.gotItButton}
            onPress={onClose}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Got it — close grouping help"
            testID={`${testID}-dismiss`}
          >
            <Text style={styles.gotItText}>Got it</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  body: {
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    marginBottom: 10,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    marginBottom: 6,
  },
  bulletBold: {
    fontWeight: '700',
    color: '#111827',
  },
  gotItButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 24,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotItText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
