# SUB-009: Quick Fix - Add Grace Period Banner to Dashboard

## ⚠️ MANUAL EDIT REQUIRED

**File:** `/p2p-kids-marketplace/src/screens/dashboard/UserDashboardScreen.tsx`

**Location:** Around line 237 (between `<TrialReminderBanner />` and `<CategorySelector />`)

---

## 🔧 Code to Add

Insert this block:

```tsx
        {/* MODULE-11 SUB-009: Grace Period Countdown Banner */}
        {((subscription.status === 'grace_period' || subscription.status === 'grace') && subscription.grace_period_ends_at) && (() => {
          const gracePeriodEndsAt = subscription.grace_period_ends_at;
          const daysRemaining = Math.ceil(
            (new Date(gracePeriodEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          return daysRemaining > 0 ? (
            <GracePeriodBanner
              gracePeriodEndsAt={gracePeriodEndsAt}
              daysRemaining={daysRemaining}
            />
          ) : null;
        })()}
```

---

## ✅ Verify After Edit

Run:
```bash
cd p2p-kids-marketplace
npm run typecheck && npm run lint
```

Both must pass with exit code 0 before testing in simulator.

---

## Context (Final Structure)

```tsx
        <TrialReminderBanner />

        {/* MODULE-11 SUB-009: Grace Period Countdown Banner */}
        {((subscription.status === 'grace_period' || subscription.status === 'grace') && subscription.grace_period_ends_at) && (() => {
          const gracePeriodEndsAt = subscription.grace_period_ends_at;
          const daysRemaining = Math.ceil(
            (new Date(gracePeriodEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          return daysRemaining > 0 ? (
            <GracePeriodBanner
              gracePeriodEndsAt={gracePeriodEndsAt}
              daysRemaining={daysRemaining}
            />
          ) : null;
        })()}

          <CategorySelector />
```

**Note:** Import is already added at top of file (line 24):
```tsx
import GracePeriodBanner from '../../components/GracePeriodBanner';
```

---

See **SUB-009-IMPLEMENTATION-INSTRUCTIONS.md** for full implementation details, testing guide, and remaining work.
