// filepath: supabase/functions/award-tenure-badges/index.ts
// TASK BADGES-V2-003: Subscription Tenure Badges (Daily Cron)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SubscriptionRecord {
  user_id: string;
  created_at: string;
  status: string;
  tier: string;
}

serve(async (req) => {
  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find users with active subscriptions or trials
    const { data: subscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select('user_id, created_at, status, tier')
      .in('status', ['trial', 'active']);

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      throw fetchError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active subscriptions found', processed: 0 }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    let processedCount = 0;
    let errorCount = 0;

    // Process each subscription
    for (const sub of subscriptions as SubscriptionRecord[]) {
      try {
        // Calculate days since subscription started
        const daysSinceStart = Math.floor(
          (Date.now() - new Date(sub.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Award "Trial Member" badge for trial users (threshold = 0)
        if (sub.status === 'trial') {
          await supabase.rpc('award_badge_if_eligible', {
            p_user_id: sub.user_id,
            p_category: 'subscription',
            p_current_value: 0,
          });
        }

        // Award tenure badges based on days active
        if (daysSinceStart > 0) {
          await supabase.rpc('award_badge_if_eligible', {
            p_user_id: sub.user_id,
            p_category: 'subscription',
            p_current_value: daysSinceStart,
          });
        }

        processedCount++;
      } catch (err) {
        console.error(`Error processing user ${sub.user_id}:`, err);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount,
        errors: errorCount,
        total: subscriptions.length
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Award tenure badges error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

/* 
  ==================================================
  DEPLOYMENT INSTRUCTIONS
  ==================================================
  
  1. Deploy function:
     npx supabase functions deploy award-tenure-badges
  
  2. Set up cron job (run daily at 2 AM UTC):
     Go to Supabase Dashboard > Database > Cron Jobs > Add new job
     
     Schedule: 0 2 * * *
     Command: SELECT net.http_post(
       url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/award-tenure-badges',
       headers:='{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
       body:='{}'::jsonb
     ) as request_id;
  
  3. Test manually:
     curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/award-tenure-badges \
       -H "Authorization: Bearer YOUR_ANON_KEY" \
       -H "Content-Type: application/json"
       
  ==================================================
  ACCEPTANCE CRITERIA
  ==================================================
  
  ✓ Function deployed successfully
  ✓ Cron job runs daily at 2 AM UTC
  ✓ Awards "Trial Member" badge to trial users
  ✓ Awards tenure badges (1-Month, 6-Month, 1-Year) based on days
  ✓ Returns success/error counts in response
*/
