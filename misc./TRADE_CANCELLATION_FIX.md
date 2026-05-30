# Trade Cancellation Fix & Enhancement Guide

## Problem Statement
Users are encountering a `FunctionsHttpError: Edge Function returned a non-2xx status code` error at line 336 in `trade.ts` when attempting to cancel trades. Additionally, there's no UI to capture cancellation reasons despite the backend infrastructure being in place.

## Root Cause Analysis

### Backend Status ✅
- **RPC Function**: `cancel_trade_v2` is fully implemented in `supabase/migrations/061_sp_ledger_and_trade_rpcs.sql`
- **Database Schema**: `trades.cancellation_reason` field exists
- **Type Definitions**: `Trade` interface includes `cancellation_reason?: string | null`
- **Service Function**: `cancelTradeV2` already accepts optional `reason` parameter

### Issue: Error Handling & UI
1. **Error Handling**: The `cancelTradeV2` function catches RPC errors but only logs generic messages
2. **Missing UI**: No modal/dialog component to capture reason from user before cancellation
3. **Limited Logging**: Insufficient detail for debugging cancellation failures

## Solution Overview

### Part 1: Enhance Error Handling in Trade Service
**File**: `p2p-kids-marketplace/src/services/trade.ts`

Update the `cancelTradeV2` function with:
- ✅ Detailed error logging with context
- ✅ User-friendly error messages
- ✅ Proper error code detection and mapping
- ✅ Logging of successful cancellations with details

**Replace the `cancelTradeV2` function** (lines ~320-345) with:

```typescript
/**
 * TASK TRADE-V2-005: Cancellation & SP Refund
 * 
 * Cancels a trade, marking it as 'cancelled' and refunding SP to the buyer
 * via the cancel_trade_v2 RPC.
 * 
 * Features:
 * - Captures optional cancellation reason for tracking
 * - Refunds SP to buyer if trade is in_progress or payment_processing
 * - Updates item status back to available
 * - Logs detailed error messages for troubleshooting
 * 
 * @param tradeId - ID of the trade to cancel
 * @param reason - Optional reason for cancellation (e.g., "Found elsewhere", "Changed mind")
 * @returns Success status with detailed error messages on failure
 */
export async function cancelTradeV2(
  tradeId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const error = 'User not authenticated. Please log in and try again.';
      console.error('[trade-service] cancelTradeV2 failed:', error);
      return { success: false, error };
    }

    console.log('[trade-service] Attempting to cancel trade:', { 
      tradeId, 
      userId: user.id, 
      reason: reason || 'No reason provided' 
    });

    const { data, error } = await supabase.rpc('cancel_trade_v2', {
      p_trade_id: tradeId,
      p_user_id: user.id,
      p_reason: reason || null
    } as any);

    if (error) {
      console.error('[trade-service] cancelTradeV2 RPC error:', error);
      console.error('[trade-service] Error details:', {
        code: (error as any).code,
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
      });

      // Parse and provide user-friendly error messages
      let userFriendlyError = error.message;
      
      const errorLower = (error.message || '').toLowerCase();
      
      // Check for common database constraint violations
      if (errorLower.includes('no rows matched') || errorLower.includes('not found')) {
        userFriendlyError = 'Trade not found. It may have already been cancelled or deleted.';
      } else if (errorLower.includes('permission') || errorLower.includes('authorization')) {
        userFriendlyError = 'You do not have permission to cancel this trade. Only the buyer or seller can cancel.';
      } else if (errorLower.includes('invalid') || errorLower.includes('invalid_request_body')) {
        userFriendlyError = 'Invalid trade information. Please try again.';
      } else if (errorLower.includes('unique')) {
        userFriendlyError = 'This trade has already been processed. Cannot cancel.';
      } else if (errorLower.includes('timeout')) {
        userFriendlyError = 'The request timed out. Please check your connection and try again.';
      }

      return { success: false, error: userFriendlyError };
    }

    const result = data as any;
    
    if (!result) {
      console.error('[trade-service] cancelTradeV2 returned no data');
      return { success: false, error: 'Failed to process cancellation. Please try again.' };
    }

    if (!result.success) {
      console.error('[trade-service] cancelTradeV2 returned success=false:', result);
      return { success: false, error: result.error || 'Failed to cancel trade' };
    }

    console.log('[trade-service] Trade cancelled successfully:', {
      tradeId: result.trade_id,
      status: result.status,
      spRefunded: result.sp_refunded,
      reason
    });

    return { success: true };
  } catch (error: any) {
    console.error('[trade-service] cancelTradeV2 exception:', error);
    console.error('[trade-service] Error stack:', error.stack);
    
    let errorMessage = 'An unexpected error occurred while cancelling the trade.';
    if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
}
```

### Part 2: Create Cancellation Reason Modal Component
**File**: `p2p-kids-marketplace/src/components/molecules/CancellationReasonModal.tsx`

Create this new file:

```typescript
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
} from 'react-native';

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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
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

          <ScrollView style={styles.reasonsList} showsVerticalScrollIndicator={false}>
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
                  {selectedReason === reason.id && (
                    <View style={styles.radioButtonInner} />
                  )}
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
          </ScrollView>

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
              <Text style={styles.charCount}>
                {customReason.length}/500
              </Text>
            </View>
          )}

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
    maxHeight: '90%',
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
  reasonsList: {
    flex: 1,
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
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
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
```

### Part 3: Integrate Modal into Trade Cancellation Flow

**Identify where the cancel button is located** - typically in a screen or component that displays trade details.

Add this import:
```typescript
import { CancellationReasonModal } from './path-to/CancellationReasonModal';
```

Add state for the modal:
```typescript
const [showCancellationModal, setShowCancellationModal] = useState(false);
const [isCancelling, setIsCancelling] = useState(false);
```

Replace your cancel button handler:
```typescript
const handleCancelTrade = async (reason: string) => {
  setIsCancelling(true);
  try {
    const result = await cancelTradeV2(tradeId, reason);
    
    if (result.success) {
      // Show success message and refresh trade data
      Alert.alert('Success', 'Trade cancelled successfully');
      setShowCancellationModal(false);
      // Refresh your trades list or navigate back
    } else {
      // Show error message
      Alert.alert('Cancellation Failed', result.error || 'Unable to cancel trade');
    }
  } catch (error) {
    Alert.alert('Error', 'An unexpected error occurred');
  } finally {
    setIsCancelling(false);
  }
};

// Add to your JSX where cancel button is:
<Pressable onPress={() => setShowCancellationModal(true)}>
  <Text>Cancel Trade</Text>
</Pressable>

{/* Add the modal component */}
<CancellationReasonModal
  visible={showCancellationModal}
  itemTitle={trade?.item_title}
  onConfirm={handleCancelTrade}
  onCancel={() => setShowCancellationModal(false)}
  isLoading={isCancelling}
/>
```

## Implementation Checklist

- [ ] Update `cancelTradeV2` function with enhanced error handling
- [ ] Create `CancellationReasonModal.tsx` component
- [ ] Update trade detail/cancellation screen to import and use modal
- [ ] Connect cancel button to show modal
- [ ] Connect modal confirmation to `cancelTradeV2` with reason
- [ ] Test cancellation flow end-to-end
- [ ] Test error scenarios (authentication, unauthorized, trade not found)
- [ ] Verify cancellation reasons are saved to database
- [ ] Test SP refund is processed correctly
- [ ] Test modal UI and user experience

## Testing Scenarios

### Success Case
1. User taps cancel button → Modal appears
2. User selects reason → Confirm button enabled
3. User taps "Cancel Trade" → API call made
4. Server returns success → Trade marked as cancelled
5. Reason visible in database: `SELECT cancellation_reason FROM trades WHERE id = 'trade_id'`

### Error Cases
- **Trade already cancelled**: "Trade not found. It may have already been cancelled..."
- **User not authorized**: "You do not have permission to cancel this trade..."
- **Network timeout**: "The request timed out. Please check your connection..."
- **Invalid trade**: "Invalid trade information. Please try again."

## Database Verification

To verify cancellation reasons are being saved:

```sql
-- Check recent cancellations with reasons
SELECT id, status, cancelled_at, cancellation_reason 
FROM trades 
WHERE status = 'cancelled' 
ORDER BY cancelled_at DESC 
LIMIT 10;

-- Check SP refunds
SELECT user_id, points_after, reason 
FROM sp_ledger 
WHERE reason LIKE '%cancelled%' OR reason LIKE '%refund%'
ORDER BY created_at DESC 
LIMIT 10;
```

## Additional Improvements Made

1. **Enhanced Logging**: Added context logging with trade ID, user ID, and reason
2. **Error Categorization**: Parse database errors and map to user-friendly messages
3. **Success Logging**: Log successful cancellations with details including SP refunded
4. **User Experience**: Clear modal with predefined reasons and custom text option
5. **Character Limit**: 500 character limit for custom cancellation reasons
6. **Loading State**: Modal shows loading state while cancellation is in progress
7. **Accessibility**: Proper radio buttons, descriptions, and disabled states

## Notes

- The backend RPC `cancel_trade_v2` already supports all functionality
- No database migrations needed - schema already has `cancellation_reason` field
- The fix is purely frontend improvements to error handling and UX
- All error messages are logged for debugging and analytics
