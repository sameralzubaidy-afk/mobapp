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

    // Step 2: Send queued notifications
    const rpcResult = data as Record<string, unknown>;
    const notifications = (rpcResult?.notifications ?? []) as Notification[];
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
      notificationsSent: sent,
      notificationsFailed: failed,
    });

    return jsonResponse(200, {
      success: true,
      request_id: requestId,
      data: rpcResult,
      notifications: { sent, failed, total: notifications.length },
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
