// File: p2p-kids-marketplace/src/__tests__/sp/wallet.test.ts
// MODULE-09 SP-001: Unit tests for SP Wallet Service

import { getWallet, getBalance, canSpendSP, getLedgerHistory, getSPConfig, getWalletSummary } from '@/services/sp/wallet';
import { supabase } from '@/config/supabase';

// Mock Supabase
jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  }
}));

describe('SP Wallet Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWallet', () => {
    it('should return existing wallet', async () => {
      const mockWallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        available_balance: 100,
        pending_balance: 0,
        lifetime_earned: 100,
        lifetime_spent: 0,
        state: 'active'
      };

      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockWallet, error: null })
      });

      const wallet = await getWallet('user-123');
      expect(wallet).toEqual(mockWallet);
    });

    it('should create wallet if not exists', async () => {
      const mockNewWallet = {
        id: 'wallet-new',
        user_id: 'user-new',
        available_balance: 0,
        pending_balance: 0,
        lifetime_earned: 0,
        lifetime_spent: 0,
        state: 'active'
      };

      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }),
        insert: jest.fn().mockReturnThis()
      });

      // Second select mock for the created wallet
      (supabase.from as any).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockNewWallet, error: null })
      });

      const wallet = await getWallet('user-new');
      expect(wallet?.user_id).toBe('user-new');
    });
  });

  describe('getBalance', () => {
    it('should return available balance', async () => {
      const mockWallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        available_balance: 250,
        state: 'active'
      };

      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockWallet, error: null })
      });

      const balance = await getBalance('user-123');
      expect(balance).toBe(250);
    });

    it('should return 0 if no wallet', async () => {
      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        insert: jest.fn().mockReturnThis()
      });

      const balance = await getBalance('user-no-wallet');
      expect(balance).toBe(0);
    });
  });

  describe('canSpendSP', () => {
    it('should allow spending for active subscriber with active wallet', async () => {
      (supabase.from as any)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { status: 'active' }, error: null })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { id: 'wallet-123', state: 'active' }, 
            error: null 
          })
        });

      const result = await canSpendSP('user-123');
      expect(result.allowed).toBe(true);
    });

    it('should block spending for non-subscriber', async () => {
      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await canSpendSP('user-free');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('subscription required');
    });

    it('should block spending for frozen wallet', async () => {
      (supabase.from as any)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { status: 'active' }, error: null })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ 
            data: { id: 'wallet-123', state: 'frozen' }, 
            error: null 
          })
        });

      const result = await canSpendSP('user-123');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('frozen');
    });
  });

  describe('getLedgerHistory', () => {
    it('should return ledger entries', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          user_id: 'user-123',
          transaction_type: 'earn_reward',
          amount: 100,
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'entry-2',
          user_id: 'user-123',
          transaction_type: 'spend_purchase',
          amount: -50,
          created_at: '2024-01-02T00:00:00Z'
        }
      ];

      (supabase.from as any).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockEntries, error: null })
      });

      const entries = await getLedgerHistory('user-123');
      expect(entries).toHaveLength(2);
      expect(entries[0].transaction_type).toBe('earn_reward');
    });
  });

  describe('getSPConfig', () => {
    it('should return config value', async () => {
      (supabase.rpc as any).mockResolvedValue({ 
        data: 10, 
        error: null 
      });

      const value = await getSPConfig('starter_pack_amount');
      expect(value).toBe(10);
    });

    it('should return null on error', async () => {
      (supabase.rpc as any).mockResolvedValue({ 
        data: null, 
        error: new Error('Config not found') 
      });

      const value = await getSPConfig('invalid_key');
      expect(value).toBeNull();
    });
  });

  describe('getWalletSummary', () => {
    it('should return wallet summary', async () => {
      const mockSummary = [{
        available_points: 100,
        pending_points: 0,
        lifetime_earned: 150,
        lifetime_spent: 50,
        wallet_state: 'active'
      }];

      (supabase.rpc as any).mockResolvedValue({ 
        data: mockSummary, 
        error: null 
      });

      const summary = await getWalletSummary('user-123');
      expect(summary.available_points).toBe(100);
      expect(summary.lifetime_earned).toBe(150);
    });

    it('should return empty summary if no wallet', async () => {
      (supabase.rpc as any).mockResolvedValue({ 
        data: [], 
        error: null 
      });

      const summary = await getWalletSummary('user-no-wallet');
      expect(summary.available_points).toBe(0);
      expect(summary.wallet_state).toBe('inactive');
    });
  });
});
