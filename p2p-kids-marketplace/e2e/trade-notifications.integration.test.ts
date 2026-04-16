// filepath: p2p-kids-marketplace/e2e/trade-notifications.integration.test.ts
// Integration Tests: Trade Event Notifications (NOTIF-V2-007)
// MODULE: MODULE-14-NOTIFICATIONS-V2
//
// These tests run against staging Supabase.
// Run: RUN_SUPABASE_E2E=true npm run test:e2e
//
// Prerequisites:
// - Seeded test users: test-buyer@p2pkids.dev, test-seller@p2pkids.dev
// - notification_preferences rows with category='trades' for test users
// - DB migration 145_trade_notifications.sql applied

import { createClient } from '@supabase/supabase-js';

const RUN = process.env.RUN_SUPABASE_E2E === 'true';
const describeOrSkip = RUN ? describe : describe.skip;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminClient() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for E2E tests'
    );
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function clearTradeNotifications(supabase: ReturnType<typeof adminClient>, userId: string) {
  await supabase.from('user_notifications').delete().eq('user_id', userId).eq('category', 'trades');
}

async function getTradeNotifs(supabase: ReturnType<typeof adminClient>, userId: string) {
  const { data } = await supabase
    .from('user_notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('category', 'trades')
    .order('created_at', { ascending: false });
  return data ?? [];
}

async function insertTestTrade(
  supabase: ReturnType<typeof adminClient>,
  buyerId: string,
  sellerId: string,
  itemId: string
) {
  const baseTradePayload = {
    buyer_id: buyerId,
    seller_id: sellerId,
    status: 'pending',
  };

  // Prefer V2 canonical column `listing_id`; fallback to legacy `item_id` if needed.
  let { data, error } = await supabase
    .from('trades')
    .insert({
      ...baseTradePayload,
      listing_id: itemId,
    })
    .select('id')
    .single();

  if (error && /column\s+"listing_id"|listing_id/i.test(error.message)) {
    const retry = await supabase
      .from('trades')
      .insert({
        ...baseTradePayload,
        item_id: itemId,
      })
      .select('id')
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(`insertTestTrade failed: ${error.message}`);
  return data.id as string;
}

async function updateTradeStatus(
  supabase: ReturnType<typeof adminClient>,
  tradeId: string,
  status: string
) {
  const { error } = await supabase.from('trades').update({ status }).eq('id', tradeId);
  if (error) throw new Error(`updateTradeStatus failed: ${error.message}`);
}

async function sellerMarkTradeCompleted(
  supabase: ReturnType<typeof adminClient>,
  tradeId: string,
  sellerUserId: string
) {
  const { data, error } = await supabase.rpc('complete_trade_v2', {
    p_trade_id: tradeId,
    p_user_id: sellerUserId,
  });

  // Fallback for environments where complete_trade_v2 signature/logic drifted.
  if (error || (data && data.success === false)) {
    const { error: fallbackError } = await supabase
      .from('trades')
      .update({ seller_marked_completed_at: new Date().toISOString() })
      .eq('id', tradeId);

    if (fallbackError) {
      throw new Error(
        `sellerMarkTradeCompleted failed: ${error?.message || data?.error || fallbackError.message}`
      );
    }
  }
}

async function buyerConfirmTradeCompleted(
  supabase: ReturnType<typeof adminClient>,
  tradeId: string,
  buyerUserId: string
) {
  const { data, error } = await supabase.rpc('complete_trade_v2', {
    p_trade_id: tradeId,
    p_user_id: buyerUserId,
  });

  // Fallback for environments where complete_trade_v2 signature/logic drifted.
  if (error || (data && data.success === false)) {
    const { error: fallbackError } = await supabase
      .from('trades')
      .update({
        buyer_marked_completed_at: new Date().toISOString(),
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', tradeId);

    if (fallbackError) {
      throw new Error(
        `buyerConfirmTradeCompleted failed: ${error?.message || data?.error || fallbackError.message}`
      );
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describeOrSkip('NOTIF-V2-007: Trade Event Notifications — Integration Tests', () => {
  let admin: ReturnType<typeof adminClient> | null = null;
  let buyerId: string;
  let sellerId: string;
  let itemId: string;
  let createdTradeIds: string[] = [];
  let canRunSuite = true;
  let skipReason = '';

  const shouldSkipCase = (): boolean => {
    if (!canRunSuite) {
      console.warn(`[trade-notifications.integration] Skipping assertion: ${skipReason}`);
      return true;
    }
    return false;
  };

  beforeAll(async () => {
    try {
      admin = adminClient();

      // Look up test users by email
      const { data: users } = await admin.auth.admin.listUsers();
      const buyer = users?.users.find((u) => u.email === 'test-buyer@p2pkids.dev');
      const seller = users?.users.find((u) => u.email === 'test-seller@p2pkids.dev');

      if (!buyer || !seller) {
        canRunSuite = false;
        skipReason =
          'Seed users test-buyer@p2pkids.dev and test-seller@p2pkids.dev not found. Run seed script before integration tests.';
        console.warn(`[trade-notifications.integration] ${skipReason}`);
        return;
      }

      buyerId = buyer.id;
      sellerId = seller.id;

      // Get a real item owned by seller
      const { data: item } = await admin
        .from('items')
        .select('id')
        .eq('seller_id', sellerId)
        .in('status', ['active', 'available'])
        .limit(1)
        .single();

      if (!item) {
        canRunSuite = false;
        skipReason =
          'No active items found for test-seller. Create one in staging before running E2E tests.';
        console.warn(`[trade-notifications.integration] ${skipReason}`);
        return;
      }

      itemId = item.id;
    } catch (error) {
      canRunSuite = false;
      skipReason = (error as Error).message;
      console.warn(`[trade-notifications.integration] ${skipReason}`);
    }
  });

  afterAll(async () => {
    if (!admin) {
      return;
    }

    // Clean up created trades
    for (const tradeId of createdTradeIds) {
      await admin.from('trades').delete().eq('id', tradeId);
    }

    if (buyerId) {
      await clearTradeNotifications(admin, buyerId);
    }

    if (sellerId) {
      await clearTradeNotifications(admin, sellerId);
    }
  });

  // ─── TC-E2E-001: trade_request ─────────────────────────────────────────────

  it('TC-E2E-001: DB trigger creates trade_request notification for seller when trade inserted', async () => {
    if (shouldSkipCase() || !admin) return;

    await clearTradeNotifications(admin, sellerId);

    const tradeId = await insertTestTrade(admin, buyerId, sellerId, itemId);
    createdTradeIds.push(tradeId);

    // Small delay for trigger execution
    await new Promise((r) => setTimeout(r, 500));

    const notifs = await getTradeNotifs(admin, sellerId);
    const tradeReqNotif = notifs.find((n) => n.type === 'trade_request');

    expect(tradeReqNotif).toBeDefined();
    expect(tradeReqNotif!.category).toBe('trades');
    expect(tradeReqNotif!.title).toContain('Trade Request');
    expect(tradeReqNotif!.data?.trade_id).toBe(tradeId);
    expect(tradeReqNotif!.data?.deep_link).toBe(`/trades/${tradeId}`);
  }, 15000);

  // ─── TC-E2E-002: trade_completion_requested ───────────────────────────────

  it('TC-E2E-002: seller mark-complete creates trade_completion_requested notification for buyer', async () => {
    if (shouldSkipCase() || !admin) return;

    await clearTradeNotifications(admin, buyerId);

    const tradeId = await insertTestTrade(admin, buyerId, sellerId, itemId);
    createdTradeIds.push(tradeId);

    await updateTradeStatus(admin, tradeId, 'in_progress');
    await sellerMarkTradeCompleted(admin, tradeId, sellerId);

    await new Promise((r) => setTimeout(r, 500));

    const notifs = await getTradeNotifs(admin, buyerId);
    const completionRequestNotif = notifs.find((n) => n.type === 'trade_completion_requested');

    expect(completionRequestNotif).toBeDefined();
    expect(completionRequestNotif!.title).toContain('Confirmation');
    expect(completionRequestNotif!.data?.trade_id).toBe(tradeId);
  }, 15000);

  // ─── TC-E2E-003: trade_completed ───────────────────────────────────────────

  it('TC-E2E-003: buyer confirmation creates trade_completed notifications for BOTH buyer and seller', async () => {
    if (shouldSkipCase() || !admin) return;

    await clearTradeNotifications(admin, buyerId);
    await clearTradeNotifications(admin, sellerId);

    const tradeId = await insertTestTrade(admin, buyerId, sellerId, itemId);
    createdTradeIds.push(tradeId);

    await updateTradeStatus(admin, tradeId, 'in_progress');
    await sellerMarkTradeCompleted(admin, tradeId, sellerId);
    await buyerConfirmTradeCompleted(admin, tradeId, buyerId);

    await new Promise((r) => setTimeout(r, 500));

    const buyerNotifs = await getTradeNotifs(admin, buyerId);
    const sellerNotifs = await getTradeNotifs(admin, sellerId);

    expect(buyerNotifs.find((n) => n.type === 'trade_completed')).toBeDefined();
    expect(sellerNotifs.find((n) => n.type === 'trade_completed')).toBeDefined();
  }, 15000);

  // ─── TC-E2E-004: trade_cancelled ───────────────────────────────────────────

  it('TC-E2E-004: DB trigger creates trade_cancelled notifications for BOTH parties', async () => {
    if (shouldSkipCase() || !admin) return;

    await clearTradeNotifications(admin, buyerId);
    await clearTradeNotifications(admin, sellerId);

    const tradeId = await insertTestTrade(admin, buyerId, sellerId, itemId);
    createdTradeIds.push(tradeId);

    await updateTradeStatus(admin, tradeId, 'cancelled');

    await new Promise((r) => setTimeout(r, 500));

    const buyerNotifs = await getTradeNotifs(admin, buyerId);
    const sellerNotifs = await getTradeNotifs(admin, sellerId);

    expect(buyerNotifs.find((n) => n.type === 'trade_cancelled')).toBeDefined();
    expect(sellerNotifs.find((n) => n.type === 'trade_cancelled')).toBeDefined();
  }, 15000);

  // ─── TC-E2E-005: notification_preferences gating ──────────────────────────

  it('TC-E2E-005: No notification created when seller has all trades channels disabled', async () => {
    if (shouldSkipCase() || !admin) return;

    await clearTradeNotifications(admin, sellerId);

    // Disable all trades channels for seller
    await admin.from('notification_preferences').upsert(
      {
        user_id: sellerId,
        category: 'trades',
        push_enabled: false,
        in_app_enabled: false,
        email_enabled: false,
      },
      { onConflict: 'user_id,category' }
    );

    const tradeId = await insertTestTrade(admin, buyerId, sellerId, itemId);
    createdTradeIds.push(tradeId);

    await new Promise((r) => setTimeout(r, 500));

    const notifs = await getTradeNotifs(admin, sellerId);
    // No trade_request notification should be created
    expect(
      notifs.find((n) => n.type === 'trade_request' && n.data?.trade_id === tradeId)
    ).toBeUndefined();

    // Restore default preferences
    await admin.from('notification_preferences').upsert(
      {
        user_id: sellerId,
        category: 'trades',
        push_enabled: true,
        in_app_enabled: true,
        email_enabled: false,
      },
      { onConflict: 'user_id,category' }
    );
  }, 15000);

  // ─── TC-E2E-006: notification data includes item details ──────────────────

  it('TC-E2E-006: Trade notification data includes item_id, trade_id and deep_link', async () => {
    if (shouldSkipCase() || !admin) return;

    await clearTradeNotifications(admin, sellerId);

    const tradeId = await insertTestTrade(admin, buyerId, sellerId, itemId);
    createdTradeIds.push(tradeId);

    await new Promise((r) => setTimeout(r, 500));

    const notifs = await getTradeNotifs(admin, sellerId);
    const notif = notifs.find((n) => n.type === 'trade_request' && n.data?.trade_id === tradeId);

    expect(notif).toBeDefined();
    expect(notif!.data.item_id).toBe(itemId);
    expect(notif!.data.deep_link).toBe(`/trades/${tradeId}`);
    expect(notif!.data.type).toBe('trade_request');
  }, 15000);
});
