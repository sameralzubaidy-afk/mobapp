/**
 * Supabase Edge Function: id-badge-submission-notification
 * 
 * Sends confirmation notifications when user submits ID verification
 * Sends web push + in-app + email to user
 * Sends alerts to admins
 */

import { serve } from 'https://deno.land/std@0.182.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface SubmissionNotificationRequest {
  requestId: string;
  userId: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      } 
    });
  }

  try {
    const { requestId, userId } = await req.json() as SubmissionNotificationRequest;
    console.log(`[ID-BADGE-SUBMISSION] Processing for Request: ${requestId}, User: ${userId}`);

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!serviceRoleKey || !supabaseUrl) {
      console.error('[ID-BADGE-SUBMISSION] Missing environment variables:', { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!serviceRoleKey 
      });
    }

    const supabase = createClient(
      supabaseUrl ?? '',
      serviceRoleKey ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        },
      }
    );

    // 0. Check Notification Preferences
    const { data: prefData } = await supabase
      .from('notification_preferences')
      .select('push_enabled, email_enabled, in_app_enabled')
      .eq('user_id', userId)
      .eq('category', 'badges')
      .maybeSingle();

    // Default to true if no preference record found
    const pushEnabled = prefData ? prefData.push_enabled : true;
    const emailEnabled = prefData ? prefData.email_enabled : true;
    const inAppEnabled = prefData ? prefData.in_app_enabled : true;

    console.log(`[ID-BADGE-SUBMISSION] Preferences for ${userId}: Push=${pushEnabled}, Email=${emailEnabled}, In-App=${inAppEnabled}`);

    // 1. Get Request and Templates
    const [idReqRes, msgRes] = await Promise.all([
      supabase.from('id_badge_verification_requests').select('*').eq('id', requestId).maybeSingle(),
      supabase.from('id_badge_verification_messages').select('message_key, message_text')
    ]);

    const idRequest = idReqRes.data;
    const messages = msgRes.data || [];

    if (!idRequest) {
      console.error(`[ID-BADGE-SUBMISSION] Request ${requestId} not found`);
      return new Response(JSON.stringify({ error: 'Request not found' }), { status: 404 });
    }

    const getMsg = (key: string) => messages.find(m => m.message_key === key)?.message_text;

    // 2. Insert User Notification record (Push + In-App + Email trail)
    if (inAppEnabled) {
      const { error: userNotifErr } = await supabase.from('user_notifications').insert({
        user_id: userId,
        category: 'badges',
        type: 'id_badge_submission',
        title: getMsg('submission_email_subject') || 'ID Verification Submitted',
        body: getMsg('in_app_submission_notification') || 'Your ID verification has been received.',
        channels: ['push', 'in_app', 'email'],
        data: { requestId: requestId },
      });

      if (userNotifErr) console.error(`[ID-BADGE-SUBMISSION] Notification record error:`, userNotifErr);
    }

    // 3. Send Email through send-email function
    const subject = getMsg('submission_email_subject') || 'ID Verification Request Received';
    const bodyTemplate = getMsg('submission_email_body') || 'Hi {first_name}, we have received your ID verification request.';
    const firstName = idRequest.first_name || 'there';
    const emailBody = bodyTemplate.replace('{first_name}', firstName);

    if (emailEnabled && idRequest.email) {
      try {
        console.log(`[ID-BADGE-SUBMISSION] Triggering email to ${idRequest.email}`);
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              type: 'id_badge_submission',
              to: idRequest.email,
              data: {
                subject,
                body: emailBody
              }
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Email function returned ${response.status}: ${await response.text()}`);
        }
        console.log(`[ID-BADGE-SUBMISSION] Email function called successfully`);
      } catch (e) {
        console.error(`[ID-BADGE-SUBMISSION] Email function FAILURE:`, e);
      }
    } else if (!emailEnabled) {
      console.log(`[ID-BADGE-SUBMISSION] Email disabled by user preference`);
    } else {
      console.warn(`[ID-BADGE-SUBMISSION] No email found for request ${requestId}`);
    }

    // New: Send Push Notification
    if (pushEnabled) {
      try {
        console.log(`[ID-BADGE-SUBMISSION] Triggering push to ${userId}`);
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              userId: userId,
              title: subject,
              body: getMsg('in_app_submission_notification') || 'Your ID verification has been received.',
              data: {
                type: 'id_badge_submission',
                requestId: requestId
              }
            })
          }
        );

        if (!response.ok) {
          console.warn(`[ID-BADGE-SUBMISSION] Push function returned ${response.status}`);
        } else {
          console.log(`[ID-BADGE-SUBMISSION] Push function called successfully`);
        }
      } catch (e) {
        console.error(`[ID-BADGE-SUBMISSION] Push function FAILURE:`, e);
      }
    } else {
      console.log(`[ID-BADGE-SUBMISSION] Push disabled by user preference`);
    }

    // 4. Send Admin Alerts
    try {
      const { data: adminRoles } = await supabase
        .from('role_based_access_control')
        .select('user_id')
        .eq('role', 'admin');

      for (const admin of (adminRoles || [])) {
        await supabase.from('admin_notifications').insert({
          admin_id: admin.user_id,
          notification_type: 'id_badge_submission',
          title: 'New ID Verification Request',
          message: `${firstName} submitted an ID for review.`,
          entity_type: 'id_badge_verification_request',
          entity_id: requestId,
        });
      }
    } catch (adminErr) {
      console.error(`[ID-BADGE-SUBMISSION] Admin alert loop failed:`, adminErr);
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('[ID-BADGE-SUBMISSION] Fatal error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
});
