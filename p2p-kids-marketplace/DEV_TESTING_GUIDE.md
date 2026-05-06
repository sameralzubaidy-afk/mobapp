# Development Testing Services - Usage Guide

## Overview

This guide explains how to use the development testing services for bypassing OTP verification and creating dummy users for testing.

**⚠️ IMPORTANT**: These services only work in development/test environments and will throw errors in production.

---

## 1. OTP Bypass Service

### Quick Start

The OTP bypass is **automatically enabled** in development. Just use code `123456` during phone verification and it will bypass the SMS check.

### Usage in App

```typescript
import { verifyPhoneCode } from '@/services/verification';

// During phone verification flow
const result = await verifyPhoneCode(userId, phoneNumber, '123456');

if (result.success) {
  console.log('✅ Phone verified (bypassed in dev)');
}
```

### Manual Bypass

If you need to manually bypass OTP verification for a user:

```typescript
import { bypassOTPVerification } from '@/services/devTestingService';

const result = await bypassOTPVerification(userId, '+15551234567');

if (result.success) {
  console.log('✅ Phone verification bypassed');
}
```

### Check Bypass Configuration

```typescript
import { getOTPBypassConfig, logDevTestingConfig } from '@/services/devTestingService';

// Check if bypass is enabled
const config = getOTPBypassConfig();
console.log('OTP Bypass enabled:', config.enabled);
console.log('Test code:', config.testCode); // '123456'

// Log full configuration
logDevTestingConfig();
```

---

## 2. Dummy User Creation

### CLI Tool (Recommended)

The easiest way to create test users is via the CLI script:

```bash
# Navigate to app directory
cd p2p-kids-marketplace

# Load environment variables
export $(cat .env.local | xargs)

# Create 3 test users (default)
node scripts/create-test-users.js

# Create 10 test users
node scripts/create-test-users.js 10

# Create users and cleanup old test users first
node scripts/create-test-users.js 5 --cleanup
```

**Output Example**:
```
═══════════════════════════════════════════════════════════
🧪 Pass It Up - Test User Generator
═══════════════════════════════════════════════════════════

🧪 Creating user 1:
   Name: Alex River
   Email: alex1-1733421234567@testpass.dev
   Password: TestPass123!
   Phone: +15550000001
   Tier: free
   ✅ Auth user created: a1b2c3d4...
   ✅ Profile updated
   ✅ Phone verified

📋 Test User Credentials:

User 1: Alex River (free)
  Email:    alex1-1733421234567@testpass.dev
  Password: TestPass123!
  Phone:    +15550000001
  User ID:  a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Programmatic Usage

#### Create a Single User

```typescript
import { createDummyUser } from '@/services/devTestingService';

// Create with default values
const user1 = await createDummyUser();

// Create with custom values
const user2 = await createDummyUser({
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@testpass.dev', // Optional, auto-generated if not provided
  password: 'MyTestPass123',
  phone: '+15559876543',
  dob: '2012-05-15',
  subscriptionTier: 'kids_club_plus',
  autoVerifyPhone: true, // Auto-verifies phone with OTP bypass
  autoConfirmEmail: true, // Requires service role key
});

console.log('Created user:', user2.userId);
console.log('Email:', user2.email);
console.log('Password:', user2.password);
```

#### Create Multiple Users in Bulk

```typescript
import { createBulkDummyUsers } from '@/services/devTestingService';

// Create 5 users with default settings
const users = await createBulkDummyUsers(5);

// Create 10 users with custom base settings
const subscriberUsers = await createBulkDummyUsers(10, {
  subscriptionTier: 'kids_club_plus',
  autoVerifyPhone: true,
  autoConfirmEmail: true,
});

console.log(`Created ${users.length} test users`);
users.forEach((user, i) => {
  console.log(`${i + 1}. ${user.email} (${user.userId})`);
});
```

---

## 3. User Cleanup

### Delete a Single User

```typescript
import { deleteDummyUser } from '@/services/devTestingService';

await deleteDummyUser(userId);
console.log('User deleted');
```

### Cleanup All Test Users

**⚠️ DANGEROUS**: This deletes **ALL** users with `@testpass.dev` email domain.

```typescript
import { cleanupAllTestUsers } from '@/services/devTestingService';

const result = await cleanupAllTestUsers();
console.log(`Deleted ${result.deleted} users, ${result.errors} errors`);
```

**Via CLI**:
```bash
node scripts/create-test-users.js 0 --cleanup
```

---

## 4. Environment Setup

### Required Environment Variables

For full functionality (including auto-confirmed emails), you need:

```bash
# .env.local
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # For auto-confirmed users
EXPO_PUBLIC_DEV_SMS_BYPASS=true  # Optional, auto-enabled in __DEV__
```

### Loading Environment Variables

**Terminal**:
```bash
export $(cat .env.local | xargs)
```

**App Runtime**:
Environment variables are automatically loaded by Expo. No action needed.

---

## 5. Testing Workflows

### Workflow 1: Test Signup Flow

```bash
# 1. Create a test user via CLI
node scripts/create-test-users.js 1

# 2. Copy the email and password from output
# 3. Open app in simulator
# 4. Go to signup screen
# 5. Use test credentials
# 6. When asked for phone verification, enter: 123456
# 7. Verification will bypass and succeed
```

### Workflow 2: Test Multiple User Interactions

```bash
# Create 5 test users with different tiers
node scripts/create-test-users.js 5

# Log in as each user to test:
# - Free tier features
# - Kids Club+ features
# - User interactions (messaging, trading, etc.)
```

### Workflow 3: Automated Testing

```typescript
// In a test file
import { createDummyUser, deleteDummyUser } from '@/services/devTestingService';

describe('User Profile Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    const user = await createDummyUser({
      subscriptionTier: 'kids_club_plus',
      autoVerifyPhone: true,
      autoConfirmEmail: true,
    });
    testUserId = user.userId;
  });

  afterAll(async () => {
    await deleteDummyUser(testUserId);
  });

  it('should have verified phone', async () => {
    const { data } = await supabase
      .from('profiles')
      .select('phone_verified')
      .eq('user_id', testUserId)
      .single();
    
    expect(data?.phone_verified).toBe(true);
  });
});
```

---

## 6. Common Scenarios

### Scenario: Login with Test User

1. Create user via CLI:
   ```bash
   node scripts/create-test-users.js 1
   ```

2. Copy email from output (e.g., `alex1-1733421234567@testpass.dev`)

3. Login with:
   - Email: `alex1-1733421234567@testpass.dev`
   - Password: `TestPass123!`

4. Phone is already verified ✅

### Scenario: Test Phone Verification

1. Signup with any credentials
2. When phone verification modal appears
3. Enter phone number: `+15551234567` (or any number)
4. Enter OTP code: `123456`
5. Verification will succeed without sending SMS ✅

### Scenario: Test Different Subscription Tiers

```typescript
// Create free user
const freeUser = await createDummyUser({
  subscriptionTier: 'free',
});

// Create Kids Club+ user
const plusUser = await createDummyUser({
  subscriptionTier: 'kids_club_plus',
});

// Create Kids Club Pro user
const proUser = await createDummyUser({
  subscriptionTier: 'kids_club_pro',
});

// Test tier-gated features with each user
```

---

## 7. Troubleshooting

### Issue: "Not in dev environment" error

**Cause**: Trying to use dev testing services in production.

**Solution**: Ensure you're in development mode:
- `__DEV__` is true (React Native dev mode)
- OR `EXPO_PUBLIC_ENVIRONMENT=development`
- OR `NODE_ENV=test`

### Issue: "Service role client not available"

**Cause**: `SUPABASE_SERVICE_ROLE_KEY` not set.

**Solution**:
```bash
export SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

Or create users without auto-confirm (requires manual email verification).

### Issue: OTP bypass not working

**Cause**: Not using the correct test code.

**Solution**: Ensure you're entering exactly `123456` (no spaces, no dashes).

### Issue: Created users not appearing in database

**Cause**: Service role key invalid or permissions issue.

**Solution**:
1. Verify service role key is correct
2. Check Supabase dashboard for auth errors
3. Ensure RLS policies allow user creation

---

## 8. Best Practices

✅ **DO**:
- Use CLI tool for manual testing
- Cleanup test users regularly
- Use auto-confirm for faster testing
- Create users with realistic data (names, DOB, etc.)
- Use bulk creation for load testing

❌ **DON'T**:
- Commit test user credentials to git
- Use test services in production
- Leave test users in production database
- Hardcode test user IDs in app code
- Bypass OTP in production builds

---

## 9. API Reference

### `devTestingService.ts`

#### Functions

```typescript
// Environment
isDevEnvironment(): boolean
logDevTestingConfig(): void

// OTP Bypass
getOTPBypassConfig(): OTPBypassConfig
isTestOTPCode(code: string): boolean
bypassOTPVerification(userId: string, phone: string): Promise<{ success: boolean; error?: string }>

// User Creation
createDummyUser(params?: DummyUserParams): Promise<DummyUserResult>
createBulkDummyUsers(count: number, baseParams?: Partial<DummyUserParams>): Promise<DummyUserResult[]>
deleteDummyUser(userId: string): Promise<void>
cleanupAllTestUsers(): Promise<{ deleted: number; errors: number }>
```

#### Types

```typescript
interface DummyUserParams {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  dob?: string; // YYYY-MM-DD
  nodeId?: string;
  zipCode?: string;
  subscriptionTier?: 'free' | 'kids_club_plus' | 'kids_club_pro';
  autoVerifyPhone?: boolean;
  autoConfirmEmail?: boolean;
}

interface DummyUserResult {
  userId: string;
  email: string;
  password: string;
  profile?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
}
```

---

## 10. Integration with Existing Services

The dev testing service integrates with:

1. **`verification.ts`**: OTP bypass automatically used when code is `123456`
2. **`phoneService.ts`**: SMS bypass works alongside OTP bypass
3. **`auth.ts`**: User creation works with existing auth flow

No changes needed to your app code - just use test code `123456` during verification.

---

## Questions?

For issues or questions, check:
1. Environment variables are set correctly
2. You're in development mode
3. Service role key is valid (for auto-confirm)
4. Console logs for detailed error messages

Happy testing! 🧪
