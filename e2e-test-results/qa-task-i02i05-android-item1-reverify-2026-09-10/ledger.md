# Ledger — QA Task (Android Item-1 re-verify + I02 dismissal persistence + 5c chip) — 2026-09-10

## Exact call ledger (R71 — `qa:mine-call-ledger`, no estimates)

Transcript: `…/GitHub.copilot-chat/transcripts/53e3a518-054b-462f-bf77-521b47c98ecb.jsonl`
```
Messages: 147 · Tool executions (tool.execution_start): 179
```
Per-tool totals:

| Calls | Tool |
|---:|---|
| 38 | `run_in_terminal` |
| 21 | `read_file` |
| 20 | `mcp_mobile-mcp_mobile_take_screenshot` |
| 19 | `grep_search` |
| 19 | `mcp_mobile-mcp_mobile_list_elements_on_screen` |
| 13 | `mcp_mobile-mcp_mobile_click_on_screen_at_coordinates` |
| 9 | `mcp_mobile-mcp_mobile_save_screenshot` |
| 7 | `memory` |
| 7 | `mcp_mobile-mcp_mobile_batch_commands` |
| 5 | `mcp_mobile-mcp_mobile_swipe_on_screen` |
| 3 | `mcp_supabase_execute_sql` |
| 2 | `file_search` |
| 2 | `list_dir` |
| 2 | `manage_todo_list` |
| 2 | `mcp_mobile-mcp_mobile_launch_app` |
| 1 each | `vscode_askQuestions`, `create_directory`, `create_file`, `multi_replace_string_in_file`, `mobile_list_available_devices`, `mobile_list_apps`, `mobile_get_foreground_app`, `mobile_get_screen_size`, `mobile_press_button`, `mobile_get_device_logs` |

**Calls / verdict:** ~179 executions ÷ **10 verdict-class items** (Part 0; Part 1 scroll-to leg, manual-swipe leg, item 3, item 4, item 6, item 7; I05 Android positive leg; Part 2 I02; Part 3 5c) ≈ **~18 calls/verdict**.
Baseline comparison (R71 — exact counts only): 43c **9.6** · TRD-R1b **~23**. This round sits between them.
**Dominant cost classes (this round):** recon/desk reads 18 · R29 busy-check + owner decision 7 · Metro restart + cold load 4 · the Android scroll-to **A/B that returned a NEGATIVE** 9 · source root-causing of 3 findings 7 · dual-platform device legs (Android 13 + iOS 18) 31 · evidence screenshots 29 · tracker/report writing ~10 · fixture create/reset/residue/logout 7.

## Frozen device/tooling facts (carry into the next Android round)

| Fact | Detail |
|---|---|
| Android trade-fetch stall | **Not reproduced** (cold reload → timeline rendered immediately). Treat as a one-off harness artifact. |
| Android timeline scroll range | viewport **825.14 dp** / content **1747.81 dp** ⇒ maxScrollOffset **922.67 dp**; pinnedFooterHeight 84.95 dp; reserved space 216.95 dp. |
| Android max-scroll tail coords (px, 1080×2400) | `extension-toggle` 254 · Payment Details 477–1051 · `message-button` 1156–1282 · `safe-meetup-toggle` 1324–1474 · `report-problem-button` 1505–1631 · `request-cancel-button` 1663–1789 · pinned `confirm-trade-button` 1921–2106 · tab bar 2190–2295. |
| iOS tail coords (pt, 440×956) | `message-button` 477–525 · `safe-meetup-toggle` 541–595 · `report-problem-button` 607–655 · `request-cancel-button` 667–715 · pinned footer 766–834 · tabs 868+. **Reproduces the FIX-Task-13 numbers exactly.** |
| `qa-scroll-to` | **Works on iOS** (one call scrolls the target into the visible band). **Does NOT scroll on Android** — handler runs, ref resolves, logs `RESULT <id> <x> <y>` in dp with y outside the 825 dp viewport; ScrollView never moves. Use **manual swipes** on Android (3× `mobile_swipe_on_screen`, 800 px, started over non-interactive content). |
| Android swipe-down hazard | A swipe DOWN on the timeline triggers **pull-to-refresh** ("Loading trade…", scroll resets to top) — do not use downward swipes to "return to top" when a refresh control exists; re-fire the deep link or navigate instead. |
| `qa:ax-tree` helper | Cannot parse the mobile-mcp session-resource file (it is rendered text, not raw JSON) → `grep -n -E "<anchor>" <resource-file>` is the working path for large Apple/Android dumps. |
| Emoji chip | AX exposes only the `notification-item-glyph-<id>` container (28×28) with no glyph value → **screenshots are required** to assert the emoji. |
| Testing-session hygiene fact | The dev-client **Metro server (8081) dies with a stopped `run-suite.sh`** → after any suite-run interruption, restart Metro (`npx expo start --port 8081`) before connecting a device, or the connect fails "Failed to connect to /10.0.2.2:8081". |

## Decision & outcome log (condensed)

| # | Trigger | Reasoning | Calls | Outcome |
|---|---|---|---|---|
| 1 | Session start | R78-1 recon-first | 18 | Playbook/R77/R78/§5.70-5.74 + tracker rows + guide bodies + qa script usage read; zero device cost |
| 2 | Device prep | R29 — must not interleave | 7 | Found live `run-suite.sh --group D --platform both` on iPhone 16 Pro E2E (Android leg pending, personas in use). Owner stopped it; `pgrep` verified release |
| 3 | Metro down | first connect failed | 4 | Restarted Metro; Android bundle loaded |
| 4 | Part 0 | prove the stall is gone before anything else | 4 | **Timeline rendered immediately → stall NOT reproduced** |
| 5 | Scroll-to tool A/B | R83 — don't assume; A/B from a verified top state | 9 | **FAIL on Android** (4 fires; handler logs valid-looking coords outside the viewport; view never moves) |
| 6 | Reachability | R78-6/R77 #10 — real finger swipes from a non-interactive start | 5 | All four siblings reachable, clear of footer/tab bar ⇒ "permanent occlusion" disproven |
| 7 | I05/I02 Android legs | R82 — one fixture, many verdicts | 8 | Expand/collapse + Chat + chips (I05 Android CLOSED) |
| 8 | Frozen-chat flash | observed anomaly → R83 tiebreaker | 3 | Source-confirmed `ChatScreen` L756 null-trade ⇒ frozen branch; new LOW–MEDIUM finding |
| 9 | iOS Part 2 | brief-directed | 16 | Expand → collapse → away+return = collapsed (persistence PASS) + reproduces FIX-Task-13 coords |
| 10 | iOS scroll-to control | characterize the platform difference | 2 | Tool **works on iOS** ⇒ Android failure is platform-specific, not a broken link |
| 11 | Part 3 | real rows existed → no synthetic data (R78-2) | 6 | 5c chip **visually confirmed**; error state + LogBox noted |
| 12 | Root-causing | no guessing (R83) | 7 | logcat RESULT lines + scroll metrics + `chat.ts:560` + `notificationItemGlyph.ts` map |
| 13 | Cleanup | brief + R89-style restore | 4 | Fixture deleted (0/0/0 rows), both sessions logged out, residue SQL-documented |
| 14 | Closeout | R52 + R53 | ~10 | Tracker flips + this ledger + `report.md` + §8.3 handoff |

## Tracker edits (R52/R56 — all three count surfaces updated atomically)
- `TRD-TC-I02`: 🟡 PARTIAL → **✅ PASS** (both platforms) + notes rewritten (Android leg closed, tool-leg failure, DOC-DRIFT caveat).
- `TRD-TC-I05`: Latest → **PASS (both platforms)** + Android positive-leg closure + the frozen-chat finding appended.
- §1 roll-up TRD row: `235 PASS / 29 PARTIAL` → **`237 PASS / 27 PARTIAL`** (OPEN 2 · DOC-DRIFT 3 · SKIPPED 2 · Remaining 17 unchanged).
- TRD section header count line + the canonical-baseline note: updated to the same figures in the same pass.
- New dated round block added above the FIX-Task-13 block.
