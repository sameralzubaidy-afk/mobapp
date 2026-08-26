// Supabase Edge Function: auth-update-phone
// Updates a user's phone using the Supabase service_role key (admin privileges)
// Expects POST JSON: { user_id: string, phone: string }

import { serve } from 'https://deno.land/std@0.201.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('DATABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';

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

    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
      return new Response(
        JSON.stringify({ error: 'Server not configured: missing service role key' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = authHeader.replace(/Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { user_id: userId, phone } = body || {};
    if (!userId || !phone) {
      return new Response(JSON.stringify({ error: 'user_id and phone required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (authData.user.id !== userId) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'PHONE_OWNERSHIP_DENIED',
            message: 'You can only update your own phone number.',
          },
        }),
        {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    // Use the Admin API to update the user without requiring an SMS provider
    const { data, error } = await admin.auth.admin.updateUserById(userId, { phone });
    if (error) {
      console.error('auth-update-phone admin.updateUserById error:', error);
      return new Response(JSON.stringify({ error }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Keep profiles.phone in sync with the account phone (auth.users.phone).
    // Mirrors auth-email-change, which syncs profiles.email right after the
    // auth email update. The DB trigger on_auth_user_updated also syncs this
    // transactionally with the auth.users UPDATE (20260826000001 fixes its
    // precedence); this explicit service-role write is a deterministic
    // fallback so profiles.phone is never stale even if the trigger is not
    // attached in the target DB. Non-blocking on failure (the auth phone is
    // already updated; a stale mirror is a warning, not a failed change).
    const { error: profileSyncError } = await admin
      .from('profiles')
      .update({ phone })
      .eq('user_id', userId);
    if (profileSyncError) {
      console.warn('auth-update-phone profiles.phone sync failed (non-blocking):', profileSyncError);
    }

    return new Response(JSON.stringify({ success: true, user: data }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('auth-update-phone exception:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
