---

## Prompt Addendum: Feed/Swipe UX Resilience

### AI Prompt for Cursor (UX Resilience)
```typescript
/*
TASK: Harden feed/swipe UX against CDN/timeouts

REQUIREMENTS:
1. Image loading states: skeleton loaders and graceful fallbacks on CDN timeout.
2. Retry/backoff: exponential backoff for image fetches; cap retries; show placeholder.
3. Empty-state prompts: friendly guidance when no listings match filters; quick actions to widen radius or change child filters.
4. Perf budgets: target <1s for initial 20 items; lazy-load images; prefetch next cards.

FILES:
- src/screens/feed/FeedScreen.tsx (skeletons + empty state)
- src/components/ListingCard.tsx (image retry/backoff)
*/
```

### Acceptance Criteria
- Skeletons display during image loads
- Timeouts show placeholders without jank
- Empty states guide users to adjust filters
- Perf targets met in instrumentation

# MODULE 10: BADGES & TRUST

**Total Tasks:** 8  
**Estimated Time:** ~21 hours  
**Dependencies:** MODULE-02 (Authentication), MODULE-06 (Trade Flow)

---

### Agent-Optimized Prompt Template (Claude Sonnet 4.5)

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
```

---

## TASK BADGE-001: Implement Badge System (Levels: None, Bronze, Silver, Gold, Verified)

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** AUTH-001 (User authentication)

### Description
Create badge system with 5 levels: None, Bronze, Silver, Gold, Verified. Add `badge_level` column to users table. Create badge_config table for admin-defined thresholds. Display badge icon on user profile and item listings.

---

### AI Prompt for Cursor (Generate Badge System)

```typescript
/*
TASK: Implement badge system database schema

CONTEXT:
Badges build trust between users.
Levels: None → Bronze → Silver → Gold → Verified

REQUIREMENTS:
1. Add badge_level to users table
2. Create badge_config table for thresholds
3. Badge display icons
4. Automatic upgrade logic (based on trades/value)

==================================================
FILE 1: Database migration for badges
==================================================
*/

-- filepath: supabase/migrations/035_badges_system.sql

-- Badge level enum
CREATE TYPE badge_level AS ENUM ('none', 'bronze', 'silver', 'gold', 'verified');

-- Add badge to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_level badge_level DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_verification_method TEXT; -- 'auto', 'manual', 'identity_check'

CREATE INDEX users_badge_level_idx ON users(badge_level);

-- Badge configuration table
CREATE TABLE badge_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_level badge_level NOT NULL UNIQUE,
  min_trades INTEGER NOT NULL DEFAULT 0,
  min_trade_value INTEGER NOT NULL DEFAULT 0, -- In cents
  display_name TEXT NOT NULL,
  display_color TEXT NOT NULL, -- Hex color code
  icon_name TEXT NOT NULL, -- Icon identifier
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default badge config
INSERT INTO badge_config (badge_level, min_trades, min_trade_value, display_name, display_color, icon_name)
VALUES
  ('none', 0, 0, 'New User', '#9CA3AF', 'person-outline'),
  ('bronze', 3, 50000, 'Bronze', '#CD7F32', 'medal-outline'),
  ('silver', 10, 200000, 'Silver', '#C0C0C0', 'medal'),
  ('gold', 25, 500000, 'Gold', '#FFD700', 'trophy'),
  ('verified', 50, 1000000, 'Verified', '#10B981', 'shield-checkmark');

-- Auto-update trigger for updated_at
CREATE TRIGGER update_badge_config_updated_at
  BEFORE UPDATE ON badge_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Admin config for badge system
INSERT INTO admin_config (key, value, value_type, description)
VALUES
  ('badge_system_enabled', 'true', 'boolean', 'Enable/disable badge system'),
  ('auto_verification_enabled', 'true', 'boolean', 'Auto-upgrade badges based on thresholds')
ON CONFLICT (key) DO NOTHING;

-- Function to calculate user's eligible badge level
CREATE OR REPLACE FUNCTION calculate_badge_level(user_id_param UUID)
RETURNS badge_level AS $$
DECLARE
  total_trades INTEGER;
  total_value INTEGER;
  eligible_badge badge_level;
BEGIN
  -- Get user's trade stats
  SELECT
    COUNT(*),
    COALESCE(SUM(cash_amount + points_amount), 0)
  INTO total_trades, total_value
  FROM trades
  WHERE (buyer_id = user_id_param OR seller_id = user_id_param)
    AND status = 'completed';

  -- Find highest eligible badge
  SELECT badge_level INTO eligible_badge
  FROM badge_config
  WHERE min_trades <= total_trades
    AND min_trade_value <= total_value
  ORDER BY
    CASE badge_level
      WHEN 'verified' THEN 5
      WHEN 'gold' THEN 4
      WHEN 'silver' THEN 3
      WHEN 'bronze' THEN 2
      WHEN 'none' THEN 1
    END DESC
  LIMIT 1;

  RETURN COALESCE(eligible_badge, 'none');
END;
$$ LANGUAGE plpgsql;

-- RLS policies for badge_config
ALTER TABLE badge_config ENABLE ROW LEVEL SECURITY;

-- Anyone can view badge config
CREATE POLICY "Anyone can view badge config"
  ON badge_config FOR SELECT
  USING (true);

-- Only admins can update badge config
CREATE POLICY "Admins can update badge config"
  ON badge_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

/*
==================================================
FILE 2: Badge service
==================================================
*/

// filepath: src/services/badge.ts

import { createClient } from '@/lib/supabase';

export type BadgeLevel = 'none' | 'bronze' | 'silver' | 'gold' | 'verified';

export interface BadgeConfig {
  badge_level: BadgeLevel;
  min_trades: number;
  min_trade_value: number;
  display_name: string;
  display_color: string;
  icon_name: string;
}

export async function getBadgeConfig(): Promise<BadgeConfig[]> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('badge_config')
      .select('*')
      .order('min_trades', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Get badge config error:', error);
    return [];
  }
}

export async function getUserBadge(userId: string): Promise<BadgeLevel> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('users')
      .select('badge_level')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return (data?.badge_level as BadgeLevel) || 'none';
  } catch (error) {
    console.error('Get user badge error:', error);
    return 'none';
  }
}

export async function calculateEligibleBadge(userId: string): Promise<BadgeLevel> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.rpc('calculate_badge_level', {
      user_id_param: userId,
    });

    if (error) throw error;

    return (data as BadgeLevel) || 'none';
  } catch (error) {
    console.error('Calculate eligible badge error:', error);
    return 'none';
  }
}

export function getBadgeIcon(badgeLevel: BadgeLevel): string {
  const icons: Record<BadgeLevel, string> = {
    none: 'person-outline',
    bronze: 'medal-outline',
    silver: 'medal',
    gold: 'trophy',
    verified: 'shield-checkmark',
  };

  return icons[badgeLevel] || 'person-outline';
}

export function getBadgeColor(badgeLevel: BadgeLevel): string {
  const colors: Record<BadgeLevel, string> = {
    none: '#9CA3AF',
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    verified: '#10B981',
  };

  return colors[badgeLevel] || '#9CA3AF';
}

/*
==================================================
FILE 3: Badge display component
==================================================
*/

// filepath: src/components/BadgeIcon.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBadgeIcon, getBadgeColor, getUserBadge, BadgeLevel } from '@/services/badge';

interface BadgeIconProps {
  userId: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export function BadgeIcon({ userId, size = 'medium', showLabel = false }: BadgeIconProps) {
  const [badgeLevel, setBadgeLevel] = useState<BadgeLevel>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBadge();
  }, [userId]);

  const loadBadge = async () => {
    const badge = await getUserBadge(userId);
    setBadgeLevel(badge);
    setLoading(false);
  };

  if (loading || badgeLevel === 'none') {
    return null; // Don't show badge for 'none' level
  }

  const iconSize = size === 'small' ? 16 : size === 'medium' ? 24 : 32;
  const iconName = getBadgeIcon(badgeLevel);
  const iconColor = getBadgeColor(badgeLevel);

  const badgeLabels: Record<BadgeLevel, string> = {
    none: '',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    verified: 'Verified',
  };

  return (
    <View style={styles.container}>
      <Ionicons name={iconName as any} size={iconSize} color={iconColor} />
      {showLabel && (
        <Text style={[styles.label, { color: iconColor }]}>
          {badgeLabels[badgeLevel]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Badge levels defined (none, bronze, silver, gold, verified)
✓ badge_config table with thresholds
✓ calculate_badge_level() function
✓ Badge display component
✓ Badge icons and colors
✓ RLS policies for badge config

==================================================
NEXT TASK
==================================================

BADGE-002: Create admin UI to enable/disable badge system
*/
```

---

### Output Files

1. **supabase/migrations/035_badges_system.sql** - Badge schema and config
2. **src/services/badge.ts** - Badge service functions
3. **src/components/BadgeIcon.tsx** - Badge display component

---

### Testing Steps

1. **Test badge calculation:**
   - User with 0 trades → None badge
   - User with 3 trades → Bronze badge
   - User with 10 trades, $2000 value → Silver badge

2. **Test badge display:**
   - Badge icon shows correct color
   - Badge label displays correctly
   - None badge hidden (no icon shown)

3. **Test admin config:**
   - Fetch badge thresholds
   - Update thresholds (admin only)

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create badge schema migration | 60 min |
| Build calculate_badge_level function | 45 min |
| Create badge service | 45 min |
| Build BadgeIcon component | 30 min |
| **Total** | **~3 hours** |

---

## TASK BADGE-002: Create Admin UI to Enable/Disable Badge System

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** BADGE-001 (Badge system)

### Description
Admin panel to toggle badge system on/off. Update admin_config. When disabled, hide all badges from UI. Admin can also toggle auto-verification separately.

---

### AI Prompt for Cursor (Generate Badge Admin UI)

```typescript
/*
TASK: Create admin controls for badge system

REQUIREMENTS:
1. Toggle badge system on/off
2. Toggle auto-verification on/off
3. Save to admin_config
4. UI updates immediately

FILE: admin/app/settings/badges/page.tsx
- Badge system enabled toggle
- Auto-verification toggle
- Save button
*/
```

### Time Breakdown: **~2 hours**

---

## TASK BADGE-003: Create Admin UI to Set Badge Thresholds

**Duration:** 2.5 hours  
**Priority:** Medium  
**Dependencies:** BADGE-001 (Badge system)

### Description
Admin can configure badge thresholds. Edit min_trades and min_trade_value for each level. Update badge_config table. Preview changes before saving.

---

### AI Prompt for Cursor (Generate Badge Threshold Editor)

```typescript
/*
TASK: Create badge threshold configuration UI

REQUIREMENTS:
1. Display current thresholds for all badge levels
2. Edit min_trades and min_trade_value
3. Preview how many users qualify for each level
4. Save changes to badge_config
5. Trigger re-calculation for all users

==================================================
FILE: admin/app/settings/badges/thresholds/page.tsx
==================================================
*/

import React, { useState, useEffect } from 'react';

export default function BadgeThresholdsPage() {
  const [thresholds, setThresholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadThresholds();
  }, []);

  const loadThresholds = async () => {
    // Fetch from badge_config
    const response = await fetch('/api/admin/badge-config');
    const data = await response.json();
    setThresholds(data);
    setLoading(false);
  };

  const handleUpdate = async (badgeLevel: string, field: string, value: number) => {
    setThresholds((prev) =>
      prev.map((t) =>
        t.badge_level === badgeLevel ? { ...t, [field]: value } : t
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/admin/badge-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thresholds }),
    });
    setSaving(false);
    alert('Badge thresholds updated!');
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Badge Thresholds</h1>

      <table className="w-full border">
        <thead>
          <tr>
            <th>Badge Level</th>
            <th>Min Trades</th>
            <th>Min Trade Value</th>
            <th>Qualifying Users</th>
          </tr>
        </thead>
        <tbody>
          {thresholds.map((threshold) => (
            <tr key={threshold.badge_level}>
              <td>{threshold.display_name}</td>
              <td>
                <input
                  type="number"
                  value={threshold.min_trades}
                  onChange={(e) =>
                    handleUpdate(threshold.badge_level, 'min_trades', parseInt(e.target.value))
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  value={threshold.min_trade_value / 100}
                  onChange={(e) =>
                    handleUpdate(threshold.badge_level, 'min_trade_value', parseInt(e.target.value) * 100)
                  }
                />
              </td>
              <td>{threshold.qualifying_users || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Thresholds'}
      </button>
    </div>
  );
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Display all badge levels with current thresholds
✓ Edit min_trades and min_trade_value
✓ Show preview of qualifying users
✓ Save changes to badge_config
✓ Confirmation message on save

==================================================
NEXT TASK
==================================================

BADGE-004: Implement auto-verification logic
*/
```

### Time Breakdown: **~2.5 hours**

---

## TASK BADGE-004: Implement Auto-Verification Logic (Trigger on Trade Completion)

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** BADGE-001 (Badge system), TRADE-006 (Trade completion)

### Description
Automatically upgrade user badges when thresholds met. Trigger on trade completion. Check if user qualifies for higher badge. Update user's badge_level. Send notification on badge upgrade.

---

### AI Prompt for Cursor (Generate Auto-Verification)

```typescript
/*
TASK: Implement automatic badge upgrades

CONTEXT:
After each trade completion, check if user qualifies for badge upgrade.
Auto-upgrade if thresholds met.

REQUIREMENTS:
1. Trigger on trade completion
2. Calculate eligible badge for buyer and seller
3. Upgrade if higher than current
4. Send notification on upgrade
5. Log badge change

==================================================
FILE 1: Database trigger for auto-verification
==================================================
*/

-- filepath: supabase/migrations/036_auto_badge_verification.sql

-- Function to auto-upgrade badges after trade
CREATE OR REPLACE FUNCTION auto_upgrade_badges()
RETURNS TRIGGER AS $$
DECLARE
  auto_verification_enabled BOOLEAN;
  buyer_eligible_badge badge_level;
  seller_eligible_badge badge_level;
  buyer_current_badge badge_level;
  seller_current_badge badge_level;
BEGIN
  -- Only run if trade just completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    
    -- Check if auto-verification enabled
    SELECT CAST(value AS BOOLEAN) INTO auto_verification_enabled
    FROM admin_config WHERE key = 'auto_verification_enabled';

    IF auto_verification_enabled THEN
      
      -- Calculate eligible badges
      SELECT calculate_badge_level(NEW.buyer_id) INTO buyer_eligible_badge;
      SELECT calculate_badge_level(NEW.seller_id) INTO seller_eligible_badge;

      -- Get current badges
      SELECT badge_level INTO buyer_current_badge
      FROM users WHERE id = NEW.buyer_id;

      SELECT badge_level INTO seller_current_badge
      FROM users WHERE id = NEW.seller_id;

      -- Upgrade buyer if eligible
      IF buyer_eligible_badge > buyer_current_badge THEN
        UPDATE users
        SET badge_level = buyer_eligible_badge,
            badge_verified_at = NOW(),
            badge_verification_method = 'auto'
        WHERE id = NEW.buyer_id;

        -- TODO: Send notification to buyer
      END IF;

      -- Upgrade seller if eligible
      IF seller_eligible_badge > seller_current_badge THEN
        UPDATE users
        SET badge_level = seller_eligible_badge,
            badge_verified_at = NOW(),
            badge_verification_method = 'auto'
        WHERE id = NEW.seller_id;

        -- TODO: Send notification to seller
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on trade completion
CREATE TRIGGER on_trade_completion_badge_upgrade
  AFTER UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION auto_upgrade_badges();

/*
==================================================
FILE 2: Badge upgrade notification
==================================================
*/

// filepath: supabase/functions/send-badge-upgrade-notification/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const { userId, newBadge } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user details
    const { data: user } = await supabaseClient
      .from('users')
      .select('expo_push_token, first_name')
      .eq('id', userId)
      .single();

    if (!user) return new Response('User not found', { status: 404 });

    const badgeNames: Record<string, string> = {
      bronze: 'Bronze',
      silver: 'Silver',
      gold: 'Gold',
      verified: 'Verified',
    };

    // Send push notification
    if (user.expo_push_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.expo_push_token,
          title: '🎉 Badge Upgrade!',
          body: `Congratulations! You've earned the ${badgeNames[newBadge]} badge!`,
          data: {
            screen: 'Profile',
          },
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Badge auto-upgraded on trade completion
✓ Both buyer and seller checked
✓ Only upgrade if higher than current
✓ Notification sent on upgrade
✓ badge_verified_at timestamp set

==================================================
NEXT TASK
==================================================

BADGE-005: Display badge on user profile
*/
```

### Time Breakdown: **~3 hours**

---

## TASK BADGE-005: Display Badge on User Profile

**Duration:** 1.5 hours  
**Priority:** High  
**Dependencies:** BADGE-001 (Badge system)

### Description
Show user's badge on profile screen. Display badge icon, level name, and verification date. Show progress to next badge level (e.g., "3 more trades to Silver"). Link to badge info page.

---

### AI Prompt for Cursor (Generate Badge Profile Display)

```typescript
/*
TASK: Display badge on user profile

REQUIREMENTS:
1. Show current badge icon and name
2. Display verification date
3. Progress to next badge level
4. Link to badge info/requirements

FILE: src/screens/profile/UserProfileScreen.tsx (UPDATE)
- Badge section in profile header
- Progress bar to next level
- Tap to view badge requirements
*/
```

### Time Breakdown: **~1.5 hours**

---

## TASK BADGE-006: Implement Manual Badge Assignment (Admin Panel)

**Duration:** 2.5 hours  
**Priority:** Medium  
**Dependencies:** BADGE-001 (Badge system)

### Description
Admin can manually assign/revoke badges. Search for user, select badge level, add admin note. Update user's badge_level and badge_verification_method = 'manual'. Log action in admin audit trail.

---

### AI Prompt for Cursor (Generate Manual Badge Assignment)

```typescript
/*
TASK: Create manual badge assignment UI

REQUIREMENTS:
1. Search for user by email/name
2. Display current badge
3. Select new badge level dropdown
4. Add admin note (reason for assignment)
5. Save changes
6. Log in admin audit trail

==================================================
FILE: admin/app/users/[userId]/badge/page.tsx
==================================================
*/

import React, { useState } from 'react';

export default function ManualBadgeAssignmentPage({ params }: { params: { userId: string } }) {
  const [selectedBadge, setSelectedBadge] = useState('none');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  const badgeLevels = ['none', 'bronze', 'silver', 'gold', 'verified'];

  const handleSave = async () => {
    setSaving(true);

    await fetch(`/api/admin/users/${params.userId}/badge`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        badge_level: selectedBadge,
        admin_note: adminNote,
      }),
    });

    setSaving(false);
    alert('Badge updated!');
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Manual Badge Assignment</h1>

      <div className="mb-4">
        <label>Badge Level</label>
        <select
          value={selectedBadge}
          onChange={(e) => setSelectedBadge(e.target.value)}
        >
          {badgeLevels.map((level) => (
            <option key={level} value={level}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label>Admin Note</label>
        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder="Reason for manual badge assignment..."
        />
      </div>

      <button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Assign Badge'}
      </button>
    </div>
  );
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Admin can search for user
✓ Display current badge
✓ Select new badge level
✓ Add admin note
✓ Save updates user's badge
✓ badge_verification_method = 'manual'

==================================================
NEXT TASK
==================================================

BADGE-007: Stripe Identity background check integration (deferred)
*/
```

### Time Breakdown: **~2.5 hours**

---

## TASK BADGE-007: Implement Stripe Identity Background Check Integration (Deferred to Post-MVP)

**Duration:** 5 hours (deferred)  
**Priority:** Low  
**Dependencies:** BADGE-001 (Badge system), TRADE-004 (Stripe integration)

### Description
Integrate Stripe Identity for identity verification. Users can opt-in to verify identity for "Verified" badge. Submit ID photo via Stripe Identity API. Auto-upgrade to Verified on approval. **Deferred to Post-MVP if time-constrained.**

---

### AI Prompt for Cursor (Generate Stripe Identity Integration)

```typescript
/*
TASK: Integrate Stripe Identity for verification (DEFERRED TO POST-MVP)

CONTEXT:
Premium verification via government ID check.
Uses Stripe Identity API.

REQUIREMENTS:
1. "Verify Identity" button in profile
2. Launch Stripe Identity verification flow
3. Submit ID photo
4. Webhook on verification complete
5. Auto-upgrade to "Verified" badge

NOTE: This task is deferred to Post-MVP
*/
```

### Time Breakdown: **~5 hours** (deferred)

---

## TASK BADGE-008: Create "Upgrade to Verified" Flow (Optional User Action)

**Duration:** 2.5 hours  
**Priority:** Low  
**Dependencies:** BADGE-001 (Badge system), BADGE-007 (Stripe Identity - deferred)

### Description
Users can voluntarily upgrade to Verified badge. Display CTA on profile. Explain benefits (trust, higher visibility). Link to verification flow (Stripe Identity or manual review). Track conversion rate.

---

### AI Prompt for Cursor (Generate Upgrade Flow UI)

```typescript
/*
TASK: Create "Upgrade to Verified" user flow

REQUIREMENTS:
1. Display CTA if user not Verified
2. Show benefits of verification
3. Link to verification process
4. Track clicks/conversions

FILE: src/screens/profile/UpgradeToVerifiedScreen.tsx
- Benefits list
- "Start Verification" button
- FAQ about verification
*/
```

### Time Breakdown: **~2.5 hours**

---

---

## MODULE 10 SUMMARY

**Total Tasks:** 8 (7 implemented + 1 deferred)  
**Estimated Time:** ~21 hours (16 hours implemented + 5 hours deferred)

### Task Breakdown

| Task | Description | Duration | Status |
|------|-------------|----------|--------|
| BADGE-001 | Badge system schema | 3h | ✅ Documented |
| BADGE-002 | Admin toggle badge system | 2h | ✅ Documented |
| BADGE-003 | Admin badge thresholds UI | 2.5h | ✅ Documented |
| BADGE-004 | Auto-verification on trade | 3h | ✅ Documented |
| BADGE-005 | Display badge on profile | 1.5h | ✅ Documented |
| BADGE-006 | Manual badge assignment | 2.5h | ✅ Documented |
| BADGE-007 | Stripe Identity integration | 5h | ⏸️ Deferred |
| BADGE-008 | "Upgrade to Verified" flow | 2.5h | ✅ Documented |

---

### Key Features

**Badge Levels:**
- None (new users)
- Bronze (3 trades, $500 value)
- Silver (10 trades, $2000 value)
- Gold (25 trades, $5000 value)
- Verified (50 trades, $10,000 value OR manual/identity check)

**Auto-Verification:**
- Triggered on trade completion
- Checks both buyer and seller eligibility
- Upgrades if thresholds met
- Push notification on upgrade

**Admin Controls:**
- Toggle badge system on/off
- Configure thresholds per level
- Manual badge assignment
- Audit trail for manual changes

**User Experience:**
- Badge icon on profile and items
- Progress to next level
- "Upgrade to Verified" CTA
- Badge info/requirements page

---

### Database Tables

1. **users.badge_level** - Current badge
2. **users.badge_verified_at** - Verification timestamp
3. **users.badge_verification_method** - auto/manual/identity_check
4. **badge_config** - Thresholds and display settings

---

### Security Considerations

**RLS Policies:**
- Anyone can view badge_config
- Only admins can update badge_config
- Badge level publicly visible (trust signal)

**Verification Methods:**
- Auto: Automated based on thresholds
- Manual: Admin override
- Identity Check: Stripe Identity (Post-MVP)

**Fraud Prevention:**
- Admin audit trail for manual assignments
- Badge downgrade not allowed (trust consistency)
- Identity verification prevents fake accounts

---

### Analytics Events

1. `badge_upgraded` - User earned higher badge
2. `badge_assigned_manual` - Admin assigned badge
3. `upgrade_cta_clicked` - User clicked "Upgrade to Verified"
4. `identity_verification_started` - User started ID verification (Post-MVP)
5. `identity_verification_completed` - ID verification completed (Post-MVP)

---

### Testing Checklist

**Badge Calculation:**
- [ ] User with 0 trades → None
- [ ] User with 3 trades, $500 → Bronze
- [ ] User with 10 trades, $2000 → Silver
- [ ] User with 25 trades, $5000 → Gold

**Auto-Upgrade:**
- [ ] Trade completes → Badge recalculated
- [ ] User qualifies → Badge upgraded
- [ ] Push notification sent
- [ ] badge_verified_at set

**Admin Controls:**
- [ ] Toggle system on/off → Badges hidden
- [ ] Update thresholds → Saves to DB
- [ ] Manual assignment → Badge updated
- [ ] Admin note logged

**UI Display:**
- [ ] Badge icon shows correct color
- [ ] Badge name displayed
- [ ] Progress bar to next level
- [ ] "Upgrade" CTA shown for non-Verified

---

### Cost Analysis

**Database Storage:**
- Badge config: ~500 bytes (5 levels)
- User badge fields: ~50 bytes per user
- **Estimated:** Negligible

**Stripe Identity (Post-MVP):**
- $3-5 per verification
- Only for users opting in
- **Estimated:** $0-500/month (based on adoption)

**Total:** ~$0/month for MVP (excludes Stripe Identity)

---

### Future Enhancements (Post-MVP)

1. **Stripe Identity Integration** - Government ID verification
2. **Badge Showcase** - Public badge leaderboard
3. **Special Badges** - Limited edition, seasonal
4. **Badge Benefits** - Lower fees, priority support
5. **Badge Expiration** - Require periodic re-verification
6. **Community Voting** - Users vote on trusted members
7. **Referral Badges** - Reward successful referrals
8. **Seller Badges** - Separate badges for selling activity

---

**MODULE 10: BADGES & TRUST - COMPLETE**

Ready to proceed to Module 11 (Subscriptions)?
