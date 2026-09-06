# QA Task 36 — Full Decision & Outcome Log (AI-analysis edition)

**Purpose:** A complete, timestamped account of every key action → the reasoning behind it → the tool calls that mattered → the outcome, written so an AI agent can mine it for:
- **(a)** what slows execution (bottlenecks, ranked)
- **(b)** what patterns an agent should adopt proactively
- **(c)** what instrumentation/fixture work removes the friction so future smaller runs don't burn the same time and calls

**Session:** 2026-09-06, iOS Sim iPhone 17 Pro Max (`3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`), staging `drntwgporzabmxdqykrp`. Runs: Batch A (D05 independent real-Stripe re-drive), Batch B (G01 real Stripe Connect onboarding), Batch C (N06 trial-gate check), Cleanup.

**Method note (read first):** call counts per phase are **approximate ranges** reconstructed from the session trace (the exact per-call ledger lives in the conversation; the qualitative events — which tool, what happened — are precisely documented). The single most important fact is **call distribution**: roughly **>85% of the session's tool calls went to Batch B (G01 Stripe onboarding)**; Batch A (the whole D05 lifecycle) and all cleanup took the remainder. Read that as: the D05 "known-recipe" path is cheap; the G01 "real Stripe hosted UI" path is where every minute went.

---

## Call-budget distribution (approximate, ~220–260 tool calls total for the session)

| Phase | Approx. calls | % of session | Verdict |
|---|---|---|---|
| 0. Environment re-orientation (turn restart) | ~12–16 | ~6% | friction high vs value (boilerplate) |
| 1. Batch A fixture build (signup → real Checkout → active) | ~30–38 | ~15% | moderate (recipe-known) |
| 2. Admin cancel → grace (portal) | ~8–10 | ~4% | low |
| 3. Re-subscribe / renewal + on-device verify | ~10–14 | ~6% | moderate |
| 4. Batch A negatives (EF-boundary) + cleanup pre-checks | ~10–14 | ~6% | low |
| 5. Batch B — G01 Stripe Connect onboarding | **~130–160** | **~60%** | **very high — the bottleneck** |
| 6. Cleanup (Connect + Batch A residue + auth) | ~14–20 | ~7% | moderate (key/quoting friction) |
| 7. Reporting / tracker / memory / handoff | ~12–16 | ~6% | moderate (verbatim-template retry) |

---

## Phase-by-phase log

### Phase 0 — Environment re-orientation (the restart of a multi-turn session)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 0.1 | Re-activate mobile tool categories | mobile-mcp tools were disabled at turn start | `activate_screen_interaction/capture/app_management/device_interaction_controls/screen_info_queries/device_fleet` (6 calls) + failed guesses for the text-input category (`activate_text_input_tools` etc. — 3 errors) | categories back; wasted ~9 calls discovering type_keys was already available | HIGH (pure boilerplate, resets every turn) |
| 0.2 | Screenshot to re-orient | needed current screen state | `mobile_take_screenshot` ×2 | timed out "WebDriverAgent not ready" (sim had rebooted) | MED |
| 0.3 | Resolve device handle | short UDID `3F3293A3` failed | `mobile_list_available_devices` → full UDID `3F3293A3-C4B7-…` | discovered full-UUID handle required | MED |
| 0.4 | Warm the WDA agent | agent not ready | `mobile_list_apps` | agent came up; screenshot then worked | LOW (accidental) |
| 0.5 | Persona ambiguity | Home greeting "Good morning, QA" was ambiguous (qa-payout-seller's first name is "QA") | `mobile_take_screenshot` + SQL `auth.users.last_sign_in_at` | confirmed qa-payout-seller was signed in (11:52Z) | MED — resolved via DB, not guessing |
| 0.6 | Navigate to Payout Settings | deep links (`openurl`) dropped on a foregrounded running app | `xcrun simctl openurl` ×3 (qa-login-as, /payout-settings ×2) + terminate/relaunch | deep links unreliable while running; UI "Payouts" tile tap (1 call) was reliable | HIGH — discovered UI-nav is the reliable path |

**0-key lesson:** a session-start checklist (activate categories → list devices → confirm persona via DB → prefer UI taps over deep links while the app is foregrounded) would cut ~10+ calls every restart.

### Phase 1 — Batch A: build a fresh real-Stripe disposable (positive leg)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 1.1 | UI signup with dev-fill | needed a disposable with a real profile | signup fields typed one-by-one → DOB number-pad **corrupted the phone field** → terminate+relaunch (R-NEW-1) → ~4 calls lost | then noticed the **dev Autofill button** (`dev-fill-test-user-1`) below the fold — filled the whole form in 1 tap | MED (fixed by using dev-fill; check for it FIRST) |
| 1.2 | Mint + complete a real Checkout | the proven D05 recipe | GoTrue password-grant → `create-checkout-session` EF → hosted Checkout in browser → card 4242 → Link code 000000 | `cs_test_…` → real `sub_1UCdep4…`, sub `active`, wallet `active` | LOW (recipe-known) |
| 1.3 | Verify DB + on-device Active state | money-path evidence | `execute_sql` read-back + relaunch + AX | Active / Next Billing Oct 6 2026 | LOW |
| 1.4 | Save a card via PaymentSheet | needed a card on file for the renewal EF | native PaymentSheet (AX-exposed) → 4242 → Set up | `pm_1UCdhX…` saved | LOW (native sheet is instrumented) |

### Phase 2 — Admin/manual cancel → grace
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 2.1 | Admin cancel via the portal | R-16/R-NEW-5: batch admin actions | admin browser session → `/subscriptions/manage` → search → Cancel with `window.confirm` override | `status='grace_period'`, `cancel_reason='admin_override'` | LOW (one batched Playwright block) |
| 2.2 | On-device grace + frozen-SP confirm | D05 core assertion | DB read-back + relaunch + Manage Kids Club+ AX/screenshot | Grace Period + frozen warning rendered | LOW |

### Phase 3 — Re-subscribe → renewal (positive close)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 3.1 | Locate Re-subscribe CTA | CTA not AX-exposed | screenshot → OCR-position estimate → tap | renewal succeeded → **"Your Swap Points are now available."** (DT118 copy) | MED (one-off pixel guess; could be instrumented) |
| 3.2 | DB verify + MED discovery | R24: read every money object the success message references | `execute_sql` on `billing_history` | **found TWO rows for the same invoice** (`in_1UCdlR4…`) — EF keyed to charge, webhook fallback keyed to invoice id → UNIQUE(charge_id) miss | MED finding (cheap to find — the DB read was the win) |

### Phase 4 — Batch A negatives
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 4.1 | (a) renew while active | resubscribe-without-renewal guard | node POST to `renew-subscription` EF | loud HTTP 400 `INVALID_STATUS` | LOW |
| 4.2 | (b) real declining-card renewal | negative with real Stripe objects | tried raw card number → Stripe blocked (BP-69) → used `tok_chargeDeclined` PM → EF POST | loud HTTP 402 `CARD_DECLINED`, no state change | LOW |
| 4.3 | Pivot note | UI PaymentSheet refused to store the declining card | (observed) | declined-card can only be driven at the EF boundary — correct deterministic leg | LOW |

### Phase 5 — Batch B: G01 real Stripe Connect onboarding (THE BOTTLENECK)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 5.1 | Add Payout Method → Stripe Connect | G01 start on qa-payout-seller (0 methods) | `mobile_click` on `add-another-method-row` → modal (content **NOT AX-exposed**) → pixel-scanned the Add Method button | account `acct_1UCe24KmLuEOxYxB` created; Success alert → OK opened onboarding | HIGH (modal not instrumented) |
| 5.2 | **Measure the Add Method button** | modal buttons invisible to AX (§5.31 class) | `save_screenshot` → `magick identify` → crop band → `view_image` → histogram (`#5DBB8E`) → constrained bbox scan → center **pt (310,642)** — after 2 failed guess-taps (~(345,745),(345,642…)) | precise tap → EF ran | **HIGH — ~8 calls for one button** |
| 5.3 | Drive the Express onboarding (1st session) | E2E on-device | Safari AX: phone verify "Use test code" → personal details Continue → business details Continue → Review | got to Review and submit | MED |
| 5.4 | Fix "Business information Incomplete" | need product/website | opened Edit → Save with `www.example.com` → **Save silently no-oped** (stayed Incomplete); confirmed via Stripe API read-back that `business_profile.url` stayed null | learned Stripe rejects `www.example.com` as a placeholder with NO UI error | **HIGH — silent UI failure only visible via API** |
| 5.5 | Switch to product description | avoid clearing the prefilled placeholder | toggled "Add product description instead" → typed description into the **empty** textarea (type_keys — no clearing needed) | Save persisted; requirement cleared | MED |
| 5.6 | **Sim reboot killed the Safari session** | mid-run environment reset | (reboot) | whole in-app session gone; only resumable by regenerating the account link (Add Method → Stripe Connect idempotent → OK) | **HIGH — full re-drive cost paid twice** |
| 5.7 | Re-drive (2nd session): phone → personal → business → review → personal-details submit | resume onboarding | full re-walk of Safari steps | phone/SSN/URL left `currently_due` (API-verified) | HIGH (repeat cost) |
| 5.8 | Text-edit fight in Safari | clearing prefilled `www.example.com` | tap field → type_keys appended "test" → long-press → Copy/Find/LookUp menu (not Select All) → Paste menu (appends, doesn't replace) → long-press **dropped the whole Safari session back to the app** | abandoned in-place URL editing; product-description path won | **HIGH — ~12+ calls; long-press on Safari field is a session-killer** |
| 5.9 | Reach Stripe ID verification gate | final step | Review → Start verification | **"Stripe setup session expired"** at the app return URL; `currently_due` = `individual.verification.document` + TOS | HIGH |
| 5.10 | Diagnose root trigger | "couldn't confirm name and SSN" | Stripe API GET of the account | **`individual.first_name="QA Payout Seller"`, `last_name="Seller"`** — `create-stripe-connect-account` jammed the display name into the legal name → name+SSN precheck fails → forces gov-ID verification | HIGH (root cause = a fixture/EF bug, not test technique) |
| 5.11 | Owner-directed SKIP | no clean workaround within reach; user approved skipping | (stop) | G01 recorded PARTIAL/SKIPPED at the ID-document gate | decision |

### Phase 6 — Cleanup (R41 / BP-70)
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 6.1 | App-UI delete of the Connect method | prefer the instrumented path | method sheet → Delete Method | **"Cannot Delete Only Method" guard** blocked it (app refuses to delete the last method) | MED (guard by design; forced API/SQL cleanup) |
| 6.2 | Stripe account DELETE | dispose the Connect account | node `DELETE /v1/accounts/acct_1UCe24…` | HTTP 200 deleted | LOW |
| 6.3 | DB method-row delete + read-back | revert qa-payout-seller | `execute_sql` DELETE + SELECT | 0 methods, active sub intact | LOW |
| 6.4 | Batch A residue: sub cancel + customer delete + rows + auth user | BP-70 full delete | node Stripe (cancel sub, delete customer) + `execute_sql` deletes + GoTrue admin `DELETE /auth/v1/admin/users/{id}` | **first auth delete → HTTP 401** (wrong env var name / shell quoting) → fixed by parsing `.env` inside Node | **MED — ~4 extra calls on key-name/quoting** |
| 6.5 | Orphan declining PM | cleanup completeness | attempted delete | Stripe refuses to delete unattached PMs → noted as harmless residue | LOW |

### Phase 7 — Reporting
| # | Action | Reasoning | Tool calls that mattered | Outcome | Friction |
|---|---|---|---|---|---|
| 7.1 | Write report + concise decision log + memory | standard deliverables | create_file ×2 + memory create | done | LOW |
| 7.2 | Locate + update the status tracker | R52 | `grep` for the file + read rows + `multi_replace` ×3 rows | D05/G01/N06 rows updated (totals unchanged) | MED (large file; needed grep-first) |
| 7.3 | Emit the formal §8.3 handoff | R53 mandatory | — | first emission used **non-verbatim field labels** → owner asked for the formal handoff again → re-read §8.3 template → re-emitted verbatim | **MED — read the verbatim template before emitting** |

---

## Friction events deep-dive (the steps that took the longest / most calls — and the fix)

### F-1 (biggest): Stripe Connect onboarding is hosted in SYSTEM SAFARI and is session-fragile — ~60% of the session
**What happened:** `Linking.openURL(account_link)` opens the **system Safari app**, not an in-app WebView. The QA toolset can drive Safari's AX tree (that part worked), but: (a) any simulator reboot or app-foregrounding drops the whole Safari session; (b) a long-press on a Safari text field (to get Select All/Paste) can dismiss the session back to the app; (c) each resume re-requires phone verification, so every drop costs a full phone→personal→business→review re-drive.
**Fix (instrumentation/fixture):** the app should show an explicit **"Continue onboarding"** button on the Payout Settings method card whenever `stripe_onboarding_complete=false` (calls `create-stripe-account-link` directly) so a dropped session resumes in **one** action instead of Add-Method→Stripe-Connect→OK; and a dev fixture/EF that completes Express test-mode requirements (`business_profile.url|product_description`, `tos_acceptance`) server-side would let QA verify the verified-transition without fighting the hosted ID-document step.

### F-2: Native RN modals aren't AX-exposed → ~8 calls per button
**What happened:** Add Payout Method modal (and the WithdrawModal footer per §5.31) render no AX elements; every button required: save screenshot → `magick identify` → crop → `view_image` → histogram → color-bbox scan → tap. Two guess-taps missed first.
**Fix (instrumentation):** BP-53-expose the modal rows + footer buttons (testID + `accessibilityRole`), exactly like the GlobalAlertProvider buttons and the bundle-confirm modal fix (DT84). This is the single highest-yield mobile instrumentation ask.

### F-3: Text entry/editing inside Safari-hosted Stripe forms
**What happened:** `type_keys` types but cannot clear prefilled text (`www.example.com`); long-press menus vary (Copy/Find/LookUp vs Paste vs Select All) and are dangerous; the winning pattern was to **avoid clearing** by choosing the "product description" alternative (an empty field).
**Fix (pattern + fixture):** prefer empty-field alternatives; never long-press Safari fields; and dev note: `www.example.com` is rejected by Stripe with no UI error (only visible via API `business_profile.url`).

### F-4: Silent field rejection with no UI error
**What happened:** Save with `www.example.com` returned to Review still "Incomplete" with no inline error — the only signal was the Stripe API read-back.
**Fix (pattern):** when a Stripe Express page says Incomplete/Invalid with no error, **GET the account's `requirements.currently_due` first** — it names the exact missing field and ends the blind loop in one call.

### F-5: `create-stripe-connect-account` name-mapping bug (root cause of F-1's terminal gate)
**What happened:** the EF wrote the whole display name into `individual.first_name` → Stripe's name+SSN precheck fails → government-ID document verification required → the hosted flow can't finish in the harness.
**Fix (dev):** derive `first_name/last_name` from a real name source or a fixed test identity.

### F-6: Deep links dropped on a foregrounded running app
**What happened:** `openurl` (qa-login-as, /payout-settings) silently no-opped while the app was running; only terminate+relaunch + UI taps were reliable.
**Fix (pattern):** prefer UI-tab/tile navigation; use deep links cold (after terminate/relaunch); verify persona via DB `last_sign_in_at`, not the greeting.

### F-7: Mobile-mcp tool categories reset every turn + device-handle/UUID confusion
**What happened:** ~9 boilerplate activation calls + 2 failed screenshots (wrong short UUID, WDA not ready).
**Fix (agent-rules, not code):** a session-start checklist; note "list_apps warms WDA"; full-UUID handle.

### F-8: Service-role key access friction (cleanup)
**What happened:** auth-user delete 401'd (wrong env var prefix / shell quoting); fixed by parsing `.env` inside Node.
**Fix (pattern):** read keys/env in Node, never shell-quoted one-liners.

### F-9: Verbatim §8.3 handoff (process)
**What happened:** the first handoff used paraphrased field labels; the owner had to ask again; fixed by reading the §8.3 template first.
**Fix (agent-rule):** read `.github/instructions/QA-Test-Agent.instructions.md` §8.3 verbatim template before emitting any handoff.

---

## (a) What slows execution — ranked bottlenecks

| Rank | Bottleneck | Cost | Remedy class |
|---|---|---|---|
| 1 | **Stripe Connect onboarding in system Safari** — session-fragile, repeat re-drives, terminal ID-verification gate | ~130–160 calls | fixture/instrumentation (F-1, F-5) + pattern (F-3) |
| 2 | **Native RN modals not AX-exposed** (Add Payout Method / Withdraw footer) | ~8 calls per button, repeated | instrumentation (F-2) — BP-53 expose |
| 3 | **Silent Stripe field rejection** (`www.example.com`) — no UI error | ~6–10 calls of blind loop | pattern (F-4): API `currently_due` first |
| 4 | **Text editing in Safari** (clearing prefilled text; long-press session-kills) | ~12+ calls | pattern (F-3): empty-field alternatives, no long-press |
| 5 | **Deep-link unreliability on a running app** | ~4–6 calls per nav | pattern (F-6) |
| 6 | **Per-turn tool re-activation + device-handle boilerplate** | ~12–16 calls per restart | agent-rules (F-7) |
| 7 | **Cleanup key/quoting friction** | ~4 calls | pattern (F-8) |
| 8 | **Non-verbatim handoff retry** | ~2–3 calls + owner friction | agent-rule (F-9) |
| 9 | **Persona ambiguity** (first-name greeting) | ~2 calls | pattern: DB `last_sign_in` confirm |

## (b) Patterns an agent should adopt proactively

1. **Consult authoritative backend state before blind UI iteration** — when a Stripe/Express page says "Incomplete/Invalid", GET `requirements.currently_due`; when a success message claims a money outcome, DB-read every referenced row (R24). The read is always cheaper than the blind re-drive.
2. **Never long-press a field inside a hosted (Safari) flow** — treat it as a session-killer; prefer an empty-field alternative over clearing prefilled text; confirm field focus (keyboard present) before `type_keys`.
3. **Treat hosted-browser flows as disposable** — after any interruption, resume by regenerating the account link (idempotent create) and **budget a full re-drive** (phone re-verification is required every resume).
4. **Prefer instrumented paths** — UI tabs/tiles over deep links while the app is foregrounded; dev-fill/autofill buttons before manual form entry; native instrumented sheets (PaymentSheet, GlobalAlert) before pixel work.
5. **Batch pixel-button location** — one save→identify→trim→measure sequence, never guess-tap loops; verify the tap by re-reading the tree/screenshot before the next step.
6. **Read keys/env inside Node**, not shell-quoted one-liners (avoids 401/parse traps).
7. **Do a session-start checklist** (activate categories → list devices → confirm persona via DB `last_sign_in_at` → confirm admin `:3001` + Metro) to absorb the ~10-call restart tax once.
8. **Read the verbatim §8.3 template before any handoff**; emit it complete on the first pass.
9. **Prefer DB/API evidence over screenshots for money-path verdicts** (D05's PASS rests on DB read-backs; screenshots are corroboration).

## (c) Instrumentation / fixture work that removes the friction (concrete dev asks)

| # | Work | Saves | Owner |
|---|---|---|---|
| I-1 | **BP-53-expose AddPayoutMethodModal + WithdrawModal footer buttons** (method rows, Add Method/Cancel/Confirm) with testIDs — mirrors the DT84 bundle-modal fix | ~8 calls per modal interaction | mobile dev |
| I-2 | **Explicit "Continue onboarding" button** on the Payout Settings method card when `stripe_onboarding_complete=false` (calls `create-stripe-account-link`) | full Safari re-drive per drop (F-1) | mobile dev |
| I-3 | **Fix `create-stripe-connect-account` name mapping** (real first/last or fixed test identity) | unblocks G01's verified-transition leg (F-5) | EF dev |
| I-4 | **Stripe test-mode Connect completion fixture/EF** (set `business_profile.url|product_description` + `tos_acceptance` server-side) so QA can verify the verified method + withdrawal without the hosted ID-document flow | the terminal G01 gate | EF/dev ops |
| I-5 | **Document the Stripe-rejects-`www.example.com` fact** + the product-description path in the G01 runbook/guide | avoids the silent-rejection loop | docs |
| I-6 | **QA start-of-run "current authoritative state" helper** (persona + methods + subscription + Stripe `currently_due` in one read) | several per-batch calls (R-NEW-6, F-4) | QA tooling |
| I-7 | **Dev check of deep-link delivery** while the app is foregrounded (linking listener) so `openurl` is reliable cold+warm | ~4–6 calls per nav (F-6) | mobile dev |
| I-8 | **Agent-rule updates (no code):** session-start checklist; "never long-press Safari fields"; "hosted flows are disposable — budget a re-drive"; "read the §8.3 template first"; Node-only env reads | the restart/boilerplate + process tax | QA playbook |

**Biggest lever:** I-2 + I-3 + I-4 together remove the entire ~60% Batch-B cost. Second: I-1 removes the per-modal pixel tax everywhere in the app.

---

## Bottom line for future smaller runs
- Batch A (D05) is now a **cheap, known-recipe run** (~60–80 calls end to end incl. cleanup) — the pattern is proven and reusable.
- Batch B (G01) should **not be re-attempted as-is**: it burns ~60% of a session on Stripe's hosted UI + a known fixture bug. It is a **dev-fix-gated** case (I-2/I-3/I-4) — re-drive only after the fixes land, and even then treat the hosted verification as a bounded attempt with an explicit stop rule.
- The **generic, reusable wins** (I-1 modal AX, I-6 state-helper, patterns F-3/F-4/F-6) benefit every future batch, not just this guide.
