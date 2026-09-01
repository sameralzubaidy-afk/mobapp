import React, { useState } from 'react';
import { Modal, View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

export interface CancellationReason {
  id: string;
  label: string;
  description?: string;
}

// TFV2-023 Addendum A: seller-specific reasons for in_progress cancellation.
export const SELLER_INPROGRESS_REASONS: CancellationReason[] = [
  {
    id: 'cant_do_pickup',
    label: "Can't do pickup",
    description: 'Unable to arrange a meetup for this trade',
  },
  {
    id: 'item_no_longer_available',
    label: 'Item no longer available',
    description: 'Item is damaged, lost, or no longer for sale',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Please specify in the text box below',
  },
];

export const PREDEFINED_REASONS: CancellationReason[] = [
  {
    id: 'found_elsewhere',
    label: 'Found elsewhere',
    description: 'Found a better deal or item elsewhere',
  },
  {
    id: 'changed_mind',
    label: 'Changed mind',
    description: 'No longer interested in the item',
  },
  {
    id: 'buyer_unresponsive',
    label: 'Buyer unresponsive',
    description: 'Unable to contact the buyer',
  },
  {
    id: 'item_issue',
    label: 'Item damaged/incorrect',
    description: 'Item was damaged or not as described',
  },
  {
    id: 'other',
    label: 'Other reason',
    description: 'Please specify in the text box below',
  },
];

/**
 * BUYER_OFFER_REASONS: Used when a buyer cancels their own submitted offer.
 * Excludes 'Buyer unresponsive' (buyer is the person canceling) and
 * 'Item damaged/incorrect' (item hasn't been received yet at offer stage).
 */
export const BUYER_OFFER_REASONS: CancellationReason[] = [
  {
    id: 'found_elsewhere',
    label: 'Found elsewhere',
    description: 'Found a better deal or item elsewhere',
  },
  {
    id: 'changed_mind',
    label: 'Changed mind',
    description: 'No longer interested in the item',
  },
  {
    id: 'other',
    label: 'Other reason',
    description: 'Please specify in the text box below',
  },
];

/**
 * BUYER_INPROGRESS_REASONS (FIX-CANCEL 2026-09-01): reasons a buyer can give when
 * requesting a cancellation on an in-progress trade. The request goes to the
 * seller for approval; if declined or unanswered it escalates to admin review.
 */
export const BUYER_INPROGRESS_REASONS: CancellationReason[] = [
  {
    id: 'changed_mind',
    label: 'Changed my mind',
    description: 'No longer able to complete this trade',
  },
  {
    id: 'no_longer_need_item',
    label: 'No longer need the item',
    description: 'No longer need or want the item',
  },
  {
    id: 'meetup_issue',
    label: 'Can\u2019t make the meetup',
    description: 'Unable to arrange the pickup or meetup',
  },
  {
    id: 'other',
    label: 'Other reason',
    description: 'Please specify in the text box below',
  },
];

interface CancellationReasonModalProps {
  visible: boolean;
  itemTitle?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** Pass a custom reason list (e.g. SELLER_INPROGRESS_REASONS) to override the defaults. */
  reasons?: CancellationReason[];
}

export const CancellationReasonModal: React.FC<CancellationReasonModalProps> = ({
  visible,
  itemTitle,
  onConfirm,
  onCancel,
  isLoading = false,
  reasons,
}) => {
  const activeReasons = reasons ?? PREDEFINED_REASONS;
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');

  const handleConfirm = () => {
    let finalReason = '';

    // Get the label for the selected predefined reason
    if (selectedReason) {
      const reasonObj = activeReasons.find((r) => r.id === selectedReason);
      finalReason = reasonObj?.label || selectedReason;
    }

    // If "Other" was selected and custom text provided, use custom text
    if (selectedReason === 'other' && customReason.trim()) {
      finalReason = customReason.trim();
    }

    onConfirm(finalReason);
  };

  const handleClose = () => {
    setSelectedReason(null);
    setCustomReason('');
    onCancel();
  };

  const isConfirmDisabled = !selectedReason || (selectedReason === 'other' && !customReason.trim());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <View style={styles.container} accessibilityRole="alert">
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Why are you cancelling?
            </Text>
            {itemTitle && (
              <Text style={styles.itemTitle} numberOfLines={1}>
                {itemTitle}
              </Text>
            )}
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.reasonsList}>
              {activeReasons.map((reason) => (
                <Pressable
                  key={reason.id}
                  style={[
                    styles.reasonOption,
                    selectedReason === reason.id && styles.reasonOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedReason(reason.id);
                    if (reason.id !== 'other') {
                      setCustomReason('');
                    }
                  }}
                  disabled={isLoading}
                  testID={`cancellation-reason-${reason.id}`}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={reason.label}
                  accessibilityState={{ selected: selectedReason === reason.id }}
                >
                  <View style={styles.radioButton}>
                    {selectedReason === reason.id && <View style={styles.radioButtonInner} />}
                  </View>
                  <View style={styles.reasonContent}>
                    <Text
                      style={[
                        styles.reasonLabel,
                        selectedReason === reason.id && styles.reasonLabelSelected,
                      ]}
                    >
                      {reason.label}
                    </Text>
                    {reason.description && (
                      <Text style={styles.reasonDescription}>{reason.description}</Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>

            {selectedReason === 'other' && (
              <View style={styles.customInputContainer}>
                <TextInput
                  inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                  style={styles.customInput}
                  placeholder="Please describe why you're cancelling..."
                  placeholderTextColor="#999"
                  value={customReason}
                  onChangeText={setCustomReason}
                  multiline
                  maxLength={500}
                  editable={!isLoading}
                />
                <Text style={styles.charCount}>{customReason.length}/500</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isLoading}
              testID="cancel-trade-keep-button"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Keep Trade"
            >
              <Text style={styles.cancelButtonText}>Keep Trade</Text>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                styles.confirmButton,
                isConfirmDisabled && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isConfirmDisabled || isLoading}
              testID="cancel-trade-confirm-button"
              accessible
              accessibilityRole="button"
              accessibilityLabel={isLoading ? 'Cancelling' : 'Cancel Trade'}
            >
              <Text style={styles.confirmButtonText}>
                {isLoading ? 'Cancelling...' : 'Cancel Trade'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '85%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
  contentContainer: {
    flexGrow: 1,
  },
  reasonsList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
  },
  reasonOptionSelected: {
    backgroundColor: '#f0f8ff',
    borderWidth: 1,
    borderColor: '#0066cc',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0066cc',
  },
  reasonContent: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  reasonLabelSelected: {
    color: '#0066cc',
    fontWeight: '600',
  },
  reasonDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  customInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 8,
    backgroundColor: '#f9fafb',
    marginHorizontal: 12,
    borderRadius: 12,
  },
  customInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000',
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 4,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confirmButton: {
    backgroundColor: '#ff6b6b',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ffb3b3',
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
