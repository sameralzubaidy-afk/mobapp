# MODULE-10-PART-2: ID BADGE MANUAL VERIFICATION SYSTEM

**Version:** 2.0  
**Last Updated:** February 8, 2026  
**Status:** Ready for Implementation  
**Dependencies:** MODULE-02 (Authentication), MODULE-03 (Profiles), MODULE-14 (Notifications)  
**Module Type:** Standalone (No dependency on auto-badge system)

---

## OVERVIEW

Users can voluntarily upgrade their trust level by submitting government ID screenshots for manual admin verification. This creates a "Verified" badge visible on their profile, signaling trust to other users. The system is completely independent and does not require the auto-badge infrastructure.

**Key Flow:**
1. User navigates to "Upgrade to Verified" on profile
2. User uploads ID screenshot with privacy disclaimer
3. Screenshot stored temporarily in Supabase Storage
4. Admin reviews in queue, approves/rejects with reason
5. Screenshot deleted immediately after decision
6. User notified via push + in-app + email
7. Verified badge awarded on approval

---

## CRITICAL RULES (MVP)

### Privacy & Data Handling
- **NO storage** of ID screenshots after decision (immediate deletion)
- ID images stored temporarily only during admin review window
- All messages about non-storage must be configurable (admin can customize)
- User consent required before submission

### Admin Controls
- Enable/disable ID badge verification system globally
- Configurable decision timeframe (SLA) - default 24 hours
- Predefined rejection reasons (6 options) + free-text notes
- All admin actions logged in audit trail
- Admin receives web push notification on new submission

### Notifications
- Multi-channel: push + in-app + email (respect user preferences)
- Template variables: `{first_name}`, `{rejection_reason}`, `{admin_notes}`
- Rejection email includes reason so user can resubmit
- All message templates configurable by admin

### Status Tracking
- Request status: pending → approved/rejected
- No auto-expiration (admin manually reviews)
- Users can resubmit immediately after rejection
- History of all submissions preserved (metadata only, no screenshots)

---

## AGENT-OPTIMIZED PROMPT TEMPLATE

```text
@agent: claude-sonnet-4.5
@mode: extended-reasoning
@autonomy: high

AGENT INSTRUCTIONS:
1. Read the entire task before generating code.
2. Produce a short plan (3-6 steps) and list any missing dependencies.
3. Generate the requested files exactly at the `filepath` locations.
4. Create unit tests for critical logic using the project's test framework.
5. Run a self-check list: type-check, lint, and run the new tests (if environment available).
6. Add concise TODO comments where manual verification is required (secrets, environment variables, or infra setup).

VERIFICATION STEPS (agent must print results):
- TypeScript type-check: `npm run type-check` (or `yarn tsc`)
- Linting: `npm run lint`
- Tests: `npm test -- --testPathPattern=<new tests>`

ERROR HANDLING RULES:
- If a required file/dependency is missing, stop and report exact missing paths.
- For runtime secrets (API keys), inject clear TODOs and do not attempt to store secrets in code.
- For database schema mismatches, add migration stubs and mark for manual review.

REASONING GUIDELINES:
- Provide brief chain-of-thought before producing complex SQL or payment flows.
- Flag performance, security, and privacy concerns.
```

---

## TASK BADGE-008: Implement ID Badge Verification System Schema

**Duration:** 2.5 hours  
**Priority:** Critical  
**Dependencies:** MODULE-02 (Authentication), MODULE-03 (Profiles)

### Description
Create database schema for ID badge verification requests. Add `id_badge_verification_requests` table with user info, submission status, rejection reason, screenshot storage path, and timestamps. Create Supabase Storage bucket for temporary ID screenshots with secure RLS policies. Create `id_badge_verification_messages` table with 12 configurable message templates. Add admin config flags.

---

### AI Prompt for Cursor (Generate ID Badge Schema)

```typescript
/*
TASK: Create ID badge verification request schema and storage

CONTEXT:
Users submit ID screenshots for manual verification.
Admin approves/rejects with reasons.
Screenshots auto-deleted after decision (immediate deletion).
All submission history preserved (metadata only).
System completely independent from auto-badge infrastructure.

REQUIREMENTS:
1. Create id_badge_verification_requests table
2. Create id_badge_verification_storage bucket in Supabase Storage
3. Enable RLS on bucket (user can upload, admin can view/download)
4. Create id_badge_verification_messages table for configurable messages
5. Add indexes for efficient queries
6. Add admin_config flags for feature gating

==================================================
FILE 1: Database migration for ID badge verification
==================================================
*/

-- filepath: supabase/migrations/040_id_badge_verification_system.sql

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

-- ID Badge Verification Requests table
CREATE TABLE id_badge_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status id_badge_request_status NOT NULL DEFAULT 'pending',
  screenshot_path TEXT, -- Supabase Storage path (deleted after decision)
  screenshot_upload_timestamp TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ, -- When admin made decision
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin user
  rejection_reason id_badge_rejection_reason, -- Only if rejected
  rejection_notes TEXT, -- Free-text reason from admin
  approval_notes TEXT, -- Optional notes on approval
  node_id UUID, -- Denormalized for filtering (references nodes table)
  first_name TEXT, -- Denormalized for admin queue filtering
  last_name TEXT,
  email TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient filtering
CREATE INDEX id_badge_requests_user_idx ON id_badge_verification_requests(user_id);
CREATE INDEX id_badge_requests_status_idx ON id_badge_verification_requests(status);
CREATE INDEX id_badge_requests_submitted_idx ON id_badge_verification_requests(submitted_at DESC);
CREATE INDEX id_badge_requests_reviewed_idx ON id_badge_verification_requests(reviewed_by);
CREATE INDEX id_badge_requests_node_idx ON id_badge_verification_requests(node_id);
CREATE INDEX id_badge_requests_status_submitted_idx ON id_badge_verification_requests(status, submitted_at DESC);

-- RLS policies for id_badge_verification_requests
ALTER TABLE id_badge_verification_requests ENABLE ROW LEVEL SECURITY;

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

-- Seed default configurable messages (12 templates)
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

-- RLS policies for messages (admins can update, everyone can read)
ALTER TABLE id_badge_verification_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ID badge messages"
  ON id_badge_verification_messages FOR SELECT
  USING (true);

CREATE POLICY "Admins can update ID badge messages"
  ON id_badge_verification_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add admin config for enabling/disabling ID badge verification
INSERT INTO admin_config (key, value, value_type, description)
VALUES
  ('id_badge_verification_enabled', 'true', 'boolean', 'Enable/disable ID badge manual verification for users'),
  ('id_badge_verification_approval_sla_hours', '24', 'integer', 'Expected approval time in hours')
ON CONFLICT (key) DO NOTHING;

-- Update trigger for updated_at
CREATE TRIGGER update_id_badge_requests_updated_at
  BEFORE UPDATE ON id_badge_verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_id_badge_messages_updated_at
  BEFORE UPDATE ON id_badge_verification_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

/*
==================================================
FILE 2: Supabase Storage bucket setup (manual)
==================================================
*/

-- Note: Storage bucket creation must be done via Supabase dashboard or Edge Function
-- Bucket name: id-badge-verification-screenshots
-- Folder structure: {user_id}/{filename}
-- Enable RLS on bucket
-- RLS Policies required (create in Supabase dashboard):
--   1. Users can upload to: storage.objects.name ILIKE auth.uid()::text || '/%'
--   2. Admins can download: role = 'admin'
--   3. Automatic deletion: (implement via Edge Function scheduled task)

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ id_badge_verification_requests table created with all columns
✓ id_badge_request_status enum created (pending, approved, rejected)
✓ id_badge_rejection_reason enum created (6 predefined reasons)
✓ Indexes on user_id, status, submitted_at for performance
✓ RLS policies allow users to view own requests, admins to view all
✓ id_badge_verification_messages table created with 12 default messages
✓ Admin can update all messages for flexibility
✓ admin_config entries created for feature flag and SLA
✓ Timestamps (created_at, updated_at, submitted_at, reviewed_at) set correctly
✓ Supabase Storage bucket created with RLS policies

==================================================
NEXT TASK
==================================================

BADGE-009: ID Badge Upload Flow (Mobile Screen)
*/
```

### Output Files
1. **supabase/migrations/040_id_badge_verification_system.sql** - Schema and RLS policies
2. **Supabase Storage bucket** - `id-badge-verification-screenshots` (manual setup or dashboard)

### Testing Steps
1. Verify tables created: `SELECT * FROM id_badge_verification_requests LIMIT 1`
2. Verify enums exist: `SELECT * FROM pg_enum WHERE enumtypid::regtype::text LIKE 'id_badge%'`
3. Verify RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'id_badge_verification_requests'`
4. Verify messages seeded: `SELECT COUNT(*) FROM id_badge_verification_messages` (should be 12)
5. Verify admin_config entries: `SELECT key, value FROM admin_config WHERE key LIKE 'id_badge%'`

### Time Breakdown: **~2.5 hours**

---

## TASK BADGE-009: ID Badge Upload Flow (Mobile Screen)

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** BADGE-008 (ID Badge Schema)

### Description
Create mobile screen for users to upload ID screenshot. Show disclaimer about not storing images (fetched from configurable messages). Allow users to pick image from camera or gallery. Validate image size/quality before upload. Display "Pending Approval" status after submission. Prevent duplicate submissions (in-flight protection). Handle errors gracefully.

---

### AI Prompt for Cursor (Generate ID Badge Upload Screen)

```typescript
/*
TASK: Create ID badge upload screen for mobile app

CONTEXT:
Users upload ID screenshot for manual verification by admin.
System shows disclaimer about image deletion.
After submission, show "Pending Approval" status.
Prevent multiple simultaneous submissions.
Completely independent from auto-badge system.

REQUIREMENTS:
1. Disclaimer text (fetch from configurable messages)
2. Image picker (camera or gallery)
3. Image validation (size, dimensions)
4. Upload to Supabase Storage
5. Create submission record in db
6. Show "Pending Approval" badge after submission
7. Prevent duplicate submissions (in-flight)
8. Handle errors gracefully

==================================================
FILE 1: ID Badge Upload Screen Component
==================================================
*/

// filepath: p2p-kids-marketplace/src/screens/profile/IDVerificationUploadScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/hooks/useAuth';
import { idBadgeService } from '@/services/idBadge';

interface UploadState {
  selectedImage: string | null;
  uploading: boolean;
  error: string | null;
  submitted: boolean;
  pendingRequestId: string | null;
}

export function IDVerificationUploadScreen({ navigation }: any) {
  const { user } = useAuth();
  const [state, setState] = useState<UploadState>({
    selectedImage: null,
    uploading: false,
    error: null,
    submitted: false,
    pendingRequestId: null,
  });
  const [disclaimerText, setDisclaimerText] = useState('');
  const [hasActivePending, setHasActivePending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDisclaimerAndCheckStatus();
  }, [user?.id]);

  const loadDisclaimerAndCheckStatus = async () => {
    setLoading(true);
    try {
      // Fetch configurable disclaimer message
      const disclaimer = await idBadgeService.getMessage('upload_disclaimer');
      setDisclaimerText(disclaimer);

      // Check if user has pending request
      const pending = await idBadgeService.checkPendingRequest(user!.id);
      setHasActivePending(pending !== null);
    } catch (error) {
      console.error('Error loading disclaimer:', error);
      setDisclaimerText('We will not store your ID image. It will be deleted after verification.');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setState((prev) => ({
          ...prev,
          selectedImage: result.assets[0].uri,
          error: null,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to pick image',
      }));
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setState((prev) => ({
          ...prev,
          selectedImage: result.assets[0].uri,
          error: null,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to take photo',
      }));
    }
  };

  const handleSubmit = async () => {
    if (!state.selectedImage) {
      setState((prev) => ({
        ...prev,
        error: 'Please select an image',
      }));
      return;
    }

    if (hasActivePending) {
      Alert.alert(
        'Pending Request',
        'You already have a pending verification request. Please wait for the admin to review it.'
      );
      return;
    }

    setState((prev) => ({ ...prev, uploading: true, error: null }));

    try {
      const requestId = await idBadgeService.submitVerificationRequest(
        user!.id,
        state.selectedImage
      );

      setState((prev) => ({
        ...prev,
        uploading: false,
        submitted: true,
        pendingRequestId: requestId,
      }));

      // Show success message then navigate back
      Alert.alert(
        'Submitted Successfully',
        'Your verification request has been submitted. We will review it within 24 hours.'
      );

      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        uploading: false,
        error: error instanceof Error ? error.message : 'Upload failed. Please try again.',
      }));
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (hasActivePending && !state.submitted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Verification Pending</Text>
        <Text style={styles.message}>
          You already have a pending verification request. We will review it within 24 hours and notify you of the decision.
        </Text>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Back to Profile</Text>
        </Pressable>
      </View>
    );
  }

  if (state.submitted) {
    return (
      <View style={styles.container}>
        <Text style={styles.successTitle}>✓ Submitted Successfully</Text>
        <Text style={styles.successMessage}>
          Your verification request has been submitted. We will review it within 24 hours and notify you of the decision via email and push notification.
        </Text>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Back to Profile</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Verify Your Identity</Text>

      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerTitle}>Your Privacy is Important</Text>
        <Text style={styles.disclaimerText}>{disclaimerText}</Text>
      </View>

      {state.selectedImage ? (
        <View style={styles.imagePreview}>
          <Image source={{ uri: state.selectedImage }} style={styles.image} />
          <Pressable
            style={styles.changeButton}
            onPress={() =>
              setState((prev) => ({ ...prev, selectedImage: null }))
            }
          >
            <Text style={styles.changeButtonText}>Change Image</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.imagePickerButtons}>
          <Pressable style={styles.button} onPress={takePhoto}>
            <Text style={styles.buttonText}>Take Photo</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.secondaryButton]} onPress={pickImage}>
            <Text style={styles.secondaryButtonText}>Choose from Gallery</Text>
          </Pressable>
        </View>
      )}

      {state.error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      )}

      <Pressable
        style={[styles.submitButton, !state.selectedImage && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={!state.selectedImage || state.uploading}
      >
        {state.uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit for Verification</Text>
        )}
      </Pressable>

      <Text style={styles.helpText}>
        Tips: Make sure your ID is clearly visible, well-lit, and the photo is in focus.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  disclaimerBox: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    padding: 12,
    marginBottom: 20,
    borderRadius: 4,
  },
  disclaimerTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  imagePreview: {
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 12,
  },
  changeButton: {
    paddingVertical: 8,
  },
  changeButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  imagePickerButtons: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  secondaryButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 12,
    marginBottom: 16,
    borderRadius: 4,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#10B981',
  },
  successMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
});

/*
==================================================
FILE 2: ID Badge Service
==================================================
*/

// filepath: p2p-kids-marketplace/src/services/idBadge.ts

import { createClient } from '@/lib/supabase';

export const idBadgeService = {
  async getMessage(key: string): Promise<string> {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('id_badge_verification_messages')
        .select('message_text')
        .eq('message_key', key)
        .single();

      if (error) throw error;
      return data?.message_text || '';
    } catch (error) {
      console.error('Error fetching message:', error);
      return '';
    }
  },

  async checkPendingRequest(userId: string) {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('id_badge_verification_requests')
        .select('id, status')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .single();

      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error checking pending request:', error);
      return null;
    }
  },

  async submitVerificationRequest(userId: string, imageUri: string): Promise<string> {
    const supabase = createClient();

    try {
      // Get user profile for denormalization
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, phone_number, node_id')
        .eq('user_id', userId)
        .single();

      if (profileError) throw profileError;

      // Upload to Supabase Storage
      const fileName = `${userId}-${Date.now()}.jpg`;
      const storagePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('id-badge-verification-screenshots')
        .upload(storagePath, {
          uri: imageUri,
          name: fileName,
          type: 'image/jpeg',
        } as any);

      if (uploadError) throw uploadError;

      // Create submission record in database
      const { data, error: insertError } = await supabase
        .from('id_badge_verification_requests')
        .insert({
          user_id: userId,
          status: 'pending',
          screenshot_path: storagePath,
          screenshot_upload_timestamp: new Date().toISOString(),
          first_name: profile?.first_name,
          last_name: profile?.last_name,
          email: profile?.email,
          phone_number: profile?.phone_number,
          node_id: profile?.node_id,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // TODO: Trigger submission notification (in-app + email)
      // TODO: Log analytics event
      // TODO: Send admin notification

      return data.id;
    } catch (error) {
      console.error('Error submitting verification request:', error);
      throw error;
    }
  },

  async getVerificationStatus(userId: string) {
    const supabase = createClient();

    try {
      // Check for pending request first
      const { data: pending } = await supabase
        .from('id_badge_verification_requests')
        .select('status, submitted_at, reviewed_at, rejection_reason, rejection_notes')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(1);

      if (pending && pending.length > 0) {
        return {
          status: 'pending',
          submittedAt: pending[0].submitted_at,
        };
      }

      // Check for approved/rejected
      const { data: decided } = await supabase
        .from('id_badge_verification_requests')
        .select('status, submitted_at, reviewed_at, rejection_reason, rejection_notes')
        .eq('user_id', userId)
        .in('status', ['approved', 'rejected'])
        .order('reviewed_at', { ascending: false })
        .limit(1);

      if (decided && decided.length > 0) {
        return {
          status: decided[0].status,
          submittedAt: decided[0].submitted_at,
          reviewedAt: decided[0].reviewed_at,
          rejectionReason: decided[0].rejection_reason,
          rejectionNotes: decided[0].rejection_notes,
        };
      }

      return { status: 'none' };
    } catch (error) {
      console.error('Error fetching verification status:', error);
      return { status: 'none' };
    }
  },
};

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ IDVerificationUploadScreen component created
✓ Disclaimer text loaded from configurable messages
✓ Image picker (camera + gallery) working
✓ Image validation (size/quality) before upload
✓ Upload to Supabase Storage with user_id folder structure
✓ Create id_badge_verification_requests record with user info
✓ Show "Pending Approval" message after submission
✓ Prevent duplicate submissions (check for pending request)
✓ Error handling with user-friendly messages
✓ Loading states during upload
✓ idBadgeService methods for database operations

==================================================
NEXT TASK
==================================================

BADGE-010: Admin ID Badge Queue & Review Page
*/
```

### Output Files
1. **p2p-kids-marketplace/src/screens/profile/IDVerificationUploadScreen.tsx** - Mobile upload screen
2. **p2p-kids-marketplace/src/services/idBadge.ts** - ID badge service

### Testing Steps
1. Navigate to IDVerificationUploadScreen
2. Verify disclaimer text loads
3. Pick image from gallery or take photo
4. Submit for verification
5. Verify record created in `id_badge_verification_requests`
6. Verify screenshot uploaded to Supabase Storage
7. Test duplicate submission prevention (should show pending message)
8. Test error scenarios (network, upload failure)

### Time Breakdown: **~3 hours**

---

## TASK BADGE-010: Admin ID Badge Queue & Review Page

**Duration:** 3.5 hours  
**Priority:** Critical  
**Dependencies:** BADGE-008 (ID Badge Schema)

### Description
Create admin page at `/admin/ID-badges/` with filterable queue of ID badge verification requests. Show table with user info (first/last name, email, phone, node_id, submission date, status). Implement filters for Pending/Approved/Rejected. Show stats section (pending count, approval rate, avg review time). Admin can download screenshot, review, approve with optional notes, or reject with dropdown reason + free-text notes. Auto-delete screenshot immediately after decision.

---

### AI Prompt for Cursor (Generate Admin ID Badge Page)

```typescript
/*
TASK: Create admin ID badge verification queue and review page

CONTEXT:
Admin reviews pending ID badge verification requests.
Admin can approve/reject with reason and notes.
Screenshots auto-deleted after decision.
History shows metadata (no screenshot).
Predefined rejection reasons for consistency.

REQUIREMENTS:
1. Table view of requests (user info, submission date, status)
2. Filters: Pending, Approved, Rejected
3. Search by user name/email
4. Stats: pending count, avg review time, approval rate
5. Download screenshot for review
6. Approve/reject modal with reason + notes
7. Auto-delete screenshot after decision
8. Rejection reason dropdown with 6 options
9. Optional free-text notes field
10. All decisions logged in admin_activity_log

==================================================
FILE 1: Admin ID Badge Queue Page
==================================================
*/

// filepath: p2p-kids-admin/src/app/ID-badges/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface IDVerificationRequest {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  node_id: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason?: string;
  rejection_notes?: string;
  approval_notes?: string;
}

interface Stats {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  avg_review_time_hours: number;
  approval_rate: number;
}

export default function IDBadgeQueuePage() {
  const [requests, setRequests] = useState<IDVerificationRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadRequests();
    loadStats();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/id-badges?${params}`);
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/id-badges/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeout) clearTimeout(searchTimeout);
    
    const timeout = setTimeout(() => {
      loadRequests();
    }, 300);
    setSearchTimeout(timeout);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' +
           new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ID Badge Verification</h1>

      {/* Stats Section */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="text-sm text-gray-600">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending_count}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <p className="text-sm text-gray-600">Approved</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved_count}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-sm text-gray-600">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected_count}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-gray-600">Avg Review Time</p>
            <p className="text-2xl font-bold text-blue-600">{stats.avg_review_time_hours.toFixed(1)}h</p>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 px-4 py-2 border rounded"
        />
      </div>

      <div className="mb-4 flex gap-2">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded font-medium ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Node</th>
              <th className="px-4 py-3 text-left">Submitted</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-center">
                  Loading...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-center text-gray-500">
                  No requests found
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {req.first_name} {req.last_name}
                  </td>
                  <td className="px-4 py-3">{req.email}</td>
                  <td className="px-4 py-3">{req.phone_number || '-'}</td>
                  <td className="px-4 py-3">{req.node_id || '-'}</td>
                  <td className="px-4 py-3">{formatDate(req.submitted_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        req.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : req.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {req.status === 'pending' ? (
                      <Link
                        href={`/ID-badges/${req.id}/review`}
                        className="text-blue-600 hover:underline"
                      >
                        Review
                      </Link>
                    ) : (
                      <Link
                        href={`/ID-badges/${req.id}/details`}
                        className="text-gray-600 hover:underline"
                      >
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/*
==================================================
FILE 2: ID Badge Review Modal/Page
==================================================
*/

// filepath: p2p-kids-admin/src/app/ID-badges/[requestId]/review/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const REJECTION_REASONS = [
  { value: 'unclear_photo', label: 'Unclear photo' },
  { value: 'id_expired', label: 'ID expired' },
  { value: 'name_mismatch', label: 'Name does not match profile' },
  { value: 'multiple_ids', label: 'Multiple IDs in photo' },
  { value: 'not_government_id', label: 'Not a government-issued ID' },
  { value: 'other', label: 'Other (please explain in notes)' },
];

export default function IDVerificationReviewPage({
  params,
}: {
  params: { requestId: string };
}) {
  const router = useRouter();
  const [request, setRequest] = useState<any>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadRequest();
  }, [params.requestId]);

  const loadRequest = async () => {
    try {
      const response = await fetch(`/api/admin/id-badges/${params.requestId}`);
      const data = await response.json();
      setRequest(data);

      // Get screenshot URL if available
      if (data.screenshot_path) {
        const urlResponse = await fetch(
          `/api/admin/id-badges/${params.requestId}/screenshot-url`
        );
        const { url } = await urlResponse.json();
        setScreenshotUrl(url);
      }
    } catch (error) {
      console.error('Error loading request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDecision = async () => {
    if (!decision) {
      alert('Please select approve or reject');
      return;
    }

    if (decision === 'reject' && !rejectionReason) {
      alert('Please select a rejection reason');
      return;
    }

    setDeciding(true);

    try {
      const response = await fetch(`/api/admin/id-badges/${params.requestId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          rejection_reason: decision === 'reject' ? rejectionReason : null,
          rejection_notes: decision === 'reject' ? notes : null,
          approval_notes: decision === 'approve' ? notes : null,
        }),
      });

      if (response.ok) {
        alert(`Request ${decision === 'approve' ? 'approved' : 'rejected'} successfully`);
        router.push('/ID-badges');
      } else {
        alert('Failed to submit decision. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting decision:', error);
      alert('Error submitting decision');
    } finally {
      setDeciding(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!request) {
    return <div className="p-6">Request not found</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Review ID Badge Request</h1>

      {/* User Info */}
      <div className="bg-gray-50 p-4 rounded mb-6">
        <h2 className="text-lg font-bold mb-4">User Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Name</p>
            <p className="font-medium">
              {request.first_name} {request.last_name}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-medium">{request.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Phone</p>
            <p className="font-medium">{request.phone_number || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Node</p>
            <p className="font-medium">{request.node_id || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Submitted</p>
            <p className="font-medium">
              {new Date(request.submitted_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Screenshot Preview */}
      {screenshotUrl && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-4">Submitted Screenshot</h2>
          <div className="relative w-full h-96 bg-gray-100 rounded overflow-hidden">
            <Image
              src={screenshotUrl}
              alt="ID Verification"
              fill
              style={{ objectFit: 'contain' }}
            />
          </div>
          <a
            href={screenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline mt-2 inline-block"
          >
            Download Full Size
          </a>
        </div>
      )}

      {/* Decision Form */}
      <div className="bg-white border rounded p-6">
        <h2 className="text-lg font-bold mb-4">Make a Decision</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Decision</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="decision"
                value="approve"
                onChange={(e) => setDecision(e.target.value as any)}
                className="mr-2"
              />
              <span>Approve</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="decision"
                value="reject"
                onChange={(e) => setDecision(e.target.value as any)}
                className="mr-2"
              />
              <span>Reject</span>
            </label>
          </div>
        </div>

        {decision === 'reject' && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Rejection Reason</label>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">Select a reason</option>
              {REJECTION_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              decision === 'reject'
                ? 'Optional: Provide additional context for rejection'
                : 'Optional: Notes about approval'
            }
            className="w-full px-3 py-2 border rounded h-24"
          />
        </div>

        <button
          onClick={handleSubmitDecision}
          disabled={!decision || deciding}
          className={`px-6 py-2 rounded font-medium text-white ${
            !decision || deciding
              ? 'bg-gray-400 cursor-not-allowed'
              : decision === 'approve'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {deciding ? 'Submitting...' : `${decision ? decision.charAt(0).toUpperCase() + decision.slice(1) : 'Make Decision'}`}
        </button>
      </div>
    </div>
  );
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Admin queue page shows all requests with filters
✓ Table displays: name, email, phone, node, submission date, status
✓ Filter by Pending/Approved/Rejected working
✓ Search by name/email working
✓ Stats section shows counts and avg review time
✓ Review page allows approve/reject decision
✓ Rejection reason dropdown with 6 predefined options
✓ Optional notes field for additional context
✓ Screenshot viewable and downloadable (only for pending)
✓ Screenshot auto-deleted after decision
✓ Admin decision persisted to database
✓ Notifications sent on approve/reject (BADGE-011)
✓ Admin activity logged

==================================================
NEXT TASK
==================================================

BADGE-011: ID Badge Submission & Decision Notifications
*/
```

### Output Files
1. **p2p-kids-admin/src/app/ID-badges/page.tsx** - Main queue page
2. **p2p-kids-admin/src/app/ID-badges/[requestId]/review/page.tsx** - Review/decision page

### Testing Steps
1. Navigate to `/admin/ID-badges/`
2. Verify stats load correctly
3. Filter by status (Pending/Approved/Rejected)
4. Search by user name/email
5. Click "Review" on a pending request
6. View screenshot
7. Submit approve/reject decision with reason
8. Verify record updated in database
9. Verify screenshot deleted from storage

### Time Breakdown: **~3.5 hours**

---

## TASK BADGE-011: ID Badge Submission & Decision Notifications

**Duration:** 2.5 hours  
**Priority:** High  
**Dependencies:** BADGE-008 (ID Badge Schema), BADGE-009 (Upload Flow), BADGE-010 (Admin Queue)

### Description
Implement multi-channel notifications for ID badge verification events. Send web push + in-app + email to user on submission confirmation. Send web push to admin on new submission. Send web push + in-app + email to user on approval/rejection (with decision reason). All messages loaded from configurable `id_badge_verification_messages` table. Respect user notification preferences.

---

### AI Prompt for Cursor (Generate Notifications)

```typescript
/*
TASK: Implement ID badge verification notifications

CONTEXT:
Users receive notifications on submission, approval, rejection.
Admins receive web push on new submissions.
All messages are configurable via admin panel.
Messages support template variables.

REQUIREMENTS:
1. On submission: user gets web push + in-app + email
2. On submission: admin gets web push
3. On approval: user gets web push + in-app + email with verified notification
4. On rejection: user gets web push + in-app + email with reason + notes
5. Messages support template variables
6. Respect user notification preferences
7. All messages from configurable table
8. Auto-delete screenshot after decision

==================================================
FILE 1: Edge Function to handle decisions and send notifications
==================================================
*/

// filepath: supabase/functions/id-badge-decision-notification/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { requestId, decision, rejectionReason, rejectionNotes, approvalNotes } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request details with user and profile info
    const { data: request, error: requestError } = await supabase
      .from('id_badge_verification_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError) throw requestError;

    // Get user for notification preferences and tokens
    const { data: user } = await supabase
      .from('users')
      .select('expo_push_token, email, id')
      .eq('id', request.user_id)
      .single();

    // Get user preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', request.user_id)
      .single();

    // Get notification message templates
    const messageKeys = decision === 'approved'
      ? ['approved_email_subject', 'approved_email_body', 'in_app_approved_notification', 'web_push_approved']
      : ['rejected_email_subject', 'rejected_email_body', 'in_app_rejected_notification', 'web_push_rejected'];

    const { data: messages } = await supabase
      .from('id_badge_verification_messages')
      .select('message_key, message_text')
      .in('message_key', messageKeys);

    const messageMap = messages?.reduce((acc: any, msg) => {
      acc[msg.message_key] = msg.message_text;
      return acc;
    }, {});

    // Replace template variables
    const replacePlaceholders = (text: string): string => {
      return text
        .replace('{first_name}', request.first_name || 'User')
        .replace('{rejection_reason}', rejectionReason ? rejectionReason.replace(/_/g, ' ') : '')
        .replace('{admin_notes}', rejectionNotes || '')
        .replace('{approval_timeframe_hours}', '24');
    };

    // Send notifications
    if (decision === 'approved') {
      // Send in-app notification
      if (prefs?.id_badge_verification_in_app) {
        await supabase.from('notifications').insert({
          user_id: request.user_id,
          category: 'badges',
          title: 'ID Verification Approved! 🎉',
          body: replacePlaceholders(messageMap?.['in_app_approved_notification'] || 'Your ID has been verified.'),
          channels: ['in_app'],
          data: { requestId, badge: 'verified' },
        });
      }

      // Send web push
      if (prefs?.id_badge_verification_push && user?.expo_push_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.expo_push_token,
            title: 'ID Verification Approved',
            body: messageMap?.['web_push_approved'] || 'Your ID has been verified.',
            data: { requestId, badge: 'verified' },
          }),
        });
      }

      // Send email
      if (prefs?.id_badge_verification_email && user?.email) {
        // TODO: Send email via SendGrid/Mailgun
        console.log(`Email to ${user.email}: ${messageMap?.['approved_email_subject']}`);
      }
    } else if (decision === 'rejected') {
      // Send in-app notification
      if (prefs?.id_badge_verification_in_app) {
        await supabase.from('notifications').insert({
          user_id: request.user_id,
          category: 'badges',
          title: 'ID Verification Request',
          body: replacePlaceholders(messageMap?.['in_app_rejected_notification'] || 'Your ID verification was not approved.'),
          channels: ['in_app'],
          data: { requestId, decision: 'rejected', reason: rejectionReason },
        });
      }

      // Send web push
      if (prefs?.id_badge_verification_push && user?.expo_push_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.expo_push_token,
            title: 'ID Verification Request',
            body: messageMap?.['web_push_rejected'] || 'Your ID verification was not approved.',
            data: { requestId, decision: 'rejected', reason: rejectionReason },
          }),
        });
      }

      // Send email
      if (prefs?.id_badge_verification_email && user?.email) {
        // TODO: Send rejection email via SendGrid/Mailgun
        console.log(`Email to ${user.email}: ${messageMap?.['rejected_email_subject']}`);
      }
    }

    // Log admin activity
    const { data: adminUser } = await supabase.auth.admin.getUserById(req.headers.get('x-admin-user-id') || '');
    
    if (adminUser) {
      await supabase.from('admin_activity_log').insert({
        admin_id: adminUser.user.id,
        action_type: `id_badge_${decision}`,
        entity_type: 'id_badge_verification',
        entity_id: requestId,
        details: { rejectionReason, rejectionNotes, approvalNotes },
        notes: `ID badge ${decision} for user ${request.user_id}`,
      });
    }

    // Delete screenshot from storage (immediate deletion)
    if (request.screenshot_path) {
      await supabase.storage
        .from('id-badge-verification-screenshots')
        .remove([request.screenshot_path]);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ On submission: user receives in-app + email notifications
✓ On approval: user receives in-app + web push + email
✓ On rejection: user receives in-app + web push + email with reason
✓ Admin receives web push on new submission
✓ All messages fetched from configurable table
✓ Template variables replaced ({first_name}, {rejection_reason}, {admin_notes})
✓ User notification preferences respected
✓ Screenshot deleted immediately after decision
✓ Admin activity logged for all decisions

==================================================
NEXT TASK
==================================================

BADGE-012: Admin Configurable Messages for ID Badge System
*/
```

### Output Files
1. **supabase/functions/id-badge-decision-notification/index.ts** - Decision notification handler

### Testing Steps
1. Submit ID badge verification request
2. Verify in-app notification shows "Pending" message
3. Verify email sent
4. Admin approves request
5. Verify user receives approval in-app + email + push notification
6. Admin rejects request
7. Verify user receives rejection in-app + email + push with reason
8. Verify screenshot deleted from storage

### Time Breakdown: **~2.5 hours**

---

## TASK BADGE-012: Admin Configurable Messages for ID Badge System

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** BADGE-008 (ID Badge Schema)

### Description
Create admin page at `/admin/ID-badges/messages/` to edit all ID badge verification messages. Display all 12 message templates in editable form. Show message key and description. Support template variables info (e.g., `{first_name}`, `{rejection_reason}`, `{admin_notes}`). Save changes to `id_badge_verification_messages` table. Show visual preview of how messages appear in app/email.

---

### AI Prompt for Cursor (Generate Configurable Messages Page)

```typescript
/*
TASK: Create admin message configuration page for ID badges

CONTEXT:
Admin can customize all user-facing messages in the ID badge verification system.
Messages support template variables for personalization.

REQUIREMENTS:
1. Display all 12 message templates
2. Each message has: key, current text, description
3. Edit form with template variables reference
4. Save changes to database
5. Show preview (mock in-app, email)
6. Validation (no empty critical messages)

FILE: admin/app/ID-badges/messages/page.tsx
*/

'use client';

import React, { useState, useEffect } from 'react';

interface Message {
  id: string;
  message_key: string;
  message_text: string;
  description: string;
  supports_variables: boolean;
}

export default function IDMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const response = await fetch('/api/admin/id-badges/messages');
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (message: Message) => {
    setEditingId(message.id);
    setEditText(message.message_text);
  };

  const handleSave = async (messageId: string) => {
    if (!editText.trim()) {
      alert('Message text cannot be empty');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/admin/id-badges/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_text: editText }),
      });

      if (response.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, message_text: editText } : m
          )
        );
        setEditingId(null);
        alert('Message saved successfully');
      } else {
        alert('Failed to save message');
      }
    } catch (error) {
      console.error('Error saving message:', error);
      alert('Error saving message');
    } finally {
      setSaving(false);
    }
  };

  const templateVariables = [
    { key: '{first_name}', desc: 'User's first name' },
    { key: '{rejection_reason}', desc: 'Reason for rejection (e.g., "unclear photo")' },
    { key: '{admin_notes}', desc: 'Additional notes from admin' },
    { key: '{approval_timeframe_hours}', desc: 'Expected approval time' },
  ];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ID Badge Verification Messages</h1>

      <div className="mb-8 bg-blue-50 border border-blue-200 rounded p-4">
        <p className="font-semibold mb-4">Available Template Variables:</p>
        <div className="grid grid-cols-2 gap-4">
          {templateVariables.map((v) => (
            <div key={v.key} className="bg-white p-2 rounded">
              <code className="bg-blue-100 px-2 py-1 rounded text-sm font-mono">{v.key}</code>
              <p className="text-sm text-gray-600 mt-1">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p>Loading messages...</p>
      ) : (
        <div className="space-y-6">
          {messages.map((message) => (
            <div key={message.id} className="bg-white border rounded p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg font-mono text-gray-600">{message.message_key}</h3>
                  <p className="text-sm text-gray-600">{message.description}</p>
                  {message.supports_variables && (
                    <p className="text-xs text-blue-600 mt-1">Supports template variables</p>
                  )}
                </div>
                {editingId !== message.id && (
                  <button
                    onClick={() => handleEdit(message)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingId === message.id ? (
                <div>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full px-3 py-2 border rounded h-24 mb-4 font-mono text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(message.id)}
                      disabled={saving}
                      className={`px-4 py-2 rounded font-medium text-white ${
                        saving
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="bg-gray-50 p-4 rounded whitespace-pre-wrap text-sm">
                  {message.message_text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Display all 12 message templates
✓ Each message shows key, description, current text
✓ Edit button opens inline editor
✓ Template variables reference displayed
✓ Save changes to database
✓ Validation (prevent empty messages)
✓ Success confirmation on save
✓ Changes immediately reflect in app

==================================================
NEXT TASK
==================================================

BADGE-013: ID Badge Status Display on User Profile
*/
```

### Output Files
1. **p2p-kids-admin/src/app/ID-badges/messages/page.tsx** - Messages configuration page

### Testing Steps
1. Navigate to `/admin/ID-badges/messages/`
2. View all 12 messages with descriptions
3. Click Edit on a message
4. Change text
5. Save changes
6. Verify updated in database
7. Verify changes reflected in user notifications

### Time Breakdown: **~2 hours**

---

## TASK BADGE-013: ID Badge Status Display on User Profile

**Duration:** 2.5 hours  
**Priority:** High  
**Dependencies:** BADGE-008 (ID Badge Schema), BADGE-009 (Upload Flow)

### Description
Update user profile screen to show ID badge verification status. Display "Pending Approval" subtle badge below avatar if request is pending. Show "Upgrade to Verified" CTA if not verified and system enabled. Show verification status section with submission date (if pending), decision date (if decided), rejection reason (if rejected), ability to submit new request or view history.

---

### AI Prompt for Cursor (Generate Profile ID Badge Display)

```typescript
/*
TASK: Display ID badge verification status on user profile

CONTEXT:
Show verification status on profile screen.
Display pending badge if request in progress.
Show upgrade CTA if not verified.

REQUIREMENTS:
1. Avatar section: show "Pending Approval" badge if status=pending
2. ID Badge section below avatar showing:
   - Current status (Verified, Pending, None)
   - Submission date (if pending)
   - Last decision date (if approved/rejected)
   - Action buttons (Submit/Resubmit, View History)
3. "Upgrade to Verified" CTA if not verified
4. Link to IDVerificationUploadScreen

==================================================
FILE: Update UserProfileScreen
==================================================
*/

// filepath: p2p-kids-marketplace/src/screens/profile/UserProfileScreen.tsx (UPDATE)

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { idBadgeService } from '@/services/idBadge';

interface IDVerificationStatus {
  status: 'pending' | 'approved' | 'rejected' | 'none';
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  rejectionNotes?: string;
}

export function UserProfileScreen({ navigation }: any) {
  const { user } = useAuth();
  const [idBadgeStatus, setIdBadgeStatus] = useState<IDVerificationStatus>({
    status: 'none',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadIDBadgeStatus();
    }
  }, [user?.id]);

  const loadIDBadgeStatus = async () => {
    try {
      const status = await idBadgeService.getVerificationStatus(user!.id);
      setIdBadgeStatus(status);
    } catch (error) {
      console.error('Error loading ID badge status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeToVerified = () => {
    navigation.navigate('IDVerificationUpload');
  };

  const handleResubmit = () => {
    navigation.navigate('IDVerificationUpload');
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: user.avatar_url || 'https://via.placeholder.com/100' }}
            style={styles.avatar}
          />

          {/* Pending Approval Badge */}
          {idBadgeStatus.status === 'pending' && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>Pending</Text>
            </View>
          )}

          {/* Verified Badge */}
          {idBadgeStatus.status === 'approved' && (
            <View style={styles.verifiedBadgeContainer}>
              <Text style={styles.verifiedBadgeText}>✓</Text>
            </View>
          )}
        </View>

        <Text style={styles.userName}>
          {user.first_name} {user.last_name}
        </Text>
      </View>

      {/* ID Badge Section */}
      <View style={styles.idBadgeSection}>
        <Text style={styles.sectionTitle}>Identity Verification</Text>

        {loading ? (
          <ActivityIndicator />
        ) : idBadgeStatus.status === 'pending' ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusBold}>⏳ Pending Review</Text>
            <Text style={styles.statusText}>
              Submitted: {new Date(idBadgeStatus.submittedAt!).toLocaleDateString()}
            </Text>
            <Text style={styles.subText}>
              We'll review it within 24 hours and notify you.
            </Text>
          </View>
        ) : idBadgeStatus.status === 'approved' ? (
          <View style={[styles.statusBox, styles.approvedBox]}>
            <Text style={styles.statusBold}>✓ Verified</Text>
            <Text style={styles.statusText}>
              Approved: {new Date(idBadgeStatus.reviewedAt!).toLocaleDateString()}
            </Text>
          </View>
        ) : idBadgeStatus.status === 'rejected' ? (
          <View style={[styles.statusBox, styles.rejectedBox]}>
            <Text style={styles.statusBold}>✗ Request Rejected</Text>
            <Text style={styles.statusText}>
              Reason: {idBadgeStatus.rejectionReason?.replace(/_/g, ' ')}
            </Text>
            {idBadgeStatus.rejectionNotes && (
              <Text style={styles.subText}>
                {idBadgeStatus.rejectionNotes}
              </Text>
            )}
            <Pressable
              style={styles.resubmitButton}
              onPress={handleResubmit}
            >
              <Text style={styles.resubmitButtonText}>Resubmit Verification</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.statusBox}>
            <Text style={styles.statusBold}>Not Verified</Text>
            <Text style={styles.subText}>
              Verify your identity to earn the Verified badge and increase trust with other users.
            </Text>
            <Pressable
              style={styles.upgradeButton}
              onPress={handleUpgradeToVerified}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to Verified</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Rest of profile content goes here */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  pendingBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FCD34D',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#78350F',
  },
  verifiedBadgeContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10B981',
    borderRadius: 50,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  verifiedBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  idBadgeSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  approvedBox: {
    borderLeftColor: '#10B981',
  },
  rejectedBox: {
    borderLeftColor: '#EF4444',
  },
  statusBold: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 4,
  },
  subText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  upgradeButton: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  resubmitButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 12,
    alignItems: 'center',
  },
  resubmitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Avatar section shows avatar image
✓ "Pending Approval" subtle badge shown if status=pending
✓ "Verified" badge shown if status=approved
✓ ID Badge section below avatar with status and details
✓ Submission date shown if pending
✓ Decision date shown if approved/rejected
✓ Rejection reason shown if rejected
✓ "Upgrade to Verified" CTA if not verified
✓ "Resubmit Verification" button if rejected
✓ Navigation to IDVerificationUploadScreen on CTA click
✓ Status updates on screen refresh

==================================================
MODULE 10 PART 2 COMPLETE
==================================================

All ID Badge Verification features implemented.
Ready for testing and deployment.
*/
```

### Output Files
1. **p2p-kids-marketplace/src/screens/profile/UserProfileScreen.tsx** (updated) - Profile with ID badge display

### Testing Steps
1. Create user and navigate to profile
2. Verify no verification section if system disabled
3. Submit ID verification request
4. Check profile shows "Pending Approval" badge
5. Navigate to admin queue
6. Approve the request
7. Check user profile shows "Verified" status
8. Test rejection flow with reason
9. Test "Resubmit" button after rejection
10. Test "Upgrade to Verified" CTA for new users

### Time Breakdown: **~2.5 hours**

---

## MODULE 10 PART 2 SUMMARY

**Module:** ID Badge Manual Verification System  
**Total Tasks:** 6 (BADGE-008 to BADGE-013)  
**Estimated Time:** ~17 hours  
**Status:** Completely Standalone - No Dependencies on Auto-Badge System

### Task Breakdown

| Task | Description | Duration | Type |
|------|-------------|----------|------|
| BADGE-008 | ID Badge Verification Schema | 2.5h | Database |
| BADGE-009 | ID Badge Upload Flow (Mobile) | 3h | Mobile Screen |
| BADGE-010 | Admin ID Badge Queue & Review | 3.5h | Admin Dashboard |
| BADGE-011 | ID Badge Notifications | 2.5h | Edge Function |
| BADGE-012 | Admin Configurable Messages | 2h | Admin Dashboard |
| BADGE-013 | ID Badge Profile Display | 2.5h | Mobile Screen |

### Key Features
- ✅ User ID screenshot submission with privacy disclaimer
- ✅ Admin review queue with filterable requests
- ✅ 6 predefined rejection reasons + free-text notes
- ✅ Multi-channel notifications (push + in-app + email)
- ✅ Configurable messages with template variables
- ✅ Immediate screenshot deletion after decision
- ✅ Standalone test data (no dependency on auto-badges)

### Database Tables
1. `id_badge_verification_requests` - Submission tracking
2. `id_badge_verification_messages` - Configurable templates

### Admin Pages
- `/admin/ID-badges/` - Queue with filters
- `/admin/ID-badges/[requestId]/review/` - Review page
- `/admin/ID-badges/messages/` - Message configuration

### Mobile Screens
- `IDVerificationUploadScreen` - User upload flow
- `UserProfileScreen` - ID badge status display

### No Post-MVP Defer Required
All 6 tasks are essential for MVP. No deferred features.

---

**Ready for Implementation!** Each task is completely independent and can be executed by an AI agent.
