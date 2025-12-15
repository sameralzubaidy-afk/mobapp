// Supabase Edge Function: auth-update-phone
// Updates a user's phone using the Supabase service_role key (admin privileges)
// Expects POST JSON: { user_id: string, phone: string }

import { serve } from 'https://deno.land/std@0.201.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('DATABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
      return new Response(JSON.stringify({ error: 'Server not configured: missing service role key' }), { status: 500 });
    }

    const body = await req.json();
    const { user_id: userId, phone } = body || {};
    if (!userId || !phone) {
      return new Response(JSON.stringify({ error: 'user_id and phone required' }), { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Use the Admin API to update the user without requiring an SMS provider
    const { data, error } = await admin.auth.admin.updateUserById(userId, { phone });
    if (error) {
      console.error('auth-update-phone admin.updateUserById error:', error);
      return new Response(JSON.stringify({ error }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, user: data }), { status: 200 });
  } catch (err) {
    console.error('auth-update-phone exception:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
