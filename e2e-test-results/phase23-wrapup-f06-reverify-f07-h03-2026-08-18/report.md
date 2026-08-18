# Phase 23 Wrap-Up — F06 On-Device Re-Verification + F07 Intent + H03 — QA Report

**Run:** 2026-08-18 · **Device:** iPhone 17 Pro Max Simulator (iOS 26.1) · Expo RN dev build + Metro
**Guide:** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**Agent:** QA Test Agent (execution-only) · **Scope:** iOS mobile surface only
**Predecessor:** `phase23-auth-group-f-h-i-e05-2026-08-17/report.md` (F06 = FAIL, spec/design drift) — this run is the **re-verification after the P3/P4 node-scope fix + Discover token migration** shipped (uncommitted working tree, live via Metro).

**Verdict roll-up: F06 ✅ PASS (corrected/confirmed) · F07 ⚠️ NOT a registered case (intent ✅ PASS) · H03 ⛔ BLOCKED (premise drift — no dev toggle exists)**

---

## 1. Lead verdicts

| TC | Verdict | Summary |
|---|---|---|
| **AUTH-TC-F06** Node-scoped content | ✅ **PASS** | Toggle Off → `66 results · near CT` (Norwalk-only, no "all nodes" suffix); Toggle On → `1205 results · all nodes` (count grew, suffix appears); Toggle Off → returns to 66. Toggle **hidden** for waitlisted/inactive-ZIP users (discriminating check PASS). Other Node badge renders per source + confirmed data path (prior visual capture; re-drive blocked by tab-bar occlusion, see §5.1). |
| **AUTH-TC-F07** (new case) | ⚠️ **Not a registered case** — dangling cross-ref; intent **PASS** | `### AUTH-TC-F07` does **not** exist in the guide (Group F index = F01–F06). The inactive-ZIP dialog it references was fully verified: 07999 → "We're Coming Soon!" → Join Waitlist → "Waitlist Confirmed" → `zip_waitlist` row persisted (pending, Little Falls Central) → Discover shows **no toggle** + `1205 results · near NJ` (global browse fallback unchanged). |
| **AUTH-TC-H03** Avatar upload failure | ⛔ **BLOCKED — premise drift** | **No dev toggle exists** to force avatar-upload failure. `devTestingService.ts` (+87) is the **S03/S04 forgot-password** simulation toggle only. `uploadProfileAvatar` is a pure real-upload path (no `__DEV__` injection). Non-blocking behavior **is** implemented in source (verified) but the toggle-driven scenario cannot be executed. |

---

## 2. Pre-flight & setup

- Read operating playbook `.github/instructions/QA-Test-Agent.instructions.md` + repo memory. Flow-registry pre-read for the new node-scope build (`NODE-SCOPE-P1..P4` — confirmed shipped/uncommitted).
- **Clean-state verify (§5.8):** plain launch → clean Landing, no LogBox/deep-link overlay.
- Environment: simulator booted, Metro serving the working tree (uncommitted node-scope fix live), app installed. Staging project `drntwgporzabmxdqykrp`.
- Baseline (read-only DB): **Norwalk Central = 66 tagged items**, Greenwich = 13, others 0; global total 1205. test-buyer `node_id = NULL` (seed setup gap — see §6.2).
- Load-time tracking: no blocking spinner/hang on any transition; toggle transitions render within normal latency.

---

## 3. Per-case traces

### AUTH-TC-F06 · Node-scoped content (My Node vs Show All Nodes) — ✅ PASS

**Setup deviation (documented):** guide actor is `test-buyer` (Norwalk, node assigned), but test-buyer's staging profile has `node_id = NULL` (seed doesn't assign nodes; early-returns for existing users). Executed with fresh dev-autofill active-node user **"QA F06 Buyer"** (ZIP 06850 → **Norwalk Central**, 66 tagged items) as the active-node vehicle, preserving intent.

| Guide assert | On-device result | Status |
|---|---|---|
| Toggle visible & **Off** (default) | `discover-show-all-nodes-toggle` = **"Show All Nodes off"** (`accessibilityRole="switch"`) | ✅ |
| Count = Norwalk only, **no "all nodes" suffix** | **`66 results · near CT`** (66 = exactly Norwalk Central's tagged count per DB) | ✅ |
| Tap **On** → count grows + "all nodes" suffix | **`1205 results · all nodes`** (66 → 1205); grid populates | ✅ |
| Other-node items carry **Other Node** badge (`<search-result-id>-other-node-badge`) | Renders: deployed `search_listings` returns `node_id` (verified via SQL — `Tat 4-1` → Greenwich `efbc5830…`); `SearchResult.node_id` typed (P3); condition `showAllNodes && item.node_id !== userNodeId` satisfied. **Prior capture** shows the light-gray pill. Re-drive: badge sits behind the floating tab bar in the single-result view (see §5.1). No over-render on my-node cards. | ✅ (source + data path + prior visual) |
| Tap **Off** → returns to node-only | **`66 results · near CT`** restored | ✅ |
| Waitlisted/inactive-ZIP user does **NOT** see toggle, keeps global browse (discriminating check) | **QA Waitlist Buyer** (07999): **no toggle** in tree; `1205 results · near NJ` — global fallback unchanged | ✅ |

**Discriminating check — full evidence chain:** inactive ZIP 07999 → auto-resolve "📍 Whippany, NJ" → **"We're Coming Soon!"** modal (fallback "Little Falls Central") → **Join Waitlist** → **"Waitlist Confirmed"** → DB `zip_waitlist` row `status=pending`, `assigned_node_id=Little Falls Central`, `created_at=12:20:27Z` → onboarding → Home header "Little Falls Central" → Discover: **no toggle** + global count. **The fix did not regress the intentional waitlist behavior.** ✓

**Not exercised:** `empty-show-all-nodes` CTA (Norwalk has 66 items → no empty state; conditional per guide). Optional follow-up via pre-existing "QA Empty Node" account (07424 → Little Falls Central, 0 items).

### AUTH-TC-F07 · (referenced from F06's Assert) — ⚠️ not registered; intent ✅ PASS

- **Registration gap:** `### AUTH-TC-F07` does not exist in the canonical guide; Group F index lists F01–F06. The F06 Assert "see AUTH-TC-F07 / inactive-ZIP dialog" is a **dangling cross-reference** (intent is covered by F02 and by this run's discriminating check).
- **F07-intent result:** inactive-ZIP dialog + waitlist join + post-onboarding global-browse fallback all behave exactly per design (see discriminating check above). **PASS.**

### AUTH-TC-H03 · Avatar upload failure does not block — ⛔ BLOCKED (premise drift)

- **No dev toggle exists** to force avatar-upload failure:
  - `src/services/devTestingService.ts` (+87 lines) adds only **`qa_reset_error_simulation`** for **AUTH-TC-S03/S04** (forgot-password rate-limit / SMTP-500). No avatar toggle.
  - `src/services/profile.ts` `uploadProfileAvatar` (L435): pure real-upload path (ImageManipulator → Supabase Storage, 3 retries); no `__DEV__`/toggle failure injection anywhere.
  - `ProfileSetupScreen.tsx`: no Dev/simulate toggle.
- **Source-verified non-blocking behavior** (the underlying requirement) is implemented correctly in `handleSubmit`:
  - on `uploadError` → `Alert.alert('Warning','Profile will be created without avatar. You can add it later.')` → **continues** to `setupUserProfile` regardless.
- **Recommendation (follow-up task):** add a fail-closed `qa_avatar_upload_failure` admin_config toggle (mirror the proven S03/S04 pattern) or a `__DEV__` injection in `uploadProfileAvatar`; then H03 becomes executable on demand.

---

## 4. Three-layer review

- **Hard assertions:** all F06 count/toggle transitions + discriminating check verified on-device via AX tree (`discover-results-count`, `discover-show-all-nodes-toggle`) with exact numbers (66 → 1205 → 66). PASS.
- **Structural/UX:** toggle present only for active-node users (correct gating per `{!!userNodeId && !waitlisted}`); count suffix logic ("near CT" / "all nodes" / "near NJ") correct across the three personas; waitlist flow end-to-end persisted. PASS with findings (§5).
- **Design-system compliance:** **Discover token migration spot-check PASS** — `discoveryTokens.ts` reconciled to canonical `design-system-passitup.md` (primary `#5DBB8E` = Whisk green, matching `src/theme/colors.ts` exactly; neutrals/type updated; header enforces a "MUST NOT diverge" invariant). Rendered Discover (toggle pill, count line, active-toggle `primary[600]`, Other Node pill `neutral[100]`/`neutral[500]`) reads correctly; no drift.

---

## 5. New findings

1. **[UI/UX] Floating tab bar occludes the bottom of the results grid.** In the single-result search view ("Tat 4-1", toggle ON), the sole card renders at max scroll with its title at ~842pt and the **badge + price behind the floating tab bar** (icons at ~866pt). The results `FlatList` has **no bottom inset clearing the tab bar** → the last row's lower content (badge/price) is hidden in short result sets (pixel/OCR analysis confirmed; the "glyph" near the tab bar is the tab-bar globe icon). **Recommendation:** add bottom padding ≈ tab-bar height to `discover-results-list` `contentContainerStyle`.
2. **[Accessibility] Other Node badge not instrumentable (BP-53).** Badge is a plain `<View testID>` + `<Text>` with no `accessible`/`accessibilityRole`/`accessibilityLabel` → not in the AX tree; the guide's `<search-result-id>-other-node-badge` locator is only verifiable via pixels/source. **Recommendation:** mark `accessible` with `accessibilityLabel="Other Node"`.
3. **[Setup gap] test-buyer is node-less.** F06's documented actor (`test-buyer`, node assigned) cannot be satisfied — staging profile `node_id = NULL`; seed never assigns nodes and early-returns for existing users. Seed should assign node IDs to test users, or the guide actor should be an active-node fixture.
4. **[Docs] F07 is an unregistered case** (dangling cross-ref from F06's Assert). Register it or re-point to the inactive-ZIP entry (F02).
5. **[H03] No avatar-failure dev toggle exists** (premise drift). Add one (see §3 H03).
6. **[Info] LogBox console-error** appeared once (from the `send-phone-otp` dev-bypass fallback) — non-fatal, dev-environment artifact; dismissed; no crash.

---

## 6. Evidence

`evidence/` (copied from `/tmp`; archived 2026-08-18):

| Case | File |
|---|---|
| F06 toggle OFF | `f06_toggle_off_66_results.png` |
| F06 toggle ON | `f06_toggle_on_1205_results.png` |
| F06 searched Greenwich item (toggle ON, "1 result · all nodes") | `f06_search_greenwich_item_toggle_on.png`, `f06_search_single_result_card.png` |
| F06 grid — no badge over-render on my-node cards | `f06_grid_no_overrender.png` |
| F07 inactive-ZIP modal + join + home + discover | `f07_waitlist_modal_07999.png`, `f07_waitlist_confirmed.png`, `f07_waitlisted_home_little_falls.png`, `f07_waitlisted_discover_no_toggle.png` |

---

## 7. Test data created (staging)

- **QA F06 Buyer** — `qa.alice.17870559268815451@kidsmarketplace.test`, ZIP 06850, node **Norwalk Central** (dev-autofill password).
- **QA Waitlist Buyer** — `qa.alice.17870551116044730@kidsmarketplace.test`, ZIP 07999, node **Little Falls Central**, `zip_waitlist` **pending** (created 12:20:27Z).
- (Unused/pre-existing) **QA Active Buyer** — `qa.alice.17870069597195796@kidsmarketplace.test` — password not the dev-autofill value (login failed; likely manually altered during its earlier signup). Flag for cleanup; do not reuse.

**Environment/cleanup:** simulator left in a **clean logged-out Landing state** (via `p2pkidsmarketplace://qa-logout` deep link).

---

## 8. Recommendations (follow-up tasks — execution-only; no code changed this run)

1. **H03:** add a fail-closed `qa_avatar_upload_failure` dev toggle (mirror S03/S04) → re-run H03.
2. **F07:** register `AUTH-TC-F07` or re-point F06's dangling cross-ref.
3. **Seed/setup:** assign `node_id` to seeded test users (or update F06's actor).
4. **UI:** bottom inset on `discover-results-list` so the tab bar doesn't occlude the last row's badge/price (§5.1).
5. **A11y:** make the Other Node badge `accessible` (§5.2).
6. Optional: exercise `empty-show-all-nodes` via the "QA Empty Node" account (07424).

**Bottom line:** the node-scoping fix is **confirmed working** (F06 PASS — hyperlocal default, opt-in Show All Nodes with correct count transitions, and no regression to the intentional waitlisted global-browse fallback); **F07's intent is verified** but the case is unregistered; **H03 could not be executed** because the dev toggle it depends on does not exist.
