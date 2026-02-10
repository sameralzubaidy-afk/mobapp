-- =====================================================
-- FILE: supabase/migrations/204_add_id_badge_submission_email_templates.sql
-- MODULE: MODULE-10-ID-BADGE-VERIFICATION-V2
-- TASK: Fix Email Notification (BADGE-011)
-- DESCRIPTION:
--   Add missing submission email templates to id_badge_verification_messages.
-- =====================================================

INSERT INTO id_badge_verification_messages (message_key, message_text, description, supports_variables)
VALUES
  (
    'submission_email_subject',
    'ID Verification Request Received',
    'Email subject when ID is submitted',
    false
  ),
  (
    'submission_email_body',
    'Hi {first_name}, we have received your ID verification request. We will review it within 24 hours. Thank you for being part of our trusted community!',
    'Email body when ID is submitted',
    true
  )
ON CONFLICT (message_key) DO NOTHING;

-- Verification query
-- SELECT * FROM id_badge_verification_messages WHERE message_key LIKE 'submission_email_%';
