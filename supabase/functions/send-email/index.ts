/**
 * Supabase Edge Function: send-email
 * 
 * Send emails via SendGrid API
 * 
 * POST /functions/v1/send-email
 * 
 * Request body:
 * {
 *   "type": "welcome" | "password_reset" | "trade_notification" | "transaction_confirmation" | "subscription_status",
 *   "to": "recipient@example.com",
 *   "data": {
 *     // Type-specific data
 *   }
 * }
 */

import { serve } from 'https://deno.land/std@0.182.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface SendEmailRequest {
  type: 'welcome' | 'password_reset' | 'trade_notification' | 'transaction_confirmation' | 'subscription_status';
  to: string;
  data?: Record<string, any>;
}

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const SENDGRID_FROM_EMAIL = 'noreply@p2pkidsmarketplace.com';
const SENDGRID_REPLY_TO_EMAIL = 'support@p2pkidsmarketplace.com';

// Template IDs from SendGrid
const TEMPLATES = {
  welcome: Deno.env.get('SENDGRID_TEMPLATE_WELCOME') || 'd-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  password_reset: Deno.env.get('SENDGRID_TEMPLATE_PASSWORD_RESET') || 'd-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
  trade_notification: Deno.env.get('SENDGRID_TEMPLATE_TRADE_NOTIFICATION') || 'd-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  transaction_confirmation: Deno.env.get('SENDGRID_TEMPLATE_TRANSACTION_CONFIRMATION') || 'd-wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
  subscription_status: Deno.env.get('SENDGRID_TEMPLATE_SUBSCRIPTION_STATUS') || 'd-vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
};

interface SendGridRequest {
  personalizations: Array<{
    to: Array<{ email: string }>;
    dynamic_template_data: Record<string, any>;
  }>;
  from: { email: string };
  reply_to: { email: string };
  template_id: string;
}

async function sendViaSendGrid(
  to: string,
  templateId: string,
  dynamicData: Record<string, any>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!SENDGRID_API_KEY) {
    console.error('SendGrid API key not configured');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const payload: SendGridRequest = {
    personalizations: [
      {
        to: [{ email: to }],
        dynamic_template_data: dynamicData,
      },
    ],
    from: { email: SENDGRID_FROM_EMAIL },
    reply_to: { email: SENDGRID_REPLY_TO_EMAIL },
    template_id: templateId,
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`SendGrid API error: ${response.status}`, errorData);
      return {
        success: false,
        error: `SendGrid API returned ${response.status}`,
      };
    }

    console.log(`✅ Email sent successfully to ${to}`);

    // Try to get message ID from response headers
    const messageId = response.headers.get('x-message-id');

    return {
      success: true,
      messageId: messageId || undefined,
    };
  } catch (error) {
    console.error('SendGrid request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function validateRequest(req: SendEmailRequest): { valid: boolean; error?: string } {
  if (!req.type) {
    return { valid: false, error: 'Missing email type' };
  }

  if (!req.to) {
    return { valid: false, error: 'Missing recipient email' };
  }

  if (!req.to.includes('@')) {
    return { valid: false, error: 'Invalid email address' };
  }

  const validTypes = ['welcome', 'password_reset', 'trade_notification', 'transaction_confirmation', 'subscription_status'];
  if (!validTypes.includes(req.type)) {
    return { valid: false, error: `Invalid email type: ${req.type}` };
  }

  return { valid: true };
}

async function processWelcomeEmail(
  to: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const result = await sendViaSendGrid(to, TEMPLATES.welcome, {
    firstName: data?.firstName || 'User',
    appDownloadLink: data?.appDownloadLink || 'https://p2pkidsmarketplace.com/app',
  });

  return { success: result.success, error: result.error };
}

async function processPasswordResetEmail(
  to: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!data?.resetToken) {
    return { success: false, error: 'Missing resetToken in request data' };
  }

  const resetLink = data.resetLink || `https://p2pkidsmarketplace.com/reset-password?token=${data.resetToken}`;

  const result = await sendViaSendGrid(to, TEMPLATES.password_reset, {
    resetLink,
    expiryMinutes: 60,
  });

  return { success: result.success, error: result.error };
}

async function processTradeNotificationEmail(
  to: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!data?.buyerName || !data?.itemTitle || !data?.itemPrice) {
    return { success: false, error: 'Missing required fields: buyerName, itemTitle, itemPrice' };
  }

  const result = await sendViaSendGrid(to, TEMPLATES.trade_notification, {
    buyerName: data.buyerName,
    itemTitle: data.itemTitle,
    itemPrice: data.itemPrice.toFixed(2),
    tradeLink: data.tradeLink || 'https://p2pkidsmarketplace.com/trades',
  });

  return { success: result.success, error: result.error };
}

async function processTransactionConfirmationEmail(
  to: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!data?.sellerName || !data?.itemTitle || !data?.transactionId || !data?.itemPrice) {
    return {
      success: false,
      error: 'Missing required fields: sellerName, itemTitle, transactionId, itemPrice',
    };
  }

  const result = await sendViaSendGrid(to, TEMPLATES.transaction_confirmation, {
    sellerName: data.sellerName,
    itemTitle: data.itemTitle,
    transactionId: data.transactionId,
    itemPrice: data.itemPrice.toFixed(2),
    swapPointsUsed: (data.swapPointsUsed || 0).toFixed(2),
  });

  return { success: result.success, error: result.error };
}

async function processSubscriptionStatusEmail(
  to: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!data?.status) {
    return { success: false, error: 'Missing status in request data' };
  }

  const result = await sendViaSendGrid(to, TEMPLATES.subscription_status, {
    status: data.status,
    tier: data.tier || 'Kids Club+',
    expiryDate: data.expiryDate || 'N/A',
  });

  return { success: result.success, error: result.error };
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
    const body = await req.json();
    const request = body as SendEmailRequest;

    // Validate request
    const validation = validateRequest(request);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Process email based on type
    let result: { success: boolean; error?: string };

    switch (request.type) {
      case 'welcome':
        result = await processWelcomeEmail(request.to, request.data);
        break;
      case 'password_reset':
        result = await processPasswordResetEmail(request.to, request.data);
        break;
      case 'trade_notification':
        result = await processTradeNotificationEmail(request.to, request.data);
        break;
      case 'transaction_confirmation':
        result = await processTransactionConfirmationEmail(request.to, request.data);
        break;
      case 'subscription_status':
        result = await processSubscriptionStatusEmail(request.to, request.data);
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown email type' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const statusCode = result.success ? 200 : 500;
    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Email function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
