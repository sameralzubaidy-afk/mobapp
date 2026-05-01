// File: supabase/functions/send-phone-otp/index.ts
// Supabase Edge Function: Generate and send phone verification OTP via Twilio
// Enforces rate limits, hashes OTPs with bcrypt, stores in phone_verification_codes

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Twilio credentials from environment
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER');

// Supabase client (service role to bypass RLS for rate limit checks)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface RequestBody {
  phone: string;
  user_id: string;
}

/**
 * Generate a cryptographically secure 6-digit OTP
 */
function generateOTP(): string {
  const array = new Uint8Array(4);
  crypto.getRandomValues(array);
  
  // Convert to number and ensure it's 6 digits
  const num = Array.from(array).reduce((acc, val) => acc * 256 + val, 0);
  const code = (num % 900000) + 100000; // Ensures 100000-999999 range
  
  return code.toString();
}

/**
 * Hash OTP using pgcrypto crypt + bcrypt
 */
async function hashOTP(code: string): Promise<string> {
  // Call Postgres crypt() via RPC
  const { data, error } = await supabaseAdmin.rpc('hash_otp_code', {
    p_code: code,
  });

  if (error) {
    throw new Error(`Failed to hash OTP: ${error.message}`);
  }

  return data as string;
}

/**
 * Check rate limits:
 * - 3 per phone per hour
 * - 5 per user per day
 */
async function checkRateLimits(
  phone: string,
  userId: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Check phone rate limit (3 per hour)
  const { count: phoneCount, error: phoneError } = await supabaseAdmin
    .from('phone_verification_codes')
    .select('*', { count: 'exact', head: true })
    .eq('phone', phone)
    .gte('created_at', oneHourAgo.toISOString());

  if (phoneError) {
    console.error('Phone rate limit check failed:', phoneError);
    throw new Error('Rate limit check failed');
  }

  if (phoneCount !== null && phoneCount >= 3) {
    // Calculate retry time (1 hour from now)
    return { allowed: false, retryAfterSeconds: 3600 };
  }

  // Check user rate limit (5 per day)
  const { count: userCount, error: userError } = await supabaseAdmin
    .from('phone_verification_codes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneDayAgo.toISOString());

  if (userError) {
    console.error('User rate limit check failed:', userError);
    throw new Error('Rate limit check failed');
  }

  if (userCount !== null && userCount >= 5) {
    // Calculate retry time (24 hours from now)
    return { allowed: false, retryAfterSeconds: 86400 };
  }

  return { allowed: true };
}

/**
 * Send SMS via Twilio
 */
async function sendSMS(phone: string, code: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    throw new Error('Twilio credentials not configured');
  }

  const message = `Your verification code is: ${code}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  const body = new URLSearchParams({
    To: phone,
    From: TWILIO_FROM_NUMBER,
    Body: message,
  });

  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Twilio API error:', errorText);
    throw new Error(`Twilio SMS failed: ${response.status}`);
  }

  const result = await response.json();
  console.log('SMS sent successfully:', result.sid);
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { phone, user_id } = body;

    if (!phone || !user_id) {
      return new Response(
        JSON.stringify({ error: 'phone and user_id required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Validate phone format (basic E.164 check)
    if (!/^\+[1-9]\d{1,14}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format (use E.164: +12025551234)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // 1. Check rate limits
    const rateLimitResult = await checkRateLimits(phone, user_id);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfterSeconds: rateLimitResult.retryAfterSeconds,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // 2. Generate OTP
    const code = generateOTP();
    console.log('[send-phone-otp] Generated OTP:', code, 'for phone:', phone);

    // 3. Hash OTP using bcrypt
    const codeHash = await hashOTP(code);

    // 4. Store in database
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const { error: insertError } = await supabaseAdmin
      .from('phone_verification_codes')
      .insert({
        user_id,
        phone,
        code_hash: codeHash,
        attempts: 0,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Failed to insert verification code:', insertError);
      throw new Error('Failed to store verification code');
    }

    // 5. Send SMS via Twilio
    await sendSMS(phone, code);

    // Success
    return new Response(
      JSON.stringify({ success: true, message: 'Verification code sent' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const err = error as Error;
    console.error('[send-phone-otp] Error:', err);

    return new Response(
      JSON.stringify({
        error: err.message || 'Internal server error',
        code: 'SEND_FAILED',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
