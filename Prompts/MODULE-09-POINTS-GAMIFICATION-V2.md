# MODULE 09: SWAP POINTS & GAMIFICATION

**Total Tasks:** 12  
**Estimated Time:** ~32 hours  
**Dependencies:** MODULE-02 (Authentication), MODULE-11 (Subscriptions)  
**Last Updated:** December 6, 2025  
**Version:** 2.0 - Aligned with SYSTEM_REQUIREMENTS_V2.md and BRD V2

---

## Changelog (Updated for V2)

- **Complete rewrite** for subscription-gated Swap Points (SP) model
- Renamed from "Points & Gamification" to "Swap Points & Gamification"
- SP is now **exclusive to Kids Club+ subscribers**
- Removed fixed 1:1 redemption rate - SP amounts now calculated via **admin-defined formulas**
- Added **admin-configurable SP expiration** (period, grace period, trigger type)
- Added **User Challenges system** for engagement
- Added **Badges system** (trust badges + donation badges, both admin-configurable)
- Added **Progress/Status bars** for gamification
- Added **Engagement monitoring** dashboard for admin
- Removed 50% SP usage cap - buyers can use **all their SP** (must pay fees in cash)
- Removed user-to-user SP transfers (out of scope)
- All settings are **admin-configurable** to avoid future development when business needs change
- Terminology: "trades" → "transactions", "points" → "Swap Points (SP)"

---

## Scope

### MVP Features
- ✅ SP wallet with balance tracking (subscription-gated)
- ✅ SP Starter Pack on first listing approval (Kids Club+ only)
- ✅ SP spending on item purchases (no cap, fees paid in cash)
- ✅ SP spending on platform fees (buyer/seller fees)
- ✅ SP ledger with full audit trail
- ✅ Admin-configurable SP expiration (period + grace period)
- ✅ FIFO expiration logic (oldest SP expires first)
- ✅ Expiration warnings (30, 14, 7 days before)
- ✅ User challenges (admin-defined, engagement driver)
- ✅ Trust badges (None → Bronze → Silver → Gold → Verified)
- ✅ Donation badges (Helper → Generous → Champion → Super Parent)
- ✅ Progress bars and status indicators
- ✅ Admin configuration UI for all SP/gamification settings
- ✅ Engagement monitoring dashboard

### Post-MVP Features
- ⏳ SP boosts for listing promotion
- ⏳ SP minimum purchase threshold
- ⏳ SP earning from completed sales (beyond starter pack)
- ⏳ SP multiplier events (2x SP weekends)
- ⏳ Leaderboards (top earners/spenders)
- ⏳ Achievement system with rewards

### Out of Scope
- ❌ User-to-user SP transfers (removed from roadmap)
- ❌ SP cash-out (closed-loop system)
- ❌ Fixed 1:1 SP redemption rate (replaced by admin formulas)

---

## Agent-Optimized Prompt Template (Claude Sonnet 4.5)

Add this preamble to each AI prompt block when running in Claude Sonnet 4.5 mode. It guides the agent to reason, verify, and produce tests alongside code.

```text
@agent: claude-sonnet-4.5
@mode: extended-reasoning
@autonomy: high

AGENT INSTRUCTIONS:
1. Read the entire task before generating code.
2. Produce a short plan (3-6 steps) and list any missing dependencies.
3. Generate the requested files exactly at the `filepath` locations.
4. Create unit tests for critical logic using the project's test framework.
5. Run a self-check list: type-check, lint, and run the new tests (if environment available).
6. Add concise TODO comments where manual verification is required (secrets, environment variables, or infra setup).

VERIFICATION STEPS (agent must print results):
- TypeScript type-check: `npm run type-check` (or `yarn tsc`)
- Linting: `npm run lint`
- Tests: `npm test -- --testPathPattern=<new tests>`

ERROR HANDLING RULES:
- If a required file/dependency is missing, stop and report exact missing paths.
- For runtime secrets (API keys), inject clear TODOs and do not attempt to store secrets in code.
- For database schema mismatches, add migration stubs and mark for manual review.

REASONING GUIDELINES:
- Provide brief chain-of-thought before producing complex SQL or payment flows.
- Flag performance, security, and privacy concerns.

KEY V2 REQUIREMENTS:
- All SP operations must check subscription status (Kids Club+ only)
- No fixed redemption rate - use admin-defined formulas
- Buyers can use ALL their SP (no 50% cap) but must pay fees in cash
- SP expiration is admin-configurable (period, grace period, trigger type)
- All settings must be admin-configurable via admin_config table
```

---

## Overview

This module implements the complete Swap Points (SP) and gamification system for the P2P Kids Marketplace. SP is a **subscription-gated virtual currency** exclusive to Kids Club+ members that creates engagement and retention.

### Key Concepts

**Swap Points (SP):**
- Virtual currency earned by Kids Club+ subscribers
- 1 SP value is **calculated by admin-defined formulas** (not fixed 1:1)
- Can be spent on item purchases and platform fees
- Cannot be cashed out (closed-loop)
- Expires based on admin-configurable rules

**Subscription Gating:**
- Only Kids Club+ subscribers can earn/spend SP
- Free users see SP features as upgrade prompts
- SP wallet is frozen when subscription lapses
- Grace period allows recovery after expiration

**Gamification:**
- User challenges drive engagement
- Trust badges build reputation
- Donation badges reward generosity
- Progress bars visualize achievements
- All thresholds are admin-configurable

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SWAP POINTS SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │ SP WALLET   │    │ SP LEDGER   │    │ ADMIN CONFIG        │ │
│  │             │    │             │    │                     │ │
│  │ • Balance   │◄──►│ • All txns  │◄──►│ • Expiry settings   │ │
│  │ • Pending   │    │ • Audit     │    │ • Formula settings  │ │
│  │ • Frozen    │    │ • FIFO      │    │ • Challenge config  │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│         │                  │                     │              │
│         ▼                  ▼                     ▼              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    SP OPERATIONS                            ││
│  │                                                             ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  ││
│  │  │  EARN    │  │  SPEND   │  │  EXPIRE  │  │  REFUND    │  ││
│  │  │          │  │          │  │          │  │            │  ││
│  │  │ • Starter│  │ • Items  │  │ • Daily  │  │ • Cancel   │  ││
│  │  │   Pack   │  │ • Fees   │  │   job    │  │   order    │  ││
│  │  │ • Rewards│  │ • Boosts │  │ • FIFO   │  │ • Dispute  │  ││
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                     GAMIFICATION SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │ CHALLENGES  │    │ BADGES      │    │ PROGRESS BARS       │ │
│  │             │    │             │    │                     │ │
│  │ • Daily     │    │ • Trust     │    │ • Challenge %       │ │
│  │ • Weekly    │    │ • Donation  │    │ • Badge progress    │ │
│  │ • Milestone │    │ • Special   │    │ • SP to next tier   │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Task Summary

| Task ID | Description | Duration | Priority |
|---------|-------------|----------|----------|
| SP-001 | SP Database Schema & Wallet | 3h | Critical |
| SP-002 | SP Earning Logic (Starter Pack + Rewards) | 2.5h | Critical |
| SP-003 | SP Spending Logic (Purchases + Fees) | 3h | Critical |
| SP-004 | SP Expiration System (Admin-Configurable) | 3h | High |
| SP-005 | User Challenges System | 3h | High |
| SP-006 | Badges System (Trust + Donation) | 2.5h | High |
| SP-007 | Progress Bars & Status Indicators | 2h | Medium |
| SP-008 | SP Wallet UI (Mobile) | 2.5h | High |
| SP-009 | Admin SP Configuration UI | 3h | Critical |
| SP-010 | Admin Challenges Configuration | 2.5h | High |
| SP-011 | Admin Badges Configuration | 2h | High |
| SP-012 | Engagement Monitoring Dashboard | 3h | Medium |

**Total Estimated Time:** ~32 hours

---

## TASK SP-001: SP Database Schema & Wallet

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** AUTH-001 (User authentication), SUB-001 (Subscription system)

### Description

Create the complete Swap Points database schema including:
- SP wallet table with balance tracking
- SP ledger for full audit trail with FIFO support
- Admin configuration table for SP settings
- RPC functions for atomic SP operations
- Subscription status checks on all SP operations

### Key Requirements (V2)

1. **Subscription Gating**: All SP operations must verify Kids Club+ status
2. **Admin-Configurable**: All SP settings stored in `admin_config` or dedicated config tables
3. **FIFO Expiration**: Track `issued_at` and `expires_at` per SP batch for proper expiration order
4. **Wallet States**: Support `active`, `frozen` (subscription lapsed), `grace_period` states
5. **Ledger Integrity**: Immutable append-only ledger with idempotency keys

---

### AI Prompt for Cursor (Generate SP Schema)

```typescript
/*
TASK: Create Swap Points database schema with subscription gating

CONTEXT:
Swap Points (SP) is a subscription-gated virtual currency for Kids Club+ members.
- SP value is calculated via admin-defined formulas (NOT fixed 1:1)
- SP can be spent on items and platform fees
- SP expires based on admin-configurable rules
- All operations require active Kids Club+ subscription

REQUIREMENTS:
1. Create sp_wallets table with balance and state tracking
2. Create sp_ledger table for immutable transaction history
3. Create sp_batches table for FIFO expiration tracking
4. Create sp_config table for admin-configurable settings
5. Implement atomic RPC functions with subscription checks
6. Add indexes for performance
7. Configure RLS policies

IMPORTANT V2 RULES:
- NO fixed redemption rate (admin defines formulas per category)
- NO 50% spending cap (users can spend all SP, pay fees in cash)
- Subscription status must be checked before ANY SP operation
- All thresholds/amounts must be admin-configurable

==================================================
FILE 1: Database migration for SP system
==================================================
*/

-- filepath: supabase/migrations/050_swap_points_system.sql

-- ============================================
-- SP WALLET TABLE
-- One wallet per user, tracks balance and state
-- ============================================

CREATE TABLE sp_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Balance tracking
  available_balance INTEGER NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance INTEGER NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  lifetime_expired INTEGER NOT NULL DEFAULT 0,
  
  -- Wallet state (tied to subscription status)
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'frozen', 'grace_period')),
  frozen_at TIMESTAMP WITH TIME ZONE,
  grace_period_ends_at TIMESTAMP WITH TIME ZONE,
  
  -- Starter pack tracking
  starter_pack_issued BOOLEAN NOT NULL DEFAULT FALSE,
  starter_pack_issued_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One wallet per user
  UNIQUE(user_id)
);

CREATE INDEX sp_wallets_user_id_idx ON sp_wallets(user_id);
CREATE INDEX sp_wallets_state_idx ON sp_wallets(state);

-- ============================================
-- SP BATCHES TABLE
-- Tracks SP issuance for FIFO expiration
-- ============================================

CREATE TABLE sp_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES sp_wallets(id) ON DELETE CASCADE,
  
  -- Batch details
  original_amount INTEGER NOT NULL CHECK (original_amount > 0),
  remaining_amount INTEGER NOT NULL CHECK (remaining_amount >= 0),
  source_type TEXT NOT NULL CHECK (source_type IN (
    'starter_pack', 'purchase_reward', 'referral', 'challenge_reward', 
    'admin_grant', 'refund', 'promotion'
  )),
  source_description TEXT NOT NULL,
  
  -- Expiration tracking
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expired_amount INTEGER NOT NULL DEFAULT 0,
  
  -- Related entities
  related_transaction_id UUID,
  related_listing_id UUID,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure remaining doesn't exceed original
  CONSTRAINT remaining_lte_original CHECK (remaining_amount <= original_amount)
);

CREATE INDEX sp_batches_wallet_id_idx ON sp_batches(wallet_id);
CREATE INDEX sp_batches_expires_at_idx ON sp_batches(expires_at);
CREATE INDEX sp_batches_remaining_idx ON sp_batches(remaining_amount) WHERE remaining_amount > 0;

-- ============================================
-- SP LEDGER TABLE
-- Immutable audit trail for all SP movements
-- ============================================

CREATE TABLE sp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES sp_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'earn_starter_pack', 'earn_reward', 'earn_referral', 'earn_challenge',
    'earn_refund', 'earn_admin_grant', 'earn_promotion',
    'spend_purchase', 'spend_fee', 'spend_boost',
    'expire', 'freeze', 'unfreeze', 'admin_deduct'
  )),
  
  -- Amounts (positive for earn, negative for spend/expire)
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  
  -- Description
  description TEXT NOT NULL,
  
  -- Related entities
  related_transaction_id UUID,
  related_listing_id UUID,
  related_batch_id UUID REFERENCES sp_batches(id),
  
  -- Admin actions
  admin_id UUID REFERENCES users(id),
  admin_note TEXT,
  
  -- Idempotency (prevent duplicate entries)
  idempotency_key TEXT UNIQUE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Immutable timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX sp_ledger_wallet_id_idx ON sp_ledger(wallet_id);
CREATE INDEX sp_ledger_user_id_idx ON sp_ledger(user_id);
CREATE INDEX sp_ledger_type_idx ON sp_ledger(transaction_type);
CREATE INDEX sp_ledger_created_at_idx ON sp_ledger(created_at DESC);
CREATE INDEX sp_ledger_idempotency_idx ON sp_ledger(idempotency_key);

-- ============================================
-- SP CONFIGURATION TABLE
-- Admin-configurable settings for SP system
-- ============================================

CREATE TABLE sp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Config identification
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('number', 'boolean', 'string', 'json')),
  
  -- Metadata
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  
  -- Audit
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX sp_config_category_idx ON sp_config(category);

-- ============================================
-- SEED DEFAULT SP CONFIGURATION
-- ============================================

INSERT INTO sp_config (config_key, config_value, value_type, description, category) VALUES
  -- Starter Pack
  ('starter_pack_enabled', 'true', 'boolean', 'Enable SP starter pack for new subscribers', 'starter_pack'),
  ('starter_pack_amount', '10', 'number', 'SP amount for starter pack', 'starter_pack'),
  ('starter_pack_requires_listing', 'true', 'boolean', 'Require first listing approval before issuing starter pack', 'starter_pack'),
  
  -- Expiration Settings
  ('expiration_enabled', 'true', 'boolean', 'Enable SP expiration', 'expiration'),
  ('expiration_period_days', '365', 'number', 'Days until SP expires from issuance', 'expiration'),
  ('expiration_trigger', '"issuance_date"', 'string', 'Trigger type: issuance_date, last_activity, subscription_cancel', 'expiration'),
  ('grace_period_days', '90', 'number', 'Days after expiration before SP is permanently deleted', 'expiration'),
  
  -- Expiration Warnings
  ('expiration_warning_days', '[30, 14, 7]', 'json', 'Days before expiration to send warnings', 'expiration'),
  
  -- Spending Rules
  ('sp_can_pay_buyer_fee', 'true', 'boolean', 'Allow SP to pay buyer protection fee', 'spending'),
  ('sp_can_pay_seller_fee', 'true', 'boolean', 'Allow SP to pay seller commission', 'spending'),
  ('sp_can_pay_delivery', 'false', 'boolean', 'Allow SP to pay delivery fee (real-world cost)', 'spending'),
  ('sp_minimum_spend', '0', 'number', 'Minimum SP amount per transaction (0 = no minimum)', 'spending'),
  
  -- Gamification Toggles
  ('show_progress_bars', 'true', 'boolean', 'Show progress bars in UI', 'gamification'),
  ('show_badges', 'true', 'boolean', 'Show badges on profiles', 'gamification'),
  ('show_celebrations', 'true', 'boolean', 'Show celebration animations on SP earn', 'gamification'),
  ('show_sp_counter', 'true', 'boolean', 'Show persistent SP balance counter', 'gamification')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE sp_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_config ENABLE ROW LEVEL SECURITY;

-- SP Wallets: Users can view own, admins can view all
CREATE POLICY "Users can view own wallet"
  ON sp_wallets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all wallets"
  ON sp_wallets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- SP Batches: Users can view own
CREATE POLICY "Users can view own batches"
  ON sp_batches FOR SELECT
  USING (wallet_id IN (
    SELECT id FROM sp_wallets WHERE user_id = auth.uid()
  ));

-- SP Ledger: Users can view own
CREATE POLICY "Users can view own ledger"
  ON sp_ledger FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all ledger entries"
  ON sp_ledger FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- SP Config: Anyone can read, only admins can modify
CREATE POLICY "Anyone can read SP config"
  ON sp_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can modify SP config"
  ON sp_config FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user has active Kids Club+ subscription
CREATE OR REPLACE FUNCTION is_subscriber(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = p_user_id
    AND status IN ('active', 'trial')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get SP config value
CREATE OR REPLACE FUNCTION get_sp_config(p_key TEXT)
RETURNS JSONB AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT config_value INTO v_value
  FROM sp_config
  WHERE config_key = p_key;
  
  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get or create wallet for user
CREATE OR REPLACE FUNCTION get_or_create_wallet(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Try to get existing wallet
  SELECT id INTO v_wallet_id
  FROM sp_wallets
  WHERE user_id = p_user_id;
  
  -- Create if not exists
  IF v_wallet_id IS NULL THEN
    INSERT INTO sp_wallets (user_id)
    VALUES (p_user_id)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE TRIGGER update_sp_wallets_updated_at
  BEFORE UPDATE ON sp_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sp_config_updated_at
  BEFORE UPDATE ON sp_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

/*
==================================================
FILE 2: SP Wallet Service (TypeScript)
==================================================
*/

// filepath: src/services/sp/wallet.ts

import { createClient } from '@/lib/supabase';

export interface SPWallet {
  id: string;
  user_id: string;
  available_balance: number;
  pending_balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  lifetime_expired: number;
  state: 'active' | 'frozen' | 'grace_period';
  frozen_at?: string;
  grace_period_ends_at?: string;
  starter_pack_issued: boolean;
  starter_pack_issued_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SPBatch {
  id: string;
  wallet_id: string;
  original_amount: number;
  remaining_amount: number;
  source_type: string;
  source_description: string;
  issued_at: string;
  expires_at: string;
  expired_amount: number;
}

export interface SPLedgerEntry {
  id: string;
  wallet_id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
}

/**
 * Get user's SP wallet (creates if not exists)
 */
export async function getWallet(userId: string): Promise<SPWallet | null> {
  const supabase = createClient();
  
  try {
    // First try to get existing wallet
    let { data: wallet, error } = await supabase
      .from('sp_wallets')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // No wallet exists, create one
      const { data: newWallet, error: createError } = await supabase
        .from('sp_wallets')
        .insert({ user_id: userId })
        .select()
        .single();
      
      if (createError) throw createError;
      wallet = newWallet;
    } else if (error) {
      throw error;
    }
    
    return wallet;
  } catch (error) {
    console.error('Get wallet error:', error);
    return null;
  }
}

/**
 * Get user's SP balance (quick check)
 */
export async function getBalance(userId: string): Promise<number> {
  const wallet = await getWallet(userId);
  return wallet?.available_balance || 0;
}

/**
 * Check if user can spend SP (has active subscription)
 */
export async function canSpendSP(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const supabase = createClient();
  
  try {
    // Check subscription status
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('status')
      .eq('user_id', userId)
      .in('status', ['active', 'trial'])
      .single();
    
    if (!subscription) {
      return { allowed: false, reason: 'Kids Club+ subscription required to use Swap Points' };
    }
    
    // Check wallet state
    const wallet = await getWallet(userId);
    if (!wallet) {
      return { allowed: false, reason: 'SP wallet not found' };
    }
    
    if (wallet.state === 'frozen') {
      return { allowed: false, reason: 'SP wallet is frozen. Please renew your subscription.' };
    }
    
    if (wallet.state === 'grace_period') {
      return { allowed: false, reason: 'SP wallet is in grace period. Renew subscription to access your SP.' };
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Check SP spend eligibility error:', error);
    return { allowed: false, reason: 'Unable to verify SP eligibility' };
  }
}

/**
 * Get SP ledger history for user
 */
export async function getLedgerHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<SPLedgerEntry[]> {
  const supabase = createClient();
  
  try {
    const { data, error } = await supabase
      .from('sp_ledger')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get ledger history error:', error);
    return [];
  }
}

/**
 * Get SP batches expiring soon
 */
export async function getExpiringBatches(
  userId: string,
  withinDays: number = 30
): Promise<SPBatch[]> {
  const supabase = createClient();
  
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + withinDays);
    
    const wallet = await getWallet(userId);
    if (!wallet) return [];
    
    const { data, error } = await supabase
      .from('sp_batches')
      .select('*')
      .eq('wallet_id', wallet.id)
      .gt('remaining_amount', 0)
      .lte('expires_at', futureDate.toISOString())
      .order('expires_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get expiring batches error:', error);
    return [];
  }
}

/**
 * Get SP configuration value
 */
export async function getSPConfig(key: string): Promise<any> {
  const supabase = createClient();
  
  try {
    const { data, error } = await supabase
      .from('sp_config')
      .select('config_value, value_type')
      .eq('config_key', key)
      .single();
    
    if (error) throw error;
    
    // Parse based on value type
    const value = data.config_value;
    switch (data.value_type) {
      case 'number':
        return typeof value === 'string' ? parseFloat(value) : value;
      case 'boolean':
        return value === true || value === 'true';
      case 'json':
        return typeof value === 'string' ? JSON.parse(value) : value;
      default:
        return value;
    }
  } catch (error) {
    console.error(`Get SP config error for key ${key}:`, error);
    return null;
  }
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ sp_wallets table created with balance and state tracking
✓ sp_batches table created for FIFO expiration
✓ sp_ledger table created for immutable audit trail
✓ sp_config table created with default settings
✓ All SP configs are admin-editable
✓ RLS policies protect user data
✓ Helper functions for subscription checks
✓ Wallet service with TypeScript types
✓ Subscription gating enforced on all operations

==================================================
NEXT TASK
==================================================

SP-002: SP Earning Logic (Starter Pack + Rewards)
*/
```

---

### Output Files

1. **supabase/migrations/050_swap_points_system.sql** - Complete SP schema
2. **src/services/sp/wallet.ts** - SP wallet service

---

### Database Tables Created

| Table | Purpose |
|-------|---------|
| `sp_wallets` | One per user, tracks balance and wallet state |
| `sp_batches` | Tracks SP issuance batches for FIFO expiration |
| `sp_ledger` | Immutable audit trail for all SP movements |
| `sp_config` | Admin-configurable SP settings |

---

### Key Design Decisions

1. **FIFO Expiration**: `sp_batches` table tracks each issuance separately with `expires_at` timestamp
2. **Wallet States**: `active`, `frozen`, `grace_period` tied to subscription status
3. **Idempotency**: `idempotency_key` in ledger prevents duplicate transactions
4. **Admin Config**: All thresholds stored in `sp_config` table, not hardcoded
5. **Subscription Check**: `is_subscriber()` function used before any SP operation

---

### Testing Checklist

- [ ] Wallet created automatically for new users
- [ ] Balance tracking accurate (available, pending, lifetime)
- [ ] Wallet state changes with subscription status
- [ ] Batches created with correct expiration dates
- [ ] Ledger entries immutable (no updates/deletes)
- [ ] Config values retrievable and type-safe
- [ ] RLS prevents cross-user data access
- [ ] Subscription check blocks non-subscribers

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Design schema (tables, indexes, constraints) | 60 min |
| Create RLS policies | 30 min |
| Implement helper functions | 30 min |
| Build TypeScript wallet service | 45 min |
| Testing | 15 min |
| **Total** | **~3 hours** |

---

<!-- 
MICRO-TASK 09-B COMPLETE
Next: 09-C (Task SP-002: SP Earning Logic)
-->

---

## TASK SP-002: SP Earning Logic (Starter Pack + Rewards)

**Duration:** 2.5 hours  
**Priority:** Critical  
**Dependencies:** SP-001 (SP Schema), SUB-004 (Subscription Purchase)

### Description

Implement SP earning mechanisms for Kids Club+ subscribers:
1. **Starter Pack**: Issued after first listing approval (one-time per subscription)
2. **Referral Rewards**: SP granted when referral completes (admin-configurable amount, can be $ and/or SP)
3. **Challenge Rewards**: SP granted on challenge completion
4. **Refunds**: SP returned when transaction is cancelled

All earning amounts are **admin-configurable**. Fraud prevention logic included.

### Key Requirements (V2)

1. **Subscription Check**: Only Kids Club+ subscribers can earn SP
2. **Admin-Configurable Amounts**: All SP rewards stored in `sp_config`
3. **Fraud Prevention**: Rate limiting, duplicate detection, suspicious activity flags
4. **Referral Flexibility**: Can reward $, SP, or both (per your requirement)
5. **Atomic Operations**: All SP credits with ledger entries in single transaction

---

### AI Prompt for Cursor (Generate SP Earning Logic)

```typescript
/*
TASK: Implement SP earning logic with fraud prevention

CONTEXT:
Kids Club+ subscribers earn SP through:
1. Starter Pack (first listing approved) - one-time
2. Referral rewards (referee completes first transaction)
3. Challenge rewards (complete a challenge)
4. Refunds (transaction cancelled)

REQUIREMENTS:
1. Verify Kids Club+ subscription before any SP credit
2. All amounts from admin_config (not hardcoded)
3. Fraud prevention: rate limits, duplicate checks
4. Referral rewards can be $ added to balance, SP, or both
5. Atomic operations with ledger entries
6. Idempotency keys prevent duplicate credits

FRAUD PREVENTION RULES:
- Max 1 starter pack per user per subscription period
- Max 10 referral rewards per day per user
- Duplicate idempotency keys rejected
- Flag accounts with unusual earning patterns

==================================================
FILE 1: SP Earning Service
==================================================
*/

// filepath: src/services/sp/earning.ts

import { createClient } from '@/lib/supabase';
import { getWallet, getSPConfig, canSpendSP } from './wallet';

export interface EarnResult {
  success: boolean;
  amount?: number;
  error?: string;
  ledger_entry_id?: string;
}

export interface ReferralRewardConfig {
  sp_amount: number;
  cash_amount: number; // In cents, added to user's payout balance
  enabled: boolean;
}

/**
 * Issue Starter Pack to new subscriber after first listing approval
 * One-time per subscription period
 */
export async function issueStarterPack(userId: string, listingId: string): Promise<EarnResult> {
  const supabase = createClient();
  
  try {
    // 1. Verify subscription
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('id, status')
      .eq('user_id', userId)
      .in('status', ['active', 'trial'])
      .single();
    
    if (!subscription) {
      return { success: false, error: 'Kids Club+ subscription required' };
    }
    
    // 2. Check if starter pack already issued
    const wallet = await getWallet(userId);
    if (!wallet) {
      return { success: false, error: 'Wallet not found' };
    }
    
    if (wallet.starter_pack_issued) {
      return { success: false, error: 'Starter pack already issued for this subscription' };
    }
    
    // 3. Check if starter pack is enabled
    const starterPackEnabled = await getSPConfig('starter_pack_enabled');
    if (!starterPackEnabled) {
      return { success: false, error: 'Starter pack is currently disabled' };
    }
    
    // 4. Get starter pack amount from config
    const starterPackAmount = await getSPConfig('starter_pack_amount') || 10;
    
    // 5. Get expiration period
    const expirationDays = await getSPConfig('expiration_period_days') || 365;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);
    
    // 6. Create idempotency key
    const idempotencyKey = `starter_pack_${userId}_${subscription.id}`;
    
    // 7. Execute atomic transaction
    const { data, error } = await supabase.rpc('issue_sp_starter_pack', {
      p_user_id: userId,
      p_wallet_id: wallet.id,
      p_amount: starterPackAmount,
      p_expires_at: expiresAt.toISOString(),
      p_listing_id: listingId,
      p_idempotency_key: idempotencyKey
    });
    
    if (error) {
      if (error.message.includes('duplicate')) {
        return { success: false, error: 'Starter pack already issued' };
      }
      throw error;
    }
    
    return {
      success: true,
      amount: starterPackAmount,
      ledger_entry_id: data.ledger_entry_id
    };
    
  } catch (error) {
    console.error('Issue starter pack error:', error);
    return { success: false, error: 'Failed to issue starter pack' };
  }
}

/**
 * Grant referral reward (can be SP, cash, or both)
 * Called when referee completes their first transaction
 */
export async function grantReferralReward(
  referrerId: string,
  refereeId: string,
  referralId: string
): Promise<EarnResult> {
  const supabase = createClient();
  
  try {
    // 1. Verify referrer has active subscription (for SP portion)
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('id, status')
      .eq('user_id', referrerId)
      .in('status', ['active', 'trial'])
      .single();
    
    // 2. Get referral reward config
    const rewardConfig = await getSPConfig('referral_reward') as ReferralRewardConfig;
    if (!rewardConfig || !rewardConfig.enabled) {
      return { success: false, error: 'Referral rewards are disabled' };
    }
    
    // 3. Fraud check: Rate limit (max 10 referrals per day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: todayReferrals } = await supabase
      .from('sp_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', referrerId)
      .eq('transaction_type', 'earn_referral')
      .gte('created_at', today.toISOString());
    
    if ((todayReferrals || 0) >= 10) {
      // Flag for admin review
      await supabase.from('fraud_flags').insert({
        user_id: referrerId,
        flag_type: 'excessive_referrals',
        details: { referrals_today: todayReferrals, attempted_referral_id: referralId }
      });
      return { success: false, error: 'Daily referral limit reached' };
    }
    
    // 4. Idempotency check
    const idempotencyKey = `referral_${referralId}_${referrerId}`;
    
    // 5. Process SP reward (if subscriber and SP amount > 0)
    let spAwarded = 0;
    if (subscription && rewardConfig.sp_amount > 0) {
      const wallet = await getWallet(referrerId);
      if (wallet) {
        const expirationDays = await getSPConfig('expiration_period_days') || 365;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expirationDays);
        
        const { error: spError } = await supabase.rpc('credit_sp', {
          p_user_id: referrerId,
          p_wallet_id: wallet.id,
          p_amount: rewardConfig.sp_amount,
          p_source_type: 'referral',
          p_description: `Referral reward for inviting a friend`,
          p_expires_at: expiresAt.toISOString(),
          p_idempotency_key: `${idempotencyKey}_sp`
        });
        
        if (!spError) {
          spAwarded = rewardConfig.sp_amount;
        }
      }
    }
    
    // 6. Process cash reward (added to payout balance, not SP)
    let cashAwarded = 0;
    if (rewardConfig.cash_amount > 0) {
      const { error: cashError } = await supabase
        .from('user_balances')
        .upsert({
          user_id: referrerId,
          pending_payout: rewardConfig.cash_amount
        }, {
          onConflict: 'user_id'
        });
      
      if (!cashError) {
        cashAwarded = rewardConfig.cash_amount;
        
        // Log cash reward
        await supabase.from('payout_ledger').insert({
          user_id: referrerId,
          amount: rewardConfig.cash_amount,
          type: 'referral_bonus',
          description: 'Referral cash bonus',
          related_referral_id: referralId,
          idempotency_key: `${idempotencyKey}_cash`
        });
      }
    }
    
    // 7. Update referral record
    await supabase
      .from('referrals')
      .update({
        reward_issued: true,
        sp_rewarded: spAwarded,
        cash_rewarded: cashAwarded,
        rewarded_at: new Date().toISOString()
      })
      .eq('id', referralId);
    
    return {
      success: true,
      amount: spAwarded,
      // Include cash info in response
    };
    
  } catch (error) {
    console.error('Grant referral reward error:', error);
    return { success: false, error: 'Failed to grant referral reward' };
  }
}

/**
 * Grant challenge completion reward
 */
export async function grantChallengeReward(
  userId: string,
  challengeId: string,
  rewardAmount: number
): Promise<EarnResult> {
  const supabase = createClient();
  
  try {
    // 1. Verify subscription
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('id, status')
      .eq('user_id', userId)
      .in('status', ['active', 'trial'])
      .single();
    
    if (!subscription) {
      return { success: false, error: 'Kids Club+ subscription required' };
    }
    
    // 2. Verify challenge exists and is not already claimed
    const { data: challenge } = await supabase
      .from('user_challenges')
      .select('*')
      .eq('id', challengeId)
      .eq('user_id', userId)
      .single();
    
    if (!challenge) {
      return { success: false, error: 'Challenge not found' };
    }
    
    if (challenge.reward_claimed) {
      return { success: false, error: 'Challenge reward already claimed' };
    }
    
    if (challenge.status !== 'completed') {
      return { success: false, error: 'Challenge not completed' };
    }
    
    // 3. Get wallet and expiration
    const wallet = await getWallet(userId);
    if (!wallet) {
      return { success: false, error: 'Wallet not found' };
    }
    
    const expirationDays = await getSPConfig('expiration_period_days') || 365;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);
    
    // 4. Idempotency key
    const idempotencyKey = `challenge_${challengeId}_${userId}`;
    
    // 5. Credit SP
    const { data, error } = await supabase.rpc('credit_sp', {
      p_user_id: userId,
      p_wallet_id: wallet.id,
      p_amount: rewardAmount,
      p_source_type: 'challenge_reward',
      p_description: `Challenge completed: ${challenge.title}`,
      p_expires_at: expiresAt.toISOString(),
      p_idempotency_key: idempotencyKey
    });
    
    if (error) {
      if (error.message.includes('duplicate')) {
        return { success: false, error: 'Reward already claimed' };
      }
      throw error;
    }
    
    // 6. Mark challenge as rewarded
    await supabase
      .from('user_challenges')
      .update({
        reward_claimed: true,
        reward_claimed_at: new Date().toISOString()
      })
      .eq('id', challengeId);
    
    return {
      success: true,
      amount: rewardAmount,
      ledger_entry_id: data?.ledger_entry_id
    };
    
  } catch (error) {
    console.error('Grant challenge reward error:', error);
    return { success: false, error: 'Failed to grant challenge reward' };
  }
}

/**
 * Refund SP when transaction is cancelled
 */
export async function refundSP(
  userId: string,
  transactionId: string,
  spAmount: number,
  reason: string
): Promise<EarnResult> {
  const supabase = createClient();
  
  try {
    // Refunds can go to non-subscribers (they earned while subscribed)
    const wallet = await getWallet(userId);
    if (!wallet) {
      return { success: false, error: 'Wallet not found' };
    }
    
    // Get expiration (refunded SP gets fresh expiration)
    const expirationDays = await getSPConfig('expiration_period_days') || 365;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);
    
    // Idempotency key
    const idempotencyKey = `refund_${transactionId}_${userId}`;
    
    // Credit SP
    const { data, error } = await supabase.rpc('credit_sp', {
      p_user_id: userId,
      p_wallet_id: wallet.id,
      p_amount: spAmount,
      p_source_type: 'refund',
      p_description: `Refund: ${reason}`,
      p_expires_at: expiresAt.toISOString(),
      p_related_transaction_id: transactionId,
      p_idempotency_key: idempotencyKey
    });
    
    if (error) {
      if (error.message.includes('duplicate')) {
        return { success: false, error: 'Refund already processed' };
      }
      throw error;
    }
    
    return {
      success: true,
      amount: spAmount,
      ledger_entry_id: data?.ledger_entry_id
    };
    
  } catch (error) {
    console.error('Refund SP error:', error);
    return { success: false, error: 'Failed to refund SP' };
  }
}

/*
==================================================
FILE 2: Database RPC Function for SP Credit
==================================================
*/

-- filepath: supabase/migrations/051_sp_credit_functions.sql

-- Atomic function to credit SP (used by all earning methods)
CREATE OR REPLACE FUNCTION credit_sp(
  p_user_id UUID,
  p_wallet_id UUID,
  p_amount INTEGER,
  p_source_type TEXT,
  p_description TEXT,
  p_expires_at TIMESTAMP WITH TIME ZONE,
  p_related_transaction_id UUID DEFAULT NULL,
  p_related_listing_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_batch_id UUID;
  v_ledger_id UUID;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM sp_ledger WHERE idempotency_key = p_idempotency_key) THEN
      RAISE EXCEPTION 'duplicate idempotency key';
    END IF;
  END IF;
  
  -- Lock wallet row
  SELECT available_balance INTO v_balance_before
  FROM sp_wallets
  WHERE id = p_wallet_id
  FOR UPDATE;
  
  -- Calculate new balance
  v_balance_after := v_balance_before + p_amount;
  
  -- Create SP batch for FIFO tracking
  INSERT INTO sp_batches (
    wallet_id,
    original_amount,
    remaining_amount,
    source_type,
    source_description,
    issued_at,
    expires_at,
    related_transaction_id,
    related_listing_id
  ) VALUES (
    p_wallet_id,
    p_amount,
    p_amount,
    p_source_type,
    p_description,
    NOW(),
    p_expires_at,
    p_related_transaction_id,
    p_related_listing_id
  )
  RETURNING id INTO v_batch_id;
  
  -- Update wallet balance
  UPDATE sp_wallets
  SET 
    available_balance = v_balance_after,
    lifetime_earned = lifetime_earned + p_amount,
    updated_at = NOW()
  WHERE id = p_wallet_id;
  
  -- Create ledger entry
  INSERT INTO sp_ledger (
    wallet_id,
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    related_transaction_id,
    related_listing_id,
    related_batch_id,
    idempotency_key
  ) VALUES (
    p_wallet_id,
    p_user_id,
    'earn_' || p_source_type,
    p_amount,
    v_balance_before,
    v_balance_after,
    p_description,
    p_related_transaction_id,
    p_related_listing_id,
    v_batch_id,
    p_idempotency_key
  )
  RETURNING id INTO v_ledger_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'ledger_entry_id', v_ledger_id,
    'balance_after', v_balance_after
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Specific function for starter pack (includes starter_pack_issued flag update)
CREATE OR REPLACE FUNCTION issue_sp_starter_pack(
  p_user_id UUID,
  p_wallet_id UUID,
  p_amount INTEGER,
  p_expires_at TIMESTAMP WITH TIME ZONE,
  p_listing_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Check if already issued
  IF EXISTS (
    SELECT 1 FROM sp_wallets 
    WHERE id = p_wallet_id AND starter_pack_issued = true
  ) THEN
    RAISE EXCEPTION 'Starter pack already issued';
  END IF;
  
  -- Credit SP using common function
  v_result := credit_sp(
    p_user_id,
    p_wallet_id,
    p_amount,
    'starter_pack',
    'Welcome to Kids Club+! Here''s your starter pack.',
    p_expires_at,
    NULL,
    p_listing_id,
    p_idempotency_key
  );
  
  -- Mark starter pack as issued
  UPDATE sp_wallets
  SET 
    starter_pack_issued = true,
    starter_pack_issued_at = NOW()
  WHERE id = p_wallet_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 3: Add referral reward config to sp_config
==================================================
*/

-- filepath: supabase/migrations/052_sp_referral_config.sql

INSERT INTO sp_config (config_key, config_value, value_type, description, category) VALUES
  ('referral_reward', '{"enabled": true, "sp_amount": 10, "cash_amount": 0}', 'json', 
   'Referral reward config: sp_amount (SP given), cash_amount (cents added to payout balance)', 'referral'),
  ('referral_max_per_day', '10', 'number', 'Maximum referral rewards per user per day (fraud prevention)', 'referral'),
  ('referral_require_subscription', 'true', 'boolean', 'Require active subscription to earn SP referral rewards', 'referral')
ON CONFLICT (config_key) DO NOTHING;

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Starter pack issued only once per subscription
✓ Subscription verified before any SP credit
✓ All amounts from admin config (not hardcoded)
✓ Referral rewards can be SP, cash, or both
✓ Fraud prevention: rate limiting, duplicate detection
✓ Idempotency keys prevent duplicate credits
✓ FIFO tracking via sp_batches
✓ Full audit trail in sp_ledger
✓ Challenge rewards with completion verification
✓ Refunds credit SP with fresh expiration

==================================================
NEXT TASK
==================================================

SP-003: SP Spending Logic (Purchases + Fees)
*/
```

---

### Output Files

1. **src/services/sp/earning.ts** - SP earning service with all methods
2. **supabase/migrations/051_sp_credit_functions.sql** - RPC functions for atomic SP credit
3. **supabase/migrations/052_sp_referral_config.sql** - Referral reward configuration

---

### Earning Methods

| Method | Trigger | Amount Source | Subscription Required |
|--------|---------|---------------|----------------------|
| Starter Pack | First listing approved | `starter_pack_amount` config | Yes |
| Referral | Referee completes first transaction | `referral_reward` config (SP + cash) | Yes (for SP) |
| Challenge | Challenge completed | Challenge definition | Yes |
| Refund | Transaction cancelled | Original SP spent | No (already earned) |

---

### Fraud Prevention

| Check | Implementation |
|-------|----------------|
| Duplicate starter pack | `starter_pack_issued` flag + idempotency key |
| Excessive referrals | Max 10/day limit + `fraud_flags` table |
| Duplicate rewards | `idempotency_key` in ledger |
| Subscription verification | Check before every SP credit |

---

### Testing Checklist

- [ ] Starter pack issues correctly on first listing approval
- [ ] Starter pack blocked if already issued
- [ ] Non-subscribers cannot earn SP
- [ ] Referral rewards grant SP and/or cash correctly
- [ ] Referral rate limit (10/day) enforced
- [ ] Challenge rewards only on completed challenges
- [ ] Duplicate claims blocked by idempotency
- [ ] Refunds credit SP with new expiration
- [ ] All ledger entries created correctly

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Implement earning service | 60 min |
| Create RPC functions | 45 min |
| Fraud prevention logic | 30 min |
| Testing | 15 min |
| **Total** | **~2.5 hours** |

---

<!-- 
MICRO-TASK 09-C COMPLETE
Next: 09-D (Task SP-003: SP Spending Logic)
-->

---

## Task SP-003: SP Spending Logic (Purchases & Fees)

**Estimated Time:** 3 hours  
**Priority:** P0 - Critical Path  
**Dependencies:** SP-001 (Wallet), SP-002 (Earning), MODULE-11 (Subscriptions)

---

### Context

Swap Points can be used to reduce cash payments on:
1. **Item purchases** - Apply SP toward item price
2. **Platform fees** - Apply SP toward buyer/seller fees

**CRITICAL RULES:**
- No maximum SP usage cap - buyers can use ALL their SP on item price
- Platform fees (buyer fee, seller fee) **must be paid in cash** - SP cannot cover fees
- SP to cash conversion uses **admin-defined formulas per category**
- FIFO deduction - oldest SP batches consumed first
- Subscription status must be verified before SP spending

---

### Admin-Configurable SP Spending Settings

```sql
-- SP spending configuration (part of sp_config table)
INSERT INTO sp_config (key, value, category, updated_by) VALUES
  -- Conversion rates per category (JSON maps category_id to rate)
  ('sp_conversion_rates', '{"kids_clothing": 0.01, "toys": 0.01, "baby_gear": 0.015, "books": 0.008}', 'spending', NULL),
  -- Default rate if category not specified
  ('sp_default_conversion_rate', '0.01', 'spending', NULL),
  -- Whether SP can be used (master toggle)
  ('sp_spending_enabled', 'true', 'spending', NULL),
  -- Minimum SP to use per transaction (0 = no minimum)
  ('sp_min_spend_per_transaction', '0', 'spending', NULL),
  -- Whether to allow partial SP usage
  ('sp_allow_partial_spend', 'true', 'spending', NULL);
```

---

### SP Spending Service

**File: `src/services/sp/spending.ts`**

```typescript
import { supabase } from '@/lib/supabase';
import { verifySubscription } from '@/services/subscriptions/verify';
import { logToLedger, deductFromWallet, getSpBalance } from './wallet';

interface SpendingCalculation {
  itemPriceInCash: number;
  buyerFeeInCash: number;
  totalCashRequired: number;
  spApplied: number;
  spValueInCash: number;
  remainingItemPrice: number;
  conversionRate: number;
}

interface SpendRequest {
  userId: string;
  transactionId: string;
  itemPrice: number;
  buyerFee: number;
  categoryId: string;
  spToSpend: number; // User's chosen SP amount
}

/**
 * Calculate SP spending for a purchase
 * SP can ONLY reduce item price, NOT fees
 */
export async function calculateSpSpending(
  userId: string,
  itemPrice: number,
  buyerFee: number,
  categoryId: string,
  requestedSp: number
): Promise<SpendingCalculation> {
  // Get user's available SP balance
  const availableSp = await getSpBalance(userId);
  
  // Get conversion rate for this category
  const conversionRate = await getConversionRate(categoryId);
  
  // Determine actual SP to apply (cannot exceed available or requested)
  const spToApply = Math.min(requestedSp, availableSp);
  
  // Convert SP to cash value
  const spCashValue = spToApply * conversionRate;
  
  // SP can only reduce item price, NOT fees
  const maxSpCashValue = Math.min(spCashValue, itemPrice);
  const actualSpApplied = Math.floor(maxSpCashValue / conversionRate);
  const actualSpCashValue = actualSpApplied * conversionRate;
  
  // Calculate remaining amounts
  const remainingItemPrice = itemPrice - actualSpCashValue;
  
  return {
    itemPriceInCash: itemPrice,
    buyerFeeInCash: buyerFee, // Fees ALWAYS in cash
    totalCashRequired: remainingItemPrice + buyerFee,
    spApplied: actualSpApplied,
    spValueInCash: actualSpCashValue,
    remainingItemPrice,
    conversionRate
  };
}

/**
 * Get conversion rate for a category
 * Uses admin-configured rates, falls back to default
 */
async function getConversionRate(categoryId: string): Promise<number> {
  const { data: ratesConfig } = await supabase
    .from('sp_config')
    .select('value')
    .eq('key', 'sp_conversion_rates')
    .single();
  
  const rates = ratesConfig?.value ? JSON.parse(ratesConfig.value) : {};
  
  if (rates[categoryId]) {
    return parseFloat(rates[categoryId]);
  }
  
  // Fall back to default rate
  const { data: defaultConfig } = await supabase
    .from('sp_config')
    .select('value')
    .eq('key', 'sp_default_conversion_rate')
    .single();
  
  return parseFloat(defaultConfig?.value || '0.01');
}

/**
 * Execute SP spending for a transaction
 * Uses FIFO to deduct from oldest batches first
 */
export async function spendSp(request: SpendRequest): Promise<{
  success: boolean;
  spDeducted: number;
  cashSaved: number;
  error?: string;
}> {
  const { userId, transactionId, itemPrice, buyerFee, categoryId, spToSpend } = request;
  
  // Verify subscription (only subscribers can spend SP)
  const isSubscriber = await verifySubscription(userId);
  if (!isSubscriber) {
    return { success: false, spDeducted: 0, cashSaved: 0, error: 'Subscription required to use Swap Points' };
  }
  
  // Check if spending is enabled
  const spendingEnabled = await isSpendingEnabled();
  if (!spendingEnabled) {
    return { success: false, spDeducted: 0, cashSaved: 0, error: 'SP spending is currently disabled' };
  }
  
  // Calculate actual spending
  const calculation = await calculateSpSpending(userId, itemPrice, buyerFee, categoryId, spToSpend);
  
  if (calculation.spApplied === 0) {
    return { success: true, spDeducted: 0, cashSaved: 0 };
  }
  
  // Execute FIFO deduction from batches
  const deductionResult = await deductSpFifo(userId, calculation.spApplied, transactionId);
  
  if (!deductionResult.success) {
    return { success: false, spDeducted: 0, cashSaved: 0, error: deductionResult.error };
  }
  
  return {
    success: true,
    spDeducted: calculation.spApplied,
    cashSaved: calculation.spValueInCash
  };
}

/**
 * FIFO deduction from SP batches
 * Consumes oldest batches first, respects expiration
 */
async function deductSpFifo(
  userId: string,
  amountToDeduct: number,
  transactionId: string
): Promise<{ success: boolean; error?: string }> {
  // Get all active batches ordered by expiration (FIFO)
  const { data: batches, error: fetchError } = await supabase
    .from('sp_batches')
    .select('*')
    .eq('user_id', userId)
    .gt('remaining_sp', 0)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });
  
  if (fetchError || !batches) {
    return { success: false, error: 'Failed to fetch SP batches' };
  }
  
  let remaining = amountToDeduct;
  const deductions: Array<{ batchId: string; amount: number }> = [];
  
  for (const batch of batches) {
    if (remaining <= 0) break;
    
    const deductFromBatch = Math.min(remaining, batch.remaining_sp);
    deductions.push({ batchId: batch.id, amount: deductFromBatch });
    remaining -= deductFromBatch;
  }
  
  if (remaining > 0) {
    return { success: false, error: 'Insufficient SP balance' };
  }
  
  // Execute deductions in a transaction
  const { error: deductError } = await supabase.rpc('deduct_sp_fifo', {
    p_user_id: userId,
    p_deductions: deductions,
    p_transaction_id: transactionId,
    p_total_amount: amountToDeduct
  });
  
  if (deductError) {
    return { success: false, error: 'Failed to deduct SP' };
  }
  
  return { success: true };
}

async function isSpendingEnabled(): Promise<boolean> {
  const { data } = await supabase
    .from('sp_config')
    .select('value')
    .eq('key', 'sp_spending_enabled')
    .single();
  
  return data?.value === 'true';
}
```

---

### RPC Function for Atomic FIFO Deduction

**File: `supabase/migrations/YYYYMMDD_sp_deduct_fifo.sql`**

```sql
-- Atomic FIFO SP deduction
CREATE OR REPLACE FUNCTION deduct_sp_fifo(
  p_user_id UUID,
  p_deductions JSONB, -- Array of {batchId, amount}
  p_transaction_id UUID,
  p_total_amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deduction JSONB;
  v_batch_id UUID;
  v_amount INTEGER;
  v_wallet_id UUID;
BEGIN
  -- Get wallet ID
  SELECT id INTO v_wallet_id
  FROM sp_wallets
  WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'SP wallet not found';
  END IF;
  
  -- Verify total balance is sufficient
  IF (SELECT sp_balance FROM sp_wallets WHERE id = v_wallet_id) < p_total_amount THEN
    RAISE EXCEPTION 'Insufficient SP balance';
  END IF;
  
  -- Process each batch deduction
  FOR v_deduction IN SELECT * FROM jsonb_array_elements(p_deductions)
  LOOP
    v_batch_id := (v_deduction->>'batchId')::UUID;
    v_amount := (v_deduction->>'amount')::INTEGER;
    
    -- Deduct from batch
    UPDATE sp_batches
    SET remaining_sp = remaining_sp - v_amount,
        updated_at = NOW()
    WHERE id = v_batch_id
      AND remaining_sp >= v_amount;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Batch deduction failed for batch %', v_batch_id;
    END IF;
    
    -- Log each batch deduction to ledger
    INSERT INTO sp_ledger (
      wallet_id, user_id, transaction_type, sp_amount, batch_id,
      reference_type, reference_id, description
    ) VALUES (
      v_wallet_id, p_user_id, 'spend', -v_amount, v_batch_id,
      'transaction', p_transaction_id,
      'SP applied to purchase (batch: ' || v_batch_id::TEXT || ')'
    );
  END LOOP;
  
  -- Update wallet total
  UPDATE sp_wallets
  SET sp_balance = sp_balance - p_total_amount,
      lifetime_spent = lifetime_spent + p_total_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;
  
  RETURN TRUE;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION deduct_sp_fifo TO authenticated;
```

---

### Checkout Integration

**File: `src/services/checkout/spIntegration.ts`**

```typescript
import { calculateSpSpending, spendSp } from '@/services/sp/spending';

interface CheckoutWithSp {
  transactionId: string;
  buyerId: string;
  itemPrice: number;
  buyerFee: number;     // % of order + fixed fee (calculated upstream)
  categoryId: string;
  spToUse: number;      // User's input from slider/input
}

/**
 * Get SP spending preview for checkout UI
 * Shows user how much they'll save
 */
export async function getSpSpendingPreview(
  userId: string,
  itemPrice: number,
  buyerFee: number,
  categoryId: string,
  spToUse: number
) {
  const calculation = await calculateSpSpending(
    userId,
    itemPrice,
    buyerFee,
    categoryId,
    spToUse
  );
  
  return {
    // Display values
    spUsing: calculation.spApplied,
    spValue: calculation.spValueInCash.toFixed(2),
    itemPriceOriginal: itemPrice.toFixed(2),
    itemPriceAfterSp: calculation.remainingItemPrice.toFixed(2),
    buyerFee: calculation.buyerFeeInCash.toFixed(2), // Always full fee
    totalDue: calculation.totalCashRequired.toFixed(2),
    conversionRate: calculation.conversionRate,
    
    // Informational
    feesNote: 'Platform fees must be paid in cash and cannot be covered by Swap Points.'
  };
}

/**
 * Execute SP spending during checkout
 * Called after payment is confirmed
 */
export async function executeSpSpending(checkout: CheckoutWithSp) {
  return spendSp({
    userId: checkout.buyerId,
    transactionId: checkout.transactionId,
    itemPrice: checkout.itemPrice,
    buyerFee: checkout.buyerFee,
    categoryId: checkout.categoryId,
    spToSpend: checkout.spToUse
  });
}
```

---

### Checkout UI Component

**File: `src/components/checkout/SpSpendingSlider.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, Slider, StyleSheet } from 'react-native';
import { getSpBalance } from '@/services/sp/wallet';
import { getSpSpendingPreview } from '@/services/checkout/spIntegration';

interface Props {
  userId: string;
  itemPrice: number;
  buyerFee: number;
  categoryId: string;
  onSpChange: (spToUse: number) => void;
}

export function SpSpendingSlider({ userId, itemPrice, buyerFee, categoryId, onSpChange }: Props) {
  const [maxSp, setMaxSp] = useState(0);
  const [spToUse, setSpToUse] = useState(0);
  const [preview, setPreview] = useState<any>(null);
  
  useEffect(() => {
    loadBalance();
  }, [userId]);
  
  useEffect(() => {
    if (spToUse > 0) {
      updatePreview();
    }
  }, [spToUse]);
  
  async function loadBalance() {
    const balance = await getSpBalance(userId);
    setMaxSp(balance);
  }
  
  async function updatePreview() {
    const result = await getSpSpendingPreview(userId, itemPrice, buyerFee, categoryId, spToUse);
    setPreview(result);
    onSpChange(result.spUsing);
  }
  
  if (maxSp === 0) {
    return null; // No SP to spend
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Use Swap Points</Text>
      
      <View style={styles.sliderContainer}>
        <Text>0 SP</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={maxSp}
          step={1}
          value={spToUse}
          onValueChange={setSpToUse}
        />
        <Text>{maxSp} SP</Text>
      </View>
      
      <Text style={styles.using}>Using: {spToUse} SP</Text>
      
      {preview && (
        <View style={styles.preview}>
          <View style={styles.row}>
            <Text>Item Price:</Text>
            <Text style={styles.strikethrough}>${preview.itemPriceOriginal}</Text>
            <Text style={styles.newPrice}>${preview.itemPriceAfterSp}</Text>
          </View>
          <View style={styles.row}>
            <Text>You Save:</Text>
            <Text style={styles.savings}>${preview.spValue}</Text>
          </View>
          <View style={styles.row}>
            <Text>Buyer Fee:</Text>
            <Text>${preview.buyerFee}</Text>
          </View>
          <Text style={styles.feeNote}>{preview.feesNote}</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Due:</Text>
            <Text style={styles.totalAmount}>${preview.totalDue}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f8f9fa', borderRadius: 12 },
  header: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  sliderContainer: { flexDirection: 'row', alignItems: 'center' },
  slider: { flex: 1, marginHorizontal: 8 },
  using: { textAlign: 'center', marginTop: 8, fontSize: 16, color: '#6200ee' },
  preview: { marginTop: 16, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  strikethrough: { textDecorationLine: 'line-through', color: '#999' },
  newPrice: { fontWeight: '600', color: '#2e7d32' },
  savings: { color: '#2e7d32', fontWeight: '600' },
  feeNote: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#eee' },
  totalLabel: { fontSize: 18, fontWeight: '600' },
  totalAmount: { fontSize: 18, fontWeight: '700', color: '#6200ee' }
});
```

---

### SP Spending on Seller Fees

Seller fees are deducted from payout. SP spending for sellers works differently:

**File: `src/services/sp/sellerFeeSpending.ts`**

```typescript
import { supabase } from '@/lib/supabase';
import { verifySubscription } from '@/services/subscriptions/verify';
import { getSpBalance } from './wallet';

interface SellerFeeSpendingResult {
  spDeducted: number;
  cashFeeRemaining: number;
  netPayout: number;
}

/**
 * Apply SP to reduce seller fee
 * Note: Sellers CANNOT use SP for fees - fees must be cash
 * 
 * IMPORTANT: Per V2 requirements, ALL fees must be paid in cash.
 * This function returns the fee unchanged - no SP can be applied.
 */
export async function calculateSellerFeeWithSp(
  sellerId: string,
  salePrice: number,
  sellerFeePercent: number, // e.g., 0.10 for 10%
  sellerFixedFee: number    // e.g., 0.50
): Promise<SellerFeeSpendingResult> {
  const totalSellerFee = (salePrice * sellerFeePercent) + sellerFixedFee;
  const netPayout = salePrice - totalSellerFee;
  
  // SP CANNOT be used for fees per V2 requirements
  return {
    spDeducted: 0,
    cashFeeRemaining: totalSellerFee,
    netPayout
  };
}
```

---

### Database: Spending Configuration Defaults

```sql
-- Insert default spending configuration
INSERT INTO sp_config (key, value, category) VALUES
  ('sp_spending_enabled', 'true', 'spending'),
  ('sp_default_conversion_rate', '0.01', 'spending'),
  ('sp_conversion_rates', '{"default": 0.01}', 'spending'),
  ('sp_min_spend_per_transaction', '0', 'spending');
```

---

### Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| User not subscribed | Return error, no SP spending allowed |
| Spending disabled | Return error with message |
| SP exceeds item price | Cap SP usage at item price value |
| Insufficient SP | Use available amount, not requested |
| Expired batches | Skip expired batches in FIFO |
| Zero SP balance | Return success with 0 deducted |
| Category not in rates | Use default conversion rate |

---

### Testing Checklist

- [ ] Non-subscribers cannot spend SP
- [ ] SP slider shows correct max balance
- [ ] Spending preview calculates correctly
- [ ] FIFO deducts oldest batches first
- [ ] Expired batches are skipped
- [ ] SP cannot exceed item price value
- [ ] Fees always charged in cash
- [ ] Wallet balance updates correctly
- [ ] Ledger entries created for each batch deduction
- [ ] Spending disabled toggle works
- [ ] Category-specific rates applied correctly
- [ ] Default rate used when category missing

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Spending calculation service | 45 min |
| FIFO deduction logic | 45 min |
| RPC function | 30 min |
| Checkout integration | 30 min |
| UI component | 30 min |
| Testing | 20 min |
| **Total** | **~3 hours** |

---

<!-- 
MICRO-TASK 09-D COMPLETE
Next: 09-E (Task SP-004: SP Expiration System)
-->

---

## Task SP-004: SP Expiration System

**Estimated Time:** 3 hours  
**Priority:** P0 - Critical Path  
**Dependencies:** SP-001 (Wallet), SP-002 (Earning)

---

### Context

Swap Points have a configurable expiration to encourage platform engagement and manage liability. The expiration system includes:

1. **Configurable expiration period** - Admin sets how long SP are valid
2. **Configurable trigger type** - When expiration countdown starts
3. **Grace period** - 90-day period after expiration before permanent deletion
4. **Warning notifications** - 30, 14, 7 days before expiration
5. **Cron job** - Automated daily processing of expirations

---

### Admin-Configurable Expiration Settings

```sql
-- SP expiration configuration (part of sp_config table)
INSERT INTO sp_config (key, value, category, description, updated_by) VALUES
  -- Expiration period in days (0 = never expires)
  ('sp_expiration_days', '365', 'expiration', 'Days until SP expire after trigger', NULL),
  
  -- Grace period in days (period after expiration before permanent deletion)
  ('sp_grace_period_days', '90', 'expiration', 'Days after expiration before SP are deleted', NULL),
  
  -- Expiration trigger type
  -- Options: 'from_earn_date', 'from_last_activity', 'from_subscription_lapse', 'never'
  ('sp_expiration_trigger', 'from_earn_date', 'expiration', 'When expiration countdown begins', NULL),
  
  -- Warning notification days (comma-separated)
  ('sp_warning_days', '30,14,7', 'expiration', 'Days before expiration to send warnings', NULL),
  
  -- Whether to send expiration warnings
  ('sp_expiration_warnings_enabled', 'true', 'expiration', 'Enable expiration warning notifications', NULL),
  
  -- Whether expiration is enabled at all
  ('sp_expiration_enabled', 'true', 'expiration', 'Master toggle for SP expiration', NULL);
```

---

### Expiration Trigger Types

| Trigger | Description | Use Case |
|---------|-------------|----------|
| `from_earn_date` | SP expires X days after earned | Standard model - each batch has its own expiration |
| `from_last_activity` | SP expires X days after last transaction | Encourages ongoing engagement |
| `from_subscription_lapse` | SP expires X days after subscription ends | Ties SP to subscription value |
| `never` | SP never expires | High-value user retention |

---

### Expiration Service

**File: `src/services/sp/expiration.ts`**

```typescript
import { supabase } from '@/lib/supabase';
import { sendPushNotification } from '@/services/notifications/push';

interface ExpirationConfig {
  expirationDays: number;
  gracePeriodDays: number;
  triggerType: 'from_earn_date' | 'from_last_activity' | 'from_subscription_lapse' | 'never';
  warningDays: number[];
  warningsEnabled: boolean;
  expirationEnabled: boolean;
}

/**
 * Get current expiration configuration
 */
export async function getExpirationConfig(): Promise<ExpirationConfig> {
  const { data } = await supabase
    .from('sp_config')
    .select('key, value')
    .eq('category', 'expiration');
  
  const config: Record<string, string> = {};
  data?.forEach(row => { config[row.key] = row.value; });
  
  return {
    expirationDays: parseInt(config.sp_expiration_days || '365'),
    gracePeriodDays: parseInt(config.sp_grace_period_days || '90'),
    triggerType: (config.sp_expiration_trigger || 'from_earn_date') as ExpirationConfig['triggerType'],
    warningDays: (config.sp_warning_days || '30,14,7').split(',').map(Number),
    warningsEnabled: config.sp_expiration_warnings_enabled === 'true',
    expirationEnabled: config.sp_expiration_enabled === 'true'
  };
}

/**
 * Calculate expiration date for a new SP batch
 */
export async function calculateExpirationDate(
  userId: string,
  earnedAt: Date = new Date()
): Promise<Date | null> {
  const config = await getExpirationConfig();
  
  if (!config.expirationEnabled || config.triggerType === 'never') {
    return null; // No expiration
  }
  
  let baseDate: Date;
  
  switch (config.triggerType) {
    case 'from_earn_date':
      baseDate = earnedAt;
      break;
    
    case 'from_last_activity':
      const lastActivity = await getLastActivityDate(userId);
      baseDate = lastActivity || earnedAt;
      break;
    
    case 'from_subscription_lapse':
      // Expiration is recalculated on subscription status change
      // For new SP, use earn date as base
      baseDate = earnedAt;
      break;
    
    default:
      baseDate = earnedAt;
  }
  
  const expirationDate = new Date(baseDate);
  expirationDate.setDate(expirationDate.getDate() + config.expirationDays);
  
  return expirationDate;
}

/**
 * Get user's last activity date (last transaction)
 */
async function getLastActivityDate(userId: string): Promise<Date | null> {
  const { data } = await supabase
    .from('transactions')
    .select('created_at')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  return data?.created_at ? new Date(data.created_at) : null;
}

/**
 * Extend expiration for all user batches based on activity
 * Called when trigger_type is 'from_last_activity'
 */
export async function extendExpirationOnActivity(userId: string): Promise<void> {
  const config = await getExpirationConfig();
  
  if (config.triggerType !== 'from_last_activity') {
    return; // Only applies to activity-based expiration
  }
  
  const newExpiration = new Date();
  newExpiration.setDate(newExpiration.getDate() + config.expirationDays);
  
  await supabase
    .from('sp_batches')
    .update({ 
      expires_at: newExpiration.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .gt('remaining_sp', 0)
    .is('expired_at', null); // Only non-expired batches
}

/**
 * Handle subscription lapse - set expiration for all SP
 */
export async function handleSubscriptionLapse(userId: string): Promise<void> {
  const config = await getExpirationConfig();
  
  if (config.triggerType !== 'from_subscription_lapse') {
    return;
  }
  
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + config.expirationDays);
  
  await supabase
    .from('sp_batches')
    .update({ 
      expires_at: expirationDate.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .gt('remaining_sp', 0);
  
  // Send notification
  await sendPushNotification(userId, {
    title: 'Swap Points Expiring',
    body: `Your subscription has ended. Your Swap Points will expire in ${config.expirationDays} days.`,
    data: { type: 'sp_subscription_lapse', expiresAt: expirationDate.toISOString() }
  });
}
```

---

### Expiration Processing Cron Job

**File: `supabase/functions/sp-expiration-cron/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  // Verify cron secret
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const now = new Date();
  const results = {
    expiredBatches: 0,
    deletedBatches: 0,
    warningsSent: 0
  };
  
  // 1. Mark expired batches (past expires_at, not yet marked)
  const { data: newlyExpired } = await supabase
    .from('sp_batches')
    .update({ 
      expired_at: now.toISOString(),
      updated_at: now.toISOString()
    })
    .lt('expires_at', now.toISOString())
    .is('expired_at', null)
    .gt('remaining_sp', 0)
    .select('id, user_id, remaining_sp');
  
  if (newlyExpired) {
    results.expiredBatches = newlyExpired.length;
    
    // Update wallet balances and create ledger entries
    for (const batch of newlyExpired) {
      await processExpiredBatch(batch);
    }
  }
  
  // 2. Get grace period config
  const { data: graceConfig } = await supabase
    .from('sp_config')
    .select('value')
    .eq('key', 'sp_grace_period_days')
    .single();
  
  const graceDays = parseInt(graceConfig?.value || '90');
  const graceThreshold = new Date(now);
  graceThreshold.setDate(graceThreshold.getDate() - graceDays);
  
  // 3. Delete batches past grace period
  const { data: toDelete } = await supabase
    .from('sp_batches')
    .delete()
    .lt('expired_at', graceThreshold.toISOString())
    .select('id');
  
  results.deletedBatches = toDelete?.length || 0;
  
  // 4. Send expiration warnings
  results.warningsSent = await sendExpirationWarnings(now);
  
  return new Response(JSON.stringify({
    success: true,
    timestamp: now.toISOString(),
    results
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

async function processExpiredBatch(batch: { id: string; user_id: string; remaining_sp: number }) {
  // Deduct from wallet
  await supabase
    .from('sp_wallets')
    .update({ 
      sp_balance: supabase.rpc('decrement', { x: batch.remaining_sp }),
      lifetime_expired: supabase.rpc('increment', { x: batch.remaining_sp }),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', batch.user_id);
  
  // Get wallet ID
  const { data: wallet } = await supabase
    .from('sp_wallets')
    .select('id')
    .eq('user_id', batch.user_id)
    .single();
  
  // Create ledger entry
  await supabase
    .from('sp_ledger')
    .insert({
      wallet_id: wallet?.id,
      user_id: batch.user_id,
      transaction_type: 'expire',
      sp_amount: -batch.remaining_sp,
      batch_id: batch.id,
      description: `SP batch expired (${batch.remaining_sp} SP)`
    });
  
  // Send notification
  await supabase.functions.invoke('send-push', {
    body: {
      userId: batch.user_id,
      title: 'Swap Points Expired',
      body: `${batch.remaining_sp} Swap Points have expired. Earn more by completing challenges!`,
      data: { type: 'sp_expired', amount: batch.remaining_sp }
    }
  });
}

async function sendExpirationWarnings(now: Date): Promise<number> {
  // Get warning config
  const { data: warningConfig } = await supabase
    .from('sp_config')
    .select('value')
    .eq('key', 'sp_warning_days')
    .single();
  
  const { data: warningsEnabled } = await supabase
    .from('sp_config')
    .select('value')
    .eq('key', 'sp_expiration_warnings_enabled')
    .single();
  
  if (warningsEnabled?.value !== 'true') {
    return 0;
  }
  
  const warningDays = (warningConfig?.value || '30,14,7').split(',').map(Number);
  let totalSent = 0;
  
  for (const days of warningDays) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);
    
    // Find batches expiring on target date (within 24 hours)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { data: expiringBatches } = await supabase
      .from('sp_batches')
      .select('user_id, remaining_sp')
      .gte('expires_at', startOfDay.toISOString())
      .lte('expires_at', endOfDay.toISOString())
      .gt('remaining_sp', 0)
      .is('expired_at', null);
    
    if (!expiringBatches) continue;
    
    // Group by user
    const userTotals: Record<string, number> = {};
    for (const batch of expiringBatches) {
      userTotals[batch.user_id] = (userTotals[batch.user_id] || 0) + batch.remaining_sp;
    }
    
    // Send warnings
    for (const [userId, spAmount] of Object.entries(userTotals)) {
      // Check if warning already sent today for this day threshold
      const { data: existingWarning } = await supabase
        .from('sp_warning_log')
        .select('id')
        .eq('user_id', userId)
        .eq('warning_type', `${days}_day`)
        .gte('sent_at', new Date(now.setHours(0, 0, 0, 0)).toISOString())
        .single();
      
      if (existingWarning) continue; // Already warned today
      
      await supabase.functions.invoke('send-push', {
        body: {
          userId,
          title: 'Swap Points Expiring Soon',
          body: `${spAmount} Swap Points will expire in ${days} days. Use them before they're gone!`,
          data: { type: 'sp_expiring_warning', days, amount: spAmount }
        }
      });
      
      // Log the warning
      await supabase
        .from('sp_warning_log')
        .insert({ user_id: userId, warning_type: `${days}_day`, sp_amount: spAmount });
      
      totalSent++;
    }
  }
  
  return totalSent;
}
```

---

### Database: Warning Log Table

```sql
-- Table to track expiration warnings sent
CREATE TABLE sp_warning_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL, -- '30_day', '14_day', '7_day'
  sp_amount INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for checking if warning already sent
CREATE INDEX idx_sp_warning_log_user_type_date 
ON sp_warning_log(user_id, warning_type, sent_at);

-- RLS
ALTER TABLE sp_warning_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own warnings"
ON sp_warning_log FOR SELECT
USING (auth.uid() = user_id);
```

---

### Database: Add Expiration Tracking to Wallet

```sql
-- Add lifetime_expired to wallet
ALTER TABLE sp_wallets
ADD COLUMN IF NOT EXISTS lifetime_expired INTEGER NOT NULL DEFAULT 0;

-- Helper functions for atomic increment/decrement
CREATE OR REPLACE FUNCTION increment(x INTEGER)
RETURNS INTEGER AS $$
  SELECT x + $1
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION decrement(x INTEGER)
RETURNS INTEGER AS $$
  SELECT x - $1
$$ LANGUAGE SQL;
```

---

### Cron Schedule Setup

**File: `supabase/migrations/YYYYMMDD_sp_expiration_cron.sql`**

```sql
-- Schedule daily expiration job at 2 AM UTC
SELECT cron.schedule(
  'sp-expiration-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/sp-expiration-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

### Admin UI for Expiration Settings

**File: `src/components/admin/SpExpirationSettings.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Switch, Picker, StyleSheet } from 'react-native';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

const TRIGGER_OPTIONS = [
  { value: 'from_earn_date', label: 'From Earn Date' },
  { value: 'from_last_activity', label: 'From Last Activity' },
  { value: 'from_subscription_lapse', label: 'From Subscription Lapse' },
  { value: 'never', label: 'Never Expires' }
];

export function SpExpirationSettings() {
  const [config, setConfig] = useState({
    expirationDays: '365',
    gracePeriodDays: '90',
    triggerType: 'from_earn_date',
    warningDays: '30,14,7',
    warningsEnabled: true,
    expirationEnabled: true
  });
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    loadConfig();
  }, []);
  
  async function loadConfig() {
    const { data } = await supabase
      .from('sp_config')
      .select('key, value')
      .eq('category', 'expiration');
    
    if (data) {
      const newConfig = { ...config };
      data.forEach(row => {
        switch (row.key) {
          case 'sp_expiration_days': newConfig.expirationDays = row.value; break;
          case 'sp_grace_period_days': newConfig.gracePeriodDays = row.value; break;
          case 'sp_expiration_trigger': newConfig.triggerType = row.value; break;
          case 'sp_warning_days': newConfig.warningDays = row.value; break;
          case 'sp_expiration_warnings_enabled': newConfig.warningsEnabled = row.value === 'true'; break;
          case 'sp_expiration_enabled': newConfig.expirationEnabled = row.value === 'true'; break;
        }
      });
      setConfig(newConfig);
    }
  }
  
  async function saveConfig() {
    setSaving(true);
    
    const updates = [
      { key: 'sp_expiration_days', value: config.expirationDays },
      { key: 'sp_grace_period_days', value: config.gracePeriodDays },
      { key: 'sp_expiration_trigger', value: config.triggerType },
      { key: 'sp_warning_days', value: config.warningDays },
      { key: 'sp_expiration_warnings_enabled', value: config.warningsEnabled.toString() },
      { key: 'sp_expiration_enabled', value: config.expirationEnabled.toString() }
    ];
    
    for (const update of updates) {
      await supabase
        .from('sp_config')
        .upsert({ 
          key: update.key, 
          value: update.value, 
          category: 'expiration',
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
    }
    
    setSaving(false);
    alert('Settings saved successfully');
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.header}>SP Expiration Settings</Text>
      
      <View style={styles.row}>
        <Text>Enable Expiration:</Text>
        <Switch
          value={config.expirationEnabled}
          onValueChange={(v) => setConfig({ ...config, expirationEnabled: v })}
        />
      </View>
      
      <View style={styles.field}>
        <Text style={styles.label}>Expiration Trigger:</Text>
        <Picker
          selectedValue={config.triggerType}
          onValueChange={(v) => setConfig({ ...config, triggerType: v })}
        >
          {TRIGGER_OPTIONS.map(opt => (
            <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
          ))}
        </Picker>
        <Text style={styles.help}>When does the expiration countdown begin?</Text>
      </View>
      
      <View style={styles.field}>
        <Text style={styles.label}>Expiration Period (days):</Text>
        <TextInput
          style={styles.input}
          value={config.expirationDays}
          onChangeText={(v) => setConfig({ ...config, expirationDays: v })}
          keyboardType="numeric"
        />
        <Text style={styles.help}>Days until SP expire after trigger (0 = never)</Text>
      </View>
      
      <View style={styles.field}>
        <Text style={styles.label}>Grace Period (days):</Text>
        <TextInput
          style={styles.input}
          value={config.gracePeriodDays}
          onChangeText={(v) => setConfig({ ...config, gracePeriodDays: v })}
          keyboardType="numeric"
        />
        <Text style={styles.help}>Days after expiration before SP are permanently deleted</Text>
      </View>
      
      <View style={styles.row}>
        <Text>Enable Expiration Warnings:</Text>
        <Switch
          value={config.warningsEnabled}
          onValueChange={(v) => setConfig({ ...config, warningsEnabled: v })}
        />
      </View>
      
      <View style={styles.field}>
        <Text style={styles.label}>Warning Days:</Text>
        <TextInput
          style={styles.input}
          value={config.warningDays}
          onChangeText={(v) => setConfig({ ...config, warningDays: v })}
          placeholder="30,14,7"
        />
        <Text style={styles.help}>Comma-separated days before expiration to send warnings</Text>
      </View>
      
      <Button 
        title={saving ? 'Saving...' : 'Save Settings'} 
        onPress={saveConfig}
        disabled={saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { fontSize: 20, fontWeight: '600', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  help: { fontSize: 12, color: '#666', marginTop: 4 }
});
```

---

### Testing Checklist

- [ ] Expiration config loads correctly
- [ ] Expiration date calculated per trigger type
- [ ] `from_earn_date` sets expiration at earn time
- [ ] `from_last_activity` extends on each transaction
- [ ] `from_subscription_lapse` triggers on subscription end
- [ ] `never` results in null expiration
- [ ] Cron job marks batches as expired
- [ ] Wallet balance decremented on expiration
- [ ] Ledger entries created for expirations
- [ ] Expired batches deleted after grace period
- [ ] 30/14/7 day warnings sent correctly
- [ ] Duplicate warnings prevented
- [ ] Admin UI loads and saves settings
- [ ] Expiration disabled toggle works

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Expiration service | 45 min |
| Cron job implementation | 60 min |
| Warning notification logic | 30 min |
| Database tables/migrations | 20 min |
| Admin UI | 30 min |
| Testing | 15 min |
| **Total** | **~3 hours** |

---

<!-- 
MICRO-TASK 09-E COMPLETE
Next: 09-F (Task SP-005: Challenges System)
-->

---

## Task SP-005: User Challenges System

**Estimated Time:** 3.5 hours  
**Priority:** P1 - MVP Feature  
**Dependencies:** SP-001 (Wallet), SP-002 (Earning), MODULE-02 (Auth)

---

### Context

User Challenges are admin-defined engagement activities that reward users with Swap Points upon completion. They drive:
- **Platform engagement** - Complete transactions, list items, etc.
- **User retention** - Keep users active on the platform
- **Behavior shaping** - Encourage desired actions (donations, quality listings)

All challenge definitions, criteria, and rewards are **admin-configurable**.

---

### Database Schema

**File: `supabase/migrations/YYYYMMDD_challenges_tables.sql`**

```sql
-- Challenge definitions (admin-created)
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_url TEXT,
  
  -- Challenge type and criteria
  challenge_type TEXT NOT NULL, -- 'transaction_count', 'listing_count', 'donation_count', 'category_purchase', 'streak', 'first_action', 'referral'
  criteria JSONB NOT NULL, -- Type-specific criteria
  
  -- Rewards
  sp_reward INTEGER NOT NULL DEFAULT 0,
  cash_reward DECIMAL(10,2) DEFAULT 0,
  badge_reward_id UUID REFERENCES badges(id),
  
  -- Availability
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_repeatable BOOLEAN NOT NULL DEFAULT false, -- Can be completed multiple times
  repeat_cooldown_days INTEGER DEFAULT 0, -- Days before can repeat
  
  -- Timing
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  
  -- Display
  display_order INTEGER DEFAULT 0,
  category TEXT, -- 'beginner', 'weekly', 'seasonal', 'milestone'
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- User challenge progress
CREATE TABLE user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  
  -- Progress
  current_progress INTEGER NOT NULL DEFAULT 0,
  target_progress INTEGER NOT NULL, -- Copied from challenge criteria at assignment
  progress_data JSONB DEFAULT '{}', -- Detailed tracking (e.g., transaction IDs)
  
  -- Status
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'expired', 'claimed'
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Rewards
  sp_rewarded INTEGER DEFAULT 0,
  cash_rewarded DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate active challenges
  UNIQUE(user_id, challenge_id) WHERE status = 'in_progress'
);

-- Indexes
CREATE INDEX idx_challenges_active ON challenges(is_active, start_date, end_date);
CREATE INDEX idx_user_challenges_user ON user_challenges(user_id, status);
CREATE INDEX idx_user_challenges_challenge ON user_challenges(challenge_id, status);

-- RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;

-- Everyone can read active challenges
CREATE POLICY "Anyone can read active challenges"
ON challenges FOR SELECT
USING (is_active = true AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW()));

-- Admins can manage challenges
CREATE POLICY "Admins can manage challenges"
ON challenges FOR ALL
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Users can read own challenge progress
CREATE POLICY "Users can read own challenge progress"
ON user_challenges FOR SELECT
USING (auth.uid() = user_id);

-- System inserts/updates via service role
```

---

### Challenge Types

| Type | Criteria Example | Description |
|------|------------------|-------------|
| `transaction_count` | `{ "count": 5, "role": "buyer" }` | Complete X transactions as buyer/seller/both |
| `listing_count` | `{ "count": 3, "category_id": null }` | List X items (optionally in category) |
| `donation_count` | `{ "count": 2 }` | Donate X items |
| `category_purchase` | `{ "category_id": "toys", "count": 1 }` | Purchase from specific category |
| `streak` | `{ "days": 7, "action": "login" }` | X consecutive days of action |
| `first_action` | `{ "action": "first_listing" }` | One-time first actions |
| `referral` | `{ "count": 3 }` | Refer X users who complete transaction |
| `total_spend` | `{ "amount": 100 }` | Spend $X total on platform |
| `five_star_reviews` | `{ "count": 5 }` | Receive X 5-star reviews |

---

### Challenge Service

**File: `src/services/challenges/index.ts`**

```typescript
import { supabase } from '@/lib/supabase';
import { grantChallengeReward } from '@/services/sp/earning';

interface Challenge {
  id: string;
  title: string;
  description: string;
  icon_url: string | null;
  challenge_type: string;
  criteria: Record<string, any>;
  sp_reward: number;
  cash_reward: number;
  badge_reward_id: string | null;
  is_repeatable: boolean;
  category: string;
}

interface UserChallenge {
  id: string;
  challenge_id: string;
  current_progress: number;
  target_progress: number;
  status: 'in_progress' | 'completed' | 'expired' | 'claimed';
  challenge: Challenge;
}

/**
 * Get available challenges for a user
 */
export async function getAvailableChallenges(userId: string): Promise<Challenge[]> {
  // Get active challenges
  const { data: challenges } = await supabase
    .from('challenges')
    .select('*')
    .eq('is_active', true)
    .or(`start_date.is.null,start_date.lte.${new Date().toISOString()}`)
    .or(`end_date.is.null,end_date.gte.${new Date().toISOString()}`)
    .order('display_order');
  
  if (!challenges) return [];
  
  // Get user's current/completed challenges
  const { data: userChallenges } = await supabase
    .from('user_challenges')
    .select('challenge_id, status')
    .eq('user_id', userId);
  
  const userChallengeMap = new Map(
    userChallenges?.map(uc => [uc.challenge_id, uc.status]) || []
  );
  
  // Filter out non-repeatable completed challenges
  return challenges.filter(c => {
    const status = userChallengeMap.get(c.id);
    if (!status) return true; // Not started
    if (c.is_repeatable && status === 'claimed') return true; // Repeatable and claimed
    if (status === 'in_progress') return true; // Currently active
    return false;
  });
}

/**
 * Get user's active challenges with progress
 */
export async function getUserChallenges(userId: string): Promise<UserChallenge[]> {
  const { data } = await supabase
    .from('user_challenges')
    .select(`
      *,
      challenge:challenges(*)
    `)
    .eq('user_id', userId)
    .in('status', ['in_progress', 'completed'])
    .order('created_at', { ascending: false });
  
  return data || [];
}

/**
 * Start a challenge for a user
 */
export async function startChallenge(userId: string, challengeId: string): Promise<boolean> {
  const { data: challenge } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .single();
  
  if (!challenge) return false;
  
  // Get target from criteria
  const target = getTargetFromCriteria(challenge.challenge_type, challenge.criteria);
  
  // Calculate expiration (if challenge has end_date or criteria specifies duration)
  const expiresAt = challenge.end_date || calculateExpiration(challenge.criteria);
  
  const { error } = await supabase
    .from('user_challenges')
    .insert({
      user_id: userId,
      challenge_id: challengeId,
      target_progress: target,
      expires_at: expiresAt
    });
  
  return !error;
}

/**
 * Update challenge progress based on action
 */
export async function updateChallengeProgress(
  userId: string,
  actionType: string,
  actionData: Record<string, any>
): Promise<void> {
  // Get user's active challenges
  const { data: userChallenges } = await supabase
    .from('user_challenges')
    .select(`
      *,
      challenge:challenges(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'in_progress');
  
  if (!userChallenges) return;
  
  for (const uc of userChallenges) {
    const challenge = uc.challenge;
    
    // Check if this action applies to this challenge
    if (!doesActionApply(challenge.challenge_type, challenge.criteria, actionType, actionData)) {
      continue;
    }
    
    // Calculate progress increment
    const increment = calculateIncrement(challenge.challenge_type, challenge.criteria, actionData);
    const newProgress = uc.current_progress + increment;
    
    // Update progress
    const updates: Record<string, any> = {
      current_progress: newProgress,
      updated_at: new Date().toISOString()
    };
    
    // Check if completed
    if (newProgress >= uc.target_progress) {
      updates.status = 'completed';
      updates.completed_at = new Date().toISOString();
    }
    
    await supabase
      .from('user_challenges')
      .update(updates)
      .eq('id', uc.id);
    
    // If just completed, optionally auto-claim
    if (updates.status === 'completed') {
      // Send notification
      await supabase.functions.invoke('send-push', {
        body: {
          userId,
          title: 'Challenge Completed! 🎉',
          body: `You completed "${challenge.title}". Claim your ${challenge.sp_reward} SP reward!`,
          data: { type: 'challenge_completed', challengeId: challenge.id }
        }
      });
    }
  }
}

/**
 * Claim reward for completed challenge
 */
export async function claimChallengeReward(userId: string, userChallengeId: string): Promise<{
  success: boolean;
  spRewarded?: number;
  cashRewarded?: number;
  error?: string;
}> {
  // Get the user challenge
  const { data: uc } = await supabase
    .from('user_challenges')
    .select(`
      *,
      challenge:challenges(*)
    `)
    .eq('id', userChallengeId)
    .eq('user_id', userId)
    .single();
  
  if (!uc) {
    return { success: false, error: 'Challenge not found' };
  }
  
  if (uc.status !== 'completed') {
    return { success: false, error: 'Challenge not completed' };
  }
  
  const challenge = uc.challenge;
  
  // Grant SP reward
  if (challenge.sp_reward > 0) {
    await grantChallengeReward(userId, challenge.id, challenge.sp_reward);
  }
  
  // Grant cash reward (credit to wallet)
  if (challenge.cash_reward > 0) {
    await supabase.rpc('credit_user_balance', {
      p_user_id: userId,
      p_amount: challenge.cash_reward,
      p_reason: `Challenge reward: ${challenge.title}`
    });
  }
  
  // Grant badge if applicable
  if (challenge.badge_reward_id) {
    await supabase
      .from('user_badges')
      .insert({
        user_id: userId,
        badge_id: challenge.badge_reward_id,
        earned_via: 'challenge',
        reference_id: challenge.id
      });
  }
  
  // Mark as claimed
  await supabase
    .from('user_challenges')
    .update({
      status: 'claimed',
      claimed_at: new Date().toISOString(),
      sp_rewarded: challenge.sp_reward,
      cash_rewarded: challenge.cash_reward
    })
    .eq('id', userChallengeId);
  
  return {
    success: true,
    spRewarded: challenge.sp_reward,
    cashRewarded: challenge.cash_reward
  };
}

// Helper functions
function getTargetFromCriteria(type: string, criteria: Record<string, any>): number {
  switch (type) {
    case 'transaction_count':
    case 'listing_count':
    case 'donation_count':
    case 'category_purchase':
    case 'referral':
    case 'five_star_reviews':
      return criteria.count || 1;
    case 'streak':
      return criteria.days || 7;
    case 'total_spend':
      return criteria.amount || 100;
    case 'first_action':
      return 1;
    default:
      return 1;
  }
}

function doesActionApply(
  challengeType: string,
  criteria: Record<string, any>,
  actionType: string,
  actionData: Record<string, any>
): boolean {
  switch (challengeType) {
    case 'transaction_count':
      if (actionType !== 'transaction_completed') return false;
      if (criteria.role && criteria.role !== actionData.role) return false;
      return true;
    
    case 'listing_count':
      if (actionType !== 'listing_approved') return false;
      if (criteria.category_id && criteria.category_id !== actionData.category_id) return false;
      return true;
    
    case 'donation_count':
      return actionType === 'donation_completed';
    
    case 'category_purchase':
      if (actionType !== 'transaction_completed') return false;
      return criteria.category_id === actionData.category_id;
    
    case 'streak':
      return actionType === criteria.action; // e.g., 'login', 'listing_view'
    
    case 'first_action':
      return actionType === criteria.action;
    
    case 'referral':
      return actionType === 'referral_completed';
    
    case 'total_spend':
      return actionType === 'transaction_completed' && actionData.role === 'buyer';
    
    case 'five_star_reviews':
      return actionType === 'review_received' && actionData.rating === 5;
    
    default:
      return false;
  }
}

function calculateIncrement(
  challengeType: string,
  criteria: Record<string, any>,
  actionData: Record<string, any>
): number {
  switch (challengeType) {
    case 'total_spend':
      return actionData.amount || 0;
    default:
      return 1;
  }
}

function calculateExpiration(criteria: Record<string, any>): string | null {
  if (criteria.duration_days) {
    const exp = new Date();
    exp.setDate(exp.getDate() + criteria.duration_days);
    return exp.toISOString();
  }
  return null;
}
```

---

### Challenge Progress Trigger

**File: `src/hooks/useChallengeProgress.ts`**

```typescript
import { updateChallengeProgress } from '@/services/challenges';

/**
 * Hook to track challenge-relevant actions
 * Call after any action that might affect challenge progress
 */
export async function trackAction(
  userId: string,
  actionType: string,
  actionData: Record<string, any> = {}
) {
  try {
    await updateChallengeProgress(userId, actionType, actionData);
  } catch (error) {
    console.error('Failed to track challenge action:', error);
  }
}

// Action types:
// - transaction_completed: { role: 'buyer'|'seller', amount, category_id }
// - listing_approved: { category_id }
// - donation_completed: {}
// - login: {}
// - referral_completed: {}
// - review_received: { rating }
```

---

### Challenge UI Components

**File: `src/components/challenges/ChallengeCard.tsx`**

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface Props {
  challenge: {
    id: string;
    title: string;
    description: string;
    icon_url: string | null;
    sp_reward: number;
    cash_reward: number;
  };
  progress?: {
    current: number;
    target: number;
    status: string;
  };
  onPress: () => void;
  onClaim?: () => void;
}

export function ChallengeCard({ challenge, progress, onPress, onClaim }: Props) {
  const isCompleted = progress?.status === 'completed';
  const isClaimed = progress?.status === 'claimed';
  const progressPercent = progress ? (progress.current / progress.target) * 100 : 0;
  
  return (
    <TouchableOpacity 
      style={[styles.card, isCompleted && styles.completedCard]}
      onPress={onPress}
      disabled={isClaimed}
    >
      <View style={styles.header}>
        {challenge.icon_url && (
          <Image source={{ uri: challenge.icon_url }} style={styles.icon} />
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{challenge.title}</Text>
          <Text style={styles.description} numberOfLines={2}>{challenge.description}</Text>
        </View>
      </View>
      
      {progress && !isClaimed && (
        <View style={styles.progressContainer}>
          <ProgressBar progress={progressPercent} />
          <Text style={styles.progressText}>
            {progress.current} / {progress.target}
          </Text>
        </View>
      )}
      
      <View style={styles.rewardContainer}>
        {challenge.sp_reward > 0 && (
          <View style={styles.reward}>
            <Text style={styles.rewardIcon}>⭐</Text>
            <Text style={styles.rewardText}>{challenge.sp_reward} SP</Text>
          </View>
        )}
        {challenge.cash_reward > 0 && (
          <View style={styles.reward}>
            <Text style={styles.rewardIcon}>💵</Text>
            <Text style={styles.rewardText}>${challenge.cash_reward}</Text>
          </View>
        )}
      </View>
      
      {isCompleted && onClaim && (
        <TouchableOpacity style={styles.claimButton} onPress={onClaim}>
          <Text style={styles.claimButtonText}>Claim Reward</Text>
        </TouchableOpacity>
      )}
      
      {isClaimed && (
        <View style={styles.claimedBadge}>
          <Text style={styles.claimedText}>✓ Claimed</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  completedCard: { borderWidth: 2, borderColor: '#4CAF50' },
  header: { flexDirection: 'row', marginBottom: 12 },
  icon: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
  titleContainer: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  description: { fontSize: 14, color: '#666' },
  progressContainer: { marginBottom: 12 },
  progressText: { fontSize: 12, color: '#666', marginTop: 4, textAlign: 'right' },
  rewardContainer: { flexDirection: 'row', gap: 12 },
  reward: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  rewardIcon: { marginRight: 4 },
  rewardText: { fontSize: 14, fontWeight: '600' },
  claimButton: { backgroundColor: '#6200ee', paddingVertical: 12, borderRadius: 8, marginTop: 12, alignItems: 'center' },
  claimButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  claimedBadge: { backgroundColor: '#E8F5E9', paddingVertical: 8, borderRadius: 8, marginTop: 12, alignItems: 'center' },
  claimedText: { color: '#2E7D32', fontWeight: '600' }
});
```

---

### Challenge List Screen

**File: `src/screens/ChallengesScreen.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { ChallengeCard } from '@/components/challenges/ChallengeCard';
import { getAvailableChallenges, getUserChallenges, startChallenge, claimChallengeReward } from '@/services/challenges';
import { useAuth } from '@/hooks/useAuth';

export function ChallengesScreen() {
  const { user } = useAuth();
  const [availableChallenges, setAvailableChallenges] = useState([]);
  const [userChallenges, setUserChallenges] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    loadChallenges();
  }, []);
  
  async function loadChallenges() {
    const [available, userProgress] = await Promise.all([
      getAvailableChallenges(user.id),
      getUserChallenges(user.id)
    ]);
    setAvailableChallenges(available);
    setUserChallenges(userProgress);
  }
  
  async function handleRefresh() {
    setRefreshing(true);
    await loadChallenges();
    setRefreshing(false);
  }
  
  async function handleStartChallenge(challengeId: string) {
    await startChallenge(user.id, challengeId);
    await loadChallenges();
  }
  
  async function handleClaim(userChallengeId: string) {
    const result = await claimChallengeReward(user.id, userChallengeId);
    if (result.success) {
      await loadChallenges();
      // Show success toast
    }
  }
  
  // Merge available and user challenges for display
  const displayChallenges = availableChallenges.map(c => {
    const userProgress = userChallenges.find(uc => uc.challenge_id === c.id);
    return {
      ...c,
      progress: userProgress ? {
        id: userProgress.id,
        current: userProgress.current_progress,
        target: userProgress.target_progress,
        status: userProgress.status
      } : null
    };
  });
  
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Challenges</Text>
      <Text style={styles.subheader}>Complete challenges to earn Swap Points!</Text>
      
      <FlatList
        data={displayChallenges}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChallengeCard
            challenge={item}
            progress={item.progress}
            onPress={() => !item.progress && handleStartChallenge(item.id)}
            onClaim={item.progress?.status === 'completed' ? () => handleClaim(item.progress.id) : undefined}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { fontSize: 24, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16 },
  subheader: { fontSize: 14, color: '#666', paddingHorizontal: 16, marginBottom: 16 },
  list: { paddingHorizontal: 16 }
});
```

---

### Admin: Challenge Management

**File: `src/components/admin/ChallengeEditor.tsx`**

```typescript
import React, { useState } from 'react';
import { View, Text, TextInput, Switch, Picker, StyleSheet, ScrollView } from 'react-native';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

const CHALLENGE_TYPES = [
  { value: 'transaction_count', label: 'Transaction Count' },
  { value: 'listing_count', label: 'Listing Count' },
  { value: 'donation_count', label: 'Donation Count' },
  { value: 'category_purchase', label: 'Category Purchase' },
  { value: 'streak', label: 'Streak' },
  { value: 'first_action', label: 'First Action' },
  { value: 'referral', label: 'Referral' },
  { value: 'total_spend', label: 'Total Spend' },
  { value: 'five_star_reviews', label: '5-Star Reviews' }
];

interface Props {
  challenge?: any; // Existing challenge for editing
  onSave: () => void;
  onCancel: () => void;
}

export function ChallengeEditor({ challenge, onSave, onCancel }: Props) {
  const [form, setForm] = useState({
    title: challenge?.title || '',
    description: challenge?.description || '',
    challenge_type: challenge?.challenge_type || 'transaction_count',
    criteria_count: String(challenge?.criteria?.count || 1),
    criteria_role: challenge?.criteria?.role || '',
    criteria_category: challenge?.criteria?.category_id || '',
    sp_reward: String(challenge?.sp_reward || 100),
    cash_reward: String(challenge?.cash_reward || 0),
    is_active: challenge?.is_active ?? true,
    is_repeatable: challenge?.is_repeatable ?? false,
    category: challenge?.category || 'beginner'
  });
  const [saving, setSaving] = useState(false);
  
  async function handleSave() {
    setSaving(true);
    
    const criteria: Record<string, any> = {
      count: parseInt(form.criteria_count)
    };
    if (form.criteria_role) criteria.role = form.criteria_role;
    if (form.criteria_category) criteria.category_id = form.criteria_category;
    
    const data = {
      title: form.title,
      description: form.description,
      challenge_type: form.challenge_type,
      criteria,
      sp_reward: parseInt(form.sp_reward),
      cash_reward: parseFloat(form.cash_reward),
      is_active: form.is_active,
      is_repeatable: form.is_repeatable,
      category: form.category
    };
    
    if (challenge?.id) {
      await supabase.from('challenges').update(data).eq('id', challenge.id);
    } else {
      await supabase.from('challenges').insert(data);
    }
    
    setSaving(false);
    onSave();
  }
  
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>{challenge ? 'Edit' : 'Create'} Challenge</Text>
      
      <View style={styles.field}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={form.title}
          onChangeText={(v) => setForm({ ...form, title: v })}
          placeholder="Complete 5 Purchases"
        />
      </View>
      
      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.description}
          onChangeText={(v) => setForm({ ...form, description: v })}
          placeholder="Buy 5 items from any seller"
          multiline
        />
      </View>
      
      <View style={styles.field}>
        <Text style={styles.label}>Challenge Type</Text>
        <Picker
          selectedValue={form.challenge_type}
          onValueChange={(v) => setForm({ ...form, challenge_type: v })}
        >
          {CHALLENGE_TYPES.map(t => (
            <Picker.Item key={t.value} label={t.label} value={t.value} />
          ))}
        </Picker>
      </View>
      
      <View style={styles.field}>
        <Text style={styles.label}>Target Count</Text>
        <TextInput
          style={styles.input}
          value={form.criteria_count}
          onChangeText={(v) => setForm({ ...form, criteria_count: v })}
          keyboardType="numeric"
        />
      </View>
      
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>SP Reward</Text>
          <TextInput
            style={styles.input}
            value={form.sp_reward}
            onChangeText={(v) => setForm({ ...form, sp_reward: v })}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Cash Reward ($)</Text>
          <TextInput
            style={styles.input}
            value={form.cash_reward}
            onChangeText={(v) => setForm({ ...form, cash_reward: v })}
            keyboardType="numeric"
          />
        </View>
      </View>
      
      <View style={styles.switchRow}>
        <Text>Active</Text>
        <Switch
          value={form.is_active}
          onValueChange={(v) => setForm({ ...form, is_active: v })}
        />
      </View>
      
      <View style={styles.switchRow}>
        <Text>Repeatable</Text>
        <Switch
          value={form.is_repeatable}
          onValueChange={(v) => setForm({ ...form, is_repeatable: v })}
        />
      </View>
      
      <View style={styles.buttons}>
        <Button title="Cancel" onPress={onCancel} variant="secondary" />
        <Button title={saving ? 'Saving...' : 'Save'} onPress={handleSave} disabled={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { fontSize: 20, fontWeight: '600', marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1, marginBottom: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 }
});
```

---

### Testing Checklist

- [ ] Available challenges load for users
- [ ] User can start a challenge
- [ ] Progress updates on relevant actions
- [ ] Correct action types trigger correct challenges
- [ ] Challenge completes when target reached
- [ ] Completion notification sent
- [ ] Claim button appears on completion
- [ ] SP reward granted on claim
- [ ] Cash reward granted on claim
- [ ] Badge granted on claim (if applicable)
- [ ] Non-repeatable challenges hidden after claim
- [ ] Repeatable challenges can be restarted
- [ ] Admin can create challenges
- [ ] Admin can edit/deactivate challenges
- [ ] Expired challenges marked correctly

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Database schema | 30 min |
| Challenge service | 60 min |
| Progress tracking | 30 min |
| UI components | 45 min |
| Admin editor | 30 min |
| Testing | 15 min |
| **Total** | **~3.5 hours** |

---

<!-- 
MICRO-TASK 09-F COMPLETE
Next: 09-G (Task SP-006: Badges System)
-->

---

## Task SP-006: Badges System

**Estimated Time:** 2.5 hours  
**Priority:** P1 - MVP Feature  
**Dependencies:** SP-001 (Wallet), MODULE-02 (Auth)

---

### Context

The Badges System provides visual recognition of user achievements and trust signals. Two badge categories:

1. **Trust Badges** - Signal reliability based on transaction history and account verification
2. **Donation Badges** - Recognize charitable contributions to the platform

All badge thresholds and criteria are **admin-configurable** per V2 requirements.

---

### Badge Hierarchy

#### Trust Badges (Progressive)
| Level | Badge | Default Threshold | Icon |
|-------|-------|-------------------|------|
| 0 | None | New account | - |
| 1 | Bronze | 3 completed transactions | 🥉 |
| 2 | Silver | 10 completed transactions + 4.5+ rating | 🥈 |
| 3 | Gold | 25 completed transactions + 4.7+ rating | 🥇 |
| 4 | Verified | Gold + ID verification completed | ✓ |

#### Donation Badges (Progressive)
| Level | Badge | Default Threshold | Icon |
|-------|-------|-------------------|------|
| 1 | Helper | 1 donation | 🤝 |
| 2 | Generous | 5 donations | 💝 |
| 3 | Champion | 15 donations | 🏆 |
| 4 | Super Parent | 30 donations | 🦸 |

---

### Database Schema

**File: `supabase/migrations/YYYYMMDD_badges_tables.sql`**

```sql
-- Badge definitions (admin-managed)
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_url TEXT,
  icon_emoji TEXT, -- Fallback emoji icon
  
  -- Badge type and level
  badge_type TEXT NOT NULL, -- 'trust', 'donation', 'achievement', 'special'
  level INTEGER NOT NULL DEFAULT 1, -- For progressive badges
  
  -- Criteria (admin-configurable)
  criteria JSONB NOT NULL DEFAULT '{}',
  -- Examples:
  -- Trust: { "min_transactions": 10, "min_rating": 4.5, "requires_verification": false }
  -- Donation: { "min_donations": 5 }
  
  -- Display
  color TEXT DEFAULT '#6200ee',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User earned badges
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  
  -- How earned
  earned_via TEXT NOT NULL DEFAULT 'auto', -- 'auto', 'challenge', 'admin_grant'
  reference_id UUID, -- Challenge ID or other reference
  
  -- Timing
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate badges
  UNIQUE(user_id, badge_id)
);

-- Indexes
CREATE INDEX idx_badges_type_level ON badges(badge_type, level);
CREATE INDEX idx_user_badges_user ON user_badges(user_id);

-- RLS
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active badges"
ON badges FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage badges"
ON badges FOR ALL
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can read own badges"
ON user_badges FOR SELECT
USING (auth.uid() = user_id);

-- Anyone can read any user's badges (for profile display)
CREATE POLICY "Anyone can read user badges"
ON user_badges FOR SELECT
USING (true);
```

---

### Default Badge Data

```sql
-- Insert default trust badges
INSERT INTO badges (name, description, badge_type, level, icon_emoji, color, criteria) VALUES
  ('Bronze Trader', 'Completed 3+ transactions', 'trust', 1, '🥉', '#CD7F32', 
   '{"min_transactions": 3}'),
  ('Silver Trader', 'Completed 10+ transactions with 4.5+ rating', 'trust', 2, '🥈', '#C0C0C0',
   '{"min_transactions": 10, "min_rating": 4.5}'),
  ('Gold Trader', 'Completed 25+ transactions with 4.7+ rating', 'trust', 3, '🥇', '#FFD700',
   '{"min_transactions": 25, "min_rating": 4.7}'),
  ('Verified', 'Gold Trader with ID verification', 'trust', 4, '✓', '#4CAF50',
   '{"min_transactions": 25, "min_rating": 4.7, "requires_verification": true}');

-- Insert default donation badges
INSERT INTO badges (name, description, badge_type, level, icon_emoji, color, criteria) VALUES
  ('Helper', 'Donated 1+ item', 'donation', 1, '🤝', '#81C784',
   '{"min_donations": 1}'),
  ('Generous', 'Donated 5+ items', 'donation', 2, '💝', '#E91E63',
   '{"min_donations": 5}'),
  ('Champion', 'Donated 15+ items', 'donation', 3, '🏆', '#FF9800',
   '{"min_donations": 15}'),
  ('Super Parent', 'Donated 30+ items', 'donation', 4, '🦸', '#9C27B0',
   '{"min_donations": 30}');
```

---

### Badge Service

**File: `src/services/badges/index.ts`**

```typescript
import { supabase } from '@/lib/supabase';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon_url: string | null;
  icon_emoji: string;
  badge_type: 'trust' | 'donation' | 'achievement' | 'special';
  level: number;
  color: string;
  criteria: Record<string, any>;
}

interface UserBadge extends Badge {
  earned_at: string;
}

/**
 * Get all badges a user has earned
 */
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const { data } = await supabase
    .from('user_badges')
    .select(`
      earned_at,
      badge:badges(*)
    `)
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });
  
  return data?.map(ub => ({
    ...ub.badge,
    earned_at: ub.earned_at
  })) || [];
}

/**
 * Get user's highest badge of each type
 */
export async function getUserHighestBadges(userId: string): Promise<Record<string, UserBadge | null>> {
  const badges = await getUserBadges(userId);
  
  const highest: Record<string, UserBadge | null> = {
    trust: null,
    donation: null
  };
  
  for (const badge of badges) {
    const current = highest[badge.badge_type];
    if (!current || badge.level > current.level) {
      highest[badge.badge_type] = badge;
    }
  }
  
  return highest;
}

/**
 * Check and award badges based on user stats
 * Called after relevant actions (transaction complete, donation, verification)
 */
export async function evaluateAndAwardBadges(userId: string): Promise<Badge[]> {
  const awardedBadges: Badge[] = [];
  
  // Get user's current stats
  const stats = await getUserStats(userId);
  
  // Get all active badges
  const { data: allBadges } = await supabase
    .from('badges')
    .select('*')
    .eq('is_active', true)
    .order('level', { ascending: true });
  
  if (!allBadges) return [];
  
  // Get user's existing badges
  const { data: existingBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId);
  
  const existingBadgeIds = new Set(existingBadges?.map(ub => ub.badge_id) || []);
  
  // Evaluate each badge
  for (const badge of allBadges) {
    // Skip if already earned
    if (existingBadgeIds.has(badge.id)) continue;
    
    // Check criteria
    if (meetsCriteria(badge, stats)) {
      // Award badge
      const { error } = await supabase
        .from('user_badges')
        .insert({
          user_id: userId,
          badge_id: badge.id,
          earned_via: 'auto'
        });
      
      if (!error) {
        awardedBadges.push(badge);
        
        // Send notification
        await supabase.functions.invoke('send-push', {
          body: {
            userId,
            title: 'New Badge Earned! 🎖️',
            body: `You earned the "${badge.name}" badge!`,
            data: { type: 'badge_earned', badgeId: badge.id }
          }
        });
      }
    }
  }
  
  return awardedBadges;
}

/**
 * Get user stats for badge evaluation
 */
async function getUserStats(userId: string): Promise<{
  completedTransactions: number;
  averageRating: number;
  donationCount: number;
  isVerified: boolean;
}> {
  // Get transaction count
  const { count: transactionCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .eq('status', 'completed');
  
  // Get average rating
  const { data: ratingData } = await supabase
    .from('reviews')
    .select('rating')
    .eq('reviewee_id', userId);
  
  const ratings = ratingData?.map(r => r.rating) || [];
  const avgRating = ratings.length > 0 
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
    : 0;
  
  // Get donation count
  const { count: donationCount } = await supabase
    .from('donations')
    .select('*', { count: 'exact', head: true })
    .eq('donor_id', userId)
    .eq('status', 'completed');
  
  // Get verification status
  const { data: profile } = await supabase
    .from('profiles')
    .select('id_verified')
    .eq('id', userId)
    .single();
  
  return {
    completedTransactions: transactionCount || 0,
    averageRating: avgRating,
    donationCount: donationCount || 0,
    isVerified: profile?.id_verified || false
  };
}

/**
 * Check if user meets badge criteria
 */
function meetsCriteria(
  badge: Badge,
  stats: {
    completedTransactions: number;
    averageRating: number;
    donationCount: number;
    isVerified: boolean;
  }
): boolean {
  const c = badge.criteria;
  
  switch (badge.badge_type) {
    case 'trust':
      if (c.min_transactions && stats.completedTransactions < c.min_transactions) return false;
      if (c.min_rating && stats.averageRating < c.min_rating) return false;
      if (c.requires_verification && !stats.isVerified) return false;
      return true;
    
    case 'donation':
      if (c.min_donations && stats.donationCount < c.min_donations) return false;
      return true;
    
    default:
      return false;
  }
}

/**
 * Manually grant a badge (admin use)
 */
export async function grantBadge(
  userId: string,
  badgeId: string,
  grantedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_badges')
    .insert({
      user_id: userId,
      badge_id: badgeId,
      earned_via: 'admin_grant',
      reference_id: grantedBy
    });
  
  return !error;
}

/**
 * Revoke a badge (admin use)
 */
export async function revokeBadge(userId: string, badgeId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_badges')
    .delete()
    .eq('user_id', userId)
    .eq('badge_id', badgeId);
  
  return !error;
}
```

---

### Badge Trigger on Actions

**File: `src/services/badges/triggers.ts`**

```typescript
import { evaluateAndAwardBadges } from './index';

/**
 * Call after transaction completes
 */
export async function onTransactionComplete(buyerId: string, sellerId: string): Promise<void> {
  await Promise.all([
    evaluateAndAwardBadges(buyerId),
    evaluateAndAwardBadges(sellerId)
  ]);
}

/**
 * Call after donation completes
 */
export async function onDonationComplete(donorId: string): Promise<void> {
  await evaluateAndAwardBadges(donorId);
}

/**
 * Call after ID verification completes
 */
export async function onVerificationComplete(userId: string): Promise<void> {
  await evaluateAndAwardBadges(userId);
}

/**
 * Call after review is received
 */
export async function onReviewReceived(revieweeId: string): Promise<void> {
  await evaluateAndAwardBadges(revieweeId);
}
```

---

### Badge Display Components

**File: `src/components/badges/BadgeIcon.tsx`**

```typescript
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface Props {
  badge: {
    name: string;
    icon_url: string | null;
    icon_emoji: string;
    color: string;
  };
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
}

const SIZES = {
  small: { container: 24, emoji: 14 },
  medium: { container: 36, emoji: 20 },
  large: { container: 48, emoji: 28 }
};

export function BadgeIcon({ badge, size = 'medium', showTooltip = false }: Props) {
  const dimensions = SIZES[size];
  
  return (
    <View 
      style={[
        styles.container, 
        { 
          width: dimensions.container, 
          height: dimensions.container,
          backgroundColor: badge.color + '20' // 20% opacity
        }
      ]}
    >
      {badge.icon_url ? (
        <Image 
          source={{ uri: badge.icon_url }} 
          style={{ width: dimensions.emoji, height: dimensions.emoji }}
        />
      ) : (
        <Text style={{ fontSize: dimensions.emoji }}>{badge.icon_emoji}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
```

---

**File: `src/components/badges/BadgeRow.tsx`**

```typescript
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BadgeIcon } from './BadgeIcon';

interface Props {
  badges: Array<{
    id: string;
    name: string;
    icon_url: string | null;
    icon_emoji: string;
    color: string;
  }>;
  maxDisplay?: number;
  onPress?: () => void;
}

export function BadgeRow({ badges, maxDisplay = 4, onPress }: Props) {
  const displayBadges = badges.slice(0, maxDisplay);
  const remaining = badges.length - maxDisplay;
  
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      disabled={!onPress}
    >
      {displayBadges.map((badge, index) => (
        <View key={badge.id} style={[styles.badge, { marginLeft: index > 0 ? -8 : 0 }]}>
          <BadgeIcon badge={badge} size="small" />
        </View>
      ))}
      {remaining > 0 && (
        <View style={styles.more}>
          <Text style={styles.moreText}>+{remaining}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  badge: { borderWidth: 2, borderColor: '#fff', borderRadius: 100 },
  more: { marginLeft: 4, backgroundColor: '#e0e0e0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  moreText: { fontSize: 12, color: '#666' }
});
```

---

**File: `src/components/badges/ProfileBadges.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { BadgeIcon } from './BadgeIcon';
import { getUserBadges, getUserHighestBadges } from '@/services/badges';

interface Props {
  userId: string;
  showAll?: boolean;
}

export function ProfileBadges({ userId, showAll = false }: Props) {
  const [badges, setBadges] = useState<any[]>([]);
  const [highest, setHighest] = useState<Record<string, any>>({});
  
  useEffect(() => {
    loadBadges();
  }, [userId]);
  
  async function loadBadges() {
    if (showAll) {
      const all = await getUserBadges(userId);
      setBadges(all);
    } else {
      const highestBadges = await getUserHighestBadges(userId);
      setHighest(highestBadges);
    }
  }
  
  if (!showAll) {
    // Show only highest badges in compact view
    const trustBadge = highest.trust;
    const donationBadge = highest.donation;
    
    if (!trustBadge && !donationBadge) {
      return null;
    }
    
    return (
      <View style={styles.compactContainer}>
        {trustBadge && (
          <View style={styles.badgeWithLabel}>
            <BadgeIcon badge={trustBadge} size="medium" />
            <Text style={styles.badgeName}>{trustBadge.name}</Text>
          </View>
        )}
        {donationBadge && (
          <View style={styles.badgeWithLabel}>
            <BadgeIcon badge={donationBadge} size="medium" />
            <Text style={styles.badgeName}>{donationBadge.name}</Text>
          </View>
        )}
      </View>
    );
  }
  
  // Show all badges
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Badges</Text>
      {badges.length === 0 ? (
        <Text style={styles.empty}>No badges earned yet</Text>
      ) : (
        <FlatList
          data={badges}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.badgeCard}>
              <BadgeIcon badge={item} size="large" />
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardDate}>
                {new Date(item.earned_at).toLocaleDateString()}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 16 },
  compactContainer: { flexDirection: 'row', gap: 16 },
  header: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  empty: { color: '#666', fontStyle: 'italic' },
  badgeWithLabel: { alignItems: 'center' },
  badgeName: { fontSize: 12, marginTop: 4, color: '#666' },
  badgeCard: { alignItems: 'center', marginRight: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 12 },
  cardName: { fontSize: 14, fontWeight: '500', marginTop: 8 },
  cardDate: { fontSize: 12, color: '#999', marginTop: 2 }
});
```

---

### Admin: Badge Threshold Editor

**File: `src/components/admin/BadgeThresholdEditor.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet } from 'react-native';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { BadgeIcon } from '@/components/badges/BadgeIcon';

export function BadgeThresholdEditor() {
  const [badges, setBadges] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    loadBadges();
  }, []);
  
  async function loadBadges() {
    const { data } = await supabase
      .from('badges')
      .select('*')
      .order('badge_type', { ascending: true })
      .order('level', { ascending: true });
    setBadges(data || []);
  }
  
  function updateCriteria(badgeId: string, field: string, value: string) {
    setBadges(prev => prev.map(b => {
      if (b.id !== badgeId) return b;
      return {
        ...b,
        criteria: { ...b.criteria, [field]: parseFloat(value) || 0 }
      };
    }));
  }
  
  async function saveAll() {
    setSaving(true);
    
    for (const badge of badges) {
      await supabase
        .from('badges')
        .update({ criteria: badge.criteria, updated_at: new Date().toISOString() })
        .eq('id', badge.id);
    }
    
    setSaving(false);
    alert('Thresholds saved!');
  }
  
  const renderBadge = ({ item }: { item: any }) => (
    <View style={styles.badgeRow}>
      <View style={styles.badgeInfo}>
        <BadgeIcon badge={item} size="medium" />
        <View style={styles.badgeText}>
          <Text style={styles.badgeName}>{item.name}</Text>
          <Text style={styles.badgeType}>{item.badge_type} - Level {item.level}</Text>
        </View>
      </View>
      
      <View style={styles.criteria}>
        {item.badge_type === 'trust' && (
          <>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Min Transactions</Text>
              <TextInput
                style={styles.input}
                value={String(item.criteria.min_transactions || 0)}
                onChangeText={(v) => updateCriteria(item.id, 'min_transactions', v)}
                keyboardType="numeric"
              />
            </View>
            {item.level >= 2 && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Min Rating</Text>
                <TextInput
                  style={styles.input}
                  value={String(item.criteria.min_rating || 0)}
                  onChangeText={(v) => updateCriteria(item.id, 'min_rating', v)}
                  keyboardType="numeric"
                />
              </View>
            )}
          </>
        )}
        
        {item.badge_type === 'donation' && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Min Donations</Text>
            <TextInput
              style={styles.input}
              value={String(item.criteria.min_donations || 0)}
              onChangeText={(v) => updateCriteria(item.id, 'min_donations', v)}
              keyboardType="numeric"
            />
          </View>
        )}
      </View>
    </View>
  );
  
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Badge Thresholds</Text>
      <Text style={styles.subheader}>Configure requirements for each badge</Text>
      
      <FlatList
        data={badges}
        keyExtractor={(item) => item.id}
        renderItem={renderBadge}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      
      <Button
        title={saving ? 'Saving...' : 'Save All Thresholds'}
        onPress={saveAll}
        disabled={saving}
        style={styles.saveButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { fontSize: 20, fontWeight: '600' },
  subheader: { fontSize: 14, color: '#666', marginBottom: 20 },
  badgeRow: { paddingVertical: 16 },
  badgeInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  badgeText: { marginLeft: 12 },
  badgeName: { fontSize: 16, fontWeight: '500' },
  badgeType: { fontSize: 12, color: '#666', textTransform: 'capitalize' },
  criteria: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  field: { flex: 1, minWidth: 120 },
  fieldLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14 },
  separator: { height: 1, backgroundColor: '#eee' },
  saveButton: { marginTop: 20 }
});
```

---

### Testing Checklist

- [ ] Default badges seeded correctly
- [ ] User badges load on profile
- [ ] Highest badge per type displayed correctly
- [ ] Trust badge awarded on transaction count threshold
- [ ] Trust badge requires rating threshold (Silver+)
- [ ] Verified badge requires ID verification
- [ ] Donation badges awarded on donation count
- [ ] Badge notification sent on earn
- [ ] Duplicate badges prevented
- [ ] Admin can view all badge definitions
- [ ] Admin can edit thresholds
- [ ] Badge criteria saved correctly
- [ ] Badges display on user profile
- [ ] BadgeRow shows overflow correctly

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Database schema + seed data | 30 min |
| Badge service | 45 min |
| Badge evaluation logic | 30 min |
| UI components | 30 min |
| Admin threshold editor | 20 min |
| Testing | 15 min |
| **Total** | **~2.5 hours** |

---

<!-- 
MICRO-TASK 09-G COMPLETE
Next: 09-H (Task SP-007: Progress Bars & Status Indicators)
-->

---

## Task SP-007: Progress Bars & Status Indicators

**Estimated Time:** 2 hours  
**Priority:** P1 - MVP Feature  
**Dependencies:** SP-001 (Wallet), SP-005 (Challenges), SP-006 (Badges)

---

### Context

Progress bars and status indicators provide visual gamification that:
- Shows users how close they are to the next badge
- Displays challenge progress in an engaging way
- Indicates SP balance and expiration status
- Encourages continued platform engagement

---

### Core Progress Components

**File: `src/components/ui/ProgressBar.tsx`**

```typescript
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface Props {
  progress: number; // 0-100
  height?: number;
  color?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
  animated?: boolean;
}

export function ProgressBar({
  progress,
  height = 8,
  color = '#6200ee',
  backgroundColor = '#e0e0e0',
  showPercentage = false,
  animated = true
}: Props) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  
  const animatedWidth = React.useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    if (animated) {
      Animated.spring(animatedWidth, {
        toValue: clampedProgress,
        useNativeDriver: false,
        friction: 8
      }).start();
    } else {
      animatedWidth.setValue(clampedProgress);
    }
  }, [clampedProgress]);
  
  const width = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%']
  });
  
  return (
    <View style={styles.container}>
      <View style={[styles.track, { height, backgroundColor }]}>
        <Animated.View 
          style={[
            styles.fill, 
            { 
              height, 
              backgroundColor: color,
              width
            }
          ]} 
        />
      </View>
      {showPercentage && (
        <Text style={styles.percentage}>{Math.round(clampedProgress)}%</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  track: { flex: 1, borderRadius: 100, overflow: 'hidden' },
  fill: { borderRadius: 100 },
  percentage: { marginLeft: 8, fontSize: 12, color: '#666', minWidth: 35 }
});
```

---

### Badge Progress Indicator

**File: `src/components/gamification/BadgeProgress.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { BadgeIcon } from '@/components/badges/BadgeIcon';
import { supabase } from '@/lib/supabase';

interface Props {
  userId: string;
  badgeType: 'trust' | 'donation';
}

interface NextBadgeProgress {
  currentBadge: any | null;
  nextBadge: any | null;
  progress: number;
  current: number;
  target: number;
  metric: string;
}

export function BadgeProgress({ userId, badgeType }: Props) {
  const [data, setData] = useState<NextBadgeProgress | null>(null);
  
  useEffect(() => {
    loadProgress();
  }, [userId, badgeType]);
  
  async function loadProgress() {
    // Get user's current stats
    const stats = await getUserStats(userId);
    
    // Get all badges of this type
    const { data: badges } = await supabase
      .from('badges')
      .select('*')
      .eq('badge_type', badgeType)
      .eq('is_active', true)
      .order('level', { ascending: true });
    
    if (!badges) return;
    
    // Get user's earned badges of this type
    const { data: userBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);
    
    const earnedIds = new Set(userBadges?.map(ub => ub.badge_id) || []);
    
    // Find current (highest earned) and next (first unearned)
    let currentBadge = null;
    let nextBadge = null;
    
    for (const badge of badges) {
      if (earnedIds.has(badge.id)) {
        currentBadge = badge;
      } else if (!nextBadge) {
        nextBadge = badge;
      }
    }
    
    // Calculate progress toward next badge
    if (nextBadge) {
      const { progress, current, target, metric } = calculateProgress(
        badgeType,
        nextBadge.criteria,
        stats
      );
      setData({ currentBadge, nextBadge, progress, current, target, metric });
    } else {
      // Max level reached
      setData({ currentBadge, nextBadge: null, progress: 100, current: 0, target: 0, metric: '' });
    }
  }
  
  if (!data) return null;
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badgeSection}>
          {data.currentBadge ? (
            <>
              <BadgeIcon badge={data.currentBadge} size="medium" />
              <Text style={styles.currentLabel}>{data.currentBadge.name}</Text>
            </>
          ) : (
            <Text style={styles.noLabel}>No badge yet</Text>
          )}
        </View>
        
        {data.nextBadge && (
          <View style={styles.badgeSection}>
            <Text style={styles.nextLabel}>Next: {data.nextBadge.name}</Text>
            <BadgeIcon badge={data.nextBadge} size="medium" />
          </View>
        )}
      </View>
      
      {data.nextBadge ? (
        <>
          <ProgressBar progress={data.progress} color={data.nextBadge.color} />
          <Text style={styles.progressText}>
            {data.current} / {data.target} {data.metric}
          </Text>
        </>
      ) : (
        <View style={styles.maxLevel}>
          <Text style={styles.maxText}>🎉 Maximum level reached!</Text>
        </View>
      )}
    </View>
  );
}

async function getUserStats(userId: string) {
  const [transactionsRes, donationsRes, ratingsRes] = await Promise.all([
    supabase.from('transactions').select('*', { count: 'exact', head: true })
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).eq('status', 'completed'),
    supabase.from('donations').select('*', { count: 'exact', head: true })
      .eq('donor_id', userId).eq('status', 'completed'),
    supabase.from('reviews').select('rating').eq('reviewee_id', userId)
  ]);
  
  const ratings = ratingsRes.data?.map(r => r.rating) || [];
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  
  return {
    transactions: transactionsRes.count || 0,
    donations: donationsRes.count || 0,
    rating: avgRating
  };
}

function calculateProgress(
  badgeType: string,
  criteria: Record<string, any>,
  stats: { transactions: number; donations: number; rating: number }
): { progress: number; current: number; target: number; metric: string } {
  if (badgeType === 'trust') {
    const target = criteria.min_transactions || 1;
    const current = stats.transactions;
    return {
      progress: Math.min(100, (current / target) * 100),
      current,
      target,
      metric: 'transactions'
    };
  }
  
  if (badgeType === 'donation') {
    const target = criteria.min_donations || 1;
    const current = stats.donations;
    return {
      progress: Math.min(100, (current / target) * 100),
      current,
      target,
      metric: 'donations'
    };
  }
  
  return { progress: 0, current: 0, target: 1, metric: '' };
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f8f9fa', borderRadius: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  badgeSection: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currentLabel: { fontSize: 14, fontWeight: '500' },
  noLabel: { fontSize: 14, color: '#999' },
  nextLabel: { fontSize: 12, color: '#666' },
  progressText: { fontSize: 12, color: '#666', marginTop: 4, textAlign: 'center' },
  maxLevel: { padding: 12, alignItems: 'center' },
  maxText: { fontSize: 14, color: '#4CAF50', fontWeight: '500' }
});
```

---

### SP Wallet Status Card

**File: `src/components/gamification/SpStatusCard.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { getSpBalance, getExpiringSpSummary } from '@/services/sp/wallet';

interface Props {
  userId: string;
  onPress?: () => void;
}

interface SpStatus {
  balance: number;
  expiringSoon: number;
  expiringInDays: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
}

export function SpStatusCard({ userId, onPress }: Props) {
  const [status, setStatus] = useState<SpStatus | null>(null);
  
  useEffect(() => {
    loadStatus();
  }, [userId]);
  
  async function loadStatus() {
    const [balance, expiring, wallet] = await Promise.all([
      getSpBalance(userId),
      getExpiringSpSummary(userId, 30), // Expiring in 30 days
      getWalletDetails(userId)
    ]);
    
    setStatus({
      balance,
      expiringSoon: expiring.amount,
      expiringInDays: expiring.days,
      lifetimeEarned: wallet.lifetimeEarned,
      lifetimeSpent: wallet.lifetimeSpent
    });
  }
  
  if (!status) return null;
  
  const usagePercent = status.lifetimeEarned > 0 
    ? (status.lifetimeSpent / status.lifetimeEarned) * 100 
    : 0;
  
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Swap Points</Text>
        <Text style={styles.balance}>{status.balance.toLocaleString()} SP</Text>
      </View>
      
      {status.expiringSoon > 0 && (
        <View style={styles.expiringBanner}>
          <Text style={styles.expiringText}>
            ⚠️ {status.expiringSoon} SP expiring in {status.expiringInDays} days
          </Text>
        </View>
      )}
      
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{status.lifetimeEarned.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Lifetime Earned</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{status.lifetimeSpent.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Lifetime Spent</Text>
        </View>
      </View>
      
      <View style={styles.usageSection}>
        <Text style={styles.usageLabel}>Usage Rate</Text>
        <ProgressBar progress={usagePercent} color="#4CAF50" showPercentage />
      </View>
    </TouchableOpacity>
  );
}

async function getWalletDetails(userId: string) {
  const { data } = await supabase
    .from('sp_wallets')
    .select('lifetime_earned, lifetime_spent')
    .eq('user_id', userId)
    .single();
  
  return {
    lifetimeEarned: data?.lifetime_earned || 0,
    lifetimeSpent: data?.lifetime_spent || 0
  };
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#6200ee', borderRadius: 16, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 16, opacity: 0.9 },
  balance: { color: '#fff', fontSize: 28, fontWeight: '700' },
  expiringBanner: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 8, marginBottom: 16 },
  expiringText: { color: '#fff', fontSize: 14, textAlign: 'center' },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  stat: { alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '600' },
  statLabel: { color: '#fff', fontSize: 12, opacity: 0.8, marginTop: 2 },
  usageSection: { paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  usageLabel: { color: '#fff', fontSize: 12, opacity: 0.8, marginBottom: 8 }
});
```

---

### Challenge Progress Card

**File: `src/components/gamification/ChallengeProgressCard.tsx`**

```typescript
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface Props {
  challenge: {
    id: string;
    title: string;
    description: string;
    sp_reward: number;
    icon_emoji?: string;
  };
  progress: {
    current: number;
    target: number;
    status: 'in_progress' | 'completed' | 'claimed';
  };
  onPress?: () => void;
  onClaim?: () => void;
}

export function ChallengeProgressCard({ challenge, progress, onPress, onClaim }: Props) {
  const percent = (progress.current / progress.target) * 100;
  const isComplete = progress.status === 'completed';
  const isClaimed = progress.status === 'claimed';
  
  return (
    <TouchableOpacity 
      style={[styles.container, isComplete && styles.completeContainer]}
      onPress={onPress}
      disabled={isClaimed}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{challenge.icon_emoji || '🎯'}</Text>
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>{challenge.title}</Text>
          <Text style={styles.reward}>🌟 {challenge.sp_reward} SP</Text>
        </View>
      </View>
      
      {!isClaimed && (
        <View style={styles.progressSection}>
          <ProgressBar 
            progress={percent} 
            color={isComplete ? '#4CAF50' : '#6200ee'}
            height={10}
          />
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>{progress.current} / {progress.target}</Text>
            <Text style={styles.percentText}>{Math.round(percent)}%</Text>
          </View>
        </View>
      )}
      
      {isComplete && !isClaimed && onClaim && (
        <TouchableOpacity style={styles.claimButton} onPress={onClaim}>
          <Text style={styles.claimText}>🎉 Claim Reward</Text>
        </TouchableOpacity>
      )}
      
      {isClaimed && (
        <View style={styles.claimedBadge}>
          <Text style={styles.claimedText}>✓ Completed</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  completeContainer: { borderWidth: 2, borderColor: '#4CAF50' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0e6ff', justifyContent: 'center', alignItems: 'center' },
  icon: { fontSize: 22 },
  titleContainer: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, fontWeight: '600' },
  reward: { fontSize: 14, color: '#6200ee', marginTop: 2 },
  progressSection: { marginTop: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressText: { fontSize: 12, color: '#666' },
  percentText: { fontSize: 12, color: '#6200ee', fontWeight: '600' },
  claimButton: { backgroundColor: '#4CAF50', paddingVertical: 12, borderRadius: 8, marginTop: 12, alignItems: 'center' },
  claimText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  claimedBadge: { backgroundColor: '#E8F5E9', paddingVertical: 8, borderRadius: 8, marginTop: 12, alignItems: 'center' },
  claimedText: { color: '#2E7D32', fontWeight: '500' }
});
```

---

### Engagement Score Indicator

**File: `src/components/gamification/EngagementScore.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';

interface Props {
  userId: string;
}

type EngagementLevel = 'new' | 'active' | 'engaged' | 'power_user' | 'champion';

const LEVELS: Record<EngagementLevel, { label: string; color: string; minScore: number }> = {
  new: { label: 'New Member', color: '#9E9E9E', minScore: 0 },
  active: { label: 'Active', color: '#2196F3', minScore: 20 },
  engaged: { label: 'Engaged', color: '#4CAF50', minScore: 50 },
  power_user: { label: 'Power User', color: '#FF9800', minScore: 80 },
  champion: { label: 'Champion', color: '#9C27B0', minScore: 95 }
};

export function EngagementScore({ userId }: Props) {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState<EngagementLevel>('new');
  
  useEffect(() => {
    calculateScore();
  }, [userId]);
  
  async function calculateScore() {
    const factors = await getEngagementFactors(userId);
    
    // Calculate weighted score (0-100)
    const calculatedScore = Math.min(100, Math.round(
      (factors.transactionScore * 0.3) +
      (factors.listingScore * 0.2) +
      (factors.loginScore * 0.15) +
      (factors.reviewScore * 0.15) +
      (factors.challengeScore * 0.1) +
      (factors.ageScore * 0.1)
    ));
    
    setScore(calculatedScore);
    
    // Determine level
    let currentLevel: EngagementLevel = 'new';
    for (const [key, config] of Object.entries(LEVELS) as [EngagementLevel, typeof LEVELS[EngagementLevel]][]) {
      if (calculatedScore >= config.minScore) {
        currentLevel = key;
      }
    }
    setLevel(currentLevel);
  }
  
  const levelConfig = LEVELS[level];
  
  return (
    <View style={styles.container}>
      <View style={styles.scoreCircle}>
        <Text style={styles.scoreNumber}>{score}</Text>
        <Text style={styles.scoreLabel}>Score</Text>
      </View>
      <View style={styles.levelInfo}>
        <View style={[styles.levelDot, { backgroundColor: levelConfig.color }]} />
        <Text style={[styles.levelText, { color: levelConfig.color }]}>
          {levelConfig.label}
        </Text>
      </View>
    </View>
  );
}

async function getEngagementFactors(userId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
  
  // Transaction activity (last 30 days)
  const { count: recentTransactions } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .gte('created_at', thirtyDaysAgo.toISOString());
  
  // Listing activity
  const { count: activeListings } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', userId)
    .eq('status', 'active');
  
  // Login activity (from sessions or last_seen)
  const { data: profile } = await supabase
    .from('profiles')
    .select('last_seen_at, created_at')
    .eq('id', userId)
    .single();
  
  const daysSinceLogin = profile?.last_seen_at 
    ? Math.floor((Date.now() - new Date(profile.last_seen_at).getTime()) / (1000 * 60 * 60 * 24))
    : 30;
  
  // Reviews given
  const { count: reviewsGiven } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('reviewer_id', userId);
  
  // Challenges completed
  const { count: challengesCompleted } = await supabase
    .from('user_challenges')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'claimed');
  
  // Account age
  const accountAgeDays = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  return {
    transactionScore: Math.min(100, (recentTransactions || 0) * 20),
    listingScore: Math.min(100, (activeListings || 0) * 25),
    loginScore: Math.max(0, 100 - (daysSinceLogin * 10)),
    reviewScore: Math.min(100, (reviewsGiven || 0) * 20),
    challengeScore: Math.min(100, (challengesCompleted || 0) * 15),
    ageScore: Math.min(100, accountAgeDays)
  };
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 16 },
  scoreCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0e6ff', justifyContent: 'center', alignItems: 'center' },
  scoreNumber: { fontSize: 28, fontWeight: '700', color: '#6200ee' },
  scoreLabel: { fontSize: 10, color: '#6200ee', textTransform: 'uppercase' },
  levelInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  levelDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  levelText: { fontSize: 14, fontWeight: '600' }
});
```

---

### Gamification Dashboard Widget

**File: `src/components/gamification/GamificationDashboard.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SpStatusCard } from './SpStatusCard';
import { BadgeProgress } from './BadgeProgress';
import { ChallengeProgressCard } from './ChallengeProgressCard';
import { EngagementScore } from './EngagementScore';
import { getUserChallenges, claimChallengeReward } from '@/services/challenges';
import { useAuth } from '@/hooks/useAuth';

export function GamificationDashboard() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<any[]>([]);
  
  useEffect(() => {
    loadChallenges();
  }, []);
  
  async function loadChallenges() {
    const data = await getUserChallenges(user.id);
    setChallenges(data.slice(0, 3)); // Show top 3 active challenges
  }
  
  async function handleClaim(userChallengeId: string) {
    await claimChallengeReward(user.id, userChallengeId);
    await loadChallenges();
  }
  
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Your Progress</Text>
      
      {/* SP Status */}
      <SpStatusCard userId={user.id} />
      
      {/* Engagement Score */}
      <View style={styles.section}>
        <EngagementScore userId={user.id} />
      </View>
      
      {/* Badge Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badge Progress</Text>
        <BadgeProgress userId={user.id} badgeType="trust" />
        <View style={styles.spacer} />
        <BadgeProgress userId={user.id} badgeType="donation" />
      </View>
      
      {/* Active Challenges */}
      {challenges.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Challenges</Text>
          {challenges.map(uc => (
            <View key={uc.id} style={styles.challengeWrapper}>
              <ChallengeProgressCard
                challenge={uc.challenge}
                progress={{
                  current: uc.current_progress,
                  target: uc.target_progress,
                  status: uc.status
                }}
                onClaim={() => handleClaim(uc.id)}
              />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  spacer: { height: 12 },
  challengeWrapper: { marginBottom: 12 }
});
```

---

### Testing Checklist

- [ ] ProgressBar animates smoothly
- [ ] ProgressBar clamps to 0-100%
- [ ] Badge progress shows current vs next badge
- [ ] Badge progress shows "max level" when complete
- [ ] SP Status Card displays balance correctly
- [ ] Expiring SP warning shows when applicable
- [ ] Challenge progress card updates on action
- [ ] Claim button appears on completion
- [ ] Engagement score calculates correctly
- [ ] Engagement level displays proper color/label
- [ ] Dashboard renders all components
- [ ] Components handle loading states

---

### Time Breakdown

| Activity | Time |
|----------|------|
| ProgressBar component | 20 min |
| BadgeProgress component | 30 min |
| SpStatusCard component | 25 min |
| ChallengeProgressCard | 20 min |
| EngagementScore | 30 min |
| GamificationDashboard | 15 min |
| Testing | 10 min |
| **Total** | **~2.5 hours** |

---

<!-- 
MICRO-TASK 09-H COMPLETE
Next: 09-I (Task SP-008: SP Wallet UI)
-->

---

## Task SP-008: SP Wallet UI

**Estimated Time:** 2.5 hours  
**Priority:** P0 - Critical Path  
**Dependencies:** SP-001 (Wallet), SP-002 (Earning), SP-003 (Spending), SP-004 (Expiration)

---

### Context

The SP Wallet UI is the central hub for users to:
- View their current SP balance
- See transaction history (ledger)
- View SP batch details and expiration dates
- Understand their earning and spending patterns
- Access SP-related help and FAQs

---

### Wallet Service Extensions

**File: `src/services/sp/wallet.ts` (additions)**

```typescript
import { supabase } from '@/lib/supabase';

interface LedgerEntry {
  id: string;
  transaction_type: 'earn' | 'spend' | 'expire' | 'refund';
  sp_amount: number;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

interface SpBatch {
  id: string;
  initial_sp: number;
  remaining_sp: number;
  source: string;
  expires_at: string | null;
  expired_at: string | null;
  created_at: string;
}

interface WalletSummary {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  lifetimeExpired: number;
  activeBatches: number;
  nextExpiration: { amount: number; date: string } | null;
}

/**
 * Get full wallet summary
 */
export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const { data: wallet } = await supabase
    .from('sp_wallets')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (!wallet) {
    return {
      balance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      lifetimeExpired: 0,
      activeBatches: 0,
      nextExpiration: null
    };
  }
  
  // Get active batch count
  const { count: activeBatches } = await supabase
    .from('sp_batches')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gt('remaining_sp', 0)
    .is('expired_at', null);
  
  // Get next expiring batch
  const { data: nextBatch } = await supabase
    .from('sp_batches')
    .select('remaining_sp, expires_at')
    .eq('user_id', userId)
    .gt('remaining_sp', 0)
    .is('expired_at', null)
    .not('expires_at', 'is', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .limit(1)
    .single();
  
  return {
    balance: wallet.sp_balance,
    lifetimeEarned: wallet.lifetime_earned,
    lifetimeSpent: wallet.lifetime_spent,
    lifetimeExpired: wallet.lifetime_expired || 0,
    activeBatches: activeBatches || 0,
    nextExpiration: nextBatch ? {
      amount: nextBatch.remaining_sp,
      date: nextBatch.expires_at
    } : null
  };
}

/**
 * Get ledger entries with pagination
 */
export async function getLedgerEntries(
  userId: string,
  options: { page?: number; limit?: number; type?: string } = {}
): Promise<{ entries: LedgerEntry[]; total: number; hasMore: boolean }> {
  const { page = 1, limit = 20, type } = options;
  const offset = (page - 1) * limit;
  
  let query = supabase
    .from('sp_ledger')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (type) {
    query = query.eq('transaction_type', type);
  }
  
  const { data, count } = await query;
  
  return {
    entries: data || [],
    total: count || 0,
    hasMore: (count || 0) > offset + limit
  };
}

/**
 * Get SP batches with expiration info
 */
export async function getSpBatches(
  userId: string,
  includeExpired: boolean = false
): Promise<SpBatch[]> {
  let query = supabase
    .from('sp_batches')
    .select('*')
    .eq('user_id', userId)
    .order('expires_at', { ascending: true, nullsFirst: false });
  
  if (!includeExpired) {
    query = query.gt('remaining_sp', 0).is('expired_at', null);
  }
  
  const { data } = await query;
  return data || [];
}

/**
 * Get expiring SP summary (for warnings)
 */
export async function getExpiringSpSummary(
  userId: string,
  daysAhead: number
): Promise<{ amount: number; days: number }> {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  const { data } = await supabase
    .from('sp_batches')
    .select('remaining_sp, expires_at')
    .eq('user_id', userId)
    .gt('remaining_sp', 0)
    .is('expired_at', null)
    .gt('expires_at', new Date().toISOString())
    .lte('expires_at', futureDate.toISOString());
  
  if (!data || data.length === 0) {
    return { amount: 0, days: 0 };
  }
  
  const totalAmount = data.reduce((sum, b) => sum + b.remaining_sp, 0);
  const earliestExpiry = data.reduce((earliest, b) => {
    const d = new Date(b.expires_at);
    return d < earliest ? d : earliest;
  }, new Date(data[0].expires_at));
  
  const daysUntil = Math.ceil((earliestExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  return { amount: totalAmount, days: Math.max(0, daysUntil) };
}
```

---

### SP Wallet Screen

**File: `src/screens/SpWalletScreen.tsx`**

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { getWalletSummary, getLedgerEntries, getSpBatches } from '@/services/sp/wallet';
import { SpWalletHeader } from '@/components/sp/SpWalletHeader';
import { SpLedgerList } from '@/components/sp/SpLedgerList';
import { SpBatchList } from '@/components/sp/SpBatchList';
import { SpWalletStats } from '@/components/sp/SpWalletStats';

type Tab = 'history' | 'batches';

export function SpWalletScreen() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = useCallback(async () => {
    const [walletSummary, ledgerData, batchData] = await Promise.all([
      getWalletSummary(user.id),
      getLedgerEntries(user.id, { limit: 50 }),
      getSpBatches(user.id)
    ]);
    
    setSummary(walletSummary);
    setLedger(ledgerData.entries);
    setBatches(batchData);
    setLoading(false);
  }, [user.id]);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };
  
  if (loading) {
    return <View style={styles.loading}><Text>Loading...</Text></View>;
  }
  
  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header with balance */}
      <SpWalletHeader summary={summary} />
      
      {/* Stats row */}
      <SpWalletStats summary={summary} />
      
      {/* Tab selector */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'batches' && styles.activeTab]}
          onPress={() => setActiveTab('batches')}
        >
          <Text style={[styles.tabText, activeTab === 'batches' && styles.activeTabText]}>
            SP Batches
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Tab content */}
      {activeTab === 'history' ? (
        <SpLedgerList entries={ledger} />
      ) : (
        <SpBatchList batches={batches} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 16 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#6200ee' },
  tabText: { fontSize: 16, color: '#666' },
  activeTabText: { color: '#6200ee', fontWeight: '600' }
});
```

---

### Wallet Header Component

**File: `src/components/sp/SpWalletHeader.tsx`**

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  summary: {
    balance: number;
    nextExpiration: { amount: number; date: string } | null;
  };
}

export function SpWalletHeader({ summary }: Props) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.gradient}>
        <Text style={styles.label}>Available Swap Points</Text>
        <Text style={styles.balance}>{summary.balance.toLocaleString()}</Text>
        <Text style={styles.spLabel}>SP</Text>
        
        {summary.nextExpiration && (
          <View style={styles.expirationBanner}>
            <Text style={styles.expirationText}>
              ⏰ {summary.nextExpiration.amount} SP expiring {formatDate(summary.nextExpiration.date)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 16 },
  gradient: { 
    backgroundColor: '#6200ee', 
    borderRadius: 20, 
    padding: 24, 
    alignItems: 'center' 
  },
  label: { color: '#fff', opacity: 0.8, fontSize: 14 },
  balance: { color: '#fff', fontSize: 48, fontWeight: '700', marginTop: 8 },
  spLabel: { color: '#fff', fontSize: 18, opacity: 0.9, marginTop: -4 },
  expirationBanner: { 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 20, 
    marginTop: 16 
  },
  expirationText: { color: '#fff', fontSize: 14 }
});
```

---

### Wallet Stats Component

**File: `src/components/sp/SpWalletStats.tsx`**

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  summary: {
    lifetimeEarned: number;
    lifetimeSpent: number;
    lifetimeExpired: number;
    activeBatches: number;
  };
}

export function SpWalletStats({ summary }: Props) {
  const stats = [
    { label: 'Earned', value: summary.lifetimeEarned, icon: '📈', color: '#4CAF50' },
    { label: 'Spent', value: summary.lifetimeSpent, icon: '💸', color: '#2196F3' },
    { label: 'Expired', value: summary.lifetimeExpired, icon: '⏳', color: '#FF9800' },
    { label: 'Batches', value: summary.activeBatches, icon: '📦', color: '#9C27B0' }
  ];
  
  return (
    <View style={styles.container}>
      {stats.map((stat, index) => (
        <View key={stat.label} style={styles.stat}>
          <Text style={styles.icon}>{stat.icon}</Text>
          <Text style={[styles.value, { color: stat.color }]}>
            {stat.value.toLocaleString()}
          </Text>
          <Text style={styles.label}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  stat: { alignItems: 'center' },
  icon: { fontSize: 20, marginBottom: 4 },
  value: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 12, color: '#666', marginTop: 2 }
});
```

---

### Ledger List Component

**File: `src/components/sp/SpLedgerList.tsx`**

```typescript
import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

interface LedgerEntry {
  id: string;
  transaction_type: 'earn' | 'spend' | 'expire' | 'refund';
  sp_amount: number;
  description: string;
  created_at: string;
}

interface Props {
  entries: LedgerEntry[];
}

const TYPE_CONFIG = {
  earn: { icon: '⬆️', color: '#4CAF50', prefix: '+' },
  spend: { icon: '⬇️', color: '#F44336', prefix: '-' },
  expire: { icon: '⏳', color: '#FF9800', prefix: '-' },
  refund: { icon: '↩️', color: '#2196F3', prefix: '+' }
};

export function SpLedgerList({ entries }: Props) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today, ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday, ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  
  const renderEntry = ({ item }: { item: LedgerEntry }) => {
    const config = TYPE_CONFIG[item.transaction_type];
    const amount = Math.abs(item.sp_amount);
    
    return (
      <View style={styles.entry}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{config.icon}</Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>
        <Text style={[styles.amount, { color: config.color }]}>
          {config.prefix}{amount.toLocaleString()} SP
        </Text>
      </View>
    );
  };
  
  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📜</Text>
        <Text style={styles.emptyText}>No transactions yet</Text>
        <Text style={styles.emptyHint}>Your SP history will appear here</Text>
      </View>
    );
  }
  
  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.id}
      renderItem={renderEntry}
      contentContainerStyle={styles.list}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  entry: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  iconContainer: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#f5f5f5', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  icon: { fontSize: 18 },
  details: { flex: 1, marginLeft: 12 },
  description: { fontSize: 14, fontWeight: '500', color: '#333' },
  date: { fontSize: 12, color: '#999', marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, fontWeight: '500', marginTop: 12 },
  emptyHint: { fontSize: 14, color: '#666', marginTop: 4 }
});
```

---

### Batch List Component

**File: `src/components/sp/SpBatchList.tsx`**

```typescript
import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface SpBatch {
  id: string;
  initial_sp: number;
  remaining_sp: number;
  source: string;
  expires_at: string | null;
  created_at: string;
}

interface Props {
  batches: SpBatch[];
}

const SOURCE_LABELS: Record<string, string> = {
  starter_pack: 'Starter Pack',
  referral: 'Referral Bonus',
  challenge: 'Challenge Reward',
  refund: 'Refund',
  admin: 'Admin Credit'
};

export function SpBatchList({ batches }: Props) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const getDaysUntilExpiry = (expiresAt: string): number => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };
  
  const getExpiryColor = (days: number): string => {
    if (days <= 7) return '#F44336';
    if (days <= 30) return '#FF9800';
    return '#4CAF50';
  };
  
  const renderBatch = ({ item }: { item: SpBatch }) => {
    const usedPercent = ((item.initial_sp - item.remaining_sp) / item.initial_sp) * 100;
    const daysUntil = item.expires_at ? getDaysUntilExpiry(item.expires_at) : null;
    
    return (
      <View style={styles.batch}>
        <View style={styles.header}>
          <View>
            <Text style={styles.source}>{SOURCE_LABELS[item.source] || item.source}</Text>
            <Text style={styles.date}>Earned {formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.balanceContainer}>
            <Text style={styles.remaining}>{item.remaining_sp}</Text>
            <Text style={styles.initial}>/ {item.initial_sp} SP</Text>
          </View>
        </View>
        
        <View style={styles.progressSection}>
          <ProgressBar 
            progress={100 - usedPercent} 
            color="#6200ee" 
            height={6}
          />
          <Text style={styles.usedText}>
            {item.initial_sp - item.remaining_sp} SP used
          </Text>
        </View>
        
        {item.expires_at && daysUntil !== null && (
          <View style={[styles.expiryBadge, { backgroundColor: getExpiryColor(daysUntil) + '20' }]}>
            <Text style={[styles.expiryText, { color: getExpiryColor(daysUntil) }]}>
              {daysUntil <= 0 ? 'Expired' : `Expires in ${daysUntil} days`}
            </Text>
          </View>
        )}
        
        {!item.expires_at && (
          <View style={[styles.expiryBadge, { backgroundColor: '#E8F5E9' }]}>
            <Text style={[styles.expiryText, { color: '#2E7D32' }]}>
              Never expires
            </Text>
          </View>
        )}
      </View>
    );
  };
  
  if (batches.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text style={styles.emptyText}>No SP batches</Text>
        <Text style={styles.emptyHint}>Earn SP to see your batches here</Text>
      </View>
    );
  }
  
  return (
    <FlatList
      data={batches}
      keyExtractor={(item) => item.id}
      renderItem={renderBatch}
      contentContainerStyle={styles.list}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  batch: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  source: { fontSize: 16, fontWeight: '600' },
  date: { fontSize: 12, color: '#666', marginTop: 2 },
  balanceContainer: { alignItems: 'flex-end' },
  remaining: { fontSize: 24, fontWeight: '700', color: '#6200ee' },
  initial: { fontSize: 12, color: '#999' },
  progressSection: { marginBottom: 12 },
  usedText: { fontSize: 12, color: '#666', marginTop: 4 },
  expiryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  expiryText: { fontSize: 12, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, fontWeight: '500', marginTop: 12 },
  emptyHint: { fontSize: 14, color: '#666', marginTop: 4 }
});
```

---

### Wallet Navigation Integration

**File: `src/navigation/tabs.tsx` (addition)**

```typescript
// Add to tab navigator
import { SpWalletScreen } from '@/screens/SpWalletScreen';

// In tab configuration:
{
  name: 'Wallet',
  component: SpWalletScreen,
  options: {
    tabBarIcon: ({ color, size }) => <Icon name="wallet" color={color} size={size} />,
    tabBarLabel: 'SP Wallet'
  }
}
```

---

### Deep Link Support

**File: `src/navigation/linking.ts` (addition)**

```typescript
// Add deep link for wallet
const config = {
  screens: {
    // ... existing screens
    SpWallet: 'wallet',
    SpWalletHistory: 'wallet/history',
    SpWalletBatches: 'wallet/batches'
  }
};
```

---

### Testing Checklist

- [ ] Wallet screen loads correctly
- [ ] Balance displays accurate amount
- [ ] Expiring SP warning shows when applicable
- [ ] Stats row shows accurate lifetime data
- [ ] History tab displays ledger entries
- [ ] Ledger entries show correct icons/colors by type
- [ ] Ledger dates format correctly (Today, Yesterday, etc.)
- [ ] Batches tab displays all active batches
- [ ] Batch progress bar shows remaining %
- [ ] Batch expiry shows correct days remaining
- [ ] Expiry colors (red/orange/green) based on urgency
- [ ] Pull-to-refresh works
- [ ] Empty states display correctly
- [ ] Tab switching works smoothly

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Wallet service extensions | 30 min |
| SpWalletScreen | 25 min |
| SpWalletHeader | 15 min |
| SpWalletStats | 15 min |
| SpLedgerList | 30 min |
| SpBatchList | 30 min |
| Navigation integration | 10 min |
| Testing | 15 min |
| **Total** | **~2.5 hours** |

---

<!-- 
MICRO-TASK 09-I COMPLETE
Next: 09-J (Tasks SP-009 to SP-012 + Module Summary)
-->

---

## Task SP-009: Admin SP Configuration UI

**Estimated Time:** 1.5 hours  
**Priority:** P1 - MVP Feature  
**Dependencies:** All SP tasks

---

### Context

Centralized admin panel for configuring all SP and gamification settings. This consolidates:
- SP earning settings (starter pack, referral rewards)
- SP spending settings (conversion rates)
- SP expiration settings
- Challenge management
- Badge thresholds

---

### Admin SP Settings Dashboard

**File: `src/screens/admin/SpAdminDashboard.tsx`**

```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SpEarningSettings } from '@/components/admin/SpEarningSettings';
import { SpSpendingSettings } from '@/components/admin/SpSpendingSettings';
import { SpExpirationSettings } from '@/components/admin/SpExpirationSettings';
import { BadgeThresholdEditor } from '@/components/admin/BadgeThresholdEditor';
import { ChallengeManager } from '@/components/admin/ChallengeManager';

type Section = 'earning' | 'spending' | 'expiration' | 'badges' | 'challenges';

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: 'earning', label: 'Earning Settings', icon: '📈' },
  { key: 'spending', label: 'Spending Settings', icon: '💸' },
  { key: 'expiration', label: 'Expiration Settings', icon: '⏰' },
  { key: 'badges', label: 'Badge Thresholds', icon: '🏅' },
  { key: 'challenges', label: 'Challenges', icon: '🎯' }
];

export function SpAdminDashboard() {
  const [activeSection, setActiveSection] = useState<Section>('earning');
  
  const renderSection = () => {
    switch (activeSection) {
      case 'earning': return <SpEarningSettings />;
      case 'spending': return <SpSpendingSettings />;
      case 'expiration': return <SpExpirationSettings />;
      case 'badges': return <BadgeThresholdEditor />;
      case 'challenges': return <ChallengeManager />;
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.header}>SP & Gamification Settings</Text>
      
      {/* Section tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {SECTIONS.map(section => (
          <TouchableOpacity
            key={section.key}
            style={[styles.tab, activeSection === section.key && styles.activeTab]}
            onPress={() => setActiveSection(section.key)}
          >
            <Text style={styles.tabIcon}>{section.icon}</Text>
            <Text style={[styles.tabLabel, activeSection === section.key && styles.activeTabLabel]}>
              {section.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* Section content */}
      <ScrollView style={styles.content}>
        {renderSection()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { fontSize: 24, fontWeight: '700', padding: 20 },
  tabsContainer: { paddingHorizontal: 16, maxHeight: 70 },
  tab: { paddingHorizontal: 16, paddingVertical: 12, marginRight: 8, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', minWidth: 100 },
  activeTab: { backgroundColor: '#6200ee' },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 12, marginTop: 4, color: '#666' },
  activeTabLabel: { color: '#fff' },
  content: { flex: 1, padding: 16 }
});
```

---

### Earning Settings Component

**File: `src/components/admin/SpEarningSettings.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Switch, StyleSheet } from 'react-native';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

export function SpEarningSettings() {
  const [config, setConfig] = useState({
    starterPackAmount: '500',
    starterPackEnabled: true,
    referralSpReward: '100',
    referralCashReward: '5.00',
    referralEnabled: true,
    maxReferralsPerDay: '10'
  });
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    loadConfig();
  }, []);
  
  async function loadConfig() {
    const { data } = await supabase
      .from('sp_config')
      .select('key, value')
      .eq('category', 'earning');
    
    if (data) {
      const newConfig = { ...config };
      data.forEach(row => {
        switch (row.key) {
          case 'starter_pack_amount': newConfig.starterPackAmount = row.value; break;
          case 'starter_pack_enabled': newConfig.starterPackEnabled = row.value === 'true'; break;
          case 'referral_sp_reward': newConfig.referralSpReward = row.value; break;
          case 'referral_cash_reward': newConfig.referralCashReward = row.value; break;
          case 'referral_enabled': newConfig.referralEnabled = row.value === 'true'; break;
          case 'max_referrals_per_day': newConfig.maxReferralsPerDay = row.value; break;
        }
      });
      setConfig(newConfig);
    }
  }
  
  async function saveConfig() {
    setSaving(true);
    
    const updates = [
      { key: 'starter_pack_amount', value: config.starterPackAmount, category: 'earning' },
      { key: 'starter_pack_enabled', value: config.starterPackEnabled.toString(), category: 'earning' },
      { key: 'referral_sp_reward', value: config.referralSpReward, category: 'earning' },
      { key: 'referral_cash_reward', value: config.referralCashReward, category: 'earning' },
      { key: 'referral_enabled', value: config.referralEnabled.toString(), category: 'earning' },
      { key: 'max_referrals_per_day', value: config.maxReferralsPerDay, category: 'earning' }
    ];
    
    for (const update of updates) {
      await supabase.from('sp_config').upsert(update, { onConflict: 'key' });
    }
    
    setSaving(false);
    alert('Settings saved!');
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Starter Pack</Text>
      
      <View style={styles.row}>
        <Text>Enable Starter Pack</Text>
        <Switch
          value={config.starterPackEnabled}
          onValueChange={(v) => setConfig({ ...config, starterPackEnabled: v })}
        />
      </View>
      
      <View style={styles.field}>
        <Text style={styles.label}>Starter Pack Amount (SP)</Text>
        <TextInput
          style={styles.input}
          value={config.starterPackAmount}
          onChangeText={(v) => setConfig({ ...config, starterPackAmount: v })}
          keyboardType="numeric"
        />
        <Text style={styles.hint}>SP granted on first listing approval</Text>
      </View>
      
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Referral Rewards</Text>
      
      <View style={styles.row}>
        <Text>Enable Referral Rewards</Text>
        <Switch
          value={config.referralEnabled}
          onValueChange={(v) => setConfig({ ...config, referralEnabled: v })}
        />
      </View>
      
      <View style={styles.rowFields}>
        <View style={styles.halfField}>
          <Text style={styles.label}>SP Reward</Text>
          <TextInput
            style={styles.input}
            value={config.referralSpReward}
            onChangeText={(v) => setConfig({ ...config, referralSpReward: v })}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Cash Reward ($)</Text>
          <TextInput
            style={styles.input}
            value={config.referralCashReward}
            onChangeText={(v) => setConfig({ ...config, referralCashReward: v })}
            keyboardType="numeric"
          />
        </View>
      </View>
      
      <View style={styles.field}>
        <Text style={styles.label}>Max Referrals Per Day</Text>
        <TextInput
          style={styles.input}
          value={config.maxReferralsPerDay}
          onChangeText={(v) => setConfig({ ...config, maxReferralsPerDay: v })}
          keyboardType="numeric"
        />
        <Text style={styles.hint}>Fraud prevention limit</Text>
      </View>
      
      <Button
        title={saving ? 'Saving...' : 'Save Earning Settings'}
        onPress={saveConfig}
        disabled={saving}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  rowFields: { flexDirection: 'row', gap: 12 },
  field: { marginBottom: 16 },
  halfField: { flex: 1, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  hint: { fontSize: 12, color: '#666', marginTop: 4 },
  button: { marginTop: 20 }
});
```

---

### Spending Settings Component

**File: `src/components/admin/SpSpendingSettings.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Switch, StyleSheet, FlatList } from 'react-native';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

interface CategoryRate {
  id: string;
  name: string;
  rate: string;
}

export function SpSpendingSettings() {
  const [spendingEnabled, setSpendingEnabled] = useState(true);
  const [defaultRate, setDefaultRate] = useState('0.01');
  const [categoryRates, setCategoryRates] = useState<CategoryRate[]>([]);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    loadConfig();
  }, []);
  
  async function loadConfig() {
    // Load spending config
    const { data: config } = await supabase
      .from('sp_config')
      .select('key, value')
      .eq('category', 'spending');
    
    config?.forEach(row => {
      if (row.key === 'sp_spending_enabled') setSpendingEnabled(row.value === 'true');
      if (row.key === 'sp_default_conversion_rate') setDefaultRate(row.value);
      if (row.key === 'sp_conversion_rates') {
        const rates = JSON.parse(row.value);
        // Load categories and merge rates
        loadCategoriesWithRates(rates);
      }
    });
  }
  
  async function loadCategoriesWithRates(rates: Record<string, number>) {
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .order('name');
    
    if (categories) {
      setCategoryRates(categories.map(c => ({
        id: c.id,
        name: c.name,
        rate: String(rates[c.id] || '')
      })));
    }
  }
  
  function updateCategoryRate(categoryId: string, rate: string) {
    setCategoryRates(prev => prev.map(c => 
      c.id === categoryId ? { ...c, rate } : c
    ));
  }
  
  async function saveConfig() {
    setSaving(true);
    
    // Build category rates object
    const rates: Record<string, number> = {};
    categoryRates.forEach(c => {
      if (c.rate) rates[c.id] = parseFloat(c.rate);
    });
    
    await supabase.from('sp_config').upsert([
      { key: 'sp_spending_enabled', value: spendingEnabled.toString(), category: 'spending' },
      { key: 'sp_default_conversion_rate', value: defaultRate, category: 'spending' },
      { key: 'sp_conversion_rates', value: JSON.stringify(rates), category: 'spending' }
    ], { onConflict: 'key' });
    
    setSaving(false);
    alert('Settings saved!');
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>SP Spending Configuration</Text>
      
      <View style={styles.row}>
        <Text>Enable SP Spending</Text>
        <Switch value={spendingEnabled} onValueChange={setSpendingEnabled} />
      </View>
      
      <View style={styles.field}>
        <Text style={styles.label}>Default Conversion Rate (SP → $)</Text>
        <TextInput
          style={styles.input}
          value={defaultRate}
          onChangeText={setDefaultRate}
          keyboardType="numeric"
          placeholder="0.01"
        />
        <Text style={styles.hint}>1 SP = ${defaultRate} (default for unconfigured categories)</Text>
      </View>
      
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Category-Specific Rates</Text>
      <Text style={styles.hint}>Leave blank to use default rate</Text>
      
      <FlatList
        data={categoryRates}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.categoryRow}>
            <Text style={styles.categoryName}>{item.name}</Text>
            <TextInput
              style={styles.rateInput}
              value={item.rate}
              onChangeText={(v) => updateCategoryRate(item.id, v)}
              keyboardType="numeric"
              placeholder={defaultRate}
            />
          </View>
        )}
      />
      
      <Button
        title={saving ? 'Saving...' : 'Save Spending Settings'}
        onPress={saveConfig}
        disabled={saving}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  hint: { fontSize: 12, color: '#666', marginTop: 4 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  categoryName: { fontSize: 14, flex: 1 },
  rateInput: { width: 80, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, fontSize: 14, textAlign: 'center' },
  button: { marginTop: 20 }
});
```

---

## Task SP-010: Admin Engagement Monitoring Dashboard

**Estimated Time:** 2 hours  
**Priority:** P1 - MVP Feature

---

### Engagement Analytics Dashboard

**File: `src/screens/admin/EngagementDashboard.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { supabase } from '@/lib/supabase';

interface EngagementStats {
  totalSpIssued: number;
  totalSpSpent: number;
  totalSpExpired: number;
  activeWallets: number;
  avgSpBalance: number;
  challengesCompleted: number;
  badgesEarned: number;
  topEarners: { userId: string; email: string; balance: number }[];
  spTrend: { date: string; earned: number; spent: number }[];
}

export function EngagementDashboard() {
  const [stats, setStats] = useState<EngagementStats | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  
  useEffect(() => {
    loadStats();
  }, [period]);
  
  async function loadStats() {
    const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    
    // Aggregate SP stats
    const { data: walletAgg } = await supabase
      .from('sp_wallets')
      .select('sp_balance, lifetime_earned, lifetime_spent, lifetime_expired');
    
    const totalSpIssued = walletAgg?.reduce((sum, w) => sum + w.lifetime_earned, 0) || 0;
    const totalSpSpent = walletAgg?.reduce((sum, w) => sum + w.lifetime_spent, 0) || 0;
    const totalSpExpired = walletAgg?.reduce((sum, w) => sum + (w.lifetime_expired || 0), 0) || 0;
    const activeWallets = walletAgg?.filter(w => w.sp_balance > 0).length || 0;
    const avgSpBalance = activeWallets > 0 
      ? Math.round(walletAgg?.reduce((sum, w) => sum + w.sp_balance, 0)! / activeWallets) 
      : 0;
    
    // Challenges completed in period
    const { count: challengesCompleted } = await supabase
      .from('user_challenges')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'claimed')
      .gte('claimed_at', startDate.toISOString());
    
    // Badges earned in period
    const { count: badgesEarned } = await supabase
      .from('user_badges')
      .select('*', { count: 'exact', head: true })
      .gte('earned_at', startDate.toISOString());
    
    // Top earners
    const { data: topEarners } = await supabase
      .from('sp_wallets')
      .select('user_id, sp_balance, profiles(email)')
      .order('sp_balance', { ascending: false })
      .limit(10);
    
    setStats({
      totalSpIssued,
      totalSpSpent,
      totalSpExpired,
      activeWallets,
      avgSpBalance,
      challengesCompleted: challengesCompleted || 0,
      badgesEarned: badgesEarned || 0,
      topEarners: topEarners?.map(t => ({
        userId: t.user_id,
        email: t.profiles?.email || 'Unknown',
        balance: t.sp_balance
      })) || [],
      spTrend: [] // Would need time-series aggregation
    });
  }
  
  if (!stats) return <View style={styles.loading}><Text>Loading...</Text></View>;
  
  const utilizationRate = stats.totalSpIssued > 0 
    ? Math.round((stats.totalSpSpent / stats.totalSpIssued) * 100) 
    : 0;
  
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Engagement Analytics</Text>
      
      {/* Period selector */}
      <View style={styles.periodSelector}>
        {(['7d', '30d', '90d'] as const).map(p => (
          <Text
            key={p}
            style={[styles.periodOption, period === p && styles.activePeriod]}
            onPress={() => setPeriod(p)}
          >
            {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
          </Text>
        ))}
      </View>
      
      {/* SP Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Swap Points Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalSpIssued.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Issued</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalSpSpent.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalSpExpired.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Expired</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>{utilizationRate}%</Text>
            <Text style={styles.statLabel}>Utilization Rate</Text>
          </View>
        </View>
      </View>
      
      {/* User Engagement */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Engagement</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.activeWallets.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Active Wallets</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.avgSpBalance.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Avg Balance</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.challengesCompleted}</Text>
            <Text style={styles.statLabel}>Challenges Done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.badgesEarned}</Text>
            <Text style={styles.statLabel}>Badges Earned</Text>
          </View>
        </View>
      </View>
      
      {/* Top Earners */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top SP Holders</Text>
        {stats.topEarners.map((user, index) => (
          <View key={user.userId} style={styles.leaderRow}>
            <Text style={styles.rank}>#{index + 1}</Text>
            <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
            <Text style={styles.balance}>{user.balance.toLocaleString()} SP</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: '700', padding: 20 },
  periodSelector: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16 },
  periodOption: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, backgroundColor: '#fff', borderRadius: 20, color: '#666' },
  activePeriod: { backgroundColor: '#6200ee', color: '#fff' },
  section: { marginBottom: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#6200ee' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8 },
  rank: { fontSize: 16, fontWeight: '600', width: 30, color: '#6200ee' },
  email: { flex: 1, fontSize: 14 },
  balance: { fontSize: 14, fontWeight: '600' }
});
```

---

## Task SP-011: Admin Grant/Revoke SP

**Estimated Time:** 1 hour  
**Priority:** P1 - MVP Feature

---

### Admin SP Management

**File: `src/components/admin/AdminSpActions.tsx`**

```typescript
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export function AdminSpActions() {
  const { user: admin } = useAuth();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  
  async function handleGrant() {
    if (!userId || !amount) {
      Alert.alert('Error', 'Please enter user ID and amount');
      return;
    }
    
    setLoading(true);
    
    const { error } = await supabase.rpc('admin_grant_sp', {
      p_user_id: userId,
      p_amount: parseInt(amount),
      p_reason: reason || 'Admin credit',
      p_admin_id: admin.id
    });
    
    setLoading(false);
    
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', `Granted ${amount} SP to user`);
      setUserId('');
      setAmount('');
      setReason('');
    }
  }
  
  async function handleRevoke() {
    if (!userId || !amount) {
      Alert.alert('Error', 'Please enter user ID and amount');
      return;
    }
    
    Alert.alert(
      'Confirm Revoke',
      `Are you sure you want to revoke ${amount} SP from this user?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Revoke', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            
            const { error } = await supabase.rpc('admin_revoke_sp', {
              p_user_id: userId,
              p_amount: parseInt(amount),
              p_reason: reason || 'Admin revocation',
              p_admin_id: admin.id
            });
            
            setLoading(false);
            
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              Alert.alert('Success', `Revoked ${amount} SP from user`);
              setUserId('');
              setAmount('');
              setReason('');
            }
          }
        }
      ]
    );
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Grant/Revoke SP</Text>
      
      <View style={styles.field}>
        <Text style={styles.label}>User ID</Text>
        <TextInput
          style={styles.input}
          value={userId}
          onChangeText={setUserId}
          placeholder="Enter user UUID"
          autoCapitalize="none"
        />
      </View>
      
      <View style={styles.field}>
        <Text style={styles.label}>Amount (SP)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="100"
          keyboardType="numeric"
        />
      </View>
      
      <View style={styles.field}>
        <Text style={styles.label}>Reason</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={reason}
          onChangeText={setReason}
          placeholder="Reason for adjustment"
          multiline
        />
      </View>
      
      <View style={styles.buttons}>
        <Button
          title={loading ? 'Processing...' : 'Grant SP'}
          onPress={handleGrant}
          disabled={loading}
          style={styles.grantButton}
        />
        <Button
          title={loading ? 'Processing...' : 'Revoke SP'}
          onPress={handleRevoke}
          disabled={loading}
          variant="danger"
          style={styles.revokeButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  grantButton: { flex: 1 },
  revokeButton: { flex: 1 }
});
```

---

### RPC Functions for Admin Actions

**File: `supabase/migrations/YYYYMMDD_admin_sp_functions.sql`**

```sql
-- Admin grant SP
CREATE OR REPLACE FUNCTION admin_grant_sp(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_admin_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_batch_id UUID;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  -- Get or create wallet
  SELECT id INTO v_wallet_id FROM sp_wallets WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO sp_wallets (user_id, sp_balance, lifetime_earned)
    VALUES (p_user_id, 0, 0)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Create batch (no expiration for admin credits)
  INSERT INTO sp_batches (user_id, initial_sp, remaining_sp, source, expires_at)
  VALUES (p_user_id, p_amount, p_amount, 'admin', NULL)
  RETURNING id INTO v_batch_id;
  
  -- Update wallet
  UPDATE sp_wallets
  SET sp_balance = sp_balance + p_amount,
      lifetime_earned = lifetime_earned + p_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Log to ledger
  INSERT INTO sp_ledger (wallet_id, user_id, transaction_type, sp_amount, batch_id, description, reference_type, reference_id)
  VALUES (v_wallet_id, p_user_id, 'earn', p_amount, v_batch_id, 'Admin credit: ' || p_reason, 'admin', p_admin_id);
  
  -- Log admin action
  INSERT INTO admin_audit_log (admin_id, action, target_user_id, details)
  VALUES (p_admin_id, 'grant_sp', p_user_id, jsonb_build_object('amount', p_amount, 'reason', p_reason));
  
  RETURN TRUE;
END;
$$;

-- Admin revoke SP
CREATE OR REPLACE FUNCTION admin_revoke_sp(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_admin_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance INTEGER;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  -- Get wallet
  SELECT id, sp_balance INTO v_wallet_id, v_current_balance
  FROM sp_wallets WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'User has no SP wallet';
  END IF;
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. User has % SP', v_current_balance;
  END IF;
  
  -- Deduct from wallet (doesn't affect batches - treated as penalty)
  UPDATE sp_wallets
  SET sp_balance = sp_balance - p_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Log to ledger
  INSERT INTO sp_ledger (wallet_id, user_id, transaction_type, sp_amount, description, reference_type, reference_id)
  VALUES (v_wallet_id, p_user_id, 'spend', -p_amount, 'Admin revocation: ' || p_reason, 'admin', p_admin_id);
  
  -- Log admin action
  INSERT INTO admin_audit_log (admin_id, action, target_user_id, details)
  VALUES (p_admin_id, 'revoke_sp', p_user_id, jsonb_build_object('amount', p_amount, 'reason', p_reason));
  
  RETURN TRUE;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION admin_grant_sp TO authenticated;
GRANT EXECUTE ON FUNCTION admin_revoke_sp TO authenticated;
```

---

## Task SP-012: Integration Tests

**Estimated Time:** 1.5 hours  
**Priority:** P1 - MVP Feature

---

### SP System Integration Tests

**File: `src/test/sp/integration.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '@/lib/supabase';
import { issueStarterPack, grantReferralReward, grantChallengeReward } from '@/services/sp/earning';
import { spendSp, calculateSpSpending } from '@/services/sp/spending';
import { getSpBalance, getWalletSummary } from '@/services/sp/wallet';
import { evaluateAndAwardBadges } from '@/services/badges';

describe('SP System Integration', () => {
  let testUserId: string;
  
  beforeAll(async () => {
    // Create test user
    const { data } = await supabase.auth.signUp({
      email: `test-sp-${Date.now()}@test.com`,
      password: 'testpassword123'
    });
    testUserId = data.user!.id;
    
    // Make them a subscriber
    await supabase.from('subscriptions').insert({
      user_id: testUserId,
      tier: 'kids_club_plus',
      status: 'active'
    });
  });
  
  afterAll(async () => {
    // Clean up test data
    await supabase.from('sp_wallets').delete().eq('user_id', testUserId);
    await supabase.from('subscriptions').delete().eq('user_id', testUserId);
    await supabase.auth.admin.deleteUser(testUserId);
  });
  
  describe('Earning', () => {
    it('should issue starter pack on first listing', async () => {
      const result = await issueStarterPack(testUserId, 'test-listing-id');
      expect(result.success).toBe(true);
      expect(result.spGranted).toBeGreaterThan(0);
      
      const balance = await getSpBalance(testUserId);
      expect(balance).toBe(result.spGranted);
    });
    
    it('should prevent duplicate starter pack', async () => {
      const result = await issueStarterPack(testUserId, 'test-listing-id-2');
      expect(result.success).toBe(false);
      expect(result.error).toContain('already issued');
    });
    
    it('should grant referral reward', async () => {
      const initialBalance = await getSpBalance(testUserId);
      const result = await grantReferralReward(testUserId, 'referred-user-id');
      
      expect(result.success).toBe(true);
      
      const newBalance = await getSpBalance(testUserId);
      expect(newBalance).toBeGreaterThan(initialBalance);
    });
  });
  
  describe('Spending', () => {
    it('should calculate spending correctly', async () => {
      const balance = await getSpBalance(testUserId);
      const calculation = await calculateSpSpending(
        testUserId,
        50.00, // item price
        5.00,  // buyer fee
        'toys', // category
        balance // use all SP
      );
      
      expect(calculation.spApplied).toBeLessThanOrEqual(balance);
      expect(calculation.buyerFeeInCash).toBe(5.00); // Fees always in cash
      expect(calculation.totalCashRequired).toBeGreaterThan(0);
    });
    
    it('should deduct SP using FIFO', async () => {
      const initialBalance = await getSpBalance(testUserId);
      
      const result = await spendSp({
        userId: testUserId,
        transactionId: 'test-transaction-id',
        itemPrice: 10.00,
        buyerFee: 1.00,
        categoryId: 'toys',
        spToSpend: 100
      });
      
      expect(result.success).toBe(true);
      
      const newBalance = await getSpBalance(testUserId);
      expect(newBalance).toBeLessThan(initialBalance);
    });
  });
  
  describe('Wallet', () => {
    it('should return wallet summary', async () => {
      const summary = await getWalletSummary(testUserId);
      
      expect(summary).toHaveProperty('balance');
      expect(summary).toHaveProperty('lifetimeEarned');
      expect(summary).toHaveProperty('lifetimeSpent');
      expect(summary.lifetimeEarned).toBeGreaterThan(0);
    });
  });
  
  describe('Badges', () => {
    it('should evaluate badges without error', async () => {
      const badges = await evaluateAndAwardBadges(testUserId);
      expect(Array.isArray(badges)).toBe(true);
    });
  });
});
```

---

## Module Summary

### Total Tasks: 12

| Task | Name | Estimated Time | Priority |
|------|------|----------------|----------|
| SP-001 | SP Database Schema & Wallet | 2.5 hours | P0 |
| SP-002 | SP Earning Logic | 2.5 hours | P0 |
| SP-003 | SP Spending Logic | 3 hours | P0 |
| SP-004 | SP Expiration System | 3 hours | P0 |
| SP-005 | Challenges System | 3.5 hours | P1 |
| SP-006 | Badges System | 2.5 hours | P1 |
| SP-007 | Progress Bars & Status Indicators | 2.5 hours | P1 |
| SP-008 | SP Wallet UI | 2.5 hours | P0 |
| SP-009 | Admin SP Configuration UI | 1.5 hours | P1 |
| SP-010 | Admin Engagement Dashboard | 2 hours | P1 |
| SP-011 | Admin Grant/Revoke SP | 1 hour | P1 |
| SP-012 | Integration Tests | 1.5 hours | P1 |

---

### Total Estimated Time: ~28 hours

---

### Key V2 Changes Implemented

| Feature | Old (V1) | New (V2) |
|---------|----------|----------|
| SP Access | All users | Kids Club+ subscribers only |
| SP:Cash Rate | Fixed 1:1 | Admin-defined formulas per category |
| Max SP Usage | 50% cap | No cap (use all SP, pay fees in cash) |
| Expiration | Fixed period | Admin-configurable (period + trigger + grace) |
| Badges | Generic | Trust badges + Donation badges (both admin-configurable) |
| Challenges | None | Full challenge system with progress tracking |
| Referral Rewards | SP only | SP and/or cash (admin-configurable) |
| Admin Control | Limited | Full configurability for all settings |

---

### Files Created/Modified

#### Database
- `sp_wallets` - User SP balance tracking
- `sp_batches` - FIFO expiration tracking
- `sp_ledger` - Immutable audit trail
- `sp_config` - Admin-configurable settings
- `sp_warning_log` - Expiration warning tracking
- `challenges` - Challenge definitions
- `user_challenges` - User challenge progress
- `badges` - Badge definitions
- `user_badges` - User earned badges

#### Services
- `src/services/sp/wallet.ts`
- `src/services/sp/earning.ts`
- `src/services/sp/spending.ts`
- `src/services/sp/expiration.ts`
- `src/services/challenges/index.ts`
- `src/services/badges/index.ts`

#### UI Components
- `src/components/sp/*` - Wallet UI components
- `src/components/challenges/*` - Challenge UI components
- `src/components/badges/*` - Badge UI components
- `src/components/gamification/*` - Progress bars, status cards
- `src/components/admin/*` - Admin configuration UIs

#### Screens
- `src/screens/SpWalletScreen.tsx`
- `src/screens/ChallengesScreen.tsx`
- `src/screens/admin/SpAdminDashboard.tsx`
- `src/screens/admin/EngagementDashboard.tsx`

#### Edge Functions
- `supabase/functions/sp-expiration-cron/index.ts`

---

### Dependencies

- **MODULE-02** (Authentication) - User identity, subscription status
- **MODULE-11** (Subscriptions) - Kids Club+ verification

### Dependents

- **MODULE-06** (Transaction Flow) - SP spending at checkout
- **MODULE-04** (Listings) - Starter pack on first listing
- **MODULE-10** (Referrals) - Referral SP rewards

---

<!-- 
MODULE-09-POINTS-GAMIFICATION-V2.md COMPLETE
Ready to replace original MODULE-09-POINTS-GAMIFICATION.md
-->
