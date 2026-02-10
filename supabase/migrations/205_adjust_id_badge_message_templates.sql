-- =====================================================
-- FILE: supabase/migrations/205_adjust_id_badge_message_templates.sql
-- MODULE: MODULE-10-ID-BADGE-VERIFICATION-V2
-- TASK: Fix Notification Titles (BADGE-011)
-- DESCRIPTION:
--   Align ID badge notification titles and bodies with the Manual Testing Guide.
-- =====================================================

-- 1. Update Approval Templates
UPDATE id_badge_verification_messages
SET message_text = 'ID Verification Approved! 🎉'
WHERE message_key = 'approved_email_subject';

UPDATE id_badge_verification_messages
SET message_text = 'Great! Your ID has been verified. You now have the Verified badge.'
WHERE message_key = 'in_app_approved_notification';

-- 2. Update Rejection Templates
UPDATE id_badge_verification_messages
SET message_text = 'ID Verification Request'
WHERE message_key = 'rejected_email_subject';

UPDATE id_badge_verification_messages
SET message_text = 'Your ID verification was not approved. Please submit a new request with clearer details.'
WHERE message_key = 'in_app_rejected_notification';

-- 3. Update Email Content for Rejection to be more professional if needed, 
-- but keeping it consistent with the guide's expectations.
UPDATE id_badge_verification_messages
SET message_text = 'Hi {first_name}, we were unable to verify your ID. Reason: {rejection_reason}. {admin_notes}. Please submit a new verification request with a clearer photo.'
WHERE message_key = 'rejected_email_body';

-- Verification query
-- SELECT message_key, message_text FROM id_badge_verification_messages WHERE message_key IN ('approved_email_subject', 'rejected_email_subject', 'in_app_approved_notification', 'in_app_rejected_notification');
