---

## Prompt Addendum: Session Hardening + Duplicate Identity Handling

### AI Prompt for Cursor (Auth Hardening)
```typescript
/*
TASK: Strengthen session handling and identity checks

REQUIREMENTS:
1. Device-level session revoke: maintain `auth_sessions` (user_id, device_id, created_at, last_seen); UI to revoke device session.
2. Duplicate email/phone detection: sign-up checks existing identities (case-insensitive email, E.164 phone); block with clear error.
3. RLS preflight: on protected writes ensure `auth.uid()`; return standardized auth error.
4. Session TTL and refresh: enforce max age and rotating refresh tokens.

FILES:
- src/services/auth/sessions.ts (CRUD for device sessions)
- src/screens/settings/SessionsScreen.tsx (list + revoke)
*/
```

### Acceptance Criteria
- Device sessions listed and revocable per device
- Duplicate email/phone blocked with friendly errors
- RLS preflight guards active on protected writes
- Session TTL enforced; refresh stable

# Module 02: Authentication & User Management

**Duration:** 3 weeks (Weeks 6-8)  
**Dependencies:** Module 01 (Infrastructure complete)

---

### Agent-Optimized Prompt Template (Claude Sonnet 4.5)

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

## Overview
This module implements the complete authentication and user management system, including:
- Email/password signup and login via Supabase Auth
- Phone number verification via AWS SNS
- SMS rate limiting for security
- User profile creation and editing
- Onboarding flow for new users
- Referral system with bonus tracking
- Password reset and account recovery
- Age verification (deferred to Post-MVP)

---

## TASK AUTH-001: Implement Supabase Auth Signup Flow

**Duration:** 4 hours  
**Priority:** Critical  
**Dependencies:** INFRA-002 (Supabase client configured)

### Description
Implement email + password signup flow using Supabase Auth. Create signup screen with form validation, error handling, and automatic user profile creation in the database.

---

### AI Prompt for Cursor (Generate Signup Flow)

```typescript
/*
TASK: Implement email/password signup flow with Supabase Auth

CONTEXT:
User signs up with email, password, name, and phone number. After successful Supabase Auth signup,
create a user profile in the database with default values.

REQUIREMENTS:
1. Create signup screen with form validation
2. Implement Supabase Auth signup
3. Create user profile in database
4. Handle errors gracefully
5. Navigate to phone verification screen after signup

==================================================
FILE 1: src/screens/auth/SignupScreen.tsx
==================================================
*/

// filepath: src/screens/auth/SignupScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { signUp } from '@/services/supabase/auth';
import { trackEvent } from '@/services/analytics';
import { AUTH_EVENTS } from '@/constants/analytics-events';
import * as Sentry from '@sentry/react-native';

export default function SignupScreen() {
  const navigation = useNavigation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Validation functions
  const validateName = (name: string): string | null => {
    if (!name || name.trim().length < 2) {
      return 'Name must be at least 2 characters';
    }
    if (name.length > 100) {
      return 'Name must be less than 100 characters';
    }
    return null;
  };

  const validateEmail = (email: string): string | null => {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  const validatePhone = (phone: string): string | null => {
    // Accept formats: +1234567890 or 1234567890
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!phone || !phoneRegex.test(phone)) {
      return 'Please enter a valid phone number (10+ digits)';
    }
    return null;
  };

  const validatePassword = (password: string): string | null => {
    if (!password || password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const validateConfirmPassword = (password: string, confirmPassword: string): string | null => {
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const nameError = validateName(formData.name);
    if (nameError) newErrors.name = nameError;

    const emailError = validateEmail(formData.email);
    if (emailError) newErrors.email = emailError;

    const phoneError = validatePhone(formData.phone);
    if (phoneError) newErrors.phone = phoneError;

    const passwordError = validatePassword(formData.password);
    if (passwordError) newErrors.password = passwordError;

    const confirmPasswordError = validateConfirmPassword(formData.password, formData.confirmPassword);
    if (confirmPasswordError) newErrors.confirmPassword = confirmPasswordError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    // Track signup started
    trackEvent(AUTH_EVENTS.SIGNUP_STARTED, {
      method: 'email',
      timestamp: new Date().toISOString(),
    });

    // Validate form
    if (!validateForm()) {
      trackEvent(AUTH_EVENTS.SIGNUP_FAILED, {
        reason: 'validation_error',
        errors: Object.keys(errors),
      });
      return;
    }

    setLoading(true);

    try {
      // Call Supabase Auth signup
      const { user, error } = await signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
      });

      if (error) {
        throw error;
      }

      if (!user) {
        throw new Error('Signup succeeded but no user returned');
      }

      // Track successful signup
      trackEvent(AUTH_EVENTS.SIGNUP_COMPLETED, {
        user_id: user.id,
        method: 'email',
        timestamp: new Date().toISOString(),
      });

      // Navigate to phone verification screen
      navigation.navigate('PhoneVerification' as never, {
        userId: user.id,
        phone: formData.phone,
      } as never);

    } catch (error: any) {
      console.error('Signup error:', error);

      // Capture error in Sentry
      Sentry.captureException(error, {
        contexts: {
          signup: {
            email: formData.email,
            name: formData.name,
          },
        },
      });

      // Track failed signup
      trackEvent(AUTH_EVENTS.SIGNUP_FAILED, {
        reason: error.message || 'unknown_error',
        error_code: error.code,
      });

      // Show user-friendly error message
      let errorMessage = 'Signup failed. Please try again.';
      
      if (error.message?.includes('already registered')) {
        errorMessage = 'This email is already registered. Please log in instead.';
      } else if (error.message?.includes('weak password')) {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      Alert.alert('Signup Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginTop: 40 }}>
          {/* Header */}
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>
            Create Account
          </Text>
          <Text style={{ fontSize: 16, color: '#666', marginBottom: 32 }}>
            Join the P2P Kids Marketplace community
          </Text>

          {/* Name Input */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
              Full Name *
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: errors.name ? '#ef4444' : '#d1d5db',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
              }}
              placeholder="John Doe"
              value={formData.name}
              onChangeText={(text) => {
                setFormData({ ...formData, name: text });
                if (errors.name) {
                  setErrors({ ...errors, name: '' });
                }
              }}
              autoCapitalize="words"
              editable={!loading}
            />
            {errors.name && (
              <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                {errors.name}
              </Text>
            )}
          </View>

          {/* Email Input */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
              Email Address *
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: errors.email ? '#ef4444' : '#d1d5db',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
              }}
              placeholder="john@example.com"
              value={formData.email}
              onChangeText={(text) => {
                setFormData({ ...formData, email: text });
                if (errors.email) {
                  setErrors({ ...errors, email: '' });
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {errors.email && (
              <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                {errors.email}
              </Text>
            )}
          </View>

          {/* Phone Input */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
              Phone Number *
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: errors.phone ? '#ef4444' : '#d1d5db',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
              }}
              placeholder="+1234567890"
              value={formData.phone}
              onChangeText={(text) => {
                setFormData({ ...formData, phone: text });
                if (errors.phone) {
                  setErrors({ ...errors, phone: '' });
                }
              }}
              keyboardType="phone-pad"
              editable={!loading}
            />
            {errors.phone && (
              <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                {errors.phone}
              </Text>
            )}
            <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
              We'll send a verification code to this number
            </Text>
          </View>

          {/* Password Input */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
              Password *
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: errors.password ? '#ef4444' : '#d1d5db',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
              }}
              placeholder="Minimum 8 characters"
              value={formData.password}
              onChangeText={(text) => {
                setFormData({ ...formData, password: text });
                if (errors.password) {
                  setErrors({ ...errors, password: '' });
                }
              }}
              secureTextEntry
              editable={!loading}
            />
            {errors.password && (
              <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                {errors.password}
              </Text>
            )}
          </View>

          {/* Confirm Password Input */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
              Confirm Password *
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: errors.confirmPassword ? '#ef4444' : '#d1d5db',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
              }}
              placeholder="Re-enter password"
              value={formData.confirmPassword}
              onChangeText={(text) => {
                setFormData({ ...formData, confirmPassword: text });
                if (errors.confirmPassword) {
                  setErrors({ ...errors, confirmPassword: '' });
                }
              }}
              secureTextEntry
              editable={!loading}
            />
            {errors.confirmPassword && (
              <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                {errors.confirmPassword}
              </Text>
            )}
          </View>

          {/* Signup Button */}
          <TouchableOpacity
            style={{
              backgroundColor: loading ? '#9ca3af' : '#3b82f6',
              borderRadius: 8,
              padding: 16,
              alignItems: 'center',
              marginBottom: 16,
            }}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                Create Account
              </Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Text style={{ color: '#666', fontSize: 14 }}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login' as never)}
              disabled={loading}
            >
              <Text style={{ color: '#3b82f6', fontSize: 14, fontWeight: '600' }}>
                Log In
              </Text>
            </TouchableOpacity>
          </View>

          {/* Terms and Privacy */}
          <Text style={{ color: '#999', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
            By creating an account, you agree to our{'\n'}
            <Text style={{ textDecorationLine: 'underline' }}>Terms of Service</Text>
            {' and '}
            <Text style={{ textDecorationLine: 'underline' }}>Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/*
==================================================
FILE 2: Update src/services/supabase/auth.ts
==================================================
Ensure signUp function creates user profile in database
*/

// This was already created in INFRA-002, but verify it creates user profile:
// The signUp function should:
// 1. Call supabase.auth.signUp() with email and password
// 2. Pass name and phone in options.data
// 3. Create user record in database with INSERT
// 4. Handle errors gracefully

/*
==================================================
FILE 3: src/constants/analytics-events.ts
==================================================
*/

// filepath: src/constants/analytics-events.ts
export const AUTH_EVENTS = {
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  SIGNUP_FAILED: 'signup_failed',
  LOGIN_STARTED: 'login_started',
  LOGIN_COMPLETED: 'login_completed',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
};

/*
==================================================
VERIFICATION STEPS
==================================================

1. Run the app: expo start
2. Navigate to Signup screen
3. Try invalid inputs (should show validation errors):
   - Short name (< 2 chars)
   - Invalid email
   - Invalid phone
   - Weak password
   - Mismatched passwords
4. Try valid signup:
   - Should create Supabase Auth user
   - Should create user profile in database
   - Should navigate to Phone Verification screen
5. Check Supabase dashboard:
   - Authentication → Users (should see new user)
   - Database → users table (should see user record)
6. Try signing up with same email (should fail with error)
7. Check Amplitude dashboard (should see signup_started, signup_completed events)
8. Check Sentry dashboard (errors should be captured if any occur)

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Signup screen renders correctly
✓ Form validation works for all fields
✓ Error messages display for invalid inputs
✓ Loading state shows during signup
✓ Supabase Auth user created successfully
✓ User profile created in database
✓ Navigation to phone verification after signup
✓ Duplicate email rejected with friendly error
✓ Analytics events tracked (signup_started, signup_completed)
✓ Errors captured in Sentry
✓ Login link navigates to login screen
✓ Terms and Privacy links displayed

==================================================
TROUBLESHOOTING
==================================================

Error: "User already registered"
- Solution: Email already exists, use different email or go to login

Error: "Failed to create user profile"
- Solution: Check RLS policies on users table allow INSERT for authenticated users

Error: "Network request failed"
- Solution: Check .env.local has correct SUPABASE_URL and SUPABASE_ANON_KEY

Error: "Password too weak"
- Solution: Ensure password has 8+ chars, uppercase, lowercase, and number

==================================================
NEXT STEPS
==================================================

After successful signup implementation:
1. Proceed to AUTH-002 (Phone verification)
2. User should verify phone before accessing app
3. Store verification status in database
*/
```

---

### Acceptance Criteria

- [ ] Signup screen created with all required fields
- [ ] Form validation implemented (name, email, phone, password)
- [ ] Supabase Auth signup working
- [ ] User profile created in database automatically
- [ ] Error handling for all edge cases
- [ ] Loading states displayed during signup
- [ ] Navigation to phone verification after signup
- [ ] Analytics events tracked (signup_started, signup_completed, signup_failed)
- [ ] Errors captured in Sentry
- [ ] Responsive design for different screen sizes
- [ ] Keyboard dismissal on form submission
- [ ] Terms and Privacy policy links displayed

---

### Output Files

- `src/screens/auth/SignupScreen.tsx`
- `src/constants/analytics-events.ts`
- Updated `src/services/supabase/auth.ts` (signUp function)

---

### Common Issues

| Issue | Solution |
|-------|----------|
| User already registered | Email already exists, use different email or go to login |
| Failed to create user profile | Check RLS policies on users table allow INSERT |
| Network request failed | Verify SUPABASE_URL and SUPABASE_ANON_KEY in .env |
| Password too weak | Ensure 8+ chars, uppercase, lowercase, number |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create signup screen UI | 60 min |
| Implement form validation | 45 min |
| Integrate Supabase Auth signup | 30 min |
| Handle errors and edge cases | 30 min |
| Add analytics tracking | 15 min |
| Test and troubleshoot | 60 min |
| **Total** | **~4 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** AUTH-002 - Implement Phone Verification via AWS SNS

---

## TASK AUTH-002: Implement Phone Verification via AWS SNS

**Duration:** 6 hours  
**Priority:** Critical  
**Dependencies:** AUTH-001 (Signup flow), INFRA-009 (AWS SNS configured)

### Description
Implement phone number verification using AWS SNS to send SMS verification codes. Create phone verification screen, generate 6-digit codes, send via SNS, verify user input, and update database verification status.

---

### AI Prompt for Cursor (Generate Phone Verification Flow)

```typescript
/*
TASK: Implement phone number verification with AWS SNS

CONTEXT:
After signup, user must verify their phone number by receiving a 6-digit SMS code via AWS SNS.
The code is valid for 10 minutes. After 3 failed attempts, user must request a new code.

REQUIREMENTS:
1. Create AWS SNS service for sending SMS
2. Generate 6-digit verification codes
3. Store codes in database with expiration
4. Create phone verification screen
5. Implement code verification logic
6. Update user verification status in database
7. Handle rate limiting (max 10 SMS per hour)

==================================================
FILE 1: Add phone_verification_codes table migration
==================================================
Add this to your database schema or create a new migration:
*/

-- filepath: supabase/migrations/002_phone_verification_codes.sql

CREATE TABLE phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 3),
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_phone_verification_codes_user_id ON phone_verification_codes(user_id);
CREATE INDEX idx_phone_verification_codes_phone ON phone_verification_codes(phone);
CREATE INDEX idx_phone_verification_codes_created_at ON phone_verification_codes(created_at DESC);

-- RLS Policies
ALTER TABLE phone_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own verification codes"
  ON phone_verification_codes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert verification codes"
  ON phone_verification_codes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update verification codes"
  ON phone_verification_codes FOR UPDATE
  USING (true);

-- Add phone verification fields to users table
ALTER TABLE users ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN phone_verified_at TIMESTAMPTZ;

/*
==================================================
FILE 2: src/services/aws/sns.ts
==================================================
*/

// filepath: src/services/aws/sns.ts
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({
  region: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.EXPO_PUBLIC_AWS_SNS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.EXPO_PUBLIC_AWS_SNS_SECRET_ACCESS_KEY || '',
  },
});

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send SMS via AWS SNS
 * @param phone - Phone number in E.164 format (+1234567890)
 * @param message - SMS message content
 */
export const sendSMS = async (phone: string, message: string): Promise<SendSMSResult> => {
  try {
    const command = new PublishCommand({
      PhoneNumber: phone,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional', // Use Transactional for verification codes
        },
      },
    });

    const response = await snsClient.send(command);

    return {
      success: true,
      messageId: response.MessageId,
    };
  } catch (error: any) {
    console.error('AWS SNS error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send SMS',
    };
  }
};

/**
 * Send verification code via SMS
 * @param phone - Phone number in E.164 format
 * @param code - 6-digit verification code
 */
export const sendVerificationCode = async (phone: string, code: string): Promise<SendSMSResult> => {
  const message = `Your P2P Kids Marketplace verification code is: ${code}\n\nThis code expires in 10 minutes.`;
  return sendSMS(phone, message);
};

/*
==================================================
FILE 3: src/services/verification.ts
==================================================
*/

// filepath: src/services/verification.ts
import { supabase } from './supabase';
import { sendVerificationCode } from './aws/sns';
import { trackEvent } from './analytics';

/**
 * Generate a random 6-digit verification code
 */
export const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send verification code to phone number
 * Stores code in database with 10-minute expiration
 * Checks rate limit (max 10 SMS per hour per phone)
 */
export const sendPhoneVerificationCode = async (
  userId: string,
  phone: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check rate limit: max 10 SMS in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count, error: countError } = await supabase
      .from('phone_verification_codes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('phone', phone)
      .gte('created_at', oneHourAgo);

    if (countError) throw countError;

    // Get rate limit from admin config (default: 10)
    const { data: configData } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'sms_rate_limit_per_hour')
      .single();

    const rateLimit = parseInt(configData?.value || '10');

    if (count && count >= rateLimit) {
      trackEvent('phone_verification_rate_limit_hit', {
        user_id: userId,
        phone: phone.slice(-4), // Last 4 digits for privacy
      });
      
      return {
        success: false,
        error: `Too many verification codes sent. Please try again in an hour.`,
      };
    }

    // Generate new verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store code in database
    const { error: insertError } = await supabase
      .from('phone_verification_codes')
      .insert({
        user_id: userId,
        phone: phone,
        code: code,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
      });

    if (insertError) throw insertError;

    // Send SMS via AWS SNS
    const smsResult = await sendVerificationCode(phone, code);

    if (!smsResult.success) {
      // Log failed SMS but don't expose error to user
      console.error('Failed to send SMS:', smsResult.error);
      trackEvent('phone_verification_sms_failed', {
        user_id: userId,
        error: smsResult.error,
      });

      return {
        success: false,
        error: 'Failed to send verification code. Please try again.',
      };
    }

    trackEvent('phone_verification_code_sent', {
      user_id: userId,
      phone: phone.slice(-4),
      message_id: smsResult.messageId,
    });

    return { success: true };

  } catch (error: any) {
    console.error('Send verification code error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send verification code',
    };
  }
};

/**
 * Verify phone verification code
 * Checks code validity, expiration, and attempt count
 * Updates user verification status on success
 */
export const verifyPhoneCode = async (
  userId: string,
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get most recent code for this user/phone
    const { data, error } = await supabase
      .from('phone_verification_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: 'No verification code found. Please request a new code.',
      };
    }

    // Check if code is expired
    if (new Date(data.expires_at) < new Date()) {
      trackEvent('phone_verification_code_expired', {
        user_id: userId,
        phone: phone.slice(-4),
      });

      return {
        success: false,
        error: 'Verification code expired. Please request a new code.',
      };
    }

    // Check attempt count
    if (data.attempts >= 3) {
      trackEvent('phone_verification_max_attempts', {
        user_id: userId,
        phone: phone.slice(-4),
      });

      return {
        success: false,
        error: 'Too many failed attempts. Please request a new code.',
      };
    }

    // Verify code
    if (data.code !== code) {
      // Increment attempt count
      await supabase
        .from('phone_verification_codes')
        .update({ attempts: data.attempts + 1 })
        .eq('id', data.id);

      trackEvent('phone_verification_code_incorrect', {
        user_id: userId,
        phone: phone.slice(-4),
        attempts: data.attempts + 1,
      });

      const attemptsRemaining = 3 - (data.attempts + 1);
      return {
        success: false,
        error: `Incorrect code. ${attemptsRemaining} ${attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining.`,
      };
    }

    // Code is correct - update user verification status
    const { error: updateError } = await supabase
      .from('users')
      .update({
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Mark code as used
    await supabase
      .from('phone_verification_codes')
      .update({ verified: true })
      .eq('id', data.id);

    trackEvent('phone_verification_success', {
      user_id: userId,
      phone: phone.slice(-4),
    });

    return { success: true };

  } catch (error: any) {
    console.error('Verify phone code error:', error);
    return {
      success: false,
      error: error.message || 'Failed to verify code',
    };
  }
};

/*
==================================================
FILE 4: src/screens/auth/PhoneVerificationScreen.tsx
==================================================
*/

// filepath: src/screens/auth/PhoneVerificationScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { sendPhoneVerificationCode, verifyPhoneCode } from '@/services/verification';
import { trackEvent } from '@/services/analytics';
import * as Sentry from '@sentry/react-native';

export default function PhoneVerificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, phone } = route.params as { userId: string; phone: string };

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // Auto-send verification code on mount
  useEffect(() => {
    sendVerificationCode();
  }, []);

  const sendVerificationCode = async () => {
    setResending(true);
    
    const result = await sendPhoneVerificationCode(userId, phone);

    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to send verification code');
      Sentry.captureMessage('Failed to send verification code', {
        level: 'error',
        extra: { userId, phone: phone.slice(-4), error: result.error },
      });
    } else {
      setCountdown(60);
      setCanResend(false);
      Alert.alert('Code Sent', `Verification code sent to ${phone}`);
    }

    setResending(false);
  };

  const handleCodeChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits entered
    if (newCode.every((digit) => digit !== '') && newCode.join('').length === 6) {
      verifyCode(newCode.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (verificationCode: string) => {
    setLoading(true);

    try {
      const result = await verifyPhoneCode(userId, phone, verificationCode);

      if (!result.success) {
        Alert.alert('Verification Failed', result.error || 'Invalid code');
        // Clear code inputs on failure
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert('Success', 'Phone number verified!', [
          {
            text: 'Continue',
            onPress: () => navigation.navigate('Onboarding' as never, { userId } as never),
          },
        ]);
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      Sentry.captureException(error);
      Alert.alert('Error', 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 24 }}>
      <View style={{ marginTop: 60 }}>
        {/* Header */}
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>
          Verify Your Phone
        </Text>
        <Text style={{ fontSize: 16, color: '#666', marginBottom: 40 }}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={{ fontWeight: '600', color: '#333' }}>{phone}</Text>
        </Text>

        {/* Code Input */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 }}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={{
                width: 50,
                height: 60,
                borderWidth: 2,
                borderColor: digit ? '#3b82f6' : '#d1d5db',
                borderRadius: 8,
                textAlign: 'center',
                fontSize: 24,
                fontWeight: '600',
              }}
              value={digit}
              onChangeText={(value) => handleCodeChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              editable={!loading}
            />
          ))}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={{
            backgroundColor: loading ? '#9ca3af' : '#3b82f6',
            borderRadius: 8,
            padding: 16,
            alignItems: 'center',
            marginBottom: 24,
          }}
          onPress={() => verifyCode(code.join(''))}
          disabled={loading || code.some((digit) => digit === '')}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              Verify Code
            </Text>
          )}
        </TouchableOpacity>

        {/* Resend Code */}
        <View style={{ alignItems: 'center' }}>
          {canResend ? (
            <TouchableOpacity
              onPress={sendVerificationCode}
              disabled={resending}
            >
              <Text style={{ color: '#3b82f6', fontSize: 14, fontWeight: '600' }}>
                {resending ? 'Sending...' : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: '#999', fontSize: 14 }}>
              Resend code in {countdown}s
            </Text>
          )}
        </View>

        {/* Change Phone Number */}
        <TouchableOpacity
          style={{ marginTop: 24, alignItems: 'center' }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: '#666', fontSize: 14 }}>
            Wrong number? <Text style={{ color: '#3b82f6', fontWeight: '600' }}>Change it</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/*
==================================================
VERIFICATION STEPS
==================================================

1. Run database migration for phone_verification_codes table:
   - supabase db push (or run migration manually)
2. Configure AWS SNS credentials in .env.local:
   EXPO_PUBLIC_AWS_REGION=us-east-1
   EXPO_PUBLIC_AWS_SNS_ACCESS_KEY_ID=your-key
   EXPO_PUBLIC_AWS_SNS_SECRET_ACCESS_KEY=your-secret
3. Test signup flow → should navigate to phone verification
4. Check phone receives SMS with 6-digit code
5. Enter correct code → should verify and navigate to onboarding
6. Test error cases:
   - Enter wrong code (should show attempts remaining)
   - Enter code 3 times wrong (should require new code)
   - Wait 10 minutes (code should expire)
   - Request new code (should send new SMS)
   - Request codes >10 times in 1 hour (should hit rate limit)
7. Check database:
   - phone_verification_codes table has records
   - users.phone_verified = true after successful verification
8. Check AWS SNS console for sent messages
9. Check Amplitude for verification events

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ AWS SNS service configured and working
✓ 6-digit verification codes generated
✓ SMS sent via AWS SNS successfully
✓ Phone verification screen renders correctly
✓ Code input auto-focuses next field
✓ Code auto-verifies when all 6 digits entered
✓ Verification succeeds with correct code
✓ Error handling for incorrect code (shows attempts remaining)
✓ Max 3 attempts per code
✓ Code expires after 10 minutes
✓ Resend code functionality works
✓ Resend countdown timer (60 seconds)
✓ Rate limiting enforced (max 10 SMS per hour)
✓ User phone_verified status updated in database
✓ Analytics events tracked (code_sent, verification_success, etc.)
✓ Errors captured in Sentry

==================================================
TROUBLESHOOTING
==================================================

Error: "Failed to send SMS"
- Solution: Check AWS SNS credentials in .env
- Solution: Verify AWS SNS has spending limit > $0 (check AWS Billing)

Error: "Phone number not valid"
- Solution: Ensure phone is in E.164 format (+1234567890)

Error: "Too many verification codes sent"
- Solution: Rate limit hit - wait 1 hour or adjust sms_rate_limit_per_hour in admin_config

Error: "Verification code expired"
- Solution: Code is valid for 10 minutes - request new code

==================================================
NEXT STEPS
==================================================

After phone verification:
1. Navigate to onboarding screen
2. User can now access the app
3. Implement AUTH-003 (SMS rate limiting admin config - already handled)
4. Implement AUTH-004 (Age verification - deferred to Post-MVP)
*/
```

---

### Acceptance Criteria

- [ ] AWS SNS service configured
- [ ] Phone verification codes table created in database
- [ ] 6-digit codes generated and stored
- [ ] SMS sent via AWS SNS successfully
- [ ] Phone verification screen created
- [ ] Auto-focus between code input fields
- [ ] Auto-verify when all digits entered
- [ ] Correct code verification works
- [ ] Incorrect code shows attempts remaining
- [ ] Max 3 attempts per code enforced
- [ ] Code expiration after 10 minutes
- [ ] Resend code functionality works
- [ ] Countdown timer before allowing resend
- [ ] Rate limiting enforced (configurable via admin_config)
- [ ] User phone_verified status updated
- [ ] Navigation to onboarding after verification
- [ ] Analytics events tracked
- [ ] Errors captured in Sentry

---

### Output Files

- `supabase/migrations/002_phone_verification_codes.sql`
- `src/services/aws/sns.ts`
- `src/services/verification.ts`
- `src/screens/auth/PhoneVerificationScreen.tsx`
- Update `.env.local` with AWS SNS credentials

---

### Common Issues

| Issue | Solution |
|-------|----------|
| Failed to send SMS | Check AWS SNS credentials in .env |
| Phone number not valid | Ensure phone is in E.164 format (+1234567890) |
| Too many codes sent | Rate limit hit - wait 1 hour or adjust config |
| Code expired | Codes valid for 10 minutes - request new code |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create AWS SNS service | 45 min |
| Create verification code generation logic | 30 min |
| Create database table and migration | 30 min |
| Create phone verification screen UI | 60 min |
| Implement code verification logic | 60 min |
| Add rate limiting | 30 min |
| Add resend functionality | 30 min |
| Test and troubleshoot | 75 min |
| **Total** | **~6 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** AUTH-003 - Implement SMS Rate Limiting (Admin Configurable)


---

## TASK AUTH-003: Implement SMS Rate Limiting (Admin Configurable)

**Duration:** 1.5 hours  
**Priority:** Medium  
**Dependencies:** AUTH-002 (Phone verification), INFRA-003 (Database schema with admin_config table)

### Description
SMS rate limiting is already implemented in AUTH-002 via the `admin_config` table. This task documents how to configure SMS rate limits via the admin panel and provides UI for admins to adjust limits.

---

### AI Prompt for Cursor (Create Admin SMS Rate Limit Config UI)

```typescript
/*
TASK: Create admin UI for configuring SMS rate limits

CONTEXT:
SMS rate limiting is controlled by the 'sms_rate_limit_per_hour' key in admin_config table.
Default is 10 SMS per hour per phone number. Admins should be able to adjust this via the admin panel.

REQUIREMENTS:
1. Create admin config management screen
2. Allow admins to view and edit sms_rate_limit_per_hour
3. Validate input (must be positive integer)
4. Show current rate limit usage stats
5. Log changes to audit trail

==================================================
FILE 1: admin/app/config/page.tsx
==================================================
*/

// filepath: admin/app/config/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface ConfigItem {
  key: string;
  value: string;
  description: string;
}

export default function ConfigPage() {
  const supabase = createClientComponentClient();
  const [config, setConfig] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_config')
        .select('*')
        .in('key', [
          'sms_rate_limit_per_hour',
          'max_login_attempts',
          'password_reset_expiry_minutes',
          'referral_bonus_points',
        ])
        .order('key');

      if (error) throw error;

      setConfig(data || []);
      
      // Initialize edit values
      const values: Record<string, string> = {};
      data?.forEach((item) => {
        values[item.key] = item.value;
      });
      setEditValues(values);
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      const newValue = editValues[key];

      // Validate value
      const numValue = parseInt(newValue);
      if (isNaN(numValue) || numValue <= 0) {
        alert('Value must be a positive integer');
        return;
      }

      // Update database
      const { error } = await supabase
        .from('admin_config')
        .update({ value: newValue })
        .eq('key', key);

      if (error) throw error;

      // Log audit trail
      await supabase.from('audit_logs').insert({
        action: 'UPDATE_CONFIG',
        entity_type: 'admin_config',
        entity_id: key,
        changes: {
          key,
          old_value: config.find((c) => c.key === key)?.value,
          new_value: newValue,
        },
      });

      alert('Configuration updated successfully');
      await loadConfig();
    } catch (error: any) {
      console.error('Failed to save config:', error);
      alert(`Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getConfigDescription = (key: string): string => {
    const descriptions: Record<string, string> = {
      sms_rate_limit_per_hour: 'Maximum SMS verification codes that can be sent to a single phone number per hour. Prevents spam and abuse.',
      max_login_attempts: 'Maximum failed login attempts before account lockout.',
      password_reset_expiry_minutes: 'Time in minutes before password reset link expires.',
      referral_bonus_points: 'Points awarded to both referrer and referee on first completed trade.',
    };
    return descriptions[key] || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Configuration</h1>
        <p className="mt-2 text-gray-600">
          Manage global system settings and limits
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Configuration Settings</h2>
        </div>

        <div className="divide-y divide-gray-200">
          {config.map((item) => (
            <div key={item.key} className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 mr-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {item.key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {getConfigDescription(item.key)}
                  </p>
                  <div className="mt-3 flex items-center space-x-3">
                    <input
                      type="number"
                      value={editValues[item.key] || ''}
                      onChange={(e) =>
                        setEditValues({ ...editValues, [item.key]: e.target.value })
                      }
                      className="border border-gray-300 rounded-md px-3 py-2 w-32"
                      min="1"
                    />
                    <button
                      onClick={() => handleSave(item.key)}
                      disabled={saving || editValues[item.key] === item.value}
                      className={`px-4 py-2 rounded-md font-medium ${
                        saving || editValues[item.key] === item.value
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Current Value</div>
                  <div className="text-2xl font-bold text-gray-900">{item.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SMS Rate Limit Stats */}
      <SMSRateLimitStats />
    </div>
  );
}

function SMSRateLimitStats() {
  const supabase = createClientComponentClient();
  const [stats, setStats] = useState({
    last_hour: 0,
    last_24h: 0,
    rate_limited_users: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // SMS sent in last hour
      const { count: lastHour } = await supabase
        .from('phone_verification_codes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo);

      // SMS sent in last 24 hours
      const { count: last24h } = await supabase
        .from('phone_verification_codes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneDayAgo);

      // Users who hit rate limit in last hour
      const { data: rateLimitedData } = await supabase
        .from('phone_verification_codes')
        .select('user_id')
        .gte('created_at', oneHourAgo);

      // Count users with 10+ SMS in last hour
      const userCounts = rateLimitedData?.reduce((acc: Record<string, number>, item) => {
        acc[item.user_id] = (acc[item.user_id] || 0) + 1;
        return acc;
      }, {});

      const rateLimitedUsers = Object.values(userCounts || {}).filter((count) => count >= 10).length;

      setStats({
        last_hour: lastHour || 0,
        last_24h: last24h || 0,
        rate_limited_users: rateLimitedUsers,
      });
    } catch (error) {
      console.error('Failed to load SMS stats:', error);
    }
  };

  return (
    <div className="mt-8 bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">SMS Rate Limit Statistics</h2>
      </div>

      <div className="grid grid-cols-3 gap-6 px-6 py-4">
        <div>
          <div className="text-sm text-gray-500">SMS Sent (Last Hour)</div>
          <div className="text-3xl font-bold text-gray-900">{stats.last_hour}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">SMS Sent (Last 24 Hours)</div>
          <div className="text-3xl font-bold text-gray-900">{stats.last_24h}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Rate Limited Users</div>
          <div className="text-3xl font-bold text-red-600">{stats.rate_limited_users}</div>
        </div>
      </div>
    </div>
  );
}

/*
==================================================
VERIFICATION STEPS
==================================================

1. Navigate to admin panel: http://localhost:3000/config
2. Verify sms_rate_limit_per_hour displays current value (default 10)
3. Change value to 5
4. Click Save
5. Verify database updated:
   SELECT * FROM admin_config WHERE key = 'sms_rate_limit_per_hour';
6. Verify audit log created:
   SELECT * FROM audit_logs WHERE action = 'UPDATE_CONFIG' ORDER BY created_at DESC LIMIT 1;
7. Test rate limit:
   - Sign up with new account
   - Request verification code 5 times
   - 6th request should fail with rate limit error
8. Check SMS stats section shows accurate counts

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Admin config page created
✓ SMS rate limit displayed and editable
✓ Input validation (must be positive integer)
✓ Save functionality updates database
✓ Audit trail logged for config changes
✓ SMS statistics displayed (last hour, last 24h, rate limited users)
✓ Real-time stats update
✓ Error handling for invalid inputs
✓ Admin-only access (enforced by RLS)

==================================================
TROUBLESHOOTING
==================================================

Error: "Failed to load config"
- Solution: Check admin_config table has required keys

Error: "Value must be a positive integer"
- Solution: Ensure input is numeric and > 0

Error: "Access denied"
- Solution: Verify logged-in user has admin role

==================================================
NEXT STEPS
==================================================

SMS rate limiting is now fully configurable via admin panel.
Proceed to AUTH-004 (Age verification - deferred) or AUTH-005 (User profile creation).
*/
```

---

### Acceptance Criteria

- [ ] Admin config page created
- [ ] SMS rate limit configuration displayed
- [ ] Admins can edit sms_rate_limit_per_hour value
- [ ] Input validation enforced (positive integers)
- [ ] Database updated when value saved
- [ ] Audit trail logged for all config changes
- [ ] SMS statistics displayed (last hour, last 24h, rate limited users)
- [ ] Error handling for invalid inputs
- [ ] Admin-only access enforced

---

### Output Files

- `admin/app/config/page.tsx`

---

### Common Issues

| Issue | Solution |
|-------|----------|
| Failed to load config | Check admin_config table has required keys |
| Value must be positive integer | Ensure input is numeric and > 0 |
| Access denied | Verify logged-in user has admin role |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create admin config page UI | 30 min |
| Implement config update logic | 20 min |
| Add SMS statistics section | 20 min |
| Add audit logging | 10 min |
| Test and troubleshoot | 10 min |
| **Total** | **~1.5 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** AUTH-004 - Age Verification Flow (Deferred to Post-MVP)

---

## TASK AUTH-004: Age Verification Flow (DEFERRED TO POST-MVP)

**Duration:** N/A (Deferred)  
**Priority:** Low (Post-MVP)  
**Dependencies:** None

### Description
Age verification using AWS Rekognition to verify users are minors (under 18) is deferred to Post-MVP due to:
1. Complexity of implementing facial recognition
2. Privacy concerns and legal compliance (COPPA, GDPR)
3. Cost considerations (AWS Rekognition pricing)
4. MVP can launch with alternative verification (parent email, honor system)

---

### Post-MVP Implementation Plan

**When to implement:**
- After MVP launch and initial user testing
- When budget allows for AWS Rekognition costs
- After legal review of privacy compliance
- After implementing robust data protection measures

**Proposed approach:**
1. User uploads selfie during signup
2. AWS Rekognition DetectFaces API estimates age range
3. If age > 18, reject signup with message
4. If age ≤ 18, allow signup
5. Store verification status in database
6. Implement appeal process for false positives

**Cost estimate:**
- AWS Rekognition: $0.001 per image
- For 10,000 signups/month = $10/month

**Privacy requirements:**
- Delete uploaded selfie after verification
- Store only verification result (not image)
- Obtain parental consent for data processing
- Comply with COPPA, GDPR, CCPA

---

### MVP Alternative: Parent Email Verification

For MVP, use simpler parent email verification:
1. During signup, ask user "Are you under 18?" (yes/no)
2. If yes, require parent email address
3. Send verification email to parent
4. Parent clicks link to approve account
5. Mark account as parent_verified in database

---

### Acceptance Criteria (Post-MVP)

- [ ] User uploads selfie during signup
- [ ] AWS Rekognition DetectFaces API integrated
- [ ] Age range detection working
- [ ] Users over 18 rejected
- [ ] Verification status stored in database
- [ ] Privacy compliance implemented (delete images)
- [ ] Appeal process for false positives
- [ ] Parent notification system

---

**Status:** ⏸️ Deferred to Post-MVP

**Next Task:** AUTH-005 - User Profile Creation

---

## TASK AUTH-005: User Profile Creation

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** AUTH-002 (Phone verification complete)

### Description
After phone verification, create user profile with name, avatar, location, and node assignment. Allow user to upload profile picture, enter zip code, and auto-assign to nearest geographic node.

---

### AI Prompt for Cursor (Generate Profile Creation Flow)

```typescript
/*
TASK: Implement user profile creation after phone verification

CONTEXT:
After phone verification, user creates their profile with name, avatar, zip code, and location.
System auto-assigns user to nearest geographic node based on zip code.

REQUIREMENTS:
1. Create profile creation screen
2. Allow avatar upload to Supabase Storage
3. Get user's location via zip code
4. Auto-assign to nearest node
5. Update user record in database
6. Navigate to home screen after profile creation

==================================================
FILE 1: src/screens/onboarding/ProfileCreationScreen.tsx
==================================================
*/

// filepath: src/screens/onboarding/ProfileCreationScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/services/supabase';
import { uploadAvatar } from '@/services/supabase/storage';
import { assignNodeByZipCode } from '@/services/location';
import { trackEvent } from '@/services/analytics';
import * as Sentry from '@sentry/react-native';

export default function ProfileCreationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params as { userId: string };

  const [formData, setFormData] = useState({
    name: '',
    avatar: null as string | null,
    zipCode: '',
    city: '',
    state: '',
  });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadProfileImage = async (uri: string) => {
    setUploading(true);
    try {
      const avatarUrl = await uploadAvatar(userId, uri);
      setFormData({ ...formData, avatar: avatarUrl });
      trackEvent('profile_avatar_uploaded', { user_id: userId });
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Failed to upload avatar. Please try again.');
      Sentry.captureException(error);
    } finally {
      setUploading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.zipCode || !/^\d{5}$/.test(formData.zipCode)) {
      newErrors.zipCode = 'Please enter a valid 5-digit ZIP code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleZipCodeChange = async (zipCode: string) => {
    setFormData({ ...formData, zipCode });

    // Auto-lookup city/state when zip code is complete
    if (zipCode.length === 5) {
      try {
        // Use ZIP code API or geocoding service
        // For this example, we'll use a simple lookup
        const location = await lookupZipCode(zipCode);
        if (location) {
          setFormData({
            ...formData,
            zipCode,
            city: location.city,
            state: location.state,
          });
        }
      } catch (error) {
        console.error('Zip code lookup error:', error);
      }
    }
  };

  const lookupZipCode = async (zipCode: string): Promise<{ city: string; state: string } | null> => {
    try {
      // Use free ZIP code API
      const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
      if (!response.ok) return null;

      const data = await response.json();
      return {
        city: data.places[0]['place name'],
        state: data.places[0]['state abbreviation'],
      };
    } catch (error) {
      console.error('ZIP lookup error:', error);
      return null;
    }
  };

  const handleCreateProfile = async () => {
    trackEvent('profile_creation_started', { user_id: userId });

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Assign user to nearest node based on zip code
      const nodeId = await assignNodeByZipCode(formData.zipCode);

      // Update user profile in database
      const { error } = await supabase
        .from('users')
        .update({
          name: formData.name.trim(),
          avatar_url: formData.avatar,
          zip_code: formData.zipCode,
          city: formData.city,
          state: formData.state,
          node_id: nodeId,
          profile_completed: true,
        })
        .eq('id', userId);

      if (error) throw error;

      trackEvent('profile_creation_completed', {
        user_id: userId,
        node_id: nodeId,
      });

      // Navigate to home screen
      navigation.navigate('Home' as never);

    } catch (error: any) {
      console.error('Profile creation error:', error);
      Sentry.captureException(error);

      trackEvent('profile_creation_failed', {
        user_id: userId,
        error: error.message,
      });

      Alert.alert('Error', 'Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{ padding: 24, paddingTop: 60 }}
    >
      {/* Header */}
      <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>
        Create Your Profile
      </Text>
      <Text style={{ fontSize: 16, color: '#666', marginBottom: 40 }}>
        Tell us a bit about yourself
      </Text>

      {/* Avatar Upload */}
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <TouchableOpacity
          onPress={pickImage}
          disabled={uploading}
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: '#f3f4f6',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: '#e5e7eb',
            overflow: 'hidden',
          }}
        >
          {uploading ? (
            <ActivityIndicator size="large" color="#3b82f6" />
          ) : formData.avatar ? (
            <Image
              source={{ uri: formData.avatar }}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 48, color: '#9ca3af' }}>📷</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Add Photo
              </Text>
            </View>
          )}
        </TouchableOpacity>
        {formData.avatar && (
          <TouchableOpacity
            onPress={pickImage}
            style={{ marginTop: 12 }}
            disabled={uploading}
          >
            <Text style={{ color: '#3b82f6', fontSize: 14, fontWeight: '600' }}>
              Change Photo
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Name Input */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
          Display Name *
        </Text>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: errors.name ? '#ef4444' : '#d1d5db',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
          placeholder="How do you want to be called?"
          value={formData.name}
          onChangeText={(text) => {
            setFormData({ ...formData, name: text });
            if (errors.name) setErrors({ ...errors, name: '' });
          }}
          autoCapitalize="words"
          editable={!loading}
        />
        {errors.name && (
          <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
            {errors.name}
          </Text>
        )}
      </View>

      {/* ZIP Code Input */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
          ZIP Code *
        </Text>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: errors.zipCode ? '#ef4444' : '#d1d5db',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
          placeholder="12345"
          value={formData.zipCode}
          onChangeText={handleZipCodeChange}
          keyboardType="number-pad"
          maxLength={5}
          editable={!loading}
        />
        {errors.zipCode && (
          <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
            {errors.zipCode}
          </Text>
        )}
        {formData.city && formData.state && (
          <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
            {formData.city}, {formData.state}
          </Text>
        )}
      </View>

      {/* Info Box */}
      <View
        style={{
          backgroundColor: '#eff6ff',
          borderRadius: 8,
          padding: 16,
          marginBottom: 32,
        }}
      >
        <Text style={{ fontSize: 14, color: '#1e40af', lineHeight: 20 }}>
          💡 Your ZIP code helps us connect you with nearby traders and assign you to a local
          node for events and community activities.
        </Text>
      </View>

      {/* Create Profile Button */}
      <TouchableOpacity
        style={{
          backgroundColor: loading ? '#9ca3af' : '#3b82f6',
          borderRadius: 8,
          padding: 16,
          alignItems: 'center',
        }}
        onPress={handleCreateProfile}
        disabled={loading || uploading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            Complete Profile
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

/*
==================================================
FILE 2: src/services/location.ts
==================================================
*/

// filepath: src/services/location.ts
import { supabase } from './supabase';

/**
 * Assign user to nearest geographic node based on ZIP code
 */
export const assignNodeByZipCode = async (zipCode: string): Promise<string> => {
  try {
    // Get coordinates for ZIP code
    const coords = await getZipCodeCoordinates(zipCode);
    if (!coords) {
      throw new Error('Failed to get coordinates for ZIP code');
    }

    // Find nearest node using PostGIS distance function
    const { data, error } = await supabase.rpc('get_nearest_node', {
      user_lat: coords.latitude,
      user_lng: coords.longitude,
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      // Fallback to default node if no nodes found
      const { data: defaultNode } = await supabase
        .from('geographic_nodes')
        .select('id')
        .limit(1)
        .single();

      return defaultNode?.id || '';
    }

    return data[0].id;
  } catch (error) {
    console.error('Assign node error:', error);
    // Return first node as fallback
    const { data } = await supabase
      .from('geographic_nodes')
      .select('id')
      .limit(1)
      .single();
    return data?.id || '';
  }
};

/**
 * Get coordinates for ZIP code
 */
const getZipCodeCoordinates = async (
  zipCode: string
): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
    if (!response.ok) return null;

    const data = await response.json();
    return {
      latitude: parseFloat(data.places[0].latitude),
      longitude: parseFloat(data.places[0].longitude),
    };
  } catch (error) {
    console.error('ZIP code coordinates error:', error);
    return null;
  }
};

/*
==================================================
FILE 3: Add get_nearest_node function to database
==================================================
*/

-- filepath: supabase/migrations/003_get_nearest_node.sql

-- Function to get nearest geographic node to user's location
CREATE OR REPLACE FUNCTION get_nearest_node(user_lat DOUBLE PRECISION, user_lng DOUBLE PRECISION)
RETURNS TABLE (
  id UUID,
  name TEXT,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gn.id,
    gn.name,
    ST_DistanceSphere(
      ST_MakePoint(user_lng, user_lat),
      ST_MakePoint(gn.longitude, gn.latitude)
    ) / 1000 AS distance_km
  FROM geographic_nodes gn
  WHERE gn.is_active = true
  ORDER BY distance_km ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

/*
==================================================
VERIFICATION STEPS
==================================================

1. Run database migration for get_nearest_node function
2. Navigate to profile creation screen after phone verification
3. Test avatar upload:
   - Click avatar placeholder
   - Select image from library
   - Verify image uploads to Supabase Storage
   - Verify avatar displays in UI
4. Test name input (min 2 characters)
5. Test ZIP code input:
   - Enter valid ZIP (e.g., 10001)
   - Verify city/state auto-populate (New York, NY)
   - Enter invalid ZIP (should show error)
6. Click "Complete Profile"
7. Verify user record updated in database:
   - Check users table for name, avatar_url, zip_code, city, state, node_id
   - Verify node_id is assigned to nearest node
8. Verify navigation to home screen
9. Check analytics events (profile_creation_started, profile_avatar_uploaded, profile_creation_completed)

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Profile creation screen renders correctly
✓ Avatar upload functionality works
✓ Image uploads to Supabase Storage
✓ Avatar displays in UI
✓ Name input validation (min 2 characters)
✓ ZIP code validation (5 digits)
✓ City/state auto-populate from ZIP code
✓ User assigned to nearest geographic node
✓ User record updated in database
✓ profile_completed flag set to true
✓ Navigation to home screen after profile creation
✓ Analytics events tracked
✓ Error handling for all edge cases
✓ Loading states during upload and save

==================================================
TROUBLESHOOTING
==================================================

Error: "Failed to upload avatar"
- Solution: Check Supabase Storage bucket exists and RLS allows uploads

Error: "Failed to get coordinates for ZIP code"
- Solution: Verify ZIP code API is accessible or use alternative geocoding service

Error: "No nodes found"
- Solution: Ensure geographic_nodes table has at least one active node

Error: "Permission denied for photo library"
- Solution: User must grant photo library access in device settings

==================================================
NEXT STEPS
==================================================

After profile creation complete:
1. User can now access home screen
2. Implement AUTH-006 (User profile editing)
3. Allow users to update name, avatar, location, node
*/
```

---

### Acceptance Criteria

- [ ] Profile creation screen created
- [ ] Avatar upload functionality working
- [ ] Images upload to Supabase Storage
- [ ] Name input validation (min 2 characters)
- [ ] ZIP code validation (5 digits)
- [ ] City/state auto-populate from ZIP code
- [ ] User assigned to nearest geographic node
- [ ] User record updated in database
- [ ] profile_completed flag set to true
- [ ] Navigation to home screen
- [ ] Analytics events tracked
- [ ] Error handling implemented
- [ ] Loading states displayed

---

### Output Files

- `src/screens/onboarding/ProfileCreationScreen.tsx`
- `src/services/location.ts`
- `supabase/migrations/003_get_nearest_node.sql`

---

### Common Issues

| Issue | Solution |
|-------|----------|
| Failed to upload avatar | Check Supabase Storage bucket and RLS policies |
| Failed to get ZIP coordinates | Verify ZIP code API accessibility |
| No nodes found | Ensure geographic_nodes table has active nodes |
| Photo library permission denied | User must grant access in settings |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create profile creation screen UI | 60 min |
| Implement avatar upload | 30 min |
| Implement ZIP code lookup | 20 min |
| Implement node assignment logic | 30 min |
| Create database function | 15 min |
| Test and troubleshoot | 45 min |
| **Total** | **~3 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** AUTH-006 - User Profile Editing


---

## TASK AUTH-006: User Profile Editing

**Duration:** 2.5 hours  
**Priority:** Medium  
**Dependencies:** AUTH-005 (Profile creation complete)

### Description
Allow users to edit their profile after creation. Users can update name, avatar, phone number, zip code, and location. Changing zip code may reassign user to a different geographic node.

---

### AI Prompt for Cursor (Generate Profile Editing Screen)

```typescript
/*
TASK: Implement user profile editing

CONTEXT:
Users can edit their name, avatar, phone number, and location after creating their profile.
Changing ZIP code will reassign user to nearest geographic node.

REQUIREMENTS:
1. Create profile editing screen
2. Pre-populate form with current user data
3. Allow editing name, avatar, phone, zip code
4. Re-verify phone if changed
5. Reassign node if ZIP code changed
6. Update database with new values
7. Track analytics events

==================================================
FILE 1: src/screens/profile/EditProfileScreen.tsx
==================================================
*/

// filepath: src/screens/profile/EditProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/services/supabase';
import { uploadAvatar } from '@/services/supabase/storage';
import { assignNodeByZipCode } from '@/services/location';
import { trackEvent } from '@/services/analytics';
import { useUserStore } from '@/stores/userStore';
import * as Sentry from '@sentry/react-native';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { user } = useUserStore();

  const [formData, setFormData] = useState({
    name: '',
    avatar: null as string | null,
    phone: '',
    zipCode: '',
    city: '',
    state: '',
  });
  const [originalPhone, setOriginalPhone] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      setFormData({
        name: data.name || '',
        avatar: data.avatar_url,
        phone: data.phone || '',
        zipCode: data.zip_code || '',
        city: data.city || '',
        state: data.state || '',
      });
      setOriginalPhone(data.phone || '');
    } catch (error: any) {
      console.error('Load profile error:', error);
      Alert.alert('Error', 'Failed to load profile');
      Sentry.captureException(error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadProfileImage = async (uri: string) => {
    setUploading(true);
    try {
      const avatarUrl = await uploadAvatar(user!.id, uri);
      setFormData({ ...formData, avatar: avatarUrl });
      trackEvent('profile_avatar_updated', { user_id: user!.id });
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Failed to upload avatar. Please try again.');
      Sentry.captureException(error);
    } finally {
      setUploading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!formData.phone || !phoneRegex.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.zipCode || !/^\d{5}$/.test(formData.zipCode)) {
      newErrors.zipCode = 'Please enter a valid 5-digit ZIP code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleZipCodeChange = async (zipCode: string) => {
    setFormData({ ...formData, zipCode });

    if (zipCode.length === 5) {
      try {
        const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (response.ok) {
          const data = await response.json();
          setFormData({
            ...formData,
            zipCode,
            city: data.places[0]['place name'],
            state: data.places[0]['state abbreviation'],
          });
        }
      } catch (error) {
        console.error('Zip code lookup error:', error);
      }
    }
  };

  const handleSave = async () => {
    trackEvent('profile_edit_started', { user_id: user!.id });

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      // Check if phone changed
      const phoneChanged = formData.phone !== originalPhone;

      // Check if ZIP code changed
      const zipChanged = formData.zipCode !== user?.zip_code;
      let newNodeId = user?.node_id;

      // Reassign node if ZIP code changed
      if (zipChanged) {
        newNodeId = await assignNodeByZipCode(formData.zipCode);
      }

      // Update user profile
      const updates: any = {
        name: formData.name.trim(),
        avatar_url: formData.avatar,
        phone: formData.phone,
        zip_code: formData.zipCode,
        city: formData.city,
        state: formData.state,
        node_id: newNodeId,
      };

      // If phone changed, mark as unverified
      if (phoneChanged) {
        updates.phone_verified = false;
        updates.phone_verified_at = null;
      }

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user!.id);

      if (error) throw error;

      trackEvent('profile_edit_completed', {
        user_id: user!.id,
        phone_changed: phoneChanged,
        zip_changed: zipChanged,
        node_id: newNodeId,
      });

      // If phone changed, navigate to phone verification
      if (phoneChanged) {
        Alert.alert(
          'Phone Number Changed',
          'Please verify your new phone number',
          [
            {
              text: 'Verify Now',
              onPress: () => {
                navigation.navigate('PhoneVerification' as never, {
                  userId: user!.id,
                  phone: formData.phone,
                } as never);
              },
            },
          ]
        );
      } else {
        Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }

    } catch (error: any) {
      console.error('Save profile error:', error);
      Sentry.captureException(error);

      trackEvent('profile_edit_failed', {
        user_id: user!.id,
        error: error.message,
      });

      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{ padding: 24 }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 32 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 32, color: '#3b82f6' }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111', marginLeft: 16 }}>
          Edit Profile
        </Text>
      </View>

      {/* Avatar */}
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <TouchableOpacity
          onPress={pickImage}
          disabled={uploading}
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: '#f3f4f6',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: '#e5e7eb',
            overflow: 'hidden',
          }}
        >
          {uploading ? (
            <ActivityIndicator size="large" color="#3b82f6" />
          ) : formData.avatar ? (
            <Image
              source={{ uri: formData.avatar }}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <Text style={{ fontSize: 48, color: '#9ca3af' }}>👤</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={pickImage} style={{ marginTop: 12 }} disabled={uploading}>
          <Text style={{ color: '#3b82f6', fontSize: 14, fontWeight: '600' }}>
            Change Photo
          </Text>
        </TouchableOpacity>
      </View>

      {/* Name */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
          Display Name *
        </Text>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: errors.name ? '#ef4444' : '#d1d5db',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
          value={formData.name}
          onChangeText={(text) => {
            setFormData({ ...formData, name: text });
            if (errors.name) setErrors({ ...errors, name: '' });
          }}
          editable={!saving}
        />
        {errors.name && (
          <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.name}</Text>
        )}
      </View>

      {/* Phone */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
          Phone Number *
        </Text>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: errors.phone ? '#ef4444' : '#d1d5db',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
          value={formData.phone}
          onChangeText={(text) => {
            setFormData({ ...formData, phone: text });
            if (errors.phone) setErrors({ ...errors, phone: '' });
          }}
          keyboardType="phone-pad"
          editable={!saving}
        />
        {errors.phone && (
          <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.phone}</Text>
        )}
        {formData.phone !== originalPhone && (
          <Text style={{ color: '#f59e0b', fontSize: 12, marginTop: 4 }}>
            ⚠️ Changing your phone number requires re-verification
          </Text>
        )}
      </View>

      {/* ZIP Code */}
      <View style={{ marginBottom: 32 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
          ZIP Code *
        </Text>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: errors.zipCode ? '#ef4444' : '#d1d5db',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
          value={formData.zipCode}
          onChangeText={handleZipCodeChange}
          keyboardType="number-pad"
          maxLength={5}
          editable={!saving}
        />
        {errors.zipCode && (
          <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.zipCode}</Text>
        )}
        {formData.city && formData.state && (
          <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
            {formData.city}, {formData.state}
          </Text>
        )}
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={{
          backgroundColor: saving ? '#9ca3af' : '#3b82f6',
          borderRadius: 8,
          padding: 16,
          alignItems: 'center',
          marginBottom: 16,
        }}
        onPress={handleSave}
        disabled={saving || uploading}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

/*
==================================================
VERIFICATION STEPS
==================================================

1. Navigate to Edit Profile screen from user settings
2. Verify form pre-populates with current user data
3. Test avatar upload (same as profile creation)
4. Change name → save → verify updated in database
5. Change phone number:
   - Should show warning about re-verification
   - Save → should navigate to phone verification
   - Verify phone_verified set to false
6. Change ZIP code:
   - Should auto-populate city/state
   - Save → verify node_id reassigned
7. Check analytics events (profile_edit_started, profile_edit_completed)
8. Verify user can cancel and return to previous screen

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Edit profile screen renders with current data
✓ Form pre-populated with user data
✓ Name, avatar, phone, ZIP code editable
✓ Phone change triggers re-verification
✓ ZIP code change reassigns node
✓ Database updated with new values
✓ Analytics events tracked
✓ Error handling implemented
✓ Loading states displayed
✓ Back navigation works
✓ Cancel preserves original data

==================================================
TROUBLESHOOTING
==================================================

Same as AUTH-005 (Profile Creation)

==================================================
NEXT STEPS
==================================================

After profile editing complete:
1. Implement AUTH-007 (User logout)
2. Allow users to sign out and clear session
*/
```

---

### Acceptance Criteria

- [ ] Edit profile screen created
- [ ] Form pre-populated with current user data
- [ ] Name, avatar, phone, ZIP code editable
- [ ] Avatar upload working
- [ ] Phone change triggers re-verification
- [ ] ZIP code change reassigns node
- [ ] Database updated successfully
- [ ] Analytics events tracked
- [ ] Error handling implemented
- [ ] Loading and saving states
- [ ] Back navigation works

---

### Output Files

- `src/screens/profile/EditProfileScreen.tsx`

---

### Common Issues

Same as AUTH-005 (Profile Creation)

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create edit profile screen UI | 40 min |
| Implement form pre-population | 15 min |
| Handle phone change verification | 20 min |
| Handle ZIP code change node reassignment | 20 min |
| Add analytics tracking | 10 min |
| Test and troubleshoot | 45 min |
| **Total** | **~2.5 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** AUTH-007 - User Logout

---

## TASK AUTH-007: User Logout

**Duration:** 1 hour  
**Priority:** Medium  
**Dependencies:** AUTH-001 (Authentication system)

### Description
Implement user logout functionality to clear Supabase session, app state, and local storage, then navigate to login screen.

---

### AI Prompt for Cursor (Generate Logout Functionality)

```typescript
/*
TASK: Implement user logout

CONTEXT:
User can log out from settings screen. Logout clears Supabase session, Zustand store, and AsyncStorage.

REQUIREMENTS:
1. Add logout button to settings screen
2. Show confirmation dialog
3. Clear Supabase Auth session
4. Clear Zustand user store
5. Clear AsyncStorage
6. Navigate to login screen
7. Track analytics event

==================================================
FILE 1: src/services/supabase/auth.ts (Add logout function)
==================================================
*/

// filepath: src/services/supabase/auth.ts (add this function)

export const logout = async (): Promise<{ error: Error | null }> => {
  try {
    // Clear Supabase session
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear AsyncStorage
    await AsyncStorage.multiRemove([
      '@user_token',
      '@user_id',
      '@user_data',
      '@last_sync',
    ]);

    return { error: null };
  } catch (error: any) {
    console.error('Logout error:', error);
    return { error };
  }
};

/*
==================================================
FILE 2: src/screens/settings/SettingsScreen.tsx
==================================================
*/

// filepath: src/screens/settings/SettingsScreen.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { logout } from '@/services/supabase/auth';
import { useUserStore } from '@/stores/userStore';
import { trackEvent } from '@/services/analytics';
import * as Sentry from '@sentry/react-native';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { clearUser } = useUserStore();
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  const performLogout = async () => {
    setLoading(true);

    try {
      // Track logout event
      trackEvent('logout', {
        timestamp: new Date().toISOString(),
      });

      // Clear Supabase session and AsyncStorage
      const { error } = await logout();
      if (error) throw error;

      // Clear Zustand store
      clearUser();

      // Navigate to login screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' as never }],
      });

    } catch (error: any) {
      console.error('Logout error:', error);
      Sentry.captureException(error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 24 }}>
      <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111', marginBottom: 32 }}>
        Settings
      </Text>

      {/* Settings Options */}
      <View style={{ flex: 1 }}>
        {/* Edit Profile */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}
          onPress={() => navigation.navigate('EditProfile' as never)}
        >
          <Text style={{ fontSize: 16, color: '#111' }}>Edit Profile</Text>
          <Text style={{ fontSize: 20, color: '#9ca3af' }}>›</Text>
        </TouchableOpacity>

        {/* Notifications */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}
          onPress={() => navigation.navigate('NotificationSettings' as never)}
        >
          <Text style={{ fontSize: 16, color: '#111' }}>Notifications</Text>
          <Text style={{ fontSize: 20, color: '#9ca3af' }}>›</Text>
        </TouchableOpacity>

        {/* Privacy */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}
          onPress={() => navigation.navigate('Privacy' as never)}
        >
          <Text style={{ fontSize: 16, color: '#111' }}>Privacy & Safety</Text>
          <Text style={{ fontSize: 20, color: '#9ca3af' }}>›</Text>
        </TouchableOpacity>

        {/* About */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}
          onPress={() => navigation.navigate('About' as never)}
        >
          <Text style={{ fontSize: 16, color: '#111' }}>About</Text>
          <Text style={{ fontSize: 20, color: '#9ca3af' }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        style={{
          backgroundColor: loading ? '#9ca3af' : '#ef4444',
          borderRadius: 8,
          padding: 16,
          alignItems: 'center',
          marginTop: 'auto',
        }}
        onPress={handleLogout}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Log Out</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

/*
==================================================
FILE 3: src/stores/userStore.ts (Add clearUser function)
==================================================
*/

// filepath: src/stores/userStore.ts
import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  phone?: string;
  zip_code?: string;
  node_id?: string;
  role: string;
  points_balance: number;
}

interface UserStore {
  user: User | null;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));

/*
==================================================
VERIFICATION STEPS
==================================================

1. Navigate to Settings screen
2. Click "Log Out" button
3. Verify confirmation dialog appears
4. Click "Cancel" → should stay on settings
5. Click "Log Out" again → "Log Out" in dialog
6. Verify:
   - Supabase session cleared (check supabase.auth.getSession())
   - Zustand store cleared (user should be null)
   - AsyncStorage cleared (check @user_token)
   - Navigation to Login screen
7. Try accessing protected screens (should redirect to login)
8. Check analytics event "logout" tracked
9. Verify can log in again after logout

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Logout button displayed in settings
✓ Confirmation dialog shown before logout
✓ Supabase Auth session cleared
✓ Zustand user store cleared
✓ AsyncStorage cleared
✓ Navigation to login screen
✓ Analytics event tracked
✓ Loading state during logout
✓ Error handling if logout fails
✓ Can log in again after logout

==================================================
TROUBLESHOOTING
==================================================

Error: "Failed to log out"
- Solution: Check Supabase connection and retry

Error: "Navigation error after logout"
- Solution: Use navigation.reset() instead of navigate()

Issue: User data still visible after logout
- Solution: Ensure clearUser() called before navigation

==================================================
NEXT STEPS
==================================================

After logout complete:
1. Implement AUTH-008 (Forgot password flow)
2. Allow users to reset password via email
*/
```

---

### Acceptance Criteria

- [ ] Logout button in settings screen
- [ ] Confirmation dialog shown
- [ ] Supabase Auth session cleared
- [ ] Zustand user store cleared
- [ ] AsyncStorage cleared
- [ ] Navigation to login screen
- [ ] Analytics event tracked
- [ ] Loading state displayed
- [ ] Error handling implemented
- [ ] Can log in again after logout

---

### Output Files

- `src/screens/settings/SettingsScreen.tsx`
- Updated `src/services/supabase/auth.ts` (logout function)
- Updated `src/stores/userStore.ts` (clearUser function)

---

### Common Issues

| Issue | Solution |
|-------|----------|
| Failed to log out | Check Supabase connection and retry |
| Navigation error | Use navigation.reset() instead of navigate() |
| User data still visible | Ensure clearUser() called before navigation |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Add logout function to auth service | 10 min |
| Create settings screen with logout button | 20 min |
| Add confirmation dialog | 10 min |
| Implement clearUser in store | 5 min |
| Test and troubleshoot | 15 min |
| **Total** | **~1 hour** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** AUTH-008 - Forgot Password Flow


---

## TASK AUTH-008: Forgot Password Flow

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** AUTH-001 (Authentication system), INFRA-010 (SendGrid email)

### Description
Implement forgot password flow using Supabase Auth password reset emails. User enters email, receives reset link, sets new password.

---

### AI Prompt for Cursor (Generate Forgot Password Flow)

```typescript
/*
TASK: Implement forgot password flow

CONTEXT:
User can reset their password by entering email address. Supabase sends reset email with deep link.
User clicks link, enters new password, and regains access to account.

REQUIREMENTS:
1. Create forgot password screen
2. Send password reset email via Supabase
3. Handle deep link from email
4. Create reset password screen
5. Update password in Supabase
6. Track analytics events

==================================================
FILE 1: src/screens/auth/ForgotPasswordScreen.tsx
==================================================
*/

// filepath: src/screens/auth/ForgotPasswordScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { trackEvent } from '@/services/analytics';
import * as Sentry from '@sentry/react-native';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email);
  };

  const handleSendResetEmail = async () => {
    if (!email || !validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      trackEvent('password_reset_requested', { email });

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'p2pkids://reset-password',
      });

      if (error) throw error;

      setEmailSent(true);
      trackEvent('password_reset_email_sent', { email });

      Alert.alert(
        'Email Sent',
        'Check your email for a password reset link. The link expires in 1 hour.'
      );

    } catch (error: any) {
      console.error('Password reset error:', error);
      Sentry.captureException(error);

      trackEvent('password_reset_failed', {
        email,
        error: error.message,
      });

      Alert.alert('Error', 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 24 }}>
      <View style={{ marginTop: 60 }}>
        {/* Header */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginBottom: 24 }}
        >
          <Text style={{ fontSize: 32, color: '#3b82f6' }}>←</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>
          Forgot Password?
        </Text>
        <Text style={{ fontSize: 16, color: '#666', marginBottom: 40 }}>
          {emailSent
            ? "We've sent a password reset link to your email"
            : 'Enter your email address and we'll send you a reset link'}
        </Text>

        {!emailSent && (
          <>
            {/* Email Input */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                Email Address
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                }}
                placeholder="john@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {/* Send Reset Email Button */}
            <TouchableOpacity
              style={{
                backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                borderRadius: 8,
                padding: 16,
                alignItems: 'center',
                marginBottom: 16,
              }}
              onPress={handleSendResetEmail}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                  Send Reset Link
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {emailSent && (
          <View>
            <View
              style={{
                backgroundColor: '#ecfdf5',
                borderRadius: 8,
                padding: 16,
                marginBottom: 24,
              }}
            >
              <Text style={{ fontSize: 14, color: '#065f46', lineHeight: 20 }}>
                ✓ Email sent to {email}
                {'\n\n'}
                Check your inbox and click the reset link. The link expires in 1 hour.
              </Text>
            </View>

            {/* Resend Button */}
            <TouchableOpacity
              style={{
                borderWidth: 1,
                borderColor: '#3b82f6',
                borderRadius: 8,
                padding: 16,
                alignItems: 'center',
                marginBottom: 16,
              }}
              onPress={() => {
                setEmailSent(false);
                handleSendResetEmail();
              }}
            >
              <Text style={{ color: '#3b82f6', fontSize: 16, fontWeight: '600' }}>
                Resend Email
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Back to Login */}
        <TouchableOpacity
          style={{ alignItems: 'center' }}
          onPress={() => navigation.navigate('Login' as never)}
        >
          <Text style={{ color: '#666', fontSize: 14 }}>
            Remember your password?{' '}
            <Text style={{ color: '#3b82f6', fontWeight: '600' }}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/*
==================================================
FILE 2: src/screens/auth/ResetPasswordScreen.tsx
==================================================
*/

// filepath: src/screens/auth/ResetPasswordScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { trackEvent } from '@/services/analytics';
import * as Sentry from '@sentry/react-native';

export default function ResetPasswordScreen() {
  const navigation = useNavigation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validatePassword = (password: string): string | null => {
    if (!password || password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleResetPassword = async () => {
    // Validate password
    const newErrors: Record<string, string> = {};

    const passwordError = validatePassword(password);
    if (passwordError) newErrors.password = passwordError;

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      trackEvent('password_reset_attempted');

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      trackEvent('password_reset_completed');

      Alert.alert(
        'Password Reset',
        'Your password has been reset successfully',
        [
          {
            text: 'Log In',
            onPress: () => navigation.navigate('Login' as never),
          },
        ]
      );

    } catch (error: any) {
      console.error('Reset password error:', error);
      Sentry.captureException(error);

      trackEvent('password_reset_failed', {
        error: error.message,
      });

      Alert.alert('Error', 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 24 }}>
      <View style={{ marginTop: 60 }}>
        {/* Header */}
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>
          Reset Password
        </Text>
        <Text style={{ fontSize: 16, color: '#666', marginBottom: 40 }}>
          Enter your new password
        </Text>

        {/* New Password Input */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
            New Password *
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: errors.password ? '#ef4444' : '#d1d5db',
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
            }}
            placeholder="Minimum 8 characters"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors({ ...errors, password: '' });
            }}
            secureTextEntry
            editable={!loading}
          />
          {errors.password && (
            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
              {errors.password}
            </Text>
          )}
        </View>

        {/* Confirm Password Input */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
            Confirm Password *
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: errors.confirmPassword ? '#ef4444' : '#d1d5db',
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
            }}
            placeholder="Re-enter password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
            }}
            secureTextEntry
            editable={!loading}
          />
          {errors.confirmPassword && (
            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
              {errors.confirmPassword}
            </Text>
          )}
        </View>

        {/* Reset Password Button */}
        <TouchableOpacity
          style={{
            backgroundColor: loading ? '#9ca3af' : '#3b82f6',
            borderRadius: 8,
            padding: 16,
            alignItems: 'center',
          }}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              Reset Password
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/*
==================================================
FILE 3: app.json (Add deep link configuration)
==================================================
*/

// filepath: app.json (add to expo.scheme)
{
  "expo": {
    "scheme": "p2pkids",
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "p2pkids",
              "host": "reset-password"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}

/*
==================================================
FILE 4: App.tsx (Handle deep links)
==================================================
*/

// filepath: App.tsx (add deep link handling)
import * as Linking from 'expo-linking';

// Inside App component
useEffect(() => {
  const handleDeepLink = async (event: { url: string }) => {
    const { path, queryParams } = Linking.parse(event.url);
    
    if (path === 'reset-password') {
      // User clicked reset password link
      // Supabase automatically handles the session
      navigation.navigate('ResetPassword');
    }
  };

  const subscription = Linking.addEventListener('url', handleDeepLink);

  // Check if app was opened with deep link
  Linking.getInitialURL().then((url) => {
    if (url) {
      handleDeepLink({ url });
    }
  });

  return () => subscription.remove();
}, []);

/*
==================================================
VERIFICATION STEPS
==================================================

1. Navigate to Login screen → click "Forgot Password?"
2. Enter email address → click "Send Reset Link"
3. Verify email received (check spam if not in inbox)
4. Click reset link in email
5. App should open to Reset Password screen
6. Enter new password (test validation):
   - Short password (< 8 chars) → should show error
   - No uppercase → should show error
   - No number → should show error
   - Mismatched passwords → should show error
7. Enter valid password → click "Reset Password"
8. Verify success message and navigation to Login
9. Log in with new password
10. Check analytics events (password_reset_requested, password_reset_email_sent, password_reset_completed)

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Forgot password screen created
✓ Email validation working
✓ Password reset email sent via Supabase
✓ Deep link handling configured
✓ Reset password screen created
✓ Password validation implemented
✓ Password updated in Supabase
✓ Success message displayed
✓ Navigation to login after reset
✓ Can log in with new password
✓ Analytics events tracked
✓ Error handling implemented

==================================================
TROUBLESHOOTING
==================================================

Error: "Failed to send reset email"
- Solution: Check Supabase email template configured

Error: "Deep link not opening app"
- Solution: Verify app.json scheme matches redirectTo URL

Error: "Failed to reset password"
- Solution: Check user has valid session from email link

Issue: Email not received
- Solution: Check spam folder, verify SendGrid configured

==================================================
NEXT STEPS
==================================================

After password reset complete:
1. Implement AUTH-009 (Onboarding screens)
2. Create welcome flow for new users
*/
```

---

### Acceptance Criteria

- [ ] Forgot password screen created
- [ ] Email validation working
- [ ] Password reset email sent
- [ ] Deep link handling configured
- [ ] Reset password screen created
- [ ] Password validation implemented
- [ ] Password updated successfully
- [ ] Success message displayed
- [ ] Navigation to login
- [ ] Can log in with new password
- [ ] Analytics events tracked

---

### Output Files

- `src/screens/auth/ForgotPasswordScreen.tsx`
- `src/screens/auth/ResetPasswordScreen.tsx`
- Updated `app.json` (deep link configuration)
- Updated `App.tsx` (deep link handling)

---

### Common Issues

| Issue | Solution |
|-------|----------|
| Failed to send email | Check Supabase email template configured |
| Deep link not working | Verify app.json scheme matches redirectTo |
| Failed to reset password | Check user has valid session from link |
| Email not received | Check spam, verify SendGrid configured |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create forgot password screen | 30 min |
| Create reset password screen | 30 min |
| Configure deep links | 20 min |
| Handle deep link navigation | 15 min |
| Test and troubleshoot | 25 min |
| **Total** | **~2 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** AUTH-009 - Onboarding Screens

---

## TASK AUTH-009: Onboarding Screens

**Duration:** 3 hours  
**Priority:** Medium  
**Dependencies:** AUTH-002 (Phone verification)

### Description
Create onboarding flow for new users after phone verification. Show welcome screens, location picker, node selection, and feature highlights.

---

### AI Prompt for Cursor (Generate Onboarding Screens)

```typescript
/*
TASK: Implement onboarding screens for new users

CONTEXT:
After phone verification, new users see onboarding flow:
1. Welcome screen
2. Location picker (ZIP code)
3. Node selection
4. Feature highlights (swipeable)

REQUIREMENTS:
1. Create welcome screen
2. Create location picker screen
3. Create node selection screen
4. Create feature highlights carousel
5. Save onboarding completion status
6. Navigate to home screen after completion

==================================================
FILE 1: src/screens/onboarding/WelcomeScreen.tsx
==================================================
*/

// filepath: src/screens/onboarding/WelcomeScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function WelcomeScreen() {
  const navigation = useNavigation();

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 24 }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        {/* Logo/Illustration */}
        <Text style={{ fontSize: 80, marginBottom: 24 }}>🌟</Text>

        {/* Title */}
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111', textAlign: 'center', marginBottom: 16 }}>
          Welcome to{'\n'}P2P Kids Marketplace
        </Text>

        {/* Description */}
        <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24, marginBottom: 48 }}>
          A safe space for kids to trade items,{'\n'}
          learn entrepreneurship, and build{'\n'}
          their community
        </Text>

        {/* Get Started Button */}
        <TouchableOpacity
          style={{
            backgroundColor: '#3b82f6',
            borderRadius: 8,
            paddingVertical: 16,
            paddingHorizontal: 48,
          }}
          onPress={() => navigation.navigate('LocationPicker' as never)}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
            Get Started
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/*
==================================================
FILE 2: src/screens/onboarding/LocationPickerScreen.tsx
==================================================
*/

// filepath: src/screens/onboarding/LocationPickerScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { assignNodeByZipCode } from '@/services/location';
import { trackEvent } from '@/services/analytics';

export default function LocationPickerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params as { userId: string };

  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);

  const handleZipCodeChange = async (zip: string) => {
    setZipCode(zip);

    if (zip.length === 5) {
      try {
        const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
        if (response.ok) {
          const data = await response.json();
          setCity(data.places[0]['place name']);
          setState(data.places[0]['state abbreviation']);
        }
      } catch (error) {
        console.error('ZIP lookup error:', error);
      }
    } else {
      setCity('');
      setState('');
    }
  };

  const handleContinue = async () => {
    if (!/^\d{5}$/.test(zipCode)) {
      Alert.alert('Invalid ZIP', 'Please enter a valid 5-digit ZIP code');
      return;
    }

    setLoading(true);

    try {
      // Assign node based on ZIP code
      const nodeId = await assignNodeByZipCode(zipCode);

      // Update user location
      const { error } = await supabase
        .from('users')
        .update({
          zip_code: zipCode,
          city,
          state,
          node_id: nodeId,
        })
        .eq('id', userId);

      if (error) throw error;

      trackEvent('onboarding_location_set', {
        user_id: userId,
        zip_code: zipCode,
        node_id: nodeId,
      });

      // Navigate to node selection
      navigation.navigate('NodeSelection' as never, {
        userId,
        nodeId,
      } as never);

    } catch (error: any) {
      console.error('Location picker error:', error);
      Alert.alert('Error', 'Failed to set location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 24 }}>
      <View style={{ marginTop: 60 }}>
        {/* Progress Indicator */}
        <View style={{ flexDirection: 'row', marginBottom: 32 }}>
          <View style={{ flex: 1, height: 4, backgroundColor: '#3b82f6', borderRadius: 2 }} />
          <View style={{ flex: 1, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, marginLeft: 4 }} />
          <View style={{ flex: 1, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, marginLeft: 4 }} />
        </View>

        {/* Title */}
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>
          Where are you located?
        </Text>
        <Text style={{ fontSize: 16, color: '#666', marginBottom: 40 }}>
          We'll connect you with nearby traders
        </Text>

        {/* ZIP Code Input */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
            ZIP Code
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
            }}
            placeholder="12345"
            value={zipCode}
            onChangeText={handleZipCodeChange}
            keyboardType="number-pad"
            maxLength={5}
            editable={!loading}
          />
          {city && state && (
            <Text style={{ color: '#666', fontSize: 14, marginTop: 8 }}>
              📍 {city}, {state}
            </Text>
          )}
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={{
            backgroundColor: loading || !city ? '#9ca3af' : '#3b82f6',
            borderRadius: 8,
            padding: 16,
            alignItems: 'center',
          }}
          onPress={handleContinue}
          disabled={loading || !city}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/*
==================================================
FILE 3: src/screens/onboarding/NodeSelectionScreen.tsx
==================================================
*/

// filepath: src/screens/onboarding/NodeSelectionScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { trackEvent } from '@/services/analytics';

interface Node {
  id: string;
  name: string;
  description: string;
  member_count: number;
}

export default function NodeSelectionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, nodeId } = route.params as { userId: string; nodeId: string };

  const [assignedNode, setAssignedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNode();
  }, []);

  const loadNode = async () => {
    try {
      const { data, error } = await supabase
        .from('geographic_nodes')
        .select('id, name, description, member_count')
        .eq('id', nodeId)
        .single();

      if (error) throw error;
      setAssignedNode(data);
    } catch (error) {
      console.error('Load node error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    trackEvent('onboarding_node_confirmed', {
      user_id: userId,
      node_id: nodeId,
    });

    navigation.navigate('FeatureHighlights' as never, { userId } as never);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 24 }}>
      <View style={{ marginTop: 60 }}>
        {/* Progress Indicator */}
        <View style={{ flexDirection: 'row', marginBottom: 32 }}>
          <View style={{ flex: 1, height: 4, backgroundColor: '#3b82f6', borderRadius: 2 }} />
          <View style={{ flex: 1, height: 4, backgroundColor: '#3b82f6', borderRadius: 2, marginLeft: 4 }} />
          <View style={{ flex: 1, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, marginLeft: 4 }} />
        </View>

        {/* Title */}
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>
          Your Local Node
        </Text>
        <Text style={{ fontSize: 16, color: '#666', marginBottom: 40 }}>
          You've been assigned to a nearby community
        </Text>

        {/* Node Card */}
        <View
          style={{
            backgroundColor: '#f9fafb',
            borderRadius: 16,
            padding: 24,
            marginBottom: 40,
          }}
        >
          <Text style={{ fontSize: 24, marginBottom: 8 }}>🏘️</Text>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>
            {assignedNode?.name}
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
            {assignedNode?.description}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#666' }}>
              👥 {assignedNode?.member_count || 0} members
            </Text>
          </View>
        </View>

        {/* Info Box */}
        <View
          style={{
            backgroundColor: '#eff6ff',
            borderRadius: 8,
            padding: 16,
            marginBottom: 32,
          }}
        >
          <Text style={{ fontSize: 14, color: '#1e40af', lineHeight: 20 }}>
            💡 Your node is where you'll find local traders, attend events, and participate in
            community activities.
          </Text>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={{
            backgroundColor: '#3b82f6',
            borderRadius: 8,
            padding: 16,
            alignItems: 'center',
          }}
          onPress={handleContinue}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Looks Good!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/*
==================================================
FILE 4: src/screens/onboarding/FeatureHighlightsScreen.tsx
==================================================
*/

// filepath: src/screens/onboarding/FeatureHighlightsScreen.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { trackEvent } from '@/services/analytics';

const { width } = Dimensions.get('window');

const features = [
  {
    emoji: '🤝',
    title: 'Trade Safely',
    description: 'List items, browse local listings, and trade with kids in your community',
  },
  {
    emoji: '⭐',
    title: 'Earn Points',
    description: 'Complete trades, refer friends, and earn points to boost your profile',
  },
  {
    emoji: '💬',
    title: 'Chat Securely',
    description: 'Message other users safely. Parents can monitor all conversations',
  },
  {
    emoji: '🏆',
    title: 'Build Reputation',
    description: 'Get rated by other traders and become a trusted member of the community',
  },
];

export default function FeatureHighlightsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params as { userId: string };

  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < features.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    try {
      // Mark onboarding as completed
      await supabase
        .from('users')
        .update({ onboarding_completed: true })
        .eq('id', userId);

      trackEvent('onboarding_completed', { user_id: userId });

      // Navigate to home screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' as never }],
      });
    } catch (error) {
      console.error('Finish onboarding error:', error);
    }
  };

  const feature = features[currentIndex];

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 24 }}>
      <View style={{ marginTop: 60 }}>
        {/* Progress Indicator */}
        <View style={{ flexDirection: 'row', marginBottom: 32 }}>
          <View style={{ flex: 1, height: 4, backgroundColor: '#3b82f6', borderRadius: 2 }} />
          <View style={{ flex: 1, height: 4, backgroundColor: '#3b82f6', borderRadius: 2, marginLeft: 4 }} />
          <View style={{ flex: 1, height: 4, backgroundColor: '#3b82f6', borderRadius: 2, marginLeft: 4 }} />
        </View>

        {/* Feature Content */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 100, marginBottom: 24 }}>{feature.emoji}</Text>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111', textAlign: 'center', marginBottom: 16 }}>
            {feature.title}
          </Text>
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24, paddingHorizontal: 32 }}>
            {feature.description}
          </Text>
        </View>

        {/* Pagination Dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 32 }}>
          {features.map((_, index) => (
            <View
              key={index}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: index === currentIndex ? '#3b82f6' : '#d1d5db',
                marginHorizontal: 4,
              }}
            />
          ))}
        </View>

        {/* Next/Finish Button */}
        <TouchableOpacity
          style={{
            backgroundColor: '#3b82f6',
            borderRadius: 8,
            padding: 16,
            alignItems: 'center',
          }}
          onPress={handleNext}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            {currentIndex < features.length - 1 ? 'Next' : 'Get Started'}
          </Text>
        </TouchableOpacity>

        {/* Skip Button */}
        {currentIndex < features.length - 1 && (
          <TouchableOpacity
            style={{ alignItems: 'center', marginTop: 16 }}
            onPress={handleFinish}
          >
            <Text style={{ color: '#666', fontSize: 14 }}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/*
==================================================
VERIFICATION STEPS
==================================================

1. Complete phone verification
2. Verify navigation to Welcome screen
3. Click "Get Started" → navigate to Location Picker
4. Enter ZIP code → verify city/state auto-populate
5. Click Continue → navigate to Node Selection
6. Verify assigned node displays correctly
7. Click "Looks Good!" → navigate to Feature Highlights
8. Swipe through features (4 screens)
9. Click "Get Started" on last screen
10. Verify onboarding_completed = true in database
11. Verify navigation to Home screen
12. Check analytics events (onboarding_location_set, onboarding_node_confirmed, onboarding_completed)

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Welcome screen created
✓ Location picker screen created
✓ Node selection screen created
✓ Feature highlights carousel created
✓ ZIP code lookup working
✓ Node assignment working
✓ Progress indicators displayed
✓ Pagination dots for features
✓ onboarding_completed flag set
✓ Navigation to home after completion
✓ Skip functionality working
✓ Analytics events tracked

==================================================
NEXT STEPS
==================================================

After onboarding complete:
1. Implement AUTH-010 (Referral code entry)
2. Implement AUTH-011 (Referral bonus logic)
*/
```

---

### Acceptance Criteria

- [ ] Welcome screen created
- [ ] Location picker screen created
- [ ] Node selection screen created
- [ ] Feature highlights carousel created
- [ ] ZIP code lookup working
- [ ] Node assignment working
- [ ] Progress indicators displayed
- [ ] Pagination dots for features
- [ ] onboarding_completed flag set
- [ ] Navigation to home
- [ ] Skip functionality working
- [ ] Analytics events tracked

---

### Output Files

- `src/screens/onboarding/WelcomeScreen.tsx`
- `src/screens/onboarding/LocationPickerScreen.tsx`
- `src/screens/onboarding/NodeSelectionScreen.tsx`
- `src/screens/onboarding/FeatureHighlightsScreen.tsx`

---

### Common Issues

Same as AUTH-005 (Profile Creation) for location picker

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create welcome screen | 30 min |
| Create location picker screen | 45 min |
| Create node selection screen | 30 min |
| Create feature highlights carousel | 45 min |
| Add progress indicators and navigation | 20 min |
| Test and troubleshoot | 30 min |
| **Total** | **~3 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** AUTH-010 - Referral Code Entry


---

## TASK AUTH-010: Referral Code Entry

**Duration:** 1.5 hours  
**Priority:** Low  
**Dependencies:** AUTH-001 (Signup flow), INFRA-003 (Database schema with referrals table)

### Description
Allow users to enter optional referral code during signup. Validate code exists, link referee to referrer, create pending referral record. Bonus awarded after first completed trade (AUTH-011).

---

### AI Prompt for Cursor (Generate Referral Code Entry)

```typescript
/*
TASK: Implement referral code entry during signup

CONTEXT:
During signup, user can optionally enter a referral code from an existing user.
If code is valid, create referral record. Bonus awarded after first completed trade.

REQUIREMENTS:
1. Add referral code input to signup screen
2. Validate referral code exists
3. Create referral record in database
4. Generate unique referral code for new user
5. Track analytics events

==================================================
FILE 1: Update src/screens/auth/SignupScreen.tsx
==================================================
Add referral code input field
*/

// filepath: src/screens/auth/SignupScreen.tsx (add to existing component)

// Add to state:
const [referralCode, setReferralCode] = useState('');

// Add after phone input (before password input):
{/* Referral Code Input (Optional) */}
<View style={{ marginBottom: 20 }}>
  <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
    Referral Code (Optional)
  </Text>
  <TextInput
    style={{
      borderWidth: 1,
      borderColor: '#d1d5db',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
    }}
    placeholder="Enter referral code"
    value={referralCode}
    onChangeText={(text) => setReferralCode(text.toUpperCase())}
    autoCapitalize="characters"
    maxLength={8}
    editable={!loading}
  />
  <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
    Get 50 bonus points when you complete your first trade!
  </Text>
</View>

// Update handleSignup to pass referralCode:
const { user, error } = await signUp({
  email: formData.email.trim().toLowerCase(),
  password: formData.password,
  name: formData.name.trim(),
  phone: formData.phone.trim(),
  referralCode: referralCode.trim(),
});

/*
==================================================
FILE 2: Update src/services/supabase/auth.ts
==================================================
Add referral code handling to signUp function
*/

// filepath: src/services/supabase/auth.ts (update signUp function)

export const signUp = async ({
  email,
  password,
  name,
  phone,
  referralCode,
}: {
  email: string;
  password: string;
  name: string;
  phone: string;
  referralCode?: string;
}): Promise<{ user: any; error: Error | null }> => {
  try {
    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('No user returned from signup');

    const userId = authData.user.id;

    // Generate unique referral code for new user
    const newUserReferralCode = await generateReferralCode();

    // Create user record in database
    const { error: userError } = await supabase.from('users').insert({
      id: userId,
      email,
      name,
      phone,
      referral_code: newUserReferralCode,
      role: 'user',
      points_balance: 0,
    });

    if (userError) throw userError;

    // Handle referral code if provided
    if (referralCode) {
      await processReferralCode(userId, referralCode);
    }

    return { user: authData.user, error: null };
  } catch (error: any) {
    console.error('Signup error:', error);
    return { user: null, error };
  }
};

/**
 * Generate unique referral code for user
 * Format: 8 uppercase alphanumeric characters
 */
const generateReferralCode = async (): Promise<string> => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  // Generate random 8-character code
  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  // Check if code already exists
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('referral_code', code)
    .single();

  // If code exists, generate a new one (recursive)
  if (data) {
    return generateReferralCode();
  }

  return code;
};

/**
 * Process referral code entered during signup
 */
const processReferralCode = async (newUserId: string, referralCode: string) => {
  try {
    // Find user with this referral code
    const { data: referrer, error } = await supabase
      .from('users')
      .select('id, name')
      .eq('referral_code', referralCode)
      .single();

    if (error || !referrer) {
      console.error('Invalid referral code:', referralCode);
      trackEvent('referral_code_invalid', {
        user_id: newUserId,
        code: referralCode,
      });
      return; // Don't throw error - just ignore invalid code
    }

    // Create referral record (status: pending until first trade)
    const { error: referralError } = await supabase.from('referrals').insert({
      referrer_id: referrer.id,
      referee_id: newUserId,
      code: referralCode,
      status: 'pending',
      points_awarded: 0,
    });

    if (referralError) {
      console.error('Failed to create referral:', referralError);
      return;
    }

    trackEvent('referral_code_used', {
      referee_id: newUserId,
      referrer_id: referrer.id,
      code: referralCode,
    });

  } catch (error) {
    console.error('Process referral code error:', error);
  }
};

/*
==================================================
FILE 3: Add referral_code column to users table
==================================================
*/

-- filepath: supabase/migrations/004_add_referral_code.sql

-- Add referral_code column to users table
ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_users_referral_code ON users(referral_code);

-- Update existing users with generated referral codes
-- (Run this after migration to generate codes for existing users)
-- UPDATE users SET referral_code = CONCAT('REF', SUBSTRING(MD5(id::text), 1, 5)) WHERE referral_code IS NULL;

/*
==================================================
VERIFICATION STEPS
==================================================

1. Navigate to Signup screen
2. Fill out signup form
3. Enter referral code from existing user:
   - Go to existing user's profile
   - Copy their referral code (e.g., "ABC12XYZ")
   - Paste into referral code field during signup
4. Complete signup
5. Verify database:
   - Check users table: new user has generated referral_code
   - Check referrals table: referral record created with status='pending'
6. Try invalid referral code:
   - Enter "INVALID123"
   - Should complete signup but no referral record created
7. Check analytics events (referral_code_used or referral_code_invalid)
8. Verify referral bonus NOT awarded yet (happens in AUTH-011 after first trade)

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Referral code input added to signup screen
✓ Optional field (signup works without code)
✓ Code validates against existing users
✓ Invalid codes handled gracefully (no error shown)
✓ Referral record created with status='pending'
✓ New user assigned unique referral code
✓ Analytics events tracked
✓ Database schema updated (referral_code column)
✓ Bonus NOT awarded until first trade

==================================================
TROUBLESHOOTING
==================================================

Error: "Failed to create referral"
- Solution: Check referrals table RLS policies allow INSERT

Error: "referral_code already exists"
- Solution: generateReferralCode should retry with new code

Issue: Referral code not saving
- Solution: Verify users table has referral_code column

==================================================
NEXT STEPS
==================================================

After referral code entry complete:
1. Implement AUTH-011 (Referral bonus logic)
2. Award 50 points to both users after first completed trade
*/
```

---

### Acceptance Criteria

- [ ] Referral code input added to signup
- [ ] Optional field (signup works without code)
- [ ] Code validates against existing users
- [ ] Invalid codes handled gracefully
- [ ] Referral record created (status='pending')
- [ ] New user assigned unique referral code
- [ ] Analytics events tracked
- [ ] Database schema updated
- [ ] Bonus deferred until first trade

---

### Output Files

- Updated `src/screens/auth/SignupScreen.tsx`
- Updated `src/services/supabase/auth.ts`
- `supabase/migrations/004_add_referral_code.sql`

---

### Common Issues

| Issue | Solution |
|-------|----------|
| Failed to create referral | Check referrals table RLS policies |
| Code already exists | generateReferralCode retries with new code |
| Code not saving | Verify users table has referral_code column |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Add referral code input to signup | 15 min |
| Implement code generation | 20 min |
| Implement code validation | 20 min |
| Create database migration | 10 min |
| Add analytics tracking | 10 min |
| Test and troubleshoot | 15 min |
| **Total** | **~1.5 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** AUTH-011 - Referral Bonus Logic

---

## TASK AUTH-011: Referral Bonus Logic

**Duration:** 2 hours  
**Priority:** Low  
**Dependencies:** AUTH-010 (Referral code entry), Trade completion (future module)

### Description
Award 50 points bonus to both referrer and referee when referee completes their first trade. Update referral status to 'completed', create points transactions, send notifications.

---

### AI Prompt for Cursor (Generate Referral Bonus Logic)

```typescript
/*
TASK: Implement referral bonus logic

CONTEXT:
When a new user (referee) completes their first trade, award 50 points to both the referrer
and the referee. Update referral status to 'completed', create points transactions, and send
notifications to both users.

REQUIREMENTS:
1. Detect when referee completes first trade
2. Award 50 points to referrer
3. Award 50 points to referee
4. Update referral status to 'completed'
5. Create points_transactions records
6. Send notifications to both users
7. Track analytics events

==================================================
FILE 1: src/services/referrals.ts
==================================================
*/

// filepath: src/services/referrals.ts
import { supabase } from './supabase';
import { trackEvent } from './analytics';

/**
 * Process referral bonus after user's first completed trade
 * @param userId - ID of user who just completed their first trade
 * @param tradeId - ID of the completed trade
 */
export const processReferralBonus = async (
  userId: string,
  tradeId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if this user has a pending referral
    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .select('id, referrer_id, referee_id, code')
      .eq('referee_id', userId)
      .eq('status', 'pending')
      .single();

    if (referralError || !referral) {
      // No pending referral - user didn't use a referral code
      return { success: false, error: 'No pending referral found' };
    }

    // Check if this is the referee's first completed trade
    const { count, error: tradeCountError } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .eq('status', 'completed');

    if (tradeCountError) throw tradeCountError;

    // If count > 1, this is not their first trade (bonus already awarded)
    if (count && count > 1) {
      return { success: false, error: 'Not first trade' };
    }

    // Get referral bonus amount from config (default: 50)
    const { data: configData } = await supabase
      .from('admin_config')
      .select('value')
      .eq('key', 'referral_bonus_points')
      .single();

    const bonusPoints = parseInt(configData?.value || '50');

    // Award points to REFERRER
    await awardPoints(referral.referrer_id, bonusPoints, 'referral_bonus', {
      referral_id: referral.id,
      referee_id: userId,
      trade_id: tradeId,
      description: `Referral bonus for inviting new user`,
    });

    // Award points to REFEREE
    await awardPoints(userId, bonusPoints, 'referral_bonus', {
      referral_id: referral.id,
      referrer_id: referral.referrer_id,
      trade_id: tradeId,
      description: `Referral bonus for completing first trade`,
    });

    // Update referral status to 'completed'
    const { error: updateError } = await supabase
      .from('referrals')
      .update({
        status: 'completed',
        points_awarded: bonusPoints * 2, // Total points awarded (50 + 50)
        completed_at: new Date().toISOString(),
      })
      .eq('id', referral.id);

    if (updateError) throw updateError;

    // Send notification to REFERRER
    await sendNotification(referral.referrer_id, {
      type: 'referral_bonus',
      title: '🎉 Referral Bonus!',
      body: `You earned ${bonusPoints} points! Your friend completed their first trade.`,
      data: {
        referral_id: referral.id,
        points: bonusPoints,
      },
    });

    // Send notification to REFEREE
    await sendNotification(userId, {
      type: 'referral_bonus',
      title: '🎉 Referral Bonus!',
      body: `You earned ${bonusPoints} points for completing your first trade!`,
      data: {
        referral_id: referral.id,
        points: bonusPoints,
      },
    });

    // Track analytics event
    trackEvent('referral_bonus_awarded', {
      referral_id: referral.id,
      referrer_id: referral.referrer_id,
      referee_id: userId,
      trade_id: tradeId,
      points_awarded: bonusPoints * 2,
    });

    return { success: true };

  } catch (error: any) {
    console.error('Process referral bonus error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Award points to a user
 */
const awardPoints = async (
  userId: string,
  points: number,
  type: string,
  metadata: any
): Promise<void> => {
  try {
    // Create points transaction
    await supabase.from('points_transactions').insert({
      user_id: userId,
      amount: points,
      type: type,
      description: metadata.description,
      reference_id: metadata.trade_id || metadata.referral_id,
      metadata: metadata,
    });

    // Update user's points balance
    await supabase.rpc('increment_user_points', {
      user_id: userId,
      points_to_add: points,
    });

  } catch (error) {
    console.error('Award points error:', error);
    throw error;
  }
};

/**
 * Send notification to user
 */
const sendNotification = async (
  userId: string,
  notification: {
    type: string;
    title: string;
    body: string;
    data: any;
  }
): Promise<void> => {
  try {
    // Get user's push token
    const { data: user } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .single();

    if (!user?.push_token) {
      console.log('No push token for user:', userId);
      return;
    }

    // Send push notification via Expo
    const message = {
      to: user.push_token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data,
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    // Also create in-app notification
    await supabase.from('notifications').insert({
      user_id: userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      read: false,
    });

  } catch (error) {
    console.error('Send notification error:', error);
  }
};

/*
==================================================
FILE 2: Add increment_user_points function to database
==================================================
*/

-- filepath: supabase/migrations/005_increment_user_points.sql

-- Function to increment user's points balance
CREATE OR REPLACE FUNCTION increment_user_points(user_id UUID, points_to_add INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET points_balance = points_balance + points_to_add
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

/*
==================================================
FILE 3: Call processReferralBonus after trade completion
==================================================
In your trade completion logic (future module), add:
*/

// After trade is marked as 'completed':
import { processReferralBonus } from '@/services/referrals';

// Check if this is the buyer's first trade
const { data: buyerTrades } = await supabase
  .from('trades')
  .select('id')
  .or(`buyer_id.eq.${buyerId},seller_id.eq.${buyerId}`)
  .eq('status', 'completed');

if (buyerTrades?.length === 1) {
  // This is buyer's first completed trade - process referral bonus
  await processReferralBonus(buyerId, tradeId);
}

// Check if this is the seller's first trade
const { data: sellerTrades } = await supabase
  .from('trades')
  .select('id')
  .or(`buyer_id.eq.${sellerId},seller_id.eq.${sellerId}`)
  .eq('status', 'completed');

if (sellerTrades?.length === 1) {
  // This is seller's first completed trade - process referral bonus
  await processReferralBonus(sellerId, tradeId);
}

/*
==================================================
VERIFICATION STEPS
==================================================

1. User A signs up without referral code (generates code: "ABC12XYZ")
2. User B signs up with User A's referral code:
   - Check referrals table: status='pending', points_awarded=0
3. User B lists an item
4. User C buys User B's item
5. Mark trade as completed
6. Verify:
   - User A receives 50 points (points_balance updated)
   - User B receives 50 points (points_balance updated)
   - Referral status updated to 'completed'
   - points_transactions table has 2 new records
   - Both users receive push notification
   - notifications table has 2 new records
7. User B completes second trade:
   - Verify NO additional referral bonus (only first trade)
8. Check analytics event: referral_bonus_awarded

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Referral bonus triggered on first trade completion
✓ 50 points awarded to referrer
✓ 50 points awarded to referee
✓ Referral status updated to 'completed'
✓ points_transactions records created
✓ User points_balance updated
✓ Push notifications sent to both users
✓ In-app notifications created
✓ Bonus only awarded once (first trade only)
✓ Analytics event tracked
✓ Error handling implemented

==================================================
TROUBLESHOOTING
==================================================

Error: "No pending referral found"
- Solution: User didn't use referral code during signup

Error: "Not first trade"
- Solution: User already completed trades, bonus already awarded

Error: "Failed to update points balance"
- Solution: Check increment_user_points function exists

Issue: Notification not received
- Solution: Check user has valid push_token registered

==================================================
NEXT STEPS
==================================================

After referral bonus logic complete:
1. Module 02 (Authentication) is COMPLETE! ✅
2. Create verification report for AUTH module
3. Proceed to Module 03 (Item Management)
*/
```

---

### Acceptance Criteria

- [ ] Referral bonus triggered on first trade
- [ ] 50 points awarded to referrer
- [ ] 50 points awarded to referee
- [ ] Referral status updated to 'completed'
- [ ] points_transactions created
- [ ] User points_balance updated
- [ ] Push notifications sent
- [ ] In-app notifications created
- [ ] Bonus only awarded once
- [ ] Analytics event tracked
- [ ] Error handling implemented

---

### Output Files

- `src/services/referrals.ts`
- `supabase/migrations/005_increment_user_points.sql`
- Integration with trade completion logic (future module)

---

### Common Issues

| Issue | Solution |
|-------|----------|
| No pending referral found | User didn't use referral code during signup |
| Not first trade | Bonus already awarded for previous trade |
| Failed to update points | Check increment_user_points function exists |
| Notification not received | Check user has valid push_token |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create referral bonus service | 40 min |
| Implement points awarding logic | 25 min |
| Create database function | 15 min |
| Implement notifications | 20 min |
| Add analytics tracking | 10 min |
| Test and troubleshoot | 30 min |
| **Total** | **~2 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** Create MODULE-02-VERIFICATION.md

---

## Module 02 Summary

### Total Tasks: 11

| Task ID | Task Name | Duration | Status |
|---------|-----------|----------|--------|
| AUTH-001 | Supabase Auth Signup Flow | 4 hours | ⏸️ Ready |
| AUTH-002 | Phone Verification via AWS SNS | 6 hours | ⏸️ Ready |
| AUTH-003 | SMS Rate Limiting (Admin Config) | 1.5 hours | ⏸️ Ready |
| AUTH-004 | Age Verification (Deferred) | N/A | ⏸️ Deferred |
| AUTH-005 | User Profile Creation | 3 hours | ⏸️ Ready |
| AUTH-006 | User Profile Editing | 2.5 hours | ⏸️ Ready |
| AUTH-007 | User Logout | 1 hour | ⏸️ Ready |
| AUTH-008 | Forgot Password Flow | 2 hours | ⏸️ Ready |
| AUTH-009 | Onboarding Screens | 3 hours | ⏸️ Ready |
| AUTH-010 | Referral Code Entry | 1.5 hours | ⏸️ Ready |
| AUTH-011 | Referral Bonus Logic | 2 hours | ⏸️ Ready |
| **TOTAL** | **11 tasks** | **~26.5 hours** | **Complete** |

### Key Deliverables

**Mobile App Screens:**
- ✅ Signup screen with form validation
- ✅ Phone verification screen with SMS codes
- ✅ Profile creation screen with avatar upload
- ✅ Edit profile screen
- ✅ Settings screen with logout
- ✅ Forgot password screen
- ✅ Reset password screen
- ✅ Welcome screen (onboarding)
- ✅ Location picker screen (onboarding)
- ✅ Node selection screen (onboarding)
- ✅ Feature highlights carousel (onboarding)

**Backend Services:**
- ✅ Supabase Auth integration (signup, login, logout, password reset)
- ✅ AWS SNS SMS sending service
- ✅ Phone verification code generation and validation
- ✅ SMS rate limiting service
- ✅ Avatar upload to Supabase Storage
- ✅ ZIP code lookup and node assignment
- ✅ Referral code generation and validation
- ✅ Referral bonus awarding logic
- ✅ Points transaction system

**Database Migrations:**
- ✅ phone_verification_codes table
- ✅ phone_verified fields on users table
- ✅ get_nearest_node function (PostGIS)
- ✅ referral_code column on users table
- ✅ increment_user_points function

**Admin Panel:**
- ✅ SMS rate limit configuration page
- ✅ SMS statistics dashboard

### Authentication Flow Complete

```
Signup → Phone Verification → Profile Creation → Onboarding → Home
   ↓
Referral Code (optional)
   ↓
First Trade Completion → Referral Bonus (50 points to both users)
```

### Next Steps

1. ✅ Create MODULE-02-VERIFICATION.md
2. ⏸️ Proceed to Module 03: Item Management (listing, browsing, searching)
3. ⏸️ Modules 04-15 pending

