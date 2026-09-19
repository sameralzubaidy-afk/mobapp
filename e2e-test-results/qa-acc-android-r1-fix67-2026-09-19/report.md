# QA Task — ACC Module Round 1 (Android) + FIX-Task-67 device verification — 2026-09-19

**Run folder:** `e2e-test-results/qa-acc-android-r1-fix67-2026-09-19/`
**HEAD:** `aefe7021` (# FIX-Task-67 — MSG Round 3 Findings + UX, 10:21 local)
**Devices:** Android `Medium_Phone_API_36.1` (`emulator-5554`, dev-client, Metro `:8082`) · iOS `iPhone 17 Pro Max` `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E` (Part A leg 2 only) · live admin portal `http://localhost:3001` (active page `81c4f912…`)
**Surfaces:** mobile (android primary, ios secondary) + admin web
**Artefacts:** 30+ screenshots in `screenshots/`, `acc-trial-dashboard.xml` (adb attempt), this report, `ledger.md`

---

## 0. R29 busy check + pre-flight (executed FIRST)

| Check | Result |
|---|---|
| iOS simulators booted | `iPhone 17 Pro Max` (3F3293A3…) — the only one |
| Android emulator | `emulator-5554` attached, state `device` (not `offline`) |
| Metro instances | **Two** (documented dual-plane): `:8081` pid 21272 started 07:50:35, `:8082` pid 30112 started 07:56:05 |
| Admin portal `:3001` | **not listening** (`curl` → 000, `lsof` empty) → started with the documented `npm --prefix p2p-kids-admin run dev`; `✓ Ready in 1526ms`; 2 pre-existing browser pages (one `(active)` at `/items/flagged`) are the shared admin session |
| **R79-1c fresh-bundle gate** | **FIRED.** The FIX-Task-67 commit landed 10:20:41/10:21:14; both Metro instances started 07:50/07:56 ⇒ the loaded bundle could not contain the fix ⇒ **cold reload was mandatory and was performed** (`am start` dev-client deep link `exp+p2p-kids-marketplace://expo-development-client/?url=localhost:8082`) before any Part A assertion. |
| Android standing steps | `adb reverse` already had `tcp:8081` **and** `tcp:8082`; emulator already booted (no `nohup` launch needed); IME = Gboard present |

---

## Part A — FIX-Task-67 on-device verification (5/5 legs PASS) — **closes old debt**

> These five legs were deferred out of FIX-Task-67 because mobile-mcp was disabled in that session. Each was re-driven here against the post-fix bundle.

| # | Case | Platform | Verdict | Evidence |
|---|---|---|---|---|
| 1 | **MSG-TC-F02** | **iOS** | ✅ **PASS** | `xcrun simctl openurl booted "p2pkidsmarketplace://signup?ref=e3yac67h"` from a logged-out app → Create Account; iOS AX node `referralCode-input` **value `e3yac67h`**; screenshot `04-msg-f02-ios-signup-ref-field.png` |
| 2 | **MSG-TC-F03** | **Android** | ✅ **PASS** | same link via `adb … am start` → Create Account; Android AX node `referralCode-input` **text `e3yac67h`** (y1222) + helper "Get 5 bonus points when you complete your first trade!"; screenshot `03-…`. **R111 reproduced:** the first fire after `qa-logout` was silently dropped (Landing stayed) and the **re-fire landed** — recorded as friction, not a finding. |
| 3 | **MSG-TC-A08** | Android | ✅ **PASS** | chat on in_progress trade `b66ad08c-0553-48e5-8b76-35602e441071` → `quick-reply-chips-row` (ViewGroup 1080×215, wrapping) with `quick-reply-chip-today` (x32) · `-tomorrow` (x408 w420 → right edge 828) · `-suggest` (x32) · **`quick-reply-chip-more` "+ More" (x394 w179)** — all fully inside the 1080px viewport, **no clipping**; tapping `+ More` expanded to **5 chips** (`quick-reply-chip-public_place`, `-running_late`). Screenshots `08`, `09`. |
| 4 | **MSG-TC-C01** | Android | ✅ **PASS** | `p2pkidsmarketplace://submit-review?tradeId=c9799204-…` → settled header **"Review Test Seller"** (never "Review undefined"). The pre-resolution transient was **not capturable** (the check resolves faster than a screenshot round-trip: 3 attempts incl. a forced remount all landed post-resolution) → **source-corroborated** `SubmitReviewScreen.tsx:281`. Screenshots `05`–`07`. |
| 5 | **MSG-TC-G02** | Android | ✅ **PASS** | rejected listing `04662c2c-7c4a-43cc-9b4f-e2ac94beb0ff` (`edited_since_rejection=false` in DB) → Safety Review renders **`appeal-edit-gate-hint` "Appeal becomes available after you edit the listing." at y1948, above** the `Appeal This Decision` CTA at y2060 which carries **`disabled`** in the AX tree. Screenshot `14`. |
| 6 | **Bonus — admin session gate** (FIX-Task-67 `AdminShell` `cachedAdmin`) | admin web | ✅ **PASS** | *Cold load* (fresh page `81c4f912…`): "Checking your admin session…" renders — expected. *Client-side navigation*: **3 consecutive hops** (`/payouts` → `/audit` → `/reviews`) rendered **ZERO gate hits**, with a `window` marker proving **same JS realm** for every hop. The other shared page (loaded during the portal outage, whose failed check had *cleared* the cache) showed one ~0.4s sample — the documented "any failure clears the cache" path. Screenshot `16-admin-reviews-no-gate.png`. |

**Adverse admin observation (NEW, out of ACC scope):** `/users` raises a **repeating alert loop** — `Error: permission denied for function admin_list_users` with repeated 500s — and the modal blocks the page until navigated away. Related to the recent admin-read function lockdown; reported for triage, **not** an ACC case.

---

## Step-0 — tracker reconciliation (mandatory)

**1. Header ⇄ roll-up ⇄ body: CLEAN.** ACC section header, §1 roll-up row and the body all read **75 = 68 PASS + 2 OPEN + 1 SKIPPED + 4 NOT-SUPPORTED, Remaining 0**; `grep -c '^| ACC-TC-'` = **75**. No MSG-Round-2-class drift. **`ANDROID` column = `—` on all 75 rows** (`grep -c` = 75) ⇒ ACC had **no Android verdicts at all** and nothing "undriven but claimed" — this round therefore *creates* the baseline rather than re-verifying (unlike the AUTH J/K rounds).

**2. ACC-TC-K01–K04 glyph audit: the repaired cells match real verdicts.** The restored `🚫 NOT-SUPPORTED` + `Latest: NOT SUPPORTED` cells trace to a real recorded disposition in `qa-task43-v3-auth-acc-closure-2026-09-07/report.md:34` + `ledger.md:18` ("ACC-K01–K04 moved 🔴 OPEN → 🚫 NOT-SUPPORTED … MFA deliberately unimplemented"). The underlying claim was then **independently re-verified at the current HEAD** rather than inherited (R78-2): a source sweep for `mfa|multiFactor|authenticator|enrollFactor|challengeFactor|totp` returns **0 true hits** — every apparent `totp` match is a case-insensitive false positive inside `formatOtpCountdown`. Disposition stands.

---

## Part B — ACC Module Round 1, Android: **27 cases driven (25 ✅ PASS / 2 🟡 PARTIAL / 0 FAIL)**

Per-case detail is in `ledger.md`; the on-device evidence frames are in `screenshots/`. Summary:

| TC-ID | Verdict | Key on-device evidence |
|---|---|---|
| ACC-TC-A01 | ✅ PASS | Settings renders 4 sections / 11 rows with testIDs + a11y labels (`settings-scroll`, `settings-section-{notifications,account,legal,danger-zone}`) |
| ACC-TC-A02 | ✅ PASS | Sign Out → `global-alert-button-0` "Cancel" / `-1` "Sign Out" (GlobalAlertProvider, AX-instrumentable); Cancel dismisses and session persists |
| ACC-TC-A04 | ✅ PASS | Settings → Terms of Service / Privacy Policy / Liability Disclaimer all navigate (3/3) |
| ACC-TC-A05 | ✅ PASS | Settings → Manage Payment Methods → `screen-title` "Payment Methods" (`pm-empty-state`, `pm-add-button`) |
| ACC-TC-B05 | ✅ PASS | Profile: 190 Listings / 45 Trades / 2263 SP Balance (a11y labels), "Kid's Club Member · Exclusive perks active", My Badges (10) + 4 tiles, Reviews (6) 4.5 with distribution 5★3 / 4★3 — **internally consistent** (3+3=6; 27/6=4.5) |
| ACC-TC-C01 | ✅ PASS | Linked Accounts: email + **Readonly**, "Password ✓ set", Google/Facebook/Apple each "Not linked" + Link, footer "Active login methods: 2", last-method guard copy |
| ACC-TC-D01 | ✅ PASS | **Five** categories × 3 channels; toggled `system.email_enabled` → **DB read-back `false`→`true` @14:38:30Z**, then restored → `false` @14:38:55Z (persistence + zero residue) |
| ACC-TC-D03 | ✅ PASS | Quiet hours valid → "Saved / Quiet hours have been updated."; invalid `9pm` → **exact guide copy** "Invalid time format / Please use 24-hour format: HH:MM (example: 22:00)." and **no row was written** (all 5 rows still 22:00/08:00 after the rejected save) |
| ACC-TC-F01 | ✅ PASS | Suspended screen: "Account Suspended" + "…contact our support team for help.", **Contact Support** (secondary outline) + **Log Out** (primary), **no email address** anywhere; Contact Support routes to the in-app form |
| ACC-TC-G01 | ✅ PASS | `dashboard-greeting` "Good morning, Test", node chip "Norwalk Central", `sp-strip` a11y "2263 Swap Points. Open your SP Wallet" |
| ACC-TC-G02 | ✅ PASS | Action Items `resume-draft-banner` ("You have 4 unfinished listings" + Continue/Maybe later) **and** the independent top banner variant `3 Days Left in Your Trial` (Add Payment Method / Maybe later) on test-trial |
| ACC-TC-G03 | 🟡 PARTIAL | All 4 tiles render with testIDs + labels (Favorites / My Trades / My Listings / Payouts) — **routing not tapped this round** |
| ACC-TC-G04 | ✅ PASS | **Both branches**: test-seller (ID *pending*) ⇒ **no** CTA banner; test-free (ID *rejected*) ⇒ `id-verification-cta-banner` "ID Verification Not Approved" + Resubmit ID / Maybe later |
| ACC-TC-G05 | 🟡 PARTIAL | Recent-trade card ✅ ("QA In-Progress Trade Item" + colour-coded **IN PROGRESS** + View Timeline) and the recommendations block ✅ — carousel-swipe + chip→recommendation filtering unverified |
| ACC-TC-G08 | ✅ PASS | test-free: `sp-strip` "Unlock Swap Points" + "Upgrade →" ⇒ tap → **Kids Club+** screen |
| ACC-TC-G10 | ✅ PASS | test-trial (0 trades, DB-verified): Latest Trade area renders **"No active trades right now"** |
| ACC-TC-G11 | ✅ PASS | Recent-trade card → View Timeline ⇒ `screen-title` "Trade Timeline" for that trade |
| ACC-TC-G13 | ✅ PASS | test-free: subscription card "Free Plan" + `dashboard-upgrade-kids-club-button` "Upgrade to Kids Club+" ⇒ tap → **Kids Club+**; absent for the subscriber (guide: free users only) |
| ACC-TC-H01 | ✅ PASS | Help & Support = exactly 3 cards (`help-menu-faq`, `help-menu-earn-sp`, `help-menu-contact`) each labelled + description |
| ACC-TC-H02 | ✅ PASS | `search-input` ("Search help articles") + `category-chips-scroll`; tapping **Swap Points** set `selected` and filtered the list 9→2 rows |
| ACC-TC-H04 | ✅ PASS | FAQ detail (category chip, Q, A, "Was this helpful?" Yes/No) → tapping **Yes** ⇒ **DB `faq_items.yes_count` 0→1 @14:43:27Z** |
| ACC-TC-H05 | ✅ PASS | Contact Support form: Subject, Message + `0 / 1000`, "Send Message"; logged-in form has **no email field** (matches the guide's logged-out-only email field) |
| ACC-TC-I01 | ✅ PASS | Education "Help": 4 accordion sections (`sp_definition` expanded, `sp_earning`/`sp_spending`/`safety` collapsed) with a11y "Expanded/Collapsed. Tap to expand" + "Try the SP Calculator" |
| ACC-TC-I03 | ✅ PASS | Bonus Categories: Art & Crafts / Electronics / Books, each with a bonus badge + a11y "…Bonus category. Earns 1.3 times Swap Points." + "Earn 1.30× SP" |
| ACC-TC-J01 | ✅ PASS | Terms of Service: header, **"Last updated: 4/2/2026"**, "Version 1.1" chip, long scrollable body |
| ACC-TC-J03 | ✅ PASS | Privacy Policy: header, "Last updated: 4/2/2026", "Version 1.0", long scrollable body |
| ACC-TC-J04 | ✅ PASS | Liability Disclaimer: warning icon, "Kids P2P Liability Disclaimer 3", "Last updated: 4/2/2026", **read-only** (no accept/decline controls) |

---

## Findings

### F1 — QA test content is live in the user-facing Help screen (LOW–MED, staging content)
- **Observed on device:** the FAQ filter row renders a 6th chip **"Samer 1 test"** (`category-chip-samer-1-test`, confirmed after a horizontal drag), and the FAQ list contains **"How do I create my first listing 222?"**.
- **Root cause / writer:** admin-created rows in `public.faq_categories` / `public.faq_items` (writer = the admin-portal FAQ editors per the ADM guide). No app-code defect.
- **Blast radius (`count(*)`, not sampled):** `faq_categories` = **6 rows**, **1 test-named** (16.7% of the filter row, shown to every user); `faq_items` = **11 rows, all 11 published**, **2 test-named** = "How do I create my first listing 222?" + "what Samer test 1 does" (**18.2% of live FAQ content**).
- **Severity:** LOW–MED — user-visible junk on a support surface; would be a trust/compliance problem if promoted beyond staging.
- **Fix (admin-side, no code):** delete `faq_categories` "Samer 1 test" and the 2 test FAQ items.

### F2 — Published policy bodies are third-party boilerplate (LOW–MED, staged content)
- **Observed:** Terms of Service renders **Google Cloud Marketplace Terms of Service**; Privacy Policy renders the **Walmart Global Marketplace Seller Privacy Notice**; Liability Disclaimer renders **Amazon** commercial-liability-insurance text ("Kids P2P Liability Disclaimer 3"). All three show "Last updated: 4/2/2026".
- **Assessment:** the screens themselves behave correctly (load, version, scroll, read-only) — this is **content**, published through the admin portal, that must not ship to a kids' marketplace.
- **Fix:** replace the published policy documents (admin content task), not app code.

### F3 — No raw support-email surfaces (verified, **not** a finding)
Every support affordance encountered routes to the in-app Contact Support form; the suspended screen's Contact Support button does too, and the logged-in form carries no email field. H06's sweep is *partially* covered by this (the full cross-screen sweep was not completed — see the no-verdict set).

### F4 — `/users` admin page: repeating permission alert (NEW, out of ACC scope)
`/users` raises `Error: permission denied for function admin_list_users` in a re-raising modal + repeated 500s; the page is unusable until navigated away. Reported for admin triage (adjacent to the recent admin-read function lockdown), **not** an ACC verdict.

---

## Near-misses killed before filing (R103 / R12 / R100 discipline)

Four candidate findings were **disproved before anything was written up** — three of them by driving to the *true* bottom of the screen or reading the source:

1. **"Save Quiet Hours is pill-occluded / unreachable at max scroll"** → **false**. A fast swipe had silently no-op'd; a slow anchored drag (`input swipe … 800 ms`) revealed the button fully clear of the floating pill, followed by the "Critical system alerts…" footer. FIX-Task-66 item-3's `paddingBottom: TAB_BAR_PINNED_CLEARANCE` is intact. (Would have been a regression report against a working fix.)
2. **"The dashboard's recent-trade card is missing for a user with 6 active trades"** → **false**. It renders *below* the recommendations block (`UserDashboardScreen.tsx` L653-687) and appeared after 2 scrolls ("Latest Trade" + card + View Timeline).
3. **"The FAQ 'Account' chip is clipped to 1px"** → **false**. The chip row is a genuine `HorizontalScrollView`; after a horizontal drag the Account (129px) and Safety (181px) chips render fully. The 41px/19px cell widths were scroll-position artifacts.
4. **"'3 Days Left in Your Trial' contradicts `trial_end_date` 2026-09-21"** → **false**. `trial_end − now` = 2.1 days ⇒ the label uses `ceil()` day rounding. No defect.

A fifth candidate — **F04 "Log Out does nothing on the suspended screen"** — was **not filed**: one derived tap produced no state change, and per R-25 an unproven single miss is not evidence (the AX/coordinate tooling died before a second, independent derivation).

---

## Environment / tooling

- **🔴 mobile-MCP toolchain died mid-session** — every action failed `spawnSync …/@mobilenext/mobilecli-darwin-arm64 ENOENT` (first an `ETIMEDOUT`, then persistent `ENOENT`). 4 consecutive calls failed; retries abandoned per the bounded-attempt discipline.
- **Fallback used successfully:** the **adb device channel** — `adb shell input tap|swipe`, `adb shell screencap -p /sdcard/…` + `adb pull …` (verified 1:1, 1080×2400), `adb shell am start` deep links. This kept the persona switch, the G10 read, F01/H05 and the G03 analysis driveable.
- **Fallback that did NOT work:** `adb shell uiautomator dump` (both `/sdcard` and `/data/local/tmp`) returned **silently with no file, 3 attempts** ⇒ no AX-tree reads after the MCP loss, which is what capped the round.
- `npm run qa:ocr -- --json` **failed once** (`nilError`) then **worked** on retry; it returns text without coordinates.
- `swift scripts/qa/vision-ocr.swift … --coords` (referenced by R107) **does not exist** in the repo — the documented `--coords` replacement path is unavailable.
- R111 (first deep link after an auth switch is dropped) reproduced twice (`signup?ref=` after logout; `listing-safety` after `qa-login-as`) and both re-fires landed.
- Gradle-device facts reconfirmed: soft-keyboard (Gboard) auto-shows on focus and **must be dismissed by BACK before tapping below-fold controls** (done for D03, with a screenshot proving the IME was up first); tree coordinates are 1:1 with device pixels.

---

### F5 — Guide drift flagged (do not silently work around)
- **ACC-TC-G01** says "Greeting + **subscription badge** + SP balance". On the dashboard, a subscriber's plan is conveyed by the **SP strip** (`2263 SP` + `Earn More →`) — the explicit "Kid's Club Member / Exclusive perks active" badge lives on **Profile**, not the dashboard. Either the guide means the SP strip (then say so) or it points at a badge that is not on this surface.
- **ACC-TC-G05** says "**tappable category chips filter recommendations**". The dashboard renders **"Browse Categories" tiles** (Toys/Games/Books/Clothing) and a `RecommendationsCarousel`; the *chips* that filter a list live on the **FAQ** screen (H02). The "chips filter recommendations" behaviour was therefore **not found on the dashboard** — flagged as guide-vs-build drift, and it is the reason G05 is scored 🟡 PARTIAL rather than FAIL (the card + recommendations legs are solid).
- (The MSG brief's F02/F03 mapping is also worth pinning down for the record: the guide's **MSG-TC-F02 = "Copy referral code"** and **F03 = "Share referral code"**, whereas this round's Part A F02/F03 legs were the **referral deep-link → prefilled Create Account** verification. The verification is real and recorded on those rows, but the label is the brief's, not the guide's case text.)
- Confirmed **not** drift: G04 ("none / rejected only") matches the code exactly — test-seller (pending) shows no CTA, test-free (rejected) shows it.

---

## §8.3 QA Session Handoff

**Test Scope:** Part A — MSG-TC-F02 (iOS), MSG-TC-F03 (Android), MSG-TC-A08, MSG-TC-C01, MSG-TC-G02 (the 5 FIX-Task-67 device legs) + the FIX-Task-67 admin auth-gate check. Part B — ACC Module Round 1 on Android: 27 canonical ACC cases (A01, A02, A04, A05, B05, C01, D01, D03, F01, G01, G02, G03, G04, G05, G08, G10, G11, G13, H01, H02, H04, H05, I01, I03, J01, J03, J04).
**Design-System Compliance:** **PARTIAL — no violations found on the screens/modal inspected, but coverage was partial.** Conformant: primary green pill CTAs (`#5DBB8E`) throughout (Save Quiet Hours, Send Message, Resubmit ID, View Timeline, Upgrade, Log Out); exactly **one primary per surface** (Sign Out dialog: green-outline Cancel + destructive primary; Suspended screen: outline Contact Support + primary Log Out); documented secondary-outline dialog variant; centred dialog cards with 20-24px padding; destructive rows (Sign Out / Delete Account) in the DANGER ZONE section. Deviations found: **none**. Not inspected: the majority of ACC screens (see Known Gaps), so this is not a clean sweep. One minor inconsistency noted (not a violation): the Bonus-Categories tiles mix an image badge (Art & Crafts) with a `⭐` emoji badge (Electronics / Books).
**Perceived Load-Time Verdict:** **FLAGGED (data gap).** Per-transition stopwatch data was **not systematically recorded this round** (an unmet R50 obligation — named rather than implied): the mid-session MCP loss removed the timed-poll primitive before the batches that needed it. Qualitatively all observed transitions rendered within the <3s ideal — the two slowest were **Safety Review** ("Loading safety review…" ≈2 polls ≈2-3s, screenshot `12`) and the post-`qa-login-as` cold screen mount (the tester persona's dashboard needed a second navigation). **No transition met the ≥3s UX-finding bar with a captured measurement.** Treat as GOOD-with-caveat, not as measured.
**Design & Copy Compliance Confirmation:**
- CONFIRMED — Settings: section headers + row labels + caret affordances; destructive rows visually separated under "DANGER ZONE".
- CONFIRMED — Sign Out dialog: title, unambiguous body ("Are you sure you want to sign out?"), green-outline Cancel + destructive primary; no OS-default blue.
- CONFIRMED — Profile: stat labels ("LISTINGS"/"TRADES"/"SP BALANCE"), status badge copy, review distribution labels.
- CONFIRMED — Linked Accounts: "Readonly" email marker, "Password ✓ set", "Not linked" per provider, and the last-method guard sentence.
- CONFIRMED — Notification Preferences: per-category Push/In-App/Email labels + one-line descriptions; Quiet Hours helper copy.
- CONFIRMED — D03 error copy: "Invalid time format. Please use 24-hour format: HH:MM (example: 22:00)." — plain, actionable, includes an example.
- CONFIRMED — Suspended screen: "Account Suspended / Your account is currently suspended. Please contact our support team for help." (no jargon, no email).
- CONFIRMED — Contact Support form: "Have a question or issue? Send us a message and we'll get back to you within 24 hours." + `0 / 1000` counter.
- CONFIRMED — Help & Support: 3 cards with one-line descriptions; FAQ detail's "Was this helpful?" / "Still need help?".
- CONFIRMED — Legal screens: "Last updated" + version chip present on all three.
- DEVIATION — **Help/FAQ content**: the *copy itself* is fine, but live test content ("Samer 1 test" chip; "How do I create my first listing 222?") and third-party boilerplate policy bodies are published content defects (F1/F2) — flagged as data, not layout.
**Verdict Summary:** **30 PASS / 2 PARTIAL / 0 FAIL / 0 BLOCKED** (Part A 5 PASS + admin check PASS; Part B 25 PASS + 2 PARTIAL).
**Money Verification Layers:** **N/A — no case in this batch touches money.** The two DB write-backs this round were non-money state: `notification_preferences.system.email_enabled` (D01, toggled then restored) and `faq_items.yes_count` (H04, 0→1). No PaymentIntent, refund, payout or saved-card object was in scope.
**Coverage Tracker Updated:** **YES** — `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md`. **MSG:** 2 Android cells improved (**MSG-TC-A08** 🚫 BLOCKED (fixture) → ✅ PASS; **MSG-TC-G02** 🟡 PARTIAL → ✅ PASS) with a dated round note recording all 5 Part A legs + the admin check; **no roll-up count change** (both headlines were already ✅ PASS). **ACC:** the Android platform cell flipped on **27 rows** (25 → `✅ PASS`, 2 → `🟡 PARTIAL`), verified by `grep -c` = **48 rows still `—`** (75 − 27 = 27 ✓); the **headline Status** moved to 🟡 PARTIAL for **G03** and **G05** (weakest-platform precedent, FIX-Task-41). **ACC roll-up 68/0/2 → 66 PASS / 2 PARTIAL / 2 OPEN / 0 DRIFT / 1 SKIPPED / 4 NOT-SUPPORTED / 0 Remaining = 75 ✓**, reconciled in the same pass across the §1 table, the ACC section header and the body (R56). A dated ACC round note with the full no-verdict set was added. **ACC Android coverage: 27/75 (36%); ACC remains 0 rows in the "never run" bucket — the remaining 48 rows are verdict-absent on Android only, and 44 of those 48 already hold an iOS/agnostic PASS.**
**Critical Findings:** 1. **F1 (LOW–MED)** — live QA test content in the user-facing Help screen: 1/6 FAQ categories + 2/11 published FAQs, quantified by `count(*)`, shippable-looking on both Android and (by shared data) iOS. 2. **F2 (LOW–MED)** — the three published legal policy bodies are third-party boilerplate (Google TOS / Walmart Privacy Notice / Amazon liability text) — correct rendering, wrong content. 3. **F4 (out of ACC scope, admin)** — `/users` is unusable: a re-raising `permission denied for function admin_list_users` alert + repeated 500s. 4. **No ACC case failed**; the two PARTIALs are coverage gaps (G03 tile routing untapped; G05 carousel-swipe + chip filtering unverified), not defects. 5. **Tooling** — the mobile-MCP toolchain died mid-session and the adb `uiautomator dump` fallback is silent, which capped the round.
**App State Left Behind:** Android app left **logged in as test-suspended** on the Contact Support screen (`/sdcard/qa-shot*.png`, `/data/local/tmp/qa-ui.xml` device artefacts remain). `notification_preferences` restored to baseline (only `updated_at` moved); `faq_items.yes_count` for "How do I earn Swap Points?" incremented 0→1 by the H04 vote (a real vote — left as-is); **no fixtures created, no config writes, no destructive actions**. Admin: the portal was started from a stopped state (still running on `:3001`); the shared browser page `81c4f912…` is left on `/reviews`; page `319f1849…` is wedged on `/users` by the alert loop (close/replace it before the next admin leg). iOS simulator left on the Create Account screen. **Metro `:8081` + `:8082` left running** (R29 standing rule respected — neither killed). The `qa-logout` cleanup was **not** performed (the MCP loss prevented it) — the next session should log out first.
**Why It Matters:** Part A closes FIX-Task-67's owed device legs and MSG Round 3's three findings on real devices: the referral link now deep-links and pre-fills on **both** platforms, the quick-reply chips no longer clip or hide `+ More`, the review header no longer renders "Review undefined", the appeal edit-gate renders above a correctly-disabled CTA, and the admin shell no longer flashes its session gate on every navigation (proven same-realm). Part B gives ACC its **first Android coverage baseline** (27/75) on exactly the same standard as MSG, and it surfaced two user-visible content defects that no scripted suite would catch, plus four false findings that were killed before they could drive speculative fixes.
**How to Verify/Reproduce:** All evidence is in `e2e-test-results/qa-acc-android-r1-fix67-2026-09-19/screenshots/`. Highest value: `03`/`04` (both-platform referral prefill), `08`/`09` (chips row + `+ More` expansion), `14` (appeal gate hint above the disabled CTA), `16-admin-reviews-no-gate.png` (admin gate absent after 3 client-side hops), `27` (Sign Out dialog design system), `30`/`33` (D03 valid + invalid), `40`–`46` (persona dashboards, suspended screen, Contact Support). Reproduce F1 with `SELECT name FROM faq_categories ORDER BY sort_order` (6 rows, "Samer 1 test" last) — chip id `category-chip-samer-1-test`. Reproduce F2 by opening Settings → each legal row.
**Known Gaps / Not Tested:** **47 ACC rows still carry no Android verdict** (this is the round's headline gap vs the ≥40 target): A03 · B01–B04 · B06–B10 · C02–C04 · D02 · D04 · E01–E03 · F02 · F03 · **F04** (suspended Log Out: one derived tap produced no change; **deliberately not filed as a defect** — unproven, coordinate tooling lost) · G03/G05 sub-legs · G06 · G07 · G09 · G12 · H03 · H06 · H07 · I02 · I04 · I05 · J02 · J05–J12 · L01–L04. **Why:** the round traded breadth for evidence depth (screenshots + DB read-backs + source verification per case), and the **mobile-MCP toolchain died mid-session** — after that only screenshot-driven reads were possible (slow) and AX-tree reads were impossible (`uiautomator dump` silent on 3 attempts). **Also not measured:** the §5.7 per-transition load-time table (R50 obligation named, not met) and the cross-platform J10 comparison (iOS legal screens were not navigated).
**What Needs To Be Fixed Next:** 1. **Delete the live QA test content** (F1): drop `faq_categories` "Samer 1 test" + the 2 test FAQ items ("How do I create my first listing 222?", "what Samer test 1 does") — admin content task, removable in one pass. 2. **Replace the three published policy bodies** (F2) with real Pass It Up documents — Terms / Privacy / Liability currently render Google, Walmart and Amazon text. 3. **Fix `/users` in the admin portal** (F4): `admin_list_users` is permission-denied, and the failure surfaces as a re-raising modal that blocks the page — return a normal error state instead of a repeating alert, and re-grant/route the function per the FIX-Task-62 lockdown intent. 4. **Restore the QA toolchain**: re-install/repair the mobile-MCP binary (`…/@mobilenext/mobilecli-darwin-arm64`) and repair `adb shell uiautomator dump` on `Medium_Phone_API_36.1` — without them a device round cannot read screens. 5. **Instrumentation asks:** a `qa:vision-ocr --coords` path (R107 cites `scripts/qa/vision-ocr.swift --coords`, which **does not exist**) and `qa:ocr` coordinate output, so a non-AX screen can still be driven precisely.
**UX Enhancement Ideas (optional, not defects):** 1. On the FAQ detail, a "Yes/No" helpful vote returns to the list with **no acknowledgement** — consider a brief inline "Thanks for your feedback" so the tap is visibly registered (observed on Android, screenshot `transient` after H04). 2. On the FAQ category row, the last chip (`Account`, then `Safety`, then the test chip) sits partly off-screen with no scroll affordance — consider a right-edge fade/peek so users know the row scrolls (observed with the 41px/1px chips before the drag). 3. On the dashboard, the "3 Days Left in Your Trial" label uses `ceil()` day rounding while the DB holds 2.1 days — consider "2 days" + "ends 21 Sep" for a less jumpy countdown (observed on test-trial).
**Suggested Next Session:** Continue ACC Android coverage from the named no-verdict set, persona-batched and cheapest-first — **Edit Profile cluster (B01/B06/B07/B09/B10) in one test-buyer flow**, then **G06/G07/G09/G12** on the dashboard, then the **L01–L04 error-recovery cluster** via `crash_trigger`, then **H03/H06/H07** — with the toolchain repaired first so AX-tree reads are available, and the ≥40-per-round cadence restored.
**Suggested to Improve Agent Rules:** Add a **"device-channel ladder" rule:** when the mobile-MCP toolchain fails (e.g. `ENOENT` on the `mobilecli` binary), do not stop and do not retry — (1) probe the adb channel once (`adb shell echo ok`), (2) switch to `adb shell input tap|swipe` + `screencap -p /sdcard/…` + `adb pull` for reads, and (3) **verify the AX fallback immediately** (`uiautomator dump` to **both** `/sdcard` and `/data/local/tmp`) **before** committing to the fallback, because a silent-empty dump means coordinate derivation degrades to eyeballed screenshot geometry — which is exactly the situation in which a single missed tap (F04) must be recorded as *unproven* rather than as a product defect.

---

## Rule-friction log (what cost calls)

1. **MCP loss (biggest):** ~8 calls lost to failures/retries + the entire remaining backlog.
2. **`uiautomator dump` silent-empty ×3** (~3 calls) — should have been verified as a capability *before* relying on adb.
3. **Slow/no-op swipes ×4** (R77 #10/#14 class): fast swipes over interactive rows did nothing twice (Quiet Hours, dashboard), each costing a re-swipe + re-read. The slow (≥600-800 ms) anchored drag worked every time.
4. **R111 first-deep-link drops ×2** (~2 calls) — now expected, re-fire is the fix.
5. **Two tracker edit mistakes of my own** (replacing a section heading instead of inserting after it, and consuming a table header/row): ~6 calls to detect + repair via `git grep`. Lesson for the playbook's editing discipline: when inserting a note above a table, anchor on the **table header line**, never on the heading line you also want to keep.
