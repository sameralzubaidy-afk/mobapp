# Group L Execution Trace — L01 mobile precondition (2026-08-21)

Run dir: `e2e-test-results/group-l-playwright-l01-l04-2026-08-21/`
Target: staging `drntwgporzabmxdqykrp` · admin portal `http://localhost:3001` (HTTP 200) · Metro `:8081` (HTTP 200) · iPhone 17 Pro Max (iOS 26.1) booted, `com.sameralzubaidi.p2pmarketplace` (PassItUp.app) installed.

## Environment / credential gate (verified before running)
- Credential gate CLEARED: `test-automation/trade-flow-v2/.env` and `p2p-kids-admin/.env.local` both have `PLAYWRIGHT_ADMIN_*` / `ADMIN_E2E_*` filled (email len 31 = `test-admin@kidsmarketplace.test`, password len 14; values not echoed). No placeholders (`ask your team lead`, `___FILL_IN___`) remain.
- Admin RBAC: `test-admin@kidsmarketplace.test` → `role_based_access_control` role='admin' (per QA registry, granted 2026-08-21; login verified via GoTrue).
- DB read-only precheck (service-role client, same path the spec uses):
  - `test-seller` = `14be337c-…` node `550e8400-…`; `test-buyer` = `49243010-…` node `550e8400-…` (same node).
  - Seller's latest item at run start: `07af560b-…` (available, approved_at NULL) — **no pending item existed** → mobile precondition (submit fresh item) required.
  - Seller `phone_verified_at` = **NULL** (registry "phone verified" note is doc drift) → phone-verification gate legitimately fires on publish.

## Mobile leg — log in as test-seller
- Landing (logged out) → `landing-login-button` → filled `login-email-input` (`test-seller@kidsmarketplace.test`) + `login-password-input` (fixture password `TestSeller123!`, committed seed value; not echoed) → `login-submit-button` → Home/Dashboard as test-seller ("TS" avatar, Norwalk Central). Login transition fast (<2s).

## Mobile leg — submit a fresh item (L01 precondition)
- Deep link `p2pkidsmarketplace://create-item` → "New Item" screen (proven path bypassing the non-AX-exposed Sell sheet).
- `dev-add-test-photo` (fixture) → form renders (1/10 photos).
- `dev-set-category` → category **Books** (verified by OCR: "Dev: Set Category (Books)"; AX label stays static — locator-gap note).
- Title: `QA L Group Chain Item 0821` (verified in AX tree + OCR).
- Price: `15` — **corrupted to `155` by a dismiss-keyboard tap landing on the price field while the numeric keypad was up** (§5.2 violation by the agent); long-press → Select All failed on the keypad (no edit menu); **terminate + relaunch + redo** per §5.2. Session persisted across relaunch.
- Redo: photo → category Books → title → price `15` (verified) → dismissed keypad by tapping at the pixel-measured "Allow buyers to pay with Swap Points" text (pt 545) → **condition** required (`canPublish()`), `ConditionSelector` rows not AX-exposed (locator gap) → tapped "New" condition row at pt 752 (first tap at 745 missed) → **Submit button turned green (#5DBB8E)** (enabled).
- **Phone-verification gate fired** (`listing-phone-verification-*`): entered `5551234002` → Send Code → DEV bypass (`DEV mode: use code 123456`) → OTP entry **bulk paste mangled** ("125…"), recovered via **Resend** (clears digits) → entered `1 2 3 4 5 6` **one digit at a time** → auto-verify hit a state race ("Please enter the 6-digit code") → tapped **Verify** manually → modal closed, **"Thanks for submitting!"** success screen.
- DB read-back (service-role): item **`f5bac12c-f001-4c03-b9d3-bc6749106ec4`** status=**pending**, price=15, approved_at/approved_by NULL, title "QA L Group Chain Item 0821". Buyer-visible (status=available) count = **0**. → **L01 mobile precondition MET; chain anchor set.**

## Evidence
- `screenshots/00-landing-logged-out.png` … `screenshots/25-item-submitted-pending.png` (26 screenshots; see report).

## Friction / notes
- ItemCreate AX tree reports LOGICAL content coordinates (unchanged by scroll) — screenshot+OCR is the source of truth on this screen (§5.9).
- `ConditionSelector` rows and dev-fixture labels not surfaced with their dynamic label in the AX tree (locator gap — flagged).
- OTP digit entry: bulk typing drops characters (auto-advance race); digit-by-digit entry + manual Verify is the reliable recipe.
- Phone-verification gate expected (test-seller `phone_verified_at` NULL on staging) — registry "phone verified: yes" is doc drift.

## Next step
Run Playwright `--grep "L0[1-3]"` (in progress at time of writing) → then L04 mobile edit leg → run `--grep "L04"`.
