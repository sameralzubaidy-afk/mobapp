# QA Task 26 — decision/outcome log (concise)

Run: `qa-task26-msg-g-closing-2026-09-03/` · 2026-09-04 · 8 PASS / 0 FAIL / 0 BLOCKED

## Batch 1 (MSG G-close, test-seller)
| Case | Fixture | Outcome | DB/evidence |
|---|---|---|---|
| G01 | ba6345ce (flagged) | PASS — Safety Review loads (not Listing-not-found), FLAGGED badge + correct actions | `G01-flagged-safety-review.png` |
| Item 2 | bogus id | PASS — error state centered layout (canonical tokens) | `G01-error-state-layout-item2.png` |
| G02 | ccf97ae4 (rejected-fresh) | PASS — empty/<10-char validation + valid appeal → "Appeal Submitted"; DB: → flagged, appeal_reason/appealed_at/edited_since_rejection | `G02-*.png` |
| G03 | afd3384a (needs-edits) | PASS — Make Edits Now → pre-populated EditListing → edit → Save → auto-resubmit pending (DB: appeal_count 1) | `G03-*.png` |
| G04 | ce322cd9 (rejected) | PASS — Remove Listing → confirm modal → Removed (DB: status deleted). Remove renders on rejected only (pure-flagged = Edit-only) | `G04-*.png` |
| G06 | ce322cd9 (appeal_count 3) | PASS — "Appeal limit reached. Maximum allowed appeals: 3." (DB unchanged pre-G04) | `G06-*.png` |
| G07 | e2096de2 (rejected 15.6d) | PASS — "Appeal window has expired… within 14 days" (DB unchanged) | `G07-window-expired-alert.png` |

## Batch 2 (spot-checks)
| Item | Check | Outcome | Evidence |
|---|---|---|---|
| MSG E04 | admin details page d148ee0f | PASS — Approved (green pill), holds after reload | browser screenshots |
| SUB E03 | test-buyer Billing History | PASS — FAILED row ($5.99) shows error_message caption | `SUB-E03-failed-reason.png` |
| Item 7 | ID-upload rejected amber note | PASS — "Your previous submission wasn't approved…" renders | `Item7-rejected-amber-note.png` |
| Item 6a | screenshot_path dangling | PASS — 0 non-null of 76 rows (no regression) | SQL read-back |

## Friction/facts
- mobile-mcp `open_url` rejects non-http → QA deep links via `xcrun simctl openurl booted`.
- Session dropped to Landing 2× mid-run (no crash) → `qa-login-as?persona=` restores deterministically.
- Config read-only verified: max_attempts 3, window_days 14.
