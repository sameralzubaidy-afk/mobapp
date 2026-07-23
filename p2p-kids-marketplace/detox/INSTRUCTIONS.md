# Detox E2E Test Suite — Kids P2P Marketplace

## Overview

**57 automated test cases** covering every major flow of the app (login, signup, listings, trades, SP wallet, cart, reviews, disputes, messaging, notifications, onboarding, search, filters, profile, settings, referrals, badges, subscriptions, and more).

Tests run on an **iOS Simulator** using Detox v20.46.0 + Jest.
Screenshots are captured automatically at key steps and on every failure.

For full test coverage including complex timer-based, push notification, and admin portal scenarios, see the Maestro + Playwright suite at `test-automation/trade-flow-v2/`.

---

## Prerequisites — Do These Once

### ⚠️ Critical: Fix Detox binary (one-time)

Detox ships with a wrapper (`detox-cli`) that can spawn itself infinitely.  
You **must** relink the binary before first use:

```bash
cd p2p-kids-marketplace
ln -sf ../detox/local-cli/cli.js node_modules/.bin/detox
```

Verify it works:
```bash
./node_modules/.bin/detox --version
# Expected: 20.46.0
```

If this returns instantly, you're good. If it hangs, the link wasn't applied.

---

### 1. Build the Release binary

Detox cannot run on Expo Go. It needs a **Release** native build with an
embedded JS bundle (Debug builds lack the Metro bundle in offline mode).

**Build:**

```bash
cd p2p-kids-marketplace
SENTRY_ALLOW_FAILURE=true SENTRY_DISABLE_AUTO_UPLOAD=true \
  xcodebuild -workspace ios/PassItUp.xcworkspace \
             -scheme PassItUp \
             -configuration Release \
             -sdk iphonesimulator \
             -derivedDataPath ios/build \
             CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO
```

Takes 10–15 minutes. Creates the binary at:
```
ios/build/Build/Products/Release-iphonesimulator/PassItUp.app
```

> **Why Release?** Debug builds need Metro bundler running. The Detox idle-wait
> hangs on React Native's main queue. Release builds skip Metro and let us use
> `DTXDisableMainRunLoopSync` to bypass the queue check.

**Inject JS bundle (one-time after build):**

```bash
# Export the JS bundle
npx expo export --no-bytecode --output-dir /tmp/expo-export 2>&1

# Find the bundle file
BUNDLE=$(ls /tmp/expo-export/_expo/static/js/ios/*.js | head -1)

# Copy into the .app
cp "$BUNDLE" ios/build/Build/Products/Release-iphonesimulator/PassItUp.app/main.jsbundle

# Disable Expo OTA updates (prevents hang at startup)
plutil -replace EXUpdatesEnabled -bool NO \
  ios/build/Build/Products/Release-iphonesimulator/PassItUp.app/Expo.plist
```

Verify: `ls -lh ios/build/Build/Products/Release-iphonesimulator/PassItUp.app/main.jsbundle`
Should show ~11MB.

---

### 2. Patch Stripe SDK (one-time)

The Stripe React Native SDK's ObjC/Swift interop header uses `NSUInteger` for an
enum that Swift auto-generates as `NSInteger`, causing a build error. Patch it:

```bash
sed -i '' 's/NSUInteger/NSInteger/' \
  node_modules/@stripe/stripe-react-native/ios/StripeSwiftInterop.h
```

This change is local and will be overwritten by `npm install`.

---

### 3. Seed the staging database (one-time)

Tests use fixed test accounts. Create them by running:

```bash
cd p2p-kids-marketplace
npm run seed:staging
```

This creates:

| Role | Email | Password | Subscription |
|---|---|---|---|
| Buyer | test-buyer@kidsmarketplace.test | TestBuyer123! | Kids Club+ Active |
| Seller | test-seller@kidsmarketplace.test | TestSeller123! | Kids Club+ Active |

Also creates: test listings (Toys, Books, Sports, Electronics), active trades,
SP ledger entries, and subscription records.

Re-run only if the staging database is reset.

### Extended seeding (required for tests 43-57)

For the full test suite including bundles, competing offers, donations, and reviews:

```bash
cd p2p-kids-marketplace
npm run seed:staging:extended
```

This additionally creates:

| Role | Email | Password | Notes |
|---|---|---|---|
| Free User | test-free@kidsmarketplace.test | TestFree123! | No subscription |
| Seller 2 | test-seller-2@kidsmarketplace.test | TestSeller2123! | Separate seller for cart tests |
| Buyer 2 | test-buyer-2@kidsmarketplace.test | TestBuyer2123! | Competing offers |
| Buyer 3 | test-buyer-3@kidsmarketplace.test | TestBuyer3123! | Competing offers |

Extended data: donation listing, cash-only listing, competing offers, bundle trades,
completed trade with mutual reviews, seller 2 with 3 listings.

---

### 4. Boot the simulator (single instance only)

**⚠️ Critical:** Never have more than one simulator booted at a time. Detox
picks the first available simulator and multiple instances cause instability.

```bash
# Step 1: Shut down ALL simulators first
xcrun simctl shutdown all

# Step 2: Boot ONLY the one needed (matches detox.config.json)
xcrun simctl boot "iPhone 17 Pro"
open -a Simulator

# Step 3: Verify only ONE is booted
xcrun simctl list devices | grep "Booted"
# Expected: exactly 1 entry
```

> If you see multiple booted simulators, run `xcrun simctl shutdown all` and
> reboot only one. The Simulator app sometimes auto-restores previous windows.

---

## Running Tests

### Quick smoke test (4 critical tests — ~30s)

```bash
cd p2p-kids-marketplace
npm run e2e:ios:smoke
```

Covers: login, trade initiation, profile, and discovery. Run this before every
build that goes to TestFlight.

---

### Run ALL tests

```bash
cd p2p-kids-marketplace
npm run e2e:ios
```

Skips the build step (uses `--no-build` by default from config).  
Runs all 57 tests. Takes roughly 6–10 minutes.

---

### Run a SINGLE test file

```bash
cd p2p-kids-marketplace
./node_modules/.bin/detox test --configuration ios.sim.debug --no-build \
  detox/tests/01-auth-login.e2e.ts
```

---

### Run a test by name pattern

```bash
./node_modules/.bin/detox test --configuration ios.sim.debug --no-build \
  --testNamePattern "logs in as buyer"
```

---

### Run with verbose output (view hierarchy dump on failure)

```bash
./node_modules/.bin/detox test --configuration ios.sim.debug --no-build \
  --loglevel verbose detox/tests/01-auth-login.e2e.ts 2>&1
```

Add `--loglevel trace` for maximum detail (every Detox action logged).

---

### Run a specific group of tests

```bash
# Auth tests only
./node_modules/.bin/detox test --configuration ios.sim.debug --no-build \
  detox/tests/01-auth-login.e2e.ts \
  detox/tests/02-auth-signup.e2e.ts \
  detox/tests/18-password-toggle.e2e.ts

# Trade flow tests
./node_modules/.bin/detox test --configuration ios.sim.debug --no-build \
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
| 43 | `43-cash-and-alternative-trades.e2e.ts` | Buyer → Seller → Buyer | Cash Only full happy path + Accept SP (0 SP) + Donate [Claim] | Cash Only: no Use SP, seller accepts, buyer confirms. Donate: Claim only, no charge. Accept SP 0 SP: seller earns platform SP |
| 44 | `44-offer-lifecycle.e2e.ts` | Buyer → Seller | Seller decline, competing offers, max 3 pending, card declined | Seller decline restores SP; competing offers sorted by value; 4th pending blocked; valid card passes |
| 45 | `45-sp-reserve-transfer.e2e.ts` | Buyer ↔ Seller | SP reserved/restored/released across trade lifecycle | SP wallet balance visible before/after each trade stage |
| 46 | `46-sp-gating.e2e.ts` | Free → Buyer | Free user locked Use SP + upgrade modal; SP slider 50% cap | Free: locked Use SP → upgrade modal. Subscriber: SP input clamped at 50% |
| 47 | `47-dispute-e2e-flow.e2e.ts` | Buyer → Seller | Dispute filed, buyer UI buttons hidden, seller sees amber notice | Dispute banner replaces auto-complete; Report/I Got It hidden; seller sees notice; Cancel hidden |
| 48 | `48-payout.e2e.ts` | Seller | Payout screen access + needs-action for missing bank | Payout screen loads; add-bank-row or bank-row visible |
| 49 | `49-completion-ctas.e2e.ts` | Free → Buyer → Seller | Completion screen CTAs per user type | Free: subscription CTA. Buyer: SP saved. Seller: SP pending / upsell |
| 50 | `50-safety-ux.e2e.ts` | Buyer | Chat safety banner, pre-message modal, quick-reply chips | Banner persistent; modal shown once per listing; chips visible on in_progress |
| 51 | `51-seller-consequences.e2e.ts` | Seller | Cancel visibility, seller reasons, Level 1 alert | Cancel only on in_progress; seller reasons only; Level 1 on first cancel |
| 52 | `52-value-stack.e2e.ts` | Buyer → Free | Subscriber $0.99 fee, non-subscriber $2.99, SP discount conditional | Fee amounts differ by subscription; SP discount appears/hides with SP amount |
| 53 | `53-bundle-flows.e2e.ts` | Buyer → Seller | Bundle banner, confirm all, offer rows, accept/decline | Bundle banner visible; bundle rows show batch actions; single accept available |
| 54 | `54-cart-edge-cases.e2e.ts` | Buyer → Seller | Multi-seller modal, own-item blocked, saved carts, max SP | Different seller shows choice modal; own item blocked; saved carts accessible |
| 55 | `55-tax-checkout.e2e.ts` | Buyer | Sales tax in breakdown, recalculation, history details | Sales Tax line visible; recalculates on SP change; history accessible |
| 56 | `56-reviews-detailed.e2e.ts` | Buyer | Anonymous review, mutual status, edit, flag, one-per-trade | Anonymous hides identity; mutual status visible; edit within 24h; flag with reason |
| 57 | `57-refund-cancel.e2e.ts` | Buyer ↔ Seller | Buyer/pending cancel, seller decline, in_progress cancel, refund settlement | Cancelled status shown; SP stat visible; refund timeline present; no double refund |

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
| `Element not found: by.id('login-email-input')` | Landing screen navigation failed / app stuck on different screen | Run `--loglevel verbose` to dump view hierarchy |
| `Element not found` on Android but passes iOS | Android element IDs can differ | Check `by.id()` vs `by.label()` — Android may use `contentDescription` |
| `App is not running` | Simulator not booted or binary missing | Boot simulator: `xcrun simctl boot "iPhone 17 Pro"` |
| Test times out | Animation still running / network slow | Increase `withTimeout(N)` value in that specific test |
| `detox --version` hangs | Binary still points to `detox-cli` wrapper | Re-run: `ln -sf ../detox/local-cli/cli.js node_modules/.bin/detox` |
| Build fails at `sentry-cli` | Sentry not configured | Prepend `SENTRY_ALLOW_FAILURE=true` to build command |
| Build error: `STPPaymentStatus` | Stripe ObjC/Swift enum mismatch | Re-apply: `sed -i '' 's/NSUInteger/NSInteger/' node_modules/@stripe/stripe-react-native/ios/StripeSwiftInterop.h` |
| `EXUpdatesEnabled` error | Expo OTA blocking startup | Run `plutil -replace EXUpdatesEnabled -bool NO .../Expo.plist` on the .app |

### Step 4 — Verify a testID still exists in the app

```bash
# Find where a testID is used in the app source
grep -r 'testID="tab-discover"' src/
```

If it was renamed or removed, update the test to match the new testID.

---

## Architecture Notes

### How Detox connects to the app

Detox injects `Detox.framework` into the simulator app via `DYLD_INSERT_LIBRARIES`.
The framework opens a WebSocket connection to the Detox test runner. This is why
a **native build** (not Expo Go) is required.

### Why the test uses `DTXDisableMainRunLoopSync`

React Native 0.81 / Hermes always keeps 1+ work item on the main dispatch queue.
Detox's default idle-wait checks the main queue and **never returns** because the
queue is never completely empty. Setting `DTXDisableMainRunLoopSync: true` in
`launchArgs` skips this check, allowing Detox to proceed while `waitFor` timeouts
still work correctly.

### Binary flow

```
Release build (Xcode) → main.jsbundle injected → Expo Updates disabled
                                                         ↓
                                            Detox launches .app
                                         with DYLD_INSERT_LIBRARIES
                                                         ↓
                                              Detox WebSocket connects
                                                         ↓
                                                Jest runs test file
```

---

## Helpers Reference

### `detox/helpers/auth.ts`
```typescript
loginAsBuyer()    // Login as test-buyer@kidsmarketplace.test
loginAsSeller()   // Login as test-seller@kidsmarketplace.test
loginAsFree()     // Login as test-free@kidsmarketplace.test
loginAsSeller2()  // Login as test-seller-2@kidsmarketplace.test
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

### Environment: Staging only + Stripe API

All tests run against the Supabase staging instance. Sensible defaults are read from:
- `detox/.env` — Stripe secret key, test credentials (gitignored)
- Detox helpers have hardcoded fallbacks to the standard test accounts

The `STRIPE_SECRET_KEY` in `detox/.env` is used by tests that verify Stripe PaymentIntent
state transitions (pre-auth `requires_capture` → `succeeded` → `canceled`) via the Stripe
API. This key is **never bundled** into the app binary — it's only used server-side from
test scripts. See `04b-trade-complete.e2e.ts` for the reference implementation.

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

### Automated limitations (Detox infrastructure)

| Test | Limitation | Reason |
|---|---|---|
| TC-03 | Image upload not automated | iOS/Android photo picker is system UI |
| TC-06 | Stripe payment not automated | Stripe checkout is a system WebView |
| TC-19 | Carousel only shows on fresh install | Auth state may persist between runs |
| TC-28 | Review screen only reachable after completed trade | Seeded data must include a completed trade |
| TC-29 | Dispute screen only reachable from an active trade | Seeded data must include an active trade |
| TC-35, TC-36 | Safe meetup / timeline visible only in active trade detail | Seeded data must include active trades |
| All | Push notification delivery | Requires real device |
| All | Debug build hangs on `device.launchApp()` | RN main queue idle check — use Release build |
| All | `npx detox` may hang | Use `./node_modules/.bin/detox` or npm scripts instead |

### Excluded from Detox (covered elsewhere or not automatable)

These manual test cases are intentionally excluded from the Detox automation target.
They are either covered by the Playwright admin portal suite, require clock manipulation,
push notification infrastructure, or multi-device setups.

**Reason codes:** 🖥️ Admin portal (Playwright) | ⏰ Timer/clock-dependent | 📱 Push notification | 📡 Multi-device

| Manual TC(s) | Reason | Notes |
|---|---|---|
| TC-N01, N02 | 🖥️ Admin portal | Cart admin config — covered by Playwright suite |
| TC-P01–P08 | 🖥️ Admin portal | Tax admin config — covered by Playwright suite |
| TC-E05, E06 | 🖥️ Admin portal | Admin dispute resolution — covered by Playwright suite |
| TC-Q18–Q20 | 🖥️ Admin portal | Review moderation queue — covered by Playwright suite |
| TC-R09, R10 | 🖥️ Admin portal | Admin dispute resolve — covered by Playwright suite |
| TC-D01–D05 | ⏰ Timer/clock | Auto-complete, countdown, nudge — requires clock fast-forward |
| TC-B02 | ⏰ Timer/clock | Offer expiry + seller ignore prompt — requires clock fast-forward |
| TC-Q11 | ⏰ Timer/clock | Edit blocked after 24h window — requires clock fast-forward |
| TC-Q13 | ⏰ Timer/clock | 30-day same-counterparty cooldown — requires clock fast-forward |
| TC-Q14 | ⏰ Timer/clock | 24h post-completion cooldown — requires clock fast-forward |
| TC-G01–G04 | 📱 Push notification | All notification tests require push delivery infrastructure |
| TC-M13 | 📡 Multi-device | Realtime item unavailable in cart — requires two concurrent devices |

---

## AI Agent Prompt — Run Tests (Copy & Paste into Copilot Chat)

Copy the entire block below into GitHub Copilot Chat to run a test or suite.
Fill in the **CONFIGURE THIS SECTION** at the top, then paste.

---


## TASK: Detox E2E Test Runner — Kids P2P Marketplace (iOS Simulator)** **

### ─── CONFIGURE THIS SECTION ONLY ──────────────────────────────

#

# PICK ONE RUN MODE — uncomment the one you want, comment out the rest

#

# MODE 1: Single test file

RUN_MODE=single

TEST_FILES=detox/tests/04b-trade-complete.e2e.ts

TEST_LABEL="TC-04b: Trade Complete"

#

# MODE 2: Multiple specific test files (space-separated)

# RUN_MODE=group

# TEST_FILES="detox/tests/01-auth-login.e2e.ts 
detox/tests/02-auth-signup.e2e.ts"

# TEST_LABEL="Auth Tests"

#

# MODE 3: Smoke suite (4 critical tests — fastest pass/fail check)

# RUN_MODE=smoke

# TEST_FILES=

# TEST_LABEL="Smoke Suite"

#

# MODE 4: Full suite — all 57 tests

# RUN_MODE=full

# TEST_FILES=

# TEST_LABEL="Full Suite"

#

# DEVICE — defaults to iPhone 17 Pro (change if you have a different sim)

SIMULATOR_NAME="iPhone 17 Pro"

#

# LOG LEVEL — trace shows every step live, verbose is quieter

LOG_LEVEL=trace

#

# FLAKINESS CHECK — set to true to re-run each passing test once (DOUBLES run time)

FLAKINESS_CHECK=false

#

### ──────────────────────────────────────────────────────────────

## ⚠️ MANUAL PREREQUISITES — READ BEFORE RUNNING

Some tests require you to perform manual setup BEFORE the test can pass.
If any of these apply to your selected TEST_FILES, do them now:

| Test file | What you must do before running | Details |
|---|---|---|
| `04b-trade-complete.e2e.ts` | Ensure `detox/.env` has `STRIPE_SECRET_KEY` | Required for Stripe PaymentIntent API verification |
| `06-subscription.e2e.ts` | None (stops before Stripe checkout) | Stripe checkout WebView cannot be automated |
| `44-offer-lifecycle.e2e.ts` (TC-B06) | Configure a declining test card on buyer's Stripe customer | Tests valid-card path by default; decline requires manual card setup |
| `47-dispute-e2e-flow.e2e.ts` (TC-E02/E03/E04) | Ensure active trade exists (run 04b first or seed:staging:extended) | No admin setup needed — buyer-side flow only |
| `48-payout.e2e.ts` (TC-F03) | None — tests both bank-configured and needs-action states | Seed data may leave seller without bank |
| `51-seller-consequences.e2e.ts` (TC-J02/J03) | Requires seller with prior cancel counts in DB | Level 2/3 tests are documented as deferred; Level 1 always works |
| `53-bundle-flows.e2e.ts` | Run `npm run seed:staging:extended` | Bundle trades only seeded in extended mode |
| `54-cart-edge-cases.e2e.ts` (TC-M03/M04) | Run `npm run seed:staging:extended` | Second seller + multi-item data needed |
| `55-tax-checkout.e2e.ts` (TC-O03/O04) | Admin portal: toggle global tax ON for O01/O02; toggle OFF for O03/O04 | Run separately with correct tax state; O05 needs tax-exempt flag |
| `56-reviews-detailed.e2e.ts` (TC-Q16) | Requires 3 separate accounts reporting same review | Deferred — not fully automated |
| `57-refund-cancel.e2e.ts` | None — uses buyer-initiated flows | Runs autonomously |

---

## STRICT AGENT BOUNDARIES — READ BEFORE ACTING

You are a TEST RUNNER and ENVIRONMENT FIXER only.

✅ YOU MAY:

  - Boot a new simulator if none is running

  - Rebuild the binary when missing (npm run e2e:build:ios)

  - Re-seed the database (npm run seed:staging or seed:staging:extended)

  - Verify and install missing npm packages (targeted check, not full npm install)

  - Increase withTimeout values in the test file only

  - Fix import paths or missing /// <reference types="detox" /> headers

❌ YOU MAY NOT:

  - Touch any file in src/ or app/

  - Change test assertions (expect, toBeVisible, toHaveText)

  - Add, remove, or rename testIDs anywhere

  - Modify any helper in detox/helpers/

  - Change app navigation logic

  - Weaken assertions to force a pass

  - Interrupt, reset, or erase a simulator that is already running

If you are tempted to touch anything outside detox/tests/ and detox.config.json,

STOP and report it to me instead. Do not guess. Do not improvise on app code.

---

## STEP 1 — ENVIRONMENT PREFLIGHT

Run all checks in order. Fix setup blockers automatically. Report what was

healthy and what you had to fix before touching anything else.

### 1A — Environment Snapshot (always capture, always include in report)

```bash

sw_vers                          # macOS version

node -v                          # Node version

./node_modules/.bin/detox -v     # Detox version (not npx!)

xcrun simctl list devices | grep "$SIMULATOR_NAME"   # Simulator state

ls -lh ios/build/Build/Products/Release-iphonesimulator/PassItUp.app/main.jsbundle

```

### 1B — Simulator Check

Run: `xcrun simctl list devices | grep "$SIMULATOR_NAME"`

- If a simulator session is ALREADY BOOTED and actively running:

  **Use it directly — do NOT boot another simulator.**

  Multiple booted simulators cause Detox instability. The detox.config.json

  device spec uses `"state": "booted"` and Detox picks the first available

  booted device — running multiple leads to race conditions and failures.

  Verify only one is booted:

  `xcrun simctl list devices | grep "Booted"`

  Use `$SIMULATOR_NAME` for all steps in this run.

- If NO simulator is currently booted:

  Ensure only one will be booted (shut down any stale leftovers first):

  `xcrun simctl shutdown all`

  Boot the default device:

  `xcrun simctl boot "$SIMULATOR_NAME"`

  `open -a Simulator`

- Wait 10 seconds for the simulator to fully start before proceeding.

- Keep the simulator window visible and in focus throughout the entire run.

- Do NOT shut down, reset, or erase any simulator at any point.

### 1C — Binary Check

```bash

ls ios/build/Build/Products/Release-iphonesimulator/PassItUp.app

```

- If MISSING → check `main.jsbundle` exists inside it first

- If MISSING → rebuild: `cd p2p-kids-marketplace && npm run e2e:build:ios`

- This takes 10–15 minutes. Wait for full completion before proceeding.

### 1D — Seeded Data Check

Check which mode is needed:

- For tests 01–42 (single/smoke): `npm run seed:staging`

- For tests 43–57 (extended features): `npm run seed:staging:extended`

Re-seed if there is any doubt about account state:

```bash

cd p2p-kids-marketplace && npm run seed:staging

# OR for extended:

cd p2p-kids-marketplace && npm run seed:staging:extended

```

Expected accounts:

- Buyer:  test-buyer@kidsmarketplace.test  / TestBuyer123!

- Seller: test-seller@kidsmarketplace.test / TestSeller123!

- Free:   test-free@kidsmarketplace.test   / TestFree123!  (extended only)

- Seller2: test-seller-2@kidsmarketplace.test / TestSeller2123!  (extended only)

### 1E — Dependency Check

Check that the Detox binary link is correct:

```bash

cd p2p-kids-marketplace && ./node_modules/.bin/detox --version

# Expected: 20.46.0 — if hangs: ln -sf ../detox/local-cli/cli.js node_modules/.bin/detox

```

Also verify key npm packages exist:

```bash

node -e "require('detox'); console.log('detox OK')" 2>/dev/null || npm install detox

node -e "require('dotenv'); console.log('dotenv OK')" 2>/dev/null || npm install dotenv

```

### 1F — Stripe Key Check (for tests that verify PaymentIntents)

If TEST_FILES include `04b-trade-complete.e2e.ts` or any test that calls

the Stripe API directly:

```bash

ls p2p-kids-marketplace/detox/.env && grep STRIPE_SECRET_KEY p2p-kids-marketplace/detox/.env

```

If MISSING, ask the user to provide `STRIPE_SECRET_KEY`.

### 1G — Preflight Summary

Before moving to Step 2, tell me:

- What was already healthy

- What you fixed and how

- Confirm all 7 checks passed

---

## STEP 2 — BUILD THE RUN COMMAND

**MODE: single or group**

```bash

cd p2p-kids-marketplace

./node_modules/.bin/detox test \

  --configuration ios.sim.debug \

  --no-build \

  --loglevel $LOG_LEVEL \

  $TEST_FILES \

  2>&1 | tee "detox-run-$(date +%Y%m%d-%H%M%S).log"

```

**MODE: smoke**

```bash

cd p2p-kids-marketplace

npm run e2e:ios:smoke 2>&1 | tee "detox-run-$(date +%Y%m%d-%H%M%S).log"

```

**MODE: full**

```bash

cd p2p-kids-marketplace

npm run e2e:ios 2>&1 | tee "detox-run-$(date +%Y%m%d-%H%M%S).log"

```

Rules for all modes:

- Use `./node_modules/.bin/detox` — NOT `npx detox` (npx can hang with the wrapper binary)

- `--no-build` is always required — binary was verified in Step 1

- Keep the Simulator window open and in focus during the entire run

- Do NOT close or reset the Simulator mid-run

- For group/full runs, each test file runs sequentially — do not interrupt between files

---

## STEP 3 — FAILURE TRIAGE & RETRY POLICY

If any test fails, triage each failure using this decision tree:

| Failure message | Category | Your action |

|---|---|---|

| `App is not running` | Setup | Re-boot simulator + verify binary, then retry |

| `Element not found: by.id('tab-discover')` | Setup | Re-run seed:staging, then retry |

| `Element not found: by.id('discover-results-list')` | Setup | Re-run seed:staging, then retry |

| `Element not found: by.id('sp-wallet-balance-card')` | Setup | Check seed — buyer SP may be missing; re-run seed:staging:extended |

| Test times out on network call | Setup | Increase withTimeout in that test only, then retry |

| `Cannot find module` or npm error | Setup | Run targeted npm install for that package, then retry |

| `Element not found` on a testID that may be renamed | App Code | STOP — report to me, do not fix |

| Any assertion failure on app behavior or logic | App Logic | STOP — report to me, do not fix |

| Stripe API returns 401 | Setup | Check detox/.env has valid STRIPE_SECRET_KEY |

### Retry Policy

- Fix the setup issue, then re-run the FAILED TEST(S) ONLY — not the whole suite

- Maximum 2 retries per test

- Track all attempts in the report:

    Attempt 1: [result]

    Attempt 2: [result after fix X]

    Attempt 3: [final result]

- Stop retrying when: test passes, failure is app logic, or 3 attempts exhausted

- For group/full runs: do not let one failed test block other tests from running

---

## STEP 4 — FINDINGS REPORT

Deliver this structured report after all tests complete.

For group or full runs, repeat the Test Result block once per test file.

─────────────────────────────────────────────

### 🩺 Environment Snapshot

- macOS:       [version]

- Node:        [version]

- Detox:       [version]

- Simulator:   [was already running — used $SIMULATOR_NAME] OR [booted $SIMULATOR_NAME]

- Binary:      [existed — last modified X] OR [was missing — rebuilt]

- Seed:        [skipped — accounts confirmed] OR [re-seeded: staging/extended]

- Stripe key:  [present in detox/.env] OR [missing — Stripe checks skipped]

- Run mode:    $RUN_MODE — $TEST_LABEL

─────────────────────────────────────────────

### ✅ Preflight Fixes

[List what was broken and fixed, or "All clear — nothing needed fixing."]

─────────────────────────────────────────────

### 🧪 Test Results

(Repeat this block for every test file in the run)

**[$TEST_LABEL]** — detox/tests/NN-name.e2e.ts

- Status:          PASSED ✅ / FAILED ❌

- Duration:        [X seconds]

- Retry attempts:  [1 / 2 / 3]

- Assertions:

    ✅ waitFor(element-id) visible within Xms

    ✅ Screenshot captured: filename.png

    ❌ waitFor(element-id) — FAILED [reason]

─────────────────────────────────────────────

### 🏁 Suite Summary (for group / smoke / full runs)

| Test | Status | Duration | Retries |

|------|--------|----------|---------|

| TC-01 auth-login | ✅ PASSED | 12s | 1 |

| TC-04b trade-complete | ❌ FAILED | 18s | 3 |

Total: X passed / Y failed / Z skipped

─────────────────────────────────────────────

### ⏱ Performance Flags

List any assertion that took more than 5000ms — flakiness candidates:

  ⚠️ waitFor(trade-success-icon) — 7200ms in TC-04b (consider increasing withTimeout)

─────────────────────────────────────────────

### 🔁 Flakiness Check (only runs if FLAKINESS_CHECK=true)

Re-run each passing test once silently to confirm stability:

  TC-01: Run 1 ✅ 12s / Run 2 ✅ 11s → STABLE ✅

  TC-04b: skipped — test failed

─────────────────────────────────────────────

### 📸 Screenshots

For each test, list all captured screenshots:

detox/tests/04b-trade-complete.e2e.ts/

  ├── 04b-offer-screen-ready.png     ← offer screen loaded

  ├── 04b-sp-amount-entered.png      ← SP amount typed

  ├── 04b-disclaimer-accepted.png    ← disclaimer toggled

  ├── 04b-trade-success.png          ← success screen

  └── testFailed.png                 ← (only if failed)

Open all artifacts now:

`open p2p-kids-marketplace/artifacts/`

If any test failed, open its failure screenshot directly:

`open "p2p-kids-marketplace/artifacts/detox/tests/NN-name.e2e.ts/testFailed.png"`

─────────────────────────────────────────────

### ❌ Failure Details (one block per failed test)

**Test:** detox/tests/NN-name.e2e.ts

- Error message:      [exact Detox error]

- Failed assertion:   [which waitFor or expect line]

- Failure screenshot: [full path]

- Root cause:         Setup issue (fixed after X retries) OR App logic issue (needs your review)

- Recommended action: [re-seed / rebuild / your review required]

─────────────────────────────────────────────

### 📋 Logs

All run logs archived with timestamps:

`detox-run-[YYYYMMDD-HHMMSS].log`

To view: `cat detox-run-[timestamp].log`

```

---

## AI Agent Prompt Template — Adding a New Detox Test

Copy the prompt below, fill in the `[...]` sections, and paste it into GitHub Copilot chat.

```
I need to add a new Detox E2E test to the Kids P2P Marketplace app.

--- APP CONTEXT ---
App ID:           com.sameralzubaidi.p2pmarketplace
Detox version:    20.46.0
Test framework:   Detox + Jest (TypeScript)
Test folder:      p2p-kids-marketplace/detox/tests/
Helper folder:    p2p-kids-marketplace/detox/helpers/
testID manifest:  See .maestro/*.yaml files — each has a testID comment block
                  at the top listing every element ID for that screen.
CRITICAL:         All tests must use DTXDisableMainRunLoopSync: true in launchArgs
                  to prevent Detox from hanging on RN's main queue.

--- AVAILABLE HELPERS ---
import { loginAsBuyer, loginAsSeller, loginAsFree, loginAsSeller2 } from '../helpers/auth';
import { goToDiscover, goToProfile, goToHome, tapFirstListing } from '../helpers/navigation';
import { dismissSystemDialogs } from '../helpers/dialogs';

--- DETOX GLOBALS (no import needed) ---
device, element, by, waitFor, expect

--- TEST ACCOUNTS (created by: npm run seed:staging:extended) ---
Buyer:  test-buyer@kidsmarketplace.test  /  TestBuyer123!
Seller: test-seller@kidsmarketplace.test / TestSeller123!
Free:   test-free@kidsmarketplace.test   /  TestFree123!
Seller2: test-seller-2@kidsmarketplace.test / TestSeller2123!

--- CONVENTIONS TO FOLLOW ---
1. Filename:    NN-description.e2e.ts  (next number after 42, e.g. 43-my-feature.e2e.ts)
2. Header:      /// <reference types="detox" /> at top, then JSDoc comment block
3. beforeAll:   device.launchApp({ newInstance: true, launchArgs: { DTXDisableMainRunLoopSync: true, detoxURLBlacklistRegex: '.*' } }) + dismissSystemDialogs() + login
4. afterAll:    device.terminateApp()
5. Assertions:  Use waitFor().toBeVisible().withTimeout(8000) for dynamic content
6. Screenshots: await device.takeScreenshot('NN-step-name') at key moments
```
Failed as of July 1 


❌ FAILED (53 test files)
#	File	Duration	#	File	Duration
02	02-auth-signup.e2e.ts	14.0s	03	03-listing-create.e2e.ts	29.8s
04a	04a-trade-initiate.e2e.ts	44.9s	05	05-sp-wallet.e2e.ts	41.6s
06	06-subscription.e2e.ts	26.5s	07	07-cart-checkout.e2e.ts	47.8s
08	08-cancel-trade.e2e.ts	69.0s	09	09-profile.e2e.ts	50.7s
10	10-discovery-browse.e2e.ts	44.5s	11	11-home-dashboard.e2e.ts	31.2s
12	12-notification-center.e2e.ts	26.4s	13	13-notification-preferences.e2e.ts	55.8s
14	14-help-support.e2e.ts	54.4s	15	15-settings-legal.e2e.ts	40.1s
16	16-id-verification.e2e.ts	40.1s	17	17-seller-trade-view.e2e.ts	38.8s
20	20-filter-modal.e2e.ts	40.4s	21	21-category-filter.e2e.ts	45.0s
22	22-seller-trade-actions.e2e.ts	26.8s	23	23-forgot-password.e2e.ts	29.2s
24	24-messaging-inbox.e2e.ts	48.6s	25	25-sp-wallet-screen.e2e.ts	66.4s
26	26-sp-transaction-history.e2e.ts	49.0s	27	27-favorites.e2e.ts	77.3s
28	28-submit-review.e2e.ts	63.4s	29	29-trade-dispute.e2e.ts	68.7s
30	30-cart-screen.e2e.ts	88.2s	31	31-sell-action-sheet.e2e.ts	44.2s
32	32-referrals.e2e.ts	57.3s	33	33-payout-settings.e2e.ts	54.5s
34	34-my-listings.e2e.ts	44.6s	35	35-safe-meetup.e2e.ts	58.8s
36	36-trade-timeline.e2e.ts	54.5s	38	38-search-empty-state.e2e.ts	58.8s
39	39-badges.e2e.ts	33.7s	40	40-subscription-management.e2e.ts	43.6s
41	41-contact-support.e2e.ts	65.0s	42	42-edit-profile.e2e.ts	68.3s
43	43-cash-and-alternative-trades.e2e.ts	128.6s	44	44-offer-lifecycle.e2e.ts	125.7s
45	45-sp-reserve-transfer.e2e.ts	96.4s	46	46-sp-gating.e2e.ts	44.1s
47	47-dispute-e2e-flow.e2e.ts	55.5s	48	48-payout.e2e.ts	30.3s
49	49-completion-ctas.e2e.ts	62.1s	50	50-safety-ux.e2e.ts	30.7s
51	51-seller-consequences.e2e.ts	28.5s	52	52-value-stack.e2e.ts	59.7s
53	53-bundle-flows.e2e.ts	48.4s	54	54-cart-edge-cases.e2e.ts	64.2s
55	55-tax-checkout.e2e.ts	44.1s	56	56-reviews-detailed.e2e.ts	64.3s
57	57-refund-cancel.e2e.ts	62.8s			

---

## AI Agent Prompt — Trade E2E Run Prompt (Copy & Paste into Copilot Chat)

Copy the entire block below into GitHub Copilot Chat to run the Detox automated tests that cover the TradeFlow V2 manual test cases.
Fill in the **CONFIGURE THIS SECTION** at the top, then paste.

---

## TASK: TradeFlow V2 Detox Test Runner — Kids P2P Marketplace (iOS Simulator)**

**Covers:** 15 Detox test files (43–57) mapped to 120+ manual TC IDs across Groups A, B, C, E, F, H, I, J, K, L, M, O, Q, R.
**Source of truth (manual ref):** `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`

### ─── CONFIGURE THIS SECTION ONLY ──────────────────────────────

#
# PICK A RUN SCOPE — uncomment one block, comment out the rest
#

# SCOPE 1: Run ALL 15 trade-flow Detox test files (full run)
RUN_SCOPE=all-trade
TEST_FILES="detox/tests/43-cash-and-alternative-trades.e2e.ts \
  detox/tests/44-offer-lifecycle.e2e.ts \
  detox/tests/45-sp-reserve-transfer.e2e.ts \
  detox/tests/46-sp-gating.e2e.ts \
  detox/tests/47-dispute-e2e-flow.e2e.ts \
  detox/tests/48-payout.e2e.ts \
  detox/tests/49-completion-ctas.e2e.ts \
  detox/tests/50-safety-ux.e2e.ts \
  detox/tests/51-seller-consequences.e2e.ts \
  detox/tests/52-value-stack.e2e.ts \
  detox/tests/53-bundle-flows.e2e.ts \
  detox/tests/54-cart-edge-cases.e2e.ts \
  detox/tests/55-tax-checkout.e2e.ts \
  detox/tests/56-reviews-detailed.e2e.ts \
  detox/tests/57-refund-cancel.e2e.ts"
RUN_LABEL="All 15 TradeFlow V2 Detox Tests (43–57)"

# SCOPE 2: Single test file (uncomment and change the path)
# RUN_SCOPE=single
# TEST_FILES="detox/tests/43-cash-and-alternative-trades.e2e.ts"
# RUN_LABEL="TC-43: Cash & Alternative Trades"

# SCOPE 3: Specific set by group letter (uncomment and edit)
# RUN_SCOPE=group
# TEST_FILES="detox/tests/43-cash-and-alternative-trades.e2e.ts \
#   detox/tests/44-offer-lifecycle.e2e.ts"
# RUN_LABEL="Group A+B — Core + Offer Lifecycle"

#
# DEVICE
SIMULATOR_NAME="iPhone 17 Pro"

#
# LOG LEVEL
LOG_LEVEL=trace

### ──────────────────────────────────────────────────────────────

## DETOX TEST FILES → MANUAL TC MAPPING

Every Detox test file below automates one or more manual test cases from `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`:

| Detox file | Manual TC(s) covered | Group | Est. run time |
|---|---|---|---|
| `43-cash-and-alternative-trades.e2e.ts` | TC-A01 (Cash Only), TC-A02 (Accept SP) | A — Core Happy Paths | ~2 min |
| `44-offer-lifecycle.e2e.ts` | TC-B01 (decline), TC-B03 (competing), TC-B04 (buyer cancel), TC-B05 (max 3), TC-B06 (card declined) | B — Offer Lifecycle | ~2 min |
| `45-sp-reserve-transfer.e2e.ts` | TC-C01 (reserved), TC-C02 (restored decline), TC-C04 (stays reserved), TC-C05 (released), TC-C06 (restored cancel) | C — SP Behavior | ~1.5 min |
| `46-sp-gating.e2e.ts` | TC-C07 (free gating), TC-C08 (SP slider 50%) | C — SP Behavior | ~1 min |
| `47-dispute-e2e-flow.e2e.ts` | TC-E01 (report modal), TC-E02 (no auto-complete), TC-E03 (buyer UI), TC-E04 (seller UI) | E — Dispute Flow | ~1 min |
| `48-payout.e2e.ts` | TC-F01 (clean payout), TC-F02 (held on dispute), TC-F03 (needs action) | F — Payout | ~0.5 min |
| `49-completion-ctas.e2e.ts` | TC-H01 (free CTA), TC-H02 (SP saved), TC-H03 (SP pending), TC-H04 (cash upsell) | H — Completion CTAs | ~1 min |
| `50-safety-ux.e2e.ts` | TC-I01 (meetup card), TC-I02 (dismissible), TC-I03 (chat banner), TC-I04 (pre-message modal), TC-I05 (quick-reply) | I — Safety UX | ~0.5 min |
| `51-seller-consequences.e2e.ts` | TC-J01 (Level 1), TC-J02 (Level 2), TC-J03 (Level 3), TC-J04 (button visibility), TC-J05 (seller reasons) | J — Seller Consequences | ~0.5 min |
| `52-value-stack.e2e.ts` | TC-K01 ($0.99 fee), TC-K02 ($2.99 fee), TC-K03 (SP discount row) | K — Value Stack | ~1 min |
| `53-bundle-flows.e2e.ts` | TC-L01 (banner), TC-L02 (Confirm All), TC-L03 (offers tab), TC-L04 (single rows), TC-L05 (Buying tab), TC-L06 (Review screen), TC-L07 (Accept All), TC-L08 (individual accept) | L — Bundle Flows | ~1 min |
| `54-cart-edge-cases.e2e.ts` | TC-M01–M15 (full cart suite including multi-seller, saved carts, min value, favorites) | M — Cart | ~1 min |
| `55-tax-checkout.e2e.ts` | TC-O01–O07 (sales tax breakdown, SP recalculation, global/node toggle, exempt badge, history, refund) | O — Tax | ~1 min |
| `56-reviews-detailed.e2e.ts` | TC-Q01–Q17 (prompt, star required, comment cap, anonymous, skip, mutual status, profile visibility, avg rating, breakdown, edit, one-per-trade, flag, auto-hide, own-review block) | Q — Reviews | ~1 min |
| `57-refund-cancel.e2e.ts` | TC-R01–R08, R11–R13 (buyer cancel, seller decline, expiry, card decline, seller in_progress cancel, refund breakdown, SP reversal, payout withheld, notifications, idempotency, timeline) | R — Refund State Machine | ~1 min |

### What is NOT covered by Detox

These manual TCs are excluded from this Detox run because they require infrastructure the automated tests cannot provide:

| Excluded TC(s) | Reason | Covered by |
|---|---|---|
| TC-B02, B07, D01–D05, C03, Q11, Q13, Q14, R03 | ⏰ Clock fast-forward | Manual testing only |
| TC-B08, B09 | Chat freeze/active states | Manual testing only |
| TC-E05, E06, F02, N01, N02, O03, O04, O07, P01–P08, Q18–Q20, R09, R10, R12 | 🖥️ Admin portal screens | Playwright admin suite |
| TC-G01–G04 | 📱 Push notification delivery | Manual testing only |
| TC-M13 | 📡 Multi-device realtime | Manual testing only |

---

## PREREQUISITES

### ⚠️ Critical: Detox binary link

```bash
cd p2p-kids-marketplace
ln -sf ../detox/local-cli/cli.js node_modules/.bin/detox
./node_modules/.bin/detox --version   # Expected: 20.46.0
```

### 1. Build the Release binary (one-time)

```bash
cd p2p-kids-marketplace
npm run e2e:build:ios
```

Verify binary: `ls ios/build/Build/Products/Release-iphonesimulator/PassItUp.app/main.jsbundle` (~11MB)

### 2. Seed the database (always do before each run)

```bash
cd p2p-kids-marketplace && npm run seed:staging:extended
```

Required accounts:
| Role | Email | Password | Subscription |
|---|---|---|---|
| Buyer | test-buyer@kidsmarketplace.test | TestBuyer123! | Kids Club+ Active (SP ≥ 15) |
| Seller | test-seller@kidsmarketplace.test | TestSeller123! | Kids Club+ Active |
| Free | test-free@kidsmarketplace.test | TestFree123! | None |
| Buyer 2 | test-buyer-2@kidsmarketplace.test | TestBuyer2123! | Kids Club+ Active |
| Buyer 3 | test-buyer-3@kidsmarketplace.test | TestBuyer3123! | Kids Club+ Active |
| Seller 2 | test-seller-2@kidsmarketplace.test | TestSeller2123! | Kids Club+ Active |

### 3. Boot the simulator (single instance only)

```bash
xcrun simctl shutdown all
xcrun simctl boot "$SIMULATOR_NAME"
open -a Simulator
# Verify: xcrun simctl list devices | grep "Booted" — exactly 1
```

---

## STRICT AGENT BOUNDARIES — READ BEFORE ACTING

You are a **DETOX TEST RUNNER AND ENVIRONMENT FIXER** only.

✅ YOU MAY:
  - Boot simulator / rebuild binary / re-seed DB / fix Detox binary link
  - Increase `withTimeout` values in test files
  - Fix import paths or `/// <reference types="detox" />` headers
  - Triage failures and retry (max 2 retries per test)

❌ YOU MAY NOT:
  - Modify any file in `src/` or `app/`
  - Change test assertions (expect, toBeVisible, toHaveText)
  - Add, remove, or rename testIDs
  - Modify helpers in `detox/helpers/`
  - Skip test steps to force a pass
  - Interrupt, reset, or erase a running simulator
  - `git push` anything

---

## STEP 1 — ENVIRONMENT PREFLIGHT

### 1A — Environment Snapshot

```bash
sw_versions
node -v
./node_modules/.bin/detox -v
xcrun simctl list devices | grep "$SIMULATOR_NAME"
ls -lh ios/build/Build/Products/Release-iphonesimulator/PassItUp.app/main.jsbundle
```

### 1B — Simulator Check

- If a simulator is ALREADY BOOTED: use it directly — do NOT boot another
- If none booted: `xcrun simctl shutdown all` → `xcrun simctl boot "$SIMULATOR_NAME"` → `open -a Simulator`
- Wait 10s. Verify exactly 1 booted.

### 1C — Binary Check

```bash
ls ios/build/Build/Products/Release-iphonesimulator/PassItUp.app
```
If missing → `npm run e2e:build:ios` (10–15 min)

### 1D — Seed Check

```bash
cd p2p-kids-marketplace && npm run seed:staging:extended
```

### 1E — Dependency Check

```bash
./node_modules/.bin/detox --version   # Must be 20.46.0
node -e "require('detox'); console.log('detox OK')"
node -e "require('dotenv'); console.log('dotenv OK')"
```

### 1F — Preflight Summary

Report what was healthy and what was fixed before proceeding.

---

## STEP 2 — BUILD THE RUN COMMAND

```bash
cd p2p-kids-marketplace
./node_modules/.bin/detox test \
  --configuration ios.sim.debug \
  --no-build \
  --loglevel $LOG_LEVEL \
  $TEST_FILES \
  2>&1 | tee "detox-trade-run-$(date +%Y%m%d-%H%M%S).log"
```

Rules:
- Use `./node_modules/.bin/detox` — NOT `npx detox`
- `--no-build` always — binary verified in Step 1
- Keep Simulator window open and in focus
- Do not interrupt between test files

---

## STEP 3 — FAILURE TRIAGE & RETRY POLICY

| Failure message | Category | Action |
|---|---|---|
| `App is not running` | Setup | Re-boot simulator + verify binary, retry |
| `Element not found: by.id(...)` | Setup | Re-run `seed:staging:extended`, retry |
| Test times out on network | Setup | Increase `withTimeout` in that test, retry |
| `Cannot find module` | Setup | Targeted npm install, retry |
| Assertion failure on app behavior | App Logic | STOP — report, do not fix |
| Stripe API 401 | Setup | Check `detox/.env` has valid `STRIPE_SECRET_KEY` |

**Retry policy:** Max 2 retries per test file. Fix setup issue, re-run FAILED files only. Stop retrying after 3 attempts or when failure is app logic.

---

## STEP 4 — FINDINGS REPORT

─────────────────────────────────────────────
### 🩺 Environment Snapshot
- macOS:       [version]
- Node:        [version]
- Detox:       [version]
- Simulator:   [was already running / booted $SIMULATOR_NAME]
- Binary:      [existed / was missing — rebuilt]
- Seed:        [re-seeded: extended]
- Run scope:   $RUN_SCOPE — $RUN_LABEL
─────────────────────────────────────────────

### ✅ Preflight Fixes
[What was fixed, or "All clear — nothing needed fixing."]

─────────────────────────────────────────────
### 🧪 Test Results

(Repeat per test file)

**$RUN_LABEL** — detox/tests/NN-name.e2e.ts
- Status:          PASSED ✅ / FAILED ❌
- Duration:        [X seconds]
- Retries:         [1 / 2 / 3]
- Manual TC(s):    [e.g., TC-A01, TC-A02]
- Assertions:
    ✅ [element-id] visible within Xms
    ❌ [element-id] — FAILED [reason]

─────────────────────────────────────────────
### 🏁 Suite Summary

| Test file | Manual TC(s) | Status | Duration | Retries |
|---|---|---|---|---|
| 43-cash-and-alternative-trades | TC-A01, A02 | ✅ PASSED | 128s | 1 |
| 44-offer-lifecycle | TC-B01, B03–B06 | ❌ FAILED | 125s | 3 |
| ... | ... | ... | ... | ... |

Total: X passed / Y failed / Z skipped

─────────────────────────────────────────────
### ❌ Failure Details

**detox/tests/NN-name.e2e.ts**
- Error message:  [exact Detox error]
- Failed assertion: [which waitFor/expect line]
- Root cause:     Setup / App logic
- Manual TC(s) affected: [e.g., TC-B01, TC-B03]

─────────────────────────────────────────────
### ⏱ Performance Flags

Assertions taking >5000ms:
  ⚠️ waitFor(element-id) — 7200ms in TC-44

─────────────────────────────────────────────
### ⏭️ Manual TCs Not Covered by This Run

| TC(s) | Reason | Run separately? |
|---|---|---|
| TC-B02, B07, D01–D05, C03, Q11, Q13, Q14, R03 | ⏰ Clock fast-forward | Manual |
| TC-B08, B09 | Chat freeze UX | Manual |
| TC-E05, E06, N01, N02, O03, O04, P01–P08, Q18–Q20, R09, R10 | 🖥️ Admin portal | Playwright suite |
| TC-G01–G04 | 📱 Push notification | Manual |
| TC-M13 | 📡 Multi-device | Manual |

─────────────────────────────────────────────
### 📋 Logs

`detox-trade-run-[YYYYMMDD-HHMMSS].log`
To view: `cat detox-trade-run-[timestamp].log`

```
