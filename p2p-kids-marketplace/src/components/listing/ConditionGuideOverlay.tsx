/**
 * File: p2p-kids-marketplace/src/components/listing/ConditionGuideOverlay.tsx
 * MODULE-04 LISTING-V3-008: Condition Guide Overlay
 * Task: LISTING-V3-008 - Modal with real photo examples per condition
 *
 * Features:
 * - Full-screen modal overlay
 * - Photo examples for selected condition
 * - Tips and guidelines
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Image,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Condition, ConditionGuide } from '../../types/listing';

const CONDITION_GUIDES: ConditionGuide[] = [
  {
    condition: 'new',
    title: 'New',
    description: 'Brand new with original tags attached',
    examplePhotoUrl: 'https://via.placeholder.com/300x200?text=New+Item+Example',
    tips: ['Has original tags', 'Never worn or used', 'In original packaging', 'No signs of wear'],
  },
  {
    condition: 'like_new',
    title: 'Like New',
    description: 'Excellent condition, barely used',
    examplePhotoUrl: 'https://via.placeholder.com/300x200?text=Like+New+Example',
    tips: [
      'Worn/used 1-2 times',
      'No visible wear or defects',
      'Looks almost new',
      'Fully functional',
    ],
  },
  {
    condition: 'good',
    title: 'Good',
    description: 'Gently used with minor wear',
    examplePhotoUrl: 'https://via.placeholder.com/300x200?text=Good+Condition+Example',
    tips: [
      'Minor signs of wear',
      'Small stains or marks possible',
      'No major defects',
      'Fully functional',
    ],
  },
  {
    condition: 'fair',
    title: 'Fair',
    description: 'Noticeable wear but fully functional',
    examplePhotoUrl: 'https://via.placeholder.com/300x200?text=Fair+Condition+Example',
    tips: [
      'Obvious signs of use',
      'May have stains or fading',
      'Minor repairs done',
      'Still usable',
    ],
  },
  {
    condition: 'worn',
    title: 'Worn',
    description: 'Heavy wear but still usable',
    examplePhotoUrl: 'https://via.placeholder.com/300x200?text=Worn+Condition+Example',
    tips: [
      'Significant wear and tear',
      'Multiple stains or fading',
      'May need repairs',
      'Still functional',
    ],
  },
];

export interface ConditionGuideOverlayProps {
  visible: boolean;
  condition: Condition | null;
  onClose: () => void;
  testID?: string;
}

export function ConditionGuideOverlay({
  visible,
  condition,
  onClose,
  testID = 'condition-guide-overlay',
}: ConditionGuideOverlayProps) {
  const guide = CONDITION_GUIDES.find((g) => g.condition === condition);

  if (!guide) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
      testID={testID}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{guide.title} Condition</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Close condition guide"
            accessibilityRole="button"
            testID="close-guide"
          >
            <Text style={styles.closeButton}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.description}>{guide.description}</Text>

          <View style={styles.imageContainer}>
            <Image
              source={{ uri: guide.examplePhotoUrl }}
              style={styles.exampleImage}
              resizeMode="cover"
            />
            <Text style={styles.imageCaption}>Example photo</Text>
          </View>

          <View style={styles.tipsSection}>
            <Text style={styles.tipsTitle}>What to look for:</Text>
            {guide.tips.map((tip, index) => (
              <View key={index} style={styles.tipRow}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>

          <View style={styles.noteSection}>
            <Text style={styles.noteTitle}>💡 Tip</Text>
            <Text style={styles.noteText}>
              Take clear, well-lit photos showing any wear or defects. Honest descriptions build
              trust with buyers!
            </Text>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={onClose}
          accessibilityLabel="Close guide"
          accessibilityRole="button"
          testID="done-button"
        >
          <Text style={styles.doneButtonText}>Got It</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    fontSize: 36,
    color: '#999999',
    lineHeight: 36,
    width: 36,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  description: {
    fontSize: 16,
    color: '#6B6B6B',
    marginBottom: 24,
    lineHeight: 24,
  },
  imageContainer: {
    marginBottom: 24,
  },
  exampleImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  imageCaption: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginTop: 8,
  },
  tipsSection: {
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tipBullet: {
    fontSize: 16,
    color: '#5DBB8E',
    marginRight: 8,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
  },
  noteSection: {
    backgroundColor: '#FFF9E6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 80,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  doneButton: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    minHeight: 52,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
