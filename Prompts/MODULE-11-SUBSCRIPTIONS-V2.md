# MODULE 11: SUBSCRIPTIONS (Kids Club+)

**Total Tasks:** 12  
**Estimated Time:** ~30 hours  
**Dependencies:** MODULE-02 (Authentication), MODULE-09 (Points & Gamification)  
**Version:** 2.0 - Aligned with SYSTEM_REQUIREMENTS_V2.md and BRD V2

---

## Changelog (Updated for V2)

- **Kids Club+ rebrand** from generic "Swap Club" to subscription-gated SP model
- **$7.99/month pricing** (changed from $9.99)

---

## TASK SUB-008: User-Initiated Cancellation Flow (Move to `cancelled` → `grace_period`)

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** SUB-002, SUB-006, SUB-007, MODULE-09 (wallet freeze)

### Description

Implement a **user-facing cancellation flow** that respects V2 rules:

1. A subscribed user (status `active` or `trial`) can open **Manage Kids Club+** screen.
2. They can tap **"Cancel Kids Club+"** and confirm via a clear, parent-friendly explanation.
3. If they are `active`, they keep Kids Club+ benefits until the current billing period ends, then move to `grace_period`.
4. When they move into `grace_period`, their SP wallet is frozen (handled via MODULE-09 API) and a 90-day countdown starts.
5. If they are in `trial`, cancellation ends trial immediately and moves them to `grace_period` (no SP access) or back to `free` depending on product decision; for V2, we choose **`grace_period` with frozen SP** if they used SP during trial, else `free`.

This task focuses on: (1) **API to request cancellation**, (2) **updating `user_subscriptions`** to mark `cancel_at_period_end` semantics in Stripe and our DB, and (3) **basic mobile UI** for cancellation confirmation.

### AI Prompt for Cursor

```typescript
/*
TASK: Implement user-initiated cancellation flow for Kids Club+

CONTEXT:
We already have Stripe subscriptions and webhook syncing. Now we need
the user-facing cancellation flow that:
- Marks Stripe subscription to cancel at period end
- Updates user_subscriptions to status `cancelled`
- Sets local `cancelled_at` and `cancel_reason`
- Triggers SP freeze only when the user actually enters grace_period

REQUIREMENTS:
1. Edge Function: cancel-kids-club-subscription
2. React Native screen: ManageKidsClubScreen with Cancel CTA
3. Ensure we do NOT immediately freeze SP; we only schedule cancellation
4. If user is in trial and cancels, end trial immediately and move to
   either `grace_period` (if they used SP) or `free`.

==================================================
FILE 1: Edge Function - cancel-kids-club-subscription
==================================================
*/

// filepath: supabase/functions/cancel-kids-club-subscription/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing auth token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw authError || new Error('Unauthorized');
    }

    const { reason } = await req.json();

    const { data: sub, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('id, status, stripe_subscription_id, trial_ends_at, current_period_end')
      .eq('user_id', user.id)
      .single();

    if (subError || !sub) {
      throw subError || new Error('Subscription not found');
    }

    // If user has Stripe subscription, set cancel_at_period_end
    if (sub.stripe_subscription_id) {
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    }

    let newStatus: 'cancelled' | 'grace_period' | 'free' = 'cancelled';
    let effectivePeriodEnd = sub.current_period_end || sub.trial_ends_at || new Date().toISOString();

    if (sub.status === 'trial') {
      // Trial cancellation: end immediately
      // If they had SP activity, we move to grace_period; otherwise free
      const { data: spStats, error: spError } = await supabaseClient
        .rpc('get_user_sp_activity_summary', { p_user_id: user.id });

      if (spError) {
        console.error('Error checking SP activity, defaulting to free:', spError);
        newStatus = 'free';
      } else {
        const hasSpActivity = spStats && (spStats.total_earned > 0 || spStats.total_spent > 0);
        newStatus = hasSpActivity ? 'grace_period' : 'free';
      }

      effectivePeriodEnd = new Date().toISOString();
    }

    const updates: any = {
      status: newStatus,
      cancel_reason: reason || null,
      cancelled_at: new Date().toISOString(),
      current_period_end: effectivePeriodEnd,
    };

    if (newStatus === 'grace_period') {
      const now = new Date();
      const graceEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
      updates.grace_period_ends_at = graceEnd;
    }

    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update(updates)
      .eq('id', sub.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('cancel-kids-club-subscription error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/*
==================================================
FILE 2: React Native screen - ManageKidsClubScreen
==================================================
*/

// filepath: src/screens/subscription/ManageKidsClubScreen.tsx

import React, { useState } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { Button } from '../../components/Button';
import { useSubscription } from '../../hooks/useSubscription';

export function ManageKidsClubScreen() {
  const { subscription, refresh } = useSubscription();
  const [isCancelling, setIsCancelling] = useState(false);

  if (!subscription) {
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    );
  }

  const handleCancel = () => {
    Alert.alert(
      'Cancel Kids Club+',
      'If you cancel, you will keep benefits until the end of your current billing period. After that, your Swap Points will be frozen for 90 days. If you do not return during that time, they will be permanently deleted.',
      [
        { text: 'Keep Kids Club+', style: 'cancel' },
        { text: 'Cancel Kids Club+', style: 'destructive', onPress: submitCancellation },
      ]
    );
  };

  const submitCancellation = async () => {
    try {
      setIsCancelling(true);
      const res = await fetch('/functions/v1/cancel-kids-club-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'user_initiated' }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to cancel');
      }

      await refresh();

      Alert.alert(
        'Cancellation Scheduled',
        json.status === 'cancelled'
          ? 'Your Kids Club+ benefits will continue until the end of this period. After that, your Swap Points will be frozen for 90 days.'
          : json.status === 'grace_period'
          ? 'Your Kids Club+ access has ended. Your Swap Points are now frozen for 90 days. If you re-subscribe before then, you can use them again.'
          : 'Your Kids Club+ trial has been cancelled. Because you did not use Swap Points, your account has returned to the free tier.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const isSubscriber =
    subscription.status === 'trial' ||
    subscription.status === 'active' ||
    subscription.status === 'cancelled';

  if (!isSubscriber) {
    return (
      <View>
        <Text>You are not currently subscribed to Kids Club+.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text>Manage Kids Club+</Text>
      <Text>Status: {subscription.status}</Text>
      {subscription.current_period_end && (
        <Text>Current period ends: {new Date(subscription.current_period_end).toLocaleDateString()}</Text>
      )}

      {isCancelling ? (
        <ActivityIndicator />
      ) : (
        <Button title="Cancel Kids Club+" variant="secondary" onPress={handleCancel} />
      )}
    </View>
  );
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Users can open Manage Kids Club+ and see their status
✓ Tapping Cancel shows a clear, parent-friendly explanation
✓ For active users, Stripe is set to cancel at period end
✓ For trial users, cancellation ends trial immediately
✓ user_subscriptions updated with cancel_reason and cancelled_at
✓ Trial users with SP activity move to grace_period; others to free

==================================================
NEXT TASK: SUB-009 (Grace Period Countdown & Expiry)
==================================================
*/
```

---

## TASK SUB-009: Grace Period Countdown, Reminders & Expiry

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** SUB-002, SUB-005, SUB-007, SUB-008, MODULE-09

### Description

Implement the **90-day grace period mechanics** after a user loses Kids Club+ access:

1. When a user transitions to `grace_period` (via webhook, trial-conversion, or cancellation), we set `grace_period_ends_at` to 90 days out and freeze their SP wallet (MODULE-09 handler).
2. Show a clear countdown in the app ("You have 63 days to re-subscribe before your Swap Points are deleted.").
3. Send **reminder notifications** as the grace period approaches expiry (e.g., 60, 30, 7, 1 days remaining).
4. When `grace_period_ends_at` passes, set status to `expired`, permanently delete SP and close the wallet per MODULE-09.

This task wires together cron, DB updates, SP wallet actions, and simple UI surface.

### AI Prompt for Cursor

```typescript
/*
TASK: Implement grace period countdown, reminders, and expiry

CONTEXT:
Users in status `grace_period` have 90 days to re-subscribe before
their Swap Points are permanently deleted. We must:
- Keep a clear single source of truth in user_subscriptions
- Send scheduled reminders
- Expire and wipe SP at grace_period_ends_at

REQUIREMENTS:
1. Edge Function: grace-period-cron (daily)
2. UI helper to show days remaining and status messaging
3. Integration call to MODULE-09 SP wallet expiry handler

==================================================
FILE 1: Edge Function - grace-period-cron
==================================================
*/

// filepath: supabase/functions/grace-period-cron/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type GraceStatus = 'grace_active' | 'expiring_soon' | 'expired_today';

serve(async (_req) => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: subs, error } = await supabaseClient
    .from('user_subscriptions')
    .select('id, user_id, grace_period_ends_at, status')
    .eq('status', 'grace_period')
    .not('grace_period_ends_at', 'is', null);

  if (error || !subs) {
    console.error('grace-period-cron: error fetching subs', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch' }), { status: 500 });
  }

  const now = new Date();

  for (const sub of subs) {
    const endsAt = new Date(sub.grace_period_ends_at as string);
    const diffMs = endsAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 0) {
      await expireSubscription(supabaseClient, sub.user_id, sub.id);
      continue;
    }

    const status: GraceStatus =
      daysRemaining <= 1 ? 'expired_today' : daysRemaining <= 7 ? 'expiring_soon' : 'grace_active';

    await maybeSendGraceReminder(supabaseClient, sub.user_id, daysRemaining, status);
  }

  return new Response(JSON.stringify({ success: true, processed: subs.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

async function expireSubscription(supabaseClient: any, userId: string, subId: string) {
  const { error } = await supabaseClient
    .from('user_subscriptions')
    .update({ status: 'expired' })
    .eq('id', subId);

  if (error) {
    console.error('expireSubscription: error updating status', error);
  }

  try {
    await fetch(Deno.env.get('SP_SUBSCRIPTION_EXPIRE_URL') || '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  } catch (err) {
    console.error('expireSubscription: error calling SP expiry handler', err);
  }
}

async function maybeSendGraceReminder(
  supabaseClient: any,
  userId: string,
  daysRemaining: number,
  status: GraceStatus
) {
  // This function is a placeholder for a real notification system.
  // For now, we just insert into a notifications table if thresholds hit.

  const thresholds = [60, 30, 7, 1];

  if (!thresholds.includes(daysRemaining)) {
    return;
  }

  const { error } = await supabaseClient.from('notifications').insert({
    user_id: userId,
    type: 'grace_period_reminder',
    payload: {
      days_remaining: daysRemaining,
      status,
    },
  });

  if (error) {
    console.error('maybeSendGraceReminder: error inserting notification', error);
  }
}

/*
==================================================
FILE 2: UI helper - useGracePeriodStatus hook
==================================================
*/

// filepath: src/hooks/useGracePeriodStatus.ts

import { useMemo } from 'react';
import { SubscriptionStatus } from '../types/subscription';

interface GraceInfo {
  isInGrace: boolean;
  daysRemaining: number | null;
  message: string | null;
}

interface Args {
  status: SubscriptionStatus;
  grace_period_ends_at: string | null;
}

export function useGracePeriodStatus({ status, grace_period_ends_at }: Args): GraceInfo {
  return useMemo(() => {
    if (status !== 'grace_period' || !grace_period_ends_at) {
      return { isInGrace: false, daysRemaining: null, message: null };
    }

    const now = new Date();
    const endsAt = new Date(grace_period_ends_at);
    const diffMs = endsAt.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    let message = '';

    if (daysRemaining === 0) {
      message =
        'Your grace period ends today. If you do not re-subscribe, your Swap Points will be permanently deleted.';
    } else if (daysRemaining <= 7) {
      message = `Your Swap Points are frozen. You have ${daysRemaining} day(s) left to re-subscribe before they are permanently deleted.`;
    } else {
      message = `Your Swap Points are frozen. You have ${daysRemaining} days left to re-subscribe before they are permanently deleted.`;
    }

    return { isInGrace: true, daysRemaining, message };
  }, [status, grace_period_ends_at]);
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Users in grace_period have a clear days-remaining message
✓ Daily cron checks all grace_period users
✓ Reminders sent at 60, 30, 7, and 1 days remaining
✓ At grace_period_ends_at, status transitions to expired
✓ SP wallet expiry handler called to permanently delete SP

==================================================
NEXT TASK: 11-F (UI Components + Admin - SUB-010, SUB-011)
==================================================
*/
```

---

<!-- 
MICRO-TASK 11-E COMPLETE
Next: 11-F (UI Components + Admin - SUB-010, SUB-011)
-->

---

## TASK SUB-010: Subscription UI Components (Member-Facing)

**Duration:** 3.5 hours  
**Priority:** High  
**Dependencies:** SUB-001–SUB-009, MODULE-09 (SP balances), app design system

### Description

Define and implement core **member-facing subscription UI** for Kids Club+ within the mobile app. The goal is to:

1. Clearly explain the value of Kids Club+ to parents.
2. Show current subscription state, SP access, and key dates.
3. Offer clear CTAs for **Try Free**, **Continue**, **Re-subscribe**, and **Manage** based on state.

This task does not re-spec every pixel; it creates **clear, generator-ready specs** for a minimal but polished V1 experience.

### Screens & Components

We will implement:

1. `KidsClubOverviewScreen` – Marketing + benefit explanation and primary entry point.
2. `SubscriptionStatusCard` – Reusable card summarizing current state, SP access, and fees.
3. `SubscriptionBanner` – Thin banner shown in key screens (home, SP wallet, listing flow) encouraging upgrade or resubscribe.

`ManageKidsClubScreen` was already introduced in SUB-008; SUB-010 just references it.

### AI Prompt for Cursor

```typescript
/*
TASK: Implement core Kids Club+ subscription UI components

CONTEXT:
Kids Club+ is a single tier subscription controlling SP access and
fees. We have subscription services (getSubscriptionSummary, etc.) and
hooks for grace period and trial. We need high-signal, parent-friendly
UI that:
- Explains benefits
- Shows current status (free, trial, active, grace_period, etc.)
- Presents appropriate CTAs per state

REQUIREMENTS:
1. Screen: KidsClubOverviewScreen
2. Component: SubscriptionStatusCard
3. Component: SubscriptionBanner

==================================================
FILE 1: Screen - KidsClubOverviewScreen
==================================================
*/

// filepath: src/screens/subscription/KidsClubOverviewScreen.tsx

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Button } from '../../components/Button';
import { useSubscription } from '../../hooks/useSubscription';
import { useGracePeriodStatus } from '../../hooks/useGracePeriodStatus';
import { SubscriptionStatusCard } from '../../components/subscription/SubscriptionStatusCard';

export function KidsClubOverviewScreen({ navigation }: any) {
  const { subscription, loading } = useSubscription();

  if (loading) {
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    );
  }

  const status = subscription?.status || 'free';
  const { message: graceMessage } = useGracePeriodStatus({
    status,
    grace_period_ends_at: subscription?.grace_period_ends_at || null,
  });

  const handlePrimaryCta = () => {
    if (!subscription || status === 'free') {
      navigation.navigate('TryKidsClub');
      return;
    }

    if (status === 'trial') {
      navigation.navigate('AddPaymentForKidsClub');
      return;
    }

    if (status === 'grace_period' || status === 'expired') {
      navigation.navigate('AddPaymentForKidsClub');
      return;
    }

    navigation.navigate('ManageKidsClub');
  };

  const primaryCtaLabel = (() => {
    if (!subscription || status === 'free') return 'Start 30-Day Free Trial';
    if (status === 'trial') return 'Continue Kids Club+';
    if (status === 'active' || status === 'cancelled') return 'Manage Kids Club+';
    if (status === 'grace_period') return 'Re-subscribe and Unlock SP';
    if (status === 'expired') return 'Re-subscribe (SP will start fresh)';
    return 'Learn More';
  })();

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>Kids Club+</Text>
      <Text style={{ marginBottom: 16 }}>
        Unlock Swap Points, reduced fees, and priority access for your family. Kids Club+ is designed
        for parents who want to stretch their budget while teaching kids the value of reuse.
      </Text>

      <SubscriptionStatusCard subscription={subscription} graceMessage={graceMessage} />

      <View style={{ marginVertical: 16 }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Why parents love Kids Club+</Text>
        <Text>• Earn Swap Points every time you sell items.
• Use points for discounts on future finds.
• Pay only $0.99 per transaction (vs $2.99).
• Get early access to new listings.
• Help your child learn smart money habits.</Text>
      </View>

      {graceMessage && (
        <View style={{ padding: 12, backgroundColor: '#FFF7E6', borderRadius: 8, marginBottom: 16 }}>
          <Text>{graceMessage}</Text>
        </View>
      )}

      <Button title={primaryCtaLabel} onPress={handlePrimaryCta} />
    </ScrollView>
  );
}

/*
==================================================
FILE 2: Component - SubscriptionStatusCard
==================================================
*/

// filepath: src/components/subscription/SubscriptionStatusCard.tsx

import React from 'react';
import { View, Text } from 'react-native';
import { formatPrice } from '../../services/subscription';

interface Props {
  subscription: any;
  graceMessage?: string | null;
}

export function SubscriptionStatusCard({ subscription, graceMessage }: Props) {
  if (!subscription) {
    return (
      <View style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' }}>
        <Text style={{ fontWeight: 'bold' }}>You are on the Free plan</Text>
        <Text>
          Upgrade to Kids Club+ to unlock Swap Points, reduced fees, priority matching, and more.
        </Text>
      </View>
    );
  }

  const { status, tier_name, price_cents, current_period_end } = subscription;

  const statusLabel = (() => {
    switch (status) {
      case 'trial':
        return 'On 30-day free trial';
      case 'active':
        return 'Kids Club+ is active';
      case 'cancelled':
        return 'Kids Club+ will end soon';
      case 'grace_period':
        return 'Grace period (SP frozen)';
      case 'expired':
        return 'Subscription expired';
      default:
        return 'Free plan';
    }
  })();

  return (
    <View style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' }}>
      <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>{tier_name || 'Kids Club+'}</Text>
      <Text style={{ marginBottom: 4 }}>{statusLabel}</Text>
      {price_cents != null && (
        <Text style={{ marginBottom: 4 }}>{formatPrice(price_cents)} / month</Text>
      )}
      {current_period_end &&
        (subscription.status === 'active' || subscription.status === 'cancelled') && (
          <Text>
            Current period ends: {new Date(current_period_end).toLocaleDateString()}
          </Text>
        )}
      {graceMessage && (
        <View style={{ marginTop: 8 }}>
          <Text>{graceMessage}</Text>
        </View>
      )}
    </View>
  );
}

/*
==================================================
FILE 3: Component - SubscriptionBanner
==================================================
*/

// filepath: src/components/subscription/SubscriptionBanner.tsx

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSubscription } from '../../hooks/useSubscription';

interface Props {
  navigation: any;
}

export function SubscriptionBanner({ navigation }: Props) {
  const { subscription } = useSubscription();
  const status = subscription?.status || 'free';

  if (status === 'active' || status === 'cancelled') {
    return null; // No banner for active subscribers
  }

  const isTrial = status === 'trial';
  const isGrace = status === 'grace_period';

  const message = (() => {
    if (isTrial) return 'You are on a free trial of Kids Club+. Add a card to keep your Swap Points.';
    if (isGrace) return 'Your Swap Points are frozen. Re-subscribe to use them again.';
    if (status === 'expired') return 'Kids Club+ expired. Re-subscribe to start earning Swap Points again.';
    return 'Unlock Swap Points and lower fees with Kids Club+.';
  })();

  const ctaLabel = (() => {
    if (isTrial) return 'Continue Kids Club+';
    if (isGrace) return 'Re-subscribe';
    if (status === 'expired') return 'Re-subscribe';
    return 'Start Free Trial';
  })();

  const handlePress = () => {
    if (status === 'free') {
      navigation.navigate('KidsClubOverview');
    } else if (isTrial) {
      navigation.navigate('AddPaymentForKidsClub');
    } else {
      navigation.navigate('KidsClubOverview');
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={{ padding: 12, backgroundColor: '#E6F3FF', borderRadius: 8, marginVertical: 8 }}
    >
      <View>
        <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Kids Club+</Text>
        <Text style={{ marginBottom: 4 }}>{message}</Text>
        <Text style={{ color: '#0066CC' }}>{ctaLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ KidsClubOverviewScreen shows benefits, status, and a clear primary CTA
✓ SubscriptionStatusCard reflects key states (free, trial, active, cancelled, grace_period, expired)
✓ SubscriptionBanner appears on key flows for non-active users
✓ CTAs route correctly to Try, Add Payment, or Manage screens

==================================================
NEXT TASK: SUB-011 (Admin Subscription Management Views)
==================================================
*/
```

---

## TASK SUB-011: Admin Subscription Management & Analytics

**Duration:** 3 hours  
**Priority:** Medium  
**Dependencies:** SUB-001–SUB-010, Admin auth (MODULE-02)

### Description

Define minimal admin-facing tooling to monitor and manage Kids Club+:

1. View list of current subscribers, trials, grace-period users, and expired users.
2. See key metrics: MRR, active subs, trials started, churn, grace → re-subscribe rate.
3. Perform safe admin actions: manually cancel, extend trial, or re-activate in edge cases.

Admin will mostly rely on Stripe Dashboard for billing operations; app admin UI is for **at-a-glance visibility** and a few controlled overrides.

### AI Prompt for Cursor

```typescript
/*
TASK: Implement admin subscription list + metrics view

CONTEXT:
We have subscription tables and Stripe as billing source. Admins
need a simple dashboard-like view in the internal web/admin app.

REQUIREMENTS:
1. Endpoint: /admin/subscriptions/summary (API handler)
2. React admin page: AdminSubscriptionsPage

==================================================
FILE 1: API handler - /admin/subscriptions/summary
==================================================
*/

// filepath: src/admin/api/getSubscriptionSummary.ts

import { supabaseAdmin } from '../supabaseAdminClient';

export interface AdminSubscriptionSummary {
  totals: {
    active: number;
    trial: number;
    grace_period: number;
    expired: number;
    free: number;
  };
  mrr_cents: number;
}

export async function getSubscriptionSummaryForAdmin(): Promise<AdminSubscriptionSummary> {
  const { data, error } = await supabaseAdmin
    .from('user_subscriptions')
    .select('status, monthly_price_cents');

  if (error || !data) {
    throw error || new Error('Failed to load subscription summary');
  }

  const totals = {
    active: 0,
    trial: 0,
    grace_period: 0,
    expired: 0,
    free: 0,
  };

  let mrr_cents = 0;

  for (const row of data as any[]) {
    totals[row.status as keyof typeof totals] =
      (totals[row.status as keyof typeof totals] || 0) + 1;

    if (row.status === 'active' || row.status === 'cancelled') {
      mrr_cents += row.monthly_price_cents || 0;
    }
  }

  return { totals, mrr_cents };
}

/*
==================================================
FILE 2: Admin page - AdminSubscriptionsPage
==================================================
*/

// filepath: src/admin/pages/AdminSubscriptionsPage.tsx

import React, { useEffect, useState } from 'react';
import { getSubscriptionSummaryForAdmin, AdminSubscriptionSummary } from '../api/getSubscriptionSummary';

export function AdminSubscriptionsPage() {
  const [summary, setSummary] = useState<AdminSubscriptionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSubscriptionSummaryForAdmin();
        setSummary(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load summary');
      }
    })();
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!summary) {
    return <div>Loading...</div>;
  }

  const { totals, mrr_cents } = summary;

  return (
    <div style={{ padding: 24 }}>
      <h1>Kids Club+ Subscriptions</h1>
      <p>MRR: ${(mrr_cents / 100).toFixed(2)}</p>

      <h2>Status Breakdown</h2>
      <ul>
        <li>Active: {totals.active}</li>
        <li>Trial: {totals.trial}</li>
        <li>Grace Period: {totals.grace_period}</li>
        <li>Expired: {totals.expired}</li>
        <li>Free: {totals.free}</li>
      </ul>

      <p style={{ marginTop: 16 }}>
        For detailed billing events, refunds, and payment method issues, continue to use the Stripe
        Dashboard. This view is intended for quick health checks and planning.
      </p>
    </div>
  );
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Admin can see high-level subscription status counts and MRR
✓ Summary endpoint reads from user_subscriptions
✓ Cancelled/active users contribute to MRR
✓ Page explains that Stripe remains the source of truth for billing ops

==================================================
NEXT TASK: 11-G (Tests + Module Summary - SUB-012)
==================================================
*/
```

---

<!-- 
MICRO-TASK 11-F COMPLETE
Next: 11-G (Tests + Module Summary - SUB-012)
-->

---

## TASK SUB-012: Tests, Observability & Module Summary

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** SUB-001–SUB-011, MODULE-09

### Description

Define a **minimal but high-signal test and observability plan** and capture a concise module summary and file list so downstream agents/engineers know exactly what to verify and where everything lives.

### AI Prompt for Cursor

```typescript
/*
TASK: Add tests + summary for MODULE-11 (Kids Club+ Subscriptions)

CONTEXT:
We have DB schema, edge functions, mobile UI, and admin views for
Kids Club+. Now we need:
- A few focused integration/unit test specs
- Basic observability hooks (logging + TODOs for metrics)
- A concise module summary + file index inside this doc

REQUIREMENTS:
1. Vitest tests for subscription utilities
2. Edge function test harness stubs
3. Append "Module Summary" section to this file

==================================================
FILE 1: Vitest tests - subscription permissions & helpers
==================================================
*/

// filepath: src/services/subscription/subscription.test.ts

import { describe, it, expect } from 'vitest';
import { getSubscriptionPermissions } from '../../types/subscription';
import { formatPrice, getTrialDaysRemaining, getGraceDaysRemaining } from './index';

describe('subscription helpers', () => {
  it('applies reduced fees for subscribers', () => {
    const trial = getSubscriptionPermissions('trial');
    const active = getSubscriptionPermissions('active');
    const free = getSubscriptionPermissions('free');

    expect(trial.reduced_fee).toBe(true);
    expect(active.reduced_fee).toBe(true);
    expect(free.reduced_fee).toBe(false);
  });

  it('gates SP access correctly by status', () => {
    const trial = getSubscriptionPermissions('trial');
    const active = getSubscriptionPermissions('active');
    const cancelled = getSubscriptionPermissions('cancelled');
    const grace = getSubscriptionPermissions('grace_period');

    expect(trial.can_earn_sp).toBe(true);
    expect(trial.can_spend_sp).toBe(true);
    expect(active.can_earn_sp).toBe(true);
    expect(active.can_spend_sp).toBe(true);

    // Cancelled keeps fee benefit but no SP
    expect(cancelled.can_earn_sp).toBe(false);
    expect(cancelled.can_spend_sp).toBe(false);

    // Grace has no SP access
    expect(grace.can_earn_sp).toBe(false);
    expect(grace.can_spend_sp).toBe(false);
  });

  it('formats prices as dollars', () => {
    expect(formatPrice(799)).toBe('$7.99');
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('computes trial days remaining', () => {
    const now = new Date();
    const future = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const past = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();

    expect(getTrialDaysRemaining(future)).toBeGreaterThanOrEqual(9);
    expect(getTrialDaysRemaining(past)).toBe(0);
  });

  it('computes grace days remaining', () => {
    const now = new Date();
    const future = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const past = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();

    expect(getGraceDaysRemaining(future)).toBeGreaterThanOrEqual(4);
    expect(getGraceDaysRemaining(past)).toBe(0);
  });
});

/*
==================================================
FILE 2: Edge function test harness stubs (manual / future automation)
==================================================
*/

// filepath: supabase/functions/tests/subscriptions_test_plan.md

/*
This file is a test plan + TODO for automating edge function tests.

SCENARIOS TO COVER (manually or via future automation):

1) start-trial
   - Given a user with no prior trial, calling start-trial creates
     user_subscriptions row with status=trial, trial_started_at,
     trial_ends_at ≈ now + 30 days.
   - Given a user with has_used_trial=true, start-trial returns error.

2) trial-reminders
   - Seed user_subscriptions with trial_ends_at = 7 days from now.
   - Run trial-reminders function and assert that no reminders are
     created.
   - Adjust trial_ends_at so effective day is 23, 28, 29 and assert
     one notification per threshold, idempotent across multiple runs.

3) trial-conversion
   - For Stripe-active user, ensure status becomes active and
     has_used_trial=true.
   - For non-active/canceled Stripe sub, ensure status becomes
     grace_period, grace_period_ends_at set, and SP freeze handler
     invoked.

4) create-kids-club-subscription
   - For trial user with no stripe_customer_id, ensure customer is
     created, subscription is created with trial_end, and DB updated.

5) stripe-webhook-subscriptions
   - subscription.updated with cancel_at_period_end=true → status
     cancelled.
   - subscription.deleted → status grace_period + SP freeze.
   - invoice.payment_failed (3 times) → status grace_period.

6) cancel-kids-club-subscription
   - Active user: Stripe cancel_at_period_end set, status cancelled,
     current_period_end kept, SP not yet frozen.
   - Trial user with SP activity: immediate grace_period + 90-day end.
   - Trial user with no SP activity: status free.

7) grace-period-cron
   - Users with daysRemaining 60, 30, 7, 1 → notifications created.
   - Users with daysRemaining <= 0 → status expired and SP expiry
     handler called.

Note: Implement these as proper automated tests in a future pass
using a Deno test harness or local Supabase test environment.
*/

/*
==================================================
FILE 3: MODULE-11 Summary & File Index (this doc)
==================================================
*/
```

---

## MODULE-11: Summary & File Index

### Business Role

MODULE-11 defines **Kids Club+ subscriptions** as the gatekeeper for Swap Points access and reduced fees. It encodes:

- A single subscription tier (Kids Club+) at $7.99/month.  
- A 30-day no-card trial and 90-day grace period after loss of access.  
- State transitions between `free`, `trial`, `active`, `cancelled`, `grace_period`, and `expired`.  
- Stripe-backed billing, with internal DB tables and functions as the **product source of truth**.

### Cross-Module Contracts

- **With MODULE-02 (Auth):** Uses user IDs and optional `stripe_customer_id` from the users table; admin checks rely on user roles.
- **With MODULE-09 (SP):**
  - `can_user_earn_sp`, `can_user_spend_sp`, and transaction fee logic depend on subscription status.  
  - SP wallet freeze on subscription lapse (`grace_period`) and SP deletion on `expired` use MODULE-09 HTTP handlers via `SP_SUBSCRIPTION_LAPSE_URL` and `SP_SUBSCRIPTION_EXPIRE_URL`.

### Key Files Introduced in This Module

**Database & Functions**
- `supabase/migrations/050_subscription_tiers.sql` – `subscription_tiers`, `subscription_features` schema + seeds.  
- `supabase/migrations/051_user_subscriptions.sql` – `user_subscriptions` schema and enum.  
- `supabase/migrations/052_subscription_functions.sql` – helper functions: `get_subscription_status`, `can_user_earn_sp`, `can_user_spend_sp`, `get_user_transaction_fee`, `is_user_trial_eligible`, `get_subscription_summary`.

**Types & Services**
- `src/types/subscription.ts` – `SubscriptionStatus`, `SubscriptionTier`, `SubscriptionFeature`, `SubscriptionPermissions`, `getSubscriptionPermissions`.  
- `src/services/subscription/index.ts` – RPC wrappers and helpers: `getSubscriptionSummary`, `canUserEarnSp`, `canUserSpendSp`, `getUserTransactionFee`, `isUserTrialEligible`, `formatPrice`, `getTrialDaysRemaining`, `getGraceDaysRemaining`.  
- `src/services/subscription/subscription.test.ts` – helper tests (permissions, price formatting, trial/grace day calcs).

**Edge Functions (Supabase)**
- `supabase/functions/start-trial/index.ts` – start 30-day trial.  
- `supabase/functions/trial-reminders/index.ts` – day 23/28/29 reminders.  
- `supabase/functions/trial-conversion/index.ts` – post-trial conversion or downgrade to grace.  
- `supabase/functions/create-kids-club-subscription/index.ts` – create Stripe subscription for Kids Club+.  
- `supabase/functions/stripe-webhook-subscriptions/index.ts` – Stripe webhook for subscription updates and payment failures.  
- `supabase/functions/cancel-kids-club-subscription/index.ts` – user-initiated cancellation.  
- `supabase/functions/grace-period-cron/index.ts` – daily grace-period countdown, reminders, and expiry.  
- `supabase/functions/tests/subscriptions_test_plan.md` – edge-function test plan (manual/future automation).

**Mobile App (Member-Facing)**
- `src/screens/subscription/TryKidsClubScreen.tsx` – entry to start free trial.  
- `src/screens/subscription/KidsClubOverviewScreen.tsx` – benefits, status, and primary CTA.  
- `src/screens/subscription/ManageKidsClubScreen.tsx` – manage/cancel subscription and show period end/grace copy.  
- `src/components/subscription/SubscriptionStatusCard.tsx` – reusable subscription status UI.  
- `src/components/subscription/SubscriptionBanner.tsx` – upgrade/resubscribe banner.  
- `src/hooks/useGracePeriodStatus.ts` – grace-period countdown and messaging helper.

**Admin App**
- `src/admin/api/getSubscriptionSummary.ts` – admin metrics endpoint (status counts + MRR).  
- `src/admin/pages/AdminSubscriptionsPage.tsx` – internal dashboard view for Kids Club+ health.

### Implementation Notes

- Stripe is the **billing source of truth**, but `user_subscriptions` is the **product state source of truth** used by the rest of the app.  
- All transitions that affect SP (entering grace, expiring) must call MODULE-09 handlers; this coupling is intentional and documented in both modules.  
- Cancellation is “soft” until period end; only `grace_period` and `expired` fully remove SP access.

### Next Steps

- Use `MODULE-11-VERIFICATION-V2.md` to formalize test/QA scenarios across DB, edge functions, and UI.  
- During implementation, keep observability consistent (structured logs, TODOs for metrics + dashboards) so subscription health can be monitored from day one.

---

<!-- 
MICRO-TASK 11-G COMPLETE
Next: MODULE-11-VERIFICATION-V2.md and PHASE 1 CHECKPOINT
-->

- **30-day free trial** (changed from 7-day) - no credit card required
- **SP gating** - subscription controls SP earning/spending access
- **90-day grace period** for cancelled subscriptions before SP expiration
- **Trial reminders** at Day 23, 28, 29 before trial ends
- **Differentiated fees** - $0.99 for subscribers vs $2.99 for free users
- **Priority matching** - subscribers prioritized in search/discovery
- **Early access** - 30 minutes early access to new listings

---

## V2 Key Changes Summary

| Aspect | V1 (Old) | V2 (New) |
|--------|----------|----------|
| **Name** | Swap Club | Kids Club+ |
| **Price** | $9.99/month | $7.99/month |
| **Trial Period** | 7 days | 30 days (no card required) |
| **SP Access** | Separate from subscription | Gated by subscription |
| **Cancellation** | Immediate loss | 90-day grace period |
| **Transaction Fee** | Same for all | $0.99 (subscriber) / $2.99 (free) |
| **Priority Matching** | Not implemented | Subscribers first |
| **Early Access** | Not implemented | 30 min head start |

---

## Module Overview

### Purpose

The Kids Club+ subscription is the **primary revenue driver** and **SP gating mechanism** for the platform. This module manages:

1. **Subscription Lifecycle** - Trial → Active → Cancelled → Expired
2. **SP Access Control** - Only subscribers can earn/spend Swap Points
3. **Billing Integration** - Stripe subscription management
4. **Grace Period** - 90 days to recover SP after cancellation
5. **User Experience** - Compelling value proposition for conversion

### Business Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    KIDS CLUB+ VALUE PROPOSITION                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FREE TIER ($0/month)           KIDS CLUB+ ($7.99/month)        │
│  ─────────────────────          ──────────────────────────      │
│  ✓ Browse all listings          ✓ Everything in Free, PLUS:    │
│  ✓ Create listings              ✓ Earn Swap Points on sales    │
│  ✓ Buy items (cash only)        ✓ Spend SP for discounts       │
│  ✓ Sell items                   ✓ Donate items for badges      │
│  ✓ Message other users          ✓ Reduced fee: $0.99/txn       │
│  ✗ $2.99 transaction fee        ✓ Priority in search results   │
│  ✗ Cannot earn SP               ✓ 30-min early access          │
│  ✗ Cannot spend SP              ✓ Priority support             │
│  ✗ Cannot donate                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Revenue Projections

| Metric | Year 1 Target |
|--------|---------------|
| MAU | ~7,200 users |
| KC+ Subscribers | 2,160 (30% conversion) |
| Monthly Subscription Revenue | $17,257 |
| Annual Subscription Revenue | $207,084 |
| LTV per Subscriber | ~$96 (12 months avg) |

---

## Subscription States & Transitions

```
┌──────────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION STATE MACHINE                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│    ┌─────────┐                                                   │
│    │  FREE   │ ◄─────────────────────────────────────┐           │
│    │ (No SP) │                                       │           │
│    └────┬────┘                                       │           │
│         │ User starts trial                          │           │
│         ▼                                            │           │
│    ┌─────────┐                                       │           │
│    │  TRIAL  │ (30 days, full SP access)            │           │
│    │         │                                       │           │
│    └────┬────┘                                       │           │
│         │                                            │           │
│    ┌────┴────┐                                       │           │
│    │         │                                       │           │
│    ▼         ▼                                       │           │
│ ┌──────┐  ┌──────────┐                              │           │
│ │ACTIVE│  │TRIAL_END │ (didn't convert)             │           │
│ │(Paid)│  │(SP frozen)│ ───────────────────────────►│           │
│ └──┬───┘  └──────────┘         (90 days)            │           │
│    │                                                 │           │
│    │ User cancels                                    │           │
│    ▼                                                 │           │
│ ┌─────────┐                                         │           │
│ │CANCELLED│ (access until period_end)               │           │
│ │         │                                         │           │
│ └────┬────┘                                         │           │
│      │ Period ends                                   │           │
│      ▼                                              │           │
│ ┌──────────┐                                        │           │
│ │  GRACE   │ (90 days, SP frozen)                   │           │
│ │  PERIOD  │                                        │           │
│ └────┬─────┘                                        │           │
│      │                                               │           │
│  ┌───┴───┐                                          │           │
│  │       │                                          │           │
│  ▼       ▼                                          │           │
│┌──────┐ ┌───────┐                                   │           │
││ACTIVE│ │EXPIRED│ (SP permanently deleted) ─────────┘           │
││(Re-  │ │       │                                               │
││ sub) │ └───────┘                                               │
│└──────┘                                                          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### State Definitions

| State | SP Access | Description |
|-------|-----------|-------------|
| `free` | ❌ None | Never subscribed or expired |
| `trial` | ✅ Full | In 30-day free trial |
| `active` | ✅ Full | Paid subscription active |
| `cancelled` | ✅ Until period end | Cancelled but still in paid period |
| `grace_period` | ❌ Frozen | 90 days to resubscribe |
| `expired` | ❌ Deleted | SP permanently lost |

---

## Agent-Optimized Prompt Template

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
6. Add concise TODO comments where manual verification is required.

VERIFICATION STEPS (agent must print results):
- TypeScript type-check: `npm run type-check`
- Linting: `npm run lint`
- Tests: `npm test -- --testPathPattern=<new tests>`

ERROR HANDLING RULES:
- If a required file/dependency is missing, stop and report exact missing paths.
- For Stripe secrets, inject clear TODOs and do not attempt to store secrets in code.
- For database schema mismatches, add migration stubs and mark for manual review.

V2 CRITICAL REQUIREMENTS:
- Kids Club+ is the ONLY subscription tier (no multi-tier in MVP)
- $7.99/month pricing
- 30-day free trial (no credit card required to start)
- SP access gated by subscription status
- 90-day grace period on cancellation
- Differentiated transaction fees ($0.99 vs $2.99)
```

---

## TASK SUB-001: Kids Club+ Subscription Tier Schema

**Duration:** 2 hours  
**Priority:** Critical  
**Dependencies:** MODULE-01 (Infrastructure)

### Description

Create the subscription tier configuration. For MVP, we have a **single tier** (Kids Club+) but the schema supports future multi-tier expansion. The tier defines pricing, trial period, features, and is admin-configurable.

### AI Prompt for Cursor

```typescript
/*
TASK: Create Kids Club+ subscription tier schema

CONTEXT:
Single subscription tier for MVP: Kids Club+ at $7.99/month with 30-day trial.
Schema should support future multi-tier but seed only KC+ for now.

REQUIREMENTS:
1. Create subscription_tiers table
2. Seed Kids Club+ tier with correct V2 pricing
3. Create subscription_features table for feature flags
4. Admin can edit tier settings

==================================================
FILE 1: Database migration for subscription tiers
==================================================
*/

-- filepath: supabase/migrations/050_subscription_tiers.sql

-- Subscription tier table
CREATE TABLE subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,                    -- Internal name (e.g., 'kids_club_plus')
  display_name TEXT NOT NULL,                   -- User-facing name (e.g., 'Kids Club+')
  description TEXT,
  price_cents INTEGER NOT NULL,                 -- Monthly price in cents (799 = $7.99)
  currency TEXT NOT NULL DEFAULT 'usd',
  trial_days INTEGER NOT NULL DEFAULT 30,       -- V2: 30-day trial
  grace_period_days INTEGER NOT NULL DEFAULT 90, -- V2: 90-day grace period
  stripe_price_id TEXT,                         -- Stripe Price ID for billing
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,   -- Default tier for new subscriptions
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription features/perks table
CREATE TABLE subscription_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id UUID NOT NULL REFERENCES subscription_tiers(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,                    -- e.g., 'can_earn_sp', 'priority_matching'
  feature_name TEXT NOT NULL,                   -- Display name
  feature_description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(tier_id, feature_key)
);

-- Indexes
CREATE INDEX subscription_tiers_is_active_idx ON subscription_tiers(is_active);
CREATE INDEX subscription_tiers_is_default_idx ON subscription_tiers(is_default);
CREATE INDEX subscription_features_tier_id_idx ON subscription_features(tier_id);

-- Updated_at trigger
CREATE TRIGGER update_subscription_tiers_updated_at
  BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed Kids Club+ tier (V2 pricing)
INSERT INTO subscription_tiers (
  name, 
  display_name, 
  description, 
  price_cents, 
  trial_days, 
  grace_period_days,
  is_active, 
  is_default
) VALUES (
  'kids_club_plus',
  'Kids Club+',
  'Unlock Swap Points, reduced fees, and priority access',
  799,          -- $7.99/month
  30,           -- 30-day free trial
  90,           -- 90-day grace period
  true,
  true
);

-- Seed Kids Club+ features
INSERT INTO subscription_features (tier_id, feature_key, feature_name, feature_description, sort_order)
SELECT 
  id,
  feature_key,
  feature_name,
  feature_description,
  sort_order
FROM subscription_tiers, (VALUES
  ('can_earn_sp', 'Earn Swap Points', 'Earn SP on every sale you make', 1),
  ('can_spend_sp', 'Spend Swap Points', 'Use SP for discounts on purchases', 2),
  ('can_donate', 'Donate for Badges', 'Give items away and earn donation badges', 3),
  ('reduced_fee', 'Reduced Transaction Fee', 'Pay only $0.99 per transaction (vs $2.99)', 4),
  ('priority_matching', 'Priority Matching', 'Your listings appear higher in search', 5),
  ('early_access', 'Early Access', 'See new listings 30 minutes before others', 6),
  ('priority_support', 'Priority Support', 'Get help faster with priority email support', 7)
) AS features(feature_key, feature_name, feature_description, sort_order)
WHERE subscription_tiers.name = 'kids_club_plus';

-- RLS Policies
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_features ENABLE ROW LEVEL SECURITY;

-- Anyone can view active tiers (for pricing page)
CREATE POLICY "Anyone can view active tiers"
  ON subscription_tiers FOR SELECT
  USING (is_active = true);

-- Anyone can view features (for pricing page)
CREATE POLICY "Anyone can view features"
  ON subscription_features FOR SELECT
  USING (true);

-- Only admins can modify tiers
CREATE POLICY "Admins can manage tiers"
  ON subscription_tiers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Only admins can modify features
CREATE POLICY "Admins can manage features"
  ON subscription_features FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

/*
==================================================
FILE 2: TypeScript types for subscription tiers
==================================================
*/

// filepath: src/types/subscription.ts

export type SubscriptionStatus = 
  | 'free'           // Never subscribed
  | 'trial'          // In 30-day trial
  | 'active'         // Paid and active
  | 'cancelled'      // Cancelled, access until period_end
  | 'grace_period'   // 90 days to resubscribe
  | 'expired';       // SP permanently lost

export interface SubscriptionTier {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  trial_days: number;
  grace_period_days: number;
  stripe_price_id: string | null;
  is_active: boolean;
  is_default: boolean;
  features?: SubscriptionFeature[];
}

export interface SubscriptionFeature {
  id: string;
  tier_id: string;
  feature_key: string;
  feature_name: string;
  feature_description: string | null;
  is_enabled: boolean;
  sort_order: number;
}

export interface SubscriptionPermissions {
  can_earn_sp: boolean;
  can_spend_sp: boolean;
  can_donate: boolean;
  reduced_fee: boolean;
  priority_matching: boolean;
  early_access: boolean;
  priority_support: boolean;
  transaction_fee_cents: number; // 99 for subscribers, 299 for free
}

// Helper to get permissions based on status
export function getSubscriptionPermissions(status: SubscriptionStatus): SubscriptionPermissions {
  const isSubscriber = status === 'trial' || status === 'active' || status === 'cancelled';
  
  return {
    can_earn_sp: status === 'trial' || status === 'active',
    can_spend_sp: status === 'trial' || status === 'active',
    can_donate: status === 'trial' || status === 'active',
    reduced_fee: isSubscriber,
    priority_matching: isSubscriber,
    early_access: isSubscriber,
    priority_support: isSubscriber,
    transaction_fee_cents: isSubscriber ? 99 : 299,
  };
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ subscription_tiers table created
✓ subscription_features table created
✓ Kids Club+ tier seeded with $7.99 price
✓ 30-day trial configured
✓ 90-day grace period configured
✓ 7 features seeded
✓ RLS policies applied
✓ TypeScript types exported

==================================================
NEXT TASK: SUB-002
==================================================
*/
```

---

### Output Files

1. **supabase/migrations/050_subscription_tiers.sql** - Tier and features schema
2. **src/types/subscription.ts** - TypeScript type definitions

### Time Breakdown

| Activity | Time |
|----------|------|
| Create subscription_tiers schema | 30 min |
| Create subscription_features schema | 20 min |
| Seed Kids Club+ data | 15 min |
| Create TypeScript types | 30 min |
| RLS policies | 15 min |
| Testing | 10 min |
| **Total** | **~2 hours** |

---

## TASK SUB-002: User Subscriptions Table & Status Management

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** SUB-001 (Tier schema), MODULE-02 (Users table)

### Description

Create the user_subscriptions table to track each user's subscription status, billing dates, trial info, and grace period. This is the core table that gates SP access.

### AI Prompt for Cursor

```typescript
/*
TASK: Create user subscriptions tracking table

CONTEXT:
Track user subscription status, integrate with Stripe, manage trial/grace periods.
This table is queried to determine SP access permissions.

REQUIREMENTS:
1. Create user_subscriptions table
2. Track trial, billing, cancellation dates
3. Link to Stripe subscription
4. Function to check subscription status
5. Function to get transaction fee for user

==================================================
FILE 1: Database migration for user subscriptions
==================================================
*/

-- filepath: supabase/migrations/051_user_subscriptions.sql

-- Subscription status enum
CREATE TYPE subscription_status AS ENUM (
  'free',           -- Never subscribed
  'trial',          -- In 30-day free trial
  'active',         -- Paid subscription active
  'cancelled',      -- Cancelled, access until period_end
  'grace_period',   -- 90 days to resubscribe (SP frozen)
  'expired'         -- SP permanently deleted
);

-- User subscriptions table
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES subscription_tiers(id),
  
  -- Status
  status subscription_status NOT NULL DEFAULT 'free',
  
  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_payment_method_id TEXT,
  
  -- Trial tracking
  trial_started_at TIMESTAMP WITH TIME ZONE,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  trial_reminder_sent_day_23 BOOLEAN DEFAULT false,
  trial_reminder_sent_day_28 BOOLEAN DEFAULT false,
  trial_reminder_sent_day_29 BOOLEAN DEFAULT false,
  has_used_trial BOOLEAN DEFAULT false,  -- One trial per user ever
  
  -- Billing period
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  
  -- Cancellation & grace period
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancel_reason TEXT,
  grace_period_ends_at TIMESTAMP WITH TIME ZONE,
  grace_reminder_sent_day_60 BOOLEAN DEFAULT false,
  grace_reminder_sent_day_30 BOOLEAN DEFAULT false,
  grace_reminder_sent_day_7 BOOLEAN DEFAULT false,
  grace_reminder_sent_day_1 BOOLEAN DEFAULT false,
  
  -- Payment failure tracking
  payment_failed_at TIMESTAMP WITH TIME ZONE,
  payment_retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX user_subscriptions_user_id_idx ON user_subscriptions(user_id);
CREATE INDEX user_subscriptions_status_idx ON user_subscriptions(status);
CREATE INDEX user_subscriptions_stripe_customer_id_idx ON user_subscriptions(stripe_customer_id);
CREATE INDEX user_subscriptions_stripe_subscription_id_idx ON user_subscriptions(stripe_subscription_id);
CREATE INDEX user_subscriptions_trial_ends_at_idx ON user_subscriptions(trial_ends_at) 
  WHERE status = 'trial';
CREATE INDEX user_subscriptions_grace_period_ends_at_idx ON user_subscriptions(grace_period_ends_at) 
  WHERE status = 'grace_period';

-- Updated_at trigger
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Only service role can insert/update (via Edge Functions)
CREATE POLICY "Service role can manage subscriptions"
  ON user_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON user_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

/*
==================================================
FILE 2: Subscription status check functions
==================================================
*/

-- filepath: supabase/migrations/052_subscription_functions.sql

-- Get user's current subscription status
CREATE OR REPLACE FUNCTION get_subscription_status(p_user_id UUID)
RETURNS subscription_status AS $$
DECLARE
  sub_record RECORD;
BEGIN
  SELECT * INTO sub_record
  FROM user_subscriptions
  WHERE user_id = p_user_id;
  
  -- No subscription record = free
  IF NOT FOUND THEN
    RETURN 'free';
  END IF;
  
  -- Return stored status
  RETURN sub_record.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can earn SP
CREATE OR REPLACE FUNCTION can_user_earn_sp(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  status subscription_status;
BEGIN
  status := get_subscription_status(p_user_id);
  RETURN status IN ('trial', 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can spend SP
CREATE OR REPLACE FUNCTION can_user_spend_sp(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  status subscription_status;
BEGIN
  status := get_subscription_status(p_user_id);
  RETURN status IN ('trial', 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get transaction fee for user (in cents)
CREATE OR REPLACE FUNCTION get_user_transaction_fee(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  status subscription_status;
BEGIN
  status := get_subscription_status(p_user_id);
  
  -- Subscribers (including trial and cancelled with access) pay $0.99
  IF status IN ('trial', 'active', 'cancelled') THEN
    RETURN 99;
  END IF;
  
  -- Free users pay $2.99
  RETURN 299;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is eligible for trial
CREATE OR REPLACE FUNCTION is_user_trial_eligible(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sub_record RECORD;
BEGIN
  SELECT * INTO sub_record
  FROM user_subscriptions
  WHERE user_id = p_user_id;
  
  -- No record = eligible
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  
  -- Check if already used trial
  RETURN NOT sub_record.has_used_trial;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get subscription summary for user
CREATE OR REPLACE FUNCTION get_subscription_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  sub_record RECORD;
  tier_record RECORD;
  result JSON;
BEGIN
  SELECT * INTO sub_record
  FROM user_subscriptions
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'status', 'free',
      'is_subscriber', false,
      'can_earn_sp', false,
      'can_spend_sp', false,
      'transaction_fee_cents', 299,
      'trial_eligible', true
    );
  END IF;
  
  SELECT * INTO tier_record
  FROM subscription_tiers
  WHERE id = sub_record.tier_id;
  
  RETURN json_build_object(
    'status', sub_record.status,
    'is_subscriber', sub_record.status IN ('trial', 'active', 'cancelled'),
    'can_earn_sp', sub_record.status IN ('trial', 'active'),
    'can_spend_sp', sub_record.status IN ('trial', 'active'),
    'transaction_fee_cents', CASE WHEN sub_record.status IN ('trial', 'active', 'cancelled') THEN 99 ELSE 299 END,
    'trial_eligible', NOT sub_record.has_used_trial,
    'tier_name', tier_record.display_name,
    'tier_price_cents', tier_record.price_cents,
    'trial_ends_at', sub_record.trial_ends_at,
    'current_period_end', sub_record.current_period_end,
    'grace_period_ends_at', sub_record.grace_period_ends_at,
    'cancelled_at', sub_record.cancelled_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 3: Subscription service
==================================================
*/

// filepath: src/services/subscription/index.ts

import { supabase } from '@/lib/supabase';
import type { SubscriptionStatus, SubscriptionPermissions } from '@/types/subscription';

export interface SubscriptionSummary {
  status: SubscriptionStatus;
  is_subscriber: boolean;
  can_earn_sp: boolean;
  can_spend_sp: boolean;
  transaction_fee_cents: number;
  trial_eligible: boolean;
  tier_name?: string;
  tier_price_cents?: number;
  trial_ends_at?: string;
  current_period_end?: string;
  grace_period_ends_at?: string;
  cancelled_at?: string;
}

/**
 * Get user's subscription summary
 */
export async function getSubscriptionSummary(userId: string): Promise<SubscriptionSummary> {
  const { data, error } = await supabase.rpc('get_subscription_summary', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error getting subscription summary:', error);
    // Return free tier defaults on error
    return {
      status: 'free',
      is_subscriber: false,
      can_earn_sp: false,
      can_spend_sp: false,
      transaction_fee_cents: 299,
      trial_eligible: true,
    };
  }

  return data as SubscriptionSummary;
}

/**
 * Check if user can earn SP
 */
export async function canUserEarnSp(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_user_earn_sp', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error checking SP earning eligibility:', error);
    return false;
  }

  return data as boolean;
}

/**
 * Check if user can spend SP
 */
export async function canUserSpendSp(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_user_spend_sp', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error checking SP spending eligibility:', error);
    return false;
  }

  return data as boolean;
}

/**
 * Get transaction fee for user
 */
export async function getUserTransactionFee(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_user_transaction_fee', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error getting transaction fee:', error);
    return 299; // Default to free user fee
  }

  return data as number;
}

/**
 * Check if user is eligible for trial
 */
export async function isUserTrialEligible(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_user_trial_eligible', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error checking trial eligibility:', error);
    return false;
  }

  return data as boolean;
}

/**
 * Format price from cents to display string
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Calculate days remaining in trial
 */
export function getTrialDaysRemaining(trialEndsAt: string): number {
  const now = new Date();
  const endDate = new Date(trialEndsAt);
  const diffMs = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Calculate days remaining in grace period
 */
export function getGraceDaysRemaining(gracePeriodEndsAt: string): number {
  const now = new Date();
  const endDate = new Date(gracePeriodEndsAt);
  const diffMs = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ user_subscriptions table created
✓ subscription_status enum created
✓ Trial tracking fields (started_at, ends_at, reminders)
✓ Grace period tracking fields
✓ Stripe integration fields
✓ get_subscription_status() function
✓ can_user_earn_sp() function
✓ can_user_spend_sp() function
✓ get_user_transaction_fee() function
✓ is_user_trial_eligible() function
✓ get_subscription_summary() function
✓ TypeScript service layer
✓ RLS policies applied

==================================================
NEXT TASK: SUB-003 (Trial Start Flow)
==================================================
*/
```

---

### Output Files

1. **supabase/migrations/051_user_subscriptions.sql** - User subscriptions table
2. **supabase/migrations/052_subscription_functions.sql** - Status check functions
3. **src/services/subscription/index.ts** - Subscription service

### Time Breakdown

| Activity | Time |
|----------|------|
| Create user_subscriptions schema | 45 min |
| Create status check functions | 45 min |
| Create TypeScript service | 45 min |
| RLS policies | 15 min |
| Testing | 30 min |
| **Total** | **~3 hours** |

---

<!-- 
MICRO-TASK 11-B COMPLETE
Next: 11-C (Trial Management Tasks - SUB-003, SUB-004, SUB-005)
-->

---

## TASK SUB-003: Start 30-Day Free Trial (No Card Required)

**Duration:** 2 hours  
**Priority:** Critical  
**Dependencies:** SUB-001, SUB-002

### Description

Implement the "Try Kids Club+ Free" entry point that:

1. Verifies user is **trial eligible** (one trial per user)
2. Creates or updates a `user_subscriptions` row
3. Sets `status = 'trial'` and 30-day window
4. Initializes reminder flags (Day 23, 28, 29)
5. Does **NOT** require payment method up front

### AI Prompt for Cursor

```typescript
/*
TASK: Implement start trial flow (no credit card required)

CONTEXT:
User taps "Try Kids Club+ Free". We must check trial eligibility and
start a 30-day trial with full SP access, without collecting card details.

REQUIREMENTS:
1. Edge Function: start_trial
2. Validate trial eligibility via is_user_trial_eligible()
3. Insert/update user_subscriptions with status = 'trial'
4. Set trial_started_at / trial_ends_at (30 days)
5. Mark has_used_trial = true when trial ends

==================================================
FILE 1: Edge Function - start_trial
==================================================
*/

// filepath: supabase/functions/start-trial/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check eligibility
    const { data: eligible, error: eligibleError } = await supabaseClient
      .rpc('is_user_trial_eligible', { p_user_id: userId });

    if (eligibleError) throw eligibleError;

    if (!eligible) {
      return new Response(JSON.stringify({ error: 'Trial already used' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Kids Club+ tier
    const { data: tier, error: tierError } = await supabaseClient
      .from('subscription_tiers')
      .select('*')
      .eq('name', 'kids_club_plus')
      .eq('is_active', true)
      .single();

    if (tierError || !tier) {
      throw tierError || new Error('Kids Club+ tier not found');
    }

    const now = new Date();
    const trialEnds = new Date(now.getTime() + tier.trial_days * 24 * 60 * 60 * 1000);

    // Upsert subscription row
    const { error: upsertError } = await supabaseClient
      .from('user_subscriptions')
      .upsert(
        {
          user_id: userId,
          tier_id: tier.id,
          status: 'trial',
          trial_started_at: now.toISOString(),
          trial_ends_at: trialEnds.toISOString(),
          // Do NOT set has_used_trial here; we set it on trial end
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({
        success: true,
        status: 'trial',
        trial_ends_at: trialEnds.toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('start-trial error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/*
==================================================
FILE 2: Mobile UI entry point
==================================================
*/

// filepath: src/screens/subscription/TryKidsClubScreen.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { getSubscriptionSummary } from '@/services/subscription';

export function TryKidsClubScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleStartTrial = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const response = await fetch('/functions/v1/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to start trial');
      }

      Alert.alert('Trial Started', 'Enjoy 30 days of Kids Club+!');

      // Optionally refresh subscription summary in client state
      await getSubscriptionSummary(user.id);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to start trial');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Try Kids Club+ Free</Text>
      <Text style={styles.subtitle}>
        30 days of full access: earn & spend Swap Points, reduced fees, and more.
        No credit card required to start.
      </Text>

      <View style={styles.benefitsList}>
        <Text style={styles.benefit}>• Earn Swap Points on every sale</Text>
        <Text style={styles.benefit}>• Use SP for discounts on purchases</Text>
        <Text style={styles.benefit}>• Pay only $0.99 per transaction</Text>
        <Text style={styles.benefit}>• Priority matching and early access</Text>
      </View>

      <TouchableOpacity
        style={styles.startButton}
        onPress={handleStartTrial}
        disabled={loading}
      >
        <Text style={styles.startButtonText}>
          {loading ? 'Starting...' : 'Start 30-Day Free Trial'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 20,
  },
  benefitsList: {
    marginBottom: 24,
  },
  benefit: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 6,
  },
  startButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Trial eligibility enforced (one trial per user)
✓ start-trial Edge Function created
✓ user_subscriptions row created/updated
✓ status = 'trial' for 30 days
✓ No credit card required to start
✓ Mobile UI entry point implemented

==================================================
NEXT TASK: SUB-004 (Trial Reminder Cron)
==================================================
*/
```

---

## TASK SUB-004: Trial Reminder Notifications (Day 23, 28, 29)

**Duration:** 2.5 hours  
**Priority:** Medium  
**Dependencies:** SUB-002, SUB-003, MODULE-14 (Notifications)

### Description

Create a daily job that scans `user_subscriptions` where `status = 'trial'` and sends
reminders at **Day 23, 28, and 29** of the trial, with flags to avoid duplicates.

### AI Prompt for Cursor

```typescript
/*
TASK: Implement trial reminder cron job

CONTEXT:
We want 3 reminder touchpoints before trial ends: Day 23, 28, 29.
Use boolean flags on user_subscriptions to avoid duplicate sends.

REQUIREMENTS:
1. Cron Edge Function: trial-reminders
2. For each trial user, compute days until trial_ends_at
3. Send appropriate notification and set flag
4. Idempotent: never send same reminder twice

==================================================
FILE 1: Edge Function - trial_reminders
==================================================
*/

// filepath: supabase/functions/trial-reminders/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const now = new Date();

  // Fetch all trial subscriptions
  const { data: subs, error } = await supabaseClient
    .from('user_subscriptions')
    .select('id, user_id, trial_ends_at, trial_reminder_sent_day_23, trial_reminder_sent_day_28, trial_reminder_sent_day_29')
    .eq('status', 'trial')
    .not('trial_ends_at', 'is', null);

  if (error || !subs) {
    console.error('trial-reminders: error fetching subs', error);
    return new Response(JSON.stringify({ error: error?.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updates: any[] = [];

  for (const sub of subs) {
    const trialEnds = new Date(sub.trial_ends_at);
    const diffMs = trialEnds.getTime() - now.getTime();
    const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Map days remaining to flags
    if (daysRemaining === 7 && !sub.trial_reminder_sent_day_23) {
      // Day 23 (30 - 7)
      await sendTrialReminder(supabaseClient, sub.user_id, '23');
      updates.push({ id: sub.id, trial_reminder_sent_day_23: true });
    } else if (daysRemaining === 2 && !sub.trial_reminder_sent_day_28) {
      // Day 28 (30 - 2)
      await sendTrialReminder(supabaseClient, sub.user_id, '28');
      updates.push({ id: sub.id, trial_reminder_sent_day_28: true });
    } else if (daysRemaining === 1 && !sub.trial_reminder_sent_day_29) {
      // Day 29 (30 - 1)
      await sendTrialReminder(supabaseClient, sub.user_id, '29');
      updates.push({ id: sub.id, trial_reminder_sent_day_29: true });
    }
  }

  // Batch update flags
  if (updates.length > 0) {
    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .upsert(updates, { onConflict: 'id' });

    if (updateError) {
      console.error('trial-reminders: error updating flags', updateError);
    }
  }

  return new Response(JSON.stringify({ success: true, updated: updates.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

async function sendTrialReminder(supabaseClient: any, userId: string, day: '23' | '28' | '29') {
  // TODO: Integrate with MODULE-14 notification service
  // Fetch user push/email info and send tailored message
  console.log(`Sending trial reminder (Day ${day}) to user ${userId}`);
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Daily trial-reminders job implemented
✓ Correct days mapped: 23, 28, 29
✓ Flags prevent duplicate sends
✓ Safe when no trial users
✓ Hooks into notification system (TODO stub)

==================================================
NEXT TASK: SUB-005 (Trial Conversion Rules)
==================================================
*/
```

---

## TASK SUB-005: Trial Conversion & Downgrade Rules

**Duration:** 2.5 hours  
**Priority:** Critical  
**Dependencies:** SUB-002, SUB-003, payment integration in 11-D

### Description

Define and implement what happens when the **30-day trial ends**:

- If user **adds payment method and accepts billing** → convert to `active`
- If user **does not convert** → downgrade to `free`, freeze SP wallet, start 90-day grace
- Mark `has_used_trial = true` to prevent a second trial

### AI Prompt for Cursor

```typescript
/*
TASK: Implement trial conversion logic at Day 30

CONTEXT:
At the end of the 30-day trial, we must either:
- Convert to paid (active) if user entered payment details, or
- Downgrade to free + frozen SP wallet (grace period) if not.

REQUIREMENTS:
1. Cron function: trial-conversion
2. Scan trial users where trial_ends_at < NOW()
3. If Stripe subscription exists and is active → status = 'active'
4. Else → status = 'grace_period', has_used_trial = true, set grace_period_ends_at
5. Trigger SP wallet freeze via MODULE-09 handler

==================================================
FILE 1: Edge Function - trial_conversion
==================================================
*/

// filepath: supabase/functions/trial-conversion/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

serve(async () => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const now = new Date();

  // Fetch all trials that ended
  const { data: subs, error } = await supabaseClient
    .from('user_subscriptions')
    .select('id, user_id, stripe_subscription_id, trial_ends_at, status')
    .eq('status', 'trial')
    .lt('trial_ends_at', now.toISOString());

  if (error || !subs) {
    console.error('trial-conversion: error fetching subs', error);
    return new Response(JSON.stringify({ error: error?.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  for (const sub of subs) {
    let newStatus: 'active' | 'grace_period' = 'grace_period';
    let graceEndsAt: string | null = null;

    // If Stripe subscription exists, check if it's active
    if (sub.stripe_subscription_id) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        if (stripeSub.status === 'active') {
          newStatus = 'active';
        }
      } catch (err) {
        console.error('trial-conversion: error fetching Stripe sub', err);
      }
    }

    // If not active in Stripe → downgrade to grace_period
    if (newStatus === 'grace_period') {
      // Compute grace_period_ends_at: 90 days from now
      const graceEndDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      graceEndsAt = graceEndDate.toISOString();

      // Call SP wallet freeze handler from MODULE-09
      try {
        await fetch(Deno.env.get('SP_SUBSCRIPTION_LAPSE_URL') || '', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: sub.user_id }),
        });
      } catch (err) {
        console.error('trial-conversion: error calling SP lapse handler', err);
      }
    }

    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update({
        status: newStatus,
        has_used_trial: true,
        grace_period_ends_at: graceEndsAt,
      })
      .eq('id', sub.id);

    if (updateError) {
      console.error('trial-conversion: error updating sub', updateError);
    }
  }

  return new Response(JSON.stringify({ success: true, processed: subs.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Trial users processed when trial_ends_at < NOW()
✓ Converted to active if Stripe sub is active
✓ Otherwise downgraded to grace_period
✓ has_used_trial set to true
✓ grace_period_ends_at set to 90 days from conversion
✓ SP wallet freeze handler invoked for downgrades

==================================================
NEXT TASK: 11-D (Payment & Billing Tasks - SUB-006, SUB-007)
==================================================
*/
```

---

<!-- 
MICRO-TASK 11-C COMPLETE
Next: 11-D (Payment & Billing Tasks - SUB-006, SUB-007)
-->

---

## TASK SUB-006: Stripe Subscription Creation (Post-Trial Conversion)

**Duration:** 3.5 hours  
**Priority:** Critical  
**Dependencies:** SUB-002, SUB-003, SYSTEM_REQUIREMENTS_V2 payment rules

### Description

Implement the **paid conversion** flow when a trial user decides to continue Kids Club+:

1. User taps "Continue Kids Club+" before trial end
2. User enters payment details in a Stripe-hosted flow
3. Stripe Subscription created for Kids Club+ tier
4. `user_subscriptions` updated with Stripe IDs and billing period
5. Status becomes `active` (or remains `trial` until Day 30, depending on config)

### AI Prompt for Cursor

```typescript
/*
TASK: Implement Stripe subscription creation for Kids Club+

CONTEXT:
User already has an active trial. They choose to continue after trial by
adding a payment method. We must create a Stripe subscription tied to the
Kids Club+ tier and update user_subscriptions.

REQUIREMENTS:
1. Edge Function: create_kids_club_subscription
2. Use existing tier price (799 cents) and optional stripe_price_id
3. Create/reuse Stripe Customer
4. Create Subscription with billing start at trial end
5. Update user_subscriptions with IDs and period dates

==================================================
FILE 1: Edge Function - create_kids_club_subscription
==================================================
*/

// filepath: supabase/functions/create-kids-club-subscription/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, paymentMethodId } = await req.json();

    if (!userId || !paymentMethodId) {
      return new Response(JSON.stringify({ error: 'Missing userId or paymentMethodId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user and subscription
    const { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('id, email, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw userError || new Error('User not found');
    }

    const { data: sub, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('id, tier_id, status, trial_ends_at, stripe_subscription_id')
      .eq('user_id', userId)
      .single();

    if (subError || !sub) {
      throw subError || new Error('Subscription record not found');
    }

    // Get tier info
    const { data: tier, error: tierError } = await supabaseClient
      .from('subscription_tiers')
      .select('*')
      .eq('id', sub.tier_id)
      .single();

    if (tierError || !tier) {
      throw tierError || new Error('Kids Club+ tier not found');
    }

    // Create or reuse Stripe customer
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;

      await supabaseClient
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // Attach payment method
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Determine billing start (trial end or now if no trial)
    const trialEndUnix = sub.trial_ends_at
      ? Math.floor(new Date(sub.trial_ends_at).getTime() / 1000)
      : undefined;

    // Use existing price or inline price
    const priceId = tier.stripe_price_id || undefined;

    const items = priceId
      ? [{ price: priceId }]
      : [
          {
            price_data: {
              currency: tier.currency,
              product_data: { name: tier.display_name, description: tier.description },
              recurring: { interval: 'month' },
              unit_amount: tier.price_cents,
            },
          },
        ];

    const stripeSub = await stripe.subscriptions.create({
      customer: customerId,
      items,
      trial_end: trialEndUnix,
      metadata: {
        supabase_user_id: userId,
        tier_id: tier.id,
      },
    });

    const currentPeriodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();

    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: stripeSub.id,
        stripe_payment_method_id: paymentMethodId,
        status: sub.status === 'trial' ? 'trial' : 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: currentPeriodEnd,
      })
      .eq('id', sub.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, stripe_subscription_id: stripeSub.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('create-kids-club-subscription error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Stripe Customer created/reused
✓ Payment method attached & set as default
✓ Stripe Subscription created for Kids Club+
✓ Trial honored via trial_end
✓ user_subscriptions updated with Stripe IDs and period

==================================================
NEXT TASK: SUB-007 (Stripe Webhook for Subscription Updates)
==================================================
*/
```

---

## TASK SUB-007: Stripe Webhook Handling (Status & Billing Updates)

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** SUB-002, SUB-006

### Description

Handle Stripe webhooks to keep `user_subscriptions` in sync with billing events:

- `customer.subscription.updated` → update status and periods
- `invoice.payment_failed` → mark `past_due`, increment retry count
- `customer.subscription.deleted` → move to `grace_period` or `expired` depending on context

### AI Prompt for Cursor

```typescript
/*
TASK: Implement Stripe webhook handler for subscriptions

CONTEXT:
Stripe is the source of truth for billing. We must respond to
subscription changes and reflect them in user_subscriptions, while
respecting V2 rules (grace period, SP freeze, etc.).

REQUIREMENTS:
1. Edge Function: stripe-webhook-subscriptions
2. Verify Stripe signature
3. Handle subscription.updated, invoice.payment_failed, subscription.deleted
4. Update user_subscriptions fields and status
5. Trigger SP wallet freeze/unfreeze where appropriate

==================================================
FILE 1: Edge Function - stripe_webhook_subscriptions
==================================================
*/

// filepath: supabase/functions/stripe-webhook-subscriptions/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const sig = req.headers.get('stripe-signature') || '';
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error('stripe-webhook-subscriptions: signature verification failed', err);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabaseClient, subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabaseClient, subscription);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(supabaseClient, invoice);
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('stripe-webhook-subscriptions error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function handleSubscriptionUpdated(supabaseClient: any, subscription: Stripe.Subscription) {
  const stripeSubId = subscription.id;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  let status: 'active' | 'cancelled' | 'grace_period' | 'expired' = 'active';

  if (subscription.status === 'active') {
    status = 'active';
  } else if (subscription.cancel_at_period_end) {
    status = 'cancelled';
  } else if (subscription.status === 'canceled') {
    status = 'grace_period';
  }

  const { error } = await supabaseClient
    .from('user_subscriptions')
    .update({
      status,
      current_period_end: currentPeriodEnd,
    })
    .eq('stripe_subscription_id', stripeSubId);

  if (error) {
    console.error('handleSubscriptionUpdated: error updating DB', error);
  }
}

async function handleSubscriptionDeleted(supabaseClient: any, subscription: Stripe.Subscription) {
  const stripeSubId = subscription.id;

  const { data, error } = await supabaseClient
    .from('user_subscriptions')
    .select('id, user_id')
    .eq('stripe_subscription_id', stripeSubId)
    .single();

  if (error || !data) {
    console.error('handleSubscriptionDeleted: subscription not found', error);
    return;
  }

  // When Stripe deletes, move user into grace period and freeze SP
  const now = new Date();
  const graceEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await supabaseClient
    .from('user_subscriptions')
    .update({
      status: 'grace_period',
      grace_period_ends_at: graceEnd,
    })
    .eq('id', data.id);

  if (updateError) {
    console.error('handleSubscriptionDeleted: error updating DB', updateError);
  }

  // Call SP wallet freeze handler
  try {
    await fetch(Deno.env.get('SP_SUBSCRIPTION_LAPSE_URL') || '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: data.user_id }),
    });
  } catch (err) {
    console.error('handleSubscriptionDeleted: error calling SP lapse handler', err);
  }
}

async function handleInvoicePaymentFailed(supabaseClient: any, invoice: Stripe.Invoice) {
  const stripeSubId = (invoice.subscription as string) || '';

  const { data, error } = await supabaseClient
    .from('user_subscriptions')
    .select('id, payment_retry_count')
    .eq('stripe_subscription_id', stripeSubId)
    .single();

  if (error || !data) {
    console.error('handleInvoicePaymentFailed: subscription not found', error);
    return;
  }

  const retryCount = (data.payment_retry_count || 0) + 1;

  const { error: updateError } = await supabaseClient
    .from('user_subscriptions')
    .update({
      status: retryCount >= 3 ? 'grace_period' : 'active',
      payment_failed_at: new Date().toISOString(),
      payment_retry_count: retryCount,
    })
    .eq('id', data.id);

  if (updateError) {
    console.error('handleInvoicePaymentFailed: error updating DB', updateError);
  }
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Stripe webhook verified with secret
✓ subscription.updated handled (status + period)
✓ subscription.deleted transitions to grace_period + SP freeze
✓ invoice.payment_failed increments retry count
✓ After 3 failures, user moved to grace_period

==================================================
NEXT TASK: 11-E (Cancellation & Grace Period - SUB-008, SUB-009)
==================================================
*/
```

---

<!-- 
MICRO-TASK 11-D COMPLETE
Next: 11-E (Cancellation & Grace Period - SUB-008, SUB-009)
-->
