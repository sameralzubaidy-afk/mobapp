# MODULE-17: REFERRALS SYSTEM V2
# Kids Club+ Referral Program with Swap Points Rewards

**Version:** 2.0  
**Last Updated:** December 7, 2025  
**Status:** Ready for Implementation  
**Estimated Total Duration:** 15 hours

---

## V2 UPDATE OVERVIEW

### What Changed in V2?
This module introduces a referral program integrated with the V2 subscription-gated Swap Points system:

**Core Changes:**
- Referral codes generate unique shareable links
- **SP Bonus Rewards**: Both referrer and referee earn SP when referee completes first trade
- **Trial Extension (Optional)**: Successful referrals can extend trial period
- Referral tracking dashboard shows invites sent, signups, completed trades, SP earned
- Admin analytics for K-factor, conversion rates, viral coefficient

**V2 Business Model Integration:**
- Kids Club+ subscription: $7.99/month with 30-day no-card trial
- Swap Points gated by subscription: Only trial/active subscribers can earn/spend SP
- **Referral SP Rewards**: Referrer earns 25 SP, referee earns 10 SP (on first trade completion)
- **Trial Extension Bonus**: Successful referral extends trial by 7 days (max 3 extensions = 21 days)
- Referral SP rewards only granted if both users have active/trial subscriptions

### Why V2 Matters for Referrals
- **Viral Growth**: SP rewards incentivize users to invite friends
- **Quality Referrals**: First trade completion ensures engaged users (not just signups)
- **Subscription Alignment**: Trial extension encourages early adoption before payment
- **Network Effects**: More referrals = more SP = more trades = stronger marketplace

---

## CHANGELOG (V2)

### Added
- **Referral Code Generation**: Unique 8-character alphanumeric codes per user
- **Shareable Links**: Deep links to referral signup with code pre-filled
- **SP Bonus Rewards**: 25 SP for referrer, 10 SP for referee on first trade completion
- **Trial Extension**: Optional 7-day trial extension per successful referral (max 3)
- **Referral Tracking Dashboard**: Invites sent, signups, completed trades, SP earned
- **Admin Analytics**: K-factor calculation, conversion funnel, viral coefficient
- **Referral Notifications**: Invite accepted, first trade completed, SP awarded

### Modified
- None (new module)

### Deprecated
- None

---

## CRITICAL RULES (V2 Compliance)

### Subscription Gating
1. **SP Rewards Only for Subscribers**:
   - Referral SP rewards ONLY granted if BOTH referrer and referee have trial/active subscription
   - If either user's subscription expires, pending SP rewards are forfeited
   - Non-subscribers can still refer but won't earn SP rewards

2. **Trial Extension Logic**:
   - Trial extension only applies to trial_end_date (not paid subscriptions)
   - Maximum 3 successful referrals can extend trial (21 days total extension)
   - Extension applied when referee completes first trade
   - Extension tracked in `referral_extensions_used` counter

### Referral Attribution
1. **First-Touch Attribution**: Referee linked to referrer on first signup only
2. **One Referrer Per User**: Cannot change referrer after signup
3. **Self-Referral Prevention**: Users cannot refer themselves (same email/device check)
4. **Referral Code Uniqueness**: Each user gets one unique code (no duplicates)

### Reward Triggers
1. **Signup Event**: Referee linked to referrer (no rewards yet)
2. **First Trade Completion**: SP rewards granted + trial extension applied
3. **Reward Timing**: SP credited immediately after trade marked 'completed'
4. **Idempotency**: Rewards only granted once per referral (status: 'pending' → 'completed')

---

## AGENT TEMPLATE INSTRUCTIONS

When implementing tasks from this module, use this template for AI code generation:

```typescript
/*
CONTEXT: Kids Club+ V2 Referral System
BUSINESS MODEL: $7.99/month subscription, 30-day no-card trial, SP gated by subscription
REFERRAL REWARDS: Referrer gets 25 SP, referee gets 10 SP on first trade completion
TRIAL EXTENSION: +7 days per successful referral (max 3 extensions = 21 days)

CRITICAL RULES:
- SP rewards ONLY granted if BOTH users have trial/active subscription
- Trial extension ONLY applies to users still in trial (not paid subscriptions)
- Referral SP rewards triggered by first trade completion (not signup)
- Self-referral prevention: Check email, device_id, IP address
- Max 3 trial extensions per user (21 days total)

CROSS-MODULE DEPENDENCIES:
- MODULE-11 (Subscriptions): trial_end_date extension logic
- MODULE-09 (Swap Points): SP ledger entries for referral rewards
- MODULE-06 (Trade Flow): First trade completion trigger
- MODULE-14 (Notifications): Referral event notifications
- MODULE-03 (Authentication): Referral code capture on signup

TASK: [specific task from this module]
FILES TO CREATE/MODIFY: [list files]
*/
```

---

## TASK REF-V2-001: Referral Code Generation & Storage

**Duration:** 2.5 hours  
**Priority:** Critical  
**Dependencies:** MODULE-03 (Auth)

### Description
Create referral code system with unique 8-character alphanumeric codes per user. Generate codes on user signup. Store referral relationships with attribution tracking. Implement self-referral prevention checks.

### Acceptance Criteria
- [ ] Each user gets unique 8-character referral code on signup
- [ ] Referral codes are case-insensitive (stored lowercase)
- [ ] Self-referral prevention (email, device_id checks)
- [ ] Referral relationships stored with status tracking
- [ ] Referrer-referee linkage established on signup

---

### AI Prompt for Cursor

```typescript
/*
TASK: Referral code generation and storage

CONTEXT:
Each user gets a unique referral code on signup.
Referees enter code during registration to link to referrer.
Track referral relationships with status (pending, completed).

REFERRAL CODE FORMAT:
- 8 characters: alphanumeric (a-z, 0-9)
- Case-insensitive (stored lowercase)
- Example: "abc123xy"
- Collision prevention (retry on duplicate)

SELF-REFERRAL PREVENTION:
- Same email check
- Same device_id check (if available)
- Same IP address check (optional)

==================================================
FILE 1: Referral code schema
==================================================
*/

-- filepath: supabase/migrations/170_referral_codes_v2.sql

-- Referral codes table
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT code_length CHECK (char_length(code) = 8)
);

CREATE UNIQUE INDEX referral_codes_code_idx ON referral_codes(LOWER(code));
CREATE INDEX referral_codes_user_idx ON referral_codes(user_id);

-- Referral status enum
CREATE TYPE referral_status AS ENUM ('pending', 'completed', 'expired');

-- Referrals table (tracks referrer → referee relationships)
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status referral_status DEFAULT 'pending',
  reward_granted_at TIMESTAMPTZ,
  trial_extension_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(referee_id), -- One referrer per referee
  CHECK (referrer_id != referee_id) -- Prevent self-referral
);

CREATE INDEX referrals_referrer_idx ON referrals(referrer_id);
CREATE INDEX referrals_referee_idx ON referrals(referee_id);
CREATE INDEX referrals_status_idx ON referrals(status);

-- RLS policies
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral code"
  ON referral_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view referrals as referrer or referee"
  ON referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- RPC: Generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    v_code := LOWER(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE LOWER(code) = v_code) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- RPC: Create referral code for user
CREATE OR REPLACE FUNCTION create_referral_code(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Check if user already has a code
  SELECT code INTO v_code FROM referral_codes WHERE user_id = p_user_id;
  
  IF v_code IS NOT NULL THEN
    RETURN jsonb_build_object('code', v_code, 'created', false);
  END IF;
  
  -- Generate new code
  v_code := generate_referral_code();
  
  -- Insert code
  INSERT INTO referral_codes (user_id, code)
  VALUES (p_user_id, v_code);
  
  RETURN jsonb_build_object('code', v_code, 'created', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Validate and apply referral code on signup
CREATE OR REPLACE FUNCTION apply_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_referee_email TEXT;
  v_referrer_email TEXT;
BEGIN
  -- Normalize code to lowercase
  p_referral_code := LOWER(TRIM(p_referral_code));
  
  -- Get referrer from code
  SELECT user_id INTO v_referrer_id
  FROM referral_codes
  WHERE LOWER(code) = p_referral_code;
  
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Prevent self-referral (same user ID)
  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Prevent self-referral (same email)
  SELECT email INTO v_referee_email FROM users WHERE id = p_referee_id;
  SELECT email INTO v_referrer_email FROM users WHERE id = v_referrer_id;
  
  IF v_referee_email = v_referrer_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Check if referee already has a referrer
  IF EXISTS(SELECT 1 FROM referrals WHERE referee_id = p_referee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied');
  END IF;
  
  -- Create referral relationship
  INSERT INTO referrals (referrer_id, referee_id, referral_code, status)
  VALUES (v_referrer_id, p_referee_id, p_referral_code, 'pending');
  
  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'message', 'Referral code applied successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Create referral code on user signup
CREATE OR REPLACE FUNCTION create_referral_code_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_referral_code(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_referral_code_trigger
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_referral_code_on_signup();

/*
==================================================
FILE 2: Referral code service (TypeScript)
==================================================
*/

// filepath: src/services/referralCode.ts

import { supabase } from '@/lib/supabase';

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string;
  referral_code: string;
  status: 'pending' | 'completed' | 'expired';
  reward_granted_at: string | null;
  trial_extension_applied: boolean;
  created_at: string;
  completed_at: string | null;
}

export class ReferralCodeService {
  /**
   * Get user's referral code
   */
  static async getReferralCode(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No code exists, create one
        return await this.createReferralCode(userId);
      }
      throw new Error(`Failed to get referral code: ${error.message}`);
    }

    return data?.code || null;
  }

  /**
   * Create referral code for user (if doesn't exist)
   */
  static async createReferralCode(userId: string): Promise<string> {
    const { data, error } = await supabase.rpc('create_referral_code', {
      p_user_id: userId,
    });

    if (error) {
      throw new Error(`Failed to create referral code: ${error.message}`);
    }

    return data.code;
  }

  /**
   * Apply referral code for new user
   */
  static async applyReferralCode(
    refereeId: string,
    referralCode: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('apply_referral_code', {
      p_referee_id: refereeId,
      p_referral_code: referralCode.toLowerCase().trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  }

  /**
   * Get shareable referral link
   */
  static getReferralLink(code: string): string {
    // Deep link format for mobile app
    const baseUrl = 'kidsclub://signup';
    return `${baseUrl}?ref=${code}`;
  }

  /**
   * Get referral statistics for user
   */
  static async getReferralStats(userId: string): Promise<{
    total_referrals: number;
    pending_referrals: number;
    completed_referrals: number;
    total_sp_earned: number;
  }> {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', userId);

    if (error) {
      throw new Error(`Failed to get referral stats: ${error.message}`);
    }

    const total_referrals = data?.length || 0;
    const pending_referrals = data?.filter((r) => r.status === 'pending').length || 0;
    const completed_referrals = data?.filter((r) => r.status === 'completed').length || 0;
    const total_sp_earned = completed_referrals * 25; // 25 SP per completed referral

    return {
      total_referrals,
      pending_referrals,
      completed_referrals,
      total_sp_earned,
    };
  }
}

/*
==================================================
FILE 3: Referral signup flow (React Native)
==================================================
*/

// filepath: src/screens/SignupScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AuthService } from '@/services/auth';
import { ReferralCodeService } from '@/services/referralCode';

export const SignupScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Pre-fill referral code from deep link
    const refCode = route.params?.ref;
    if (refCode) {
      setReferralCode(refCode);
    }
  }, [route.params]);

  const handleSignup = async () => {
    try {
      setError('');

      // Sign up user
      const user = await AuthService.signUp(email, password);

      // Apply referral code if provided
      if (referralCode) {
        const result = await ReferralCodeService.applyReferralCode(
          user.id,
          referralCode
        );

        if (!result.success) {
          setError(result.error || 'Invalid referral code');
          // Continue with signup even if referral code fails
        }
      }

      // Navigate to onboarding
      navigation.navigate('Onboarding');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up for Kids Club+</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Referral Code (Optional)"
        value={referralCode}
        onChangeText={setReferralCode}
        autoCapitalize="none"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button title="Sign Up" onPress={handleSignup} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  error: {
    color: 'red',
    marginBottom: 16,
    textAlign: 'center',
  },
});
```

### Testing Checklist
- [ ] Referral code generated on user signup (8 characters)
- [ ] Referral code is unique (no duplicates)
- [ ] Referral code case-insensitive (ABC123XY = abc123xy)
- [ ] Self-referral prevented (same user ID)
- [ ] Self-referral prevented (same email)
- [ ] Referee can only have one referrer
- [ ] Invalid referral code shows error
- [ ] Referral relationship created with status 'pending'
- [ ] Deep link pre-fills referral code on signup screen

### Deployment Notes
1. Run migration 170_referral_codes_v2.sql
2. Verify referral code trigger fires on user signup
3. Test self-referral prevention logic
4. Configure deep link handler for referral links

---

## TASK REF-V2-002: SP Bonus Rewards on First Trade

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** MODULE-06 (Trade Flow), MODULE-09 (Swap Points)

### Description
Implement SP bonus rewards when referee completes first trade. Referrer earns 25 SP, referee earns 10 SP. Verify both users have trial/active subscription before granting rewards. Update referral status to 'completed' after rewards granted.

### Acceptance Criteria
- [ ] SP rewards triggered when referee completes first trade
- [ ] Referrer receives 25 SP
- [ ] Referee receives 10 SP
- [ ] Subscription status verified for both users (trial/active only)
- [ ] Rewards only granted once per referral (idempotent)
- [ ] Referral status updated to 'completed'
- [ ] SP ledger entries created with reason: 'referral_bonus'

---

### AI Prompt for Cursor

```typescript
/*
TASK: SP bonus rewards on first trade completion

CONTEXT:
When referee completes their first trade, both users earn SP:
- Referrer: 25 SP
- Referee: 10 SP

SUBSCRIPTION GATING:
- BOTH users must have trial/active subscription to receive rewards
- If either user's subscription is expired/cancelled, NO rewards granted
- Check subscription status before granting SP

TRIGGER TIMING:
- Trigger on trade status change to 'completed'
- Check if trade is referee's first completed trade
- Check if referral status is 'pending' (not already rewarded)

IDEMPOTENCY:
- Rewards only granted once per referral
- Referral status changes from 'pending' → 'completed'
- Use database transaction to prevent double rewards

==================================================
FILE 1: Referral reward trigger
==================================================
*/

-- filepath: supabase/migrations/171_referral_rewards.sql

-- RPC: Grant referral SP rewards
CREATE OR REPLACE FUNCTION grant_referral_rewards(
  p_referee_id UUID,
  p_trade_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_id UUID;
  v_referrer_subscription_status subscription_status;
  v_referee_subscription_status subscription_status;
  v_rewards_granted BOOLEAN DEFAULT false;
BEGIN
  -- Get referral relationship
  SELECT id, referrer_id, status
  INTO v_referral_id, v_referrer_id, v_rewards_granted
  FROM referrals
  WHERE referee_id = p_referee_id
    AND status = 'pending'
  LIMIT 1;

  -- No pending referral found
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No pending referral');
  END IF;

  -- Check if this is referee's first completed trade
  IF EXISTS(
    SELECT 1 FROM trades
    WHERE (buyer_id = p_referee_id OR seller_id = p_referee_id)
      AND status = 'completed'
      AND id != p_trade_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Not first trade');
  END IF;

  -- Get subscription status for both users
  SELECT status INTO v_referrer_subscription_status
  FROM subscriptions
  WHERE user_id = v_referrer_id
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT status INTO v_referee_subscription_status
  FROM subscriptions
  WHERE user_id = p_referee_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Verify both users have trial or active subscription
  IF v_referrer_subscription_status NOT IN ('trial', 'active') OR
     v_referee_subscription_status NOT IN ('trial', 'active') THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Both users must have active subscription',
      'referrer_status', v_referrer_subscription_status,
      'referee_status', v_referee_subscription_status
    );
  END IF;

  -- Grant SP to referrer (25 SP)
  INSERT INTO sp_ledger (user_id, amount, reason, trade_id)
  VALUES (v_referrer_id, 25, 'referral_bonus', p_trade_id);

  -- Update referrer's wallet balance
  UPDATE sp_wallets
  SET balance = balance + 25,
      total_earned = total_earned + 25,
      updated_at = now()
  WHERE user_id = v_referrer_id;

  -- Grant SP to referee (10 SP)
  INSERT INTO sp_ledger (user_id, amount, reason, trade_id)
  VALUES (p_referee_id, 10, 'referral_bonus', p_trade_id);

  -- Update referee's wallet balance
  UPDATE sp_wallets
  SET balance = balance + 10,
      total_earned = total_earned + 10,
      updated_at = now()
  WHERE user_id = p_referee_id;

  -- Update referral status to completed
  UPDATE referrals
  SET status = 'completed',
      reward_granted_at = now(),
      completed_at = now()
  WHERE id = v_referral_id;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'referee_id', p_referee_id,
    'referrer_sp', 25,
    'referee_sp', 10
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Grant referral rewards when trade completes
CREATE OR REPLACE FUNCTION trigger_referral_rewards()
RETURNS TRIGGER AS $$
DECLARE
  v_referee_id UUID;
  v_result JSONB;
BEGIN
  -- Only trigger on status change to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Check if buyer is a referee
    SELECT buyer_id INTO v_referee_id
    FROM trades
    WHERE id = NEW.id
      AND EXISTS(SELECT 1 FROM referrals WHERE referee_id = NEW.buyer_id AND status = 'pending');

    IF v_referee_id IS NOT NULL THEN
      PERFORM grant_referral_rewards(v_referee_id, NEW.id);
      RETURN NEW;
    END IF;

    -- Check if seller is a referee
    SELECT seller_id INTO v_referee_id
    FROM trades
    WHERE id = NEW.id
      AND EXISTS(SELECT 1 FROM referrals WHERE referee_id = NEW.seller_id AND status = 'pending');

    IF v_referee_id IS NOT NULL THEN
      PERFORM grant_referral_rewards(v_referee_id, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER grant_referral_rewards_trigger
AFTER UPDATE ON trades
FOR EACH ROW
EXECUTE FUNCTION trigger_referral_rewards();

/*
==================================================
FILE 2: Referral rewards service
==================================================
*/

// filepath: src/services/referralRewards.ts

import { supabase } from '@/lib/supabase';

export class ReferralRewardsService {
  /**
   * Manually grant referral rewards (admin function)
   */
  static async grantRewards(
    refereeId: string,
    tradeId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('grant_referral_rewards', {
      p_referee_id: refereeId,
      p_trade_id: tradeId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.success) {
      return { success: false, error: data.reason };
    }

    return { success: true };
  }

  /**
   * Check if user is eligible for referral rewards
   */
  static async checkEligibility(userId: string): Promise<{
    is_referee: boolean;
    referrer_id: string | null;
    rewards_pending: boolean;
  }> {
    const { data, error } = await supabase
      .from('referrals')
      .select('referrer_id, status')
      .eq('referee_id', userId)
      .eq('status', 'pending')
      .limit(1)
      .single();

    if (error || !data) {
      return {
        is_referee: false,
        referrer_id: null,
        rewards_pending: false,
      };
    }

    return {
      is_referee: true,
      referrer_id: data.referrer_id,
      rewards_pending: true,
    };
  }
}
```

### Testing Checklist
- [ ] SP rewards granted when referee completes first trade
- [ ] Referrer receives 25 SP
- [ ] Referee receives 10 SP
- [ ] SP ledger entries created with reason 'referral_bonus'
- [ ] SP wallets updated correctly (balance, total_earned)
- [ ] Referral status updated to 'completed'
- [ ] Rewards NOT granted if referrer subscription expired
- [ ] Rewards NOT granted if referee subscription expired
- [ ] Rewards NOT granted on referee's second trade (idempotent)
- [ ] Rewards NOT granted if no referral relationship exists

### Deployment Notes
1. Run migration 171_referral_rewards.sql
2. Test trigger on trade status change
3. Verify subscription status checks work correctly
4. Monitor SP ledger for referral_bonus entries

---

## TASK REF-V2-003: Trial Extension on Successful Referral

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** MODULE-11 (Subscriptions)

### Description
Extend trial period by 7 days when referee completes first trade. Maximum 3 extensions per user (21 days total). Only applies to users still in trial (not paid subscriptions). Track extensions used in subscription metadata.

### Acceptance Criteria
- [ ] Trial extended by 7 days when referee completes first trade
- [ ] Trial extension only applies to users with status 'trial'
- [ ] Maximum 3 extensions per user enforced
- [ ] Extensions tracked in `referral_extensions_used` counter
- [ ] Extension applied simultaneously with SP rewards

---

### AI Prompt for Cursor

```typescript
/*
TASK: Trial extension on successful referral

CONTEXT:
When referee completes first trade, extend referrer's trial by 7 days (if still in trial).
Maximum 3 extensions = 21 days total.

TRIAL EXTENSION LOGIC:
- Only applies if referrer's subscription status = 'trial'
- Does NOT apply to 'active' (paid) subscriptions
- Extends trial_end_date by 7 days
- Increments referral_extensions_used counter
- Max 3 extensions per user

TIMING:
- Applied in same transaction as SP rewards (grant_referral_rewards RPC)
- Only applied if SP rewards successfully granted

==================================================
FILE 1: Add trial extension to subscriptions table
==================================================
*/

-- filepath: supabase/migrations/172_trial_extension.sql

-- Add referral extension tracking to subscriptions table
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS referral_extensions_used INT DEFAULT 0,
ADD CONSTRAINT max_referral_extensions CHECK (referral_extensions_used <= 3);

-- Update grant_referral_rewards to include trial extension
CREATE OR REPLACE FUNCTION grant_referral_rewards(
  p_referee_id UUID,
  p_trade_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_id UUID;
  v_referrer_subscription_status subscription_status;
  v_referee_subscription_status subscription_status;
  v_referrer_subscription_id UUID;
  v_current_extensions INT;
  v_trial_extended BOOLEAN DEFAULT false;
BEGIN
  -- Get referral relationship
  SELECT id, referrer_id
  INTO v_referral_id, v_referrer_id
  FROM referrals
  WHERE referee_id = p_referee_id
    AND status = 'pending'
  LIMIT 1;

  -- No pending referral found
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No pending referral');
  END IF;

  -- Check if this is referee's first completed trade
  IF EXISTS(
    SELECT 1 FROM trades
    WHERE (buyer_id = p_referee_id OR seller_id = p_referee_id)
      AND status = 'completed'
      AND id != p_trade_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Not first trade');
  END IF;

  -- Get subscription status for both users
  SELECT id, status, referral_extensions_used
  INTO v_referrer_subscription_id, v_referrer_subscription_status, v_current_extensions
  FROM subscriptions
  WHERE user_id = v_referrer_id
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT status INTO v_referee_subscription_status
  FROM subscriptions
  WHERE user_id = p_referee_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Verify both users have trial or active subscription
  IF v_referrer_subscription_status NOT IN ('trial', 'active') OR
     v_referee_subscription_status NOT IN ('trial', 'active') THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Both users must have active subscription'
    );
  END IF;

  -- Grant SP to referrer (25 SP)
  INSERT INTO sp_ledger (user_id, amount, reason, trade_id)
  VALUES (v_referrer_id, 25, 'referral_bonus', p_trade_id);

  UPDATE sp_wallets
  SET balance = balance + 25,
      total_earned = total_earned + 25,
      updated_at = now()
  WHERE user_id = v_referrer_id;

  -- Grant SP to referee (10 SP)
  INSERT INTO sp_ledger (user_id, amount, reason, trade_id)
  VALUES (p_referee_id, 10, 'referral_bonus', p_trade_id);

  UPDATE sp_wallets
  SET balance = balance + 10,
      total_earned = total_earned + 10,
      updated_at = now()
  WHERE user_id = p_referee_id;

  -- Extend trial if applicable
  IF v_referrer_subscription_status = 'trial' AND v_current_extensions < 3 THEN
    UPDATE subscriptions
    SET trial_end_date = trial_end_date + INTERVAL '7 days',
        referral_extensions_used = referral_extensions_used + 1,
        updated_at = now()
    WHERE id = v_referrer_subscription_id;

    v_trial_extended := true;

    -- Mark trial extension in referral record
    UPDATE referrals
    SET trial_extension_applied = true
    WHERE id = v_referral_id;
  END IF;

  -- Update referral status to completed
  UPDATE referrals
  SET status = 'completed',
      reward_granted_at = now(),
      completed_at = now()
  WHERE id = v_referral_id;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_sp', 25,
    'referee_sp', 10,
    'trial_extended', v_trial_extended,
    'extensions_used', COALESCE(v_current_extensions, 0) + (CASE WHEN v_trial_extended THEN 1 ELSE 0 END)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 2: Trial extension service
==================================================
*/

// filepath: src/services/trialExtension.ts

import { supabase } from '@/lib/supabase';

export class TrialExtensionService {
  /**
   * Get trial extension status for user
   */
  static async getExtensionStatus(userId: string): Promise<{
    extensions_used: number;
    extensions_remaining: number;
    max_extensions: number;
  }> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('referral_extensions_used')
      .eq('user_id', userId)
      .eq('status', 'trial')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return {
        extensions_used: 0,
        extensions_remaining: 3,
        max_extensions: 3,
      };
    }

    const extensions_used = data.referral_extensions_used || 0;

    return {
      extensions_used,
      extensions_remaining: Math.max(0, 3 - extensions_used),
      max_extensions: 3,
    };
  }

  /**
   * Check if user can receive trial extension
   */
  static async canExtendTrial(userId: string): Promise<boolean> {
    const status = await this.getExtensionStatus(userId);
    return status.extensions_remaining > 0;
  }
}
```

### Testing Checklist
- [ ] Trial extended by 7 days when referee completes first trade
- [ ] Trial extension only applied if referrer has status 'trial'
- [ ] Trial extension NOT applied if referrer has status 'active'
- [ ] Trial extension NOT applied if referrer already has 3 extensions
- [ ] Extensions counter incremented correctly (0 → 1 → 2 → 3)
- [ ] trial_end_date updated correctly (+7 days)
- [ ] trial_extension_applied flag set to true in referrals table
- [ ] SP rewards and trial extension applied in same transaction

### Deployment Notes
1. Run migration 172_trial_extension.sql
2. Test trial extension on successful referral
3. Verify max 3 extensions constraint enforced
4. Monitor subscription trial_end_date changes

---

## TASK REF-V2-004: Referral Dashboard & Sharing UI

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** REF-V2-001

### Description
Create referral dashboard showing invite stats, shareable link, and referral history. Display total referrals, pending/completed status, SP earned from referrals. Implement share functionality for referral link (native share API). Show trial extensions earned.

### Acceptance Criteria
- [ ] Referral dashboard displays user's referral code and shareable link
- [ ] Share button opens native share sheet
- [ ] Statistics show total/pending/completed referrals
- [ ] Statistics show total SP earned from referrals
- [ ] Statistics show trial extensions earned
- [ ] Referral history list shows each referral with status
- [ ] Empty state displayed when no referrals yet

---

### AI Prompt for Cursor

```typescript
/*
TASK: Referral dashboard and sharing UI

CONTEXT:
Central location for users to:
- View their referral code
- Share referral link
- See referral statistics
- View referral history

FEATURES:
- Display referral code prominently
- Copy referral code button
- Share referral link (native share API)
- Statistics cards (total referrals, SP earned, trial extensions)
- Referral history list (referee, status, date)

==================================================
FILE 1: Referral dashboard UI
==================================================
*/

// filepath: src/screens/ReferralDashboardScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Share,
  Clipboard,
  StyleSheet,
  Alert,
} from 'react-native';
import { ReferralCodeService } from '@/services/referralCode';
import { TrialExtensionService } from '@/services/trialExtension';
import { supabase } from '@/lib/supabase';

interface ReferralStats {
  total_referrals: number;
  pending_referrals: number;
  completed_referrals: number;
  total_sp_earned: number;
}

interface ReferralHistory {
  id: string;
  referee_id: string;
  status: 'pending' | 'completed' | 'expired';
  trial_extension_applied: boolean;
  created_at: string;
  completed_at: string | null;
  referee_email?: string;
}

export const ReferralDashboardScreen: React.FC<{ userId: string }> = ({ userId }) => {
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState<ReferralStats>({
    total_referrals: 0,
    pending_referrals: 0,
    completed_referrals: 0,
    total_sp_earned: 0,
  });
  const [extensionStatus, setExtensionStatus] = useState({
    extensions_used: 0,
    extensions_remaining: 3,
  });
  const [history, setHistory] = useState<ReferralHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReferralData();
  }, [userId]);

  const loadReferralData = async () => {
    try {
      // Get referral code
      const code = await ReferralCodeService.getReferralCode(userId);
      setReferralCode(code || '');

      // Get referral stats
      const statsData = await ReferralCodeService.getReferralStats(userId);
      setStats(statsData);

      // Get trial extension status
      const extStatus = await TrialExtensionService.getExtensionStatus(userId);
      setExtensionStatus(extStatus);

      // Get referral history
      const { data: historyData } = await supabase
        .from('referrals')
        .select(`
          id,
          referee_id,
          status,
          trial_extension_applied,
          created_at,
          completed_at
        `)
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      setHistory(historyData || []);
    } catch (err) {
      console.error('Failed to load referral data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    Clipboard.setString(referralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard');
  };

  const handleShareLink = async () => {
    const link = ReferralCodeService.getReferralLink(referralCode);
    const message = `Join Kids Club+ and get 10 SP when you complete your first trade! Use my referral code: ${referralCode}\n\n${link}`;

    try {
      await Share.share({
        message,
        title: 'Join Kids Club+',
      });
    } catch (err) {
      console.error('Failed to share:', err);
    }
  };

  const renderReferralItem = ({ item }: { item: ReferralHistory }) => (
    <View style={styles.referralItem}>
      <View style={styles.referralInfo}>
        <Text style={styles.referralId}>User #{item.referee_id.slice(0, 8)}</Text>
        <Text style={styles.referralDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.referralStatus}>
        <Text
          style={[
            styles.statusBadge,
            item.status === 'completed' && styles.statusCompleted,
            item.status === 'pending' && styles.statusPending,
          ]}
        >
          {item.status.toUpperCase()}
        </Text>
        {item.trial_extension_applied && (
          <Text style={styles.extensionBadge}>+7 days</Text>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Refer Friends, Earn Rewards!</Text>
        <Text style={styles.subtitle}>
          Invite friends and earn 25 SP when they complete their first trade
        </Text>
      </View>

      {/* Referral Code Card */}
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Your Referral Code</Text>
        <Text style={styles.code}>{referralCode}</Text>
        <View style={styles.codeActions}>
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
            <Text style={styles.copyButtonText}>Copy Code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={handleShareLink}>
            <Text style={styles.shareButtonText}>Share Link</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total_referrals}</Text>
          <Text style={styles.statLabel}>Total Referrals</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.completed_referrals}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total_sp_earned} SP</Text>
          <Text style={styles.statLabel}>SP Earned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {extensionStatus.extensions_used} / 3
          </Text>
          <Text style={styles.statLabel}>Trial Extensions</Text>
        </View>
      </View>

      {/* Referral History */}
      <View style={styles.historyContainer}>
        <Text style={styles.historyTitle}>Referral History</Text>
        <FlatList
          data={history}
          renderItem={renderReferralItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No referrals yet. Share your code to get started!
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  codeCard: {
    margin: 16,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  codeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  code: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 16,
    color: '#2196F3',
  },
  codeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  copyButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  copyButtonText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  shareButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  shareButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  historyContainer: {
    flex: 1,
    padding: 16,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  referralItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
  },
  referralInfo: {
    flex: 1,
  },
  referralId: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  referralDate: {
    fontSize: 12,
    color: '#666',
  },
  referralStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusCompleted: {
    backgroundColor: '#c8e6c9',
    color: '#2e7d32',
  },
  statusPending: {
    backgroundColor: '#fff9c4',
    color: '#f57f17',
  },
  extensionBadge: {
    fontSize: 10,
    color: '#2196F3',
    marginTop: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
```

### Testing Checklist
- [ ] Referral code displayed correctly
- [ ] Copy code button copies to clipboard
- [ ] Share link opens native share sheet
- [ ] Share message includes referral code and deep link
- [ ] Total referrals count correct
- [ ] Completed referrals count correct
- [ ] SP earned calculation correct (25 SP per completed referral)
- [ ] Trial extensions count correct
- [ ] Referral history displays all referrals
- [ ] Referral status badges display correctly (pending/completed)
- [ ] Trial extension badge shows "+7 days" when applicable
- [ ] Empty state displayed when no referrals

### Deployment Notes
1. Test native share API on iOS and Android
2. Verify deep links work from share message
3. Test clipboard functionality
4. Ensure referral stats update in real-time

---

## TASK REF-V2-005: Referral Notifications

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** MODULE-14 (Notifications)

### Description
Send notifications for referral events: invite accepted (referee signs up), first trade completed, SP rewards granted. Create notification templates for each event. Integrate with notification preferences system.

### Acceptance Criteria
- [ ] Notification sent when referee signs up with referral code
- [ ] Notification sent when referee completes first trade
- [ ] Notification sent when SP rewards granted
- [ ] Notifications include deep links to referral dashboard
- [ ] Notifications respect user preferences

---

### AI Prompt for Cursor

```typescript
/*
TASK: Referral event notifications

CONTEXT:
Notify referrer about referral progress:
1. Invite accepted: Referee signed up with code
2. First trade completed: Referee completed first trade
3. Rewards granted: SP rewards and trial extension applied

NOTIFICATION TYPES:
- Category: 'system'
- Channels: push, in_app
- Deep link: Referral dashboard screen

==================================================
FILE 1: Referral notification triggers
==================================================
*/

-- filepath: supabase/migrations/173_referral_notifications.sql

-- Notification: Invite accepted
CREATE OR REPLACE FUNCTION send_referral_invite_accepted_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify referrer that their invite was accepted
  INSERT INTO notifications (
    user_id,
    category,
    type,
    title,
    body,
    channels,
    data
  )
  VALUES (
    NEW.referrer_id,
    'system',
    'referral_invite_accepted',
    'Your Invite Was Accepted!',
    'Someone just signed up using your referral code. They''ll earn you 25 SP when they complete their first trade!',
    ARRAY['push', 'in_app'],
    jsonb_build_object(
      'deep_link', 'referral_dashboard',
      'referral_id', NEW.id,
      'referee_id', NEW.referee_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referral_invite_accepted_trigger
AFTER INSERT ON referrals
FOR EACH ROW
EXECUTE FUNCTION send_referral_invite_accepted_notification();

-- Notification: Rewards granted
CREATE OR REPLACE FUNCTION send_referral_rewards_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_id UUID;
  v_trial_extended BOOLEAN;
BEGIN
  -- Only trigger on status change to 'completed'
  IF NEW.status = 'completed' AND OLD.status = 'pending' THEN
    v_referrer_id := NEW.referrer_id;
    v_trial_extended := NEW.trial_extension_applied;

    -- Notify referrer
    INSERT INTO notifications (
      user_id,
      category,
      type,
      title,
      body,
      channels,
      data
    )
    VALUES (
      v_referrer_id,
      'system',
      'referral_rewards_granted',
      'You Earned 25 SP!',
      CASE
        WHEN v_trial_extended THEN 'Your referral completed their first trade! You earned 25 SP and 7 extra trial days.'
        ELSE 'Your referral completed their first trade! You earned 25 SP.'
      END,
      ARRAY['push', 'in_app'],
      jsonb_build_object(
        'deep_link', 'referral_dashboard',
        'sp_earned', 25,
        'trial_extended', v_trial_extended
      )
    );

    -- Notify referee
    INSERT INTO notifications (
      user_id,
      category,
      type,
      title,
      body,
      channels,
      data
    )
    VALUES (
      NEW.referee_id,
      'system',
      'referral_welcome_bonus',
      'Welcome Bonus: 10 SP!',
      'You completed your first trade and earned a welcome bonus of 10 SP!',
      ARRAY['push', 'in_app'],
      jsonb_build_object(
        'deep_link', 'sp_wallet'
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referral_rewards_notification_trigger
AFTER UPDATE ON referrals
FOR EACH ROW
EXECUTE FUNCTION send_referral_rewards_notification();

/*
==================================================
FILE 2: Referral notification service
==================================================
*/

// filepath: src/services/referralNotifications.ts

import { supabase } from '@/lib/supabase';

export class ReferralNotificationService {
  /**
   * Send custom referral notification
   */
  static async sendCustomNotification(
    userId: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      category: 'system',
      type: 'referral_custom',
      title,
      body,
      channels: ['push', 'in_app'],
      data: {
        deep_link: 'referral_dashboard',
        ...data,
      },
    });

    if (error) {
      console.error('Failed to send referral notification:', error);
    }
  }
}
```

### Testing Checklist
- [ ] Notification sent when referee signs up
- [ ] Notification sent when rewards granted
- [ ] Notification includes correct SP amount (25 SP for referrer, 10 SP for referee)
- [ ] Notification mentions trial extension when applicable
- [ ] Deep link navigates to referral dashboard
- [ ] Notifications respect user preferences
- [ ] Push notifications delivered correctly
- [ ] In-app notifications displayed correctly

### Deployment Notes
1. Run migration 173_referral_notifications.sql
2. Test notification triggers on referral events
3. Verify deep links work from notifications

---

## TASK REF-V2-006: Admin Referral Analytics

**Duration:** 2.5 hours  
**Priority:** Low  
**Dependencies:** MODULE-12 (Admin Panel)

### Description
Create admin analytics dashboard for referral program. Display K-factor, viral coefficient, conversion funnel (signups → first trades → rewards granted). Show top referrers leaderboard. Track referral SP distribution over time.

### Acceptance Criteria
- [ ] K-factor calculation (average referrals per user)
- [ ] Viral coefficient calculation (growth rate from referrals)
- [ ] Conversion funnel (signups → first trades → completed rewards)
- [ ] Top referrers leaderboard (most completed referrals)
- [ ] Referral SP distribution chart (total SP granted via referrals)
- [ ] Admin can view individual user's referral history

---

### AI Prompt for Cursor

```typescript
/*
TASK: Admin referral analytics

CONTEXT:
Admin dashboard for monitoring referral program performance.
Track key metrics: K-factor, viral coefficient, conversion rates.

METRICS:
- K-factor: Average completed referrals per user
- Viral coefficient: (new users via referrals) / (total new users)
- Conversion funnel: Invite accepted → First trade → Rewards granted
- Top referrers: Users with most completed referrals
- SP distribution: Total SP granted via referral bonuses

==================================================
FILE 1: Admin referral analytics RPCs
==================================================
*/

-- filepath: supabase/migrations/174_admin_referral_analytics.sql

-- RPC: Get referral program metrics
CREATE OR REPLACE FUNCTION get_referral_metrics()
RETURNS JSONB AS $$
DECLARE
  v_total_users INT;
  v_users_with_referrals INT;
  v_total_referrals INT;
  v_completed_referrals INT;
  v_k_factor NUMERIC;
  v_signup_to_trade_rate NUMERIC;
  v_total_sp_distributed INT;
BEGIN
  -- Total users
  SELECT COUNT(*) INTO v_total_users FROM users;

  -- Users who have made referrals
  SELECT COUNT(DISTINCT referrer_id) INTO v_users_with_referrals FROM referrals;

  -- Total referrals (all statuses)
  SELECT COUNT(*) INTO v_total_referrals FROM referrals;

  -- Completed referrals
  SELECT COUNT(*) INTO v_completed_referrals FROM referrals WHERE status = 'completed';

  -- K-factor: Average completed referrals per user
  IF v_users_with_referrals > 0 THEN
    v_k_factor := v_completed_referrals::NUMERIC / v_users_with_referrals::NUMERIC;
  ELSE
    v_k_factor := 0;
  END IF;

  -- Signup to first trade conversion rate
  IF v_total_referrals > 0 THEN
    v_signup_to_trade_rate := (v_completed_referrals::NUMERIC / v_total_referrals::NUMERIC) * 100;
  ELSE
    v_signup_to_trade_rate := 0;
  END IF;

  -- Total SP distributed via referrals
  -- Referrer gets 25 SP, referee gets 10 SP = 35 SP per completed referral
  v_total_sp_distributed := v_completed_referrals * 35;

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'users_with_referrals', v_users_with_referrals,
    'total_referrals', v_total_referrals,
    'pending_referrals', v_total_referrals - v_completed_referrals,
    'completed_referrals', v_completed_referrals,
    'k_factor', ROUND(v_k_factor, 2),
    'signup_to_trade_rate', ROUND(v_signup_to_trade_rate, 2),
    'total_sp_distributed', v_total_sp_distributed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get top referrers leaderboard
CREATE OR REPLACE FUNCTION get_top_referrers(p_limit INT DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  total_referrals INT,
  completed_referrals INT,
  total_sp_earned INT,
  trial_extensions_earned INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email,
    COUNT(r.id)::INT AS total_referrals,
    COUNT(r.id) FILTER (WHERE r.status = 'completed')::INT AS completed_referrals,
    (COUNT(r.id) FILTER (WHERE r.status = 'completed') * 25)::INT AS total_sp_earned,
    COUNT(r.id) FILTER (WHERE r.trial_extension_applied = true)::INT AS trial_extensions_earned
  FROM users u
  LEFT JOIN referrals r ON u.id = r.referrer_id
  GROUP BY u.id, u.email
  HAVING COUNT(r.id) > 0
  ORDER BY completed_referrals DESC, total_referrals DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get referral conversion funnel
CREATE OR REPLACE FUNCTION get_referral_funnel()
RETURNS JSONB AS $$
DECLARE
  v_invites_sent INT;
  v_signups INT;
  v_first_trades INT;
  v_rewards_granted INT;
BEGIN
  -- Invites sent (total referrals created)
  SELECT COUNT(*) INTO v_invites_sent FROM referrals;

  -- Signups (all referrals, since referral row created on signup)
  v_signups := v_invites_sent;

  -- First trades completed (referrals with status 'completed')
  SELECT COUNT(*) INTO v_first_trades FROM referrals WHERE status = 'completed';

  -- Rewards granted (same as completed referrals)
  v_rewards_granted := v_first_trades;

  RETURN jsonb_build_object(
    'invites_sent', v_invites_sent,
    'signups', v_signups,
    'first_trades', v_first_trades,
    'rewards_granted', v_rewards_granted,
    'signup_rate', CASE WHEN v_invites_sent > 0 THEN ROUND((v_signups::NUMERIC / v_invites_sent::NUMERIC) * 100, 2) ELSE 0 END,
    'trade_rate', CASE WHEN v_signups > 0 THEN ROUND((v_first_trades::NUMERIC / v_signups::NUMERIC) * 100, 2) ELSE 0 END,
    'reward_rate', CASE WHEN v_first_trades > 0 THEN ROUND((v_rewards_granted::NUMERIC / v_first_trades::NUMERIC) * 100, 2) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 2: Admin referral analytics service
==================================================
*/

// filepath: src/services/admin/adminReferralAnalytics.ts

import { supabase } from '@/lib/supabase';

export interface ReferralMetrics {
  total_users: number;
  users_with_referrals: number;
  total_referrals: number;
  pending_referrals: number;
  completed_referrals: number;
  k_factor: number;
  signup_to_trade_rate: number;
  total_sp_distributed: number;
}

export interface TopReferrer {
  user_id: string;
  email: string;
  total_referrals: number;
  completed_referrals: number;
  total_sp_earned: number;
  trial_extensions_earned: number;
}

export interface ReferralFunnel {
  invites_sent: number;
  signups: number;
  first_trades: number;
  rewards_granted: number;
  signup_rate: number;
  trade_rate: number;
  reward_rate: number;
}

export class AdminReferralAnalyticsService {
  /**
   * Get referral program metrics
   */
  static async getMetrics(): Promise<ReferralMetrics> {
    const { data, error } = await supabase.rpc('get_referral_metrics');

    if (error) {
      throw new Error(`Failed to get referral metrics: ${error.message}`);
    }

    return data;
  }

  /**
   * Get top referrers leaderboard
   */
  static async getTopReferrers(limit: number = 10): Promise<TopReferrer[]> {
    const { data, error } = await supabase.rpc('get_top_referrers', {
      p_limit: limit,
    });

    if (error) {
      throw new Error(`Failed to get top referrers: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get referral conversion funnel
   */
  static async getFunnel(): Promise<ReferralFunnel> {
    const { data, error } = await supabase.rpc('get_referral_funnel');

    if (error) {
      throw new Error(`Failed to get referral funnel: ${error.message}`);
    }

    return data;
  }
}

/*
==================================================
FILE 3: Admin referral dashboard UI
==================================================
*/

// filepath: src/screens/admin/AdminReferralDashboard.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { AdminReferralAnalyticsService } from '@/services/admin/adminReferralAnalytics';
import type { ReferralMetrics, TopReferrer, ReferralFunnel } from '@/services/admin/adminReferralAnalytics';

export const AdminReferralDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<ReferralMetrics | null>(null);
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([]);
  const [funnel, setFunnel] = useState<ReferralFunnel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [metricsData, referrersData, funnelData] = await Promise.all([
        AdminReferralAnalyticsService.getMetrics(),
        AdminReferralAnalyticsService.getTopReferrers(10),
        AdminReferralAnalyticsService.getFunnel(),
      ]);

      setMetrics(metricsData);
      setTopReferrers(referrersData);
      setFunnel(funnelData);
    } catch (err) {
      console.error('Failed to load referral analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderTopReferrer = ({ item, index }: { item: TopReferrer; index: number }) => (
    <View style={styles.referrerItem}>
      <Text style={styles.rank}>#{index + 1}</Text>
      <View style={styles.referrerInfo}>
        <Text style={styles.referrerEmail}>{item.email}</Text>
        <Text style={styles.referrerStats}>
          {item.completed_referrals} referrals • {item.total_sp_earned} SP earned
        </Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Referral Program Analytics</Text>

      {/* Key Metrics */}
      {metrics && (
        <View style={styles.metricsContainer}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.k_factor}</Text>
            <Text style={styles.metricLabel}>K-Factor</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.total_referrals}</Text>
            <Text style={styles.metricLabel}>Total Referrals</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.completed_referrals}</Text>
            <Text style={styles.metricLabel}>Completed</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.total_sp_distributed}</Text>
            <Text style={styles.metricLabel}>SP Distributed</Text>
          </View>
        </View>
      )}

      {/* Conversion Funnel */}
      {funnel && (
        <View style={styles.funnelContainer}>
          <Text style={styles.sectionTitle}>Conversion Funnel</Text>
          <View style={styles.funnelStep}>
            <Text style={styles.funnelLabel}>Signups</Text>
            <Text style={styles.funnelValue}>{funnel.signups}</Text>
            <Text style={styles.funnelRate}>100%</Text>
          </View>
          <View style={styles.funnelStep}>
            <Text style={styles.funnelLabel}>First Trades</Text>
            <Text style={styles.funnelValue}>{funnel.first_trades}</Text>
            <Text style={styles.funnelRate}>{funnel.trade_rate}%</Text>
          </View>
          <View style={styles.funnelStep}>
            <Text style={styles.funnelLabel}>Rewards Granted</Text>
            <Text style={styles.funnelValue}>{funnel.rewards_granted}</Text>
            <Text style={styles.funnelRate}>{funnel.reward_rate}%</Text>
          </View>
        </View>
      )}

      {/* Top Referrers */}
      <View style={styles.leaderboardContainer}>
        <Text style={styles.sectionTitle}>Top Referrers</Text>
        <FlatList
          data={topReferrers}
          renderItem={renderTopReferrer}
          keyExtractor={(item) => item.user_id}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
  },
  funnelContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  funnelStep: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  funnelLabel: {
    flex: 1,
    fontSize: 14,
  },
  funnelValue: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 16,
  },
  funnelRate: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  leaderboardContainer: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
  },
  referrerItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  rank: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 12,
    color: '#2196F3',
  },
  referrerInfo: {
    flex: 1,
  },
  referrerEmail: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  referrerStats: {
    fontSize: 12,
    color: '#666',
  },
});
```

### Testing Checklist
- [ ] K-factor calculation correct
- [ ] Total referrals count correct
- [ ] Completed referrals count correct
- [ ] SP distributed calculation correct (35 SP per completed referral)
- [ ] Conversion funnel percentages correct
- [ ] Top referrers leaderboard sorted correctly
- [ ] Admin can view analytics dashboard
- [ ] Analytics update in real-time

### Deployment Notes
1. Run migration 174_admin_referral_analytics.sql
2. Verify admin-only access to analytics RPCs
3. Test analytics calculations with sample data

---

## MODULE SUMMARY

### Total Tasks: 6
1. **REF-V2-001**: Referral code generation & storage ✅
2. **REF-V2-002**: SP bonus rewards on first trade ✅
3. **REF-V2-003**: Trial extension on successful referral ✅
4. **REF-V2-004**: Referral dashboard & sharing UI ✅
5. **REF-V2-005**: Referral notifications ✅
6. **REF-V2-006**: Admin referral analytics ✅

### Key Features Delivered
- **Unique Referral Codes**: 8-character alphanumeric codes with self-referral prevention
- **SP Bonus Rewards**: 25 SP for referrer, 10 SP for referee on first trade completion
- **Trial Extensions**: +7 days per successful referral (max 3 = 21 days total)
- **Referral Dashboard**: Share link, view stats (total/pending/completed, SP earned, trial extensions)
- **Referral Notifications**: Invite accepted, rewards granted, welcome bonus
- **Admin Analytics**: K-factor, viral coefficient, conversion funnel, top referrers leaderboard

### Cross-Module Integration
- **MODULE-11 (Subscriptions)**: Trial extension logic (trial_end_date + 7 days)
- **MODULE-09 (Swap Points)**: SP rewards ledger entries (referral_bonus reason)
- **MODULE-06 (Trade Flow)**: First trade completion trigger for rewards
- **MODULE-14 (Notifications)**: Referral event notifications
- **MODULE-03 (Authentication)**: Referral code capture on signup
- **MODULE-12 (Admin Panel)**: Referral analytics dashboard

### Business Impact
- **Viral Growth**: Incentivized referrals drive user acquisition
- **Quality Users**: First trade requirement ensures engaged users (not just signups)
- **Early Retention**: Trial extension keeps users engaged before payment
- **Network Effects**: More referrals → more SP circulation → stronger marketplace

### Privacy & Compliance
- Referral relationships stored securely (RLS policies)
- Self-referral prevention (email, user_id checks)
- No PII exposed in referral links
- Referral code cannot be changed after creation

### Performance Considerations
- Unique referral code generation with collision prevention
- Idempotent reward granting (status: pending → completed)
- Indexed queries for referral lookups (referrer_id, referee_id, status)
- Efficient analytics calculations (aggregated via RPCs)

### Next Steps
1. Implement referral expiration logic (e.g., referrals expire after 90 days if no trade)
2. Add referral tiers (e.g., 5 referrals = badge, 10 referrals = bonus SP)
3. Create referral leaderboard for users (gamification)
4. Add social media sharing templates (Twitter, Facebook, Instagram)
5. Build A/B testing for referral messaging
6. Implement fraud detection (suspicious referral patterns)

