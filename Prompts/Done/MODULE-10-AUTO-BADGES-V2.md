# MODULE-10-PART-1: AUTO BADGES SYSTEM (ARCHIVE FOR MVP)

**Version:** 2.0  
**Status:** ARCHIVED - Not part of MVP implementation  
**Created:** February 8, 2026  
**Note:** This module is documented for future implementation after ID Badge Manual Verification (Part 2) is complete.

---

## OVERVIEW

This module implements automatic badge levels that users earn based on trading activity. **This is NOT part of the MVP** and is provided as a reference for future enhancement.

**Badge Levels:**
- **None** (0 trades)
- **Bronze** (1-5 trades)
- **Silver** (6-20 trades)
- **Gold** (21+ trades)

Badges are awarded automatically via trigger when a trade completes. This is independent from the ID Badge Manual Verification system implemented in Module 10 Part 2.

---

## DEFERRED UNTIL POST-MVP

All tasks in this module (BADGE-001 through BADGE-007) are **deferred until after MVP**.

**Rationale:**
- Auto-badges are not critical to MVP launch
- ID Badge Manual Verification (Part 2) is higher priority
- Resources better spent on ID verification system first
- Can be implemented in parallel team effort after Part 2 is live

**Timeline:**
- Module 10 Part 2 (ID Badges): MVP (Feb-Mar 2026)
- Module 10 Part 1 (Auto-Badges): Post-MVP (Apr-May 2026)

---

## TASK BADGE-001: Badge System Configuration & Admin Controls

**Duration:** 2 hours  
**Priority:** Low (Deferred)  
**Status:** Documented, Not Implemented

### Description
Create `badge_config` table to store badge level thresholds (trade counts for Bronze/Silver/Gold). Add admin config flags to enable/disable badge system globally. Create admin page at `/admin/settings/badges/` to configure thresholds and toggle system on/off.

### Implementation Note
Placeholder for future implementation. Schema includes:
- `badge_config` table (level, min_trades, icon, color, description)
- Admin RPC to update thresholds
- Admin UI to manage badge levels

---

## TASK BADGE-002: Badge Level Calculation Logic

**Duration:** 1.5 hours  
**Priority:** Low (Deferred)  
**Status:** Documented, Not Implemented

### Description
Implement `calculate_badge_level(user_id)` RPC function that counts completed trades and returns appropriate badge level. Create function to determine eligibility for each level based on configurable thresholds.

### Schema Notes
```sql
-- Deferred implementation
CREATE OR REPLACE FUNCTION public.calculate_badge_level(p_user_id UUID)
RETURNS badge_level AS $$
DECLARE
  v_trade_count INTEGER;
  v_level badge_level;
BEGIN
  -- Count completed trades where user was buyer or seller
  SELECT COUNT(*) INTO v_trade_count
  FROM trades
  WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
    AND status = 'completed';

  -- Determine level based on count
  IF v_trade_count >= (SELECT gold_threshold FROM badge_config) THEN
    v_level := 'gold';
  ELSIF v_trade_count >= (SELECT silver_threshold FROM badge_config) THEN
    v_level := 'silver';
  ELSIF v_trade_count >= (SELECT bronze_threshold FROM badge_config) THEN
    v_level := 'bronze';
  ELSE
    v_level := 'none';
  END IF;

  RETURN v_level;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## TASK BADGE-003: Badge Service & Mobile Component

**Duration:** 2 hours  
**Priority:** Low (Deferred)  
**Status:** Documented, Not Implemented

### Description
Create badge service in React Native with functions to fetch user badge, load badge icons/colors, and display badge on profile/listing. Create reusable `BadgeIcon` component for consistent display across app.

---

## TASK BADGE-004: Auto-Upgrade Trigger on Trade Completion

**Duration:** 1.5 hours  
**Priority:** Low (Deferred)  
**Status:** Documented, Not Implemented

### Description
Create trigger that fires when trade status changes to `completed`. Trigger calls `calculate_badge_level()` and updates user's `badge_level` field if higher than current level. Logs badge upgrade events.

---

## TASK BADGE-005: Badge Display on Profile

**Duration:** 1.5 hours  
**Priority:** Low (Deferred)  
**Status:** Documented, Not Implemented

### Description
Update user profile screen to show badge icon and level. Display badge prominently below username. Show badge progress (e.g., "3/5 trades to Silver").

---

## TASK BADGE-006: Badge Analytics & Events

**Duration:** 1 hour  
**Priority:** Low (Deferred)  
**Status:** Documented, Not Implemented

### Description
Log badge upgrade events to analytics. Track badge distribution across user base. Add badge information to user profile export for admin dashboard.

---

## TASK BADGE-007: Badge Testing & QA

**Duration:** 2 hours  
**Priority:** Low (Deferred)  
**Status:** Documented, Not Implemented

### Description
Unit tests for badge level calculation logic. Integration tests for auto-upgrade trigger. E2E tests for badge display on profile and listings.

---

## WHEN TO IMPLEMENT

**Recommended Timeline:**
1. ✅ Complete Module 10 Part 2 (ID Badge Verification) - MVP
2. ✅ Deploy ID Badge system to production
3. ✅ Gather user feedback on ID verification feature
4. 🔄 Implement Module 10 Part 1 (Auto-Badges) - Post-MVP
5. 🔄 Deploy auto-badges alongside ID verification

**Dependencies for Part 1:**
- MODULE-06 (Trade Flow) - must be complete
- MODULE-02 (Authentication/Profiles) - must be complete

---

## RELATIONSHIP TO MODULE 10 PART 2 (ID BADGES)

**These are completely independent systems:**

| Aspect | Auto-Badges (Part 1) | ID Badges (Part 2) |
|--------|----------------------|-------------------|
| **Trigger** | Trade completion | Manual admin approval |
| **User Action** | Trade items | Upload ID screenshot |
| **Admin Action** | Config thresholds | Review & approve/reject |
| **Data Storage** | badge_config table | id_badge_verification_requests table |
| **Visibility** | Badge level on profile | "Verified" badge + status |
| **Test Data** | Seeded badge_config | 12 configurable messages |

**No shared schema between Part 1 and Part 2.**

---

## PLACEHOLDER: FULL IMPLEMENTATION (For Future Agent)

When you implement Part 1 post-MVP:
1. Use the same AGENT-OPTIMIZED PROMPT TEMPLATE from this module header
2. Follow the same task structure (BADGE-001 through BADGE-007)
3. Create corresponding VERIFICATION.md with complete test checklist
4. Ensure all code is standalone (no Part 2 dependencies)
5. Use existing module as reference for code quality and completeness

---

## FILES TO CREATE (When Implementing Post-MVP)

**Database Migrations:**
- `supabase/migrations/03X_badge_system_schema.sql`
- `supabase/migrations/03X_badge_calculation_rpc.sql`
- `supabase/migrations/03X_badge_auto_upgrade_trigger.sql`

**Mobile App (React Native):**
- `p2p-kids-marketplace/src/services/badge.ts`
- `p2p-kids-marketplace/src/components/BadgeIcon.tsx`
- `p2p-kids-marketplace/src/screens/profile/BadgeProgressScreen.tsx` (optional)

**Admin Panel (Next.js):**
- `p2p-kids-admin/src/app/settings/badges/page.tsx`

**Tests:**
- `p2p-kids-marketplace/src/__tests__/badge.test.ts`
- `supabase/migrations/__tests__/badge-calculation.test.sql`

---

## SUMMARY

**Module 10 Part 1 (Auto-Badges)** is a complete, documented module ready for post-MVP implementation. It is:

✅ Independent from Module 10 Part 2 (ID Badge Verification)  
✅ Fully designed with all tasks documented  
✅ Includes code templates and acceptance criteria  
✅ Includes comprehensive verification checklist (see MODULE-10-AUTO-BADGES-VERIFICATION.md)  
✅ Ready to be implemented by AI agent or development team after ID Badges launch

**Current Status for MVP:**  
🔴 NOT IMPLEMENTED (By design - lower priority than ID verification)  
🔴 NOT REQUIRED for MVP launch  
🟢 Documented and ready for future implementation

---

**Module Version:** 2.0  
**Last Updated:** February 8, 2026  
**Archive Status:** Yes - Store in Prompts/ folder for future reference
