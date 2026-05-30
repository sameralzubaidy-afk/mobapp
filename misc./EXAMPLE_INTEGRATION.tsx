/**
 * EXAMPLE INTEGRATION: Using CancellationReasonModal
 * 
 * This file shows how to integrate the CancellationReasonModal into your
 * trade detail screen or wherever you have the "Cancel Trade" button.
 * 
 * Location: Typically in a screen like TradeDetailScreen, TradeCard, or similar
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { CancellationReasonModal } from '../components/molecules/CancellationReasonModal';
import { cancelTradeV2 } from '../services/trade';
import { Trade } from '../types/trade';

interface TradeDetailScreenProps {
  trade: Trade;
  onTradeUpdated?: () => void;
}

export const TradeDetailScreen: React.FC<TradeDetailScreenProps> = ({
  trade,
  onTradeUpdated,
}) => {
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  /**
   * Handle the cancellation confirmation from the modal
   * Called when user selects a reason and confirms
   */
  const handleCancelTrade = async (reason: string) => {
    setIsCancelling(true);
    try {
      console.log('[TradeDetail] Cancelling trade with reason:', reason);
      
      const result = await cancelTradeV2(trade.id, reason);
      
      if (result.success) {
        // Success: show confirmation and refresh
        Alert.alert(
          'Trade Cancelled',
          'Your trade has been cancelled successfully. Any Swap Points used will be refunded to your account.',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowCancellationModal(false);
                // Refresh the trade data
                onTradeUpdated?.();
              },
            },
          ]
        );
      } else {
        // Failure: show error message
        Alert.alert(
          'Cancellation Failed',
          result.error || 'Unable to cancel this trade. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('[TradeDetail] Cancellation error:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred while cancelling the trade.'
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // Check if trade can be cancelled based on status
  const canCancelTrade = ['pending', 'payment_processing', 'in_progress'].includes(
    trade.status
  );

  return (
    <View style={styles.container}>
      {/* ... other trade detail content ... */}

      {canCancelTrade && (
        <Pressable
          style={[styles.cancelButton, isCancelling && styles.cancelButtonDisabled]}
          onPress={() => setShowCancellationModal(true)}
          disabled={isCancelling}
        >
          {isCancelling ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.cancelButtonText}>Cancel Trade</Text>
          )}
        </Pressable>
      )}

      {/* Cancellation Reason Modal */}
      <CancellationReasonModal
        visible={showCancellationModal}
        itemTitle={trade.item_title}
        onConfirm={handleCancelTrade}
        onCancel={() => setShowCancellationModal(false)}
        isLoading={isCancelling}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  cancelButton: {
    backgroundColor: '#ff6b6b',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

/**
 * USAGE NOTES:
 * 
 * 1. Import the modal component:
 *    import { CancellationReasonModal } from '../components/molecules/CancellationReasonModal';
 * 
 * 2. Import the cancel function:
 *    import { cancelTradeV2 } from '../services/trade';
 * 
 * 3. Add state for the modal:
 *    const [showCancellationModal, setShowCancellationModal] = useState(false);
 *    const [isCancelling, setIsCancelling] = useState(false);
 * 
 * 4. Connect your cancel button:
 *    <Pressable onPress={() => setShowCancellationModal(true)}>
 *      <Text>Cancel Trade</Text>
 *    </Pressable>
 * 
 * 5. Add the modal component to your render:
 *    <CancellationReasonModal
 *      visible={showCancellationModal}
 *      itemTitle={trade.item_title}
 *      onConfirm={handleCancelTrade}
 *      onCancel={() => setShowCancellationModal(false)}
 *      isLoading={isCancelling}
 *    />
 * 
 * FEATURES:
 * - Modal slides up from bottom with predefined reasons
 * - User can select a reason or provide custom text
 * - Confirm button is disabled until a reason is selected
 * - Loading state shown while cancellation is processing
 * - Detailed error messages if cancellation fails
 * - Success confirmation with info about SP refunds
 * - Automatically refreshes trade data on success
 */
