import React, { useState } from 'react';
import { Modal, View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';

export interface CancellationReason {
  id: string;
  label: string;
  description?: string;
}

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

interface CancellationReasonModalProps {
  visible: boolean;
  itemTitle?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const CancellationReasonModal: React.FC<CancellationReasonModalProps> = ({
  visible,
  itemTitle,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');

  const handleConfirm = () => {
    let finalReason = '';

    // Get the label for the selected predefined reason
    if (selectedReason) {
      const reasonObj = PREDEFINED_REASONS.find((r) => r.id === selectedReason);
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Why are you cancelling?</Text>
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
              {PREDEFINED_REASONS.map((reason) => (
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
