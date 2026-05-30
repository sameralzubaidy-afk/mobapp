// Supabase Edge Function: sms-send
// Proxy to AWS Lambda or SNS endpoint using a server-side secret

import { serve } from 'std/server';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SMS_API_GATEWAY_URL = Deno.env.get('AWS_SNS_API_GATEWAY_URL') || '';
const SMS_API_GATEWAY_KEY = Deno.env.get('AWS_SNS_API_GATEWAY_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Server auth config missing' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = authHeader.replace(/Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { phoneNumber, message } = body || {};

    if (!phoneNumber || !message) {
      return new Response(JSON.stringify({ error: 'phoneNumber and message required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!SMS_API_GATEWAY_URL) {
      return new Response(JSON.stringify({ error: 'SMS gateway URL not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (SMS_API_GATEWAY_KEY) headers['x-api-key'] = SMS_API_GATEWAY_KEY;

    const sendRes = await fetch(`${SMS_API_GATEWAY_URL}/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phoneNumber, message }),
    });

    const text = await sendRes.text();
    return new Response(text, {
      status: sendRes.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('sms-send error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
