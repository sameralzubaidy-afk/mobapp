# QA Task TRD Part 3 Continuation — Case Ledger

**Run folder:** `e2e-test-results/qa-task-trd-part3-2026-09-09/` · **Date:** 2026-09-09 · **HEAD:** `6ecc6c00` (FIX-Task-8)
**Legend:** ✅ PASS · 🟡 PARTIAL · 🔴 DEFERRED (explicit reason) · 🔵 PART-0 cross-platform unit · 📷 screenshot

| TC-ID | Description | This-run verdict | Platform | Evidence / DB verification | Screenshot |
|---|---|---|---|---|---|
| TRD-TC-{Part 0} | FIX-Task-8 verify: no race rejection + no disclaimer on auto-resubmit + fresh-offer disclaimer (Items 1/2/5) | ✅ PASS (6/6) | Android + iOS | 3+3 cycles; oldest-offer DB sequence Basketball→HP→Kindle→Switch→RoaldDahl→RC Car; 0 race rejections; disclaimer shown on fresh offers only | android-P0-cycle1-cap-modal.png, android-P0-cycle3-trade-initiated.png, ios-P0-cycle1-cap-modal.png, ios-P0-logbox-full.png |
| TRD-TC-{Item 3} | Android live-SP-offer SP-release copy (Review Offer) | ✅ PASS | Android | RC Car 8-SP offer → seller Review Offer "15 SP releasing in 3 days"; resolves R1b PARTIAL | android-item3-sp-release-3days-review-offer.png |
| TRD-TC-B01 | Seller declines offer | ✅ PASS | Android | offer e1152e7e → cancelled seller_declined; "Offer Declined" copy | android-B11-subscribe-upsell-offer-screen.png (nearby flow) |
| TRD-TC-B04 | Buyer cancels pending — no consequence level | ✅ PASS | Android | test-free offer bc8c2c73 cancelled (Changed mind) → generic Trade Cancelled, no Level text | android-B04-buyer-cancel-pending-generic-notif.png |
| TRD-TC-B06 | Card declined at offer submission | ✅ PASS (clean-fail leg) | Android | STRIPE_HOLD_FAILED → "Payment method is invalid or expired", 0 offers DB; copy doc-drift | android-B06-card-declined-offer-failed.png |
| TRD-TC-B11 | Subscribe-upsell → JoinKidsClub | ✅ PASS | Android | upsell card "Save up to 70%" → JoinKidsClubScreen | android-B11-subscribe-upsell-offer-screen.png |
| TRD-TC-B12 | SP info tooltip (not wired — flag) | ✅ PASS (source) | both (source) | SPInfoTooltip rendered, no reachable trigger; flag confirmed; NEVER-RUN → PASS | — |
| TRD-TC-B13 | Duplicate-offer modal (dead code — flag) | ✅ PASS (source+live guard) | Android + source | errorModal.isDuplicate dead; live "Active Offer" guard modal observed | android-B06-card-declined-offer-failed.png (Active-Offer modal observed in B06 chase) |
| TRD-TC-C02 | SP restored on seller decline | ✅ PASS | Android | wallet 482 avail / 0 reserved after B01 decline | — |
| TRD-TC-C04 | SP stays reserved when seller accepts | ✅ PASS | Android | trade 47bdab0a in_progress, sp_transferred_at NULL, 8 reserved / 474 avail | (Offer Accepted screenshot in flow) |
| TRD-TC-C06 | SP restored on seller cancel (in_progress) | 🔴 DEFERRED | — | NOT driven — would consume brief-protected test-seller cancel counter; corroborated via C02/R1b/R1; needs clean-seller (test-seller-2) SP in_progress drive | — |
| TRD-TC-C07 | Free user locked Use SP + upgrade modal | ✅ PASS | Android | use-sp-locked-chip 🔒 → Unlock SP Discounts modal → Not Now | android-C07-free-user-locked-sp-upgrade-modal.png |
| TRD-TC-D01 | Auto-complete when buyer never taps I Got It | ✅ PASS | Android | fast-clock 47bdab0a → auto_completed_count 1 → completed, sold, 19 SP released, payout 82cc8124 $21.60 requires_action | — |
| TRD-TC-D03 | Offer countdown pill color states | 🟡 PARTIAL | Android | 72h amber pill observed (71h 59m); source urgency/color bands confirmed; full multi-threshold range not driven | android-D03-countdown-pill-72h-buyer-timeline.png |
| TRD-TC-D04 | Auto-complete banner visible to buyer only | ✅ PASS | Android | buyer timeline shows banner; seller timeline does not; source L1434 gate | android-D03-countdown-pill-72h-buyer-timeline.png (buyer view) |
| Group F | F01/F02/F03 formalize | ✅ formalized | — | F01: payout row on clean D01 completion; F02 cross-ref D02/E02 (FIX-Task-7 PASS both); F03 requires_action (R1b/DT124 + today's rows) | — |

**Not executed this run (deferred with explicit reason / prior-scope):** B03 (3-buyer competing-offers fixture-heavy), B07 (expired-offer timeline — needs fast-clock expiry + no-message-button check), B08 (chat-frozen on canned Cancelled-Trade fixture — QA Canned fixture), B09 (chat-active — **partially observed**: Message button present on in_progress rows for both buyer and seller), B10 (Replace Card literal new-card native-sheet leg tooling-limited — PARTIAL-on-record from qa-task18), C06 (above), D03 full color range, D05 (guide post-MVP, not built), G01–G04 (notifications — G01 PASS-on-record iOS from earlier rounds; Android notification-delivery leg per brief excluded from this run), H01/H03/H04/H05 (completion CTAs), I02–I05/I10/I11 (safety UX — I-group largely PASS-on-record; Android legs not re-driven this run). Per brief exclusions: Group J, A03/A04/D05, TRD-TC-Z01–Z08, push-notification delivery.
