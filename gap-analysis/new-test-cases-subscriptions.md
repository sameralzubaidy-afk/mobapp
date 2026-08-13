# STAGING — New Test Cases (Subscriptions / Payouts / SP Wallet)

> **STATUS: DRAFT — DO NOT MERGE into the canonical file without explicit per-batch approval.**
> **Target canonical file:** `cross-checked-and-consolidated/MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md`
> **Drafted:** 2026-08-13 · grounded against current source (`p2p-kids-marketplace/src/screens/profile/PaymentMethodsScreen.tsx`, `subscription/JoinKidsClubScreen.tsx`, `components/subscription/JoinKidsClubButton.tsx`, plus this-session reads of `ContinueKidsClubScreen`, `ManageKidsClubScreen`, `MySubscriptionScreen`, `seller/PayoutSettingsScreen.tsx`, `seller/SellerEarningsScreen.tsx`, `sp/SpWalletScreen.tsx`).
> **Entry format:** matches this file's convention — `### TC-XXX · Description` heading, then `**Ref:**`, `**Actors:**`, `**Objective:**`, numbered `**Steps:**`, bulleted `**Expected Result:**`.
> **Merge instructions:** append new Groups M and N after Group L (both in the `Test Case Index` table and in the body, before the non-indexed `## Regression` section); append `C08–C12`, `F07–F08`, `G07–G11`, `I07–I09` to their existing groups in both index and body.

---

## Index addendum (rows to add to the `Test Case Index` table)

| Group | TC# | Description |
|---|---|---|
| **M — Payment Methods (Card on File)** | TC-M01 | Payment Methods — loading state |
| | TC-M02 | Empty state + Add Payment Method (Stripe sheet) |
| | TC-M03 | Saved-card display + security banner |
| | TC-M04 | Update Payment Method |
| | TC-M05 | Remove This Card (confirm + success) |
| | TC-M06 | Go Back |
| | TC-M07 | Backend contract — attach / detach / retryFailedPayment branches |
| **N — Kids Club Join & Continue** | TC-N01 | JoinKidsClub value-prop + web CTA |
| | TC-N02 | JoinKidsClub web redirect (passitup.com) |
| | TC-N03 | Route-alias reachability (JoinKidsClub vs deep-link-only aliases) |
| | TC-N04 | ContinueKidsClub active-subscription variant |
| | TC-N05 | ContinueKidsClub loading state |
| | TC-N06 | ContinueKidsClub trial-ending urgency badge |
| **C — Manage & Cancel** | TC-C08 | Manage Kids Club+ free/no-subscription state |
| | TC-C09 | Manage Kids Club+ expired state |
| | TC-C10 | My Subscription free-user state |
| | TC-C11 | My Subscription "Learn More" link |
| | TC-C12 | My Subscription "Member Since" value (latent bug) |
| **F — Payout Dashboard & Earnings** | TC-F07 | Seller Earnings error state + Retry |
| | TC-F08 | Seller Earnings Load More pagination |
| **G — Payout Methods & Verification** | TC-G07 | Payout Settings — "Edit Details" sheet |
| | TC-G08 | "Cannot Delete Primary/Only Method" guard |
| | TC-G09 | "Cannot Set as Primary" (unverified) guard |
| | TC-G10 | Payout history Load More |
| | TC-G11 | NoMethodModal flow |
| **I — SP Wallet Balance & Earn** | TC-I07 | SP Wallet — "Reserved in trades" card |
| | TC-I08 | SP Wallet — "Wallet Not Found" error |
| | TC-I09 | SP Wallet — pending-release summary note |

---

## Group M — Payment Methods (Card on File)

### TC-M01 · Payment Methods — loading state

**Ref:** FLOW-12A · PaymentMethodsScreen
**Actors:** test-buyer

**Objective:** Verify the loading state while the saved card is fetched.

**Steps:**
1. Open **Settings → Manage Payment Methods** (route `PaymentMethods`).
2. Observe the screen immediately on mount.

**Expected Result:**
- A spinner with the text `Loading payment methods...` shows while `get-payment-method` resolves.
- The header reads "Payment Methods".

### TC-M02 · Empty state + Add Payment Method (Stripe sheet)

**Ref:** FLOW-12A · PaymentMethodsScreen · `create-payment-setup-intent` + `attach-payment-method`
**Actors:** test-free

**Objective:** Verify the no-card empty state and the Stripe Payment Sheet add flow.

**Steps:**
1. As **test-free** (no saved card), open Payment Methods.
2. Observe the empty state.
3. Tap **Add Payment Method**.
4. In the Stripe Payment Sheet, complete a test card.

**Expected Result:**
- Empty state shows **No Payment Method** with `Add a credit or debit card to submit offers on items. Your payment information is securely stored with Stripe.`
- The button shows `Adding...` while the sheet opens; the Stripe Payment Sheet is a SetupIntent flow (no immediate charge).
- On success, a success alert appears (one of `Payment Method Added` / `Payment Method Saved` / `Success`) and the Saved Card view replaces the empty state.
- The `create-payment-setup-intent` and `attach-payment-method` edge functions are invoked.

### TC-M03 · Saved-card display + security banner

**Ref:** FLOW-12A · PaymentMethodsScreen
**Actors:** test-buyer

**Objective:** Verify the saved card renders brand/last4/expiry and the security banner.

**Steps:**
1. As **test-buyer** (with a saved card), open Payment Methods.

**Expected Result:**
- The card shows **Saved Card**, the capitalized brand, the mask `•••• •••• •••• {last4}`, and **Expiry Date** `MM/YYYY`.
- Buttons **Update Payment Method** and **Remove This Card** are present.
- Security banner shows **Secure Payments** with `Your payment information is encrypted and processed securely through Stripe. We never store your full card details on our servers.`
- A **Go Back** link appears at the bottom.

### TC-M04 · Update Payment Method

**Ref:** FLOW-12A · PaymentMethodsScreen · `attach-payment-method`
**Actors:** test-buyer

**Objective:** Verify updating the saved card reuses the Stripe sheet and refreshes the card.

**Steps:**
1. Tap **Update Payment Method**.
2. Enter a new test card in the Stripe Payment Sheet.

**Expected Result:**
- The button shows `Updating...` while busy.
- After success, the card view refreshes with the new brand/last4 and a success alert appears.

### TC-M05 · Remove This Card (confirm + success)

**Ref:** FLOW-12A · PaymentMethodsScreen · `detach-payment-method`
**Actors:** test-buyer

**Objective:** Verify card removal requires confirmation and invokes detach.

**Steps:**
1. Tap **Remove This Card**.
2. In the confirm alert, tap **Cancel** (first pass).
3. Repeat and tap **Remove**.

**Expected Result:**
- Alert **Remove Payment Method** shows `Are you sure you want to remove this payment method? You will need to add a new one before submitting any paid offers.` with **Cancel** / **Remove**.
- **Cancel** leaves the card intact.
- **Remove** shows **Removed** / `Your payment method has been removed.` and the empty state returns.
- The `detach-payment-method` edge function is invoked.

### TC-M06 · Go Back

**Ref:** FLOW-12A · PaymentMethodsScreen
**Actors:** test-buyer

**Objective:** Verify the Go Back link returns to the previous screen.

**Steps:**
1. Tap **Go Back**.

**Expected Result:**
- The app returns to the prior screen (Settings).

### TC-M07 · Backend contract — attach / detach / retryFailedPayment branches

**Ref:** FLOW-12A · `attach-payment-method` · `detach-payment-method` · `retry-failed-payment`
**Actors:** test-free, test-buyer

**Objective:** Document and verify the three backend paths and the retry-result alert variants.

**Steps:**
1. Add a card and observe the attach + retry sequence.
2. Remove the card and observe detach.
3. Add a card when the account has no failed payment (normal) and again when a failed payment exists.

**Expected Result:**
- Add → `create-payment-setup-intent` (Stripe), then `attach-payment-method`.
- After attach, `retryFailedPayment` runs; a true success shows **Payment Method Added**; `NO_FAILED_PAYMENT` / `NO_OPEN_INVOICE` / `NOT_FOUND` show **Payment Method Saved**; other non-success falls through to **Success** (`Payment method added successfully.`).
- Remove → `detach-payment-method`; an unauthenticated remove shows `You must be logged in to manage payment methods.`

---

## Group N — Kids Club Join & Continue

### TC-N01 · JoinKidsClub value-prop + web CTA

**Ref:** FLOW-12 · JoinKidsClubScreen · JoinKidsClubButton
**Actors:** test-free

**Objective:** Verify the static value-prop, web-managed card, footnote, and CTA.

**Steps:**
1. From the free-user SP strip, Plans, or an upsell, navigate to **JoinKidsClub**.

**Expected Result:**
- Header "Kids Club+"; headline **Get more out of every trade**; subheadline `Kids Club+ is a membership that rewards the way you buy and sell on Pass It Up.`
- Three benefit rows: **Earn Swap Points on every sale** · **Pay a flat $1.49 fee instead of a percentage** · **Spend SP on purchases (up to 50%)**.
- Web card **Membership is managed on the web** with `Complete your Kids Club+ membership on our website. It takes about a minute, and you can pay with a card, Apple Pay, or Google Pay.` and `Your benefits unlock automatically in the app right after you subscribe.`
- CTA **Join on the web** with hint `Manage your membership at passitup.com`.
- Footnote `No charge in the app. You'll be taken to passitup.com to complete your membership securely.`
- No price cards and no in-app purchase UI.

### TC-N02 · JoinKidsClub web redirect (passitup.com)

**Ref:** FLOW-12 · `subscriptionWeb.openJoinKidsClubWeb`
**Actors:** test-free

**Objective:** Verify the CTA opens the external membership page with the user's email.

**Steps:**
1. Tap **Join on the web**.
2. Observe the external browser.

**Expected Result:**
- The external browser opens `https://passitup.com/join?email=<user email>`.
- No charge occurs in-app; after returning, the CTA is re-enabled.

### TC-N03 · Route-alias reachability (JoinKidsClub vs deep-link-only aliases)

**Ref:** FLOW-12 · AppNavigator route registration
**Actors:** test-free

**Objective:** Document which Kids Club routes are reachable by navigation and flag the orphan aliases.

**Steps:**
1. Navigate to **JoinKidsClub** from the app (SP strip / Plans / upsell).
2. Confirm the other three route names are not reachable by in-app navigation.

**Expected Result:**
- Only `JoinKidsClub` opens `JoinKidsClubScreen` via navigation.
- `SubscriptionChoice`, `KidsClubOverview`, and `SubscriptionPlans` all render `JoinKidsClubScreen` but have no `navigate()` call sites — deep-link only.
- **Flag:** orphan files `SubscriptionChoiceScreen.tsx`, `KidsClubOverviewScreen.tsx`, `SubscriptionPlansScreen.tsx` exist but are unregistered; the existing Group A cases target those names.

### TC-N04 · ContinueKidsClub active-subscription variant

**Ref:** FLOW-12 · ContinueKidsClubScreen
**Actors:** test-buyer

**Objective:** Verify the active-subscription early-return view.

**Steps:**
1. Open **ContinueKidsClub** while the account already has an active subscription.

**Expected Result:**
- Shows `✅ Kids Club+ Active` with `Your subscription is already active and your premium benefits are available.` and a **Go Back** button.
- **Flag:** the `Already Subscribed` alert is unreachable (the active state early-returns before the CTA renders); the `ContinueKidsClub` route is itself effectively deep-link-only (its `navigate()` call sites live in the unregistered `SubscriptionChoiceScreen.tsx`).

### TC-N05 · ContinueKidsClub loading state

**Ref:** FLOW-12 · ContinueKidsClubScreen
**Actors:** test-free

**Objective:** Verify the loading state while trial status loads.

**Steps:**
1. Open **ContinueKidsClub**.

**Expected Result:**
- A `Loading...` spinner shows while `getTrialStatus` resolves, then the content renders.

### TC-N06 · ContinueKidsClub trial-ending urgency badge

**Ref:** FLOW-12 · ContinueKidsClubScreen
**Actors:** test-trial

**Objective:** Verify the urgency badge copy when 7 or fewer trial days remain.

**Steps:**
1. As a trial user with 7 or fewer days remaining, open **ContinueKidsClub**.

**Expected Result:**
- The badge reads `{N} day left in trial` (1 day) or `{N} days left in trial` (2–7 days).
- With more than 7 days, the badge reads `{trialDays} free days • no charge today`.

---

## Group C — Manage & Cancel (additions)

### TC-C08 · Manage Kids Club+ free/no-subscription state

**Ref:** FLOW-12 · ManageKidsClubScreen
**Actors:** test-free

**Objective:** Verify the free state and its subscribe CTA.

**Steps:**
1. As **test-free**, open **Manage Kids Club+**.

**Expected Result:**
- Card shows `You don't have an active Kids Club+ subscription.` with a **Subscribe to Kids Club+** button that navigates to **JoinKidsClub**.

### TC-C09 · Manage Kids Club+ expired state

**Ref:** FLOW-12 · ManageKidsClubScreen
**Actors:** test-buyer (expired)

**Objective:** Verify the expired info box and re-subscribe CTA.

**Steps:**
1. Open **Manage Kids Club+** with an expired subscription.

**Expected Result:**
- Info box **Your subscription has expired** with `Re-subscribe to restore Kids Club+ access and unfreeze any remaining Swap Points.` and a **Re-subscribe to Kids Club+** button.
- **Note:** the cancel-reason "Other reason" free-text input is already covered by the corrected TC-C05 — not duplicated here.

### TC-C10 · My Subscription free-user state

**Ref:** FLOW-12 · MySubscriptionScreen
**Actors:** test-free

**Objective:** Verify the free plan view and upgrade CTA.

**Steps:**
1. As **test-free**, open **My Subscription**.

**Expected Result:**
- Plan card shows **Free Plan** (no `ACTIVE member` badge); footer shows **Renew Date** only (no **Member Since** row).
- Button **Upgrade to Kids Club+** navigates to `UpgradePlan`.

### TC-C11 · My Subscription "Learn More" link

**Ref:** FLOW-12 · MySubscriptionScreen
**Actors:** test-buyer

**Objective:** Verify the benefits "Learn More" link routes to the SP-definition help section.

**Steps:**
1. As a paid member, open **My Subscription** and tap **Learn More**.

**Expected Result:**
- Navigates to the Help screen with the `sp_definition` section.

### TC-C12 · My Subscription "Member Since" value (latent bug)

**Ref:** FLOW-12 · MySubscriptionScreen
**Actors:** test-buyer

**Objective:** Document the hardcoded "Member Since" value as a latent bug to verify.

**Steps:**
1. As a paid member, open **My Subscription** and read the **Member Since** row.

**Expected Result:**
- The row renders the literal `May 2024` regardless of the actual subscription start date.
- **Flag for product:** this is a hardcoded string, not derived from the subscription record — worth a product-side look.

---

## Group F — Payout Dashboard & Earnings (additions)

### TC-F07 · Seller Earnings error state + Retry

**Ref:** FLOW-22 · SellerEarningsScreen
**Actors:** test-seller

**Objective:** Verify the error state and the Retry re-load.

**Steps:**
1. Open **My Earnings** while the earnings fetch fails (e.g., network error).
2. Tap **Retry**.

**Expected Result:**
- Shows **Failed to Load Earnings** with the error message and a **Retry** button.
- Retry re-runs the load and shows the earnings once it succeeds.

### TC-F08 · Seller Earnings Load More pagination

**Ref:** FLOW-22 · SellerEarningsScreen
**Actors:** test-seller

**Objective:** Verify payout-list pagination.

**Steps:**
1. As **test-seller** with more than 20 payouts, open **My Earnings** and tap **Load More**.

**Expected Result:**
- The list grows by 20 per tap; **Load More** disappears when no more payouts remain; refreshing resets the list to the first 20.

---

## Group G — Payout Methods & Verification (additions)

### TC-G07 · Payout Settings — "Edit Details" sheet

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller

**Objective:** Verify the bottom-sheet "Edit Details" option.

**Steps:**
1. Open **Payout Settings**, tap a payout method's kebab menu, then tap **Edit Details**.

**Expected Result:**
- Alert **Edit Details** shows `Editing payout method details is not yet available. Contact support for changes.`

### TC-G08 · "Cannot Delete Primary/Only Method" guard

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller

**Objective:** Verify the delete guards for a primary and for an only method.

**Steps:**
1. With only one method (which is primary), open the method sheet and tap **Delete Method**.
2. With a primary plus at least one other method, attempt to delete the primary.

**Expected Result:**
- Only method → **Cannot Delete Only Method** / `Add another payout method first before removing this one.`
- Primary with others → **Cannot Delete Primary Method** / `Please set another method as primary first, then delete this one.`

### TC-G09 · "Cannot Set as Primary" (unverified) guard

**Ref:** FLOW-23 · PayoutSettingsScreen
**Actors:** test-seller (with an unverified method)

**Objective:** Verify an unverified method cannot be set primary.

**Steps:**
1. Attempt to set an unverified method as primary (via the radio or the sheet's **Set as Primary**).

**Expected Result:**
- Alert **Cannot Set as Primary** shows `` This method has status "{status_message}". Please wait until it is verified before setting it as primary. ``
- The sheet's **Set as Primary** option is disabled with the subtext `Verification required before setting as primary`.

### TC-G10 · Payout history Load More

**Ref:** FLOW-22 · PayoutSettingsScreen
**Actors:** test-seller

**Objective:** Verify payout-history pagination.

**Steps:**
1. With more than 5 payouts, open **Payout Settings** and tap **Load More** in **Payout History**.

**Expected Result:**
- The list grows by 5 per tap; refreshing resets the list to the first 5.

### TC-G11 · NoMethodModal flow

**Ref:** FLOW-22 · PayoutSettingsScreen
**Actors:** test-seller (no payout method)

**Objective:** Verify the no-method withdrawal guard modal.

**Steps:**
1. With no payout method configured, tap **Withdraw Now**.

**Expected Result:**
- Modal **Payment Method Required** shows `To withdraw your earnings, you need to add and verify a payout method first.` with **Add Payout Method** (opens the add flow) and **Cancel**.

---

## Group I — SP Wallet Balance & Earn (additions)

### TC-I07 · SP Wallet — "Reserved in trades" card

**Ref:** FLOW-10 · SpWalletScreen
**Actors:** test-buyer

**Objective:** Verify the reserved-SP card appears only when SP is reserved in pending offers.

**Steps:**
1. As a subscriber with an active SP-backed offer (`reserved_sp > 0`), open **SP Wallet**.

**Expected Result:**
- Card **Reserved in trades** shows `{reserved_sp} SP` and `SP used in pending offers — returned if trade is cancelled.`
- The card is absent when `reserved_sp = 0`.

### TC-I08 · SP Wallet — "Wallet Not Found" error

**Ref:** FLOW-10 · SpWalletScreen
**Actors:** test-buyer

**Objective:** Verify the wallet-not-found error state.

**Steps:**
1. Open **SP Wallet** under a condition where the wallet cannot be loaded.

**Expected Result:**
- Shows `💳` **Wallet Not Found** with `Unable to load your SP wallet.`
- **Flag:** this requires `getWallet` to return null (e.g., an RLS/read failure) — `getWallet` auto-inserts a missing wallet row, so this state is rare.

### TC-I09 · SP Wallet — pending-release summary note

**Ref:** FLOW-10 · SpWalletScreen
**Actors:** test-buyer

**Objective:** Verify the pending-release summary when SP releases are scheduled.

**Steps:**
1. As a subscriber with pending SP releases, open **SP Wallet**.

**Expected Result:**
- Note `{totalPending} SP Pending Release` with `Your pending SPs will be released individually, {releaseDays} days after each trade you complete.`
