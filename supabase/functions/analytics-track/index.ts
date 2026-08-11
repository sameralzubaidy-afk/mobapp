// File: supabase/functions/analytics-track/index.ts
// R9 — Minimal Event Instrumentation: client-origin pilot analytics events.
//
// The mobile app forwards user-initiated events here (checkout_fee_shown,
// checkout_started, checkout_failed, and any feature event already routed
// through trackEvent()). Server-side state changes (trade outcomes, SP
// movements, subscription transitions, funnel events) are captured by DB
// triggers — this function only handles client-origin events, so cron-triggered
// and server-only changes can never be lost (TRADING-FLOW-V2 §16.2).
//
// Auth: user JWT (verify_jwt = true — the default, no config.toml entry).
// Node tagging is resolved SERVER-SIDE by rpc_track_analytics_event() from
// profiles.node_id, so the client never needs to send (or spoof) node_id.
//
// Best-effort contract: this returns success for analytics purposes even when
// the downstream insert is skipped, but it still returns structured errors for
// invalid input and real failures (BP-7).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Known R9 client-origin events → category. Unknown event names fall back to
// 'other' so the app's existing trackEvent() calls are captured too.
const KNOWN_CATEGORY: Record<string, string> = {
  checkout_fee_shown: 'checkout',
  checkout_started: 'checkout',
  checkout_failed: 'checkout',
  user_registered: 'funnel',
  user_activated: 'funnel',
  user_engaged: 'funnel',
};

const MAX_EVENT_NAME_LENGTH = 64;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } },
      405
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    }
  );

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn('[analytics-track] unauthenticated event dropped', userError?.message);
      return jsonResponse(
        { success: false, error: { code: 'UNAUTHENTICATED', message: 'Sign in to record events' } },
        401
      );
    }

    let body: { event_name?: unknown; properties?: unknown; category?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { success: false, error: { code: 'INVALID_JSON', message: 'Request body must be JSON' } },
        400
      );
    }

    const eventName = typeof body.event_name === 'string' ? body.event_name.trim() : '';
    if (!eventName) {
      return jsonResponse(
        { success: false, error: { code: 'INVALID_EVENT_NAME', message: 'event_name is required' } },
        400
      );
    }
    if (eventName.length > MAX_EVENT_NAME_LENGTH) {
      return jsonResponse(
        { success: false, error: { code: 'INVALID_EVENT_NAME', message: 'event_name is too long' } },
        400
      );
    }

    // properties must be a JSON object; strip any node_id the client sent so
    // the server-side node resolution stays authoritative (R9 node tagging).
    let properties: Record<string, unknown> = {};
    if (body.properties && typeof body.properties === 'object' && !Array.isArray(body.properties)) {
      const { node_id: _ignored, ...rest } = body.properties as Record<string, unknown>;
      properties = rest;
    }

    const category =
      typeof body.category === 'string' && body.category
        ? body.category
        : (KNOWN_CATEGORY[eventName] ?? 'other');

    const { data: eventId, error: rpcError } = await supabase.rpc('rpc_track_analytics_event', {
      p_event_name: eventName,
      p_user_id: user.id,
      p_node_id: null,
      p_category: category,
      p_properties: properties,
      p_source: 'edge_function',
      p_idempotency_key: null,
    });

    if (rpcError) {
      console.error('[analytics-track] RPC failed', { userId: user.id, eventName, error: rpcError.message });
      return jsonResponse(
        {
          success: false,
          error: { code: 'EVENT_NOT_RECORDED', message: 'Could not record the event' },
        },
        500
      );
    }

    return jsonResponse({ success: true, event_id: eventId ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[analytics-track] unexpected error:', message);
    return jsonResponse(
      { success: false, error: { code: 'INTERNAL', message: 'Could not record the event' } },
      500
    );
  }
});
