/**
 * File: p2p-kids-marketplace/src/services/__tests__/cancelRequestService.test.ts
 * FIX-CANCEL (2026-09-01): unit tests for the buyer cancel-request service layer.
 *
 * Covers:
 *  - requestCancelTrade: calls fn_request_cancel_trade RPC with scope/reason
 *  - respondToCancelRequest('approve'): calls the cancel-trade EF with
 *    cancel_request_id (approve + cancel atomically)
 *  - respondToCancelRequest('decline'): calls fn_respond_cancel_request RPC
 *  - withdrawCancelRequest: calls fn_withdraw_cancel_request RPC
 *  - Error paths: RPC error, RPC success:false, EF error, EF success:false
 */

import { supabase } from '../../config/supabase';
import {
  requestCancelTrade,
  respondToCancelRequest,
  withdrawCancelRequest,
} from '../tradeServiceV2';

jest.mock('../../config/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockRpc = supabase.rpc as jest.Mock;
const mockInvoke = supabase.functions.invoke as jest.Mock;

const TRADE_ID = '11111111-2222-3333-4444-555555555555';
const USER_ID = 'buyer-001';

beforeEach(() => jest.clearAllMocks());

describe('requestCancelTrade', () => {
  it('calls fn_request_cancel_trade with reason + scope and returns success', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, trade_id: TRADE_ID, scope: 'all', timeout_hours: 48 },
      error: null,
    });

    const result = await requestCancelTrade(TRADE_ID, USER_ID, 'Changed my mind', 'all');

    expect(mockRpc).toHaveBeenCalledWith('fn_request_cancel_trade', {
      p_trade_id: TRADE_ID,
      p_user_id: USER_ID,
      p_reason: 'Changed my mind',
      p_scope: 'all',
    });
    expect(result.success).toBe(true);
    expect(result.data?.timeout_hours).toBe(48);
  });

  it('defaults scope to "all" and reason to null when omitted', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    await requestCancelTrade(TRADE_ID, USER_ID);

    expect(mockRpc).toHaveBeenCalledWith('fn_request_cancel_trade', {
      p_trade_id: TRADE_ID,
      p_user_id: USER_ID,
      p_reason: null,
      p_scope: 'all',
    });
  });

  it('throws when the RPC returns success:false with a message', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, code: 'UNRESOLVED_DISPUTE', error: 'Under review' },
      error: null,
    });

    await expect(requestCancelTrade(TRADE_ID, USER_ID)).rejects.toThrow('Under review');
  });

  it('throws on RPC transport error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'network down' } });
    await expect(requestCancelTrade(TRADE_ID, USER_ID)).rejects.toThrow(
      'Could not request a cancellation'
    );
  });
});

describe('respondToCancelRequest', () => {
  it('approve: invokes the cancel-trade EF with cancel_request_id', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, tradeId: TRADE_ID }, error: null });

    const result = await respondToCancelRequest(TRADE_ID, USER_ID, 'approve');

    expect(mockInvoke).toHaveBeenCalledWith('cancel-trade', {
      body: expect.objectContaining({ tradeId: TRADE_ID, cancel_request_id: TRADE_ID }),
    });
    expect(result.success).toBe(true);
  });

  it('approve: throws when EF returns success:false', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: 'Stripe hold failed' },
      error: null,
    });

    await expect(respondToCancelRequest(TRADE_ID, USER_ID, 'approve')).rejects.toThrow(
      'Stripe hold failed'
    );
  });

  it('approve: throws on EF error (parsed from context)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { context: { status: 400, code: 'EF_ERROR' } },
    });

    await expect(respondToCancelRequest(TRADE_ID, USER_ID, 'approve')).rejects.toThrow(
      'Could not approve the cancellation.'
    );
  });

  it('decline: calls fn_respond_cancel_request RPC with action decline', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, status: 'escalated', updated_trades: 1 },
      error: null,
    });

    const result = await respondToCancelRequest(TRADE_ID, USER_ID, 'decline');

    expect(mockRpc).toHaveBeenCalledWith('fn_respond_cancel_request', {
      p_trade_id: TRADE_ID,
      p_user_id: USER_ID,
      p_action: 'decline',
    });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('escalated');
  });

  it('decline: throws when the RPC returns success:false', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, code: 'NOT_PENDING', error: 'No pending request' },
      error: null,
    });

    await expect(respondToCancelRequest(TRADE_ID, USER_ID, 'decline')).rejects.toThrow(
      'No pending request'
    );
  });
});

describe('withdrawCancelRequest', () => {
  it('calls fn_withdraw_cancel_request RPC and returns success', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, updated_trades: 1 }, error: null });

    const result = await withdrawCancelRequest(TRADE_ID, USER_ID);

    expect(mockRpc).toHaveBeenCalledWith('fn_withdraw_cancel_request', {
      p_trade_id: TRADE_ID,
      p_user_id: USER_ID,
    });
    expect(result.success).toBe(true);
  });

  it('throws when the RPC returns success:false', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, code: 'NOT_PENDING', error: 'Cannot withdraw' },
      error: null,
    });

    await expect(withdrawCancelRequest(TRADE_ID, USER_ID)).rejects.toThrow('Cannot withdraw');
  });
});
