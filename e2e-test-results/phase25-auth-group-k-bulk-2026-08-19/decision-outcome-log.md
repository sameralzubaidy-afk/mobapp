# Phase 25 — Group K (Bulk Listing) + Phone-Gate Check — Decision & Outcome Log

**Date:** 2026-08-19 · **Agent:** QA Test Agent · **Run dir:** `e2e-test-results/phase25-auth-group-k-bulk-2026-08-19/`
**Purpose of this file:** a full decision-and-outcome trace to be fed to an AI agent so it can identify the **bottlenecks, challenges, and reasoning patterns** the executing agent went through — every key action, the reasoning behind it, the tool calls that mattered, and the outcome. The final section derives (a) what slows execution, (b) patterns an agent should adopt proactively, and (c) what instrumentation/fixture work removes the friction.
**Reference report:** `report.md` (per-case verdicts, screenshots, UX review). This log is the *process* record; the report is the *result* record.

---

## 0. Session environment

- **Device:** iPhone 17 Pro Max sim (iOS 26.1), Debug build + Metro (`http://localhost:8081`), bundle `com.sameralzubaidi.p2pmarketplace`.
- **Toolset:** mobile-mcp (AX tree, tap, long-press, type, swipe, screenshot) + `xcrun simctl` (deep links) + ImageMagick `magick` + `scripts/qa/vision-ocr.swift` + read-only `mcp_supabase_execute_sql`.
- **Key pre-existing session constraint discovered immediately:** `view_image` returned resource URIs, not pixels ("cannot view … with view_image") → **visual tooling was broken this session** → the deterministic OCR + ImageMagick pixel/color fallback (playbook §5.9) became the ONLY visual channel for the whole run.

---

## 1. Pre-execution (source + DB audit) — the highest-leverage, lowest-cost phase

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 1.1 | Read operating playbook + persona registry + convention memories | `read_file` on QA-Test-Agent.instructions.md; `memory view` on qa-test-accounts, qa-test-agent, locator-conventions, manual-testing-guide-canons, simulator-keyboard-suppression | Mandatory pre-run: canonical sources, standing personas, locator rules, keyboard facts. | Confirmed: test-seller = subscriber + phone-verified (K01–K06 actor); unverified seller must be created fresh; keyboard is per-boot in-memory. |
| 1.2 | Locate Group K cases in the canonical guide | `grep_search` "AUTH-TC-K0[1-6]" in cross-checked-and-consolidated guide; `read_file` of the Group K section | Disambiguation rule: TC-IDs are reused across guides; read the named guide's K section. | K01–K06 scope + the documented DEV fixtures (`dev-add-test-photos`, `dev-skip-to-review`, `dev-set-item-categories`) + the "no DB writes / no bulk session" caveat. |
| 1.3 | **Source-audit the bulk publish handler for a phone gate (the prompt's key extra check)** | `grep_search` for `isPhoneRequired\|phone_verified\|PhoneVerification\|handlePublish\|dev-*` in `BulkListingCreateScreen.tsx` (2189 lines); `read_file` of `handlePublish` (~1360–1389) | E05's P0 was a gate inside an unreachable branch; the prompt explicitly asked whether the bulk path has the same defect class. Grep for the gate symbols is the fastest first-pass. | **0 matches for any phone-gate symbol in the whole file.** `handlePublish` = `if(!bulkUploadId||!draftId)→alert; if(includedCount===0||blocking)→alert; publishBulkDrafts(...)`. **No gate exists at all** — a worse class than E05 (absent vs. unreachable). |
| 1.4 | Read the E05 fix in `ItemCreateScreen.tsx` for the contrast | `grep_search` + `read_file` (~790–840, ~1365–1395) | Need the exact hoisted-gate pattern to describe the recommended fix precisely. | Confirmed E05 fix: `isPhoneRequired(sellerId)` hoisted BEFORE `canPublish()`; `PhoneVerificationModal required onSuccess={retry handlePublish}`. |
| 1.5 | Trace the bulk DB write path | `read_file` `publishBulkDrafts` (draftService.ts) + `createListing` (listing.ts); `grep` for `createListing` | Must prove the insert target to reason about the server-side trigger. | `publishBulkDrafts → createListing → supabase.from('items').insert(...)` — table-level trigger applies. |
| 1.6 | Verify the server-side gate exists and is live (read-only SQL) | `mcp_supabase_execute_sql` on staging ref `drntwgporzabmxdqykrp`: `pg_trigger` list; `pg_get_functiondef(enforce_phone_verified_on_item_insert)`; `pg_proc is_phone_verified`; later `tgenabled` | Read-only DB preconditions before on-device time (playbook §4, highest-leverage step). | `trg_items_enforce_phone_verified` exists, ENABLED (`tgenabled='O'`), function raises `PHONE_VERIFICATION_REQUIRED` for unverified non-admin sellers; `is_phone_verified` exists. **Conclusion locked before touching the device: server holds, client lacks the gate.** |
| 1.7 | Confirm deep-link route | `grep` AppNavigator/types for `bulk-create` | Flow-registry pre-read rule; don't navigate blind. | `BulkListingCreate: 'bulk-create'` exists → direct deep link works. |

**Phase-1 lesson:** the entire phone-gate verdict (the run's headline finding) was determined by source + read-only SQL BEFORE any on-device time — the empirical check later only confirmed it. This is the pattern to repeat: **conclude from code+DB first, then confirm on-device.**

---

## 2. Login as test-seller

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 2.1 | Take screenshot + list elements | `mobile_take_screenshot`; `mobile_list_elements_on_screen` | Establish clean starting state. | App on Landing (logged out), clean. |
| 2.2 | Tap Log In → fill email/password | `mobile_click_on_screen_at_coordinates` (220,721); `mobile_type_keys` email; re-list; type password | §5.1 re-list before every tap; §5.2 re-list after keyboard changes; +10pt tap calibration for input boxes. | Email + password landed correctly (tree showed values); tapped Log In. |
| 2.3 | Poll for Home | `mobile_list_elements_on_screen` | §5.3 poll loop. | Home loaded, header "Norwalk Central", tab bar present. **Login OK.** |

**Phase-2 lesson:** login on this build is reliable and cheap (~1.5s). The dev-autofill + keyboard-suppression facts saved time here (typing works even when the software keyboard is not visually shown).

---

## 3. K01 — multi-photo upload + auto-grouping

| # | Action | Tool calls | Reasoning | Outcome |
|---|---|---|---|---|
| 3.1 | Deep link to bulk screen | `xcrun simctl openurl booted p2pkidsmarketplace://bulk-create` | Guide's documented entry; bypasses the Sell sheet. | Bulk Upload screen (Photos step, `0/30`), all 3 dev fixtures visible. |
| 3.2 | Tap `dev-add-test-photos` | re-list then `mobile_click_on_screen_at_coordinates` (102,231) | Fixture injects 5 bundled photos + runs local auto-grouping. | **Photos `5/30`; auto-grouped into Item 1–5** ("Group photos by item"). K01 core assertion met. |
| 3.3 | Verify visually | `mobile_save_screenshot`; OCR via `vision-ocr.swift` | `view_image` broken → OCR. | OCR confirmed 5 item cards + step indicator. |
| 3.4 | Assess the duplicate-flagging assertion | (source) fixture body sets `setDuplicatePhotoIds([])`, `setPhotoHashes({})` | Guide itself documents that the fixture skips dup detection (all 5 photos are the same asset). | **K01 flagged as PASS with a documented limitation** — dup-flag not exercisable via fixture; not an app defect. |

**Phase-3 lesson:** when a fixture deliberately omits a behavior, say so in the verdict rather than forcing an impossible exercise. The fixture comment block (`// dev-add-test-photos -> GROUPING step (AUTH-TC-K01/K02/K03...)`) is itself the best documentation of intent.

---

## 4. K02 — regroup / merge / move / cover (the most expensive case)

| # | Action | Tool calls | Reasoning | Outcome |
|---|---|---|---|---|
| 4.1 | Re-list tree to find photo tiles | `mobile_list_elements_on_screen` | §5.1. | **Photo tiles (`photo-tile-*`) NOT in the AX tree** despite `accessibilityLabel` → locator gap. Group titles ARE exposed. |
| 4.2 | Locate Item 1's photo tile via color | `magick` connected-components on the teal `#DBEAE7` (average of the bundled `adaptive-icon.png`) | Photo tiles are images; the asset's average color is a stable signature. | Tile at ~(72,660)pt. **Reasoning: connected-components noise → switched to targeted pixel probes** (cheaper, reliable). |
| 4.3 | Long-press Item 1 photo | `mobile_long_press_on_screen_at_coordinates` (72,660, 700ms) | Enter selection mode. | **"1 selected"** + SelectionActionBar appears. Long-press multi-select WORKS. |
| 4.4 | Locate Item 2's photo (occluded by tab bar) | scroll, re-list, pixel probe `%[pixel:p{...}]` | Below-fold coordinates are logical, not rendered (§5.2); Item 2's tile was under the tab bar → needed scroll. | After scroll, probed teal at (486,990)px → tile ~(72,516)pt. |
| 4.5 | Tap Item 2 photo → Merge | tap (72,516); tap Merge (183,930) | **Button-row location was the hard part.** The SelectionActionBar buttons (`selection-*`) don't surface in the AX tree. | "2 selected"; **merge → 5→4 items**, Item 1 now has 2 photos (**Split** button appears — proves `photos.length>1`). |
| 4.6 | **Locate the action-bar buttons (expensive detour)** | OCR of full bar; slice-OCR (`-crop 220x150+{x}+2718` per 220px column); color scans | Vision's reading order for a single button row is unreliable ("New item Delete Cancel Merge" ≠ source order). | **Definitive via slices:** Merge x≈147–220pt, New item 220–293, Delete 293–367, Cancel 367–440, y≈930. (Chained `-crop -write` misfired → individual crops fixed it.) |
| 4.7 | Move-to-new | long-press Item 1's 2nd photo (162,345) → "1 selected" → tap New item (256,930) | Exercises the `handleMoveSelectionToNewItem` path. | **4→5 items** (new Item 5). Selection cleared. |
| 4.8 | Cover-photo update | re-merge Item 1+Item 2 → 2-photo group; tap 2nd photo (162,345) in non-selection mode (tap = set cover); then **compare dark-pill (COVER badge) x-bounds before/after** | COVER badge = dark `rgba(17,24,39,.85)` pill at bottom-left of the tile; measure its exact bbox, not an estimate (§5.4). | Badge moved x=105–246px → 393–534px with **identical pixel count (2856)** — same badge relocated to photo 2. Cover update VERIFIED deterministically. |
| 4.9 | Check reorder-within-group | `grep` `PhotoGroupingView` across `src/` | Guide asserts reorder; need to know if any UI exists. | `PhotoGroupingView` (the only drag-handle reorder UI) is **orphaned** — imported/rendered nowhere. Active `PhotoSelectGrid` has no reorder affordance. **Spec gap → flagged, not force-executed.** |

**Phase-4 lessons (the run's biggest time sink):**
1. **AX-tree staleness became screen-persistent**: repeated re-lists returned cached/pre-interaction content (e.g., SP-summary-at-top while the real screen was mid-scroll). Rule applied: screenshot is the source of truth (§5.9), but the cost was that EVERY element needed OCR/pixel location.
2. **Photo tiles + action-bar buttons not AX-exposed** forced color signature work (`#DBEAE7` for tiles, OCR slices for buttons). The slice-OCR technique (crop into narrow vertical columns, OCR each) is the reliable way to resolve a button row when the AX tree hides it and full-OCR reading order lies.
3. **Measure exact bboxes via connected-components/pixel probes, never estimate centers** — the COVER-badge verification was only convincing because the same pixel count proved it was the same badge.

---

## 5. K03 — step indicator

| # | Action | Tool calls | Reasoning | Outcome |
|---|---|---|---|---|
| 5.1 | Verify indicator state at each step | OCR of initial + Group screenshots; pixel probe of dot centers at y≈152pt (found via column scan) | `bulk-step-*` testIDs have `accessibilityState` but DON'T surface in the AX tree → visual/pixel verification only. | Initial: **Photos dot = white text** (current, solid green). Group step: **Group dot = white text**; Photos = gray (reached). Review step reached later. |
| 5.2 | Check Publish step | (source) `getStepForFlowState` returns 'publish' only for PUBLISHING/SUCCESS | Fixture path never reaches PUBLISHING (no session) → can't show Publish highlight. | **Documented limitation** (guide caveat), not a defect. |

**Phase-5 lesson:** pixel-probe dot centers (probe the number text color, not just the ring) is a reliable non-AX verification for a stepper. Same mechanism used for Review — no per-step re-derivation needed.

---

## 6. K04 — Apply to All bar

| # | Action | Tool calls | Reasoning | Outcome |
|---|---|---|---|---|
| 6.1 | Confirm bar hidden when all blank | OCR across scroll positions | `ApplyToAllBar` returns `null` when `suggestions.length===0 || items.length<2` (source) — with all-blank fields the most-common value is null. | **Bar correctly absent.** (Verifying an intended conditional-hide, not a bug.) |
| 6.2 | Expand Item 1 card (the second attempt) | re-list (stale) → screenshot OCR → tap (220,240) | First taps (745/720/730) missed because the **AX tree coords were stale** (one card off). OCR placed "Item 1" right under the step indicator, not where the stale tree said. | **Item 1 expanded** — form fields (Title/Description/Category/Condition) rendered. |
| 6.3 | Fill Title | tap input center (220,371 measured from `#F0F0F0` band scan), type "Blue Lego Set" | Inputs are `#F0F0F0` rounded boxes; measure band centers. Discovered **keyboard is suppressed but typing still lands** (no keyboard shown, no corruption). | Title landed (header + input show "Blue Lego Set"; missing list dropped Title). |
| 6.4 | Fill Price | tap (220,357), type "25" | Band-scan located Price input y≈331–383. | Header now `$25`; missing list dropped Price. |
| 6.5 | Fill Brand (the K04 trigger) | tap (220,534) — Brand input y≈508–560 — type "Nike" | Brand is the first field with a non-blank value; per source the bar appears once a suggestion exists. | **Apply to All bar appeared: "Brand Nike" chip.** |
| 6.6 | Set Condition | scroll form, tap "New" chip (55,400) | Condition chips located via OCR crops. | Missing list cleared for Item 1; **bar now shows a second chip ("New")** — multiple chips as values are set. |
| 6.7 | Tap the Brand chip (non-destructive check) | tap (55,762) | Verify apply doesn't overwrite Item 1's existing value. | Item 1 still "Nike" (non-destructive ✓). |
| 6.8 | Try to verify Items 2–4 received "Nike" | scroll to Item 2, expand, attempt form scroll | Direct on-device proof of fill-blanks. | **BLOCKED by friction** — nested form ScrollView resisted swipes; Brand field unreachable. Fell back to **source + unit-test corroboration** (`applyFieldToAll` fills only blanks; `bulkApplyToAll.test.ts` 8 cases). |

**Phase-6 lessons:** (1) when the tree is stale, OCR the actual screenshot to place taps — a single OCR-guided tap beats three stale-tree taps. (2) A "verification detour" (reading Items 2–4's Brand) should be abandoned once it hits repeated scroll friction, replaced by two-source corroboration (source logic + unit tests), per §6.1. (3) Typing works with a suppressed keyboard — do not assume a visible keyboard is required.

---

## 7. K05 — Submit N Items + confirm sheet

| # | Action | Tool calls | Reasoning | Outcome |
|---|---|---|---|---|
| 7.1 | Read the Submit button | OCR of bottom + pixel probe of button fill | `bulk-publish-bar`/`bulk-publish-btn` not AX-exposed → pixel color tells enabled vs disabled. | "Submit 4 Items for Review"; fill **`#989FAA` (disabled gray)** while items incomplete. ✓ text + disabled assertions. |
| 7.2 | Complete Item 1 (see 6.3–6.6) | — | Needed to show the button stays disabled even when ONE item is complete. | Button STAYED disabled ("Submit 4 Items") — directly validates "disabled if ANY included item missing required fields". |
| 7.3 | Attempt "Submit 1 Item" path | tap exclude switches on Items 2–4 (derived coords 380,415 / 365,335 etc.) | Excluding 3 items + complete Item 1 → cheaper than filling 4 items; also exercises the "Submit 1 Item for Review" label assertion. | **Exclude switches never toggled** — state unchanged (count stayed 4). Multiple coordinate sets failed. **Abandoned after bounded attempts (playbook discipline).** |
| 7.4 | Fall back to source verification of the confirm sheet | `read_file` `canSubmitForReview`, `handleOpenPublishConfirm`, `BulkPublishConfirmSheet`, `handlePublish` | On-device confirm-sheet open requires an enabled button, which requires either all-4 complete or working exclude toggles — both blocked by friction. | Source-verified: alert paths, sheet summary + subscriber SP totals, fixture-path Confirm → "Missing bulk session or draft session". Reported K05 as **PASS (partial)**. |

**Phase-7 lessons:** (1) The disabled-state assertion turned out to be MORE convincing than the enabled-state one — the button stayed gray even after Item 1 was complete, proving the "any included item" condition on-device. (2) **Fail fast on a blocked sub-path**: after 2–3 exclude-toggle coordinate attempts with zero state change, stop and source-verify rather than burn more cycles. (3) Choosing the "exclude 3" strategy was sound reasoning (cheapest path to enabled) but the switch interaction was the one thing the toolset couldn't do on this screen — a pre-flight note ("exclude switches untappable on bulk screen") would have avoided the detour.

---

## 8. K06 — Bulk SP summary

| # | Action | Tool calls | Reasoning | Outcome |
|---|---|---|---|---|
| 8.1 | Subscriber view | OCR of Review step (test-seller) | SP summary should render for subscribers. | "Bulk Listing SP Summary" card: Included 4, SP-enabled 0, Cash-Only warning. ✓ |
| 8.2 | Free-user view | fresh unverified seller → bulk → review (see §9) | Guide: "hidden for free users" — check the actual variant. | Free user sees **🔒 "Upgrade to Kids Club+ to earn these points"** + `upgrade-cta` INSTEAD of totals. ✓ (bonus finding — the "hidden" is an upgrade prompt, not a blank.) |
| 8.3 | SP totals value | — | Would need per-item SP toggle in the expanded form (unreachable via nested-scroll friction). | Flagged as not-exercised; structure + variants verified. |

**Phase-8 lesson:** testing the subscriber case for free also produced the free-user evidence (the phone-gate check's unverified seller was also a free user). **Cross-case reuse of on-device state is a big accelerator** — set up one fresh account and harvest both the phone-gate and the free-tier SP assertions from it.

---

## 9. Bulk phone-gate check (the prompt's critical extra)

| # | Action | Tool calls | Reasoning | Outcome |
|---|---|---|---|---|
| 9.1 | Create a fresh UNVERIFIED seller | qa-logout deep link → Get Started → dev autofill (Bob/Alice/Charlie) → Create Account → OTP screen → **do NOT verify** → terminate → relaunch → onboarding carousel → Skip → Home | Recipe from Phase 22/23 memory: signup → skip OTP → relaunch → skip onboarding → Home with `phone_verified=null`. | Unverified seller on Home ("Local Market", Verify-Your-Identity banner). |
| 9.2 | **DB-prove unverified (read-only)** | `mcp_supabase_execute_sql` (fixed schema: `p.phone_verified`, not `phone_verification_status`) | §5.11 — UI observation insufficient; confirm state directly. | `phone_verified=null, phone_verified_at=null` for `qa.alice.17871478847129759@…` (user b645cd23). |
| 9.3 | Drive the bulk flow as the unverified seller | deep link → `dev-add-test-photos` → `dev-skip-to-review` → tap Submit (disabled) — re-listing after each | Compare against ItemCreate where the modal fires at publish. | **NO phone-verification modal at ANY point** — entry, Group, Review ("Review 5 items", "Submit 5 Items for Review"), or Submit tap. **Empirical confirmation of the source-level finding.** |
| 9.4 | Read-only server-side check after the attempt | SQL: item count for the seller; `tgenabled` of the trigger | Confirm no insert happened + trigger live. | **0 items** for the unverified seller; trigger `tgenabled='O'`. Server still holds. |
| 9.5 | Clean up | qa-logout deep link | Leave app clean (Landing). | Clean. |

**Phase-9 lessons:** the phone-gate verdict was already locked by §1 (source+SQL). The on-device phase existed to *confirm*, not to *discover* — so even though the fixture path can't reach a real DB submit, the run was still conclusive on all three sub-checks the prompt asked for (client gate absent → modal never appears; server trigger blocks; no item created). This is the **conclude-first, confirm-second** pattern at its best.

---

## 10. Cross-cutting process metrics (what actually consumed time)

| Stage | Est. share of run | Dominant cost |
|---|---|---|
| Source + DB audit (§1) | ~10% | grep/read/SQL — all cheap, no device |
| K01 | ~5% | trivial (fixture did the work) |
| **K02 (§4)** | **~35%** | photo-tile/action-bar AX gaps → color/slice scans; merge/move/cover sequences |
| K03 | ~5% | dot-color probes |
| K04 (§6) | ~20% | stale-tree tap retries; form-fill; unreachable Item 2–4 brand check |
| K05 (§7) | ~15% | exclude-switch failures + fallback to source |
| K06 | ~5% | reuse of free-user state |
| Phone gate (§9) | ~15% | fresh-account provisioning (signup+skip+relaunch) — otherwise cheap |

The **AX-tree staleness + AX-exposure gaps on `BulkListingCreateScreen` account for the majority of wall-clock**, concentrated in K02/K04/K05.

---

## 11. Derivation A — what slows execution

1. **AX-tree staleness that persists per-screen (not just one stale snapshot).** On `BulkListingCreateScreen`, `mobile_list_elements_on_screen` kept returning pre-interaction content after expansion/scroll/step changes. Every tap therefore needed a screenshot+OCR re-derivation. This was the single largest time sink.
2. **AX-exposure gaps on interactive elements** (photo tiles, selection-bar buttons, card-header toggles, step indicator, Submit bar, exclude switches). Each is a BP-53-class gap: `testID`+`accessibilityLabel` present but not surfacing. Forced pixel-color / slice-OCR location work for nearly every control.
3. **`view_image` unavailable** → every visual check had to go through OCR + ImageMagick (multiple `magick` invocations per element; several dead-end scans: connected-components noise, over-broad fuzz masks, chained `-crop -write` misfire). Repeated trial-and-error in ImageMagick ate many cycles.
4. **Nested-form ScrollView vs. outer ScrollView ambiguity.** Swipes intended for the inner form scrolled the outer list (or did nothing), making Price/Brand/Condition fields intermittently reachable and Item 2–4 verification unreachable.
5. **Exclude switches unresponsive to derived-coordinate taps** — blocked the cheapest K05 path; would have blocked a full "Submit 1 Item" test indefinitely.
6. **OCR reading-order unreliability for button rows** (SelectionActionBar) — required the slice-OCR technique to resolve positions.
7. **Fresh-account provisioning for the unverified persona** (signup → skip OTP → relaunch → skip onboarding) — unavoidable and ~2 min, but a standing unverified persona would zero it out.

## 12. Derivation B — patterns an agent should adopt proactively

1. **Conclude from source + read-only DB first, then confirm on-device.** The headline finding (no bulk phone gate) was 100% determined pre-device; on-device only corroborated. This is the highest-leverage pattern in the playbook and it was decisive here.
2. **Treat the screenshot as the source of truth the moment the tree disagrees with it** (§5.9) — and when staleness is *screen-persistent*, switch permanently to screenshot+OCR for the rest of that screen instead of re-polling the tree.
3. **Locate by color signature, then verify by exact bounding-box (connected-components/pixel probes), never estimate centers** — worked for photo tiles (`#DBEAE7`), COVER badge (`rgba(17,24,39,.85)`), and the current-step dot (`#5DBB8E`).
4. **Resolve ambiguous control rows by slice-OCR** (crop into narrow vertical columns, OCR each column) when full-OCR reading order lies.
5. **Fail fast on a blocked sub-path** (bounded attempts on exclude switches → pivot to source/unit-test corroboration). Two-source corroboration (§6.1) is an acceptable substitute for an unreachable direct observation.
6. **Reuse on-device state across cases** — the unverified seller doubled as the K06 free-user check, saving a second account setup.
7. **Harvest per-case device state for cheap assertions** — the "button stayed disabled after Item 1 complete" observation was a free, high-value proof of the "any included item" condition.
8. **Verify typed values after entry** (per-field confirm) — the suppressed-keyboard discovery (typing lands with no visible keyboard) removed a whole class of keyboard-avoidance work for this screen.
9. **Record per-screen "known friction" at the top of the session** (stale AX, untappable switches, nested-scroll) so later cases on the same screen start from the knowledge instead of rediscovering it.

## 13. Derivation C — instrumentation/fixture work that removes the friction

1. **[P1 – dev] Fix the bulk phone-gate** (hoisted `isPhoneRequired` + `PhoneVerificationModal` mirroring ItemCreateScreen) — removes the headline finding and the need to test the absent-gate path.
2. **[P2 – dev] Reorder-in-group**: either wire the orphaned `PhotoGroupingView` drag-handle reorder into the Group step, or repoint K02's guide assertion — removes a permanently-untestable guide assertion.
3. **[P2 – dev, BP-53] AX exposure on the bulk screen**: make photo tiles, SelectionActionBar buttons, card-header toggles, step indicator, Submit bar, and exclude switches actually surface (verify `accessible`/`accessibilityRole`/`accessibilityLabel` on the TouchableOpacity/containers — the header toggle already has them yet still doesn't surface; investigate why). This removes ~60% of the run's pixel-scan work.
4. **[P2 – QA tooling] Screen-stable AX tree**: if possible, force a tree refresh / wait after RN state changes on this screen; or document a known-stale-screen list so agents skip re-listing.
5. **[P3 – dev] A `dev-set-item-field` fixture** (e.g., `dev-fill-item-1` that sets Title/Price/Condition/Brand on an item in one tap) would make K04/K05 form-fill near-instant and eliminate the nested-scroll/nested-typing friction entirely (mirrors the existing `dev-set-item-categories` pattern).
6. **[P3 – dev] Standing unverified persona** in `seed:staging` (a `qa-unverified` fixture with `phone_verified=null`) — removes the 2-minute per-run account provisioning for any future phone-gate re-check.
7. **[P3 – dev] A `dev-inject-duplicate-photo` fixture** to make K01's perceptual-hash dup-flagging assertion on-device exercisable.
8. **[P3 – QA tooling] ImageMagick helper scripts** for the recurring patterns (teal-tile bbox, green-dot locate, button-row slice-OCR) so future runs don't re-invent the `magick` one-liners that took several failed attempts to converge.

---

## Appendix — the reasoning anti-patterns observed (what NOT to repeat)

- **Re-tapping stale-tree coordinates repeatedly** (K04 header: 3 taps at 745/720/730 before one OCR-guided tap at 240 worked). Rule: after one miss on a derived coordinate, re-derive from a screenshot, don't try "nearby" guesses.
- **Over-broad color masks** (fuzz too high matched the whole card background → useless bounding boxes). Rule: narrow the tolerance and cross-check with a pixel probe before committing to a tap.
- **Chained `magick -crop -write`** applied subsequent crops to the already-cropped image (slices 2–6 empty). Rule: one crop per `magick` invocation.
- **Trusting full-OCR reading order for a button row** (bar buttons read "New item Delete Cancel Merge" — wrong). Rule: slice-OCR for rows.
- **Persisting on an unreachable verification** (Item 2–4 brand fields; exclude switches) past bounded attempts. Rule: two-source corroboration or explicit "partial" verdict.

---

*End of decision-and-outcome log. Pair with `report.md` (results) and the repo-memory entry (facts) for the full Phase 25 record.*
