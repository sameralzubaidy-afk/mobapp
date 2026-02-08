-- filepath: supabase/migrations/20260208000000_id_badge_verification_system.sql
-- TASK BADGE-008: ID Badge Verification System Schema
-- Module: MODULE-10-ID-BADGE-VERIFICATION-V2.md
-- Purpose: User can submit government ID screenshots for manual admin verification

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Enum for verification request status
CREATE TYPE id_badge_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Enum for rejection reasons (predefined)
CREATE TYPE id_badge_rejection_reason AS ENUM (
  'unclear_photo',
  'id_expired',
  'name_mismatch',
  'multiple_ids',
  'not_government_id',
  'other'
);

-- =============================================================================
-- TABLES
-- =============================================================================

-- ID Badge Verification Requests table
CREATE TABLE id_badge_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status id_badge_request_status NOT NULL DEFAULT 'pending',
  screenshot_path TEXT, -- Supabase Storage path (deleted after decision)
  screenshot_upload_timestamp TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ, -- When admin made decision
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Admin user
  rejection_reason id_badge_rejection_reason, -- Only if rejected
  rejection_notes TEXT, -- Free-text reason from admin
  approval_notes TEXT, -- Optional notes on approval
  node_id UUID, -- Denormalized for filtering
  first_name TEXT, -- Denormalized for admin queue filtering
  last_name TEXT,
  email TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configurable messages for ID badge system
CREATE TABLE id_badge_verification_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_key TEXT NOT NULL UNIQUE,
  message_text TEXT NOT NULL,
  description TEXT,
  supports_variables BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES for efficient queries
-- =============================================================================

CREATE INDEX id_badge_requests_user_idx ON id_badge_verification_requests(user_id);
CREATE INDEX id_badge_requests_status_idx ON id_badge_verification_requests(status);
CREATE INDEX id_badge_requests_submitted_idx ON id_badge_verification_requests(submitted_at DESC);
CREATE INDEX id_badge_requests_reviewed_idx ON id_badge_verification_requests(reviewed_by);
CREATE INDEX id_badge_requests_node_idx ON id_badge_verification_requests(node_id);
CREATE INDEX id_badge_requests_status_submitted_idx ON id_badge_verification_requests(status, submitted_at DESC);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Enable RLS on both tables
ALTER TABLE id_badge_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE id_badge_verification_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for id_badge_verification_requests

-- Users can view their own requests
CREATE POLICY "Users can view own ID badge requests"
  ON id_badge_verification_requests FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all requests
CREATE POLICY "Admins can view all ID badge requests"
  ON id_badge_verification_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can insert their own requests
CREATE POLICY "Users can insert own ID badge requests"
  ON id_badge_verification_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can update requests (for approval/rejection)
CREATE POLICY "Admins can update ID badge requests"
  ON id_badge_verification_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for id_badge_verification_messages

-- Anyone can read messages
CREATE POLICY "Anyone can view ID badge messages"
  ON id_badge_verification_messages FOR SELECT
  USING (true);

-- Admins can update messages
CREATE POLICY "Admins can update ID badge messages"
  ON id_badge_verification_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================================================
-- SEED DEFAULT MESSAGES (12 configurable templates)
-- =============================================================================

INSERT INTO id_badge_verification_messages (message_key, message_text, description, supports_variables)
VALUES
  (
    'upload_disclaimer',
    'We will not store or keep your ID image. Your image will be permanently deleted after we approve or reject your verification request.',
    'Disclaimer shown on upload screen',
    false
  ),
  (
    'submit_button_label',
    'Submit for Verification',
    'Label on submit button',
    false
  ),
  (
    'pending_status_text',
    'Your verification request is pending. We will review it within 24 hours.',
    'Text shown when request is pending',
    false
  ),
  (
    'in_app_submission_notification',
    'Your ID verification has been received. We will review it within 24 hours.',
    'In-app notification after submission',
    false
  ),
  (
    'approved_email_subject',
    'Your ID Verification is Approved! 🎉',
    'Email subject when approved',
    false
  ),
  (
    'approved_email_body',
    'Congratulations {first_name}! Your ID has been verified. Your profile now displays the Verified badge. Thank you for being part of our trusted community!',
    'Email body when approved',
    true
  ),
  (
    'rejected_email_subject',
    'ID Verification Request - Action Required',
    'Email subject when rejected',
    false
  ),
  (
    'rejected_email_body',
    'Hi {first_name}, we were unable to verify your ID. Reason: {rejection_reason}. {admin_notes} Please submit a new verification request with a clearer photo.',
    'Email body when rejected',
    true
  ),
  (
    'in_app_approved_notification',
    'Great! Your ID has been verified. You now have the Verified badge.',
    'In-app notification when approved',
    false
  ),
  (
    'in_app_rejected_notification',
    'Your ID verification was not approved. Please submit a new request with clearer details.',
    'In-app notification when rejected',
    false
  ),
  (
    'web_push_approved',
    'Your ID verification is complete! You now have the Verified badge.',
    'Web push when approved',
    false
  ),
  (
    'web_push_rejected',
    'Your ID verification request needs resubmission. Please try again with a clearer photo.',
    'Web push when rejected',
    false
  );

-- =============================================================================
-- ADMIN CONFIG for enabling/disabling ID badge verification
-- =============================================================================

INSERT INTO admin_config (key, value, description, category, data_type, is_active)
VALUES
  ('id_badge_verification_enabled', 'true', 'Enable/disable ID badge manual verification for users', 'feature_flags', 'boolean', TRUE),
  ('id_badge_verification_approval_sla_hours', '24', 'Expected approval time in hours', 'feature_flags', 'number', TRUE)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- UPDATE TRIGGERS for updated_at
-- =============================================================================

CREATE TRIGGER update_id_badge_requests_updated_at
  BEFORE UPDATE ON id_badge_verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_id_badge_messages_updated_at
  BEFORE UPDATE ON id_badge_verification_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VERIFICATION QUERIES (run after migration)
-- =============================================================================

-- Verify tables created
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'id_badge%';

-- Verify enums exist
-- SELECT enumtypid::regtype::text AS enum_name FROM pg_enum WHERE enumtypid::regtype::text LIKE 'id_badge%' GROUP BY enum_name;

-- Verify RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'id_badge%';

-- Verify RLS policies
-- SELECT policyname, tablename, cmd FROM pg_policies WHERE tablename LIKE 'id_badge%';

-- Verify messages seeded (should return 12)
-- SELECT COUNT(*) FROM id_badge_verification_messages;

-- Verify admin_config entries
-- SELECT key, value, value_type FROM admin_config WHERE key LIKE 'id_badge%';

-- =============================================================================
-- SUPABASE STORAGE BUCKET SETUP (Manual via Dashboard or Code)
-- =============================================================================

-- NOTE: Storage bucket must be created via Supabase dashboard or Edge Function:
-- Bucket name: id-badge-verification-screenshots
-- Folder structure: {user_id}/{filename}
-- Enable RLS on bucket
-- 
-- Required RLS Policies (create in Supabase dashboard Storage section):
-- 1. Users can upload to their own folder:
--    Policy name: "Users can upload to own folder"
--    Operation: INSERT
--    Policy definition: (bucket_id = 'id-badge-verification-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text)
--
-- 2. Admins can download all:
--    Policy name: "Admins can download all"
--    Operation: SELECT
--    Policy definition: (bucket_id = 'id-badge-verification-screenshots' AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
--
-- 3. Users can delete their own:
--    Policy name: "Users can delete own"
--    Operation: DELETE
--    Policy definition: (bucket_id = 'id-badge-verification-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text)
