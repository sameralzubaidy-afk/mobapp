# QA Task 28 — Mobile-Toolset Closure Round (SUB + MSG Final Cases)

**Run date:** 2026-09-04 · **Folder:** `e2e-test-results/qa-task28-mobile-closure-sub-msg-2026-09-04/`
**Verdict:** **SUB D01 PASS** + **MSG D05 PASS**, **D04 PASS**, **D02 PARTIAL**, **D10 NOT SUPPORTED (confirmed)**, **I01 PARTIAL**, **I02 BLOCKED-on-device (named app defect)**. Confirm-quickly: DT104 fixtures landed (D06/D07 rows ✅, I08 toggle ✅, flagged items ✅).
**This closes the last mobile-toolset-queued cases in both SUB and MSG** — SUB is clear of tooling-queued items; MSG's only remaining NEVER-RUN items are 3 config/toggle-gated (G05/G08/G09), not tooling-queued.

---

## 0. Session recon (R29 busy check + environment)

- **R29 busy check:** no `maestro`/`run-suite`/`playwright test` runners; only the admin `playwright test-server` webServer helper (expected infra). **Found + killed a stale orphaned `mobilecli screenrecord` process (PID 94816) from QA Task 26** (targeting a different non-booted device, running against `qa-task26.../G-series-run.mp4`) — it was wedging WebDriverAgent startup. After cleanup the mobile-mcp toolset recovered (AX dumps + taps work).
- **Device:** iPhone 17 Pro Max simulator (`3F3293A3-…`), iOS 26.1. App `com.sameralzubaidi.p2pmarketplace` installed; Metro dev-server up on `:8081`. Staging project `drntwgporzabmxdqykrp`.
- **Precondition met:** mobile-mcp toolset AND SQL read-back both enabled this session (last round's blocker). Simulator online via mobile-mcp (`3F3293A3-…`).
- **Tooling friction (recorded):** early WDA start timeouts + AX-tree reads returning SpringBoard hierarchy (stale). Fixed by killing the stale `screenrecord` process and doing a fresh toolset launch; AX tree then read app content correctly for the whole run. Treat "AX tree reads SpringBoard while the app is foregrounded" as the WDA-wedge signature on this setup.

## 0b. DB recon (pre-case)

- test-grace: `subscriptions.status='grace'`, `grace_ends_at=2026-11-02` (~59d) — Manage Kids Club+ normalizes to `grace_period` (`getSubscriptionSummary`, subscription.ts L135) → grace branch renders.
- test-seller: `subscriptions.status='grace_period'` (2028-01-15 — stale QA leftover; not blocking). ID state: 1 rejected row `76592772` (unclear_photo) → upload state (resubmittable). **0 pending ID requests on any persona** (D04 needed one created).
- D10 corroboration: `notification_category` enum = `subscription|sp_events|badges|trades|system` (no `id_verification`); test-buyer has exactly those 5 preference rows → ID-verification notifications route via `badges`.

---

## 1. Batch 1 — MSG Group D (ID Verification) + I (Notifications) as test-seller

### MSG-TC-D05 — No-image submit validation — ✅ PASS
- test-seller (rejected → upload state) → `p2pkidsmarketplace://id-verification-upload`.
- Submit button (`id-verification-submit-btn`) renders **disabled (solid gray)** with no image selected (source: `disabled={!state.selectedImage || state.uploading}`).
- Single functional tap on the disabled submit (center 220,715) → **no state change** — no error box, no `id-verification-error`, no navigation, still upload state.
- Matches the guide's expected result + DT97 doc-drift note (the "Please select an image" branch is unreachable through the UI).
- **Evidence:** `D05-01-upload-no-image.png` (gray disabled submit), unchanged AX tree after the no-op tap.

### MSG-TC-D02 — Capture ID with camera — 🟡 PARTIAL (simulator leg PASS; capture leg device-gated)
- On the same upload state, tapped **Use Camera** (`id-verification-take-photo-btn`).
- Result: the app cleanly handled the simulator's missing camera with the **inline "Failed to take photo" error** (`id-verification-error`), no crash, no hang, screen stayed on upload state. (Source: `takePhoto` → `launchCameraAsync` throws on the simulator → catch → inline error.)
- **Not simulator-drivable:** the capture-success leg (captured image becomes the preview) requires real camera hardware (any iOS simulator has none); the permission-denied "Permission Required" alert leg requires a denied-permission state and was not driven.
- **Evidence:** `D02-01-camera-failed-inline.png`.

### MSG-TC-D04 — Duplicate pending request blocked — ✅ PASS (with doc-drift note)
- **Fixture build:** no persona had a pending ID request (DB-recon). Created one via the real flow on test-seller (the D04/dedup prerequisite — and incidentally re-exercised D03's submission mechanics):
  - Tapped the upload area → native iOS photo-permission dialog (AX-exposed this build) → **Allow Full Access** → PHPicker opened (fully AX-drivable this build, per §5.31 re-check) → selected a photo → crop/confirm window **Choose** → image preview + "Change Image" + **enabled** submit → tapped Submit → **"Submitted Successfully"** dialog (GlobalAlertProvider) → OK → screen moved to the **Pending state** (Verification Pending / Under Review / Back to Profile).
  - **DB read-back:** exactly **1 pending row** (`28846a18-…`, submitted 13:27:16, screenshot uploaded) + the historical rejected `76592772` — no duplicate.
- **Re-entry leg:** left the screen (back → Home) → re-fired `id-verification-upload` → the Pending state renders again with **no upload area, no Use Camera, no Submit button** → a second request is structurally impossible while pending.
- **Doc-drift finding:** the guide's D04 expected-result copy ("Pending Request. You already have a pending verification request…" alert) is **dead code** — when status is pending, STATE B (pending screen) renders before any submit can be pressed, so the `handleSubmit` "Pending Request" alert branch is unreachable. The live guard is the full pending-state screen (which D06 already PASSes as its own case). The invariant "no second request is created" IS verified (UI + DB).
- **State change:** test-seller is now **ID-pending** (row `28846a18`) — noted in App State Left Behind. The stale "ID Verification Not Approved" Home action item cleared (it was a qa25 leftover).
- **Evidence:** `D04-01-image-selected-submit-enabled.png`, `D04-02-submit-success-dialog.png`, `D04-03-pending-state.png`, `D04-04-reentry-pending-block.png`.

### MSG-TC-D10 — Decision notifications honor channel preferences — 🚫 NOT SUPPORTED (confirmed)
- **Confirmed by-design NOT SUPPORTED** (matches the guide's own 🚫 marker + J05): the live `notification_category` enum is exactly `subscription | sp_events | badges | trades | system` — **no `id_verification` category exists**. test-buyer's `notification_preferences` rows confirm only those 5 categories. ID-verification notifications (submission/approval/rejection) route through **`badges`**.
- The case cannot be exercised as written (there is no ID-verification preference category to toggle). No on-device run needed — evidence is the DB enum + live prefs rows (two-source corroboration per R47). If product later adds an `id_verification` category, re-open.

### MSG-TC-I01 — Enable push notifications — 🟡 PARTIAL
- **Prompt leg PASS:** `p2pkidsmarketplace://notification-setup` renders "🔔 Stay Connected" + subtitle + 5 benefit bullets (New messages / Trade requests / Item updates / Reviews / Swap Points) + Privacy & Permissions box + "Enable Notifications" button. Evidence: `I01-01-notification-setup-prompt.png`.
- **Interaction leg blocked by a real UI defect (see §3 finding):** the "Enable Notifications" CTA renders at y868-905 — inside the floating `PersistentTabBar` band (which hides ONLY on `ItemCreate`; `NotificationSetup` is not in `TAB_BAR_HIDDEN_ROUTES`) — so the screen's only button is visually occluded and unreachable in every presentation (Settings row + deep link both push the same root-stack route under the global pill).
- **Success leg device-gated:** `registerForPushNotifications` returns null when `Device.isDevice` is false (simulator) → "✅ Notifications enabled!" + the confirming local notification are only reachable on a physical device.
- **Evidence:** `I01-01-notification-setup-prompt.png`.

### MSG-TC-I02 — Push error states (Expo Go / web) — 🔴 STILL OPEN / BLOCKED on-device (named defect)
- The intended simulator error state ("Could not obtain push notification token. Make sure you granted permissions.") is reached by tapping **Enable Notifications** — but that button is occluded by the floating tab bar (§3), so the error-state leg cannot be driven on this build.
- The underlying behavior is **source-confirmed and deterministic**: on the simulator `registerForPushNotifications` returns null (not a device) → `NotificationSetup` sets the iOS error message; no crash. But on-device confirmation requires the CTA-occlusion fix first.
- **Fix (dev follow-up):** add `NotificationSetup` to `TAB_BAR_HIDDEN_ROUTES` in `PersistentTabBar/index.tsx` (same mechanism as `ItemCreate`) — then I02 (and I01's interaction leg) become drivable.

---

## 2. Batch 2 — SUB D01 (test-grace)

### SUB-TC-D01 — Grace period banner + SP wallet frozen warning (Manage Kids Club+ surface) — ✅ PASS
- test-grace (one-call `qa-login-as?persona=test-grace`) → `p2pkidsmarketplace://manage-kids-club`.
- Status card shows **"Grace Period"** badge.
- **Grace warning box renders:** "Grace Period Active / **Your Swap Points are frozen. Re-subscribe before November 2, 2026 to restore access, or they will be permanently deleted.**" — date = test-grace's `grace_ends_at` (2026-11-02) correctly formatted.
- **"Re-subscribe to Kids Club+" CTA** present (green pill, below Billing History).
- Note: the AX tree truncated the lower content after the "Billing" header — the screenshot is the source of truth and shows the full screen (Billing History card + Re-subscribe CTA + Go Back). Not an app defect.
- **Copy diff vs guide (doc-drift note):** the guide expects an urgency message "Your subscription ended on …" with days-left-in-grace; the live copy leads with "Grace Period Active / Your Swap Points are frozen. Re-subscribe before {date}…" (SP-freeze + deadline framing). Intent (grace urgency + freeze warning + Re-subscribe CTA) is met; the date deadline substitutes for the day count.
- Closes the Manage-Kids-Club-surface equivalent of SUB-TC-I05 (SP-wallet grace banner, PASS in qa19).
- **Evidence:** `D01-01-manage-grace-banner.png`, `D01-02-after-swipe.png`.

---

## 3. Cross-cutting finding (NEW app defect)

**NotificationSetup "Enable Notifications" primary CTA is occluded by the floating PersistentTabBar (HIGH — feature unusable).**
- `NotificationSetup.tsx` renders its action button at the bottom of its own SafeAreaView → y868-905 (AX), which is inside the floating pill's band (~y844-908).
- `PersistentTabBar/index.tsx` hides itself ONLY for routes in `TAB_BAR_HIDDEN_ROUTES = { 'ItemCreate' }`; `NotificationSetup` is a root-stack screen and is NOT in the set → the pill floats over the button in every reachable presentation (Settings → Enable Push Notifications, and the `notification-setup` deep link).
- On-device: the screenshot shows no button visible (only the pill in that band), while the AX tree reports the button there. Tapping the band hits the tab items.
- **Impact:** the Settings "Enable Push Notifications" flow is unusable (the user cannot tap the CTA) — this is the I01/I02 interaction blocker and a real-user flow breaker.
- **Fix:** add `NotificationSetup` to `TAB_BAR_HIDDEN_ROUTES` (mirrors the ItemCreate fix), or give the screen's bottom section bottom-padding above the pill. Recommend as a dev follow-up.

---

## 4. Config / fixture state left behind

- **Confirm-quickly (DT104 fixtures) — all landed:**
  - D06/D07 notif rows: **confirmed via DB** — 5 rows on test-buyer (trial_reminder_7d/3d/1d, renewal_success, payment_failed) + 3 on test-grace (grace_reminder_30/7/1), all `category=subscription`, `is_read=false`, `data.qa_r41=true`.
  - I08 toggle: **confirmed working on-device** — armed `sp_wallet_not_found=not_found` → `sp-wallet` rendered "💳 Wallet Not Found / Unable to load your SP wallet." → disarmed to `none`. (DT104's same-day verification also stands.) Evidence: `I08-spotcheck-wallet-not-found.png`.
  - MSG flagged items: **confirmed via DB** — 2 flagged on test-seller (DT104's `0c1b5be8`, `04662c2c`). (Not used by this round's cases.)
- **Fixtures consumed/changed this run:**
  - **test-seller is now ID-pending** (new row `28846a18`) — created for D04; a named terminal state for the D04 case. A future ID-upload-state test on test-seller must wait for an admin decision on that row (or use test-free, which has no ID row).
  - test-seller's stale "ID Verification Not Approved" Home action item cleared (it reflected the qa25 rejection).
  - test-seller photo-library permission granted on the simulator (needed for the ID image pick; harmless).
- **App state:** test-grace logged in, on the SP Wallet screen (I08 spot-check) — toggle disarmed. Sessions persisted across the run (no crashes; `list_crashes` shows only old Safari/zsh entries).
- Admin portal untouched this run (no admin-dependent cases in this batch; D10 was DB-only).

---

## 5. QA Session Handoff

**Test Scope:** QA Task 28 — SUB-TC-D01 (grace banner, Manage Kids Club+ surface) + MSG-TC-D02 (ID camera), D04 (duplicate pending blocked), D05 (no-image submit), D10 (channel-pref decision notifications — NOT SUPPORTED confirmation), I01 (enable push), I02 (push error states) + DT104 fixture confirm (D06/D07 rows, I08 toggle, flagged items).
**Design-System Compliance:** PASS on exercised screens. ID Verification upload/pending screens, Manage Kids Club+, and NotificationSetup match the app's palette/layout (primary green `#5DBB8E`, warning `#FEF3C7`/`#B45309` rejected-note per the DEV-TASK-101 statusPill convention, disabled submit gray). One deviation finding is functional rather than cosmetic: NotificationSetup's primary CTA renders behind the floating tab bar (occlusion, §3) — not a token/color deviation but a layout defect.
**Perceived Load-Time Verdict:** GOOD — every timed transition rendered well within the <3s ideal threshold: deep-link landings (id-verification-upload, notification-setup, manage-kids-club), the photo-permission dialog, PHPicker, crop/confirm, submit → Submitted Successfully dialog, and the pending-state re-render all appeared immediately (sub-second). (Not a formal profile.)
**Design & Copy Compliance Confirmation:**
- CONFIRMED — ID Verification upload screen: "Verify Your Identity", privacy disclaimer (configurable DB message), rejected amber note, "Tap to upload ID photo", "Use Camera", "Submit for Verification", tips text.
- CONFIRMED — No-image guard: Submit disabled (gray) with no image; no-op tap.
- CONFIRMED — Camera failure handling: inline "Failed to take photo" (clear, no crash).
- CONFIRMED — Image-selected state: preview + "Change Image"; Submit enabled.
- CONFIRMED — "Submitted Successfully" dialog copy (24-hour review + email/push decision note).
- CONFIRMED — Pending state: "Verification Pending" / "We'll review your ID within 24–48 hours" / "Under Review" / "Back to Profile".
- CONFIRMED — Manage Kids Club+ (test-grace): "Grace Period" badge + "Grace Period Active / Your Swap Points are frozen. Re-subscribe before November 2, 2026…" warning + "Re-subscribe to Kids Club+" CTA.
- CONFIRMED — NotificationSetup prompt: "🔔 Stay Connected", 5 benefit bullets, Privacy & Permissions box.
- DEVIATION — NotificationSetup: primary "Enable Notifications" CTA is occluded by the floating tab bar (unreachable) — a real layout defect, not copy.
**Verdict Summary:** 3 PASS / 2 PARTIAL / 1 BLOCKED-on-device (named defect) / 1 NOT SUPPORTED (confirmed) — SUB D01 PASS; MSG D05 PASS, D04 PASS, D02 PARTIAL, D10 NOT SUPPORTED, I01 PARTIAL, I02 BLOCKED-on-device.
**Coverage Tracker Updated:** yes — `QA-TESTCASE-STATUS-2026-09-03.md`. MSG: moved D02 (🟡 PARTIAL), D04 (✅ PASS), D05 (✅ PASS), D10 (📄 DOC-DRIFT / NOT SUPPORTED), I01 (🟡 PARTIAL), I02 (🔴 STILL OPEN / BLOCKED), J05 (📄 DOC-DRIFT / NOT SUPPORTED) from Remaining → Completed. New MSG totals: 63 PASS / 2 PARTIAL / 2 OPEN / 2 DRIFT / 0 SKIP / **3 Remaining** (G05/G08/G09 — config/toggle-gated). SUB: moved D01 (✅ PASS) from Remaining → Completed. New SUB totals: 45 PASS / 2 PARTIAL / 3 OPEN / 0 DRIFT / 0 SKIP / **50 Remaining** (17 retired/N-A + payout-domain remapped + fixture-gated D06/D07/I08 + small attemptable remainder D05-reactivate/A05/etc.). Per-guide roll-up table (§1) reconciled to match the section headers.
**Critical Findings:**
1. **[NEW — HIGH] NotificationSetup "Enable Notifications" CTA occluded by the floating tab bar** — the Settings → Enable Push Notifications flow is unusable; blocks MSG I01 (interaction) + I02 on-device. Fix: add `NotificationSetup` to `TAB_BAR_HIDDEN_ROUTES` (PersistentTabBar/index.tsx), mirroring `ItemCreate`.
2. **[Doc-drift] MSG D04's "Pending Request" alert is dead code** — the live duplicate-pending guard is the full pending-state screen (no submit affordance); expected-result copy describes an alert that can't appear. D06 already covers the pending screen. No defect — the invariant (1 pending row max via UI) holds.
3. **[Doc-drift] SUB D01 copy** — live shows "Grace Period Active / Your Swap Points are frozen. Re-subscribe before {date}…" vs the guide's "Your subscription ended on …" + day-count phrasing. Intent met (deadline + freeze warning).
4. **[Tooling] stale mobilecli `screenrecord` process from QA Task 26** was wedging WDA (fixed by kill) — recommend the per-UDID lock-file proposal (§5.41 R29 item 5) to prevent orphaned-process interference.
**App State Left Behind:** test-grace logged in on the SP Wallet screen (I08 toggle DISARMED). test-seller now ID-pending (row `28846a18` — D04 fixture, awaiting admin decision); stale "ID Verification Not Approved" action item cleared; photo-library permission granted on the sim. DT104 fixtures intact (5+3 notif rows, 2 flagged items). No config writes; no admin-portal changes.
**Why It Matters:** This was the last mobile-toolset-closure round. SUB D01 (the last queued SUB item) is PASS, and MSG's ID-verification + notification Group D/I cases now have real verdicts (D05/D04 PASS, D02 PARTIAL-device-gated, D10 NOT SUPPORTED confirmed, I01 PARTIAL, I02 blocked only by a single named, fixable UI defect). **Both guides are now clear of "queued for tooling" states** — the only remaining MSG NEVER-RUN cases (G05/G08/G09) are admin-config/fixture-gated, and SUB's remaining items are retired/N-A, payout-domain-remapped, fixture-gated (D06/D07/I08 by named decision), or small-attemptable (not tooling-blocked). The signal to move to ADM is valid: SUB and MSG have no mobile-toolset prerequisites left.
**How to Verify/Reproduce:** screenshots in this folder (`D0*.png`, `I01-01-notification-setup-prompt.png`, `I08-spotcheck-wallet-not-found.png`). Reproduce D05/D02/D04: log in as test-seller → `p2pkidsmarketplace://id-verification-upload` → drive. D10: `SELECT enumlabel FROM pg_enum ... notification_category` (5 values, no id_verification). D01: `qa-login-as?persona=test-grace` → `manage-kids-club`. I01/I02: `notification-setup` → observe the occluded Enable Notifications CTA (screenshot), or apply the TAB_BAR_HIDDEN_ROUTES fix and re-run.
**Known Gaps / Not Tested:**
- MSG D02 capture-success + permission-denied-alert legs — not simulator-drivable (physical device; camera hardware). PARTIAL, not FAIL.
- MSG I01 success leg ("Setting up notifications...", "✅ Notifications enabled!", local notification) — physical-device-only.
- MSG I02 error-state UI — blocked on-device by the CTA-occlusion defect (behavior source-confirmed).
- MSG G05/G08/G09 — config/toggle-gated (never-run), not tooling-queued.
- SUB remaining 50 — mostly retired/N-A/payout-domain/fixture-gated; the small-attemptable remainder (D05-reactivate, A05, etc.) not executed this round.
**What Needs To Be Fixed Next:**
1. **Fix (HIGH): NotificationSetup CTA occlusion** — add `NotificationSetup` to `TAB_BAR_HIDDEN_ROUTES` in `p2p-kids-marketplace/src/components/organisms/PersistentTabBar/index.tsx` (or bottom-pad the screen above the pill). Then re-run MSG I01 (interaction leg) + I02 on-device.
2. **Decide MSG G05/G08/G09** — these need admin-config moderation toggles (AI moderation, recall check/threshold) + a recall-flagged scenario; schedule when moderation-config cases are next in scope (could pair with ADM).
3. **Decide on test-seller's pending ID request** (`28846a18`) — leave as a pending-ID fixture or have an admin approve/reject it to restore test-seller's upload-state availability for future ID-upload-state cases.
4. **(Optional, low) Correct D04/D01 guide copy** to match the live guards/copy (D04: Pending-state screen is the guard; D01: "Grace Period Active / SP frozen / Re-subscribe before {date}").
**UX Enhancement Ideas (optional, not defects):**
- On the ID Verification upload screen after a rejected submission, the amber note ("Your previous submission wasn't approved — see the reason in your notifications.") requires the user to open the Notification Center for the actual reason — consider showing the rejection reason inline (e.g., "Reason: Unclear Photo") to save the round-trip and reduce confusion for parents.
- On the Manage Kids Club+ grace surface, consider adding a visible "days left in grace" countdown alongside the deadline date ("Re-subscribe before Nov 2 (59 days left)") to strengthen the urgency for the parent audience.
- On the NotificationSetup prompt, the benefit list and privacy copy are clear; once the CTA occlusion is fixed, consider a full-width primary pill (custom, matching `#5DBB8E`) rather than the RN default green `#4CAF50` button to match the design system.
**Suggested Next Session:** Move to ADM (the intended next guide), OR if the owner prefers to close MSG first: apply the NotificationSetup `TAB_BAR_HIDDEN_ROUTES` fix and re-run MSG I01/I02 (a 1-fix, 2-case close). SUB D05-reactivate (cancelled → reactivate) is the next attemptable SUB item when a cancelled-in-period persona is available.
**Suggested to Improve Agent Rules:** Add to §5.41 R29's busy-check heuristics a scan for orphaned `mobilecli`/`screenrecord` processes (they can wedge WDA startup and cause the "AX tree reads SpringBoard" signature); kill-and-retry is the cheap fix. Nothing else new this run.
