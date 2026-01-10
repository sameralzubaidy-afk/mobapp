/**
 * Supabase Edge Function: send-message-email
 * MODULE-07 MSG-007: Email Notifications for Unread Messages
 * 
 * Scheduled function (runs hourly via cron) to send email notifications
 * for unread messages older than configured delay.
 * 
 * POST /functions/v1/send-message-email
 * 
 * Request body:
 * {
 *   "limit": 100 // Optional, default 100
 * }
 */

import { serve } from 'https://deno.land/std@0.182.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const APP_URL = Deno.env.get('APP_URL') || 'https://p2pkidsmarketplace.com';

interface UnreadMessage {
  message_id: string;
  trade_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  sender_name: string;
  recipient_email: string;
}

interface SendResult {
  sent: number;
  failed: number;
  errors: string[];
}

async function sendEmailNotification(
  recipientEmail: string,
  senderName: string,
  messagePreview: string,
  tradeId: string
): Promise<{ success: boolean; error?: string }> {
  if (!SENDGRID_API_KEY) {
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const emailBody = {
    personalizations: [
      {
        to: [{ email: recipientEmail }],
        dynamic_template_data: {
          senderName,
          messagePreview,
          chatLink: `${APP_URL}/chat/${tradeId}`,
          appName: 'Kids P2P Marketplace',
        },
      },
    ],
    from: { email: 'noreply@p2pkidsmarketplace.com' },
    reply_to: { email: 'support@p2pkidsmarketplace.com' },
    // TODO: Create SendGrid template for unread messages
    template_id: Deno.env.get('SENDGRID_TEMPLATE_UNREAD_MESSAGE') || 'd-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SendGrid error: ${response.status}`, errorText);
      return { success: false, error: `SendGrid returned ${response.status}` };
    }

    console.log(`✅ Email sent to ${recipientEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 100;

    console.log(`🔍 Checking for unread messages (limit: ${limit})...`);

    // Get unread messages that need email notification
    const { data: unreadMessages, error: queryError } = await supabase
      .rpc('get_unread_messages_for_email', { p_limit: limit });

    if (queryError) {
      console.error('Error fetching unread messages:', queryError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch unread messages',
          details: queryError.message,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!unreadMessages || unreadMessages.length === 0) {
      console.log('✅ No unread messages to send');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No unread messages to send',
          sent: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Found ${unreadMessages.length} unread messages`);

    // Send emails and track results
    const result: SendResult = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const msg of unreadMessages as UnreadMessage[]) {
      // Truncate message preview to 150 characters
      const messagePreview = msg.content.length > 150
        ? msg.content.substring(0, 150) + '...'
        : msg.content;

      const emailResult = await sendEmailNotification(
        msg.recipient_email,
        msg.sender_name,
        messagePreview,
        msg.trade_id
      );

      if (emailResult.success) {
        // Mark message as email sent
        const { error: updateError } = await supabase
          .rpc('mark_message_email_sent', { p_message_id: msg.message_id });

        if (updateError) {
          console.error('Failed to mark email as sent:', updateError);
          result.failed++;
          result.errors.push(`Failed to update ${msg.message_id}: ${updateError.message}`);
        } else {
          result.sent++;
        }
      } else {
        result.failed++;
        result.errors.push(`Failed to send to ${msg.recipient_email}: ${emailResult.error}`);
      }
    }

    console.log(`✅ Email processing complete: ${result.sent} sent, ${result.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        total: unreadMessages.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
