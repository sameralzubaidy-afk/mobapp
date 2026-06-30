# Detox E2E Test Suite — Kids P2P Marketplace

## Overview

42 automated test cases covering every major flow of the app.
Tests run on an **iOS Simulator** or **Android Emulator** using Detox v20 + Jest.
Screenshots are captured automatically at key steps and on every failure.

---

## Prerequisites — Do These Once

### 1. Build the debug binary

Detox cannot run on Expo Go. It needs a native debug build. You only do this once
(and again after an Expo SDK upgrade).

**iOS:**
```bash
cd p2p-kids-marketplace
npm run e2e:build:ios
```
Takes 10–15 minutes. Creates the binary at:
`ios/build/Build/Products/Debug-iphonesimulator/p2p-kids-marketplace.app`

**Android:**
```bash
cd p2p-kids-marketplace
npm run e2e:build:android
```
Creates the APK at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

### 2. Seed the staging database (one time)

The tests use fixed test accounts. Create them by running:

```bash
cd p2p-kids-marketplace
npm run seed:staging
```

This creates:
- **Buyer account:** `test-buyer@kidsmarketplace.test` / `TestBuyer123!`
- **Seller account:** `test-seller@kidsmarketplace.test` / `TestSeller123!`
- Test listings (Toys, Books, Sports, Electronics)
- Active trades, SP ledger entries, subscriptions

Re-run this only if the staging database is reset.

---

### 3. Boot the simulator / emulator

**iOS:**
```bash
xcrun simctl boot "iPhone 14"
open -a Simulator
```

**Android:**
```bash
# List available AVDs (Android Virtual Devices)
emulator -list-avds

# Start the emulator (replace AVD_NAME with your AVD)
emulator -avd Pixel_4_API_31 &
adb wait-for-device
```

---

## Running Tests

### Run ALL tests

**iOS:**
```bash
cd p2p-kids-marketplace
npm run e2e:ios
```

**Android:**
```bash
cd p2p-kids-marketplace
npm run e2e:android
```

---

### Run a SINGLE test file

```bash
# iOS — single test
npx detox test --configuration ios.sim.debug detox/tests/01-auth-login.e2e.ts

# Android — single test
npx detox test --configuration android.emu.debug detox/tests/01-auth-login.e2e.ts
```

---

### Run a SPECIFIC test by name

```bash
# iOS
npx detox test --configuration ios.sim.debug --testNamePattern "logs in as buyer"

# Android
npx detox test --configuration android.emu.debug --testNamePattern "logs in as buyer"
```

---

### Run the SMOKE suite (4 critical tests — fastest pass/fail check)

```bash
# iOS
npm run e2e:ios:smoke

# Android
npm run e2e:android:smoke
```

Smoke suite covers: login, trade initiation, profile, and discovery. Run this
before every build that goes to TestFlight.

---

### Run tests for a SPECIFIC GROUP

Pass multiple files separated by spaces:

```bash
# Run auth tests only
npx detox test --configuration ios.sim.debug \
  detox/tests/01-auth-login.e2e.ts \
  detox/tests/02-auth-signup.e2e.ts \
  detox/tests/18-password-toggle.e2e.ts

# Run trade flow tests only
npx detox test --configuration ios.sim.debug \
  detox/tests/04a-trade-initiate.e2e.ts \
  detox/tests/04b-trade-complete.e2e.ts \
  detox/tests/08-cancel-trade.e2e.ts \
  detox/tests/17-seller-trade-view.e2e.ts \
  detox/tests/22-seller-trade-actions.e2e.ts \
  detox/tests/28-submit-review.e2e.ts \
  detox/tests/29-trade-dispute.e2e.ts \
  detox/tests/35-safe-meetup.e2e.ts \
  detox/tests/36-trade-timeline.e2e.ts
```

---

### Run with verbose output (see every step)

```bash
npx detox test --configuration ios.sim.debug --loglevel trace
```
Example
npx detox test --configuration ios.sim.debug --no-build --loglevel verbose detox/tests/01-auth-login.e2e.ts 2>&1
---

## Test Inventory — What Each Test Does

| # | File | Login as | What Detox does | Expected outcome |
|---|---|---|---|---|
| 01 | `01-auth-login.e2e.ts` | Buyer | Launches app → navigates Welcome/Landing → enters buyer email+password → submits | Tab bar appears with Discover tab visible |
| 02 | `02-auth-signup.e2e.ts` | None | Launches app → taps Sign Up → verifies form fields exist → submits empty form | Signup screen stays visible (validation blocked navigation) |
| 03 | `03-listing-create.e2e.ts` | Seller | Logs in → finds Create Listing button → opens form → types title and price | Create listing form renders with all inputs accessible |
| 04a | `04a-trade-initiate.e2e.ts` | Buyer | Logs in → taps Discover → taps first listing → taps Request to Buy | Trade Offer screen appears with Send Offer button visible |
| 04b | `04b-trade-complete.e2e.ts` | Buyer | Logs in → discovers listing → opens offer screen → enters SP amount → accepts disclaimer → submits | Trade Success screen appears with success icon |
| 05 | `05-sp-wallet.e2e.ts` | Buyer | Logs in → taps Profile (Me) tab | SP balance stat is visible on the Profile screen |
| 06 | `06-subscription.e2e.ts` | Buyer | Logs in → taps Home → taps Kids Club+ → taps Subscribe CTA | Subscription payment screen opens showing plan details |
| 07 | `07-cart-checkout.e2e.ts` | Buyer | Logs in → Discover → taps first listing → views item detail | Item detail renders with price and Request to Buy button |
| 08 | `08-cancel-trade.e2e.ts` | Buyer | Logs in → Profile → trades stat → Active tab → taps trade → taps Cancel | Cancellation confirmed, trade list or status updates |
| 09 | `09-profile.e2e.ts` | Buyer | Logs in → taps Profile tab | Profile screen shows trades stat and SP balance stat |
| 10 | `10-discovery-browse.e2e.ts` | Buyer | Logs in → Discover → types search term → clears search | Results appear, search input works, SP-eligible filter switch visible |
| 11 | `11-home-dashboard.e2e.ts` | Buyer | Logs in → taps Home tab | Dashboard shows header row, avatar, greeting, notification bell, SP strip |
| 12 | `12-notification-center.e2e.ts` | Buyer | Logs in → Home → taps notification bell | Notification Center screen opens with notification list |
| 13 | `13-notification-preferences.e2e.ts` | Buyer | Logs in → Profile → Settings → Notification Preferences | Category sections (Subscription, Trades, SP Events) and push toggles visible |
| 14 | `14-help-support.e2e.ts` | Buyer | Logs in → Profile → Settings → Help & Support | Help screen shows FAQ list, search bar, and category chips |
| 15 | `15-settings-legal.e2e.ts` | Buyer | Logs in → Profile → Settings → Privacy Policy → back → Terms of Service | Legal pages open and back navigation returns to Settings |
| 16 | `16-id-verification.e2e.ts` | Buyer | Logs in → Profile → taps ID Verification menu item | Verification screen shows upload area and submit button; back button exits |
| 17 | `17-seller-trade-view.e2e.ts` | Seller | Logs in as seller → Profile → trades stat → Active tab → trade detail | Trade status badge visible on seller trade detail |
| 18 | `18-password-toggle.e2e.ts` | None | Opens login screen → types in password field → taps eye icon twice | Password toggle does not crash; login form remains functional |
| 19 | `19-onboarding-carousel.e2e.ts` | None | Launches with cleared state (fresh install) → detects carousel | Onboarding carousel appears; Skip button dismisses it |
| 20 | `20-filter-modal.e2e.ts` | Buyer | Logs in → Discover → opens filter modal | Filter modal opens showing filter categories; dismisses correctly |
| 21 | `21-category-filter.e2e.ts` | Buyer | Logs in → Discover → opens category filter modal | Seeded categories (Toys, Books, Sports) visible in modal |
| 22 | `22-seller-trade-actions.e2e.ts` | Seller | Logs in as seller → Profile → Active trades → trade detail | At least one seller action button (complete/cancel/review) visible |
| 23 | `23-forgot-password.e2e.ts` | None | Navigates Welcome → Landing → Login → taps forgot-password-link | Forgot Password / password recovery screen opens |
| 24 | `24-messaging-inbox.e2e.ts` | Buyer | Logs in → taps Inbox tab (tab-inbox) → views conversations list | ConversationsListScreen renders with list and search input |
| 25 | `25-sp-wallet-screen.e2e.ts` | Buyer | Logs in → Profile → taps SP balance stat → SP Wallet screen | SpWalletScreen shows balance card, amount, history button, earn buttons |
| 26 | `26-sp-transaction-history.e2e.ts` | Buyer | Logs in → Profile → SP Wallet → taps history button | SP History screen opens with All / Earned / Spent tabs; tab switching works |
| 27 | `27-favorites.e2e.ts` | Buyer | Logs in → Discover → item detail → add to cart → view cart → cart-favorites-link | FavoritesScreen renders empty state or favorites list |
| 28 | `28-submit-review.e2e.ts` | Buyer | Logs in → Profile → Trade History → completed trade → review-trade-button | SubmitReviewScreen shows star-rating and submit-review-button |
| 29 | `29-trade-dispute.e2e.ts` | Buyer | Logs in → Profile → Active trade → scroll → report-problem-button | Dispute form renders with dispute-description and submit-dispute-button |
| 30 | `30-cart-screen.e2e.ts` | Buyer | Logs in → Discover → item detail → add-to-cart-button → view-cart-button | CartScreen renders with cart-summary, cart-subtotal, and checkout-button |
| 31 | `31-sell-action-sheet.e2e.ts` | Seller | Logs in → taps Sell tab (tab-sell) | Sell action sheet appears with List One Item and Bulk Upload options |
| 32 | `32-referrals.e2e.ts` | Buyer | Logs in → Profile → SP Wallet → sp-wallet-earn-refer-btn | Referrals screen shows referral-code-text and share button |
| 33 | `33-payout-settings.e2e.ts` | Seller | Logs in → Home → action-tile-payouts | Payout Settings screen opens; add-bank-row or bank-row visible |
| 34 | `34-my-listings.e2e.ts` | Seller | Logs in → Profile → profile-listings-stat | My Listings screen shows tab-listings, tab-drafts, and listings-flatlist |
| 35 | `35-safe-meetup.e2e.ts` | Buyer | Logs in → Profile → Active trade → scroll | safe-meetup-card and safe-meetup-toggle visible in trade detail |
| 36 | `36-trade-timeline.e2e.ts` | Buyer | Logs in → Profile → Active trade detail | trade-timeline and trade-offer-card visible in trade detail |
| 37 | `37-search-autocomplete.e2e.ts` | Buyer | Logs in → Discover → focuses search → types "toy" | recent-searches-panel and autocomplete-panel appear; search-bar-clear clears input |
| 38 | `38-search-empty-state.e2e.ts` | Buyer | Logs in → Discover → searches "xyzxyzxyz123noitems" | empty-state element visible after search completes |
| 39 | `39-badges.e2e.ts` | Buyer | Logs in → Profile → taps badge-showcase | BadgesScreen opens showing badge-name and badge-icon-container |
| 40 | `40-subscription-management.e2e.ts` | Buyer | Logs in → Home → scrolls to Subscription card → taps | Subscription plans or management screen opens with plan options |
| 41 | `41-contact-support.e2e.ts` | Buyer | Logs in → Profile → Settings → Help → contact-support-button | ContactSupportScreen shows subject-input and support-button |
| 42 | `42-edit-profile.e2e.ts` | Buyer | Logs in → Profile → taps avatar-upload-button | EditProfile/ProfileSetup screen opens with display-name input and bio label |

---

## Where Screenshots Land

Every `device.takeScreenshot()` call saves to:
```
p2p-kids-marketplace/artifacts/
  ├── 01-auth-login.e2e.ts/
  │   └── 01-login-success.png
  ├── 04b-trade-complete.e2e.ts/
  │   ├── 04b-offer-screen-ready.png
  │   ├── 04b-sp-amount-entered.png
  │   ├── 04b-disclaimer-accepted.png
  │   └── 04b-trade-success.png
  └── ...
```

Detox also **auto-captures a screenshot when any test fails** — you always have a
visual of exactly what was on screen when it broke.

---

## What to Do When a Test Fails

### Step 1 — Read the failure message

```
● TC-04a: Trade Flow — Initiate › opens item detail screen when a listing is tapped
  Element not found: by.id("discover-results-list")
```

### Step 2 — Open the failure screenshot

```
artifacts/04a-trade-initiate.e2e.ts/<timestamp>/testFailed.png
```

### Step 3 — Match the error to a root cause

| Error message | Root cause | Fix |
|---|---|---|
| `Element not found: by.id('tab-discover')` | Login failed — credentials invalid or account missing | Run `npm run seed:staging` |
| `Element not found: by.id('discover-results-list')` | No seeded listings | Run `npm run seed:staging` |
| `Element not found: by.id('profile-sp-balance-stat')` | testID renamed in app code | Search `grep -r 'testID' src/ \| grep sp-balance` and update the test |
| `App is not running` | Simulator not booted or binary missing | Run `xcrun simctl boot "iPhone 14"` then `npm run e2e:build:ios` |
| Test times out | Animation still running / network slow | Increase `withTimeout(N)` value in that specific test |
| `Element not found` on Android but passes iOS | Android element IDs can differ | Check `by.id()` vs `by.label()` — Android may use `contentDescription` |

### Step 4 — Verify a testID still exists in the app

```bash
# Find where a testID is used in the app source
grep -r 'testID="profile-sp-balance-stat"' src/
```

If it was renamed or removed, update the test to match the new testID.

---

## iOS vs Android — Key Differences

| Behaviour | iOS | Android |
|---|---|---|
| Back navigation | `element(by.id('back-button')).tap()` | `device.pressBack()` |
| System dialogs | iOS Save Password, Sign in with Apple | Android permissions dialog |
| Build time | ~15 min | ~10 min |
| Simulator startup | `xcrun simctl boot "iPhone 14"` | `emulator -avd Pixel_4_API_31` |
| Run command | `npm run e2e:ios` | `npm run e2e:android` |
| App binary location | `ios/build/.../p2p-kids-marketplace.app` | `android/app/build/.../app-debug.apk` |
| AVD config (detox.config.json) | `device: { type: "iPhone 14" }` | `device: { avdName: "Pixel_4_API_31" }` |

The tests in `detox/tests/15-settings-legal.e2e.ts` already handle both platforms
by using `device.pressBack()` as a fallback when the iOS back button is not found.

---

## CI — GitHub Actions

Tests run automatically on every push to `main`. Workflow:
`.github/workflows/emulator-tests.yml`

### Only 1 GitHub Secret to add

Go to: `github.com/sameralzubaidy-afk/mobapp` →
Settings → Secrets and variables → Actions → New repository secret:

| Secret name | Where to find the value |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Your `.env.staging` file — the `eyJhbGci...` value for `service_role` |

The Supabase URL and anon key are already embedded in the workflow file.

---

## Helpers Reference

### `detox/helpers/auth.ts`
```typescript
loginAsBuyer()   // Login as test-buyer@kidsmarketplace.test
loginAsSeller()  // Login as test-seller@kidsmarketplace.test
```

### `detox/helpers/navigation.ts`
```typescript
goToDiscover()     // Tap Discover tab, wait for results list
goToProfile()      // Tap Me tab
goToHome()         // Tap Home tab
tapFirstListing()  // Tap first item in discover-results-list
```

### `detox/helpers/dialogs.ts`
```typescript
dismissSystemDialogs()  // Dismiss iOS Save Password, Sign in with Apple, etc.
```

### Key Detox globals (no import needed)
```typescript
device.launchApp({ newInstance: true })
device.launchApp({ newInstance: true, delete: true }) // fresh install
device.terminateApp()
device.pressBack()                                    // Android hardware back
device.takeScreenshot('label')

element(by.id('testId'))
element(by.text('Visible text'))
element(by.label('accessibility label'))
element(by.id('listId')).atIndex(0)                  // first item in a list

waitFor(element(by.id('id'))).toBeVisible().withTimeout(8000)
waitFor(element(by.id('id'))).not.toBeVisible().withTimeout(5000)
expect(element(by.id('id'))).toBeVisible()
```

---

## Known Limitations

| Test | Limitation | Reason |
|---|---|---|
| TC-03 | Image upload not automated | iOS/Android photo picker is system UI |
| TC-06 | Stripe payment not automated | Stripe checkout is a system WebView |
| TC-19 | Carousel only shows on fresh install | Auth state may persist between runs |
| TC-28 | Review screen only reachable after completed trade | Seeded data must include a completed trade |
| TC-29 | Dispute screen only reachable from an active trade | Seeded data must include an active trade |
| TC-35, TC-36 | Safe meetup / timeline visible only in active trade detail | Seeded data must include active trades |
| All | Push notification delivery | Requires real device |

---

---

## AI Agent Prompt Template — Adding a New Detox Test

Copy the prompt below, fill in the `[...]` sections, and paste it into GitHub Copilot chat.

```
I need to add a new Detox E2E test to the Kids P2P Marketplace app.

--- APP CONTEXT ---
App ID:           com.sameralzubaidi.p2pmarketplace
Detox version:    20.x
Test framework:   Detox + Jest (TypeScript)
Test folder:      p2p-kids-marketplace/detox/tests/
Helper folder:    p2p-kids-marketplace/detox/helpers/
testID manifest:  See .maestro/*.yaml files — each has a testID comment block
                  at the top listing every element ID for that screen.

--- AVAILABLE HELPERS ---
import { loginAsBuyer, loginAsSeller } from '../helpers/auth';
import { goToDiscover, goToProfile, goToHome, tapFirstListing } from '../helpers/navigation';
import { dismissSystemDialogs } from '../helpers/dialogs';

--- DETOX GLOBALS (no import needed) ---
device, element, by, waitFor, expect

--- TEST ACCOUNTS (created by: npm run seed:staging) ---
Buyer:  test-buyer@kidsmarketplace.test  /  TestBuyer123!
Seller: test-seller@kidsmarketplace.test / TestSeller123!

--- CONVENTIONS TO FOLLOW ---
1. Filename:    NN-description.e2e.ts  (next number after 42, e.g. 43-my-feature.e2e.ts)
2. Header:      /// <reference types="detox" /> at top, then JSDoc comment block
3. beforeAll:   device.launchApp({ newInstance: true }) + dismissSystemDialogs() + login
4. afterAll:    device.terminateApp()
5. Assertions:  Use waitFor().toBeVisible().withTimeout(8000) for dynamic content
6. Screenshots: await device.takeScreenshot('NN-step-name') at key moments
7. Independence: Each file sets up its own state — no relying on another test's state
8. Android:     Use device.pressBack() as fallback when iOS back-button tap fails
9. testID ref:  Always add /// <reference types="detox" /> at file top

--- REFERENCE TEST (copy this pattern exactly) ---
/// <reference types="detox" />
/**
 * TC-NN: Screen — What it tests
 * testIDs used: [list them here]
 */
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToDiscover } from '../helpers/navigation';

describe('TC-NN: Screen — What it tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('does something specific', async () => {
    await goToDiscover();
    await waitFor(element(by.id('some-testId'))).toBeVisible().withTimeout(8000);
    await expect(element(by.id('some-testId'))).toBeVisible();
    await device.takeScreenshot('NN-step-name');
  });
});

--- WHAT TO BUILD ---
Test number:          [e.g. 23]
Flow to test:         [describe the user flow in plain English]
Login as:             [buyer / seller / none]
Screens involved:     [list the screen names]
testIDs to use:       [find them in .maestro/*.yaml files — look for the testID manifest block at the top of each file]
Seeded data needed:   [yes/no — what data must exist]
Platform notes:       [any iOS vs Android differences to handle]
```


11 test cases covering the app's critical flows. Tests run on an iOS Simulator using
Detox v20 + Jest. Screenshots are saved automatically on failure, and on key assertions.

---

## Prerequisites (One-Time Setup)

### 1. Build the iOS debug binary

You only do this **once** (and again after an Expo SDK upgrade):

```bash
cd p2p-kids-marketplace
npm run e2e:build:ios
```

This takes 10–15 minutes. It generates the binary at:
`ios/build/Build/Products/Debug-iphonesimulator/p2p-kids-marketplace.app`

### 2. Seed the staging database with test accounts

The tests use fixed test accounts. Create them by running:

```bash
cd p2p-kids-marketplace
npm run seed:staging
```

Run this **once**. After that, the test accounts persist. Only re-run if you reset
the staging database. Credentials are:
- **Buyer:** `test-buyer@kidsmarketplace.test` / `TestBuyer123!`
- **Seller:** `test-seller@kidsmarketplace.test` / `TestSeller123!`

### 3. Boot the iOS Simulator

```bash
xcrun simctl boot "iPhone 14"
open -a Simulator
```

---

## Running Tests

### Run all 11 tests

```bash
cd p2p-kids-marketplace
npm run e2e:run:ios
```

### Run a single test file

```bash
cd p2p-kids-marketplace
npx detox test --configuration ios.sim.debug detox/tests/01-auth-login.e2e.ts
```

### Run a specific test by name

```bash
npx detox test --configuration ios.sim.debug --testNamePattern "logs in as buyer"
```

### Run with verbose output (shows each step)

```bash
npx detox test --configuration ios.sim.debug --loglevel trace
```

---

## Test List

| # | File | What it tests | Needs seeded data |
|---|---|---|---|
| 01 | `01-auth-login.e2e.ts` | Login as buyer → main nav | Yes |
| 02 | `02-auth-signup.e2e.ts` | Signup form renders + validates | No |
| 03 | `03-listing-create.e2e.ts` | Create listing form (no image upload) | No |
| 04a | `04a-trade-initiate.e2e.ts` | Discover → Item Detail → Offer screen | Yes |
| 04b | `04b-trade-complete.e2e.ts` | Full offer submission → Success screen | Yes + subscription |
| 05 | `05-sp-wallet.e2e.ts` | SP balance visible on Profile | Yes |
| 06 | `06-subscription.e2e.ts` | Kids Club+ screen loads (no Stripe) | No |
| 07 | `07-cart-checkout.e2e.ts` | Discover → Item Detail → CTA visible | Yes |
| 08 | `08-cancel-trade.e2e.ts` | Profile → Active Trades → Cancel | Yes (active trade) |
| 09 | `09-profile.e2e.ts` | Profile screen stats visible | Yes |
| 10 | `10-discovery-browse.e2e.ts` | Discover results + search input | Yes |

---

## Where Screenshots Land

```
p2p-kids-marketplace/artifacts/
  ├── 01-auth-login.e2e.ts/
  │   └── 01-login-success.png
  ├── 04b-trade-complete.e2e.ts/
  │   ├── 04b-offer-screen-ready.png
  │   ├── 04b-sp-amount-entered.png
  │   └── 04b-trade-success.png
  └── ...
```

Detox also auto-captures a screenshot when any test **fails**.

---

## What to Do When a Test Fails

### Step 1 — Read the failure message

The terminal shows which assertion failed and what was visible instead.

### Step 2 — Look at the screenshot

Check `artifacts/<test-name>/<screenshot>.png` for the last screenshot before failure.

### Step 3 — Common causes and fixes

| Failure | Likely cause | Fix |
|---|---|---|
| `Element not found: by.id('tab-discover')` | Login failed (wrong credentials / account missing) | Run `npm run seed:staging` |
| `Element not found: by.id('discover-results-list')` | No seeded listings | Run `npm run seed:staging` |
| `Element not found: by.id('profile-sp-balance-stat')` | testID changed in app | Update the testID in the test file |
| `App is not running` | Simulator not booted / binary missing | Boot simulator + run `npm run e2e:build:ios` |
| Test times out | Animation running / network slow | Increase `withTimeout` value in that test |

### Step 4 — Verify a testID still exists in the app

Search for the testID in the codebase:

```bash
grep -r "testID=\"<the-id>\"" src/
```

If it's gone or renamed, update the test file to match the new testID.

---

## CI — GitHub Actions

Tests run automatically on every push to `main`. The workflow is at:
`.github/workflows/emulator-tests.yml`

### Required GitHub Secrets (Settings → Secrets → Actions)

| Secret | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |

On CI failure, screenshots are uploaded as workflow artifacts — download them from
the GitHub Actions run page.

---

## Helpers Reference

### `detox/helpers/auth.ts`
```typescript
loginAsBuyer()   // Login as test-buyer@kidsmarketplace.test
loginAsSeller()  // Login as test-seller@kidsmarketplace.test
```

### `detox/helpers/navigation.ts`
```typescript
goToDiscover()     // Tap Discover tab, wait for results list
goToProfile()      // Tap Me tab
goToHome()         // Tap Home tab
tapFirstListing()  // Tap first item in discover-results-list
```

### `detox/helpers/dialogs.ts`
```typescript
dismissSystemDialogs()  // Dismiss iOS Save Password, Sign in with Apple, etc.
```

### Detox globals (no imports needed)
```typescript
device                          // Control the app/simulator
element(by.id('testId'))        // Find element by testID
element(by.text('Label'))       // Find element by visible text
element(by.label('a11yLabel'))  // Find element by accessibility label
waitFor(el).toBeVisible().withTimeout(10000)
device.takeScreenshot('name')
device.terminateApp()
device.launchApp({ newInstance: true })
```

---

## Known Limitations

| Limitation | Reason | Workaround |
|---|---|---|
| Image upload (TC-03) | iOS photo picker is a system UI | Manual test |
| Stripe payment (TC-06) | Stripe checkout is a system WebView | Manual test |
| Push notifications | Requires real device | Manual test |

---

---

## AI Agent Prompt Template — Adding a New Detox Test

Use the prompt below when asking GitHub Copilot (or any AI agent) to write a new
test. Copy it, fill in the sections marked with `[...]`, and paste it into the chat.

```
I need to add a new Detox E2E test to the Kids P2P Marketplace app.

--- APP CONTEXT ---
App ID:           com.sameralzubaidi.p2pmarketplace
Detox version:    20.x
Test framework:   Detox + Jest (TypeScript)
Test folder:      p2p-kids-marketplace/detox/tests/
Helper folder:    p2p-kids-marketplace/detox/helpers/
testID manifest:  See .maestro/*.yaml files — each file has a testID comment block
                  at the top listing every element ID for that screen.

--- AVAILABLE HELPERS ---
import { loginAsBuyer, loginAsSeller } from '../helpers/auth';
import { goToDiscover, goToProfile, goToHome, tapFirstListing } from '../helpers/navigation';
import { dismissSystemDialogs } from '../helpers/dialogs';

--- DETOX GLOBALS (no import needed) ---
device, element, by, waitFor, expect

--- TEST ACCOUNTS (created by: npm run seed:staging) ---
Buyer:  test-buyer@kidsmarketplace.test  /  TestBuyer123!
Seller: test-seller@kidsmarketplace.test / TestSeller123!

--- CONVENTIONS TO FOLLOW ---
1. Filename:    NN-description.e2e.ts  (e.g. 11-notifications.e2e.ts)
2. beforeAll:   device.launchApp({ newInstance: true }) + dismissSystemDialogs() + login
3. afterAll:    device.terminateApp()
4. Assertions:  Use waitFor().toBeVisible().withTimeout() for dynamic content
5. Screenshots: await device.takeScreenshot('NN-description-step') at key moments
6. Independence: Each test file must set up its own state — no reliance on other tests
7. testID ref:  /// <reference types="detox" /> at the top of every file

--- REFERENCE TEST (follow this exact pattern) ---
/// <reference types="detox" />
import { loginAsBuyer } from '../helpers/auth';
import { dismissSystemDialogs } from '../helpers/dialogs';
import { goToDiscover } from '../helpers/navigation';

describe('TC-XX: Screen — What it tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await dismissSystemDialogs();
    await loginAsBuyer();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('does something specific', async () => {
    await goToDiscover();
    await waitFor(element(by.id('some-testId'))).toBeVisible().withTimeout(8000);
    await expect(element(by.id('some-testId'))).toBeVisible();
    await device.takeScreenshot('XX-step-name');
  });
});

--- WHAT TO BUILD ---
Test number: [e.g. 11]
Flow to test: [describe the user flow — e.g. "buyer opens a received trade offer and marks it complete"]
Screen testIDs: [list the testIDs for this flow — find them in .maestro/*.yaml manifests]
Login required as: [buyer / seller / none]
Seeded data needed: [yes/no — describe what]
```
