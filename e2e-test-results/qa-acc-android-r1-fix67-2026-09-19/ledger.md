# Ledger — QA Task: ACC Round 1 (Android) + FIX-Task-67 device legs — 2026-09-19

Run: `e2e-test-results/qa-acc-android-r1-fix67-2026-09-19/` · HEAD `aefe7021` · Android `Medium_Phone_API_36.1` · iOS `iPhone 17 Pro Max` · admin `:3001`

## Phase log

| # | Step | Outcome |
|---|---|---|
| 1 | Playbook + agent-memory + repo-memory recon | §1–§9 loaded; `fix-task-67-2026-09-19.md`, `qa-msg-round3-android-2026-09-19.md`, `metro-ordering-and-avd-resources-2026-09-19.md` absorbed |
| 2 | R29 busy check | iOS 1 booted; `emulator-5554` `device`; Metro `:8081` (07:50:35) + `:8082` (07:56:05); `:3001` **down** |
| 3 | Admin portal bootstrap | `npm --prefix p2p-kids-admin run dev` → ready in 1526ms; 2 shared pages (one `(active)`) |
| 4 | **R79-1c gate** | commit 10:21 > Metro 07:50/07:56 ⇒ **cold reload mandatory** |
| 5 | Android pre-flight | `adb reverse` already `8081`+`8082`; emulator up; cold reload via dev-client deep link on `:8082` → Home rendered (blank frame on first poll, second poll clean) |
| 6 | DB preconditions | referral codes (`test-buyer e3yac67h`); trade `b66ad08c` = in_progress (buyer test-buyer / seller test-seller); 3 live `rejected` listings for test-seller, all `edited_since_rejection=false` |
| 7 | **Part A-1 MSG-TC-F03 (Android)** | `qa-logout` → 1st `signup?ref=` fire **dropped (R111)** → re-fire → Create Account; `referralCode-input` = `e3yac67h` ✅ |
| 8 | **Part A-2 MSG-TC-F02 (iOS)** | `simctl openurl signup?ref=e3yac67h` → iOS AX `referralCode-input` value `e3yac67h` ✅ |
| 9 | **Part A-3 MSG-TC-C01** | `submit-review?tradeId=c9799204…` → "Review Test Seller"; transient not capturable (3 attempts) → source-corroborated `SubmitReviewScreen.tsx:281` ✅ |
| 10 | **Part A-4 MSG-TC-A08** | `chat/b66ad08c…` → wrapping `quick-reply-chips-row`; 4 controls fully on-screen; `+ More` expands to 5 chips ✅ |
| 11 | **Part A-5 MSG-TC-G02** | `qa-login-as test-seller` → `listing-safety` 1st fire dropped (R111) → re-fire → `appeal-edit-gate-hint` y1948 above `disabled` CTA y2060 ✅ |
| 12 | **Part A bonus (admin)** | fresh page = cold-load gate ✅; then `/payouts`→`/audit`→`/reviews` = **0 gate hits**, `window` marker survived (same realm) ✅; `/users` = `permission denied for function admin_list_users` alert loop (**F4**) |
| 13 | **Step-0** | ACC header/roll-up/body = 75 = 68+2+1+4, Remaining 0 ✅; Android `—` on **all 75** rows (`grep -c` 75) ⇒ no prior Android verdicts; K01–K04 cells traced to `qa-task43-v3-…` report:34 + ledger:18 and the no-MFA claim re-verified at HEAD (0 true hits) ✅ |
| 14 | Profile cluster | B05 ✅ (stats/badges/status/reviews, 4.5 = (5×3+4×3)/6) |
| 15 | Settings cluster | A01 ✅; A05 ✅; A04 ✅ ×3 (TOS/Privacy/Liability); A02 ✅ (dialog + Cancel) |
| 16 | Notifications cluster | D01 ✅ (5 categories × 3 channels; `system.email_enabled` false→true→false, DB read-backs 14:38:30Z / 14:38:55Z); D03 ✅ (valid save + exact invalid-format copy; DB untouched by the rejected save) |
| 17 | Help cluster | H01 ✅ (3 cards); H02 ✅ (chip filter 9→2; **F1** quantified); H04 ✅ (`faq_items.yes_count` 0→1 @14:43:27Z); H05 ✅ |
| 18 | Education cluster | I01 ✅ (4 accordion sections); I03 ✅ (3 bonus categories) |
| 19 | Dashboard cluster | G01 ✅; G02 ✅ (Action Items + trial banner); G04 ✅ **both** branches (pending ⇒ none; rejected ⇒ CTA); G05 🟡 (card + recommendations; carousel/chip legs unverified); G11 ✅; G10 ✅ ("No active trades right now" on test-trial); G13 ✅ (free ⇒ Upgrade ⇒ Kids Club+); G03 🟡 (tiles render; routing untapped); G08 ✅ (free strip ⇒ Kids Club+) |
| 20 | Legal cluster | J01 ✅; J03 ✅; J04 ✅ |
| 21 | Cross-persona | test-free, test-trial, test-suspended login-as legs; suspended F01 ✅ + Contact Support ⇒ H05 ✅ |
| 22 | **Toolchain failure** | `mobilecli-darwin-arm64 ENOENT` on screenshots + foreground-app (4 calls) → abandoned retries |
| 23 | adb fallback | `screencap`+`pull` ✅ (1:1 1080×2400); `input tap/swipe` ✅; **`uiautomator dump` silent-empty ×3** ⇒ no AX reads |
| 24 | Tracker (R52) | 27 ACC Android cells + G03/G05 headline → PARTIAL; ACC header + §1 roll-up → 66/2/2/0/1/4/0; 2 MSG Android cells (A08 BLOCKED→PASS, G02 PARTIAL→PASS) + MSG & ACC dated round notes; verified `grep -c` = 48 remaining `—` (27 flipped) ✅ |
| 25 | Report + handoff | `report.md` written; §8.3 block emitted in-chat |

## Verdict tally

- **Part A:** 5/5 device legs ✅ PASS + admin gate check ✅ PASS.
- **Part B (ACC Android):** 27 driven — **25 ✅ PASS / 2 🟡 PARTIAL / 0 FAIL / 0 BLOCKED**.
- **Combined:** 30 PASS / 2 PARTIAL / 0 FAIL.
- **ACC Android coverage after this round:** 27/75 (36%); 48 rows still `—`.

## Findings
1. **F1 LOW–MED** — live QA test content in the user-facing Help screen; blast radius `count(*)`: 1/6 `faq_categories` ("Samer 1 test") + 2/11 published `faq_items` = 18.2%.
2. **F2 LOW–MED** — the three published policy bodies are third-party boilerplate (Google TOS / Walmart Privacy Notice / Amazon liability text).
3. **F4 (admin, out of ACC scope)** — `/users` blocked by a re-raising `permission denied for function admin_list_users` alert + 500s.

## Near-misses killed (no finding filed)
1. "Save Quiet Hours occluded" → under-scrolled (slow drag revealed it clear; FIX-Task-66 item-3 padding intact).
2. "Recent-trade card missing" → renders below recommendations (`UserDashboardScreen.tsx` L653-687).
3. "Account chip clipped to 1px" → `HorizontalScrollView`; full chips after a horizontal drag.
4. "3 Days Left contradicts trial_end" → `ceil()` of 2.1 days.
5. **F04 Log Out** → one derived tap, no change; **not filed** (unproven; coordinate tooling lost before re-derivation).

## Tooling facts (reusable)
- mobile-MCP can die with `ENOENT` on `…/@mobilenext/mobilecli-darwin-arm64`; verify the fallback's AX leg (`uiautomator dump` → `/sdcard` **and** `/data/local/tmp`) before committing to it — a silent-empty dump means screenshot-only reads and untrustworthy coordinate derivation.
- `adb shell screencap -p /sdcard/x.png` + `adb pull` is a reliable 1:1 (1080×2400) evidence channel; `input tap/swipe` works; **slow** (600–800 ms) anchored drags scroll where fast swipes no-op.
- `npm run qa:ocr --json` can fail once (`nilError`) then work; it returns text only.
- `scripts/qa/vision-ocr.swift` (cited by R107 for `--coords`) **does not exist** in this repo.
- Notification Preferences sits at max scroll only after a **slow** drag; the Quiet Hours save button then clears the floating pill.
- Android AX-tree `EditText text=` exposes field values (used for the referral-prefill evidence on both platforms).
