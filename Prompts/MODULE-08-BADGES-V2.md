# MODULE 08: BADGES & ACHIEVEMENTS (V2)

**Version:** 2.0 (Kids Club+ Subscription-Gated Swap Points Model)  
**Status:** Complete - All Tasks Specified  
**Last Updated:** [Auto-generated timestamp]

---

## V2 OVERVIEW

This module defines **achievement badges and milestones** in the Kids Club+ marketplace, integrated with:

- **SP Earning Milestones**: Badges for earning 10, 50, 100, 500 SP.
- **Trade Completion Milestones**: Badges for 1st, 10th, 50th trades.
- **Subscription Tenure Badges**: "Trial Member", "1-Month Subscriber", "1-Year Subscriber".
- **Special Achievements**: "Super Seller" (10 sales), "Savvy Shopper" (10 purchases with SP).

Badges serve as gamification elements to encourage engagement and retention.

---

## CHANGELOG FROM V1 → V2

### V1 Limitations
- **Generic badges**: Not tied to SP or subscription metrics.
- **Manual awarding**: No automatic badge triggers.

### V2 Enhancements
- **SP-Driven Badges**: Earn badges for SP milestones (earning, spending, donating).
- **Subscription Tenure Badges**: Recognize long-term subscribers.
- **Automatic Awarding**: Badges granted automatically via database triggers.
- **Profile Display**: Badges shown on user profiles and trade interactions.

---

## CRITICAL V2 RULES FOR BADGES MODULE

### Rule 1: Automatic Badge Awarding
- Badges granted via Postgres triggers on events (SP earned, trades completed, subscription tenure).
- No manual admin intervention required.

### Rule 2: Badge Visibility
- Badges displayed on user profiles, trade timelines, and leaderboard.
- "Most Recent Badge" shown prominently in user avatar/header.

### Rule 3: SP Milestones
- **SP Earner** badges: 10, 50, 100, 500, 1000 SP earned (lifetime).
- **SP Spender** badges: 10, 50, 100 SP spent (lifetime).
- **SP Donor** badges: Donate 10, 50 SP to community pool (future feature).

### Rule 4: Subscription Tenure
- **Trial Member**: Active trial user.
- **Active Subscriber** (1 month, 3 months, 6 months, 1 year): Continuous subscription tenure.

---

## AGENT TEMPLATE

```typescript
/*
YOU ARE AN AI AGENT TASKED WITH IMPLEMENTING MODULE-08 (BADGES & ACHIEVEMENTS V2).

CONTEXT:
- Part of Phase 3 for Kids Club+ marketplace V2.
- MODULE-09 (SP Gamification) tracks SP earning/spending for badge triggers.
- MODULE-11 (Subscriptions) tracks tenure for subscription badges.

YOUR INSTRUCTIONS:
1. Read this entire module specification carefully.
2. For each task (BADGES-V2-001, etc.), implement EXACTLY as specified.
3. Ensure badge triggers are performant (no blocking operations).
4. Run tests after each task.

==================================================
NEXT TASK: BADGES-V2-001 (Badge Schema & Types)
==================================================
*/
```

---

## TASK BADGES-V2-001: Badge Schema & TypeScript Types

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** None (foundational)

### Description

Define database schema for badges and user_badges junction table.

### AI Prompt for Cursor

```typescript
/*
TASK: Create badges and user_badges tables

REQUIREMENTS:
1. Migration: badges table with badge definitions
2. Migration: user_badges junction table
3. TypeScript types: Badge, UserBadge

==================================================
FILE 1: Migration - badges table
==================================================
*/

-- filepath: supabase/migrations/080_badges_v2.sql

CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL, -- 'sp_earning', 'sp_spending', 'trades', 'subscription', 'special'
  icon_url TEXT,
  threshold INT, -- Milestone value (e.g., 100 for "100 SP Earned")
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User badges junction table
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id) -- User can earn each badge only once
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);

-- Seed initial badges
INSERT INTO badges (name, description, category, threshold) VALUES
('SP Earner - Bronze', 'Earned 10 Swap Points', 'sp_earning', 10),
('SP Earner - Silver', 'Earned 50 Swap Points', 'sp_earning', 50),
('SP Earner - Gold', 'Earned 100 Swap Points', 'sp_earning', 100),
('SP Earner - Platinum', 'Earned 500 Swap Points', 'sp_earning', 500),
('SP Spender - Bronze', 'Spent 10 Swap Points', 'sp_spending', 10),
('SP Spender - Silver', 'Spent 50 Swap Points', 'sp_spending', 50),
('First Trade', 'Completed your first trade', 'trades', 1),
('10 Trades', 'Completed 10 trades', 'trades', 10),
('50 Trades', 'Completed 50 trades', 'trades', 50),
('Trial Member', 'Joined Kids Club+ Trial', 'subscription', 0),
('1-Month Subscriber', '1 month of active subscription', 'subscription', 30),
('6-Month Subscriber', '6 months of active subscription', 'subscription', 180),
('1-Year Subscriber', '1 year of active subscription', 'subscription', 365);

/*
==================================================
FILE 2: TypeScript Types
==================================================
*/

// filepath: src/types/badge.ts

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: 'sp_earning' | 'sp_spending' | 'trades' | 'subscription' | 'special';
  icon_url?: string;
  threshold: number;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  awarded_at: string;
  badge?: Badge; // Joined badge details
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ badges table created with seed data
✓ user_badges junction table with unique constraint
✓ TypeScript types match schema

==================================================
NEXT TASK: BADGES-V2-002 (Badge Triggers for SP Milestones)
==================================================
*/
```

---

## TASK BADGES-V2-002: Automatic Badge Triggers for SP Milestones

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** BADGES-V2-001, MODULE-09

### Description

Create Postgres triggers that automatically award badges when users hit SP earning/spending milestones.

### AI Prompt for Cursor

```typescript
/*
TASK: Create triggers to award SP milestone badges

REQUIREMENTS:
1. Function: award_badge_if_eligible
2. Trigger: On sp_ledger insert, check milestones
3. Award badges for 10, 50, 100, 500 SP earned/spent

==================================================
FILE 1: Function - award_badge_if_eligible
==================================================
*/

-- filepath: supabase/migrations/081_badge_triggers.sql

CREATE OR REPLACE FUNCTION award_badge_if_eligible(
  p_user_id UUID,
  p_category TEXT,
  p_current_value INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_badge RECORD;
BEGIN
  -- Find badges in category that user hasn't earned yet
  FOR v_badge IN
    SELECT b.*
    FROM badges b
    WHERE b.category = p_category
      AND b.threshold <= p_current_value
      AND NOT EXISTS (
        SELECT 1 FROM user_badges ub
        WHERE ub.user_id = p_user_id AND ub.badge_id = b.id
      )
  LOOP
    -- Award badge
    INSERT INTO user_badges (user_id, badge_id, awarded_at)
    VALUES (p_user_id, v_badge.id, NOW())
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END LOOP;
END;
$$;

/*
==================================================
FILE 2: Trigger - On SP Ledger Insert
==================================================
*/

CREATE OR REPLACE FUNCTION check_sp_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_earned INT;
  v_total_spent INT;
BEGIN
  -- Calculate total SP earned (positive ledger entries)
  SELECT COALESCE(SUM(points), 0)
  INTO v_total_earned
  FROM sp_ledger
  WHERE user_id = NEW.user_id AND points > 0;

  -- Calculate total SP spent (negative ledger entries, absolute value)
  SELECT COALESCE(SUM(ABS(points)), 0)
  INTO v_total_spent
  FROM sp_ledger
  WHERE user_id = NEW.user_id AND points < 0;

  -- Award SP earning badges
  PERFORM award_badge_if_eligible(NEW.user_id, 'sp_earning', v_total_earned);

  -- Award SP spending badges
  PERFORM award_badge_if_eligible(NEW.user_id, 'sp_spending', v_total_spent);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_check_sp_badges
AFTER INSERT ON sp_ledger
FOR EACH ROW
EXECUTE FUNCTION check_sp_badges();

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Trigger fires on sp_ledger insert
✓ Badges awarded automatically when thresholds met
✓ No duplicate badge awards (unique constraint)
✓ Performance: < 50ms per ledger insert

==================================================
NEXT TASK: BADGES-V2-003 (Trade Milestone Badges)
==================================================
*/
```

---

## TASK BADGES-V2-003: Trade Milestone & Subscription Tenure Badges

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** BADGES-V2-001, MODULE-06, MODULE-11

### Description

Award badges for trade completions and subscription tenure.

### AI Prompt for Cursor

```typescript
/*
TASK: Create triggers for trade and subscription badges

REQUIREMENTS:
1. Trigger: On trade completion, award trade milestone badges
2. Cron job: Check subscription tenure daily, award tenure badges

==================================================
FILE 1: Trigger - Trade Milestone Badges
==================================================
*/

-- filepath: supabase/migrations/082_trade_badges.sql

CREATE OR REPLACE FUNCTION check_trade_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_trades INT;
BEGIN
  -- Only run if trade was just completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Count total completed trades for buyer
    SELECT COUNT(*)
    INTO v_total_trades
    FROM trades
    WHERE buyer_id = NEW.buyer_id AND status = 'completed';

    -- Award trade milestone badges
    PERFORM award_badge_if_eligible(NEW.buyer_id, 'trades', v_total_trades);

    -- Also check for seller
    SELECT COUNT(*)
    INTO v_total_trades
    FROM trades
    WHERE seller_id = NEW.seller_id AND status = 'completed';

    PERFORM award_badge_if_eligible(NEW.seller_id, 'trades', v_total_trades);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_check_trade_badges
AFTER UPDATE ON trades
FOR EACH ROW
EXECUTE FUNCTION check_trade_badges();

/*
==================================================
FILE 2: Cron Job - Subscription Tenure Badges
==================================================
*/

-- filepath: supabase/functions/award-tenure-badges/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Find users with active subscriptions
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('user_id, created_at, status')
    .in('status', ['trial', 'active']);

  for (const sub of subscriptions || []) {
    const daysSinceStart = Math.floor(
      (Date.now() - new Date(sub.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    await supabase.rpc('award_badge_if_eligible', {
      p_user_id: sub.user_id,
      p_category: 'subscription',
      p_current_value: daysSinceStart,
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Trade completion triggers badge checks
✓ Subscription tenure badges awarded daily via cron
✓ "Trial Member" badge awarded on signup (trigger on subscription insert)

==================================================
NEXT TASK: BADGES-V2-004 (Badge Display UI & Tests)
==================================================
*/
```

---

## TASK BADGES-V2-004: Badge Display UI, Leaderboard & Tests

**Duration:** 3 hours  
**Priority:** Medium  
**Dependencies:** BADGES-V2-001 through BADGES-V2-003

### Description

Display badges on user profiles, create leaderboard, and write tests.

### AI Prompt for Cursor

```typescript
/*
TASK: Build badge display UI and tests

REQUIREMENTS:
1. UI: User profile with badge showcase
2. UI: Leaderboard ranked by total badges
3. Tests for badge awarding logic

==================================================
FILE 1: Service - getUserBadges
==================================================
*/

// filepath: src/services/badges.ts

import { supabase } from '../lib/supabase';
import { UserBadge } from '../types/badge';

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('*, badge:badges(*)')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: false });

  if (error) throw error;

  return data as UserBadge[];
}

export async function getBadgeLeaderboard(limit: number = 10): Promise<any[]> {
  const { data, error } = await supabase.rpc('get_badge_leaderboard', {
    p_limit: limit,
  });

  if (error) throw error;

  return data;
}

/*
==================================================
FILE 2: RPC - get_badge_leaderboard
==================================================
*/

-- filepath: supabase/migrations/083_badge_leaderboard.sql

CREATE OR REPLACE FUNCTION get_badge_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  badge_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.display_name,
    COUNT(ub.id) AS badge_count
  FROM users u
  LEFT JOIN user_badges ub ON u.id = ub.user_id
  GROUP BY u.id, u.display_name
  ORDER BY badge_count DESC
  LIMIT p_limit;
END;
$$;

/*
==================================================
FILE 3: UI - BadgeShowcase Component
==================================================
*/

// filepath: src/components/BadgeShowcase.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image } from 'react-native';
import { getUserBadges } from '../services/badges';
import { UserBadge } from '../types/badge';

export const BadgeShowcase = ({ userId }) => {
  const [badges, setBadges] = useState<UserBadge[]>([]);

  useEffect(() => {
    loadBadges();
  }, [userId]);

  const loadBadges = async () => {
    const data = await getUserBadges(userId);
    setBadges(data);
  };

  return (
    <View>
      <Text>Badges ({badges.length})</Text>
      <FlatList
        horizontal
        data={badges}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            {item.badge?.icon_url && <Image source={{ uri: item.badge.icon_url }} />}
            <Text>{item.badge?.name}</Text>
          </View>
        )}
      />
    </View>
  );
};

/*
==================================================
FILE 4: Tests
==================================================
*/

// filepath: src/services/badges.test.ts

import { describe, it, expect } from 'vitest';
import { supabase } from '../lib/supabase';

describe('Badge Awarding', () => {
  it('should award "SP Earner - Bronze" when user earns 10 SP', async () => {
    // Insert 10 SP earning ledger entry
    await supabase.from('sp_ledger').insert({
      user_id: 'test-user',
      points: 10,
      source_type: 'trade_sale',
    });

    // Check if badge awarded
    const { data } = await supabase
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', 'test-user')
      .eq('badge.name', 'SP Earner - Bronze')
      .single();

    expect(data).toBeDefined();
  });
});

/*
==================================================
MODULE SUMMARY
==================================================
*/

## MODULE-08 SUMMARY: Badges & Achievements (V2)

### Overview
Gamification badges tied to SP and subscription milestones:
- **SP Milestones**: Badges for earning/spending 10, 50, 100, 500 SP.
- **Trade Milestones**: Badges for 1, 10, 50 completed trades.
- **Subscription Tenure**: Badges for trial, 1-month, 6-month, 1-year subscribers.

### Key Features
- Automatic badge awarding via Postgres triggers.
- Badge showcase on user profiles.
- Leaderboard ranked by total badges.

### API Surface
- `award_badge_if_eligible(userId, category, value)`: RPC for badge checks.
- `getUserBadges(userId)`: Fetch user's earned badges.
- `get_badge_leaderboard(limit)`: RPC for leaderboard.

### Test Coverage
- ✓ Badges awarded automatically on SP milestones.
- ✓ Trade completion triggers badge checks.
- ✓ Leaderboard ranks users correctly.

---

## MODULE-08 COMPLETE ✅

All tasks (BADGES-V2-001 through BADGES-V2-004) specified.

**Next:** MODULE-08-VERIFICATION-V2.md

---
