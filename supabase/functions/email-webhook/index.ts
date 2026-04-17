/**
 * Supabase Edge Function: email-webhook
 * MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-009)
 * TASK: Email event tracking webhook for SendGrid
 * 
 * Receives webhook events from SendGrid and updates email_logs table
 * 
 * POST /functions/v1/email-webhook
 * 
 * SendGrid Event Types:
 * - delivered: Email was delivered successfully
 * - open: Email was opened
 * - click: Link in email was clicked
 * - bounce: Email bounced
 * - dropped: Email was dropped
 * - unsubscribe: User clicked unsubscribe link
 */

import { serve } from 'https://deno.land/std@0.182.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Initialize Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface SendGridEvent {
  email: string;
  timestamp: number;
  event: 'delivered' | 'open' | 'click' | 'bounce' | 'dropped' | 'unsubscribe' | 'spamreport';
  sg_message_id: string;
  url?: string;
  reason?: string;
  status?: string;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const events = await req.json() as SendGridEvent[];
    
    if (!Array.isArray(events)) {
      console.error('[email-webhook] Invalid payload: not an array');
      return new Response(
        JSON.stringify({ error: 'Invalid payload format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[email-webhook] Received ${events.length} events`);

    const processedEvents = [];

    for (const event of events) {
      const { sg_message_id, event: eventType, reason } = event;

      if (!sg_message_id) {
        console.warn('[email-webhook] Event missing sg_message_id, skipping');
        continue;
      }

      console.log(`[email-webhook] Processing ${eventType} event for message ${sg_message_id}`);

      // Track the event in database
      const { error } = await supabase.rpc('track_email_event', {
        p_sendgrid_message_id: sg_message_id,
        p_event_type: eventType,
        p_bounce_reason: reason || null,
      });

      if (error) {
        console.error(`[email-webhook] Error tracking event for ${sg_message_id}:`, error);
      } else {
        processedEvents.push({ message_id: sg_message_id, event: eventType });
      }

      // If unsubscribe event, also update notification preferences
      if (eventType === 'unsubscribe') {
        console.log(`[email-webhook] Processing unsubscribe for ${event.email}`);
        
        // Find user by email
        const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
        
        if (!authError && authUser?.users) {
          const user = authUser.users.find((u) => u.email === event.email);
          
          if (user) {
            // Disable all email notifications
            await supabase
              .from('notification_preferences')
              .update({ email_enabled: false, updated_at: new Date().toISOString() })
              .eq('user_id', user.id);
            
            console.log(`[email-webhook] Disabled email notifications for user ${user.id}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedEvents.length,
        events: processedEvents,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[email-webhook] Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
