# Decision & outcome log — qa-fix28-verify-lowsp-n-s-2026-09-13

Chronological action → reasoning → outcome, with the friction that mattered. Only calls/decisions that changed the plan are listed.

| # | Action | Reasoning | Outcome |
|---|---|---|---|
| 1 | Read the playbook + `/memories/repo/qa-test-agent.md`, `fix-task-28-2026-09-13.md`, `qa-test-accounts.md`, `schema-cheat-sheet.md` first | §4/§9: read before the first run of a session; R-NEW-3 schema-consult before SQL | No avoidable schema/query errors this round |
| 2 | Read the tracker's §1 roll-up + TRD section header before planning | R52: the tracker is the source of truth; the file carries several superseded baselines | Established the true baseline (274/33/0/7/3/16 = 333) and that most named cases were already PASS ⇒ the real prize was **conversions**, not re-runs |
| 3 | DB precondition query: personas × SP × subscription | §4 read-only DB preconditions are the highest-leverage step | Confirmed the logged-in user was `test-buyer` (458 SP = DB match) without a single device call |
| 4 | Chose **Android** `Medium_Phone_API_36.1` over the booted iOS sim | Every recent round drives Android; the task's own tool rules quote Android-round rules (R106/R107/F8); the FIX-Task-28 owed legs are written against that emulator | Consistent evidence chain; iOS disclosed as "booted, not driven — R80" |
| 5 | Dismissed the toggle dialog via `qa:ocr --coords` rather than an AX dump | **R107** — `subscription_read_failure` is in the stall class | Zero dev-client crashes this round; `--coords` resolved every dialog in one call |
| 6 | After arming 1a, polled with screenshots only and did a **cold relaunch** | 1a requires "never confirmed" ⇒ the in-process last-known must be discarded | 1a PASS with the exact expected surface |
| 7 | For 1b, substituted "navigate to Profile and back" for the leg's "relaunch" | The leg's relaunch exists to clear last-known for **1a**; 1b's assertion is last-known **preservation**, which a focus refetch tests directly | 1b PASS in 4 calls instead of a ~2-minute relaunch |
| 8 | Re-checked 1c only **after** disarming | Caught my own sequencing error: the toggle was still armed from 1b, which would have produced a false "test-free shows unverified" reading | Correct 1c PASS (upsell renders) |
| 9 | Diagnosed the persona-switch wedge and applied **R101** (force-stop + cold relaunch) instead of re-firing the link a third time | Blank-content spinner + no progress after 2 attempts = the R101 signature | Recovered; ~5 calls spent, bounded |
| 10 | Verified the favourite write with a **DB read-back** before filing the stale-Favorites observation | R100/R59: name the writer / arbitrate with the DB before reporting | Turned a would-be "favoriting is broken" finding into the correct **staleness** finding (F1) |
| 11 | Captured the **stale frame BEFORE** forcing the refetch | §5.6 (2026-09-13): when staleness is the point, the stale→action→post-refetch PAIR is the proof; refetching first destroys it | F1 has both frames |
| 12 | Scrolled to the true bottom before concluding "no banner" on Item Detail | **R103** | The Seller-Info block + "42 more items" CTA were below the fold (as R103 predicts), and became S16/V08 evidence instead of a false "section missing" finding |
| 13 | Drove T03 by reusing the **existing 3-item cart** rather than building a new one | §5.33 repurpose-incidental-state; the cart's 3 items all had caps > 8 | T03 converted to PASS in ~5 calls |
| 14 | Used `qa:set-sp-balance` for the low-SP fixture (not a raw SQL write, not an admin SP adjustment) | DT-75 ships this as the sanctioned fixture tool; the accounts registry narrows the QA write sanction to it | Fixture built + restored, both DB-verified |
| 15 | Set `min_listing_price` via `qa:admin-config-set` and reverted it in the same run | R37/R28: the sanctioned helper is the only legitimate path; scope + revert + verify | No residual config change |
| 16 | Closed the double-refund investigation with reads instead of writing it up as a duplicate | R100 + the FIX-Task-28 report's own verdict rule ("if the two rows split components and sum to the charge, it's a legitimate two-call partial refund") | Item 7 = **NOT A DEFECT**; the two rows per PI are QA's own K07/K08 test fixtures |
| 17 | **Stopped the N-block after N11** and reported N05/N12/N13/N08 as not-reached with reasons | All four are already ✅ PASS (no conversion available); the bulk flow is not assemblable on this emulator (R98 single-select picker) and N08 needs a full purchase | Budget redirected to converting T03/S16/S18 and re-driving M/V/X |
| 18 | Confirmed V13's missing affordance from **source AND the live AX tree** | §6.1 two-source corroboration | The long-standing PARTIAL was re-classified as a **doc-drift/product gap**, closing the "was it ever testable?" question |

**Net:** 5 tracker flips (3 PASS conversions + 2 DOC-DRIFT re-classifications), the round's headline confirmed, and the remaining TRD backlog narrowed and more honestly classified.
