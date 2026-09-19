# Decision-and-outcome ledger — MSG Round 1 (2026-09-18)

Format: step → action (tool) → reasoning → outcome. Read-only/desk steps and device steps are both recorded, in order.

| # | Action (tool) | Reasoning | Outcome |
|---|---|---|---|
| 1 | `read_file` QA playbook §1–§5.21 + §5.22–§5.42 | Playbook must be read before the first run of a session | Rules absorbed (locator, keyboard gate, dialog handling, R29 busy check, §5.23 shell discipline, §5.54 R52 tracker, §5.55 R53 handoff) |
| 2 | `file_search` tracker + guides + agent-memory | Locate canonical sources | 6 canonical guides + `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` found |
| 3 | `read_file` guide entries for B05/D02/G05/G08/I01/I02 | Never execute from memory — read `Setup`/`Assert` per §4 | B05 text = product-DEFERRED "do not run"; D02/I01/I02/G05/G08 expectations captured verbatim |
| 4 | `grep_search` tracker for MSG | Step 0 #1 — verify the dispatch's 64/4/2 | Confirmed: 72 = 64 PASS + 4 PARTIAL + 2 OPEN + 2 NOT-SUPPORTED, 0 never-run |
| 5 | `read_file` tracker lines 236–345 | Read every MSG row's Notes cell | Found G09 PASS-with-residual, F04/F07 Android-column gap, D07 caveat, H02/H03 fixture consumption |
| 6 | `memory.view` `/memories/repo/qa-test-agent.md` + `qa-test-accounts.md` | R78-1 recon-first: reuse prior facts, don't rediscover | Standing rules + persona registry loaded; learned NotificationSetup-occlusion was a 2026-09-04 finding |
| 7 | `grep_search` `TAB_BAR_HIDDEN_ROUTES` | **Hypothesis: the I01/I02 blocker may be fixed** | **HIT** — `PersistentTabBar/index.tsx:70` now contains `NotificationSetup` |
| 8 | `read_file` `PersistentTabBar/index.tsx:55-100` | Confirm the exact allowlist | `ItemCreate, NotificationSetup, ManageKidsClub, SubscriptionExpired` |
| 9 | `git log -S "'NotificationSetup',"` | Attribute the fix to a commit/date (R30 "verified unchanged" discipline) | **`0a104881` (2026-09-06)** — 12 days before this round ⇒ the tracker's 2026-09-04 blocker is stale |
| 10 | `read_file` `NotificationSetup.tsx` (full) | Source pre-read (§R18) before device time: states, locators, copy, palette | 4 statuses; RN `<Button>`; no testIDs; Material palette; 4 distinct null-causes → 1 iOS string |
| 11 | `read_file` `notifications.ts:45-120` | Confirm the null-token causes at the service layer | 4 return-null paths confirmed (Expo Go / not-device / permission / token error) |
| 12 | `read_file` `AppNavigator.tsx:215-240` + `:165-190` | R42 — verify the linking config BEFORE firing a deep link | `notification-setup` + `id-verification-upload` registered ✓; Leaderboard **intentionally not** registered (matches B05 deferral) |
| 13 | `xcrun simctl list devices booted` | §5.41 R29 busy check | 1 booted sim (iPhone 17 Pro Max, `3F3293A3…`) |
| 14 | `pgrep -l -f "expo start"` | R77 #16 — Metro state before connecting a device | Metro on **:8082**; standing rule: do not kill another session's server |
| 15 | `pgrep -l -f "maestro|run-suite|playwright|mobilecli"` | R29 — in-flight automation | only a leftover admin Playwright `test-server` |
| 16 | `session_store_sql` | R29 — session-store heuristic | No recent rows ⇒ not usable as a busy signal |
| 17 | `find e2e-test-results -newermt -90m` | R29 — active-run-write heuristic | Only the just-closed AUTH report + tracker ⇒ device free |
| 18 | `mobile_get_foreground_app` | Confirm app installed/running | App in foreground |
| 19 | `mobile_save_screenshot` 00-start | Baseline evidence | Home as **test-free** (free tier) — persona identified from the UI, not assumed |
| 20 | `terminate` + `launch` | **R79-1c cold-reload gate** (bundle may predate HEAD) | Cold start began |
| 21–23 | poll ×3 | §5.3/§5.7 transition tracking | Splash → Downloading 12% → 100% → `dashboard-screen` = **fresh bundle proven** |
| 24 | `simctl openurl …://notification-setup` | R42/R51 deep-link-first (cheapest navigation) | Arrived in ≤1 poll |
| 25 | `mobile_list_elements_on_screen` | §5.1 mandatory pre-tap resolve | `Enable Notifications` at (16,868) 408x37; **no tab-bar nodes** ⇒ fix live on-device |
| 26 | `mobile_save_screenshot` I02-01 | §5.6 transition evidence | Captured |
| 27 | `mobile_click_on_screen_at_coordinates (220,886)` | Tree-derived center (not estimated) | Tap accepted |
| 28 | `mobile_list_elements_on_screen` | Verify outcome before asserting | Error state rendered with the exact copy |
| 29 | `mobile_save_screenshot` I02-02 | §5.6 dialog/unexpected-state evidence | Captured |
| 30 | staging SQL — `push_tokens` | §5.37/R24 side-effect verification | **0 rows for test-free** ⇒ short-circuit confirmed, not assumed |
| 31 | `mobile_save_screenshot` FULLRES + `qa:inspect-screen` | §5.2 3× scale discipline before pixel work | 1320×2868 confirmed (= 440×956 pt) |
| 32 | `qa:badge-scan --region 60,1221,1200,249` | §5.23 mandated tooling for colour analysis; deterministic over eyeballing | **`#FFEBEE` 92.25%** vs canonical `#FFF0F2` **0.01%** |
| 33 | `read_file` `design-system-passitup.md:140-232` + grep for tokens/44px | Assert deviations against the canonical doc, with exact expected values | Button spec (pill, 52/48/40 px, `#5DBB8E`), 44 px min target, text/error tokens captured; the `#c62828` AA carve-out found and honoured |
| 34 | `read_file` `theme/colors.ts` | Canonical token values from the app's own module | `error[100] #FFF0F2`, `success[100] #E8F5E9`, neutral scale confirmed |
| 35 | staging SQL — `id_badge_verification_requests` × `profiles` | **§4 DB precondition pre-verification** (highest-leverage step) | **test-free: 0 requests (usable)**; **test-seller: PENDING (unusable for D02)** ⇒ avoided a wasted drive |
| 36 | staging SQL — `user_notifications` type counts | Live read for B05 + G05 claims, not inference | 0 `leaderboard_rank_up`, 0 `recall_alert` |
| 37 | staging SQL — `notification_category` enum | Live check of the D10/J05 "no id_verification" claim | 5 categories, **no id_verification, no safety** |
| 38 | `grep supabase/**` for `recall_alert`/`vision` | Name the producer/consumer before declaring a gate | **0 `recall_alert` producers**; `moderate-image` hard-depends on `GOOGLE_VISION_API_KEY` |
| 39 | `grep src` for `recall` + `read_file` `NotificationCenterScreen.tsx:200-265` | Resolve the guide's 2026-08-12 wording flag properly | Shipped name = **"Safety Alerts"**; red treatment = unreachable `CATEGORY_ICONS.safety` fallback |
| 40 | `simctl openurl …://id-verification-upload` + list + screenshot | D02 drive, evidence first | Initial state matches D01 spec |
| 41 | `mobile_click` (220,561) `Use Camera` | Drive the sim leg | `id-verification-error` → "Failed to take photo"; no crash |
| 42 | `mobile_save_screenshot` D02-02 | Evidence | Captured |
| 43 | `read_file` `IDVerificationUploadScreen.tsx:95-300` | Source: is the permission-denied branch reachable without hardware? | **Yes** — `requestCameraPermissionsAsync()` → `Alert.alert('Permission Required','Please allow camera access.')` ⇒ guide's exact copy |
| 44 | `simctl privacy revoke camera` | Induce the denied TCC state (simulator-state only, §5.14-sanctioned class) | Executed; app left the foreground |
| 45 | `mobile_list_elements_on_screen` | Detect the unexpected state | Springboard → app gone |
| 46 | `mobile_list_crashes` | **Distinguish crash from termination before reporting** | No crash for our bundle ⇒ benign TCC side effect (avoided a false P1) |
| 47 | `mobile_launch_app` + poll ×2 | Recover, keep going | Home as test-free |
| 48 | `simctl openurl` + list + click + list | Drive the permission leg | **`Permission Required` / `Please allow camera access.`** + `global-alert-button-0` |
| 49 | `mobile_save_screenshot` D02-03 | Evidence | Captured |
| 50 | `mobile_click ref=@e5` + list | Dismiss + verify | Back to upload state |
| 51 | `simctl privacy reset camera` | Leave the environment clean (§8.3 App State) | Restored to default |
| 52 | greps: screen hexes + app-wide R62b legacy hexes | Design-compliance sweep | NotificationSetup off-token; ID screen 3 minor hexes; legacy greys only in `SellerEarningsScreen` |
| 53 | `grep SellerEarnings` + `read_file AppNavigator.tsx:760` | **Reachability check before filing a design finding** (R62c / near-miss discipline) | Screen is **dead** (route removed, FIX-Task-48 item 2) ⇒ latent, not a defect |
| 54 | `grep docs/DECISIONS.md` | The brief asked to confirm whether MSG has a planned redesign | No MSG/notification/redesign entries ⇒ treated as no planned redesign (flagged as an open question) |
| 55 | greps across all run `report.md`s for MSG negative verdicts | Step 0 #2 — the AUTH J02/J12 bug class | 9 matches, **0 contradictions** (all superseded-by-later-run or accurately reflected) |
| 56 | Write `report.md`, `ledger.md` | §8 report + trace | Done |
| 57 | Update `QA-TESTCASE-STATUS-2026-09-03.md` | §5.54 R52 — tracker must be updated **before** the handoff | MSG 64/4/2/0/0/2 → 65/3/1/0/0/3; §1 roll-up reconciled |
| 58 | Emit the complete §8.3 handoff verbatim in the final chat reply | R53/§5.55 — mandatory final deliverable | Emitted |

## Verified facts (reusable)

- `TAB_BAR_HIDDEN_ROUTES` (2026-09-18) = `ItemCreate, NotificationSetup, ManageKidsClub, SubscriptionExpired`.
- `notification-setup` and `id-verification-upload` deep links are **registered and work warm** in 1 call.
- ID-verification table is **`id_badge_verification_requests`** (NOT `id_verification_requests` — one 42P01 schema surprise, resolved via `information_schema` per §5.34, single retry).
- `user_notifications` columns: `id,user_id,category(text),type(text),title,body,channels,data,is_read,created_at,read_at,variant,notification_channel`.
- `notification_category` enum = `badges, sp_events, subscription, system, trades`.
- `push_tokens` exists in `public` with 114 rows (test-free: 0).
- Simulator 3×: 1320×2868 px = 440×956 pt.
- `xcrun simctl privacy revoke camera <bundle>` **terminates the app** (not a crash) ⇒ budget a relaunch for any future permission-state drive.

## Friction / cost notes

- ~41 device/tool calls for 3 driven cases + 3 desk cases; the largest avoidable cost was the app relaunch forced by the TCC change (§45–47, 3 calls) — now a documented expectation.
- No stale-tree, keyboard-occlusion, or LogBox incident occurred this round (both visited screens are keyboard-free).
- Cold-start bundle download remains the dominant wall-clock cost of any dev-client session (~8–12 s on first launch).
