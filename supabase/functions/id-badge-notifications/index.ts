/**
 * Supabase Edge Function: id-badge-notifications
 * 
 * Sends notifications for ID Badge verification outcomes (Approve/Reject)
 * Emails + Push + In-App
 */

import { serve } from 'https://deno.land/std@0.182.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface IdBadgeNotificationRequest {
  type: 'id_badge_approved' | 'id_badge_rejected';
  userId: string;
  requestId: string;
  rejectionReason?: string;
  adminNotes?: string;
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
    const { type, userId: providedUserId, requestId, rejectionReason, adminNotes } = await req.json() as any;
    console.log(`[ID-BADGE-OUTCOME] Processing ${type} for Request: ${requestId}`);

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!serviceRoleKey || !supabaseUrl) {
      console.error('[ID-BADGE-OUTCOME] Missing environment variables');
      return new Response(JSON.stringify({ error: 'Missing environment variables' }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 0. Check Notification Preferences
    const { data: prefData } = await supabase
      .from('notification_preferences')
      .select('push_enabled, email_enabled, in_app_enabled')
      .eq('user_id', providedUserId)
      .eq('category', 'badges')
      .maybeSingle();
    
    // Default to true if no preference record found (should be impossible due to trigger)
    const pushEnabled = prefData ? prefData.push_enabled : true;
    const emailEnabled = prefData ? prefData.email_enabled : true;
    const inAppEnabled = prefData ? prefData.in_app_enabled : true;

    console.log(`[ID-BADGE-OUTCOME] Preferences for ${providedUserId}: Push=${pushEnabled}, Email=${emailEnabled}, In-App=${inAppEnabled}`);

    // 1. Get Request and Templates
    const [idReqRes, msgRes] = await Promise.all([
      supabase.from('id_badge_verification_requests').select('*').eq('id', requestId).maybeSingle(),
      supabase.from('id_badge_verification_messages').select('message_key, message_text')
    ]);

    if (idReqRes.error) {
      console.error('[ID-BADGE-OUTCOME] Error fetching request:', idReqRes.error);
      return new Response(JSON.stringify({ error: 'Error fetching request' }), { status: 500 });
    }

    const idRequest = idReqRes.data;
    if (!idRequest) {
      console.error('[ID-BADGE-OUTCOME] Request not found:', requestId);
      return new Response(JSON.stringify({ error: 'Request not found' }), { status: 404 });
    }

    const userId = providedUserId || idRequest.user_id;
    const messages = msgRes.data || [];
    const getMsg = (key: string) => messages.find(m => m.message_key === key)?.message_text;

    const isApproved = type === 'id_badge_approved' || type === 'approved';
    const firstName = idRequest?.first_name || 'there';
    
    // Convert snake_case reason to a more readable format
    const readableReason = rejectionReason 
      ? rejectionReason.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      : 'Unclear photo';

    // 2. Format Notification Content
    // For Title, we prefer the email subject or a default
    const title = getMsg(isApproved ? 'approved_email_subject' : 'rejected_email_subject') || 
                  (isApproved ? 'ID Verification Approved! 🎉' : 'ID Verification Request');
    
    // For In-App, use the short versions
    let inAppBody = getMsg(isApproved ? 'in_app_approved_notification' : 'in_app_rejected_notification') || 
                      (isApproved ? 'Great! Your ID has been verified.' : 'Your ID verification was not approved.');

    // Variable replacement for inAppBody if needed (though usually simple)
    if (!isApproved) {
      inAppBody = inAppBody.replace('{rejection_reason}', readableReason);
    }

    // 3. Insert User Notification record
    if (inAppEnabled) {
      console.log(`[ID-BADGE-OUTCOME] Inserting notification for ${userId} with title: ${title}`);
      const { error: notifError } = await supabase.from('user_notifications').insert({
        user_id: userId,
        category: 'badges',
        type: type,
        title: title,
        body: inAppBody,
        channels: ['push', 'in_app', 'email'],
        data: {
          requestId: requestId,
          status: isApproved ? 'approved' : 'rejected',
          screen: isApproved ? 'Profile' : 'IDVerificationUpload'
        }
      });

      if (notifError) {
        console.error(`[ID-BADGE-OUTCOME] user_notifications Insert ERROR:`, notifError);
      } else {
        console.log(`[ID-BADGE-OUTCOME] In-app notification created for ${userId}`);
      }
    } else {
      console.log(`[ID-BADGE-OUTCOME] In-App notifications disabled for ${userId}`);
    }

    // 4. Send Email via send-email function
    if (emailEnabled && idRequest?.email) {
      const emailSubject = title;
      const bodyKey = isApproved ? 'approved_email_body' : 'rejected_email_body';
      let emailBody = getMsg(bodyKey) || (isApproved ? 'Your ID is approved.' : 'Your ID was rejected.');
      
      // Variable replacement
      emailBody = emailBody.replace('{first_name}', firstName);
      if (!isApproved) {
        emailBody = emailBody.replace('{rejection_reason}', readableReason);
        emailBody = emailBody.replace('{admin_notes}', adminNotes || 'None provided');
      }

      try {
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'apikey': Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            },
            body: JSON.stringify({
              type: type as any,
              to: idRequest.email,
              data: {
                subject: emailSubject,
                body: emailBody,
                rejectionReason: !isApproved ? rejectionReason : undefined,
                adminNotes: !isApproved ? adminNotes : undefined
              }
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Email function returned ${response.status}: ${await response.text()}`);
        }
        console.log(`[ID-BADGE-OUTCOME] Email triggered for ${idRequest.email}`);
      } catch (e) {
        console.error(`[ID-BADGE-OUTCOME] Email function failure:`, e);
      }
    }

    // 5. Send Push Notification
    if (pushEnabled) {
      try {
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'apikey': Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            },
            body: JSON.stringify({
              userId: userId,
              title: title,
              body: inAppBody,
              data: {
                type: type,
                requestId: requestId,
                screen: isApproved ? 'Profile' : 'IDVerificationUpload'
              }
            })
          }
        );

        if (!response.ok) {
          console.warn(`[ID-BADGE-OUTCOME] Push function returned ${response.status}: ${await response.text()}`);
        } else {
          console.log(`[ID-BADGE-OUTCOME] Push triggered for ${userId}`);
        }
      } catch (e) {
        console.error(`[ID-BADGE-OUTCOME] Push function failure:`, e);
      }
    } else {
      console.log(`[ID-BADGE-OUTCOME] Push notifications disabled for ${userId}`);
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('[ID-BADGE-OUTCOME] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
