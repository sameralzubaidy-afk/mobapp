# FIX-Task-27 verify + N2 mutation + Phase E (2026-09-13, 2nd round) — durable facts

Run: `e2e-test-results/qa-fix27-verify-n2-phaseE-2026-09-13/`. Android `Medium_Phone_API_36.1`, HEAD `ea51dcb4`. iOS booted NOT driven (R80).

## ⚠️ New hard-won rules (candidates for the playbook)
- **Never issue an AX dump (`mobile_list_elements_on_screen`) while a deliberately-STALLED screen is pending.** The dump returned a status-bar-only tree and the app **died**: `SIGSEGV` with backtrace `mobilecli.so → art::ti::AgentSpec::DoLoadHelper → AgentSpec::Attach → Runtime::AttachAgent → VMDebug.attachAgent → ActivityThread.attemptAttachAgent`. That is the mobile-mcp JVMTI agent attach, **not app code** (R87 class). Recovery: force-stop + cold relaunch + pick the **other** Metro row. **Inside a stall window, poll with screenshots only.**
- **`mobile_batch_commands` may only chain taps whose targets are ALREADY rendered.** `[send-offer] → [disclaimer-checkbox] → [disclaimer-accept]` in one batch silently submitted nothing: the modal hadn't rendered, and the third tap's `(798,2285)` sits inside the `tab-trades` band → it navigated to My Trades. Verify via the JS log (no `checkout_started`/`send_offer`) + the DB (0 new trades). **Any modal-opening tap must be its own step.**
- The 3-tap chain `[Discover tab] → [Basket tab]` also fails when the first tap opens a modal; do the dismissal tap alone first.

## Element facts
- **Liability-disclaimer checkbox only responds to its 63 px SQUARE** — `disclaimer-modal-checkbox` is reported as the full-width row `{42,2107,996,63}`, but tapping the row centre `(540,2138)` does **nothing** (twice); tapping `(73,2138)` ticks it instantly and enables `disclaimer-modal-accept-button` `{558,2212,480,146}`. Accept works at its tree centre `(798,2285)`.
- Bundle checkout path: Basket `bundle-cta-button` `{63,1832,954,195}` → Checkout → 3 swipes → `send-offer-button` `{42,1780,996,137}`.
- Checkout instrumentation: `checkout-item-<listingId>`, `sp-input-<id>`, `sp-max-hint-<id>`, `subtotal-amount`, `platform-fee-amount`, `tax-amount`, `cash-total-amount`, `go-back-button`.
- Basket: `cart-item-remove-<cartItemId>` (uses **cart_items.id**, not items.id), `cart-remove-error-card`, `cart-remove-retry-button`, `clear-basket-button`, `save-current-cart-button`, `bundle-cta-button`.
- Trade List: `trade-offer-row-<tradeId>-review`, `trade-bundle-<bundleId>-card|-pending-count|-review-each|-accept-all|-decline-all`.
- Item Detail: `seller-info-error-card` (996×235) + `seller-info-retry-button` (996×95) both clear of the CTA band at y=1949.

## Schema / backend facts
- **`items` price column is `price`, NOT `price_cents`.**
- `rpc_release_pending_sp` writes **wallet + trade + user_notifications only** — **no `financial_audit_log` row** (verified via `pg_get_functiondef` on staging *and* migration `20260528000005`). The **only** `sp_released` audit writer is `supabase/functions/complete-trade/index.ts:321-327`, and only when `trade.sp_amount > 0`. So N2-C04's "exactly 1 `sp_released` audit row" is **unsatisfiable via the guide's RPC-only steps**. `process-auto-complete` writes no SP audit row either.
- `debit_sp_for_trade` / `credit_sp_for_cancelled_trade` are **guard-first** (check `sp_debit_<trade>` / `sp_refund_<trade>` in `sp_ledger` before touching the wallet) → a **zero-mutation** retry test is possible when the key already exists.
- `sp_ledger.transaction_type` has **no release type** — the pending→available move is never ledgered (true for the 2026-08-30/09-08 releases too).
- `admin_adjust_sp_wallet(p_user_id, p_amount, p_reason, p_admin_notes, p_actor_id, p_idempotency_key)` → 2nd call with the same key returns `idempotent:true` + the same `ledger_entry_id`.
- **All completed trades currently sit at `payout_status='requires_action'`** → `initiate-payout` never reaches its transfer branch (2 calls returned `{success:true, payout_status:"requires_action"}` with no second row/transfer/notification).
- The `sp_released` audit key format is `sp_release_<tradeId>`; the `seller_payouts` idempotency key is `trade:<tradeId>:seller:<sellerId>`; `trades.payout_idempotency_key` = `payout_<tradeId>`.

## Product findings still open
- **F1 MED** — `src/services/subscription.ts:149` returns `createFreeTierSummary()` on a transient error, so an **ACTIVE** subscriber's Home SP strip flips from "2263 SP / Earn More" to the **free-tier "Unlock Swap Points / Upgrade →" upsell** (log: `[subscription] get_subscription_status skipped due transient network issue`). No retry, no error state.
- **F2 MED** — audit-completeness gap (see the `rpc_release_pending_sp` note above); also touches N2-C07.
- **F4 LOW–MED** — Trade List `trade-summary-*` tiles render `0/0/0/0` before resolving, no skeleton.
- **F6 LOW** — `source.uri should not be an empty string` LogBox warning repeated 8–20× per render on image-less cart/discover rows.
- **F5 (needs attribution)** — 3 trades (`f9d53797`, `e54f608a`, `f2899f12`) each carry **two** successful `trade_refunds` rows whose Stripe refund ids share a PaymentIntent prefix. Do **not** file as a double-refund without reading the writer (R100).

## Tooling asks
- `qa:ocr` prints **no coordinates** in any mode (`--json` gives text only; `--region` gives no boxes) — a `--coords`/boxed mode is needed to resolve tap-position ambiguity.
- `sips -g pixelWidth -g pixelHeight` confirmed the emulator screenshot is exactly **1080×2400** and AX coords are 1:1 (R104 holds).

## FIX-Task-27 verification result (for future cross-reference)
All 6 owed legs PASS. **Item 3 CONFIRMED FIXED:** fresh 3-item bundle checkout → bundle `61259e4c-da53-49ce-830f-65786d6de1d4` → `disclaimer_acknowledged = TRUE` on **3 of 3** siblings; the pre-fix bundles `55ede89f` and `15b77972` are **1 of 3** each.
