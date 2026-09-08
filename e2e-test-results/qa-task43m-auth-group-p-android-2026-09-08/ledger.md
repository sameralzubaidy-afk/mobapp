# QA Task 43m — Ledger (AUTH Group P + E04/F02-04/H06, Android)

Run dir: `e2e-test-results/qa-task43m-auth-group-p-android-2026-09-08/` · 2026-09-08 · Medium_Phone_API_36.1 (Android 16)

| TC | Guide | Verdict | Fresh/credited | Evidence / notes |
|---|---|---|---|---|
| AUTH-TC-P01 | AUTH | PASS | Fresh | header-node-chip ViewGroup non-button; tap no-op |
| AUTH-TC-P02 | AUTH | PASS | Fresh | bell+chat+avatar right cluster; no logout in header |
| AUTH-TC-P03 | AUTH | PASS | Fresh | badge 1 → Messages → read (read_at set) |
| AUTH-TC-P04 | AUTH | PASS | Credited (43b + FIX-Task-1) | floating pill layout, tab order, green FAB |
| AUTH-TC-P05 | AUTH | PASS | Fresh | no Inbox tab; Messages via header chat |
| AUTH-TC-P06 | AUTH | PASS | Fresh | Active = 3 pending w/ item+counterpart+status |
| AUTH-TC-P07 | AUTH | PASS | Fresh | History newest-first |
| AUTH-TC-P08 | AUTH | PASS | Fresh | badge 3 = active only (DB reconciled) |
| AUTH-TC-P09 | AUTH | PASS | Fresh | basket badge 1 + Home active highlight |
| AUTH-TC-P10 | AUTH | PASS | Credited (FIX-Task-1) | FAB global + Sell sheet both options |
| AUTH-TC-P11 | AUTH | PASS | Fresh | composer focus/type no nav |
| AUTH-TC-P12 | AUTH | PASS | Fresh | "+" → New Item title prefilled |
| AUTH-TC-P13 | AUTH | PASS | Fresh | empty "+" → empty title |
| AUTH-TC-P14 | AUTH | PASS | Fresh | camera → New Item + camera auto-launch + title prefilled |
| AUTH-TC-P15 | AUTH | PASS | Fresh + source | AI never overwrites prefilled title |
| AUTH-TC-P16 | AUTH | PASS | Credited (FIX-Task-1) | FAB sheet unchanged (both options) |
| AUTH-TC-P17 | AUTH | PASS | Fresh | Profile logout + Settings Sign Out → Landing |
| AUTH-TC-P18 | AUTH | PASS | Fresh | composer analytics DB-verified (tapped x2, submit true x2/false x1) |
| AUTH-TC-P19 | AUTH | PASS | Fresh | tab-trades + header-chat-btn AX + node chip not button |
| AUTH-TC-H06 | AUTH | PASS (full) | Fresh (Skip leg) | Skip → Home + onboarding_skipped_at set (Get-Started leg was 43b) |
| AUTH-TC-F02 | AUTH | PASS | Fresh | 07999 → "We're Coming Soon!" modal (both options) |
| AUTH-TC-F03 | AUTH | PASS | Fresh | Join Waitlist → Confirmed → zip_waitlist row 07999 pending |
| AUTH-TC-F04 | AUTH | PASS | Fresh | Continue Trading → fallback node, no waitlist row |
| AUTH-TC-E04 | AUTH | PASS (functional) + copy finding | Fresh | 4th send blocked (no code row); raw "Rate limit exceeded" copy + resend not disabled (finding 2) |

**Totals:** 20 fresh PASS · 3 credited · 0 FAIL · 0 PARTIAL · 0 BLOCKED.

**DB read-backs (read-only):** test-buyer trades/cart/unread baselines; message `c4223318` send+read; `analytics_events` composer rows; zip_waitlist for F03 (07999 pending) and F04 (none); profiles/nodes for all throwaways; `phone_verification_codes` (3 sends, 4th blocked).

**Residue:** see report §7 (test-buyer 2 drafts + 1 cart item + read message; 6 throwaways incl. one orphan auth user; F03 pending zip_waitlist 07999).
