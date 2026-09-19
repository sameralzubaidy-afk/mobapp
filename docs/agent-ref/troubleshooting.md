# Section 9: Troubleshooting & debugging guidelines

Moved verbatim from `.github/agents/Kids P2P App Builder.agent.md` (2026-09-18, Phase D) so the always-loaded agent file stays small. Not auto-loaded: the Builder agent reads it on demand when its pointer says so. Edit in place here; do not copy back into the agent file.

9. Troubleshooting & debugging guidelines
When the user reports issues or asks for debugging help:

9.1 Gather context first
Read the error: Get full error messages, stack traces, console logs
Check the module: Which module/feature is failing?
Verify implementation: Compare against VERIFICATION checklist - what's missing?
Review related code: Read Edge Function, RLS policies, and mobile screen code
9.1a State the investigation stance upfront (confirm vs. rule out — 2026-08-31)
At the top of any QA-finding investigation, explicitly state whether you are confirming a bug or ruling one out. A "false alarm, no bug" verdict with evidence (source + DB read-back) is an equally valid, first-class outcome and must be recorded as such in the handoff — never treated as a wasted investigation. (Worked examples: DT68 refund-vs-void — confirmed not a bug: uncaptured PIs are correctly voided, not refunded; DT71 tax-report mislabeling — ruled out after source + DB check.)

9.1b Quote-verify any quoted on-screen text before trusting the finding's surface (2026-09-11)
Before accepting a QA finding that quotes on-screen text — a label, error string, alert title, banner heading, or button copy — grep that EXACT literal from the source (`grep -rn "<quoted string>" <app dirs>`) and, for a string that may have been removed, check history too (`git log -S "<quoted string>" --all`). If the literal has never existed in the codebase, the finding's quoted evidence is unverified AND its SURFACE attribution is unreliable (the screenshot may show a different component, or the quote may be an OCR/paraphrase artifact) — so re-base the investigation on the surface that actually renders that state and record the discrepancy in the handoff. Never invent or style-migrate a component to match a quoted string that no code emits; if no surface matches, ask QA for a fresh capture of the exact moment. Pair this with 9.1a: "quoted string not in source" is itself a first-class ruled-out result. (Worked example: FIX-Task-17 item 3, 2026-09-11 — a QA finding quoted an inline banner reading "Cashout Failed / Payout method is invalid or expired"; neither string has ever existed in the repo (grep + `git log -S` both empty) and the cited screenshots showed a different surface entirely, while the real, fixable defect was the checkout alert echoing the raw Edge Function message instead of the canonical copy. The unverified quote cost investigation time and risked a fabricated "fix".)

9.1c Spec-silent QA finding — check for an in-file sibling precedent before you escalate it as a product decision (2026-09-11)
When a QA finding describes behaviour the canonical spec does NOT cover (a state the spec never contemplates), do not jump straight to "is this intentional?" — first look for a sibling feature in the SAME file/module that already solves the analogous problem (the neighbouring prompt, filter, guard, or status gate). If one exists, the finding is an in-file inconsistency: the parallel path skipped the pattern its own neighbour follows, so mirror the sibling, re-verify both states, and hand Samer a recommendation with evidence instead of an open question. Escalate as a product/UX decision only after that check comes up empty — and even then surface it as a question with a recommended option before implementing (OWNER CONTEXT: "Never assume a product decision"). Mirror the sibling's derived values as well as its gate (the bundle fix had to correct an over-counting `total`, not just the condition), and name the sibling you mirrored in the handoff so the consistency fix is reviewable. (Worked example: FIX-Task-18 item 1, 2026-09-11 — QA reported the bundle "Confirm All" shortcut vanishing once one bundle item was completed; the spec (§11.3.1) only described the all-in-progress case, so it read as a judgement call. `TradeTimelineScreen`'s cancel-all prompt, in the SAME file, already filtered its sibling set by status before offering its batch option — so the completion path was inconsistent with its own neighbour. Mirroring the cancel pattern (filter siblings to `in_progress`, count only confirmable trades) turned a product question into a consistency fix, gave the owner one clear recommendation, and made the guide's TRD-TC-L02 leg testable again. Same instinct as the Copy-Consistency Class Sweep, one surface over: sweep for how the codebase already does it before inventing behaviour.)

9.1d Verify the MATCHER and the HISTORY before filing an absence/duplicate defect (2026-09-12)
Two false positives cost investigation time in the agent-rules audit, and each is avoidable with one extra check. **(1) A collision claim is only as good as the pattern that produced it.** Before reporting "X appears twice / is duplicated", capture the FULL identifier and print both occurrences — a pattern like `^### 5\.[0-9]+` truncates the legitimate `5.47b` to `5.47` and reports every `X`/`Xb` parent-and-sub-section pair as a duplicate; a rule defined as `R62a/b/c` is missed by `**R62 —` and then reported as a gap. The audit's "three duplicated §5.x headings" finding was **retracted the same day** as a grep artifact: `^### 5\.[0-9]+[a-z]?` returns zero true duplicates. **(2) An absence claim needs a history check, not just a working-tree check.** "This number is unassigned" and "this rule was deleted" produce the SAME empty grep today but need OPPOSITE fixes (allocate a number vs. restore lost content), so re-run the search against the pre-edit commit (`git grep -n "<id>" <pre-edit-commit> -- <dir>`) before declaring a slot free. Both cases arose in the same audit: BP-50/BP-52 returned zero hits at the pre-edit commit (genuinely never allocated — `UNASSIGNED` was correct), while R58–R60 and R79 looked equally empty in the working tree but were **missing/deleted content** that had to be restored, not re-allocated. Pair with 9.1a (state the stance upfront — "retracted as a grep artifact" is a first-class outcome, not a wasted investigation). (Worked example: agent-rules audit, 2026-09-12.)

9.1e Reproduce a dispatched fix's PREMISE before implementing its prescribed remedy — and verify a leg's REACHABILITY PRECONDITION before accepting it as owed (2026-09-16; extended 2026-09-17)
When a task arrives pre-diagnosed — "the cause is X, so do Y" — treat that diagnosis as a CLAIM to verify, not an instruction to execute. Reproduce the reported failure yourself and measure the FULL failure set (not just the first error the reporter happened to hit), because a prescribed remedy can be genuinely correct for the symptom it was written against and still be structurally incapable of reaching the stated goal. If the evidence contradicts the premise, STOP and escalate the scope change WITH the evidence BEFORE building — do not implement the remedy, watch it fail, and hand back another round of the same failure. Cheapest ordering: reproduce the failure → enumerate every distinct failure class → then decide whether the prescribed remedy can actually reach the goal. This is the dev-task twin of 9.1a (state the stance upfront) and 9.1d (an absence claim needs a history check): here the claim under test is the TASK'S OWN diagnosis, and "the prescribed fix is insufficient" is a first-class finding — not a reason to keep executing harder. Pair with Root-Cause Discipline (find out WHY a fix did not persist before re-applying it) and Blocked-Tier Discipline (a tier that keeps failing on a pre-existing defect needs an OWNER decision, not another silent carry-forward). (Worked example: FIX-Task-38, 2026-09-16 — dispatched for the THIRD time as "renumber the 111 legacy migration files into dependency order and `supabase db reset` will pass". Reproducing the failure and replaying all 522 migration files with failure-deferral showed 234 could never apply: `public.trades` had no creator in ANY migration (verified against the working tree AND the full git history) and the node-id columns were `text` where the live schema is `uuid` — so renumbering alone could not have worked; it would have moved the failure, not fixed it. Escalating the scope change before building avoided a fourth identical round, and the repair that WAS possible took the chain from 288 to 448 of 523 files applying.)

**Second face — a REACHABILITY PRECONDITION is also a claim, not a fact (added 2026-09-17).** A dispatched task carries preconditions on the work it hands over, and they arrive phrased as established fact: "not yet device-verified (conditional on data state): the `profileButton` border (needs an active trade)", "needs a FREE persona", "this branch is unreachable until X". Settle each one with a single read of the file that owns the named style/gate — does `profileButton` really set its border conditionally? — BEFORE it shapes your plan, because the precondition decides your own coverage report: a wrong one understates what you verified, inflates the owed list, and is then copied into the next handoff where it hardens into folklore. Cheapest ordering: read the owning style block / gate expression → confirm the named condition is genuinely required → only then mark the leg owed, and CORRECT the precondition in the handoff when it turns out to be unconditional. This is the third face of the same discipline (9.1a: state the stance upfront; 9.1d: an absence claim needs a history check; here: a REACHABILITY claim needs a source read), and it is the INPUT side of BP-91 rule 2 — that rule obliges an owed leg to name the fixture state it needs, so the name it receives must be verified rather than inherited. Do not over-correct into distrust: run the check on every precondition in the dispatch and expect most to hold — in the worked example below the siblings "this listing has `color: null`" and "this seller has 1 listing" were both true for the data they named — so the discipline is a one-grep tax, not a reason to re-derive the whole dispatch. QA-side analogues, to cite when the precondition concerns a test path rather than a code path: R42 (§5.51 — verify a guide's "reachable via `<path>`" claim against `linking.config` BEFORE trusting it) and R26 (§5.40 — verify fixtures/preconditions BEFORE assembling a case). (Worked example: FIX-Task-49, 2026-09-17 — the owed leg inherited from the previous round's handoff, "`profileButton` border (needs an active trade)", was FALSE: `ItemDetailScreen.profileButton` sets `borderColor: '#CCCCCC'` with `borderWidth: 1` UNCONDITIONALLY, so the border was already verifiable in the plain no-active-trade state and closed in that same session; the inherited precondition had understated the previous round's coverage by a whole leg — and the same list's genuine conditions were left honestly owed rather than declared verified.)

9.1f Reproduce a reported UI defect through its REAL entry path — navigating to the screen masks initial-mount-only defects (2026-09-17)
A defect a user hits on the way INTO the app (cold launch, the post-login remount, session restore, a deep link that mounts the route directly) can be invisible when you reproduce it by navigating to the same screen afterwards — because a component's own route/state read can differ on an INITIAL mount from its value after any navigation event. So reproduce through the SAME entry path the report describes (terminate → cold launch, or relaunch-to-restore), not just "open the screen": a passing UNIT/integration test can look green for exactly the same reason, because tests almost always drive a navigation rather than an initial-route mount. When a fix gates a root-level element (floating tab bar, overlay, banner) on the active route, read that route from the navigator that OWNS it — or from root state updated by the navigator's own route listener — and never by keying a root-level sibling with the navigator's own key: `key={navigatorKey}` on both the `<Stack.Navigator>` and a sibling overlay raises "Encountered two children with the same key" AND does not fix the gate (measured this round: a keyed remount and a post-mount `useState` nudge both failed; only root-level route tracking worked). Pair with 9.1a (state the stance upfront — "cannot reproduce by navigation" is not "cannot reproduce"), BP-55 (a root-level gate whose state is only ever set by a mount effect), and the QA-side entry-path discipline (a verdict must name the entry path it actually drove). (Worked example: FIX-Task-50 item 2, 2026-09-17 — the Subscription Expired gate's `continue-free-link` sat under the floating tab pill, and tapping it opened the Sell sheet. The route-based pill-hide worked when the gate was reached by NAVIGATION (so the QA deep-link re-test looked green) but not when `SubscriptionExpired` was the navigator's INITIAL route (an expired user launching the app or logging in) — the defect only reproduced on a cold boot, and its unit test was green for the same reason.)

9.1g Trace the READERS of a field before choosing the layer that fixes it (2026-09-18)
When a task hands you a fix with a suggested location ("likely in the Edge Function, or as a check whenever the list loads"), treat that location as a CLAIM to test exactly like the diagnosis itself (9.1e). The question that decides the layer is not where the symptom is visible but **who READS the state you are about to correct**: grep every reader of the field/flag and rank them by consequence. A fix that corrects a STATE must live at the layer that owns that state for its **most consequential reader** — usually the database — not at the layer where the symptom happens to be visible; and prefer extending the rule where it already lives over adding a parallel mechanism in a second layer, which would be split-brain (BP-27). Cheapest ordering: grep the readers → name the most consequential one → implement there → verify at BOTH that layer and the surface that reported the symptom. Pair with 9.1e (the suggested location is part of the dispatched premise), BP-27 (duplicate enforcement across layers), BP-92/BP-95 (one source of truth per value). (Worked example: FIX-Task-56 item 2, 2026-09-18 — the brief proposed auto-promoting a seller's sole verified payout method either in `sync-stripe-connect-status` or "as a check whenever the payout methods list is loaded". Tracing the readers showed the same `is_primary` flag was read by four server-side money paths, and that `rpc_create_payout_on_trade_complete` parks EVERY payout as `requires_action` when it finds no primary — so the suggested UI-side fix would have made the screen claim the seller was set up while their earnings kept stranding. Implementing the rule once in the database (a `SECURITY DEFINER` rule function + `AFTER INSERT OR UPDATE OF is_verified` trigger + backfill) fixed the guard AND the money paths, and was verified at both layers: fixture read-back on staging, then the withdraw modal on device. Same round, the sibling instinct — check the fixture against the writers that can create its state — became BP-98.)

9.1h A regression test is not evidence until you have watched it FAIL with the fix disabled (2026-09-18)
A test written to guard a fix proves nothing about the fix until it has been shown able to fail. Write the test, then NEUTRALISE the fix (comment the guard out, `false &&` the branch, flip the flag) and re-run it: expect RED. Restore the fix and re-run: expect GREEN. Record BOTH runs as the evidence — a green-only run is indistinguishable from a vacuous test, and a vacuous test is worse than no test because it certifies the fix as covered. This is the test-side twin of BP-90 ("invoke the patched object immediately — `CREATE OR REPLACE` success proves nothing") and of the QA playbook's discriminating check (R79-1): in all three the failure mode is a PASS obtained without the code under test ever running. A vacuous test usually fails for a TIMING reason rather than a logic one — with a mock that resolves immediately, the competing trigger never overlaps the one under guard, so the assertion passes even with the fix removed. Make the window DETERMINISTIC instead of hoping for it: hold the promise PENDING via a deferred/controlled mock so the race you are guarding is guaranteed to occur. Tells that a test is vacuous: it also passed before the fix existed; it asserts the call only with `toHaveBeenCalledWith` (which passes for ANY count); it counts calls INSIDE `waitFor` (which can pass at the instant of the first resolve, before the second arrives); or its mock settles so fast the competing path never runs. The rule applies at every layer, not just Jest — SQL (invoke the changed branch AND a negative-control argument that must fail, per the `--self-test-fail` harness pattern), Edge Functions, admin Playwright specs (assert that broken input is REJECTED, not only that good input passes), and fixture scripts. Leave no residue: grep for the marker used to disable the fix (`TEMP-PROBE`, `false &&`) and confirm the tree is clean before handing over — the same un-stub discipline BP-89 requires for `page.route`. Pair with BP-88 (a mocked branch may never fire on the real path at all — that is the reachability/INPUT side; this is the test-power side), BP-57 (update tests written around the old broken behaviour — never weaken the fix to keep them green), BP-98 (a fixture must only assert a state the production writers can create), and BP-91 rule 3 (a green test is never on-device verification). (Worked example: FIX-Task-58 item 3, 2026-09-18 — the fix added a single-verify guard to the phone-gate modal so the DEV autofill button could not publish a listing twice. The first regression test PASSED with the guard removed, because the suite's immediate `mockResolvedValue` let the first verify settle before the auto-verify effect re-fired — the duplicate trigger the test existed to catch never happened at all. Rewriting it to hold `verifyPhoneCode` pending via a deferred promise made the overlap deterministic: with the guard disabled it failed `Expected number of calls: 1, Received: 2`, and with the guard restored it passed. Without that second run the handoff would have claimed a duplicate-publish bug was covered by a test incapable of detecting it.)

9.1i Size a data defect by COUNTING the whole set, never from the sample query that demonstrated it (2026-09-19)
Before remediating bad data, size the defect with its OWN predicate — `SELECT count(*) … WHERE <defect predicate>` — and only THEN enumerate the rows to fix. The "examples" query you reach for to SHOW the problem (`ORDER BY created_at DESC LIMIT 3`, a single status filter, one user id) is a SAMPLE, not a census, and treating it as one under-scopes three things at once: the repair, the blast-radius line in the report, and — when the write needs owner approval — the approval itself, because an approved "3 rows" that is really 6 has silently widened a write without consent. Two shapes, one error: a `LIMIT` makes the extra row invisible, and a single-value filter (`status='requires_action'`) parks the same defect under another state where no query in the investigation looks. Cheapest ordering: express the defect as a boolean predicate (`body LIKE '%Invalid Date%'`) → `count(*)` it → enumerate → repair → re-count and expect ZERO. **When the defect IS the value — garbled glyphs, mojibake, a file-encoding artifact — the predicate cannot be the intended text**: a `grep` for `🚫` returns zero precisely because the glyph is what is broken, so count the CORRUPTION token instead (`grep -c $'\ufffd'`, or a codepoint count) and sweep the whole FILE rather than the cell the finding named. This is the counting twin of 9.1d (an absence claim needs a history check) and the input side of 9.1e (a dispatched premise is a claim, and "the blast radius is N" is one of them). Pair with BP-76 (count the DATA before trusting a status-driven gate or rule) and BP-80 (state what actually ran; verify the object, not the log). (Worked example: FIX-Task-66 item 1, 2026-09-18 — the "Invalid Date" notification defect was handed over as "three rows" from `ORDER BY created_at DESC LIMIT 3`, which missed a FOURTH row for the same user (0.35 s older, so outside the limit). Counting the defect predicate revealed SIX rows, including two UNREAD rows for a real, non-persona user dated 2026-06-03 — so the defect had been reaching production users for months while the sample read as test data, and both the first repair pass and its owner approval were scoped to the wrong, smaller set. Second sighting — FIX-Task-67 item 5, 2026-09-19: the tracker's corrupted-glyph finding was handed over as "the MSG-TC-B05 row's `Status`/`iOS` cells, ×2"; counting U+FFFD found **31 characters across 17 rows**, so repairing only the named cells would have left 30 corrupted status cells in the QA source of truth AND re-flagged the same file next round.)

9.2 Common issue patterns (with symptom → rule cross-references — check these BP rules FIRST before investigating from scratch)

Issue: "Listings not showing up"

✅ Check: RLS policies on listings table
✅ Check: Node filtering (user can only see their node's listings)
✅ Check: status = 'active' filter
✅ Check: Subscription tier visibility rules
See also: BP-3 (ambiguous column reference can silently mis-filter a query)
Issue: "SP not being earned/spent"

✅ Check: User subscription status (SP is Kids Club+ only)
✅ Check: Seller's payment preference (Cash Only = no SP)
✅ Check: 50% cap enforcement
✅ Check: Transaction status (must be 'completed' to release pending SP)
See also: BP-14 (notification copy vs. actual ledger semantics), BP-31 (verify both trigger AND RPC layers)
Issue: "User-visible data (a stored string, a rendered row) contradicts the source code — no file in the working tree can produce it"

✅ Check: Read the DEPLOYED revision before hypothesising a hidden writer — `supabase functions list --project-ref <ref>` prints the live version + timestamp, and a deployed Edge Function can sit many commits behind the working tree (deploy-drift detail: `docs/agent-ref/mcp-and-tooling.md`)
✅ Check: Count the defect with its own predicate BEFORE repairing it, then re-count afterwards and expect ZERO (§9.1i)
See also: §9.1i (size a data defect by counting the whole set), BP-66 (a "Deployed" message is not proof — verify the deployed body), BP-97 (a deployed EF that never processed one real delivery is UNVERIFIED)
Issue: "Edge Function returning 401/403"

✅ Check: JWT token passed in Authorization header
✅ Check: RLS policies allow the operation
✅ Check: User has correct role/permissions
✅ Check: Node access (user in correct node)
✅ Check: If the EF is DB-trigger/cron-invoked, it does NOT require `bearer === SUPABASE_SERVICE_ROLE_KEY` — the DB posts the `admin_config`-stored key, which can drift from the env, so every trigger/cron call 401s and money rows strand (BP-87)
See also: BP-19 (`verify_jwt = false` required for cron-invoked functions), BP-87 (DB-trigger/cron-invoked EFs must not enforce strict bearer == env service role key), `edge-functions.instructions.md` HP-3
Issue: "Social/OAuth login leaves the user on a raw JSON / developer error page (e.g. Apple provider disabled)"

✅ Check: The provider is actually enabled in Supabase Auth — a disabled provider returns `400 validation_failed "provider is not enabled"` only when the opened authorize URL loads (BP-88)
✅ Check: The OAuth call config — `signInWithOAuth({ skipBrowserRedirect: true })` returns a URL WITHOUT throwing for a disabled provider, so a classification branch keyed on an initiation error never fires (BP-88)
✅ Check: The friendly-error banner's copy path is actually reachable — the trigger must surface inside the client's try/catch, not inside the browser sheet/custom tab (BP-88)
See also: BP-88 (error-classification branches need a real runtime trigger — mocked-error unit tests can green-light dead code; **and an INVENTED mock shape keeps an unreachable branch green** — the real wrong-password error is `400` + `error_code:invalid_credentials`, so a fixture using `401` + no `code` passes while the classifier's `default:` arm ships the wrong copy; FIX-Task-26 verification, 2026-09-13), BP-8 (typed service errors)
Issue: "Subscription features not working after purchase"

✅ Check: Stripe webhook received and processed — **and the handler can actually PROCESS a delivery** (a deployed, source-parity-clean webhook can still reject every event; BP-97)
✅ Check: users.subscription_tier updated in DB
✅ Check: subscription_expires_at set correctly
✅ Check: Mobile app refetched user profile after purchase
See also: BP-40 (Stripe `trial_end`/`trial_period_days` mutual exclusivity), BP-28 (admin-configurable value with no hardcoded fallback), BP-83 (webhook must be subscribed to `checkout.session.completed` + `customer.subscription.created`, or the purchase never creates the `subscriptions` row), BP-97 (a deployed-+-source-parity webhook is not an EXERCISED one — check it can process a real signed delivery before blaming the subscription logic)
Issue: "Subscription not renewing / current_period_end not advancing"

✅ Check: The Stripe webhook endpoint is subscribed to `invoice.payment_succeeded` (BP-83)
✅ Check: If driving a renewal via test clock, the clock was set at subscription CREATION — clocks cannot be retro-attached to an existing Checkout sub (BP-83)
✅ Check: The `invoice.payment_succeeded` handler found the `subscriptions` row by `stripe_subscription_id` before the renewal invoice fired (BP-83)
See also: BP-83 (test-clock renewal verification), BP-71 (real charge/pay path)
Issue: "Screen colors/tokens look off-brand (blue CTAs / Material palette)"

✅ Check: No Material/Tailwind/system-blue hex in the screen or its sub-components (BP-82)
✅ Check: The screen imports Pass It Up semantic tokens, not a legacy/foreign palette (BP-82 / BP-56)
✅ Check: No legacy-design-system tokens (`#4A7C59`/`#4D4D4D`/`#808080`) anywhere in the file — they leak outside Discover into subscription screens too (BP-82, ContinueKidsClub upsell branch, 2026-09-05)
✅ Check: EVERY rendered branch/variant of the screen (trial/upsell vs active vs per-status) is on-brand, not just the branch under the current test persona (BP-82 rule 6)
See also: BP-82 (account/subscription screens incl. ContinueKidsClub, every branch), BP-56 (Discover discoveryTokens — `#4A7C59`/`#4D4D4D` also forbidden there), BP-86 (membership/value-prop copy must match the canonical benefit set), BP-85 (cents-stored money needs a cents formatter — "$1.49" not "$149")
Issue: "Push/in-app notification never arrives for a state change"

✅ Check: Is there already a DB trigger handling this event? (BP-20)
✅ Check: `send-trade-notifications` response body — `resp.ok` can be true with `sent === 0` (BP-17)
✅ Check: Reminder-type EFs must explicitly insert `user_notifications`, not rely on triggers (BP-18)
✅ Check: Cron-invoked EF has `verify_jwt = false` (BP-19)
See also: BP-32 (notification verification gate for any new state change), BP-74 (verify a created notification by its `data.ledger_id` linkage key — never a fuzzy/shared filter helper)
Issue: "Realtime update doesn't reach the screen / stale UI until manual refresh"

✅ Check: Target table is in the `supabase_realtime` publication (BP-36)
✅ Check: RLS would not silently filter the event out (BP-36)
✅ Check: The Realtime callback re-applies the same side effects the mount-time effect runs, not just UI state (BP-23)
Issue: "Admin changed a config value but the app/UI still shows the old value"

✅ Check: Pull-to-refresh passes `forceRefresh = true` to bypass in-memory caches (BP-15)
✅ Check: Client error copy isn't hardcoding a numeric value the server should own (BP-28)
✅ Check: the COALESCE chain's hardcoded fallback covers ONLY non-secret values (base URL) — the service role key resolves from config with no baked-in fallback, and no literal credential is baked into a cron `net.http_post` header (BP-22)
Issue: "Tax amount looks wrong when the buyer applies Swap Points"

✅ Check: Tax is calculated on the full item price, never on `cash_amount_cents`/SP-reduced amount (BP-37)
✅ Check: Trade detail/timeline screens derive the taxable base from the joined listing's `price`, not the trade object (BP-42)
✅ Check: Any RPC/trigger that recomputes tax on the trade is category-aware (honors `tax_exempt_goods`) and matches the offer-time value (BP-44)
Issue: "Admin search box (Payments/Trades) returns Fetch failed: 404/400"

✅ Check: The search targets a raw table with UUID columns instead of a text-cast view (BP-45)
✅ Check: No filter term puts a `::cast` inside `or=(...)` — PostgREST supports neither `ilike` on UUID nor casts in `or` (BP-45)
See also: BP-45 (create a text-cast view like `admin_trades_view`/`admin_payments_view` for searchable admin surfaces)

Issue: "Applying a SQL migration / CREATE OR REPLACE FUNCTION fails with 42601 '<var>' is not a known variable"

✅ Check: Every `v_*` variable used in the function body is declared in its `DECLARE` block (BP-46)
✅ Check: The migration FILE (not just the query pasted into apply_migration) also declares them — a fresh `supabase db reset` replays the file (BP-46)
See also: BP-46 (diff the DECLARE block against every `v_*` used before authoring/applying any Postgres function)

Issue: "A function/RPC broke right after a migration that 'only' renamed a column or re-pointed its body — `42703 column <alias>.<col> does not exist` on the first call"

✅ Check: The body patch was ANCHORED to a full expression (`p.status = 'failed'`), never a bare token (`p.status` also matches the suffix of `sp.status` in the same body) (BP-90)
✅ Check: Every predicate that was meant to SURVIVE the patch is re-asserted before the body is written — a `RAISE EXCEPTION` guard, not a `RAISE NOTICE` (BP-90)
✅ Check: The patched object was actually INVOKED (`SELECT public.<fn>();`) — plpgsql resolves names at run time, so `CREATE OR REPLACE` success is not evidence the body is correct (BP-90, BP-81)
See also: BP-90 (patch a live function body with anchored tokens + survival guards + immediate invocation), BP-47 (the latest definition is authoritative — patch the live body), BP-46 (run-time name resolution)

Issue: "A migration replay / `supabase db reset` fails on a file I did NOT touch — or a fix I just made INCREASED the number of failing files"

✅ Check: The chain was re-measured as a WHOLE after the fix (pass-1 applied count + total unresolved), not just the file that was repaired — a newly-succeeding early file can create state (schema, extension, enum label) that a later file assumed absent (BP-96)
✅ Check: The per-file error being investigated is the ROOT cause, not the LAST error from the probe's final deferred pass — re-run that one file alone against the settled DB to get the real cause (BP-96)
✅ Check: The remaining gap was enumerated by diffing the live schema against the replayed schema (truth), not by reading the probe's failure list (symptom) (BP-96)
✅ Check: **EVERY pass's applied count** was compared, not just pass 1 — a hoist in phase 3 moved `unresolved` 1 → 3 while pass 1 stayed flat at 389; only pass 2 (135 → 133) exposed it (BP-96 rule 6)
✅ Check: No `GRANT` / `COMMENT` / `DROP … IF EXISTS` targets a function signature that a **different** file creates — four files commented on a 4-arg `get_tax_summary_for_period` they never create, while creating the 5-arg version (BP-96 rule 7)
✅ Check: Where two files define the same object, the earlier one applies first — otherwise the older body silently wins and the fingerprint (identity, not body) stays green (BP-96 rule 8)
✅ Check: A `db reset` failure was classified as CONTENT vs EXECUTION CONTEXT before "fixing" it — and no security-relevant statement (`CREATE POLICY` on `storage.objects`) was fail-softened just to get green (BP-96 rule 9)
✅ Check: A renumbered chain was confirmed by **`pass 1: applied <N>, deferred 0`** — a single-pass, zero-deferral replay is what `db reset` actually requires (BP-96 detection checklist)
✅ Check: The probe was re-run after **every** migration file ADDED or EDITED, not only after a repair — a file added one day after the chain was last green re-broke it (`531/531` → `530/531`, `unresolved: 1`), and the check costs minutes (BP-96 rule 10)
✅ Check: Every `.sql` file in `supabase/migrations/` matches `<digits>_<name>.sql` (`… | grep -vcE '^[0-9]{14}_'` prints **0**) — a non-conforming name is silently SKIPPED by the CLI and never even logged as `Applying migration …`, so "the file did not run" must be diagnosed as a NAME problem before a SQL problem (BP-99)
✅ Check: A NEW fidelity finding appeared right after YOUR change → attribute it with the discriminating re-run before writing it up: move your own migration out, re-run `replay-probe.mjs` + `fidelity-check.mjs`, and compare key sets — **identical keys means the delta is not yours**; also check `git status` for another session's uncommitted work (BP-100 rule 7)
✅ Check: A residual was classified by DIRECTION per item (not backfilled wholesale) and any object about to be re-added was grepped for a deliberate prior `DROP` — the count is never driven to zero (BP-100)
See also: BP-96 (re-measure the whole chain after a repair; re-run after every migration file; probe errors are last-errors; enumerate gaps by schema fingerprint), BP-99 (filename is an order key; the CLI silently skips non-conforming names), BP-100 (classify every schema-diff residual by DIRECTION, never drive the count to zero, and ATTRIBUTE a NEW finding via a discriminating re-run before reporting it as a regression), BP-9 (migration dependency order), BP-47 (the latest definition is authoritative)

Issue: "E2E test fails right after signup because trigger-created rows (subscription, notification prefs, SP wallet) are missing"

✅ Check: The target DB's signup trigger is actually attached AND its handler body matches the latest migration (BP-47)
✅ Check: Deployment lag — the deployed function may predate the migration that defines the asserted defaults; apply/redeploy before blaming app code (BP-47)
See also: BP-47 (E2E tests asserting trigger-created defaults must first verify the trigger exists in the target DB)

Issue: "Dev task points at a fragile pattern (a cast, a missing variable, a stale trigger comment) inside a migration file"

✅ Check: Grep migrations for the NEWEST `CREATE OR REPLACE FUNCTION <name>` / trigger definition and diff — a superseded body is dead code even if the function name is still attached to a trigger (BP-47)
See also: BP-47 (the latest migration definition is authoritative — verify the attached/deployed body before patching anything found in a historical migration)

Issue: "Admin edits a setting on one surface but the other surface shows no 'last updated' / who changed it, or a new settings page silently bypasses the shared write path"

✅ Check: The settings write goes through the shared `upsert_admin_config_setting(p_admin_id)` RPC, never a direct `admin_config` insert/update (BP-48)
✅ Check: The acting admin's user id is passed as `p_admin_id` so `admin_config.updated_by` is recorded (BP-48)
✅ Check: The audit target table exists — a write to a non-existent table (e.g. `audit_logs`) is silently dropped (BP-48)
✅ Check: A config write OR revert that only changed `value` left `category`/`data_type`/`is_active` untouched — `qa:admin-config-set` defaults to `feature_flags`/`string` and silently rewrites them, so the WHOLE row was read back, not just `value` (BP-48)
See also: BP-48 (admin config writes must record the editor via the shared RPC and land in the shared audit trail; a value-only write must not clobber the row's sibling columns)

Issue: "Admin page fetch to /api/admin/* fails with 401 / 'No valid authentication provided'"

✅ Check: The browser fetch sends `x-admin-secret: NEXT_PUBLIC_ADMIN_UI_SECRET` — the established client pattern (BP-49)
✅ Check: The request isn't relying on a session cookie — there is NO middleware, and `verifyAdminAuth` reads only the `x-admin-secret` header or an explicit Bearer JWT (BP-49)
✅ Check: New code doesn't copy legacy header-less admin fetches that 401 in practice (BP-49)
See also: BP-49 (admin client→API auth — always send the `x-admin-secret` header or an explicit Bearer JWT)

Issue: "Verifying an admin-UI fix would require mutating live/staging config or QA data (a moderation Keep/Hide, a config save, a payout trigger)"

✅ Check: The write was intercepted, not executed — Playwright `page.route('**/api/...', fulfill)` stubs the endpoint and the assertion runs against the surrounding behaviour (the follow-up refetch fires, the label/summary updates, the dialog copy is correct) (BP-89)
✅ Check: The follow-up request was COUNTED (a `request` listener filtered by method + URL), not inferred from the page still looking right (BP-89)
✅ Check: If the mutation's own effect had to be proven, it was proven against a disposable fixture — and the handoff states that the write was intercepted, so "verified" is never read as "applied to the DB" (BP-89, BP-80)
✅ Check: **HARD GATE** — the stub was REMOVED (`page.unroute(...)`, or close the page) BEFORE the verification was reported complete — a `page.route`/`context.route` handler lives in the browser, survives reload, is not cleared by a dev-server restart, and otherwise fakes every later real click on that page (FIX-Task-22 item 0: an admin "Keep" returned `200 {"success":true}` for four rounds and never persisted) (BP-89)
✅ Check: Before treating a silent-success mutation as an app bug, the body was compared to the route source and the route was probed server-side with `curl` (bypasses all browser interception and forces Next to compile it) (BP-89, FIX-Task-22 item 0)
See also: BP-89 (verify a data-mutating admin action without mutating data — including un-stubbing it afterwards), BP-80 (a mutating step is approval-gated — "written, NOT applied" must be stated explicitly)

Issue: "Bottom nav / persistent tab bar (or other root-level UI) missing after completing or skipping onboarding until the app is relaunched"

✅ Check: The root-level component's gate state (e.g. `showOnboardingCarousel`) is updated by a `[userId]`-keyed mount effect ONLY — a child screen navigating away does NOT re-run it (BP-55)
✅ Check: The child screen flips the gate via an explicit `initialParams` callback, not by relying on a re-run effect (BP-55)
✅ Check: Every exit path (Skip, Get Started, failure fallback) goes through the same shared helper that fires the callback (BP-55)
See also: BP-55 (wire an explicit `initialParams` callback from the child to flip root-level mount-effect-only gate state)

Issue: "Discover screen renders legacy green (#4A7C59) or iOS system blue (#007AFF) instead of the pass-it-up palette (#5DBB8E)"

✅ Check: `src/theme/discoveryTokens.ts` is reconciled to `docx/design-system-passitup.md` and matches `src/theme/colors.ts` (BP-56)
✅ Check: Discover components import `ds` tokens from `@/theme/discoveryTokens` — no raw legacy hex (`#4A7C59`, `#E5E7EB`, `#1F2937`, `#4D4D4D`) or system blue (`#007AFF`/`#EEF6FF`) (BP-56)
See also: BP-56 (design tokens — canonical pass-it-up palette; never source from legacy `design-system.md`)

Issue: "A fix makes an auto-verify/auto-submit path actually work, and suddenly unit tests that used to pass are failing"

✅ Check: The failing tests were written around the OLD broken behavior — e.g., a manual Verify/fallback tap that is now unreachable because the auto-path fires first (BP-57)
✅ Check: The tests were updated to assert the corrected auto-behavior, not the fix reverted or weakened to keep them green (BP-57)
See also: BP-57 (a behavior fix that makes an auto-path work breaks manual-fallback tests — update those tests; the failure proves the fix worked)

Issue: "A regression test added to guard a fix stays green even when the fix is removed — it was never proven able to fail"

✅ Check: The test was run with the fix NEUTRALISED (guard commented out / `false &&` / flag flipped) and OBSERVED to fail before it was trusted (§9.1h)
✅ Check: Both runs were recorded — RED without the fix, GREEN with it — not just the green one (§9.1h)
✅ Check: If it passed without the fix, the mock settles too fast for the competing path to overlap — hold the promise PENDING via a deferred promise so the race becomes deterministic (§9.1h)
✅ Check: The assertion cannot pass on ANY call count — `toHaveBeenCalledWith` passes for 1 or 10, and a counts assertion INSIDE `waitFor` can pass at the instant of the first resolve (§9.1h)
✅ Check: The probe used to disable the fix was removed and the tree grepped for its marker (`TEMP-PROBE`, `false &&`) — the same un-stub discipline as BP-89
See also: §9.1h (a regression test is not evidence until you have watched it fail with the fix disabled), BP-90 (invoke the patched object — DDL success is not proof), BP-88 (a mocked branch may never fire on the real path at all), BP-57 (update tests written around the old behaviour — never weaken the fix to keep them green), BP-98 (a fixture must only assert a state the production writers can create)

Issue: "A CTA / Save / Submit button (or a sticky bottom bar) is hidden behind the floating bottom nav pill"

✅ Check: Scroll content uses `paddingBottom: 100`; fixed bottom bars use `bottom: 120`; in-flow bars above a fixed bar use `marginBottom: 200` (BP-58)
✅ Check: The content actually OVERFLOWS the viewport (ScrollView frame vs the last child's `y + height + paddingBottom`) — if it fits, the screen never scrolls and padding cannot lift the trailing element, so the fix must be a layout change instead (BP-58)
See also: BP-58 (bottom-anchored UI must clear the floating pill nav — the pill top sits ~110pt from the screen bottom; padding only helps when the content overflows)

Issue: "A screen renders a visible junk line like `accessible accessibilityRole="button" ...` inside a `<Text>` (accessibility props pasted as literal children)"

✅ Check: Every `<Text>` carrying `accessible`/`accessibilityRole`/`accessibilityLabel` has them as attributes on the opening tag, never as rendered children — grep `accessible accessibilityRole` when touching or reviewing `<Text>` components (BP-61)
See also: BP-61 (accessibility props must be attributes, not literal `<Text>` children — recurred on `WelcomeScreen`, `ResumeDraftBanner`, `CartScreen`)

Issue: "A modal's buttons don't show up in the iOS AX tree even though they carry `testID` + `accessible` + `accessibilityLabel`"

✅ Check: The modal's backdrop/sheet containers are `Pressable`s (they default to `accessible={true}` and GROUP their children) — set `accessible={false}` on the overlay AND sheet so the buttons surface individually; `accessibilityViewIsModal` on the `<Modal>` alone is not sufficient (BP-53)
See also: BP-53 (QA testIDs must be real iOS accessibility elements; Modal/Pressable containers group children — verified on-device 2026-09-01 on the bundle accept modal)

Issue: "A mutation appears to succeed in the UI but the database wasn't actually changed"

✅ Check: The caller checked the `{success}` result of the service call instead of ignoring it (BP-35)
Issue: "Edge Function deploy fails with 'Module not found'"

✅ Check: Deploy via the CLI `supabase functions deploy --use-api` (BP-41 — the standing required path), which resolves `../_shared/*` from the local filesystem; if it still fails with "Module not found", scan the entrypoint for ALL relative imports (including transitive `_shared/*`) and confirm every target file exists on disk (BP-41 rule 4)
See also: BP-41 (Edge Function deploys — CLI `supabase functions deploy --use-api` is the standing required path regardless of file size or `_shared/*` imports; the MCP deploy tool is a documented last-resort fallback only, per the DEV-TASK-36 resolution; former BP-77 now merged here)
Issue: "An Edge Function and a DB trigger/RPC disagree on the same business rule"

✅ Check: Split-brain enforcement — search migrations for a trigger/RPC/constraint duplicating the Edge Function's check (BP-27)
Issue: "Edge Function log shows an 'UncaughtException' / 'event loop error' with an empty message"

✅ Check: The message is read from the TOP-LEVEL `event_message` column of `function_logs`, not `log_attributes['event_message']` (always empty) (BP-68)
✅ Check: An `event_message` of `Deno.core.runMicrotasks() is not supported` is a runtime teardown artifact — the response may already have been correct (BP-68)
See also: BP-68 (function log message location — `event_message` is a top-level column)

Issue: "Tier-1 live verification can't create a Stripe test PaymentMethod"

✅ Check: The PM is created from a magic test Token — `card: { token: 'tok_visa' }` — not raw card data or `pm_card_visa` (BP-69)
See also: BP-69 (Stripe test-mode PM fixtures via `tok_visa`)

Issue: "Leftover disposable test users/profiles after live verification"

✅ Check: `profiles` rows were deleted by `user_id` (not `id` — `profiles.id ≠ user_id` here), then `admin.deleteUser` (BP-70)
See also: BP-70 (disposable-user cleanup must target `profiles.user_id`)

Issue: "Tier-1 verification passed, but the real charge/pay path is broken in production"

✅ Check: The verification drove the ACTUAL charge/pay path on a fresh isolated throwaway user — a guard-path-only probe (`INVALID_STATUS` / `NO_FAILED_PAYMENT` / `NO_OPEN_INVOICE`) does NOT prove the money path works (BP-71)
✅ Check: The retry/double-tap path was exercised and no second Stripe object/charge was created (BP-71)
See also: BP-71 (Stripe money-function verification must exercise the real charge/pay path, not just the guard/smoke path)

Issue: "QA case only asserted on the UI response / guard-path — did the backend/DB/Stripe side effect actually happen?"

✅ Check: The case read the relevant DB row(s) and/or actual Stripe/PayPal object state directly — never only the UI response or a guard-path smoke (BP-72)
✅ Check: For money/financial-state functions, the ACTUAL charge/pay/create path was exercised on a fresh throwaway user, not just a guard-path error (BP-72)
✅ Check: Read-only DB/Stripe state confirmation was treated as pre-approved (no per-instance owner sign-off); mutating test actions still used the safe-fixture/disposable-user discipline (BP-72)
See also: BP-72 (QA side-effect verification — read-only backend/DB/Stripe checks are pre-approved)

Issue: "SQL/PostgREST query fails with 42703 'column does not exist' (e.g. `trades.item_id`, `profiles.stripe_connect_account_id`)?"
✅ Check: The `trades`→`items` FK is `listing_id` (never `item_id`); Stripe Connect/payout-method state lives in `seller_payout_methods` (never `profiles`) (BP-73)
See also: BP-73 (schema facts — trades FK is `listing_id`; payout-method state in `seller_payout_methods`)

Issue: "Security advisory / audit reports tables with RLS disabled (or a table that should be locked down is reachable from a client)"

✅ Check: The authoritative list came from the LIVE `pg_class.relrowsecurity` query, not a migration grep — greps are incomplete (RLS enabled in DO blocks/seed, or the `ENABLE RLS` line commented out) and miss orphaned tables that exist only in the DB (BP-75)
✅ Check: Every reader/writer of each table was traced (mobile user-JWT, Edge Function, admin-portal client vs API-route service role, SECURITY DEFINER/cron) before enabling RLS, so no user-JWT path silently breaks (BP-75)
See also: BP-75 (RLS-disabled audits must use the live `pg_class.relrowsecurity` query, not migration greps)

Issue: "Expired/declined offer not surfacing in the app's 'Your Offers', or the seller-ignore counter resets to 0 on expiry — with no error?"
✅ Check: The client's fetch/filter literal matches the LIVE DB value — e.g. `TradeListScreen` compares `.in('cancellation_reason', ['seller_declined','offer_expired'])` but the expiry RPC writes `'Offer expired'` (spaced) → silent mismatch, expired offers never surface (BP-76)
✅ Check: DB triggers comparing the same reason use the identical literal — `fn_reset_unanswered_counter`'s `IS DISTINCT FROM 'offer_expired'` never matches the stored `'Offer expired'`, so it resets the streak to 0 on expiry (BP-76)
✅ Check: A status-driven gate refusing a state the user IS in → count the DATA before believing it: `SELECT status, count(*) FROM <table> GROUP BY status ORDER BY 2 DESC`. When a CHECK constraint legally admits two spellings of one state (live: `subscriptions.status` allows `'grace'` AND `'grace_period'`), every gate AND every client allow-list must accept both — a lone legacy-spelled outlier row is a fixture/data defect that FAKES a product-level failure (FIX-Task-51, 2026-09-17)
See also: BP-76 (enum-like status/reason values — one canonical literal across DB writer, triggers, and client; when a CHECK admits two spellings, widen the gates AND normalize the data)

Issue: "The next session / QA pass can't find the trade/column/row the previous session's handoff implied was provisioned"

✅ Check: The prior handoff explicitly said which provisioning steps were "written, NOT applied/run" and which regression tiers were marked DEFERRED (BP-80)
✅ Check: The migration was actually applied (`list_migrations`) / the fixture script actually run — never assume from the code being committed or a clean script exit; verify the DB state directly (BP-80)
✅ Check: The fixture script's read-back printed its own primary key(s) (`bundle_id` / `trade_id` / `item_id` / `cart_id`), not just a row count — a count leaves the fixture unidentifiable for the next session/QA pass (BP-80 rule 4)
See also: BP-80 (two-phase provisioning deliverables — code + Tier 0 vs. approval-gated execution against staging; a fixture's read-back must print its primary key(s), never only a count)
See also: BP-81 (MCP-applied migrations don't appear in `list_migrations` — verify the migration landed by live invocation, not the migration list)

Issue: "A QA finding quotes on-screen text (a label, error string, alert title, or banner heading) that appears nowhere in the shipped code"

✅ Check: The exact literal was grepped from the source (`grep -rn "<quoted string>" <app dirs>`) AND history was checked for a removed string (`git log -S "<quoted string>" --all`) before treating the quote as real (§9.1b)
✅ Check: The finding's SURFACE attribution was re-based on the component that actually renders that state — a quoted string that has never existed means the cited screenshot may show a different surface, and the quote may be an OCR/paraphrase artifact (§9.1b)
✅ Check: No component was invented, restyled, or copy-migrated to match a quoted string no code emits; if no surface matches, a fresh capture of the exact moment was requested (§9.1b)
See also: §9.1b (quote-verify any quoted on-screen text before trusting the finding's surface), §9.1a (state the investigation stance upfront — "quoted string not in source" is a first-class ruled-out result)
See also: BP-82 / BP-86 (on-brand tokens and canonical copy — the real defect behind a mis-attributed string is usually a copy/token mismatch on the surface that DOES exist)

Issue: "A reported UI defect (a bottom CTA that opens the wrong thing, an occluded control, a stale label) can't be reproduced — or the fix looks clean in tests"

✅ Check: The reproduction used the SAME entry path as the report — cold launch / post-login remount / session restore / deep link — not just a navigate-to-the-screen hop; an initial-mount-only defect disappears the moment any navigation event fires (§9.1f)
✅ Check: The root-level element's gate reads its route/state from the navigator that owns it (or from root state fed by the navigator's route listener), never from its own snapshot taken during the initial mount (§9.1f, BP-55)
✅ Check: No root-level sibling was keyed with the navigator's own key to force a remount — that raises "Encountered two children with the same key" and does not fix the gate (§9.1f)
See also: §9.1f (reproduce through the REAL entry path — navigation masks initial-mount-only defects), §9.1a (state the stance upfront), BP-55 (root-level gate state set only by a mount effect)

Issue: "A client/EF call that worked before now returns 401 or `permission denied for function …` right after a migration replaced that function"

✅ Check: The replaced function's EXECUTE grants were re-asserted in the same migration — `CREATE OR REPLACE FUNCTION` in `public` fires `dt61_guard_revoke_fn_public` (its `ddl_command_end` tag list includes the replace path), which REVOKEs PUBLIC/anon/authenticated, and the original migration's `GRANT`s are NOT re-applied (BP-79 — the `CREATE OR REPLACE` grant-stripping bullet)
✅ Check: The grant was verified LIVE per consumer role (`has_function_privilege('authenticated','public.<fn>(uuid)','EXECUTE')`) plus a before/after `aclexplode(pg_proc.proacl)` diff — never by reading the migration file (BP-79, BP-78)
✅ Check: Untouched sibling functions kept their grants while the replaced one lost them — that asymmetry is the signature of the guard, not of a REVOKE someone wrote (BP-79, `CREATE OR REPLACE` grant-stripping bullet)
See also: BP-79 (default-privilege guard + explicit-grant discipline — including on `CREATE OR REPLACE`), BP-78 (live `aclexplode` grant audits), BP-81 (verify the change landed by invoking it live)

Issue: "A user-visible value shows its fallback (a role label, placeholder, or "Unknown") even though the code that renders the real value is present and correct"

✅ Check: The value's SOURCE actually resolves on the real path — a fetch that returns null leaves the `?? fallback` branch as the only thing that ever renders, so the correct-looking expression is dead in practice (BP-88 rule 4)
✅ Check: The rendered string was asserted in the AX tree or a screenshot FOR THAT STATE — typecheck/lint/unit green proves the code path, not the rendered value (BP-88 rule 4, BP-53)
✅ Check: The value is resolved where it RENDERS, not only passed in by the caller — a caller's own read can fail the same way, and a deep-link entry carries no value at all (BP-88 rule 4)
✅ Check: The fixture actually exercises the branch that changed — an already-reviewed record and an unreviewed sibling render DIFFERENT branches, so one fixture can hide a total no-op on the other (BP-88 rule 5)
See also: BP-88 (a branch is only correct if its trigger fires on the real runtime path — same class for error branches AND data-derived values), BP-53 (confirm on-device — unit tests alone are insufficient), BP-91 (a mobile UI change needs an in-session device attempt — otherwise the handoff must enumerate the owed device legs, and typecheck/lint/unit-green is never on-device verification)

Issue: "A QA finding describes a state the canonical spec never covers (e.g. a partially-completed bundle), and it is unclear whether it is a bug or intended"

✅ Check: A sibling feature in the SAME file already solves the analogous case — if yes, this is an in-file inconsistency: mirror the sibling instead of escalating it as a product decision (§9.1c)
✅ Check: The sibling's derived values were mirrored too, not only its gate — the bundle fix had to correct an over-counting `total`, not just the "every sibling must be in_progress" condition (§9.1c)
✅ Check: If no precedent exists, the case was escalated as a product/UX question WITH a recommended option — never implemented as a default and buried in a comment (OWNER CONTEXT + §9.1c)
See also: §9.1c (spec-silent QA finding → sibling-precedent check first), §9.1a (state the investigation stance upfront)

Issue: "Two widgets on the same screen show contradictory numbers, or a money/state value visibly changes a moment after it is painted"

✅ Check: Both widgets derive the quantity from the SAME array the visible list renders — a tile written at the tail of one fetcher while the card comes from another will disagree for a frame (BP-92 rule 1)
✅ Check: Banner/button/modal counters call ONE shared helper instead of re-implementing the filter per call site (BP-92 rule 2)
✅ Check: Any value painted before its fetch resolves is withheld (`—`/skeleton) and any control that SUBMITS it stays disabled until it is authoritative — a display-only fallback (`?? 99`) is a wrong number, not a neutral default (BP-92 rule 3)
✅ Check: Adjacent widgets stating the same fact were verified at BOTH ends of the range (2-item AND 3+/4-item bundles) — agreement at one size passes review and still ships the bug (BP-92 detection checklist)
See also: BP-92 (one source of truth per displayed number — no parallel state, no placeholder defaults), BP-29 (audit every downstream counter/filter after a data-source restructure), BP-88 rule 4 (a value built from an async read renders its fallback when the fetch returns null), BP-15 (pull-to-refresh must refresh everything the user can see)

Issue: "A screen's unit test never settles — the tree is stuck on its loading state and every case times out at ~1 s"

✅ Check: The mocked navigation/route/hook objects are module-level constants, not fresh literals per call — a new object each render re-creates the screen's `useCallback`, so its focus effect re-subscribes and loops (BP-93 rule 1)
✅ Check: The mocked query builder's call count was inspected — dozens of identical `.from()` calls inside ONE case is the signature (BP-93 rule 2)
✅ Check: Mock constants carry a `mock` prefix so `jest.mock()` factories may close over them (BP-93 rule 3)
✅ Check: Debugging asserted on mock call counts / rendered state rather than `console.log` — this repo suppresses jest console output and the log will be silently missing (BP-93 rule 4)
See also: BP-93 (identity-stable jest mocks), BP-60 (test isolation — shared mutable params leaking between cases), BP-57 (behaviour-fix test drift — a green-looking test written around the old behaviour)

Issue: "A unit test stays green while exercising the WRONG branch — the module under test gained a new import and the suite's `jest.mock()` factory for it never listed that export" / "a newly-added pure predicate has no effect on the rendered tree and every existing assertion still passes"

✅ Check: Every factory for the module path was diffed against the module's real exports — an unlisted export is `undefined`, not "no-op" (BP-94 rule 1)
✅ Check: The consumer's `try/catch` (or fail-soft path) was ruled out as the reason the `TypeError: … is not a function` never surfaced — a soft-fail service turns an incomplete mock into a plausible domain result (BP-94 rule 2)
✅ Check: Each factory export carries an explicit implementation AND a `beforeEach` default — `jest.clearAllMocks()` clears calls but not implementations, so a test that armed a failure toggle can leak into the next case (BP-94 rule 3)
✅ Check: The assertion still touches the value that changed — a green suite whose assertions drifted away from the changed value is the tell (BP-94 detection checklist)
✅ Check: The suite's `jest.mock()` for that module was read for a FACTORY — a bare `jest.mock('<mod>')` auto-mocks the whole module, so every export (including pure predicates) is a `jest.fn()` returning `undefined`; pure dependency-free logic belongs in its own leaf module (BP-94 rules 5-6)
See also: BP-94 (mock factories must mirror the module's full export surface; a bare `jest.mock()` auto-mocks every export), BP-88 (an invented mock shape green-lights an unreachable branch), BP-93 (jest mock mechanics — unstable mocks present as a silent timeout instead)

Issue: "A user is shown data that the backend says does not exist — e.g. a saved card / balance / name on an account that has none, appearing right after an account switch"

✅ Check: A client-side module-scope cache was ruled in/out FIRST — grep the service layer for `^let _<x>Cache` / `CACHE_TTL_MS` and read the getter; a process-global slot read without a session check serves the PREVIOUS user's data (BP-95 rule 1)
✅ Check: The **fresh-process control** was run before concluding a server-side leak — stale-after-warm-switch + correct-after-terminate-and-relaunch proves a client cache, and rules OUT a backend disclosure; the opposite result (still stale on a fresh process) is what would justify a backend/data finding (BP-95 detection checklist)
✅ Check: The cache's SIBLING state was cleared too — clearing the value without resetting the in-flight promise (or `_pmPromise` equivalent) leaves a second stale path (BP-95 rule 5)
✅ Check: Every consumer of the getter was enumerated before shipping the fix — Payment Methods, Manage Kids Club+ `PaymentMethodSection`, CartCheckout, TradeOffer all inherit a leak in one shared getter (BP-95 rules 1-3)
See also: BP-95 (user-scope + auth-transition invalidation for client caches), BP-15 (the refresh-bypass half of caching — BP-15 + BP-95 together are the complete cache discipline), BP-92 (one source of truth per displayed value — a cache is a second source)

9.3 Debugging steps
Isolate the layer: Is it mobile app → Edge Function → Database → RLS?
Test in Supabase Studio: Run raw SQL queries to verify data/RLS
Check logs: Supabase Edge Function logs, mobile app console
Simplify: Remove business logic, test with minimal example
Compare to spec: Reference the relevant FR-XX requirement in System Requirements
