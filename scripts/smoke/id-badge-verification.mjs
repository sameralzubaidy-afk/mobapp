// File: scripts/smoke/id-badge-verification.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSmokeTest() {
  console.log('🚀 Starting ID Badge Verification Smoke Test...');

  try {
    // 1. Check Tables
    const { data: tables, error: tablesError } = await supabase
      .from('id_badge_verification_messages')
      .select('count', { count: 'exact', head: true });

    if (tablesError) throw new Error(`Table "id_badge_verification_messages" check failed: ${tablesError.message}`);
    console.log('✅ id_badge_verification_messages table exists');

    const { error: requestsError } = await supabase
      .from('id_badge_verification_requests')
      .select('id')
      .limit(1);

    if (requestsError) throw new Error(`Table "id_badge_verification_requests" check failed: ${requestsError.message}`);
    console.log('✅ id_badge_verification_requests table exists');

    // 2. Check Storage Bucket
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) throw bucketError;
    
    const idBadgeBucket = buckets.find(b => b.name === 'id-badge-verification-screenshots');
    if (!idBadgeBucket) throw new Error('Storage bucket "id-badge-verification-screenshots" not found');
    console.log('✅ id-badge-verification-screenshots bucket exists');

    // 3. Check Messages Seed
    const { data: messages, error: msgError } = await supabase
      .from('id_badge_verification_messages')
      .select('message_key');
    
    if (msgError) throw msgError;
    const requiredKeys = [
      'upload_disclaimer', 'submit_button_label', 'pending_status_text',
      'in_app_submission_notification', 'approved_email_subject', 'approved_email_body',
      'rejected_email_subject', 'rejected_email_body', 'in_app_approved_notification',
      'in_app_rejected_notification', 'web_push_approved', 'web_push_rejected'
    ];
    
    const missingKeys = requiredKeys.filter(k => !messages.find(m => m.message_key === k));
    if (missingKeys.length > 0) {
      console.warn(`⚠️ Missing message keys: ${missingKeys.join(', ')}`);
    } else {
      console.log('✅ All 12 message templates exist');
    }

    console.log('\n✨ Smoke test completed successfully!');
    
  } catch (error) {
    console.error(`\n❌ Smoke test failed: ${error.message}`);
    process.exit(1);
  }
}

runSmokeTest();
