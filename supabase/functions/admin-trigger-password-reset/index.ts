// Edge Function: admin-trigger-password-reset
// Task: ADMIN-V2-006
// Allows admin to trigger a password reset email for any user

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase clients
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify caller is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify caller is admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from('role_based_access_control')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    // Additive params (Backward Compatibility Gate): existing admin callers send only
    // `target_user_id` and get the exact same behavior/response as before. The new optional
    // params `email` and `return_link` are QA-harness conveniences (see SECURITY GATE below).
    const { target_user_id, email: emailParam, return_link } = await req.json();

    // Resolve the target email. `email` is accepted directly for the QA harness (personas are
    // referenced by email in the QA registry); `target_user_id` remains the canonical admin path.
    let targetEmail: string | undefined = emailParam;
    if (!targetEmail) {
      if (!target_user_id) {
        return new Response(
          JSON.stringify({ error: 'target_user_id (or email) is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Get target user's email using service role
      const { data: targetUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(
        target_user_id
      );

      if (userError || !targetUser) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      targetEmail = targetUser.user.email!;
    }

    // ------------------------------------------------------------------
    // QA harness: optionally RETURN the minted recovery link instead of
    // only emailing it. This unblocks AUTH-TC-S08 / AUTH-TC-S11 Case 2 in
    // the iOS simulator, which has no mail client (Phase 14/15 finding).
    //
    // SECURITY GATE (fail closed — an env check, never a comment-only gate):
    // The recovery link is a full session-minting credential (its fragment
    // embeds access_token/refresh_token). It is returned ONLY when BOTH hold:
    //   1) the caller explicitly opts in with `return_link: true`, AND
    //   2) the server-side `APP_ENV` function env var is exactly `staging`
    //      or `development`.
    // `APP_ENV` must be provisioned per project (e.g.
    // `supabase secrets set --project-ref <ref> APP_ENV=staging`). When it is
    // unset or anything other than staging/development (the production
    // posture), this returns 403 and NEVER emits the link — the function then
    // behaves exactly like the pre-existing email-only path.
    // The service-role key stays server-side and is never logged or returned.
    // ------------------------------------------------------------------
    const appEnv = Deno.env.get('APP_ENV');
    const allowLinkReturn = appEnv === 'staging' || appEnv === 'development';

    if (return_link === true && !allowLinkReturn) {
      console.warn(
        `[admin-trigger-password-reset] return_link requested but disabled (APP_ENV=${appEnv ?? 'unset'}) — refusing to return reset link`
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'LINK_RETURN_DISABLED',
            message:
              'Returning reset links is only available in staging/development environments (APP_ENV must be set to staging or development).',
          },
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Trigger password reset email (and capture the minted link) using service role
    const { data: linkData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: targetEmail,
    });

    if (resetError) {
      console.error('[admin-trigger-password-reset] Error:', resetError);
      return new Response(
        JSON.stringify({ error: `Failed to send password reset: ${resetError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const linkReturned = return_link === true && allowLinkReturn;
    // NEVER log the link/token itself — it is a session credential. Log only the boolean.
    console.log(
      `[admin-trigger-password-reset] recovery link minted for <redacted> (link_returned=${linkReturned}, APP_ENV=${appEnv ?? 'unset'})`
    );

    // Log the admin action
    await supabaseClient.from('admin_activity_log').insert({
      admin_id: user.id,
      action_type: 'trigger_password_reset',
      entity_type: 'user',
      // entity_id is a nullable UUID column — pass the UUID when known, else null
      // (email-only calls record the address in `notes` instead).
      entity_id: target_user_id ?? null,
      notes: linkReturned
        ? `Password reset link minted for ${targetEmail} (returned to caller)`
        : `Password reset email sent to ${targetEmail}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: linkReturned
          ? `Password reset link minted for ${targetEmail}`
          : `Password reset email sent to ${targetEmail}`,
        ...(linkReturned ? { resetLink: linkData?.properties?.action_link } : {}),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[admin-trigger-password-reset] Unexpected error:', error);
    const errMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
