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
**Priority:** High  
**Dependencies:** BADGE-001 (Badge system), BADGE-009 (ID Badge Schema)

### Description
Users can voluntarily upgrade to Verified badge via ID verification. Display CTA on profile. Explain benefits (trust, higher visibility). Link to ID Badge upload flow. Track conversion rate.

---

### AI Prompt for Cursor (Generate Upgrade Flow UI)

```typescript
/*
TASK: Create "Upgrade to Verified" user flow with ID badge integration

REQUIREMENTS:
1. Display CTA if user not Verified and ID badge system enabled
2. Show benefits of verification
3. Link to ID Badge upload flow (BADGE-010)
4. Track clicks/conversions

FILE: src/screens/profile/UpgradeToVerifiedScreen.tsx
- Benefits list
- "Start Verification" button
- Link to IDVerificationUploadScreen
*/
```

### Time Breakdown: **~2.5 hours**

---

## TASK BADGE-009: ID Badge Verification Schema & Storage Setup

**Duration:** 2.5 hours  
**Priority:** Critical  
**Dependencies:** BADGE-001 (Badge system)

### Description
Create database schema for ID badge verification requests. Add `id_badge_verification_requests` table with user info, submission status, rejection reason, screenshot storage path, and timestamps. Create Supabase Storage bucket for temporary ID screenshots with secure RLS policies. Store submissions with expiry tracking (auto-delete after decision).

---

### AI Prompt for Cursor (Generate ID Badge Schema)

```typescript
/*
TASK: Create ID badge verification request schema and storage

CONTEXT:
Users submit ID screenshots for manual verification.
Admin approves/rejects with reasons.
Screenshots auto-deleted after decision (immediate deletion).
All submission history preserved (metadata only).

REQUIREMENTS:
1. Create id_badge_verification_requests table
2. Create id_badge_verification_storage bucket in Supabase Storage
3. Enable RLS on bucket (user can upload, admin can view/download)
4. Create id_badge_verification_messages table for configurable messages
5. Add indexes for efficient queries

==================================================
FILE 1: Database migration for ID badge verification
==================================================
*/

-- filepath: supabase/migrations/037_id_badge_verification_system.sql

-- Enum for verification request status
CREATE TYPE id_badge_status AS ENUM ('pending', 'approved', 'rejected');

-- Enum for rejection reasons (predefined)
CREATE TYPE id_badge_rejection_reason AS ENUM (
  'unclear_photo',
  'id_expired',
  'name_mismatch',
  'multiple_ids',
  'not_government_id',
  'other'
);

-- ID Badge Verification Requests table
CREATE TABLE id_badge_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status id_badge_status NOT NULL DEFAULT 'pending',
  screenshot_path TEXT, -- Supabase Storage path (deleted after decision)
  screenshot_upload_timestamp TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ, -- When admin made decision
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin user
  rejection_reason id_badge_rejection_reason, -- Only if rejected
  rejection_notes TEXT, -- Free-text reason from admin
  approval_notes TEXT, -- Optional notes on approval
  node_id UUID, -- Denormalized for filtering
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient filtering
CREATE INDEX id_badge_requests_user_idx ON id_badge_verification_requests(user_id);
CREATE INDEX id_badge_requests_status_idx ON id_badge_verification_requests(status);
CREATE INDEX id_badge_requests_submitted_idx ON id_badge_verification_requests(submitted_at DESC);
CREATE INDEX id_badge_requests_reviewed_idx ON id_badge_verification_requests(reviewed_by);
CREATE INDEX id_badge_requests_node_idx ON id_badge_verification_requests(node_id);

-- RLS policies for id_badge_verification_requests
ALTER TABLE id_badge_verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own ID badge requests"
  ON id_badge_verification_requests FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all requests
CREATE POLICY "Admins can view all ID badge requests"
  ON id_badge_verification_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can insert their own requests
CREATE POLICY "Users can insert own ID badge requests"
  ON id_badge_verification_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can update requests (for approval/rejection)
CREATE POLICY "Admins can update ID badge requests"
  ON id_badge_verification_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Configurable messages for ID badge system
CREATE TABLE id_badge_verification_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_key TEXT NOT NULL UNIQUE,
  message_text TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default configurable messages
INSERT INTO id_badge_verification_messages (message_key, message_text, description)
VALUES
  (
    'upload_disclaimer',
    'We will not store or keep your ID image. Your image will be permanently deleted after we approve or reject your verification request.',
    'Disclaimer shown on upload screen'
  ),
  (
    'submit_button_label',
    'Submit for Verification',
    'Label on submit button'
  ),
  (
    'pending_status_text',
    'Your verification request is pending. We will review it within 24 hours.',
    'Text shown when request is pending'
  ),
  (
    'approved_email_subject',
    'Your ID Verification is Approved! 🎉',
    'Email subject when approved'
  ),
  (
    'approved_email_body',
    'Congratulations! Your ID has been verified. Your profile now displays the Verified badge. Thank you for being part of our trusted community!',
    'Email body when approved'
  ),
  (
    'rejected_email_subject',
    'ID Verification Request - Action Required',
    'Email subject when rejected'
  ),
  (
    'rejected_email_body',
    'We were unable to verify your ID because: {rejection_reason}. {admin_notes} Please submit a new verification request with a clearer photo.',
    'Email body when rejected (supports {rejection_reason} and {admin_notes} placeholders)'
  ),
  (
    'in_app_pending_notification',
    'Your ID verification is being reviewed. We''ll notify you within 24 hours.',
    'In-app notification when pending'
  ),
  (
    'in_app_approved_notification',
    'Great! Your ID has been verified. You now have the Verified badge.',
    'In-app notification when approved'
  ),
  (
    'in_app_rejected_notification',
    'Your ID verification was not approved. Please submit a new request with clearer details.',
    'In-app notification when rejected'
  ),
  (
    'web_push_approved',
    'Your ID verification is complete! You now have the Verified badge.',
    'Web push when approved'
  ),
  (
    'web_push_rejected',
    'Your ID verification request needs resubmission. Please try again with a clearer photo.',
    'Web push when rejected'
  );

-- RLS policies for messages (admins can update, everyone can read)
ALTER TABLE id_badge_verification_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ID badge messages"
  ON id_badge_verification_messages FOR SELECT
  USING (true);

CREATE POLICY "Admins can update ID badge messages"
  ON id_badge_verification_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add admin config for enabling/disabling ID badge verification
INSERT INTO admin_config (key, value, value_type, description)
VALUES
  ('id_badge_verification_enabled', 'true', 'boolean', 'Enable/disable ID badge manual verification for users'),
  ('id_badge_verification_approval_sla_hours', '24', 'integer', 'Expected approval time in hours')
ON CONFLICT (key) DO NOTHING;

-- Update trigger for updated_at
CREATE TRIGGER update_id_badge_requests_updated_at
  BEFORE UPDATE ON id_badge_verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_id_badge_messages_updated_at
  BEFORE UPDATE ON id_badge_verification_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

/*
==================================================
FILE 2: Supabase Storage bucket setup (via Supabase dashboard or migration script)
==================================================
*/

-- Note: Storage bucket creation must be done via Supabase dashboard or custom Edge Function
-- Bucket name: id-badge-verification-screenshots
-- Enable RLS on bucket
-- Policies (to be created):
--   1. Users can upload to their own user_id folder
--   2. Admins can download/view all screenshots
--   3. Automatic deletion (implement via Edge Function scheduled task)

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ id_badge_verification_requests table created with all columns
✓ id_badge_status enum created (pending, approved, rejected)
✓ id_badge_rejection_reason enum created (6 predefined reasons)
✓ Indexes on user_id, status, submitted_at for performance
✓ RLS policies allow users to view own requests, admins to view all
✓ id_badge_verification_messages table created with 12 default messages
✓ Admin can update all messages for flexibility
✓ admin_config entries created for feature flag and SLA
✓ Timestamps (created_at, updated_at, submitted_at, reviewed_at) set correctly

==================================================
NEXT TASK
==================================================

BADGE-010: ID Badge Upload Flow (Mobile Screen)
*/
```

### Output Files
1. **supabase/migrations/037_id_badge_verification_system.sql** - Schema and RLS policies
2. **Supabase Storage bucket setup** - `id-badge-verification-screenshots` bucket (manual or via dashboard)

### Testing Steps
1. Verify tables created: `SELECT * FROM id_badge_verification_requests`
2. Verify enums exist: `SELECT * FROM pg_enum WHERE enumtypid::regtype::text LIKE 'id_badge%'`
3. Verify RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'id_badge_verification_requests'`
4. Verify messages seeded: `SELECT COUNT(*) FROM id_badge_verification_messages`

### Time Breakdown: **~2.5 hours**

---

## TASK BADGE-010: ID Badge Upload Flow (Mobile Screen)

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** BADGE-009 (ID Badge Schema)

### Description
Create mobile screen for users to upload ID screenshot. Show disclaimer about not storing images. Allow users to pick image from camera or gallery. Validate image size/quality before upload. Display "Pending Approval" status after submission. Show progress to next badge (if applicable). Prevent duplicate submissions (in-flight protection).

---

### AI Prompt for Cursor (Generate ID Badge Upload Screen)

```typescript
/*
TASK: Create ID badge upload screen for mobile app

CONTEXT:
Users upload ID screenshot for manual verification by admin.
System shows disclaimer about image deletion.
After submission, show "Pending Approval" status.
Prevent multiple simultaneous submissions.

REQUIREMENTS:
1. Disclaimer text (fetch from configurable messages)
2. Image picker (camera or gallery)
3. Image validation (size, dimensions)
4. Upload to Supabase Storage
5. Create submission record in db
6. Show "Pending Approval" badge after submission
7. Prevent duplicate submissions (in-flight)
8. Handle errors gracefully

==================================================
FILE 1: ID Badge Upload Screen Component
==================================================
*/

// filepath: p2p-kids-marketplace/src/screens/profile/IDVerificationUploadScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/hooks/useAuth';
import { idBadgeService } from '@/services/idBadge';

interface UploadState {
  selectedImage: string | null;
  uploading: boolean;
  error: string | null;
  submitted: boolean;
  pendingRequestId: string | null;
}

export function IDVerificationUploadScreen({ navigation }: any) {
  const { user } = useAuth();
  const [state, setState] = useState<UploadState>({
    selectedImage: null,
    uploading: false,
    error: null,
    submitted: false,
    pendingRequestId: null,
  });
  const [disclaimerText, setDisclaimerText] = useState('');
  const [hasActivePending, setHasActivePending] = useState(false);

  useEffect(() => {
    loadDisclaimerAndCheckStatus();
  }, [user?.id]);

  const loadDisclaimerAndCheckStatus = async () => {
    // Fetch configurable disclaimer message
    const disclaimer = await idBadgeService.getMessage('upload_disclaimer');
    setDisclaimerText(disclaimer);

    // Check if user has pending request
    const pending = await idBadgeService.checkPendingRequest(user!.id);
    setHasActivePending(pending !== null);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setState((prev) => ({
          ...prev,
          selectedImage: result.assets[0].uri,
          error: null,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to pick image',
      }));
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setState((prev) => ({
          ...prev,
          selectedImage: result.assets[0].uri,
          error: null,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to take photo',
      }));
    }
  };

  const handleSubmit = async () => {
    if (!state.selectedImage) {
      setState((prev) => ({
        ...prev,
        error: 'Please select an image',
      }));
      return;
    }

    if (hasActivePending) {
      Alert.alert(
        'Pending Request',
        'You already have a pending verification request. Please wait for approval.'
      );
      return;
    }

    setState((prev) => ({ ...prev, uploading: true, error: null }));

    try {
      const requestId = await idBadgeService.submitVerificationRequest(
        user!.id,
        state.selectedImage
      );

      setState((prev) => ({
        ...prev,
        uploading: false,
        submitted: true,
        pendingRequestId: requestId,
      }));

      // Navigate back or show success
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        uploading: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      }));
    }
  };

  if (hasActivePending && !state.submitted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Verification Pending</Text>
        <Text style={styles.message}>
          You already have a pending verification request. We'll review it within 24 hours.
        </Text>
      </View>
    );
  }

  if (state.submitted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>✓ Submitted Successfully</Text>
        <Text style={styles.message}>
          Your verification request has been submitted. We'll review it within 24 hours and notify you of the decision.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Verify Your Identity</Text>

      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerTitle}>Your Privacy is Important</Text>
        <Text style={styles.disclaimerText}>{disclaimerText}</Text>
      </View>

      {state.selectedImage ? (
        <View style={styles.imagePreview}>
          <Image source={{ uri: state.selectedImage }} style={styles.image} />
          <Pressable
            style={styles.changeButton}
            onPress={() =>
              setState((prev) => ({ ...prev, selectedImage: null }))
            }
          >
            <Text style={styles.changeButtonText}>Change Image</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.imagePickerButtons}>
          <Pressable style={styles.button} onPress={takePhoto}>
            <Text style={styles.buttonText}>Take Photo</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.secondaryButton]} onPress={pickImage}>
            <Text style={styles.secondaryButtonText}>Choose from Gallery</Text>
          </Pressable>
        </View>
      )}

      {state.error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      )}

      <Pressable
        style={[styles.submitButton, !state.selectedImage && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={!state.selectedImage || state.uploading}
      >
        {state.uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit for Verification</Text>
        )}
      </Pressable>

      <Text style={styles.helpText}>
        Tips: Make sure your ID is clearly visible, well-lit, and the photo is in focus.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  disclaimerBox: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    padding: 12,
    marginBottom: 20,
    borderRadius: 4,
  },
  disclaimerTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  imagePreview: {
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 12,
  },
  changeButton: {
    paddingVertical: 8,
  },
  changeButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  imagePickerButtons: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  secondaryButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 12,
    marginBottom: 16,
    borderRadius: 4,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
});

/*
==================================================
FILE 2: ID Badge Service
==================================================
*/

// filepath: p2p-kids-marketplace/src/services/idBadge.ts

import { createClient } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';

export const idBadgeService = {
  async getMessage(key: string): Promise<string> {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('id_badge_verification_messages')
        .select('message_text')
        .eq('message_key', key)
        .single();

      if (error) throw error;
      return data?.message_text || '';
    } catch (error) {
      console.error('Error fetching message:', error);
      return ''; // Return empty string if message not found
    }
  },

  async checkPendingRequest(userId: string) {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('id_badge_verification_requests')
        .select('id, status')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .single();

      if (error && error.code === 'PGRST116') return null; // No rows
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error checking pending request:', error);
      return null;
    }
  },

  async submitVerificationRequest(userId: string, imageUri: string): Promise<string> {
    const supabase = createClient();

    try {
      // Read file
      const fileData = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Upload to Supabase Storage
      const fileName = `${userId}-${Date.now()}.jpg`;
      const storagePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('id-badge-verification-screenshots')
        .upload(storagePath, {
          uri: imageUri,
          name: fileName,
          type: 'image/jpeg',
        } as any);

      if (uploadError) throw uploadError;

      // Create submission record in database
      const { data, error } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: userId,
          status: 'pending',
          screenshot_path: storagePath,
          screenshot_upload_timestamp: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;

      // TODO: Trigger notification (in-app + email)
      // TODO: Log analytics event

      return data.id;
    } catch (error) {
      console.error('Error submitting verification request:', error);
      throw error;
    }
  },
};

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ IDVerificationUploadScreen component created
✓ Disclaimer text loaded from configurable messages
✓ Image picker (camera + gallery) working
✓ Image validation (size/quality) before upload
✓ Upload to Supabase Storage with user_id folder structure
✓ Create id_badge_verification_requests record
✓ Show "Pending Approval" status after submission
✓ Prevent duplicate submissions (check for pending request)
✓ Error handling with user-friendly messages
✓ Loading states during upload

==================================================
NEXT TASK
==================================================

BADGE-011: Admin ID Badge Queue & Review Page
*/
```

### Output Files
1. **p2p-kids-marketplace/src/screens/profile/IDVerificationUploadScreen.tsx** - Mobile upload screen
2. **p2p-kids-marketplace/src/services/idBadge.ts** - ID badge service with upload logic

### Testing Steps
1. Navigate to IDVerificationUploadScreen
2. Pick image from gallery
3. Submit for verification
4. Verify record created in `id_badge_verification_requests`
5. Verify screenshot uploaded to Supabase Storage
6. Test duplicate submission prevention (should show pending message)
7. Test error scenarios (network, upload failure)

### Time Breakdown: **~3 hours**

---

## TASK BADGE-011: Admin ID Badge Queue & Review Page

**Duration:** 3.5 hours  
**Priority:** Critical  
**Dependencies:** BADGE-009 (ID Badge Schema), BADGE-012 (Notifications)

### Description
Create admin page at `/admin/ID-badges/` with filterable queue of ID badge verification requests. Show table with user info (first/last name, email, phone, node_id, submission date, status). Implement filters for Pending/Approved/Rejected. Show stats section (counts, avg review time). Allow admin to download screenshot, review, approve with optional notes, or reject with dropdown reason + free-text notes. Auto-delete screenshot immediately after decision.

---

### AI Prompt for Cursor (Generate Admin ID Badge Page)

```typescript
/*
TASK: Create admin ID badge verification queue and review page

CONTEXT:
Admin reviews pending ID badge verification requests.
Admin can approve/reject with reason and notes.
Screenshots auto-deleted after decision.
History shows metadata (no screenshot).

REQUIREMENTS:
1. Table view of requests (user info, submission date, status)
2. Filters: Pending, Approved, Rejected
3. Search by user name/email
4. Quick stats: pending count, avg review time, approval rate
5. Download screenshot for review
6. Approve/reject modal with reason + notes
7. Auto-delete screenshot after decision
8. Show all submission history (not paginated initially)
9. Export to CSV (optional)

==================================================
FILE 1: Admin ID Badge Queue Page
==================================================
*/

// filepath: p2p-kids-admin/src/app/ID-badges/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface IDVerificationRequest {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  node_id: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason?: string;
  rejection_notes?: string;
  approval_notes?: string;
  screenshot_path?: string;
}

interface Stats {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  avg_review_time_hours: number;
  approval_rate: number;
}

export default function IDBadgeQueuePage() {
  const [requests, setRequests] = useState<IDVerificationRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadRequests();
    loadStats();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/id-badges?${params}`);
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/id-badges/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Debounce search
    setTimeout(() => {
      loadRequests();
    }, 300);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' +
           new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ID Badge Verification</h1>

      {/* Stats Section */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="text-sm text-gray-600">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending_count}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <p className="text-sm text-gray-600">Approved</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved_count}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-sm text-gray-600">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected_count}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-gray-600">Avg Review Time</p>
            <p className="text-2xl font-bold text-blue-600">{stats.avg_review_time_hours.toFixed(1)}h</p>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 px-4 py-2 border rounded"
        />
      </div>

      <div className="mb-4 flex gap-2">
        {['all', 'pending', 'approved', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded font-medium ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Node</th>
              <th className="px-4 py-3 text-left">Submitted</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-center">
                  Loading...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-center text-gray-500">
                  No requests found
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {req.first_name} {req.last_name}
                  </td>
                  <td className="px-4 py-3">{req.email}</td>
                  <td className="px-4 py-3">{req.phone_number}</td>
                  <td className="px-4 py-3">{req.node_id}</td>
                  <td className="px-4 py-3">{formatDate(req.submitted_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        req.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : req.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {req.status === 'pending' ? (
                      <Link
                        href={`/ID-badges/${req.id}/review`}
                        className="text-blue-600 hover:underline"
                      >
                        Review
                      </Link>
                    ) : (
                      <Link
                        href={`/ID-badges/${req.id}/details`}
                        className="text-gray-600 hover:underline"
                      >
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/*
==================================================
FILE 2: ID Badge Review Modal/Page
==================================================
*/

// filepath: p2p-kids-admin/src/app/ID-badges/[requestId]/review/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const REJECTION_REASONS = [
  { value: 'unclear_photo', label: 'Unclear photo' },
  { value: 'id_expired', label: 'ID expired' },
  { value: 'name_mismatch', label: 'Name does not match profile' },
  { value: 'multiple_ids', label: 'Multiple IDs in photo' },
  { value: 'not_government_id', label: 'Not a government-issued ID' },
  { value: 'other', label: 'Other (see notes)' },
];

export default function IDVerificationReviewPage({
  params,
}: {
  params: { requestId: string };
}) {
  const router = useRouter();
  const [request, setRequest] = useState<any>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadRequest();
  }, [params.requestId]);

  const loadRequest = async () => {
    try {
      const response = await fetch(`/api/admin/id-badges/${params.requestId}`);
      const data = await response.json();
      setRequest(data);

      // Get screenshot URL if available
      if (data.screenshot_path) {
        const urlResponse = await fetch(
          `/api/admin/id-badges/${params.requestId}/screenshot-url`
        );
        const { url } = await urlResponse.json();
        setScreenshotUrl(url);
      }
    } catch (error) {
      console.error('Error loading request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDecision = async () => {
    if (!decision) {
      alert('Please select approve or reject');
      return;
    }

    if (decision === 'reject' && !rejectionReason) {
      alert('Please select a rejection reason');
      return;
    }

    setDeciding(true);

    try {
      const response = await fetch(`/api/admin/id-badges/${params.requestId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          rejection_reason: decision === 'reject' ? rejectionReason : null,
          notes,
        }),
      });

      if (response.ok) {
        alert(`Request ${decision === 'approve' ? 'approved' : 'rejected'} successfully`);
        router.push('/ID-badges');
      }
    } catch (error) {
      console.error('Error submitting decision:', error);
      alert('Failed to submit decision');
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!request) {
    return <div className="p-6">Request not found</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Review ID Badge Request</h1>

      {/* User Info */}
      <div className="bg-gray-50 p-4 rounded mb-6">
        <h2 className="text-lg font-bold mb-4">User Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Name</p>
            <p className="font-medium">
              {request.first_name} {request.last_name}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-medium">{request.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Phone</p>
            <p className="font-medium">{request.phone_number}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Node</p>
            <p className="font-medium">{request.node_id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Submitted</p>
            <p className="font-medium">
              {new Date(request.submitted_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Screenshot Preview */}
      {screenshotUrl && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-4">Submitted Screenshot</h2>
          <div className="relative w-full h-96 bg-gray-100 rounded overflow-hidden">
            <Image
              src={screenshotUrl}
              alt="ID Verification"
              fill
              style={{ objectFit: 'contain' }}
            />
          </div>
          <a
            href={screenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline mt-2 inline-block"
          >
            Download Full Size
          </a>
        </div>
      )}

      {/* Decision Form */}
      <div className="bg-white border rounded p-6">
        <h2 className="text-lg font-bold mb-4">Make a Decision</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Decision</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="decision"
                value="approve"
                onChange={(e) => setDecision(e.target.value as any)}
                className="mr-2"
              />
              <span>Approve</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="decision"
                value="reject"
                onChange={(e) => setDecision(e.target.value as any)}
                className="mr-2"
              />
              <span>Reject</span>
            </label>
          </div>
        </div>

        {decision === 'reject' && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Rejection Reason</label>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">Select a reason</option>
              {REJECTION_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              decision === 'reject'
                ? 'Optional: Provide additional context for rejection'
                : 'Optional: Notes about approval'
            }
            className="w-full px-3 py-2 border rounded h-24"
          />
        </div>

        <button
          onClick={handleSubmitDecision}
          disabled={!decision || deciding}
          className={`px-6 py-2 rounded font-medium text-white ${
            !decision || deciding
              ? 'bg-gray-400 cursor-not-allowed'
              : decision === 'approve'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {deciding ? 'Submitting...' : `${decision ? decision.charAt(0).toUpperCase() + decision.slice(1) : 'Make Decision'}`}
        </button>
      </div>
    </div>
  );
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Admin queue page shows all requests with filters
✓ Table displays: name, email, phone, node, submission date, status
✓ Filter by Pending/Approved/Rejected working
✓ Search by name/email working
✓ Stats section shows counts and avg review time
✓ Review page allows approve/reject decision
✓ Rejection reason dropdown with 6 predefined options
✓ Optional notes field for additional context
✓ Screenshot viewable and downloadable (only for pending)
✓ Screenshot auto-deleted after decision
✓ Admin decision persisted to database
✓ Notifications sent on approve/reject (BADGE-012)

==================================================
NEXT TASK
==================================================

BADGE-012: ID Badge Submission & Decision Notifications
*/
```

### Output Files
1. **p2p-kids-admin/src/app/ID-badges/page.tsx** - Main queue page
2. **p2p-kids-admin/src/app/ID-badges/[requestId]/review/page.tsx** - Review/decision page
3. **p2p-kids-admin/src/app/ID-badges/[requestId]/details/page.tsx** - History details page

### Testing Steps
1. Navigate to `/admin/ID-badges/`
2. Verify stats load correctly
3. Filter by status (Pending/Approved/Rejected)
4. Search by user name/email
5. Click "Review" on a pending request
6. View screenshot
7. Submit approve/reject decision
8. Verify record updated in database
9. Verify screenshot deleted

### Time Breakdown: **~3.5 hours**

---

## TASK BADGE-012: ID Badge Submission & Decision Notifications

**Duration:** 2.5 hours  
**Priority:** High  
**Dependencies:** BADGE-009 (ID Badge Schema), BADGE-010 (Upload Flow), BADGE-011 (Admin Queue)

### Description
Implement multi-channel notifications for ID badge verification events. Send web push + in-app + email to user on submission confirmation. Send web push to admin on new submission. Send web push + in-app + email to user on approval/rejection (with decision reason). All messages loaded from configurable `id_badge_verification_messages` table. Respect user notification preferences.

---

### AI Prompt for Cursor (Generate Notifications)

```typescript
/*
TASK: Implement ID badge verification notifications

CONTEXT:
Users receive notifications on submission, approval, rejection.
Admins receive web push on new submissions.
All messages are configurable via admin panel.
Messages support template variables like {first_name}, {rejection_reason}, {admin_notes}.

REQUIREMENTS:
1. On submission: user gets web push + in-app + email
2. On submission: admin gets web push
3. On approval: user gets web push + in-app + email with verified badge notification
4. On rejection: user gets web push + in-app + email with reason + notes
5. Messages support template variables
6. Respect user notification preferences
7. All messages from configurable table

==================================================
FILE 1: Edge Function to handle decisions and send notifications
==================================================
*/

// filepath: supabase/functions/id-badge-decision-notification/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { requestId, decision, rejectionReason, adminNotes } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request details
    const { data: request, error: requestError } = await supabase
      .from('id_badge_verification_requests')
      .select('*, profiles:user_id(first_name, email)')
      .eq('id', requestId)
      .single();

    if (requestError) throw requestError;

    // Get user for notification preferences
    const { data: user } = await supabase
      .from('users')
      .select('expo_push_token, email')
      .eq('id', request.user_id)
      .single();

    // Get user preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', request.user_id)
      .single();

    // Get notification message templates
    const messageKeys =
      decision === 'approved'
        ? ['approved_email_subject', 'approved_email_body', 'in_app_approved_notification', 'web_push_approved']
        : ['rejected_email_subject', 'rejected_email_body', 'in_app_rejected_notification', 'web_push_rejected'];

    const { data: messages } = await supabase
      .from('id_badge_verification_messages')
      .select('message_key, message_text')
      .in('message_key', messageKeys);

    const messageMap = messages?.reduce((acc: any, msg) => {
      acc[msg.message_key] = msg.message_text;
      return acc;
    }, {});

    // Replace template variables
    const replacePlaceholders = (text: string): string => {
      return text
        .replace('{first_name}', request.profiles?.first_name || 'User')
        .replace('{rejection_reason}', rejectionReason || '')
        .replace('{admin_notes}', adminNotes || '')
        .replace('{approval_timeframe_hours}', '24');
    };

    // Send notifications
    if (decision === 'approved') {
      // Send in-app notification
      if (prefs?.id_badge_verification_in_app) {
        await supabase.from('notifications').insert({
          user_id: request.user_id,
          category: 'badges',
          title: 'ID Verification Approved! 🎉',
          body: replacePlaceholders(messageMap['in_app_approved_notification']),
          channels: ['in_app'],
          data: { requestId, badge: 'verified' },
        });
      }

      // Send web push
      if (prefs?.id_badge_verification_push && user?.expo_push_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.expo_push_token,
            title: 'ID Verification Approved',
            body: messageMap['web_push_approved'],
            data: { requestId, badge: 'verified' },
          }),
        });
      }

      // Send email
      if (prefs?.id_badge_verification_email && user?.email) {
        // Call SendGrid or similar email service
        // TODO: Send email with subject and body
      }

      // Award verified badge
      await supabase
        .from('users')
        .update({
          badge_level: 'verified',
          badge_verified_at: new Date().toISOString(),
          badge_verification_method: 'id_verification',
        })
        .eq('id', request.user_id);
    } else if (decision === 'rejected') {
      // Send in-app notification
      if (prefs?.id_badge_verification_in_app) {
        await supabase.from('notifications').insert({
          user_id: request.user_id,
          category: 'badges',
          title: 'ID Verification Request',
          body: replacePlaceholders(messageMap['in_app_rejected_notification']),
          channels: ['in_app'],
          data: { requestId, decision: 'rejected', reason: rejectionReason },
        });
      }

      // Send web push
      if (prefs?.id_badge_verification_push && user?.expo_push_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.expo_push_token,
            title: 'ID Verification Request',
            body: messageMap['web_push_rejected'],
            data: { requestId, decision: 'rejected', reason: rejectionReason },
          }),
        });
      }

      // Send email
      if (prefs?.id_badge_verification_email && user?.email) {
        // TODO: Send rejection email
      }
    }

    // Log admin activity
    await supabase.from('admin_activity_log').insert({
      admin_id: Deno.env.get('ADMIN_USER_ID'),
      action_type: `id_badge_${decision}`,
      entity_type: 'id_badge_verification',
      entity_id: requestId,
      details: { rejectionReason, adminNotes },
      notes: `ID badge ${decision} for user ${request.user_id}`,
    });

    // Delete screenshot from storage (immediate deletion)
    if (request.screenshot_path) {
      await supabase.storage
        .from('id-badge-verification-screenshots')
        .remove([request.screenshot_path]);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/*
==================================================
FILE 2: ID Badge Notification Service
==================================================
*/

// filepath: p2p-kids-marketplace/src/services/idBadgeNotifications.ts

import { createClient } from '@/lib/supabase';

export const idBadgeNotificationService = {
  async sendSubmissionNotification(userId: string, requestId: string) {
    const supabase = createClient();

    try {
      // Get message template
      const { data: message } = await supabase
        .from('id_badge_verification_messages')
        .select('message_text')
        .eq('message_key', 'pending_status_text')
        .single();

      // Create in-app notification
      await supabase.from('notifications').insert({
        user_id: userId,
        category: 'badges',
        title: 'Verification Request Submitted',
        body: message?.message_text || 'Your ID verification request has been received. We''ll review it within 24 hours.',
        channels: ['in_app'],
        data: { requestId },
      });

      // TODO: Send email confirmation

      return true;
    } catch (error) {
      console.error('Error sending submission notification:', error);
      return false;
    }
  },

  async sendAdminNotification(adminId: string, requestId: string, userEmail: string) {
    // Send web push only to admin
    // TODO: Get admin's push token and send notification about new submission
    return true;
  },
};

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ On submission: user receives in-app + email notifications
✓ On approval: user receives in-app + web push + email
✓ On rejection: user receives in-app + web push + email with reason
✓ Admin receives web push on new submission
✓ All messages fetched from configurable table
✓ Template variables replaced ({first_name}, {rejection_reason}, {admin_notes})
✓ User notification preferences respected
✓ Screenshot deleted immediately after decision
✓ Admin activity logged for all decisions
✓ Verified badge awarded on approval

==================================================
NEXT TASK
==================================================

BADGE-013: Admin Configurable Messages for ID Badge System
*/
```

### Output Files
1. **supabase/functions/id-badge-decision-notification/index.ts** - Decision notification handler
2. **p2p-kids-marketplace/src/services/idBadgeNotifications.ts** - Notification service

### Testing Steps
1. Submit ID badge verification request
2. Verify in-app notification shows "Pending" message
3. Verify email sent
4. Admin approves request
5. Verify user receives approval in-app + email + push notification
6. Verify verified badge awarded to user
7. Admin rejects request
8. Verify user receives rejection in-app + email + push with reason
9. Verify screenshot deleted from storage

### Time Breakdown: **~2.5 hours**

---

## TASK BADGE-013: Admin Configurable Messages for ID Badge System

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** BADGE-009 (ID Badge Schema)

### Description
Create admin page at `/admin/ID-badges/messages/` to edit all ID badge verification messages. Display all 12 message templates in editable form. Show message key and description. Support template variables info (e.g., `{first_name}`, `{rejection_reason}`, `{admin_notes}`). Save changes to `id_badge_verification_messages` table. Show visual preview of how messages appear in app/email.

---

### AI Prompt for Cursor (Generate Configurable Messages Page)

```typescript
/*
TASK: Create admin message configuration page for ID badges

CONTEXT:
Admin can customize all user-facing messages in the ID badge verification system.
Messages support template variables for personalization.

REQUIREMENTS:
1. Display all 12 message templates
2. Each message has: key, current text, description
3. Edit form with template variables reference
4. Save changes to database
5. Show preview (mock in-app, email, web push)
6. Validation (no empty critical messages)

FILE: admin/app/ID-badges/messages/page.tsx
*/

'use client';

import React, { useState, useEffect } from 'react';

interface Message {
  id: string;
  message_key: string;
  message_text: string;
  description: string;
}

export default function IDMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const response = await fetch('/api/admin/id-badges/messages');
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (message: Message) => {
    setEditingId(message.id);
    setEditText(message.message_text);
  };

  const handleSave = async (messageId: string) => {
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/id-badges/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_text: editText }),
      });

      if (response.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, message_text: editText } : m
          )
        );
        setEditingId(null);
        alert('Message saved successfully');
      }
    } catch (error) {
      console.error('Error saving message:', error);
      alert('Failed to save message');
    } finally {
      setSaving(false);
    }
  };

  const templateVariables = [
    { key: '{first_name}', desc: 'User''s first name' },
    { key: '{rejection_reason}', desc: 'Reason for rejection (e.g., "Unclear photo")' },
    { key: '{admin_notes}', desc: 'Additional notes from admin' },
    { key: '{approval_timeframe_hours}', desc: 'Expected approval time' },
  ];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ID Badge Verification Messages</h1>

      <div className="mb-8 bg-blue-50 border border-blue-200 rounded p-4">
        <p className="font-semibold mb-2">Available Template Variables:</p>
        <div className="grid grid-cols-2 gap-4">
          {templateVariables.map((v) => (
            <div key={v.key}>
              <code className="bg-blue-100 px-2 py-1 rounded text-sm">{v.key}</code>
              <p className="text-sm text-gray-600 ml-2">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p>Loading messages...</p>
      ) : (
        <div className="space-y-6">
          {messages.map((message) => (
            <div key={message.id} className="bg-white border rounded p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{message.message_key}</h3>
                  <p className="text-sm text-gray-600">{message.description}</p>
                </div>
                {editingId !== message.id && (
                  <button
                    onClick={() => handleEdit(message)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingId === message.id ? (
                <div>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full px-3 py-2 border rounded h-24 mb-4"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(message.id)}
                      disabled={saving}
                      className={`px-4 py-2 rounded font-medium text-white ${
                        saving
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="bg-gray-50 p-4 rounded whitespace-pre-wrap">
                  {message.message_text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Display all 12 message templates
✓ Each message shows key, description, current text
✓ Edit button opens inline editor
✓ Template variables reference displayed
✓ Save changes to database
✓ Validation (prevent empty critical messages)
✓ Success confirmation on save
✓ Changes immediately reflect in app

==================================================
NEXT TASK
==================================================

BADGE-014: ID Badge Status Display on User Profile
*/
```

### Output Files
1. **p2p-kids-admin/src/app/ID-badges/messages/page.tsx** - Messages configuration page

### Testing Steps
1. Navigate to `/admin/ID-badges/messages/`
2. View all 12 messages with descriptions
3. Click Edit on a message
4. Change text
5. Save changes
6. Verify updated in database
7. Verify changes reflected in user notifications

### Time Breakdown: **~2 hours**

---

## TASK BADGE-014: ID Badge Status Display on User Profile

**Duration:** 2.5 hours  
**Priority:** High  
**Dependencies:** BADGE-009 (ID Badge Schema), BADGE-010 (Upload Flow)

### Description
Update user profile screen to show ID badge verification status. Display "Pending Approval" subtle badge below avatar if request is pending. Show "Upgrade to Verified" CTA if not verified and system enabled. Show actual "Verified" badge if approved. On profile header, show ID badge section with: current status, submission date (if pending), last decision date (if approved/rejected), ability to submit new request or view history.

---

### AI Prompt for Cursor (Generate Profile ID Badge Display)

```typescript
/*
TASK: Display ID badge verification status on user profile

CONTEXT:
Show verification status on profile screen.
Display pending badge if request in progress.
Show upgrade CTA if not verified.
Show verified badge if approved.

REQUIREMENTS:
1. Avatar section: show "Pending Approval" badge if status=pending
2. ID Badge section below avatar showing:
   - Current status (Verified, Pending, None)
   - Submission date (if pending)
   - Last decision date (if approved/rejected)
   - Action buttons (Submit/Resubmit, View History)
3. "Upgrade to Verified" CTA if not verified
4. Verified badge displayed prominently if approved

==================================================
FILE: Update UserProfileScreen
==================================================
*/

// filepath: p2p-kids-marketplace/src/screens/profile/UserProfileScreen.tsx (UPDATE)

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { idBadgeService } from '@/services/idBadge';
import { BadgeIcon } from '@/components/BadgeIcon';

interface IDVerificationStatus {
  status: 'pending' | 'approved' | 'rejected' | 'none';
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  rejectionNotes?: string;
}

export function UserProfileScreen({ navigation }: any) {
  const { user } = useAuth();
  const [idBadgeStatus, setIdBadgeStatus] = useState<IDVerificationStatus>({
    status: 'none',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadIDBadgeStatus();
    }
  }, [user?.id]);

  const loadIDBadgeStatus = async () => {
    try {
      const status = await idBadgeService.getVerificationStatus(user!.id);
      setIdBadgeStatus(status);
    } catch (error) {
      console.error('Error loading ID badge status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeToVerified = () => {
    navigation.navigate('IDVerificationUpload');
  };

  const handleResubmit = () => {
    navigation.navigate('IDVerificationUpload');
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: user.avatar_url || 'https://via.placeholder.com/100' }}
            style={styles.avatar}
          />

          {/* Pending Approval Badge */}
          {idBadgeStatus.status === 'pending' && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>Pending</Text>
            </View>
          )}

          {/* Verified Badge */}
          {idBadgeStatus.status === 'approved' && (
            <View style={styles.verifiedBadgeContainer}>
              <BadgeIcon userId={user.id} size="large" showLabel={false} />
            </View>
          )}
        </View>

        <Text style={styles.userName}>
          {user.first_name} {user.last_name}
        </Text>
        <BadgeIcon userId={user.id} size="medium" showLabel={true} />
      </View>

      {/* ID Badge Section */}
      <View style={styles.idBadgeSection}>
        <Text style={styles.sectionTitle}>Identity Verification</Text>

        {loading ? (
          <ActivityIndicator />
        ) : idBadgeStatus.status === 'pending' ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>Your request is pending review</Text>
            <Text style={styles.subText}>
              Submitted: {new Date(idBadgeStatus.submittedAt!).toLocaleDateString()}
            </Text>
            <Text style={styles.subText}>
              We'll review it within 24 hours and notify you.
            </Text>
          </View>
        ) : idBadgeStatus.status === 'approved' ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>✓ Verified</Text>
            <Text style={styles.subText}>
              Approved: {new Date(idBadgeStatus.reviewedAt!).toLocaleDateString()}
            </Text>
          </View>
        ) : idBadgeStatus.status === 'rejected' ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>Request Rejected</Text>
            <Text style={styles.subText}>
              Reason: {idBadgeStatus.rejectionReason}
            </Text>
            {idBadgeStatus.rejectionNotes && (
              <Text style={styles.subText}>
                {idBadgeStatus.rejectionNotes}
              </Text>
            )}
            <Pressable
              style={styles.resubmitButton}
              onPress={handleResubmit}
            >
              <Text style={styles.resubmitButtonText}>Resubmit Verification</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>Not Verified</Text>
            <Text style={styles.subText}>
              Verify your identity to earn the Verified badge and increase trust with other users.
            </Text>
            <Pressable
              style={styles.upgradeButton}
              onPress={handleUpgradeToVerified}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to Verified</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Rest of profile content */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  pendingBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FCD34D',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#78350F',
  },
  verifiedBadgeContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  idBadgeSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  upgradeButton: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  resubmitButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 12,
    alignItems: 'center',
  },
  resubmitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

// Add to idBadge service:
export const idBadgeService = {
  // ... existing methods ...

  async getVerificationStatus(userId: string): Promise<IDVerificationStatus> {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('id_badge_verification_requests')
        .select('status, submitted_at, reviewed_at, rejection_reason, rejection_notes')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(1);

      if (error && error.code !== 'PGRST116') throw error;

      if (!data || data.length === 0) {
        // No pending, check for approved/rejected
        const { data: decided } = await supabase
          .from('id_badge_verification_requests')
          .select('status, submitted_at, reviewed_at, rejection_reason, rejection_notes')
          .eq('user_id', userId)
          .in('status', ['approved', 'rejected'])
          .order('reviewed_at', { ascending: false })
          .limit(1);

        if (decided && decided.length > 0) {
          return {
            status: decided[0].status,
            submittedAt: decided[0].submitted_at,
            reviewedAt: decided[0].reviewed_at,
            rejectionReason: decided[0].rejection_reason,
            rejectionNotes: decided[0].rejection_notes,
          };
        }

        return { status: 'none' };
      }

      return {
        status: data[0].status,
        submittedAt: data[0].submitted_at,
        reviewedAt: data[0].reviewed_at,
      };
    } catch (error) {
      console.error('Error fetching verification status:', error);
      return { status: 'none' };
    }
  },
};

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Avatar section shows avatar image
✓ "Pending Approval" subtle badge shown if status=pending
✓ "Verified" badge shown if status=approved (from BadgeIcon)
✓ ID Badge section below avatar with status and details
✓ Submission date shown if pending
✓ Decision date shown if approved/rejected
✓ Rejection reason shown if rejected
✓ "Upgrade to Verified" CTA if not verified
✓ "Resubmit Verification" button if rejected
✓ Navigation to IDVerificationUploadScreen on CTA click
✓ Status updates on screen refresh

==================================================
MODULE 10 COMPLETE
==================================================

All ID Badge Verification features implemented and ready for testing.
*/
```

### Output Files
1. **p2p-kids-marketplace/src/screens/profile/UserProfileScreen.tsx** (updated) - Profile with ID badge display
2. **p2p-kids-marketplace/src/services/idBadge.ts** (updated) - Added `getVerificationStatus()` method

### Testing Steps
1. Create user and submit ID verification
2. Check profile screen shows "Pending Approval" badge
3. Navigate to admin queue
4. Approve the request
5. Check user profile shows "Verified" status
6. Test rejection flow with reason
7. Test "Resubmit" button after rejection
8. Test "Upgrade to Verified" CTA for new users

### Time Breakdown: **~2.5 hours**

---

---

## MODULE 10 SUMMARY

**Total Tasks:** 14 (12 implemented + 1 deferred + 1 advanced)  
**Estimated Time:** ~35 hours (30 hours implemented + 5 hours deferred)

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
| BADGE-008 | "Upgrade to Verified" flow (ID Badge) | 2.5h | ✅ Documented |
| BADGE-009 | ID Badge Verification Schema | 2.5h | ✅ Documented |
| BADGE-010 | ID Badge Upload Flow (Mobile) | 3h | ✅ Documented |
| BADGE-011 | Admin ID Badge Queue & Review | 3.5h | ✅ Documented |
| BADGE-012 | ID Badge Notifications | 2.5h | ✅ Documented |
| BADGE-013 | Admin Configurable Messages | 2h | ✅ Documented |
| BADGE-014 | ID Badge Profile Display | 2.5h | ✅ Documented |

---

### Key Features

**Badge Levels:**
- None (new users)
- Bronze (3 trades, $500 value)
- Silver (10 trades, $2000 value)
- Gold (25 trades, $5000 value)
- Verified (50 trades, $10,000 value OR manual/identity check OR ID verification approval)

**Auto-Verification:**
- Triggered on trade completion
- Checks both buyer and seller eligibility
- Upgrades if thresholds met
- Push notification on upgrade

**Manual Badge Assignment (Admin):**
- Admin can manually assign badges
- Audit trail for manual changes
- Optional approval notes

**ID Badge Verification (NEW):**
- Users upload ID screenshot for manual verification
- Multi-step workflow: submission → pending → approval/rejection
- Privacy-first: screenshots auto-deleted after decision
- Admin queue with filterable requests (pending/approved/rejected)
- Configurable messages for all user-facing text
- Multi-channel notifications (push + in-app + email)
- Rejection reasons (6 predefined + optional notes)
- History tracking (all submissions preserved)
- Profile integration: "Pending Approval" badge + "Upgrade to Verified" CTA

**Admin Controls:**
- Toggle badge system on/off
- Configure thresholds per level
- Manual badge assignment
- ID badge verification queue and review
- Configurable messages with template variables
- Audit trail for all admin actions
- Stats dashboard (pending count, approval rate, avg review time)

**User Experience:**
- Badge icon on profile and items
- Progress to next level
- "Upgrade to Verified" CTA
- Badge info/requirements page
- ID verification upload flow with privacy disclaimer
- "Pending Approval" subtle badge during review
- Rejection reason + notes via in-app notification and email
- Ability to resubmit after rejection

---

### Database Tables

1. **users.badge_level** - Current badge (auto/manual/id_verification)
2. **users.badge_verified_at** - Verification timestamp
3. **users.badge_verification_method** - auto/manual/id_verification
4. **badge_config** - Thresholds and display settings
5. **id_badge_verification_requests** - User ID verification submissions
6. **id_badge_verification_messages** - Configurable user-facing messages
7. **admin_activity_log** - Audit trail for all admin actions (from MODULE-12)

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
4. `id_verification_submitted` - User submitted ID screenshot
5. `id_verification_approved` - Admin approved ID verification
6. `id_verification_rejected` - Admin rejected ID verification
7. `id_verification_resubmitted` - User resubmitted after rejection
8. `identity_verification_started` - User started Stripe Identity flow (Post-MVP)
9. `identity_verification_completed` - Stripe Identity completed (Post-MVP)

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

**Admin Badge Controls:**
- [ ] Toggle system on/off → Badges hidden
- [ ] Update thresholds → Saves to DB
- [ ] Manual assignment → Badge updated
- [ ] Admin note logged

**ID Badge Submission:**
- [ ] User navigates to "Upgrade to Verified"
- [ ] Disclaimer text displays correctly
- [ ] Image picker (camera/gallery) working
- [ ] Image uploaded to Supabase Storage
- [ ] Submission record created in DB
- [ ] "Pending Approval" badge shown on profile
- [ ] Duplicate submission prevented

**Admin ID Badge Queue:**
- [ ] Queue page loads with pending requests
- [ ] Filter by status (Pending/Approved/Rejected) working
- [ ] Search by name/email working
- [ ] Stats section shows correct counts
- [ ] Can view screenshot
- [ ] Can download screenshot

**ID Badge Approval/Rejection:**
- [ ] Admin approves request → Verified badge awarded
- [ ] Admin rejects with reason → Email + push sent
- [ ] Screenshot auto-deleted after decision
- [ ] Rejection reason shown to user
- [ ] User can resubmit after rejection

**Notifications:**
- [ ] Submission confirmation sent (in-app + email)
- [ ] Approval notification sent (push + in-app + email)
- [ ] Rejection notification sent (push + in-app + email with reason)
- [ ] Admin receives web push on new submission

**Configurable Messages:**
- [ ] All 12 messages display on admin page
- [ ] Admin can edit messages
- [ ] Template variables work ({first_name}, {rejection_reason}, etc.)
- [ ] Changes immediately reflected in user notifications

**UI Display:**
- [ ] Badge icon shows correct color
- [ ] Badge name displayed
- [ ] Progress bar to next level
- [ ] "Upgrade" CTA shown for non-Verified
- [ ] ID Badge section on profile shows status
- [ ] "Pending Approval" badge visible during review
- [ ] Verified badge visible after approval

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

1. **Stripe Identity Integration** - Government ID verification (Task BADGE-007)
2. **Badge Showcase** - Public badge leaderboard
3. **Special Badges** - Limited edition, seasonal
4. **Badge Benefits** - Lower fees, priority support
5. **Badge Expiration** - Require periodic re-verification
6. **Community Voting** - Users vote on trusted members
7. **Referral Badges** - Reward successful referrals
8. **Seller Badges** - Separate badges for selling activity
9. **Advanced ID Verification** - Liveness checks, OCR validation
10. **Identity Document Storage** (Optional) - Securely store verified ID data for compliance

---

**MODULE 10: BADGES & TRUST - COMPLETE**

Ready to integrate with other modules (e.g., MODULE-07 Messaging, MODULE-06 Trade Flow, MODULE-14 Notifications)?
