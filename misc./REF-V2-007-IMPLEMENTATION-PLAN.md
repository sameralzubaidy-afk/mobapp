# REF-V2-007 Implementation Plan

## Status: ✅ Config exists in DB, ❌ Admin UI not wired

## Discovery Summary

### Existing Implementation
✅ **Config keys exist in `sp_config` table** (migration 20260201000000):
- `referral_reward_referrer_sp` (default: 25)
- `referral_reward_referee_sp` (default: 10)

✅ **Referral rewards use config** (in `award_referral_sp` RPC)

✅ **Admin referrals page exists** (`/referrals`) with analytics

✅ **Admin config page exists** (`/config`) with edit UI pattern

### What's Missing (REF-V2-007 scope)
❌ "Manage Referral" card on admin home page
❌ Configuration tab on referrals page with editable fields
❌ API route to read/write `sp_config` (currently only `admin_config` API exists)
❌ Mobile app reading dynamic SP values from config
❌ Notifications using dynamic SP values

## Implementation Tasks

### TASK 1: Admin UI — Manage Referral Card + Configuration Tab
**Files to create/edit:**
1. `/p2p-kids-admin/src/app/page.tsx` - Add "Manage Referral" card
2. `/p2p-kids-admin/src/app/referrals/page.tsx` - Convert to tabbed layout
3. `/p2p-kids-admin/src/app/referrals/analytics-tab.tsx` - Move existing analytics
4. `/p2p-kids-admin/src/app/referrals/configuration-tab.tsx` - NEW config UI
5. `/p2p-kids-admin/src/lib/spConfigService.ts` - NEW client for sp_config

### TASK 2: Backend + Frontend Wiring
**Files to create/edit:**
1. `/p2p-kids-admin/src/app/api/admin/sp-config/route.ts` - NEW API for sp_config
2. `/p2p-kids-marketplace/src/services/referralConfig.ts` - NEW mobile service
3. `/p2p-kids-marketplace/src/screens/ReferralDashboardScreen.tsx` - Use dynamic values
4. Update notification text generation to use dynamic values

## File Manifest

### Admin App Files
```
p2p-kids-admin/
├── src/app/
│   ├── page.tsx (EDIT: add Manage Referral card)
│   ├── api/admin/sp-config/route.ts (NEW)
│   └── referrals/
│       ├── page.tsx (EDIT: convert to tabs)
│       ├── analytics-tab.tsx (NEW: move existing analytics)
│       └── configuration-tab.tsx (NEW: config form)
└── src/lib/
    └── spConfigService.ts (NEW)
```

### Mobile App Files
```
p2p-kids-marketplace/
└── src/
    ├── services/
    │   └── referralConfig.ts (NEW)
    └── screens/
        └── ReferralDashboardScreen.tsx (EDIT: use dynamic SP)
```

### Test Files
```
p2p-kids-admin/src/app/referrals/__tests__/
├── configuration-tab.test.tsx
└── sp-config-api.test.ts

p2p-kids-marketplace/src/__tests__/
├── services/referralConfig.test.ts
└── e2e/ref-v2-007-admin-config.e2e.ts
```

### Manual Test Guide
```
REF-V2-007-MANUAL-TESTING-GUIDE.md
```

## Verification Checklist Mapping

From MODULE-11-REFERRALS-VERIFICATION-V2.md:

### Section 6: Admin Referral Analytics
- [x] **K-factor calculation** - Already implemented
- [x] **Top referrers leaderboard** - Already implemented
- [x] **Conversion funnel** - Already implemented
- [ ] **Admin can configure SP bonus values** - REF-V2-007 implements this
- [ ] **Changes persist and affect future rewards** - REF-V2-007 implements this
- [ ] **UI displays configured values** - REF-V2-007 implements this

### New Items Added (REF-V2-007 specific)
- [ ] "Manage Referral" card visible on Admin Home
- [ ] Configuration tab shows current SP values from `sp_config`
- [ ] Admin can edit `referral_reward_referrer_sp` (default 25)
- [ ] Admin can edit `referral_reward_referee_sp` (default 10)
- [ ] Admin can edit `max_referral_extensions` (default 3)
- [ ] Admin can edit `referral_extension_days` (default 7)
- [ ] Admin can toggle `referral_program_enabled` flag
- [ ] Save button persists changes to `sp_config` table
- [ ] Mobile app reads and displays dynamic SP values
- [ ] Notifications use dynamic SP values in text
- [ ] Referral share message uses dynamic SP values

## Open Questions / Decisions
1. ✅ Config table: Use existing `sp_config` (not `admin_config`)
2. TODO: Should `max_referral_extensions` also be in `sp_config` or stay in `admin_config`?
3. TODO: Confirm admin RBAC - which roles can edit referral config?
4. TODO: Should values allow decimals or integers only? (Assuming integers)

## Next Steps
1. Run Tier 0: Typecheck + lint before coding
2. Implement admin UI changes (TASK 1)
3. Implement backend wiring (TASK 2)
4. Create unit + E2E tests
5. Create manual testing guide
6. Verify in staging environment
