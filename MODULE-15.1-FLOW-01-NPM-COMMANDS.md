# MODULE-15.1-FLOW-01 NPM COMMANDS GUIDE
## All Commands for Testing & Validation

**Date:** 2026-05-05  
**Task:** TASK FLOW-01 - Authentication & Session Management  
**Note:** ALL commands use `npm` (NOT yarn)

---

## 🚦 Tier 0: ALWAYS RUN (Before Any Manual Testing)

These must pass before asking anyone to open iOS Simulator or Android Emulator.

### 1. TypeScript Type-Check
```bash
cd p2p-kids-marketplace
npm run typecheck
```

**Expected Output:**
```
✓ tsc compiled successfully (0 errors)
```

### 2. ESLint
```bash
cd p2p-kids-marketplace
npm run lint
```

**Expected Output:**
```
✓ 0 errors, 0 warnings
```

### 3. Unit Tests (All)
```bash
cd p2p-kids-marketplace
npm run test:unit
```

**Expected Output:**
```
Test Suites: 3 passed, 3 total
Tests:       68 passed, 68 total
Coverage:    85%+ on all auth screens
```

### 4. Unit Tests (Auth Only)
```bash
cd p2p-kids-marketplace
npm run test:unit -- --testPathPattern=auth
```

**Expected Output:**
```
Test Suites: 3 passed, 3 total (LandingScreen.test.tsx, LoginScreen.test.tsx, SignupScreen.test.tsx)
Tests:       68 passed, 68 total
```

---

## 🔗 Tier 1: INTEGRATION TESTS (Targeted Regression)

These test actual Supabase auth flows end-to-end.

### 1. Integration Tests (All)
```bash
cd p2p-kids-marketplace
RUN_SUPABASE_E2E=true npm run test:e2e
```

**Prerequisites:**
- Supabase project running (either local or staging)
- `.env.local` file with correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`

**Expected Output:**
```
Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total (signup, login, phone verification, password reset, session management)
Duration:    ~30s
```

### 2. Integration Tests (Auth Only)
```bash
cd p2p-kids-marketplace
RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=auth-flow-01
```

**Expected Output:**
```
Test Suites: 1 passed
Tests:       12 passed
Duration:    ~30s
```

---

## 🎭 Tier 1: MAESTRO UI TESTS (iOS & Android Simulators)

These automate UI flows on iOS Simulator and Android Emulator.

### Prerequisites for Maestro
1. Install Maestro CLI:
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

2. Start iOS Simulator:
```bash
open -a Simulator
```

3. Start Android Emulator:
```bash
emulator -avd Pixel_6_API_33 &
```

4. Ensure app is installed on both simulators:
```bash
cd p2p-kids-marketplace
npx expo run:ios  # For iOS Simulator
npx expo run:android  # For Android Emulator
```

### 1. Maestro Tests - iOS
```bash
cd p2p-kids-marketplace
npm run test:maestro:ios -- .maestro/module-15.1-flow-01-auth.yaml
```

**Or run Maestro directly:**
```bash
maestro test --platform=ios .maestro/module-15.1-flow-01-auth.yaml
```

**Expected Output:**
```
✓ TC-MAESTRO-001: Landing Screen UI & Navigation (passed)
✓ TC-MAESTRO-002: Login Screen UI Elements & Password Toggle (passed)
✓ TC-MAESTRO-003: Login Form Validation (passed)
✓ TC-MAESTRO-004: Signup Screen UI Elements (passed)
✓ TC-MAESTRO-005: Signup Form Validation (passed)
✓ TC-MAESTRO-006: Forgot Password Screen (passed)
✓ TC-MAESTRO-008: Design System Consistency Check (passed)
✓ TC-MAESTRO-009: Social Login Buttons (UI Only) (passed)

All 8 test cases passed in 2m 15s
```

### 2. Maestro Tests - Android
```bash
cd p2p-kids-marketplace
npm run test:maestro:android -- .maestro/module-15.1-flow-01-auth.yaml
```

**Or run Maestro directly:**
```bash
maestro test --platform=android .maestro/module-15.1-flow-01-auth.yaml
```

**Expected Output:**
```
✓ TC-MAESTRO-001: Landing Screen UI & Navigation (passed)
✓ TC-MAESTRO-002: Login Screen UI Elements & Password Toggle (passed)
✓ TC-MAESTRO-003: Login Form Validation (passed)
✓ TC-MAESTRO-004: Signup Screen UI Elements (passed)
✓ TC-MAESTRO-005: Signup Form Validation (passed)
✓ TC-MAESTRO-006: Forgot Password Screen (passed)
✓ TC-MAESTRO-008: Design System Consistency Check (passed)
✓ TC-MAESTRO-009: Social Login Buttons (UI Only) (passed)

All 8 test cases passed in 2m 30s
```

---

## 📱 Manual Testing (Tier 2: Full Regression)

### iOS Simulator Manual Testing

1. **Start Metro Bundler:**
```bash
cd p2p-kids-marketplace
npm start
```

2. **Open iOS Simulator (in separate terminal):**
```bash
open -a Simulator
```

3. **Install App on Simulator:**
```bash
npx expo run:ios
```

4. **Follow Manual Test Cases:**
- Open `MODULE-15.1-FLOW-01-MANUAL-TESTING.md`
- Execute TC-001 through TC-022 (one by one)
- Fill out test execution log table
- Mark each test case as: ✅ Pass / ❌ Fail / ⚠️ Partial Pass

**Estimated Time:** ~90 minutes for all 22 test cases

### Android Emulator Manual Testing

1. **Start Metro Bundler:**
```bash
cd p2p-kids-marketplace
npm start
```

2. **Start Android Emulator (in separate terminal):**
```bash
emulator -avd Pixel_6_API_33 &
```

3. **Install App on Emulator:**
```bash
npx expo run:android
```

4. **Follow Manual Test Cases:**
- Open `MODULE-15.1-FLOW-01-MANUAL-TESTING.md`
- Execute TC-001 through TC-022 (one by one)
- Fill out test execution log table
- Mark each test case as: ✅ Pass / ❌ Fail / ⚠️ Partial Pass

**Estimated Time:** ~90 minutes for all 22 test cases

---

## 🛡️ Pre-Commit Validation (Recommended Workflow)

Before committing any changes, run this sequence:

```bash
cd p2p-kids-marketplace

# Tier 0 (MUST pass)
npm run lint && npm run typecheck && npm run test:unit

# Tier 1 (Integration - if Supabase available)
RUN_SUPABASE_E2E=true npm run test:e2e

# Tier 1 (Maestro - if simulators available)
npm run test:maestro:ios -- .maestro/module-15.1-flow-01-auth.yaml
npm run test:maestro:android -- .maestro/module-15.1-flow-01-auth.yaml
```

**Expected Total Duration:** ~10 minutes (without manual testing)

---

## 🐛 Debugging Failed Tests

### If TypeScript Fails:
```bash
# Get detailed error output
cd p2p-kids-marketplace
npx tsc -p tsconfig.json --noEmit --pretty
```

### If ESLint Fails:
```bash
# Get detailed error output
cd p2p-kids-marketplace
npx eslint . --ext .ts,.tsx --max-warnings=0
```

### If Unit Tests Fail:
```bash
# Run specific test file
cd p2p-kids-marketplace
npm run test:unit -- --testPathPattern=LoginScreen.test.tsx

# Run with verbose output
npm run test:unit -- --verbose --testPathPattern=auth

# Run with coverage report
npm run test:unit -- --coverage --testPathPattern=auth
```

### If Integration Tests Fail:
```bash
# Check environment variables
cat .env.local | grep SUPABASE

# Run with verbose logging
RUN_SUPABASE_E2E=true npm run test:e2e -- --verbose --testPathPattern=auth-flow-01

# Check Supabase connection
npx supabase status
```

### If Maestro Tests Fail:
```bash
# Run Maestro with debug logging
maestro test --debug .maestro/module-15.1-flow-01-auth.yaml

# Record Maestro test (creates video)
maestro test --record .maestro/module-15.1-flow-01-auth.yaml

# Check Maestro version
maestro --version

# Update Maestro
curl -Ls "https://get.maestro.mobile.dev" | bash
```

### If Manual Testing Fails:
1. Check Metro Bundler logs for errors
2. Check Xcode/Android Studio logs
3. Clear app cache:
```bash
# iOS
xcrun simctl erase all

# Android
adb uninstall com.kidsmarketplace.app
```

---

## 📊 Coverage Reports

### Generate Coverage Report
```bash
cd p2p-kids-marketplace
npm run test:unit -- --coverage --testPathPattern=auth
```

**Expected Output:**
```
File                                | % Stmts | % Branch | % Funcs | % Lines
------------------------------------|---------|----------|---------|--------
LandingScreen.tsx                   |   100   |   100    |   100   |   100
LoginScreen.tsx                     |   89.5  |   85.7   |   90.0  |   89.2
SignupScreen.tsx                    |   87.3  |   82.1   |   88.5  |   87.1
PhoneVerificationScreen.tsx         |    0    |    0     |    0    |    0   (TODO)
ForgotPasswordScreen.tsx            |    0    |    0     |    0    |    0   (TODO)
ResetPasswordScreen.tsx             |    0    |    0     |    0    |    0   (TODO)
SuspendedAccountScreen.tsx          |    0    |    0     |    0    |    0   (TODO)
------------------------------------|---------|----------|---------|--------
All files                           |   61.5  |   58.3   |   62.0  |   61.2
```

### View Coverage HTML Report
```bash
cd p2p-kids-marketplace
npm run test:unit -- --coverage --testPathPattern=auth
open coverage/lcov-report/index.html
```

---

## 🚀 CI/CD Integration (GitHub Actions)

Add this to `.github/workflows/monorepo-ci.yml`:

```yaml
name: MODULE-15.1 Auth Screens CI

on:
  pull_request:
    paths:
      - 'p2p-kids-marketplace/src/screens/auth/**'
      - 'p2p-kids-marketplace/__tests__/screens/auth/**'
      - 'p2p-kids-marketplace/__tests__/integration/auth-flow-01.integration.test.ts'

jobs:
  tier0:
    name: Tier 0 (Lint + Type-Check + Unit Tests)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd p2p-kids-marketplace && npm install
      - name: Lint
        run: cd p2p-kids-marketplace && npm run lint
      - name: Type-Check
        run: cd p2p-kids-marketplace && npm run typecheck
      - name: Unit Tests
        run: cd p2p-kids-marketplace && npm run test:unit -- --testPathPattern=auth

  tier1-integration:
    name: Tier 1 (Integration Tests)
    runs-on: ubuntu-latest
    needs: tier0
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd p2p-kids-marketplace && npm install
      - name: Integration Tests
        run: cd p2p-kids-marketplace && RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=auth-flow-01
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_STAGING_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_STAGING_ANON_KEY }}
```

---

## ✅ Definition of Done Checklist

Before marking work complete, all these commands must pass:

```bash
# Navigate to app directory
cd p2p-kids-marketplace

# Tier 0 (REQUIRED)
- [ ] npm run lint                           # ESLint passes
- [ ] npm run typecheck                      # TypeScript compiles
- [ ] npm run test:unit -- --testPathPattern=auth  # Unit tests pass

# Tier 1 (REQUIRED for PR merge)
- [ ] RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=auth-flow-01  # Integration tests pass
- [ ] npm run test:maestro:ios -- .maestro/module-15.1-flow-01-auth.yaml  # Maestro iOS passes
- [ ] npm run test:maestro:android -- .maestro/module-15.1-flow-01-auth.yaml  # Maestro Android passes

# Tier 2 (REQUIRED for release)
- [ ] Manual testing on iOS Simulator complete (see MODULE-15.1-FLOW-01-MANUAL-TESTING.md)
- [ ] Manual testing on Android Emulator complete (see MODULE-15.1-FLOW-01-MANUAL-TESTING.md)
- [ ] All 22 manual test cases marked as PASS
- [ ] Test execution log filled out
```

---

## 📝 Quick Reference Card

**Before You Start:**
```bash
cd p2p-kids-marketplace
npm install  # Install dependencies if first time
```

**Fastest Validation (Tier 0 only):**
```bash
npm run lint && npm run typecheck && npm run test:unit -- --testPathPattern=auth
```

**Full Automated Testing (Tier 0 + Tier 1):**
```bash
npm run lint && \
npm run typecheck && \
npm run test:unit -- --testPathPattern=auth && \
RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=auth-flow-01 && \
npm run test:maestro:ios -- .maestro/module-15.1-flow-01-auth.yaml && \
npm run test:maestro:android -- .maestro/module-15.1-flow-01-auth.yaml
```

**Manual Testing:**
```bash
# Terminal 1: Metro Bundler
npm start

# Terminal 2: iOS Simulator
npx expo run:ios

# Terminal 3: Android Emulator
npx expo run:android

# Then follow MODULE-15.1-FLOW-01-MANUAL-TESTING.md
```

---

**Need Help?**
- Maestro docs: https://maestro.mobile.dev/
- Expo docs: https://docs.expo.dev/
- React Native Testing Library: https://callstack.github.io/react-native-testing-library/
