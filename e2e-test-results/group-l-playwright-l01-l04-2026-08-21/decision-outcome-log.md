# Group L — AUTH-TC-L01–L04 (Admin Listing Approval) — Decision & Outcome Log

**Date:** 2026-08-21 · **Agent:** QA Test Agent (authoring validation + full execution) · **Run dir:** `e2e-test-results/group-l-playwright-l01-l04-2026-08-21/`
**Purpose of this file:** a full decision-and-outcome trace to be fed to an AI agent so it can identify the **bottlenecks, challenges, and reasoning patterns** the executing agent went through — every key action, the reasoning behind it, the tool calls that mattered, and the outcome. The final sections derive (a) what slows execution, (b) patterns an agent should adopt proactively, and (c) what instrumentation/fixture work removes the friction.
**Reference report:** `report-execution.md` (per-case verdicts, screenshots, UX review, QA Session Handoff). This log is the *process* record; the report is the *result* record.

---

## 0. Session environment

- **Admin web (Playwright):** `p2p-kids-admin` (repo `mobappadmin`, branch `develop`), portal `http://localhost:3001` (HTTP 200), Playwright config `reuseExistingServer`, baseURL `:3001`, workers=1.
- **Mobile (mobile-mcp):** iPhone 17 Pro Max sim (iOS 26.1), Debug build + Metro (`http://localhost:8081`), bundle `com.sameralzubaidi.p2pmarketplace` (PassItUp.app). Session persisted across relaunch (normal verified subscriber).
- **DB read-backs:** `p2p-kids-admin/.env.local` service-role client (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) via `node -e` one-liners, mirroring the spec's own helper path. Read-only throughout.
- **Visual channel:** `view_image` returned resource URIs, not pixels → deterministic OCR (`scripts/qa/vision-ocr.swift`) + ImageMagick pixel/color probes were the visual fallback (playbook §5.9). All coordinate judgments on mobile were OCR/pixel-based.
- **Admin credential gate:** the task's explicit gate (do not invent admin creds). Verified CLEARED before execution — `test-automation/trade-flow-v2/.env` + `p2p-kids-admin/.env.local` both had `PLAYWRIGHT_ADMIN_*` / `ADMIN_E2E_*` filled (email len 31 = `test-admin@kidsmarketplace.test`, password len 14; no placeholders). `test-admin` has admin RBAC on staging.
- **Spec under test:** `p2p-kids-admin/__tests__/group-l-listing-approval.e2e.test.ts` — L01–L04 authored as one connected serial chain anchored on the seller's latest item; DB read-backs via service-role; `/listings` UI approval (RPC-backed path per the task constraint, not `/items/flagged`).

---

## 1. Pre-execution (source + DB + env audit) — the phase that determined every later cost

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 1.1 | Read operating playbook + registry + convention memories | `read_file` QA-Test-Agent.instructions.md; `memory view` qa-test-accounts, qa-test-agent, locator-conventions, listing-approval-notification-r8 | Mandatory pre-run: canonical sources, standing personas, locator rules, and the two backend fixes under test. | Confirmed: personas (test-seller/test-buyer same node `550e8400-…`), the notification/reapproval backend contract, DEV-bypass OTP facts, deep-link redbox history. |
| 1.2 | Locate Group L in the canonical guide | `grep_search` "Group L\|L01…L04" in the AUTH guide; `read_file` of the Group L section | TC-ID disambiguation (IDs reused across guides). | L01–L04 scope + "pending hidden / approve / notify / edit→pending" objectives. |
| 1.3 | **Verify the credential gate (task's explicit stop-condition)** | `grep -c 'ask your team lead\|___FILL_IN___'` on both `.env` files; `awk` presence/length check (values redacted — never echoed) | "If admin creds aren't filled, stop and report." Must check locally, without echoing secrets. | No placeholders; all fields FILLED. Gate cleared → proceed. |
| 1.4 | Verify runtime env | `curl` `:3001/listings` + `:8081/status`; `xcrun simctl list devices booted` + `get_app_container` | Confirm the admin portal, Metro, simulator, and app are up before spending any time. | Portal 200, Metro 200, iPhone 17 Pro Max booted, app installed. |
| 1.5 | **Read-only DB precondition check (highest-leverage)** | `node -e` service-role: seller/buyer ids + nodes, seller's latest 5 items + status, buyer node | Playbook §4: verify data state matches what the case assumes before on-device work. | **No pending item existed** (latest was `available` with `approved_at=NULL` — pre-existing seed anomaly) → mobile submit precondition required. **test-seller `phone_verified_at=NULL`** (registry "phone verified: yes" = doc drift) → the phone gate will fire. |
| 1.6 | Map the L03 on-device verification | `grep`/`read_file` deepLink.ts (`listing_approved → ListingDetail`) + NotificationCenterScreen.tsx (`listing_approved: { Icon: Tag, ...COLORS.green }`) | Flow-registry pre-read: know the expected icon/route before navigating. | Confirmed mapping: tap → ListingDetail with `listing_id`; green Tag icon. |
| 1.7 | Map the item-create publish path | `grep`/`read_file` ItemCreateScreen `canPublish()` + `ConditionSelector.tsx` + `PhoneVerificationModal` + `usePhoneVerification` | Needed: required fields, DEV fixtures, phone-gate behavior, OTP DEV bypass (`123456`). | `canPublish` needs photo+title+category+**condition**+price; `dev-add-test-photo`/`dev-set-category` fixtures exist; condition rows are TouchableOpacity `accessibilityRole="radio"`; DEV bypass code `123456`; OTP auto-verify races state (manual Verify backup). |
| 1.8 | Verify the admin `/listings` locators + approve flow | `grep` ListingSearch.tsx for `listings-status-select`, `btn-approve-`, `btn-confirm-action`, `listings-details-modal`, `handleApproveListing` (rpc `admin_approve_listing` → `window.alert`) | The spec's L02 locators must exist; the alert is handled via `page.on('dialog')` (Option B). | All locators present; confirm button → RPC → `alert`; the queue auto-refreshes via `setTimeout(handleSearch,100)` after approval (this detail became a later failure root cause). |

**Phase-1 lesson:** the two biggest on-device surprises were predicted here — (a) no pending item → submit leg required, (b) phone gate fires (unverified seller) → the whole OTP dance was anticipated. The only thing NOT predicted was the admin *login redirect race* and the *queue auto-refresh race*, both of which are Playwright-side and only visible in the browser.

---

## 2. Mobile leg 1 — seller login + submit a fresh item (L01 precondition)

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 2.1 | Login as test-seller | Landing → tap `landing-login-button` → re-list → fill `login-email-input` + `login-password-input` → `login-submit-button` | §5.1 re-list before every tap; §5.2 re-list after keyboard; +10pt tap calibration. Fixture password `TestSeller123!` (committed seed value, not echoed). | Home as test-seller ("TS" avatar, Norwalk Central). Login <2s. |
| 2.2 | Reach item creation | `xcrun simctl openurl booted p2pkidsmarketplace://create-item` | Proven reliable path bypassing the non-AX-exposed Sell sheet (Phase 23 memory). | "New Item" screen with `dev-add-test-photo` + `dev-set-category`. |
| 2.3 | Add photo + set category | tap `dev-add-test-photo`; re-list; tap `dev-set-category` (220,637) | Fixtures render the tall form + set a real category (skips `Other`). | Form rendered; category **Books** (verified by OCR "Dev: Set Category (Books)" — the AX label stays static: locator-gap note). |
| 2.4 | Title + price | tap `title-input` (220,743) → type "QA L Group Chain Item 0821"; scroll; tap `manual-price-input` → type "15" | Logical tree coords on this screen don't move with scroll → screenshot/OCR is the source of truth; §5.10-ready. | Title + price landed; SP estimate ~20 SP (Books 1.30x). |
| 2.5 | **Corruption event (avoidable cost)** | tap (220,740) intending to dismiss the keypad → **appended a "5" → price "155"**; long-press → no Select All menu (numeric keypad) | Violated my own §5.2 discipline: I tapped to dismiss without re-measuring; the focused field auto-scrolled so (220,740) hit the price input. | Price corrupted → per §5.2 **terminate + relaunch + redo the whole form** (do not repair). Session persisted. |
| 2.6 | Redo form (photo→category→title→price→condition) | repeated re-list + OCR + taps; dismissed keypad by tapping the pixel-measured "Allow buyers to pay with Swap Points" text (pt 545); tapped condition "New" at (220,752) after (220,745) missed; verified Submit button turned green `#5DBB8E` | Learned: keypad-dismiss taps must be placed by OCR-measured content, not guesses; condition rows not AX-exposed → pixel/OCR. | Price 15 clean; **Submit enabled (green)** — condition registered. |
| 2.7 | Submit → **phone-verification gate fires** | tap Submit (220,868) → gate (`listing-phone-verification-*`); enter `5551234002` → Send Code → DEV bypass `123456` | Expected (1.5: `phone_verified_at=NULL`). Gate is legitimate — complete it, don't fight it. | "Enter Verification Code" + "DEV mode: use code 123456". |
| 2.8 | **OTP entry flakiness (costly)** | bulk-paste "123456" → **mangled to "125"** (auto-advance race drops chars); tried overwrite (failed); **Resend** (clears digits) → entered `1 2 3 4 5 6` **one digit at a time** → auto-verify hit a state race ("Please enter the 6-digit code") → tapped **Verify** manually | §5.13.25: don't retry the same bulk approach; digit-by-digit is reliable; auto-verify has a known state race → manual Verify backup. | Modal closed → **"Thanks for submitting!"**. Item `f5bac12c` created `pending`, buyer-visible count 0. **L01 precondition met (first anchor).** |
| 2.9 | DB verify | `node -e` service-role: latest item + status + buyer-visible count | Authoritative confirmation. | `f5bac12c` pending, `approved_at` NULL, count 0. |

**Phase-2 lessons:** (1) the price-corruption was a self-inflicted §5.2 violation — the correct habit is: after typing, ALWAYS re-measure before any "dismiss" tap, and tap OCR-measured static text, never assumed positions. (2) OTP bulk-typing is unreliable on this auto-advance input; digit-by-digit + manual Verify is the deterministic recipe. (3) The phone gate fired exactly as the read-only DB predicted — the DB precondition check turned an "unexpected blocker" into "expected step".

---

## 3. Playwright run 1 — the auth-redirect race (first spec bug found)

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 3.1 | Run L01–L03 | `PLAYWRIGHT_ADMIN_E2E=true npx playwright test --grep "L0[1-3]"` (backgrounded; polled via `get_terminal_output`, checked `ps`/`test-results/` for progress) | First full run against the pending anchor. | L01 PASS; **L02 FAIL** — page snapshot + OCR of `test-failed-1.png` showed the **login page with EMPTY email/password fields**. |
| 3.2 | Diagnose the login failure | re-ran L02 with `--reporter=list` → exact error: `waiting for locator('[data-testid="listings-status-select"]')` at `selectOption`; checked `src/app/auth/login/page.tsx` input attrs (all match the spec's locators) | Get the exact error, don't guess. The empty fields meant the login fill block never ran. | **Root cause:** the admin app guards pages CLIENT-SIDE (`ProtectedLayout` → `getUser()` → `router.push('/auth/login')`). `page.goto('/listings')` resolves BEFORE that async redirect → `page.url().includes('/auth/login')` was false → login skipped → L02 later timed out on the login page. |
| 3.3 | **Fix the spec's `ensureAdminSession`** | `replace_string_in_file`: wait for the redirect decision via `page.waitForURL('**/auth/login**',{timeout})`; post-login `waitForURL(!path.startsWith('/auth/login'))`; final `goto('/listings')` + wait for `listings-status-select`; dropped `waitForLoadState('networkidle')` (hangs on Next.js HMR) | Fix the TEST (QA deliverable), not app code. The guard is legitimate app behavior; the test raced it. | Spec fix applied. |

**Phase-3 lessons:** (1) Playwright on a Next.js dev app with client-side auth guards needs `waitForURL` on the redirect, not an immediate `page.url()` check. (2) Reading the exact failure (`--reporter=list`) + the app's auth-guard source was decisive — 3 source reads, no device time.

---

## 4. Playwright run 2 — the badge/filter conflict (second spec bug found)

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 4.1 | Re-run L01–L03 (login fix, same pending item `f5bac12c`) | `--grep "L0[1-3]" --reporter=list` | Validate the login fix. | L01 PASS; **L02 FAIL** at the ORIGINAL badge assertion `expect(row.getByText(/available/i))` (line 396) — the queue was still filtered to `pending`. |
| 4.2 | DB-verify the approval actually succeeded | `node -e` service-role read of `f5bac12c` + notification | The alert "Listing approved!" fired and DB read-back is authoritative. | **Approval fully succeeded** (available, approved_by set, notification `882c2df6` with correct `deep_link`). Only the UI badge assertion was wrong. |
| 4.3 | Fix the badge assertion | `read_file` ListingSearch.tsx `formatStatusLabel`/`getStatusBadgeClass` + status-filter options → replace with: switch filter to `active` (Available) then re-search, then assert the badge | An approved item LEAVES the `pending` set, so its badge can never show "Available" while the filter is `pending` — the assertion was self-contradictory. | Fix applied (filter→`active` + click search + badge assert). |
| 4.4 | Create a **fresh** pending item for a clean re-run | app was on the success modal → tap "Go To My Items" → `create-item` deep link (form restored draft state: title/category/condition/price 15) → `dev-add-test-photo` → Submit | The run 1/2 approvals consumed `f5bac12c` (now available). The chain anchors on the seller's LATEST item, so a fresh one is needed. The restored draft made this fast. | New item **`cc81e86c`** created `pending` (same title, price 15). **No phone gate this time** (test-seller now verified). |

**Phase-4 lessons:** (1) The DB read-back is the source of truth — it proved the approval worked while the UI assertion was wrong, separating "backend broken" from "test assertion wrong". (2) A restored-draft form (from deep-link re-entry) is a fast path to a second fixture item — but note it silently re-uses prior values, so verify what you submit.

---

## 5. Playwright run 3 — L01–L03 PASS (clean)

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 5.1 | Run L01–L03 on `cc81e86c` | `--grep "L0[1-3]" --reporter=list` | Both fixes in place; fresh pending anchor. | **L01 PASS (1.3s), L02 PASS (6.8s), L03 PASS (141ms).** Alert "Listing approved! Seller is eligible for Starter Pack reward."; moderation gate pre-check `{"status":"disabled",...}`. |
| 5.2 | (L04 self-skipped — expected) | — | The seller edit for L04 hadn't been done yet. | L04 self-skips with a clear reason. |

**Phase-5 lesson:** after two spec fixes, the whole approve+notify chain passed in one 11s run. The fixes were cheap (test-file only); the failures they fixed were Playwright-timing bugs, not backend defects.

---

## 6. Mobile leg 2 — the L04 edit (reapproval trigger verified)

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 6.1 | Dismiss success modal | tap "Go To My Items" (~pt 545, OCR-located) | Modal buttons not AX-exposed. | MyListings. |
| 6.2 | Find the item's edit (pencil) control | `grep` MyListingsScreen.tsx (edit = `PencilSimple` in an actions row, 36pt `#F5F5F5` buttons not AX-exposed); connected-components on `#F5F5F5` → pencil at ~(48,514) | Pencil/trash/dots are color-signed but not AX-exposed → color-signature then bbox (§5.9/§5.4). | Pencil located; sorted by `created_at DESC` (verified in `getMyListings`) → first row = `cc81e86c`. |
| 6.3 | Open EditListing + change price | tap pencil (48,514) → EditListing → tap price field (220,512) → **long-press → Select All** (menu appeared this time — OCR slice-located "Select All" at ~(165,460)) → type "20" → dismiss keypad (tap hint text) → scroll → tap Save Changes (green pill, OCR/pixel-measured ~(220,800)) | The Select All menu WORKS on this edit screen's decimal keypad (unlike ItemCreate). Change price 15→20. | "Changes Saved" modal. **DB: `cc81e86c` price 20, status `pending`, approved_at/by NULL, buyer-visible 0** → `tr_items_require_reapproval_on_seller_edit` fired. **L04 precondition met.** |
| 6.4 | Note a dev LogBox ("TypeError: Network request failed") appeared at the bottom of EditListing | OCR of bottom region (orange `#FF8C42` element + error text below the green Save button) | Non-fatal console error (background image/network call); didn't block the Save. | Noted as friction; did not affect the edit. |

**Phase-6 lessons:** (1) Select All works on EditListing's decimal keypad even though it failed on ItemCreate's — **record per-field-type behavior, don't assume** (§5.10). (2) The pencil-button discovery by `#F5F5F5` color-signature + bbox was the reliable way around the AX gap.

---

## 7. Playwright run 4 — the auto-refresh race (third spec issue) + L04 PASS

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 7.1 | Run L04 | `--grep "L04"` — **accidentally matched the WHOLE describe** (the describe title contains "AUTH-TC-L01–L04") → full chain re-ran | Playwright `--grep` is a regex against the full title (describe + test); "L04" appears inside the describe string. | L01 PASS; **L02 FAIL** at the new badge assertion (line 401, filter→`active` version): OCR of `test-failed-1.png` showed "Status: Available … **Results (0)**". |
| 7.2 | Diagnose the 0-results | read `admin_search_listings_v2` RPC (`p_status 'active' → 'available'` mapping is correct in source); traced the approval handler: `setFilters(page:1)` + `setTimeout(handleSearch,100)` auto-refresh with the **stale `pending` filter** | The 100ms auto-refresh can land AFTER our `active` search and overwrite results with an empty pending-filtered set → a UI race, not a DB/RPC issue (DB read-back had already proven the item available). | **Root cause:** auto-refresh (stale `pending`) clobbers the `active` results. Spec needs poll-and-re-search. |
| 7.3 | **Fix L02 to poll-and-re-search** | `replace_string_in_file`: `expect.poll(async () => { click search; wait 600ms; return row.getByText(/available/i).isVisible() })` with intervals — tolerates the stale auto-refresh landing late | Make the UI confirmation robust to the race rather than brittle-timing it. | Fix applied. |
| 7.4 | Re-pend the item for a clean L04 | mobile re-edit `cc81e86c` price 20→25 → "Changes Saved" → DB `pending`, price 25, buyer-visible 0 | L04 needs the item pending at test time (the previous L02 re-approval made it available). | Item `pending` again. |
| 7.5 | Run L04 precisely | `--grep "editing the approved listing"` (regex only matches the L04 test title, not the describe) | Avoid the describe-title substring trap. | **L04 PASS (361ms).** |
| 7.6 | Final L01–L03 validation of the poll-re-search fix | `--grep "L0[1-3]" --reporter=list` | The poll-re-search code had to be validated by a passing run. | **L01 PASS (456ms), L02 PASS (5.4s), L03 PASS (120ms); L04 skipped (expected).** |

**Phase-7 lessons:** (1) **`--grep` substring trap**: a bare "L04" matches the describe title "…AUTH-TC-L01–L04…". Always grep a unique test-title fragment. (2) The DB read-back disambiguated a UI race from a backend failure a second time. (3) The auto-refresh race is a real admin-page behavior worth a dev-side look (refresh to the new status bucket), but the spec can be robust to it regardless.

---

## 8. Mobile leg 3 — L03 on-device verification (NotificationCenter + deep link)

| # | Action | Tool call(s) | Reasoning | Outcome |
|---|---|---|---|---|
| 8.1 | Navigate to NotificationCenter | `xcrun simctl openurl booted p2pkidsmarketplace://notifications` (deepLink.ts `/notifications → Notifications`) | Reliable entry (header bell not exposed). | NotificationCenter showing **"Listing Approved"** items: title + body "Your listing \"QA L Group Chain Item 0821\" was approved and is now live." |
| 8.2 | **LogBox overlay blocks interaction** | OCR revealed a dev LogBox: "Log 2 of 2 / Console Error / TypeError: Network request failed" (+ phoneService send-otp error) | Session-scoped console-error LogBox from earlier failures (phone-OTP Edge Function + an image network error). | Dismiss attempts: tap (420,70)→prev log, (432,70)→next log, (220,70)→no change. **3 attempts failed to find the X** (header controls not tree/pixel-discoverable). |
| 8.3 | Clear the LogBox cleanly | `mobile_terminate_app` + `mobile_launch_app` | §5.8 discipline: non-fatal console-error LogBox ≠ fatal redbox; terminate+relaunch clears it and the session persists. | Clean Home (no LogBox), session intact. Re-sent `/notifications` deep link → NotificationCenter clean. |
| 8.4 | Verify icon + deep link | pixel probe of the first notification icon center (30,206) → `#5DBB8E` (green = COLORS.green); tap the top notification (220,220) | `listing_approved → { Icon: Tag, ...COLORS.green }` (source) — pixel-verify the green icon, then tap to verify the deep-link target. | **Green Tag icon confirmed.** Tap → **Item Detail** with `item-detail-title` "QA L Group Chain Item 0821", `$25.00` (correct latest item). `listing_approved → ListingDetail` verified live. |

**Phase-8 lessons:** (1) A dev LogBox from prior session noise should be cleared by **relaunch**, not by hunting its header controls (prefer this in the playbook). (2) Pixel-probing the icon badge center is a reliable non-AX verification of an icon's semantic color.

---

## 9. Cross-cutting process metrics (what actually consumed time)

| Stage | Est. share | Dominant cost |
|---|---|---|
| Pre-execution source+DB+env audit (§1) | ~8% | grep/read/node — all cheap, no device/browser |
| Mobile submit leg incl. corruption + OTP (§2) | **~30%** | self-inflicted price-corruption (redo), OTP digit-by-digit, phone gate (all avoidable with better habits/fixtures) |
| Playwright run 1 + login-race fix (§3) | ~12% | one backgrounded run (slow tail), error-context + login-source reads |
| Playwright run 2 + badge fix (§4) | ~10% | one run + source reads; fresh-item creation reused a restored draft (cheap) |
| L01–L03 clean run (§5) | ~4% | trivial (11s) |
| L04 mobile edit (§6) | ~10% | pencil-icon color scan, Select All, keypad dismissal |
| Auto-refresh race + L04 re-run (§7) | ~15% | accidental full-chain run, RPC-source read, poll fix, re-edit |
| L03 on-device + LogBox (§8) | ~10% | LogBox dismiss attempts + relaunch |

The **mobile form-fill (submit + edit) and the three Playwright-timing bugs** dominate wall-clock. The first was cut by habit fixes (re-measure before dismiss taps; digit-by-digit OTP); the second was cut by correct grep usage and waiting-for-client-side-redirect.

---

## 10. Derivation A — what slows execution

1. **Self-inflicted price corruption from a "dismiss" tap on a focused field** (price 15→155). The keyboard-up layout shifts the focused field; tapping an assumed-neutral coordinate hit the input and appended a digit. Cost: a full form redo. Root cause: not re-measuring after typing before a dismiss tap — the §5.2 discipline exists precisely for this.
2. **OTP digit entry under bulk typing** drops characters (auto-advance race). Digit-by-digit is reliable but slow (6 taps + re-lists); the auto-verify state race adds a manual Verify. A DEV OTP autofill would zero this.
3. **Playwright timing bugs that only appear in the browser**: (a) client-side auth-guard redirect race (login skipped); (b) the `pending`-filter/queue auto-refresh clobbering post-approval results. Each cost a full run + diagnosis. Not backend defects — test-timing issues.
4. **`--grep` substring trap** (bare "L04" matched the whole describe) caused an accidental full-chain run.
5. **AX-exposure gaps on mobile** (ConditionSelector rows, EditListing inputs/Save, dev-fixture dynamic labels, modal buttons, notification icon) forced OCR/pixel work for nearly every mobile control. The `#F5F5F5` pencil-button bbox and green-icon probe were reliable but slower than a locator would be.
6. **Dev LogBox from prior console errors** blocked on-device verification until a relaunch; the header dismiss controls were not discoverable via tree/pixel.
7. **Keypad dismissal** on both ItemCreate and EditListing is the single most error-prone interaction (the corruption event) — there is no reliable "dismiss keyboard" primitive in the toolset, so every dismiss is a layout-guess.

## 11. Derivation B — patterns an agent should adopt proactively

1. **Conclude from read-only DB + source BEFORE the device/browser.** The phone-gate, the "no pending item" precondition, the condition-required rule, the L03 icon/route mapping, and the approval RPC behavior were all determined pre-execution. The only true surprises were browser-side timing bugs — everything mobile was predicted.
2. **Use the DB read-back as the arbiter between "backend broken" and "test wrong".** Twice the DB proved the app was correct while a UI assertion failed (badge under `pending` filter; auto-refresh race) — this is what kept the fixes in the TEST file instead of chasing phantom app bugs.
3. **Fix the test when the test races legitimate app behavior** (client-side auth guard; post-approval queue refresh). Read the app's actual guard/refresh source to confirm it's app-intended, then make the spec wait/retry.
4. **Re-measure before every post-typing dismiss tap** (OCR/pixel the static text, never guess). This single habit prevents the price-corruption class entirely.
5. **Enter OTP digit-by-digit and use the manual Verify backup**; never bulk-paste into auto-advance digit boxes.
6. **Grep unique test-title fragments** for Playwright `--grep`, not bare case IDs that appear in the describe title.
7. **Locate non-AX controls by color-signature then exact bbox** (`#F5F5F5` pencil, `#5DBB8E` green pill/icon), and verify outcomes by pixel, not assumption.
8. **Terminate + relaunch to clear a dev LogBox** rather than hunting its header controls.
9. **Reuse on-device state** (the restored draft made the second item near-free; the now-verified phone skipped the gate on re-submits).

## 12. Derivation C — instrumentation/fixture work that removes the friction

1. **[P1 – dev] A `dev-fill-item`/`dev-set-price` fixture** on ItemCreate + EditListing (mirror `dev-add-test-photo`/`dev-set-category`) to set title/price/condition in one tap — removes the entire form-fill + keypad-dismiss + Select-All dance (the largest mobile cost) and the corruption risk.
2. **[P2 – dev] A DEV OTP autofill** (or accept any code in dev) — removes the digit-by-digit entry and the auto-verify state race.
3. **[P2 – dev, BP-53] AX exposure for mobile listing controls**: ConditionSelector rows (`accessible`+state), EditListing title/price/Save, dev-fixture dynamic labels, submit/approve modal buttons — removes most OCR/pixel work.
4. **[P2 – dev] Admin `/listings` post-approval refresh**: after approval, refresh into the approved item's new status bucket (or clear the status filter) instead of re-running with the stale `pending` filter — removes the flaky window the spec had to poll through.
5. **[P2 – QA tooling] Playwright helper for client-side-auth apps**: a `loginOrSkip` that `waitForURL` the redirect decision (already in the spec) — promote to a shared admin e2e util so other specs don't repeat the race.
6. **[P3 – QA tooling] Reliable keypad-dismiss primitive** (e.g., a documented `Done`/return key location per keypad type, or a `simctl` hardware-keyboard dismiss) — the single most error-prone interaction.
7. **[P3 – dev] Suppress non-actionable dev console errors** (e.g., background image/network failures) so they don't surface a blocking LogBox during long forms.

---

## Appendix — the reasoning anti-patterns observed (what NOT to repeat)

- **Tapping a "neutral" spot to dismiss a keyboard without re-measuring** → corrupted the focused field (price 15→155) and forced a full form redo. After any typing, re-derive the target before ANY tap.
- **Bulk-pasting into auto-advance OTP digit boxes** → dropped characters; retried overwrite (failed) before switching to Resend + digit-by-digit. Switch to the deterministic method on the first failure, not after two.
- **Greping a bare case ID in Playwright `--grep`** → matched the describe title and silently re-ran the whole chain, costing a full run.
- **Hunting LogBox header controls blindly** (3 coordinate taps) instead of relaunching — bounded attempts, then the cheap deterministic reset.
- **Trusting `page.url()` immediately after `goto()` on a client-side-auth app** — always wait for the redirect decision.
