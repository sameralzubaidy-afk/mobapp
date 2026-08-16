/**
 * ENHANCED CANCELLATION FUNCTION REPLACEMENT
 * 
 * File: p2p-kids-marketplace/src/services/trade.ts
 * Replace the existing cancelTradeV2 function (around lines 320-345) with this version
 * 
 * This version includes:
 * - Enhanced error handling with detailed logging
 * - User-friendly error messages
 * - Proper error code detection and mapping
 * - Success logging with cancellation details
 */

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
