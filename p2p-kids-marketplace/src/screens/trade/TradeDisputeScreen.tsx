/**
 * File: p2p-kids-marketplace/src/screens/trade/TradeDisputeScreen.tsx
 * TASK FLOW-08-05: Trade Dispute Screen - Whisk Design System
 * 
 * NEW SCREEN - For filing disputes on problematic trades
 * 
 * Features:
 * - Red alert banner with WarningCircle icon
 * - Reason selector chips (red when selected)
 * - Evidence upload with Camera icon
 * - Description textarea (filled style)
 * - Red danger button for submission
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import { WarningCircle, Flag } from 'phosphor-react-native';
import BottomNavBar from '@/components/organisms/BottomNavBar';
import { cancelTradeV2 } from '@/services/trade';
import ScreenLayout from '@/components/ScreenLayout';

type TradeDisputeRouteProp = RouteProp<RootStackParamList, 'TradeDispute'>;

const DISPUTE_REASONS = [
  {
    id: 'item_not_as_described',
    label: 'Item not as described',
    description: 'Item details do not match what was listed',
  },
  {
    id: 'item_not_received',
    label: 'Item not received',
    description: 'I did not receive the item',
  },
  {
    id: 'safety_concern',
    label: 'Safety concern',
    description: 'Potential safety issue with this item',
  },
  {
    id: 'payment_issue',
    label: 'Payment issue',
    description: 'Problem with payment or charges',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Something else happened',
  },
];

export default function TradeDisputeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<TradeDisputeRouteProp>();
  const { tradeId } = route.params;

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const minimumDescriptionLength = 20;
  const requiresDescription = selectedReason === 'other';
  const hasValidDescription = description.trim().length >= minimumDescriptionLength;
  const isFormValid = Boolean(selectedReason) && (!requiresDescription || hasValidDescription);

  const toggleReason = (reason: string) => {
    setSelectedReason((current) => {
      const nextReason = current === reason ? null : reason;
      if (nextReason !== 'other') {
        setDescription('');
      }
      return nextReason;
    });
  };

  const buildCancellationReason = () => {
    const selected = DISPUTE_REASONS.find((r) => r.id === selectedReason);
    const baseReason = selected ? selected.label : 'Dispute reported';

    if (selectedReason === 'other' && description.trim()) {
      return `Dispute: ${baseReason} - ${description.trim()}`;
    }

    return `Dispute: ${baseReason}`;
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Required', 'Please select at least one reason');
      return;
    }

    if (requiresDescription && !hasValidDescription) {
      Alert.alert(
        'Required',
        `Please provide a detailed description (minimum ${minimumDescriptionLength} characters)`
      );
      return;
    }

    Alert.alert(
      'Submit Dispute',
      'Are you sure you want to file a dispute? Our support team will review your case.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              const result = await cancelTradeV2(tradeId, buildCancellationReason());

              if (!result.success) {
                throw new Error(result.error || 'Failed to submit dispute');
              }

              Alert.alert(
                'Dispute filed',
                result.message ||
                  'Your dispute has been submitted and the trade was moved to cancelled status.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.replace('TradeTimeline', { tradeId }),
                  },
                ]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to submit dispute');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenLayout variant="detail" title="Trade Dispute">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>File a Dispute</Text>

        {/* Alert Banner */}
        <View style={styles.alertBanner} testID="dispute-warning-banner">
          <WarningCircle size={20} color="#E85D75" weight="regular" style={{ marginRight: 8 }} />
          <Text style={styles.alertText}>
            Filing a dispute is a serious action. Please provide accurate information.
          </Text>
        </View>

        {/* Reason Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SELECT REASON(S)</Text>
          <View style={styles.reasonList}>
            {DISPUTE_REASONS.map((reason, index) => {
              const isSelected = selectedReason === reason.id;
              return (
                <Pressable
                  key={reason.id}
                  style={[styles.reasonCard, isSelected && styles.reasonCardSelected]}
                  onPress={() => toggleReason(reason.id)}
                  testID={`reason-chip-${index}`}
                >
                  <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                    {isSelected && <View style={styles.radioButtonInner} />}
                  </View>
                  <View style={styles.reasonTextContent}>
                    <Text style={[styles.reasonTitle, isSelected && styles.reasonTitleSelected]}>
                      {reason.label}
                    </Text>
                    <Text style={styles.reasonDescription}>{reason.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Description Textarea */}
        {requiresDescription && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what happened in detail..."
              placeholderTextColor="#999999"
              multiline
              textAlignVertical="top"
              maxLength={1000}
              testID="dispute-description"
            />
            <Text style={styles.charCount}>{description.length}/1000</Text>
          </View>
        )}

        {/* Submit Button */}
        <Pressable
          style={[styles.submitButton, (!isFormValid || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!isFormValid || submitting}
          testID="submit-dispute-button"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Flag size={20} color="#FFFFFF" weight="regular" style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>Submit Dispute</Text>
            </>
          )}
        </Pressable>

        {/* Cancel Link */}
        <Pressable
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={submitting}
          testID="cancel-dispute-button"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
      <BottomNavBar />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 24,
  },
  alertBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  alertText: {
    fontSize: 13,
    color: '#1A1A1A',
    flex: 1,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  reasonList: {
    gap: 12,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  reasonCardSelected: {
    borderColor: '#E85D75',
    backgroundColor: '#FEE2E2',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C2C2C2',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  radioButtonSelected: {
    borderColor: '#E85D75',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E85D75',
  },
  reasonTextContent: {
    flex: 1,
  },
  reasonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  reasonTitleSelected: {
    color: '#E85D75',
  },
  reasonDescription: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  textArea: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    minHeight: 120,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  charCount: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginTop: 8,
  },
  submitButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#E85D75',
    borderRadius: 26,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#F7A3B0',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: '#6B6B6B',
  },
});
