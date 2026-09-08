# QA Task 43m — AUTH Group P + E04/F02-F04/H06 on Android — Report

**Run folder:** `e2e-test-results/qa-task43m-auth-group-p-android-2026-09-08/`
**Date:** 2026-09-08 · **Device:** `Medium_Phone_API_36.1` (Android 16, emulator-5554, 1080×2400 px)
**App:** `com.sameralzubaidi.p2pmarketplace` (expo-dev-client, Metro :8081). HEAD `dc16f31d` (43L commit; no app-src drift).
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**LLM:** DeepSeek V4 Flash. Agent-Improvement-1 (R78) + R79-1 cold-reload discipline applied.
**Group G (G01–G06): formally EXCLUDED (owner-confirmed) — not executed.**

## 1. Verdict roll-up

| Verdict | Count | Rows |
|---|---|---|
| ✅ PASS (freshly driven) | 20 | P01 P02 P03 P05 P06 P07 P08 P09 P11 P12 P13 P14 P15 P17 P18 P19 (16) · H06 (Skip leg → full PASS) · F02 F03 F04 · E04 (functional; see finding) |
| ✅ CREDITED (not re-driven; Step 0) | 3 | P04 P10 P16 |
| 🔴 FAIL | 0 | — |
| 🟡 PARTIAL | 0 | — |
| ⏭️ Excluded/deferred | — | G01–G06 (owner), H04/H05/I01–I03 (dead), J14/J15/N01/O05 (43a), C01/C02/C04/C07 (OAuth/identity), S08/S11-Case2 (dedicated session) |

**AUTH Android coverage statement:** With this round closing cleanly, **AUTH's Android coverage is DONE except the separately-scoped S08/S11-Case2 dedicated session.** Every AUTH row now carries a genuine Android verdict (or is excluded/credited). Step-0 P10/P16 are credited (not re-driven), which the reconciliation tracker now reflects.

## 2. Step 0 — Credit-check outcome (P04/P10/P16)

**Outcome: CREDITED.** FIX-Task-1 (`17e8f4ef` — "Sell FAB Color Correction (Cross-Platform Safe)", 2026-09-07) changed ONLY `PersistentTabBar/index.tsx` and left evidence in `e2e-test-results/fix-task-1-sell-fab-color/` for BOTH platforms:
- `fix-task1-android-home-fab-green.png` / `fix-task1-ios-home-fab-green.png` — Home with the **green `#5DBB8E` FAB** (raised circle between Discover and Trades; node chip + right cluster visible).
- `fix-task1-android-sell-sheet-open.png` / `fix-task1-ios-sell-sheet-open.png` — FAB tap opens the Sell sheet with **"List One Item" + "Bulk Upload"** + Cancel.
- `git diff 17e8f4ef..HEAD -- PersistentTabBar/ ComposerBar/` → **empty** (no code drift since). The on-session fresh bundle also confirmed the green FAB (R79-1 discriminating check at first test-seller login).
- **P04** (floating pill layout, tab order, FAB) — Android-verified in 43b AND re-covered by FIX-Task-1's green-FAB evidence.
- **P10** (FAB globally visible + opens Sell sheet with both options) — CREDITED.
- **P16** (FAB sheet unchanged; Bulk Upload reachable only from FAB) — CREDITED (sheet content = both options on both platforms).

These are recorded as **already-Android-verified (credited)**, NOT freshly executed — so the tracker reflects it correctly this time.

## 3. Per-case evidence (Part 1 — Group P, Android)

All driven as **test-buyer** (`49243010-…`, Norwalk Central) except where noted; screenshots in `screenshots/`.

| TC | Verdict | Evidence |
|---|---|---|
| AUTH-TC-P01 | ✅ PASS | Node chip "Norwalk Central" = `header-node-chip` **ViewGroup (not a button)**; tap → no nav/modal/picker (still Home). `P01-node-chip-readonly.png`. |
| AUTH-TC-P02 | ✅ PASS | Home header right cluster left→right by AX x: `header-notifications-btn` (bell, Button "Notifications") → `header-chat-btn` (chat, Button "Messages") → `header-profile-btn` (avatar, Button "Open profile"). **No logout element anywhere in the header tree.** (Source: AppHeader main variant.) |
| AUTH-TC-P03 | ✅ PASS | Prep: test-seller sent a message on pending trade `d8e14d86` (Nintendo Switch Games Bundle) → DB row `c4223318` (read_at NULL). test-buyer Home header-chat-badge = **1** → tap chat → Messages screen with the new conversation "1m ago" top. Opened the chat → DB `read_at` set 16:04:45 + `delivery_status=read` (badge cleared on later Home). `P03-header-chat-badge-1-messages.png`. |
| AUTH-TC-P04 | ✅ CREDITED | (Step 0 — 43b layout + FIX-Task-1 green FAB, both platforms.) |
| AUTH-TC-P05 | ✅ PASS | Bottom nav = Home/Discover/[Sell FAB]/Trades/Basket only — **no Inbox tab** (AX tree 0 Inbox matches). Messages reachable via header chat and works (P03 leg). |
| AUTH-TC-P06 | ✅ PASS | Trades tab → "My Trades": summary **Your Offers 3 / In Progress 0 / Needs Action 0 / Completed 26** (matches DB). Active list = 3 pending cards (Kids Bicycle / LEGO Star Wars Set / Nintendo Switch Games Bundle), each with item title, "Buying" counterpart role, PENDING tag, `Sep 6 · $45.00`, countdown, View Details. `P06-trades-active.png`. |
| AUTH-TC-P07 | ✅ PASS | History tab → completed/cancelled rows **newest first** (Sep 3 rows above Sep 2 rows): Cancelled (light-red) + Bought (light-blue) badges, View Item affordance. `P07-trades-history.png`. |
| AUTH-TC-P08 | ✅ PASS | Trades tab badge = **3** = active non-terminal only (DB: 3 pending + 0 in_progress; 26 completed + 153 cancelled excluded — `getActiveTradeCount` `.not('status','in','(completed,cancelled)')` source-verified). |
| AUTH-TC-P09 | ✅ PASS | Added "Building Blocks Bucket" ($20, test-seller-3) to basket → DB `cart_items` row `8193b91b` → Basket badge **1** + "View Trade Basket" on the item; Basket screen shows subtotal/total $20. Home tab shows green active highlight when selected. `P09-basket-badge-1.png`, `P09-basket-screen.png`. |
| AUTH-TC-P10 | ✅ CREDITED | (Step 0.) |
| AUTH-TC-P11 | ✅ PASS | Tap composer → inline field focuses, keyboard appears, still on Home (no navigation); typed "Lego Star Wars Set" lands in `composer-input`. |
| AUTH-TC-P12 | ✅ PASS | Composer "+" (typed title) → **New Item (Photos step), NO Sell sheet**; after adding a test photo the **Title field = "Lego Star Wars Set"** (pre-filled). `P12-composer-plus-title-prefilled.png`. |
| AUTH-TC-P13 | ✅ PASS | Composer "+" with empty text → fresh New Item; Title field shows only the placeholder `e.g., Nike Sneakers Size 5` (empty, no crash/error). `P13-composer-empty-title.png`. |
| AUTH-TC-P14 | ✅ PASS | Composer camera → New Item → **camera auto-launched** (Android native camera2: camera permission prompt → "While using the app" → shutter → captured → Done) → returned to New Item Photos step with **Title = "Lego Star Wars Set"**. `P14-camera-title-prefilled.png`. |
| AUTH-TC-P15 | ✅ PASS | Pre-filled Title persisted through photo-add + AI attempt (AI on the mock-uploaded and on the real camera-captured photo both hit the "Photo analysis issue" error card — AI produced no suggestion on this env). Title never overwritten. Source-corroborated (R12): `handleApplyAllAI` L883-884 and `handleApplyFieldAI` L921 gate on `!titlePrefilledFromComposerRef.current` → a composer-pre-filled title is **never** replaced by an AI title. AI-suggestion-produced leg env-blocked (noted). `P15-ai-notitle-overwrite.png`. |
| AUTH-TC-P16 | ✅ CREDITED | (Step 0.) |
| AUTH-TC-P17 | ✅ PASS | **Profile** → `profile-logout` → "Logout / Are you sure?" modal → Logout → Landing. **Settings** (`profile-settings` → DANGER ZONE) → `settings-sign-out-button` → "Sign Out / Are you sure?" modal → Sign Out → Landing. Both reachable; logout removed from header confirmed from P02. |
| AUTH-TC-P18 | ✅ PASS | DB `analytics_events` (authoritative): test-buyer `composer_bar_tapped` ×2 (16:08:27 focus P11, 16:12:45 focus P14), `composer_bar_submit` `has_text:true` ×2 (16:08:57 P12, 16:12:57 P14 camera) and `has_text:false` ×1 (16:11:57 P13 empty). All clean no-throw, exactly-once. |
| AUTH-TC-P19 | ✅ PASS | AX tree: `tab-trades` = **Button "Trades"**, `tab-trades-badge` present; `header-chat-btn` = **Button "Messages"** (`header-chat-badge`); node chip = ViewGroup, **not announced as a button**. |

### Group P design/copy notes (all surfaces checked)
- All primary CTAs canonical green `#5DBB8E`; destructive actions (Profile Logout, Settings Sign Out) render red; headers use neutral `#F0F0F0` circular actions. No off-brand legacy hexes observed on the driven surfaces.
- My Trades summary "Completed 26" matches DB completed-trade count — no R54 discrepancy.

## 4. Per-case evidence (Part 3 — H06 Skip leg)

**H06 — full PASS (Skip leg upgraded; Get-Started leg was 43b).** Fresh signup `qa.h06.and.1788885081@kidsmarketplace.test` (user `ca72efe8`; name "H06 Skip Parent"; phone +15559991788; DOB 15/06/1990). ZIP 06850 → "📍 Norwalk, CT" → Complete Setup → Success → **5-slide onboarding carousel**. Swiped through slides 1→5 (progress dots tracked 0→4, `onboarding-dot-N` elongated on current). On the final "Safety First!" slide tapped **Skip** (not Get Started) → **Home** rendered correctly (node chip Norwalk Central, avatar "HS", tab bar + FAB mounted immediately — the Phase-24 no-tab-bar-after-Skip bug is NOT present). DB: `onboarding_skipped_at` **16:40:58Z set**, `onboarding_completed_at` NULL, profile_completed true, node `550e8400-…-0001`. `H06-skip-to-home.png`.

## 5. Per-case evidence (Part 2 — F02/F03/F04/E04, Android)

Each used a **fresh Alice dev-autofill signup** (unique email/phone) to avoid consuming reusable-persona phone quota.

| TC | Verdict | Evidence |
|---|---|---|
| AUTH-TC-F02 | ✅ PASS | Fresh signup, Complete Profile ZIP **07999** → "📍 Whippany, NJ" → Complete Setup → **"We're Coming Soon!"** modal: "not quite active in 07999 yet … we've connected you with traders in **Little Falls Central**", "Want to be notified…?" with **Join Waitlist** (primary) + **Continue Trading** (secondary), both AX-exposed (`waitlist-join-button`, `waitlist-continue-trading`). `F02-inactive-zip-modal.png`. (User "F02 Waitlist Parent" `505327b2` dismissed via Continue Trading → fallback node, no waitlist row.) |
| AUTH-TC-F03 | ✅ PASS | Fresh signup, ZIP 07999 → "We're Coming Soon!" → **Join Waitlist** → **"Waitlist Confirmed"** modal ("added you to the waitlist for 07999 … you can trade … in Little Falls Central") → **Got it** → proceeded into the app (carousel). DB (user "F03 Waitlist Joiner" `5fc3fa3d`): `zip_waitlist` row **07999 / pending / 16:49:50Z** + node Little Falls Central + profile_completed. `F03-waitlist-joined-proceeded.png`. |
| AUTH-TC-F04 | ✅ PASS | Fresh signup, ZIP 07999 → "We're Coming Soon!" → **Continue Trading** → modal closed → proceeded into the app. DB (user "F04 Continue Trader" `a0afa214`): node **Little Falls Central**, **NO zip_waitlist row**. `F04-continue-trading-proceeded.png`. |
| AUTH-TC-E04 | ✅ PASS (functional) + ⚠️ copy/UX finding | Fresh signup phone `+12025555948396`. Sends #1 16:55:28 (auto on entry), #2 16:57:02 (resend), #3 16:58:21 (resend) — 3 `phone_verification_codes` rows. Resend #4 → **"Error / Rate limit exceeded"** dialog; **NO 4th code row** → the 3/hr-per-phone rate-limit gate fires on Android. `E04-rate-limit-exceeded.png`. **Finding (copy/UX):** the standalone signup `PhoneVerificationScreen` shows the **raw** "Rate limit exceeded" via `Alert('Error', err.message)` and leaves **Resend active** (no 3600s disable), instead of the guide's friendly "Too many attempts. Try again in {N} seconds." + disabled-resend countdown. Root cause (source): `PhoneVerificationScreen.handleResendCode` catch L74-78 has no `OTPRateLimitError` special-case, unlike the phone-gate modal/`usePhoneVerification`/`EditProfileScreen` which carry the friendly retryAfterSeconds copy. See §6 finding 2. |

## 6. Findings

1. **[LOW — copy/UX deviation, R58] Signup `PhoneVerificationScreen` rate-limit copy:** after the 4th OTP send the app shows `Alert('Error', 'Rate limit exceeded')` — a generic dialog with the raw backend message — and the Resend Code control stays enabled (no retry countdown). The guide (E04) and the phone-gate modal both expect friendly "Too many attempts. Please try again in 3600 seconds." copy with the resend disabled. Root cause source-confirmed (`PhoneVerificationScreen.tsx` L74-78 catch, no `OTPRateLimitError` branch). **Recommended dev fix:** route `OTPRateLimitError` (it carries `retryAfterSeconds`) → friendly copy + disable the resend button with the retry countdown, mirroring `EditProfileScreen`/`usePhoneVerification`. Functional gate verified PASS regardless.
2. **[INFO — P15 AI leg]** AI auto-fill cannot produce a real suggestion on staging for mock-URL or camera-captured photos (both hit "Photo analysis issue" — the same env limitation as 43g J02). The no-overwrite guarantee is source-enforced + on-device verified (Title preserved through the AI attempt). The "AI produced a conflicting title and it was refused" leg remains env-blocked until a working AI fixture exists.
3. **[INFO — Android signup field discipline (tooling runbook, R77-series)]** The Create-Account form shifts up ~82 px when a lower field takes focus (keyboard-driven ScrollView). Reusing stale AX coordinates for the DOB row misfired twice (digits landed in the phone field). Working recipe this session: press BACK to dismiss the keyboard before every field tap, re-list for the CURRENT coordinate, verify field focus before typing; DOB auto-advances Day→Month→Year once the Day box is genuinely focused; phone must be entered E.164 (`+1…`), else "Invalid phone number format". Recorded in session memory.

## 7. App state left behind / residue
- **test-buyer** (`49243010-…`): 2 `item_drafts` created by the P15 (mock-uploaded) + P14 (camera-captured) ItemCreate flows ("2 unfinished listings" on Home — dashboard resume banners); 1 cart item "Building Blocks Bucket" (`cart_items 8193b91b`); the P03 message `c4223318` on trade `d8e14d86` left in the **read** state (read_at set). No trades/lists mutated.
- **Throwaways (all logged out, disposable):** `qa.h06.and.1788884362@…` (user `e15e2c91`) — orphan auth user from the first H06 submit whose phone-send failed (phone NULL, no profile); `qa.h06.and.1788885081@…` (`ca72efe8`, H06 — profile complete Norwalk, onboarding skipped); F02 `505327b2`, F03 `5fc3fa3d` (+ pending `zip_waitlist` 07999 row), F04 `a0afa214` (all on fallback Little Falls Central); E04 user (phone unverified, no profile).
- **No admin_config writes, no toggles armed, no code modified.** App left logged out at Landing. Metro 8081/8082 still running (left as found).

## 8. Perceived load-time observations
Perceived load times (simulator, wall-clock, ±poll interval — not a formal profile): all in-app transitions (login → Home, header chat → Messages, Messages ↔ Trades, tab switches, composer → New Item, item add → basket, Profile/Settings logout → Landing) landed well under 3 s; no ≥3 s app-behavior transitions flagged. The multi-second waits were the E04 OTP resend cooldowns (60 s, intended app behavior) and the fresh-signup flows (signup→verify→profile transitions ~1-2 s each).

## 9. Call-count ledger (manual tally — R71 fallback; transcript pointer-only)
Manual tally of tool executions this run ≈ **300-320** across the phases (rough split: Step-0 credit-check + recon + DB feasibility ≈ 30; Part-1 Group P device execution ≈ 120; H06 signup + Skip ≈ 70 incl. two §5.2 field-corruption relaunch cycles; F02-F04 ≈ 55; E04 induction incl. ~60 s cooldown polls ≈ 35; reporting ≈ 10).
Verdict-class items ≈ 23 (16 live P + 3 credited + H06 + F02/F03/F04 + E04) → **≈ 13-14 calls/verdict** vs 43c's 9.6 single-platform baseline. Structural drivers above 9.6: (a) 5 fresh UI signups (H06/F02/F03/F04/E04) each carrying the phone-verify + profile-setup leg (~15-25 calls each — the signup form is the dominant cost); (b) the §5.2 layout-shift on the Create-Account form caused two corrupted-field relaunches (~30 calls) before the R78-7 discipline was locked in; (c) E04's three 60 s cooldown waits (~8-10 poll calls); (d) Step-0 evidence/reconciliation desk-work. Pure device legs (e.g. the test-buyer Group-P batch) ran ≈ 6-8 calls/verdict — at/below the 43c baseline.

## 10. Tracker
`e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` — AUTH rows P01–P19 + E04 + F02/F03/F04 + H06 refreshed with Android verdicts + this run's source (see tracker update). **P10/P16 explicitly credited (not re-driven) — reconciliation-correct this round.**
