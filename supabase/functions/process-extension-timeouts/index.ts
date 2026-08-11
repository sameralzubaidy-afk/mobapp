// File: supabase/functions/process-extension-timeouts/index.ts
// R15 (2026-08-10): Auto-denies + auto-cancels trades whose extension request was
// not answered by the counterparty within `extension_response_window_hours` (default
// 4h). Calls `rpc_process_extension_timeouts` (which marks auto_denied, auto-cancels
// via the SHARED rpc_auto_cancel_trade path, creates in-app user_notifications rows
// and returns push payloads), then sends push via send-trade-notifications.
//
// Scheduled by 20260811000005_r15_trade_extension.sql — runs every 5 minutes.
// Cron-invoked: verify_jwt = false (BP-19). No user JWT required.

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

/** Send push notifications via send-trade-notifications EF (BP-17: check sent > 0). */
async function sendPushNotifications(
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
          '[process-extension-timeouts] push failed',
          notification.event_type,
          notification.trade_id,
          resp.status,
        );
        failed++;
      } else {
        const result = await resp.json().catch(() => ({}));
        const pushSent = result?.sent ?? -1;
        if (pushSent === 0) {
          console.warn(
            '[process-extension-timeouts] push NOT delivered - no push tokens or push failed',
            notification.event_type,
            notification.trade_id,
            { reason: result?.reason || 'unknown', recipient: notification.recipient_user_id },
          );
        }
        sent++;
      }
    } catch (err) {
      console.warn(
        '[process-extension-timeouts] push error',
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
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, {
      success: false,
      error: { code: 'CONFIG_MISSING', message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing' },
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

    // Step 1: Run the RPC (data-only — marks auto_denied + auto-cancels + creates
    // in-app rows + returns push payloads).
    const { data, error } = await supabase.rpc('rpc_process_extension_timeouts', {
      p_batch_size: batchSize,
    });

    if (error) {
      console.error('[process-extension-timeouts]', {
        requestId,
        batchSize,
        error: error.message,
      });
      return jsonResponse(500, {
        success: false,
        error: { code: 'RPC_FAILED', message: error.message, details: { requestId } },
      });
    }

    // Step 2: Parse RPC result
    const rpcResult = data as Record<string, unknown>;
    const notifications = (rpcResult?.notifications ?? []) as Notification[];
    const inAppCreated = (rpcResult?.in_app_created as number) ?? 0;

    // Step 3: Send push notifications
    const { sent, failed } = await sendPushNotifications(
      supabaseUrl,
      serviceRoleKey,
      notifications,
    );

    console.log('[process-extension-timeouts]', {
      requestId,
      batchSize,
      autoDenied: rpcResult?.auto_denied_count,
      cancelled: rpcResult?.cancelled_count,
      inAppCreated,
      pushSent: sent,
      pushFailed: failed,
    });

    return jsonResponse(200, {
      success: true,
      request_id: requestId,
      auto_denied_count: rpcResult?.auto_denied_count ?? 0,
      cancelled_count: rpcResult?.cancelled_count ?? 0,
      in_app_created: inAppCreated,
      push_sent: sent,
      push_failed: failed,
    });
  } catch (error) {
    console.error('[process-extension-timeouts] unexpected error', {
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
