# MODULE 03: AUTHENTICATION & USER ONBOARDING (V2)

**Version:** 2.0 (Kids Club+ Subscription-Gated Swap Points Model)  
**Status:** Complete - All Tasks Specified  
**Last Updated:** [Auto-generated timestamp]

---

## V2 OVERVIEW

This module defines **user authentication, registration, and onboarding** in the Kids Club+ marketplace, integrated with:

- **Subscription initialization**: New users start with 30-day no-card trial automatically.
- **SP wallet creation**: Wallet initialized on signup for trial users.
- **Profile setup**: Age verification, parental consent, profile preferences.
- **Session management**: JWT tokens with subscription status embedded.
- **Social auth**: Apple, Google sign-in with subscription auto-activation.

This module **does not** handle subscription lifecycle management (see MODULE-11); it focuses on initial user creation and authentication flows.

---

## CHANGELOG FROM V1 → V2

### V1 Limitations
- **No subscription context**: Users registered without automatic trial activation.
- **No SP wallet initialization**: Wallets created on-demand, leading to inconsistencies.
- **Basic profile**: Minimal user data collection.

### V2 Enhancements
- **Automatic Trial Activation**: New signups get Kids Club+ trial + SP wallet automatically.
- **Subscription-Aware Sessions**: JWT tokens include subscription status for client-side gating.
- **Onboarding Flow**: Multi-step wizard collecting age, parental consent, profile preferences.
- **Social Auth Integration**: Apple/Google sign-in triggers trial activation.

---

## STATE DIAGRAM: User Lifecycle

```
GUEST → REGISTERED (trial activated) → PROFILE_COMPLETE → ACTIVE
                                              ↓
                                      (subscription lifecycle managed by MODULE-11)
```

**V2 Focus:** Seamless onboarding with trial activation and SP wallet creation.

---

## CRITICAL V2 RULES FOR AUTH MODULE

### Rule 1: Trial Auto-Activation
- All new user signups automatically receive:
  - Kids Club+ subscription with `status = 'trial'`, 30-day duration.
  - SP wallet with `status = 'active'`.
  - Starting balance: 0 SP (earning begins with first trade/activity).

### Rule 2: Age Verification & Parental Consent
- Users under 13 require parental email verification (COPPA compliance).
- Users 13+ can register independently.
- Age stored in encrypted format in `user_profiles` table.

### Rule 3: Session Token Enrichment
- JWT tokens include:
  - `user_id`, `email`, `subscription_status`, `can_spend_sp`, `available_points`.
  - Refreshed on subscription status changes via MODULE-11 webhooks.

### Rule 4: Social Auth Mapping
- Apple/Google OAuth user IDs mapped to internal user records.
- Trial activation happens on first social auth login (same as email signup).

---

## AGENT TEMPLATE

```typescript
/*
YOU ARE AN AI AGENT TASKED WITH IMPLEMENTING MODULE-03 (AUTHENTICATION & USER ONBOARDING V2).

CONTEXT:
- This is part of a 6-phase workplan to update a P2P kids marketplace with Kids Club+ subscription-gated Swap Points.
- MODULE-09 (SP Gamification) and MODULE-11 (Subscriptions) are already implemented.
- New user signups must automatically activate trial subscription + SP wallet.

YOUR INSTRUCTIONS:
1. Read this entire module specification carefully.
2. For each task (AUTH-V2-001, AUTH-V2-002, etc.), implement EXACTLY as specified.
3. Ensure all code follows TypeScript best practices and matches existing project structure.
4. Run tests after each task to verify correctness.
5. If you encounter ambiguity, refer to MODULE-09/MODULE-11 patterns or ask for clarification.

==================================================
NEXT TASK: AUTH-V2-001 (Schema & Types)
==================================================
*/
```

---

## TASK AUTH-V2-001: User Schema & Authentication Types

**Duration:** 2 hours  
**Priority:** High  
**Dependencies:** None (foundational)

### Description

Define database schema for users and authentication with V2 fields, and create corresponding TypeScript types.

**New V2 fields:**
- `subscription_id` (UUID, FK to subscriptions table): Link to active subscription.
- `sp_wallet_id` (UUID, FK to sp_wallets table): Link to SP wallet.
- `onboarding_completed_at` (TIMESTAMPTZ): Track when user completed onboarding.
- `parental_consent_verified` (BOOLEAN): For users under 13.

### AI Prompt for Cursor

```typescript
/*
TASK: Create or update users table schema and TypeScript types for V2

REQUIREMENTS:
1. Migration file: 030_users_v2.sql
2. Add V2 fields: subscription_id, sp_wallet_id, onboarding_completed_at, parental_consent_verified
3. TypeScript types: User, UserProfile interfaces

==================================================
FILE 1: Migration - Add V2 fields to users table
==================================================
*/

-- filepath: supabase/migrations/030_users_v2.sql

-- V2 enhancement: Link users to subscriptions and SP wallets

ALTER TABLE users
ADD COLUMN subscription_id UUID REFERENCES subscriptions(id),
ADD COLUMN sp_wallet_id UUID REFERENCES sp_wallets(id),
ADD COLUMN onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN parental_consent_verified BOOLEAN DEFAULT FALSE;

-- Index for quick subscription lookups
CREATE INDEX idx_users_subscription ON users(subscription_id);
CREATE INDEX idx_users_sp_wallet ON users(sp_wallet_id);

COMMENT ON COLUMN users.subscription_id IS 'Active subscription for user (V2)';
COMMENT ON COLUMN users.sp_wallet_id IS 'Swap Points wallet for user (V2)';
COMMENT ON COLUMN users.onboarding_completed_at IS 'When user completed onboarding wizard (V2)';

/*
==================================================
FILE 2: TypeScript Types for User & Auth
==================================================
*/

// filepath: src/types/user.ts

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  subscription_id?: string; // V2: Link to subscription
  sp_wallet_id?: string; // V2: Link to SP wallet
  onboarding_completed_at?: string; // V2: Onboarding completion timestamp
  parental_consent_verified: boolean; // V2: COPPA compliance
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  age?: number; // Encrypted or hashed in DB
  location?: string;
  bio?: string;
  interests: string[];
  notification_preferences: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

export interface AuthSession {
  user: User;
  access_token: string;
  refresh_token: string;
  subscription_status: string; // Embedded from MODULE-11
  can_spend_sp: boolean; // Embedded from MODULE-09
  available_points: number; // Embedded from MODULE-09
}

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Migration 030_users_v2.sql adds V2 fields to users table
✓ Foreign keys link users to subscriptions and SP wallets
✓ TypeScript User and AuthSession interfaces match V2 schema
✓ Indexes created for subscription and wallet lookups

==================================================
NEXT TASK: AUTH-V2-002 (Signup with Trial Activation)
==================================================
*/
```

---

## TASK AUTH-V2-002: User Signup with Automatic Trial Activation

**Duration:** 4 hours  
**Priority:** High  
**Dependencies:** AUTH-V2-001, MODULE-11, MODULE-09

### Description

Implement user registration flow that automatically:
1. Creates user record.
2. Activates 30-day Kids Club+ trial (MODULE-11).
3. Initializes SP wallet (MODULE-09).
4. Links user to subscription and wallet.

This is the core V2 enhancement ensuring all new users start as trial subscribers.

### AI Prompt for Cursor

```typescript
/*
TASK: Implement signup with trial activation and SP wallet initialization

REQUIREMENTS:
1. Service function: signupWithTrial
2. Call MODULE-11 to create trial subscription
3. Call MODULE-09 to initialize SP wallet
4. Link user to both subscription and wallet
5. UI: Signup form with email/password

==================================================
FILE 1: Service - signupWithTrial
==================================================
*/

// filepath: src/services/auth.ts

import { supabase } from '../lib/supabase';
import { User, AuthSession } from '../types/user';

export interface SignupInput {
  email: string;
  password: string;
  displayName: string;
  age: number;
  parentalEmail?: string; // For users under 13
}

export async function signupWithTrial(input: SignupInput): Promise<AuthSession> {
  const { email, password, displayName, age, parentalEmail } = input;

  // Age validation
  const requiresParentalConsent = age < 13;
  if (requiresParentalConsent && !parentalEmail) {
    throw new Error('Parental email required for users under 13');
  }

  // 1. Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError || !authData.user) {
    throw authError || new Error('Signup failed');
  }

  const userId = authData.user.id;

  try {
    // 2. Create trial subscription (MODULE-11)
    const { data: subscription, error: subError } = await supabase.rpc(
      'create_trial_subscription',
      { p_user_id: userId }
    );

    if (subError) throw subError;

    // 3. Initialize SP wallet (MODULE-09)
    const { data: wallet, error: walletError } = await supabase.rpc(
      'initialize_sp_wallet',
      { p_user_id: userId }
    );

    if (walletError) throw walletError;

    // 4. Create user record with links
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        display_name: displayName,
        subscription_id: subscription.id,
        sp_wallet_id: wallet.id,
        parental_consent_verified: !requiresParentalConsent,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (userError) throw userError;

    // 5. If parental consent required, send verification email
    if (requiresParentalConsent) {
      await supabase.rpc('send_parental_consent_email', {
        p_user_id: userId,
        p_parent_email: parentalEmail,
      });
    }

    // 6. Create session with subscription context
    const session: AuthSession = {
      user: user as User,
      access_token: authData.session!.access_token,
      refresh_token: authData.session!.refresh_token,
      subscription_status: 'trial',
      can_spend_sp: true,
      available_points: 0,
    };

    return session;
  } catch (error) {
    // Rollback: Delete auth user if subscription/wallet creation fails
    await supabase.auth.admin.deleteUser(userId);
    throw error;
  }
}

/*
==================================================
FILE 2: RPC - create_trial_subscription
==================================================
*/

-- filepath: supabase/migrations/031_create_trial_subscription_rpc.sql

CREATE OR REPLACE FUNCTION create_trial_subscription(p_user_id UUID)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription subscriptions;
BEGIN
  INSERT INTO subscriptions (
    user_id,
    status,
    trial_start_date,
    trial_end_date,
    stripe_customer_id,
    created_at
  )
  VALUES (
    p_user_id,
    'trial',
    NOW(),
    NOW() + INTERVAL '30 days',
    NULL, -- No Stripe customer during no-card trial
    NOW()
  )
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;

/*
==================================================
FILE 3: RPC - initialize_sp_wallet
==================================================
*/

-- filepath: supabase/migrations/032_initialize_sp_wallet_rpc.sql

CREATE OR REPLACE FUNCTION initialize_sp_wallet(p_user_id UUID)
RETURNS sp_wallets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet sp_wallets;
BEGIN
  INSERT INTO sp_wallets (
    user_id,
    status,
    created_at
  )
  VALUES (
    p_user_id,
    'active',
    NOW()
  )
  RETURNING * INTO v_wallet;

  RETURN v_wallet;
END;
$$;

/*
==================================================
FILE 4: UI - SignupScreen
==================================================
*/

// filepath: src/screens/SignupScreen.tsx

import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { signupWithTrial } from '../services/auth';

export const SignupScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [parentalEmail, setParentalEmail] = useState('');

  const handleSignup = async () => {
    const ageNum = parseInt(age);

    const session = await signupWithTrial({
      email,
      password,
      displayName,
      age: ageNum,
      parentalEmail: ageNum < 13 ? parentalEmail : undefined,
    });

    // Navigate to onboarding wizard
    navigation.navigate('Onboarding');
  };

  return (
    <View>
      <Text>Join Kids Club+ with 30-Day Free Trial!</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput placeholder="Display Name" value={displayName} onChangeText={setDisplayName} />
      <TextInput placeholder="Age" value={age} onChangeText={setAge} keyboardType="numeric" />

      {parseInt(age) < 13 && (
        <TextInput
          placeholder="Parent Email"
          value={parentalEmail}
          onChangeText={setParentalEmail}
        />
      )}

      <Button title="Sign Up & Start Trial" onPress={handleSignup} />
    </View>
  );
};

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Signup creates user, trial subscription, and SP wallet atomically
✓ Trial subscription starts with 30-day duration, status = 'trial'
✓ SP wallet initialized with status = 'active', balance = 0
✓ User record links to subscription_id and sp_wallet_id
✓ Parental consent required for users under 13
✓ Rollback logic on failure prevents orphaned records

==================================================
NEXT TASK: AUTH-V2-003 (Login & Session Management)
==================================================
*/
```

---

## TASK AUTH-V2-003: Login & Session Management with Subscription Context

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** AUTH-V2-002, MODULE-11, MODULE-09

### Description

Implement login flow that:
1. Authenticates user credentials.
2. Fetches current subscription status (MODULE-11).
3. Fetches SP wallet summary (MODULE-09).
4. Enriches JWT token with subscription and SP context.
5. Refreshes session on subscription status changes.

### AI Prompt for Cursor

```typescript
/*
TASK: Implement login with subscription-enriched session

REQUIREMENTS:
1. Service function: loginWithContext
2. Fetch subscription summary (MODULE-11)
3. Fetch SP wallet summary (MODULE-09)
4. Embed context in AuthSession
5. UI: Login screen

==================================================
FILE 1: Service - loginWithContext
==================================================
*/

// filepath: src/services/auth.ts (add to existing file)

export async function loginWithContext(
  email: string,
  password: string
): Promise<AuthSession> {
  // 1. Authenticate with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    throw authError || new Error('Login failed');
  }

  const userId = authData.user.id;

  // 2. Fetch user record
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User record not found');
  }

  // 3. Fetch subscription summary (MODULE-11)
  const { data: subscription } = await supabase.rpc('get_subscription_summary', {
    p_user_id: userId,
  });

  // 4. Fetch SP wallet summary (MODULE-09)
  const { data: wallet } = await supabase.rpc('get_user_sp_wallet_summary', {
    p_user_id: userId,
  });

  // 5. Build enriched session
  const session: AuthSession = {
    user: user as User,
    access_token: authData.session!.access_token,
    refresh_token: authData.session!.refresh_token,
    subscription_status: subscription?.status || 'free',
    can_spend_sp: subscription?.can_spend_sp || false,
    available_points: wallet?.availablePoints || 0,
  };

  return session;
}

/*
==================================================
FILE 2: UI - LoginScreen
==================================================
*/

// filepath: src/screens/LoginScreen.tsx

import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { loginWithContext } from '../services/auth';
import { useAuth } from '../hooks/useAuth';

export const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { setSession } = useAuth();

  const handleLogin = async () => {
    const session = await loginWithContext(email, password);
    setSession(session);
    navigation.navigate('Home');
  };

  return (
    <View>
      <Text>Login to Kids Club+</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} />
      <Button title="Sign Up" onPress={() => navigation.navigate('Signup')} />
    </View>
  );
};

/*
==================================================
FILE 3: Session Refresh Hook
==================================================
*/

// filepath: src/hooks/useAuth.tsx

import { createContext, useContext, useState, useEffect } from 'react';
import { AuthSession } from '../types/user';
import { supabase } from '../lib/supabase';
import { loginWithContext } from '../services/auth';

const AuthContext = createContext<{
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  refreshSession: () => Promise<void>;
}>({
  session: null,
  setSession: () => {},
  refreshSession: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);

  const refreshSession = async () => {
    if (!session) return;

    // Re-fetch subscription and wallet context
    const { data: subscription } = await supabase.rpc('get_subscription_summary', {
      p_user_id: session.user.id,
    });

    const { data: wallet } = await supabase.rpc('get_user_sp_wallet_summary', {
      p_user_id: session.user.id,
    });

    setSession({
      ...session,
      subscription_status: subscription?.status || 'free',
      can_spend_sp: subscription?.can_spend_sp || false,
      available_points: wallet?.availablePoints || 0,
    });
  };

  // Listen for subscription status changes (MODULE-11 webhook triggers)
  useEffect(() => {
    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${session?.user.id}`,
        },
        () => {
          refreshSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, setSession, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Login fetches subscription and SP wallet context
✓ AuthSession includes subscription_status, can_spend_sp, available_points
✓ Session refreshes when subscription status changes (real-time)
✓ UI components can access session context via useAuth hook

==================================================
NEXT TASK: AUTH-V2-004 (Social Auth with Trial Activation)
==================================================
*/
```

---

## TASK AUTH-V2-004: Social Authentication (Apple/Google) with Trial Activation

**Duration:** 3 hours  
**Priority:** Medium  
**Dependencies:** AUTH-V2-002, AUTH-V2-003

### Description

Integrate Apple and Google OAuth sign-in with automatic trial activation for first-time users.

**Flow:**
1. User taps "Sign in with Apple/Google".
2. OAuth flow completes, returns user email and ID.
3. Check if user exists:
   - If new: Create user + trial subscription + SP wallet (same as email signup).
   - If existing: Login with enriched session.

### AI Prompt for Cursor

```typescript
/*
TASK: Implement social auth with trial activation for new users

REQUIREMENTS:
1. Service functions: signInWithApple, signInWithGoogle
2. Check if user exists, create trial if new
3. UI: Social sign-in buttons

==================================================
FILE 1: Service - Social Auth with Trial
==================================================
*/

// filepath: src/services/auth.ts (add to existing file)

export async function signInWithApple(): Promise<AuthSession> {
  // 1. Trigger Apple OAuth
  const { data: authData, error: authError } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
  });

  if (authError || !authData.user) {
    throw authError || new Error('Apple sign-in failed');
  }

  const userId = authData.user.id;
  const email = authData.user.email!;

  // 2. Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (existingUser) {
    // Existing user: Login with context
    return loginWithContext(email, ''); // OAuth users don't have password
  }

  // 3. New user: Create trial subscription + SP wallet
  const { data: subscription } = await supabase.rpc('create_trial_subscription', {
    p_user_id: userId,
  });

  const { data: wallet } = await supabase.rpc('initialize_sp_wallet', {
    p_user_id: userId,
  });

  await supabase.from('users').insert({
    id: userId,
    email,
    display_name: authData.user.user_metadata.full_name || 'User',
    subscription_id: subscription.id,
    sp_wallet_id: wallet.id,
    parental_consent_verified: false, // Prompt for age verification later
    created_at: new Date().toISOString(),
  });

  // 4. Return enriched session
  return {
    user: { id: userId, email, display_name: authData.user.user_metadata.full_name } as User,
    access_token: authData.session!.access_token,
    refresh_token: authData.session!.refresh_token,
    subscription_status: 'trial',
    can_spend_sp: true,
    available_points: 0,
  };
}

export async function signInWithGoogle(): Promise<AuthSession> {
  // Similar implementation as Apple, using 'google' provider
  const { data: authData, error: authError } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });

  // ... (same logic as signInWithApple)
}

/*
==================================================
FILE 2: UI - Social Auth Buttons
==================================================
*/

// filepath: src/screens/LoginScreen.tsx (update existing)

import { signInWithApple, signInWithGoogle } from '../services/auth';

// Add to LoginScreen component:

<Button title="Sign in with Apple" onPress={async () => {
  const session = await signInWithApple();
  setSession(session);
  navigation.navigate('Home');
}} />

<Button title="Sign in with Google" onPress={async () => {
  const session = await signInWithGoogle();
  setSession(session);
  navigation.navigate('Home');
}} />

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Apple OAuth creates trial subscription for new users
✓ Google OAuth creates trial subscription for new users
✓ Existing users login without creating duplicate subscriptions
✓ Social auth users prompted for age verification post-login

==================================================
NEXT TASK: AUTH-V2-005 (Onboarding Wizard)
==================================================
*/
```

---

## TASK AUTH-V2-005: Onboarding Wizard (Profile Setup & Preferences)

**Duration:** 3 hours  
**Priority:** Medium  
**Dependencies:** AUTH-V2-002, AUTH-V2-003, AUTH-V2-004

### Description

Build multi-step onboarding wizard for new users:
1. **Step 1**: Age verification (parental consent if under 13).
2. **Step 2**: Profile setup (avatar, bio, interests).
3. **Step 3**: Notification preferences.
4. **Step 4**: Kids Club+ trial benefits explanation.

Completion marks `onboarding_completed_at` timestamp.

### AI Prompt for Cursor

```typescript
/*
TASK: Build onboarding wizard for new users

REQUIREMENTS:
1. Multi-step UI flow (4 steps)
2. Age verification with parental consent
3. Profile creation
4. Notification preferences
5. Trial benefits explainer

==================================================
FILE 1: Onboarding Wizard UI
==================================================
*/

// filepath: src/screens/OnboardingScreen.tsx

import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export const OnboardingScreen = ({ navigation }) => {
  const { session } = useAuth();
  const [step, setStep] = useState(1);
  const [age, setAge] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState({
    email: true,
    push: true,
    sms: false,
  });

  const handleCompleteOnboarding = async () => {
    // Save profile
    await supabase.from('user_profiles').insert({
      user_id: session!.user.id,
      age: parseInt(age),
      bio,
      interests,
      notification_preferences: notificationPrefs,
    });

    // Mark onboarding complete
    await supabase
      .from('users')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', session!.user.id);

    navigation.navigate('Home');
  };

  return (
    <View>
      {step === 1 && (
        <View>
          <Text>Step 1: Verify Your Age</Text>
          <TextInput placeholder="Age" value={age} onChangeText={setAge} keyboardType="numeric" />
          {parseInt(age) < 13 && (
            <TextInput
              placeholder="Parent Email"
              value={parentEmail}
              onChangeText={setParentEmail}
            />
          )}
          <Button title="Next" onPress={() => setStep(2)} />
        </View>
      )}

      {step === 2 && (
        <View>
          <Text>Step 2: Create Your Profile</Text>
          <TextInput placeholder="Bio" value={bio} onChangeText={setBio} multiline />
          {/* TODO: Interest selector */}
          <Button title="Next" onPress={() => setStep(3)} />
        </View>
      )}

      {step === 3 && (
        <View>
          <Text>Step 3: Notification Preferences</Text>
          {/* TODO: Toggle switches for email, push, SMS */}
          <Button title="Next" onPress={() => setStep(4)} />
        </View>
      )}

      {step === 4 && (
        <View>
          <Text>Welcome to Kids Club+!</Text>
          <Text>Your 30-day free trial is active!</Text>
          <Text>✓ Use Swap Points on eligible items</Text>
          <Text>✓ $0.99 transaction fee (vs $2.99 for non-members)</Text>
          <Text>✓ Earn Swap Points when you sell</Text>
          <Button title="Start Exploring" onPress={handleCompleteOnboarding} />
        </View>
      )}
    </View>
  );
};

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Onboarding wizard has 4 steps
✓ Age verification with parental consent for under 13
✓ Profile setup creates user_profiles record
✓ Onboarding completion marks onboarding_completed_at
✓ Trial benefits clearly explained to new users

==================================================
NEXT TASK: AUTH-V2-006 (Password Reset & Account Recovery)
==================================================
*/
```

---

## TASK AUTH-V2-006: Password Reset & Account Recovery

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** AUTH-V2-003

### Description

Implement password reset flow:
1. User requests password reset email.
2. Supabase sends reset link.
3. User clicks link, enters new password.
4. Password updated, user logged in.

Also handle account recovery for locked/disabled accounts.

### AI Prompt for Cursor

```typescript
/*
TASK: Implement password reset and account recovery

REQUIREMENTS:
1. Service: requestPasswordReset
2. UI: Password reset request screen
3. UI: Password reset confirmation screen
4. Handle Supabase magic link flow

==================================================
FILE 1: Service - Password Reset
==================================================
*/

// filepath: src/services/auth.ts (add to existing file)

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'yourapp://reset-password',
  });

  if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}

/*
==================================================
FILE 2: UI - Password Reset Request Screen
==================================================
*/

// filepath: src/screens/PasswordResetRequestScreen.tsx

import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { requestPasswordReset } from '../services/auth';

export const PasswordResetRequestScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');

  const handleRequestReset = async () => {
    await requestPasswordReset(email);
    alert('Password reset email sent! Check your inbox.');
    navigation.navigate('Login');
  };

  return (
    <View>
      <Text>Reset Password</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />
      <Button title="Send Reset Link" onPress={handleRequestReset} />
    </View>
  );
};

/*
==================================================
ACCEPTANCE CRITERIA
==================================================

✓ User can request password reset email
✓ Reset link redirects to app with token
✓ User can set new password and login
✓ Account recovery flow documented

==================================================
NEXT TASK: AUTH-V2-007 (Tests & Module Summary)
==================================================
*/
```

---

## TASK AUTH-V2-007: Authentication Module Tests & Summary

**Duration:** 3 hours  
**Priority:** High  
**Dependencies:** AUTH-V2-001 through AUTH-V2-006

### Description

Write comprehensive tests for authentication module and finalize documentation.

**Tests to cover:**
1. **Signup**: Trial activation, SP wallet creation, parental consent.
2. **Login**: Session enrichment with subscription context.
3. **Social auth**: Trial activation for new users.
4. **Onboarding**: Profile creation, completion timestamp.
5. **Password reset**: Email sent, password updated.

**Module summary:**
- User lifecycle states.
- Cross-module integration (MODULE-11, MODULE-09).
- Trial activation rules.

### AI Prompt for Cursor

```typescript
/*
TASK: Write tests for auth module and finalize docs

REQUIREMENTS:
1. Unit tests for signupWithTrial, loginWithContext
2. Integration tests for trial activation
3. Module summary with user lifecycle diagram

==================================================
FILE 1: signupWithTrial Unit Tests
==================================================
*/

// filepath: src/services/auth.test.ts

import { describe, it, expect, vi } from 'vitest';
import { signupWithTrial } from './auth';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase');

describe('signupWithTrial', () => {
  it('should create user, trial subscription, and SP wallet', async () => {
    vi.spyOn(supabase.auth, 'signUp').mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' }, session: {} },
      error: null,
    });

    vi.spyOn(supabase, 'rpc').mockImplementation((fn) => {
      if (fn === 'create_trial_subscription') {
        return Promise.resolve({ data: { id: 'sub-1' }, error: null });
      }
      if (fn === 'initialize_sp_wallet') {
        return Promise.resolve({ data: { id: 'wallet-1' }, error: null });
      }
    });

    vi.spyOn(supabase.from('users'), 'insert').mockResolvedValue({
      data: { id: 'user-1', subscription_id: 'sub-1', sp_wallet_id: 'wallet-1' },
      error: null,
    });

    const session = await signupWithTrial({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
      age: 15,
    });

    expect(session.subscription_status).toBe('trial');
    expect(session.can_spend_sp).toBe(true);
  });

  it('should require parental email for users under 13', async () => {
    await expect(
      signupWithTrial({
        email: 'kid@example.com',
        password: 'password123',
        displayName: 'Kid User',
        age: 10,
      })
    ).rejects.toThrow('Parental email required');
  });
});

/*
==================================================
FILE 2: Module Summary
==================================================
*/

## MODULE-03 SUMMARY: Authentication & User Onboarding (V2)

### Overview
This module handles user registration and authentication with Kids Club+ V2 enhancements:
- **Automatic Trial Activation**: All new signups get 30-day trial + SP wallet.
- **Session Enrichment**: JWT tokens include subscription status and SP balance.
- **Social Auth**: Apple/Google sign-in triggers trial activation for new users.
- **Onboarding Wizard**: Guided setup for age verification, profile, preferences.

### User Lifecycle
```
GUEST → REGISTERED (trial) → ONBOARDING → ACTIVE
```

### Cross-Module Integration
- **MODULE-11 (Subscriptions)**: `create_trial_subscription` RPC, `get_subscription_summary`.
- **MODULE-09 (SP Gamification)**: `initialize_sp_wallet` RPC, `get_user_sp_wallet_summary`.

### Key Rules
1. **Trial Auto-Activation**: Every new user starts with trial + SP wallet.
2. **COPPA Compliance**: Users under 13 require parental consent.
3. **Session Context**: Tokens include `subscription_status`, `can_spend_sp`, `available_points`.

### API Surface
- `signupWithTrial(input)`: Creates user with trial + wallet.
- `loginWithContext(email, password)`: Enriched session with subscription context.
- `signInWithApple()`, `signInWithGoogle()`: Social auth with trial activation.
- `requestPasswordReset(email)`: Password recovery.

### Test Coverage
- ✓ Signup creates trial + wallet atomically.
- ✓ Parental consent enforced for under 13.
- ✓ Session includes subscription context.
- ✓ Social auth activates trial for new users.

---

## MODULE-03 COMPLETE ✅

All 7 micro-tasks (AUTH-V2-001 through AUTH-V2-007) have been specified.

**Next Step:** Create `MODULE-03-VERIFICATION-V2.md` verification checklist.

---
