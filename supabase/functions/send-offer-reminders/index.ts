// File: supabase/functions/send-offer-reminders/index.ts
// Calls rpc_send_offer_reminders, then sends notifications via send-trade-notifications

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface Notification {
  trade_id: string;
  event_type: string;
  recipient_user_id: string;
  extra_data?: Record<string, unknown>;
}

/** Send a batch of notifications to send-trade-notifications Edge Function */
async function sendNotifications(
  supabaseUrl: string,
  serviceRoleKey: string,
  notifications: Notification[],
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const notification of notifications) {
    try {
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/send-trade-notifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify(notification),
        },
      );

      if (!resp.ok) {
        console.warn(
          '[send-offer-reminders] notification failed',
          notification.event_type,
          notification.trade_id,
          resp.status,
        );
        failed++;
      } else {
        // Check if the push was actually delivered (not silently skipped)
        const result = await resp.json().catch(() => ({}));
        const pushSent = result?.sent ?? -1;
        if (pushSent === 0) {
          console.warn(
            '[send-offer-reminders] notification NOT delivered - no push tokens or push failed',
            notification.event_type,
            notification.trade_id,
            { reason: result?.reason || 'unknown', recipient: notification.recipient_user_id },
          );
        }
        sent++;
      }
    } catch (err) {
      console.warn(
        '[send-offer-reminders] notification error',
        notification.event_type,
        notification.trade_id,
        err,
      );
      failed++;
    }
  }

  return { sent, failed };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST is supported',
      },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, {
      success: false,
      error: {
        code: 'CONFIG_MISSING',
        message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing',
      },
    });
  }

  const requestId = crypto.randomUUID();
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const requestedBatchSize = Number(body?.batch_size);
    const batchSize =
      Number.isFinite(requestedBatchSize) && requestedBatchSize > 0
        ? Math.min(Math.floor(requestedBatchSize), 500)
        : 100;

    // Step 1: Run the RPC (data-only, no HTTP calls)
    const { data, error } = await supabase.rpc('rpc_send_offer_reminders', {
      p_batch_size: batchSize,
    });

    if (error) {
      console.error('[send-offer-reminders]', {
        requestId,
        batchSize,
        error: error.message,
      });

      return jsonResponse(500, {
        success: false,
        error: {
          code: 'RPC_SEND_OFFER_REMINDERS_FAILED',
          message: error.message,
          details: { requestId },
        },
      });
    }

    // Step 2: Create in-app notifications (user_notifications rows)
    const rpcResult = data as Record<string, unknown>;
    const notifications = (rpcResult?.notifications ?? []) as Notification[];
    let inAppCreated = 0;
    let inAppFailed = 0;

    const NOTIF_TITLES: Record<string, string> = {
      offer_reminder_6h: 'Offer Expiring Soon',
      offer_reminder_1h: 'Offer Expiring Soon',
    };
    const NOTIF_BODIES: Record<string, (d?: Record<string, unknown>) => string> = {
      offer_reminder_6h: (d) =>
        `You have an offer on "${(d?.listing_title as string) || 'your listing'}" expiring in ${(d?.hours_remaining as number) || 6} hours.`,
      offer_reminder_1h: (d) =>
        `You have an offer on "${(d?.listing_title as string) || 'your listing'}" expiring in ${(d?.hours_remaining as number) || 1} hour.`,
    };

    for (const notif of notifications) {
      const title = NOTIF_TITLES[notif.event_type] || 'Offer Update';
      const body = NOTIF_BODIES[notif.event_type]?.(notif.extra_data) || 'Your offer is expiring soon.';
      try {
        const { error: insertErr } = await supabase
          .from('user_notifications')
          .insert({
            user_id: notif.recipient_user_id,
            category: 'trades',
            type: notif.event_type,
            title,
            body,
            channels: ['push', 'in_app'],
            data: { trade_id: notif.trade_id, event_type: notif.event_type, ...(notif.extra_data ?? {}) },
          });
        if (insertErr) {
          console.warn('[send-offer-reminders] in-app insert failed', notif.event_type, notif.trade_id, insertErr.message);
          inAppFailed++;
        } else {
          inAppCreated++;
        }
      } catch (err) {
        console.warn('[send-offer-reminders] in-app insert error', notif.event_type, notif.trade_id, err);
        inAppFailed++;
      }
    }

    // Step 3: Send push notifications
    const { sent, failed } = await sendNotifications(
      supabaseUrl,
      serviceRoleKey,
      notifications,
    );

    console.log('[send-offer-reminders]', {
      requestId,
      batchSize,
      reminders6h: rpcResult?.reminder_6h_sent,
      reminders1h: rpcResult?.reminder_1h_sent,
      inAppCreated,
      inAppFailed,
      pushSent: sent,
      pushFailed: failed,
    });

    return jsonResponse(200, {
      success: true,
      request_id: requestId,
      data: rpcResult,
      in_app: { created: inAppCreated, failed: inAppFailed },
      push: { sent, failed, total: notifications.length },
    });
  } catch (error) {
    console.error('[send-offer-reminders] unexpected error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return jsonResponse(500, {
      success: false,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { requestId },
      },
    });
  }
});
