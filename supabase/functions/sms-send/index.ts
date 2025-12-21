// Supabase Edge Function: sms-send
// Proxy to AWS Lambda or SNS endpoint using a server-side secret

import { serve } from 'std/server';

const SMS_API_GATEWAY_URL = Deno.env.get('AWS_SNS_API_GATEWAY_URL') || '';
const SMS_API_GATEWAY_KEY = Deno.env.get('AWS_SNS_API_GATEWAY_KEY') || '';

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    const body = await req.json();
    const { phoneNumber, message } = body || {};

    if (!phoneNumber || !message) {
      return new Response(JSON.stringify({ error: 'phoneNumber and message required' }), { status: 400 });
    }

    if (!SMS_API_GATEWAY_URL) {
      return new Response(JSON.stringify({ error: 'SMS gateway URL not configured' }), { status: 500 });
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (SMS_API_GATEWAY_KEY) headers['x-api-key'] = SMS_API_GATEWAY_KEY;

    const sendRes = await fetch(`${SMS_API_GATEWAY_URL}/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phoneNumber, message }),
    });

    const text = await sendRes.text();
    return new Response(text, { status: sendRes.status });
  } catch (err) {
    console.error('sms-send error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
