# Phase 23 (v2) — AUTH Groups F, H, I + AUTH-TC-E05 Re-Attempt — QA Report

**Run:** 2026-08-17 · **Device:** iPhone 17 Pro Max Simulator (iOS 26.1) · Expo RN dev build + Metro
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**Agent:** QA Test Agent (execution-only) · **Scope:** iOS mobile surface only

**Verdict roll-up: 9 PASS / 1 FAIL / 7 BLOCKED / 0 SKIPPED** (17 cases: F01–F06, H01–H07, I01–I03, E05)

---

## 1. Pre-flight & setup

- Read operating playbook `.github/instructions/QA-Test-Agent.instructions.md` (§4–§9) + repo memory (`qa-test-accounts.md`, `locator-conventions.md`, `simulator-keyboard-suppression.md`).
- Source-pre-read (per the generalized pre-read rule): `SignupScreen` (+DEV autofill), `ProfileSetupScreen` (waitlist modal), `PhoneVerificationScreen`, `OnboardingScreen`/`onboarding-screens.ts`, `WelcomeScreen`/`FeatureHighlightsScreen`/`SubscriptionChoice`, `JoinKidsClubScreen` (R7 web-first), `DiscoverScreen` (F06 scope logic), `ItemCreateScreen` (`canPublish`/`handlePublish`, `dev-add-test-photo`), `CategorySelectModal` (native fullScreen Modal), `ConditionSelector`, `PublishButton`, `AppNavigator` linking config, `services/discovery.ts` + `fn_*` node RPCs.
- Staging node preconditions verified (read-only): ZIP `06850` → **Norwalk Central** (active, exact match, no waitlist); ZIP `07999` → **Little Falls Central** (nearest, waitlist path). `F02/F03` inactive-ZIP precondition confirmed available.
- Clean-state verify (§5.8): plain launch → clean Landing, no LogBox/deep-link overlay.

---

## 2. Per-case traces

### Group F — Node / ZIP gating & waitlist (F01–F06)

| TC | Verdict | Trace |
|---|---|---|
| **F01** | ✅ **PASS** | User A (Alice autofill, ZIP `06850`). "📍 Norwalk, CT" resolved; **Complete Setup** → success dialog "Your profile has been created!" with **no waitlist modal** (active ZIP) → onboarding → Home header shows **"Norwalk Central"**. Evidence: `f1-05`, `f1-06`. |
| **F02** | ✅ **PASS** | User B (ZIP `07999`). **Complete Setup** → **"We're Coming Soon!"** waitlist modal, fallback node **Little Falls Central**, buttons **Continue Trading / Join Waitlist**. Modal is a transparent RN `Modal` (tappable; buttons verified). Evidence: `f2-02`, `f2-03`. |
| **F03** | ✅ **PASS** | User C (ZIP `07999`). Tapped **Join Waitlist** → **"Waitlist Confirmed"** modal (fallback **Little Falls Central**) → **Got it** → onboarding → Home on fallback node. Evidence: `f3-02`. |
| **F04** | ✅ **PASS** | User B. Tapped **Continue Trading** → modal closed, **no waitlist join**, proceeded into onboarding → Home on **Little Falls Central**. Evidence: `f4-01`. |
| **F05** | ✅ **PASS** | ZIP lookup rendered "📍 {City}, {State}" in green beneath the field (Norwalk, CT for `06850`; Whippany, NJ for `07999`). Evidence: `f5-01`. |
| **F06** | ❌ **FAIL** (spec/design drift) | test-buyer → Discover shows **"1205 results"** (all items) by default — NOT node-scoped. **No "Show All Nodes" toggle exists** anywhere in the UI. Source confirms design intent: `DiscoverScreen.tsx` L253-254 *"do not auto-apply location filter — Requirement: load all discover items by default"*; node-scoping only via an opt-in ZIP+radius **location filter** (`resolveNodeScopeByLocation`, `nodeIdsInScope`). The guide's expected result (default = My Node only; toggle to Show All) is **not implemented**. Evidence: `f6-01`, `f6-02`. |

### Group H — Profile Setup & Onboarding (H01–H07)

| TC | Verdict | Trace |
|---|---|---|
| **H01** | ✅ **PASS** | User E. Tapped avatar circle → native photo picker → selected photo → "Choose Photo" → **avatar preview updated** → name + ZIP `06850` → Complete Setup → profile created. Evidence: `h1-01`, `h1-02`. |
| **H02** | ✅ **PASS** | User D. Name "A" + ZIP `123` → **Complete Setup** blocked; both errors render: "Display name must be at least 2 characters" + "Zip code must be 5 digits" (testIDs `display-name-error`, `zip-code-error`). Evidence: `h2-01`. |
| **H03** | ⛔ **BLOCKED** (not cleanly inducible) | Requires an avatar **upload failure** mid-submit (network interruption at the exact upload moment). No clean toolset mechanism to interrupt the storage upload on demand. **Source-verified** non-blocking: `ProfileSetupScreen.tsx` L190-192 on upload error → `Alert.alert('Warning','Profile will be created without avatar. You can add it later.')`, then continues creating the profile without `avatar_url`. Recommend a `__DEV__` toggle to force the avatar-upload error (mirror the S03/S04 error-simulation pattern). |
| **H04** | ⛔ **BLOCKED** (spec drift — route orphaned) | Guide: standalone **Welcome screen** → Get Started. `WelcomeScreen.tsx` + route `Welcome: 'welcome'` exist in source, but the current onboarding flow is a **single 5-slide carousel** that routes `replace('Home')`, bypassing WelcomeScreen. Deep link `p2pkidsmarketplace://welcome` from the authenticated state did **not** navigate (still Home) — route unreachable in the active stack. The merged carousel's Skip/Get Started behavior is covered by **H06/H07 (PASS)**. |
| **H05** | ⛔ **BLOCKED** (spec drift — route orphaned) | Same as H04: guide's standalone 4-slide **Feature Highlights** carousel (`FeatureHighlightsScreen.tsx`, route `feature-highlights`) is not in the current flow; deep link did **not** navigate. The onboarding carousel (5 slides, incl. points/SP/safety) covers the content; H06/H07 verified its controls. |
| **H06** | ✅ **PASS** | Both variants: **(a) Skip** → Home (user A); **(b) swipe to slide 5 "Safety First" → Get Started** → Home on **Little Falls Central** (user C). Progress dots tracked slides. Evidence: `h6-01`, `h6-02`. |
| **H07** | ✅ **PASS** | After completing/skipping onboarding, relaunch lands **straight on Home** (no carousel) — verified for users A and C. |

### Group I — Subscription Choice (I01–I03)

| TC | Verdict | Trace |
|---|---|---|
| **I01** | ⛔ **BLOCKED** (feature removed — R7 web-first) | The `subscription-choice` route resolves to **`JoinKidsClubScreen`** (R7 web-first: opens external browser, App Store Guideline 3.1.3 compliant). **No "Start Free Trial" at $0.00 onboarding option exists.** Evidence: `i-01-subscription-choice-joinkidsclub.png`. |
| **I02** | ⛔ **BLOCKED** | Same — no **Continue Free** onboarding option; subscription choice moved off the onboarding flow. |
| **I03** | ⛔ **BLOCKED** | Precondition (trial-limit user) **and** the trial CTA screen do not exist in the current build. |

### AUTH-TC-E05 (re-attempt) — Gate blocks listing until verified

| Verdict | ⛔ **BLOCKED** (at the category-selection step — toolset limitation, not app defect) |
|---|---|

**What Phase 23 resolved (verified empirically this run):**
- ✅ **ItemCreate scroll blocker is NOT a defect** — the Phase 22 "0-movement swipe" was correct conditional rendering (no photo = nothing below the fold). With a photo present, the form **renders and scrolls** normally (scroll offset confirmed via pixel-mapping).
- ✅ **`dev-add-test-photo` fixture works** — one tap injects a placeholder photo (`(1/10 photos)`), rendering the full form (title/description/category/condition/brand/color/age/gender/SP/price/publish).
- ✅ **`dev-fill-test-user-1` autofill now generates unique email+phone** per tap (`qa.alice.<ts>@kidsmarketplace.test`, `+12025555…`) — **no Select All override needed** (Phase 22 friction removed).
- ✅ **Deep-link path** `p2pkidsmarketplace://create-item` reliably reaches ItemCreate, bypassing the Sell Options Sheet.
- ✅ Unverified-user setup path intact: fresh signup → **skip OTP verify** → terminate/relaunch → session restores → onboarding carousel → Skip → Home (phone unverified).
- ✅ Title typing verified (`title-input` = "E05 Unverified Listing Test").

**The blocker (new):** `canPublish()` requires `category !== null`, but **`CategorySelectModal` is a native `presentationStyle="fullScreen"` RN `Modal`** presented in a **separate window/layer** that the mobile-mcp toolset cannot reach:
- AX tree does **not** expose the modal content (tree shows only the underlying ItemCreate + keyboard — 69 elements, no `category-*` rows).
- Taps land on the **underlying layer**, not the modal: tapping the modal's **× close at (410,115) did not close it but DID dismiss the ItemCreate keyboard** (kb-pixels 21,994 → 25) — decisive proof.
- Category row taps (multiple positions, incl. measured "Toys & Games" row) did not select.
- Same class as the Sell Options Sheet in this run (deep-link workaround exists for the sheet; none for the category).
- `idb` not installed (no alternative tap mechanism).

**Gate logic is SOURCE-VERIFIED** (though UI-unreachable): `handlePublish` → `canPublish()` (photo+title+category+condition+price) → `isPhoneRequired(sellerId)` → for an unverified user returns `true` → `setShowPhoneVerificationModal(true)` (required mode) → publish blocked; `onSuccess` → retries publish. `isPhoneRequired` confirmed gating on phone-verification status.

Evidence: `e05-33` (modal open), `e05-34` (keyboard up), `e05-35` (row tap unresponsive), `e05-36` (× tap unresponsive + keyboard dismissed — decisive), plus the earlier `e05-16…e05-32` sequence.

---

## 3. Batch summary

| Group | PASS | FAIL | BLOCKED | Notes |
|---|---|---|---|---|
| F (6) | 5 | 1 (F06) | 0 | ZIP gating + waitlist fully verified |
| H (7) | 4 | 0 | 3 (H03/H04/H05) | Setup + validation + carousel verified; H04/H05 orphaned routes |
| I (3) | 0 | 0 | 3 | Subscription-choice screen removed (R7 web-first) |
| E05 | 0 | 0 | 1 | Scroll blocker resolved; new category-modal blocker |
| **Total (17)** | **9** | **1** | **7** | 0 SKIPPED |

---

## 4. Load-time observations

| Screen / transition | Observed |
|---|---|
| Landing → Create Account / Login | <1s |
| Signup submit → OTP screen | ~2s |
| OTP dev-bypass success → Continue | <1s |
| Profile Setup submit → success dialog | ~1s |
| Onboarding Skip/Get Started → Home | <1s |
| Deep link → ItemCreate | ~2s |
| Dev cold-start (bundle download) | ~5–10s (environment artifact, non-deterministic) |

---

## 5. Cross-cutting findings

### 5.1 Spec drift (guide vs current build) — for doc update
1. **F06** — Discover defaults to **all items** (1205), node-scoping only via an opt-in **location (ZIP+radius) filter**; there is **no "Show All Nodes" toggle**. Guide's "My Node default + Show All toggle" is not implemented (may be intentional — source comment calls all-items default a "requirement"). **FAIL.**
2. **H04/H05** — Standalone Welcome + Feature Highlights screens are **orphaned/dead routes**; the current flow is a single 5-slide onboarding carousel (which H06/H07 verified). **BLOCKED.**
3. **I01–I03** — Subscription Choice onboarding screen **removed**; `subscription-choice` now routes to `JoinKidsClubScreen` (R7 web-first). **BLOCKED.**

### 5.2 Locator / BP-53 exposure gaps (follow-up candidates)
- `complete-setup-button` (ProfileSetup) is **not AX-exposed** (had to pixel-scan the green pill) — same gap class as `login-back-button`/Profile rows from Phase 22.
- `CategorySelectModal` rows (`category-*`), Sell Options Sheet options, and the modal `×` are native-modal content (separate layer — not an AX-exposure fix; needs a different interaction strategy or a DEV fixture).
- OTP dev-bypass dialog `OK` **is** exposed (`otp-dev-bypass-dialog-ok-button`) — improvement over Phase 22.

### 5.3 Environment / toolset
- **Native `presentationStyle="fullScreen"` RN `Modal`s are unreachable by the mobile-mcp toolset** (AX + taps) in this environment — confirmed with decisive evidence (× tap dismissed the underlying keyboard but not the modal; AX tree excludes modal content). Transparent RN `Modal`s (waitlist modals, GlobalAlert) remain fully tappable/assertable.
- Unverified-user session persistence is **flaky in the dev build**: survived one relaunch, lost on a later one (app relaunched to Landing with a stale `sb-*-auth-token` that had to be cleared via `qa-logout`). Worth a dev note.

### 5.4 Friction vs Phase 22 (cost-trend tracking — requested)
| Phase 22 friction | Phase 23 status |
|---|---|
| Signup form keyboard/focus fights (dominant time sink) | **✅ Fixed** — unique autofill fills all fields in one tap (no Select All override, no DOB corruption) |
| Repeated per-case signups | **✅ Fixed** — unique autofill + deep-link navigation |
| ItemCreate scroll blocker (blocked E05 final step) | **✅ Fixed** — was correct conditional rendering; `dev-add-test-photo` fixture now renders + scrolls the form |
| AX staleness / below-fold coordinate guessing | **➖ Partially improved** — deep-link path + unique autofill reduce navigation; still need pixel-scans for non-exposed controls (`complete-setup-button`) |
| Native-fullScreen-modal tap failure (Sell Options Sheet) | **❌ Still present** — now also blocks CategorySelectModal (new E05 blocker). Same root cause class; needs a DEV fixture or a different interaction path |

**Net:** The three highest-impact Phase 22 bottlenecks (signup entry, ItemCreate scroll, per-case signup cost) are resolved and measurable. The remaining friction is the native-fullScreen-modal interaction wall, which is now the single dominant blocker.

---

## 6. Recommended follow-ups (separate tasks — QA does not fix)
1. **DEV fixture to set category without the modal** (e.g. `dev-set-category-<id>` on ItemCreate, mirroring `dev-add-test-photo`) — unblocks E05's form completion so the phone-verification gate is UI-reachable.
2. **DEV toggle to force avatar-upload failure** (mirror S03/S04 error-simulation) — unblocks H03.
3. **Doc drift updates** to the AUTH guide: F06 (no Show All toggle — location-filter model), H04/H05 (Welcome/Feature Highlights merged into the single 5-slide carousel), I01–I03 (Subscription Choice removed — R7 web-first), E05 (category modal is native-fullScreen; `dev-add-test-photo` fixture now exists).
4. **Confirm unverified-user session persistence** in the dev build (stale-token relaunch behavior observed twice).
5. **(Carry-over) BP-53 exposure** for `complete-setup-button` and other non-exposed profile controls.

---

## 7. QA Session Handoff

**Run:** Phase 23 (v2) — AUTH Groups F, H, I + E05 re-attempt · 2026-08-17 · iPhone 17 Pro Max (iOS 26.1) · Expo RN dev + Metro.

**Scope executed:** iOS mobile surface. Admin-web portions (none in this batch) remain the Playwright path.

**Verdicts (17):**
- **PASS (9):** F01, F02, F03, F04, F05, H01, H02, H06, H07
- **FAIL (1):** F06 — Discover default scope is All Items, no "Show All Nodes" toggle (spec/design drift, source-confirmed intentional)
- **BLOCKED (7):** H03 (not cleanly inducible), H04/H05 (Welcome/Feature Highlights routes orphaned), I01/I02/I03 (Subscription Choice removed — R7 web-first), E05 (category modal native-fullScreen, unreachable by toolset)

**Highest-priority product/QA signal:** **F06 (FAIL)** is the only genuine product/spec mismatch — the "My Node vs Show All Nodes" model in the guide does not match the shipped "All items default + opt-in location filter" design. Recommend a product decision: either update the guide (if all-items default is intended) or restore node-scoped default.

**Blocker for future runs:** the native fullScreen Modal interaction wall (Sell Options Sheet + CategorySelectModal). The deep-link workaround solved the sheet; a `dev-set-category` fixture is the smallest unblock for E05. H03 needs a dev error-simulation toggle.

**Environment:** Simulator left on clean Landing, AsyncStorage fully cleared (`qa-logout`), no code/config touched. Evidence in `e2e-test-results/phase23-auth-group-f-h-i-e05-2026-08-17/evidence/`.

---

*Generated 2026-08-17 · QA Test Agent (execution-only). Verdict roll-up: 9 PASS / 1 FAIL / 7 BLOCKED / 0 SKIPPED.*
