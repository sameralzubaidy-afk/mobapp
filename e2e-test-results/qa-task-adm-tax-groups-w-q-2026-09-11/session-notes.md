# QA Task — TRD Admin Tax Groups + Group Q — session notes (2026-09-11)

Run: `e2e-test-results/qa-task-adm-tax-groups-w-q-2026-09-11/`
Repo HEAD at start: `9d623c4c` (clean tree). Device: Android `emulator-5554` (Medium_Phone_API_36.1) + admin portal `:3001`.
Metro: 1 `expo start` instance (verified in R29 busy check, 2026-09-11).

## Scope
O-1 (16 of 17 remaining), O-2 (11 of 12), O-3 (14), P (8), W (12), K07–K09 (3), Q (20).
Also-if-budget: O03/O04/O06/O07/O08, R03/R04, K02 first-trade leg.

## DB recon facts (read-only, 2026-09-11) — authoritative baseline
- `tax_rules` (5 rows):
  - clothing_footwear v1 "Clothing and footwear taxes" 10% CT active=**false** (closed 2026-07-27)
  - general_tangible_goods v1 "NYC books taxes" 10% **NY** active=**true** open-ended (`3a372146-ea3f-4b89-a07e-1c8b753a0a35`)
  - general_tangible_goods v1 "Standard CT Tangible Goods Rate" 6.35% CT inactive
  - general_tangible_goods v2 "Updated CT Tangible Goods Rate (v2)" 6.99% CT inactive
  - general_tangible_goods v3 "Updated CT Tangible Goods Rate (v3)" 6.99% CT active=**true** (`bc94b4e0-951c-4aee-8156-5019f27802b9`)
  - ⇒ TWO active general_tangible_goods rules coexist (NY v1 + CT v3) — jurisdiction-scoped overlap allowance (relevant to O1-C02).
- `category_tax_mapping`: **10** product categories (guide says 8 — doc drift): Books→`tax_exempt_goods`; Games, Toys, Sports, Electronics, **Clothing**, Art & Crafts, Other, Shoes, Bookies → `general_tangible_goods`. (Guide O1-C14 expects Clothing→clothing_footwear — doc drift vs live default.)
- `tax_records`: 450 total — quoted=99, collected=41, voided=310; **0** refunded / partially_refunded / capture_failed / pending_refund.
- `reviews`: 35 rows. `review_reports` exists. `reviews` cols: is_hidden, report_count, review_status, has_been_reported.
- `admin_config`: `sales_tax_enabled=true`, `include_fee_in_tax_base=false`, `charge_one_fee_per_bundle=true`, `default_sales_tax_rate=0.0635`.
- `items` with NULL `tax_category_id`: 0 (O1-C05 already satisfied).
- Tax RPC toolbox: upsert_tax_rule, deactivate_tax_rule, upsert_category_tax_mapping, list_tax_rules, list_category_tax_mappings, update_node_tax_config, get_tax_summary_for_period, get_tax_export_data, get_applicable_tax_rule, rpc_mark_tax_collected, rpc_refund_tax_with_status, rpc_void_tax_for_trade, rpc_mark_tax_capture_failed, rpc_flag_tax_reconciliation, rpc_record_stripe_refund.
- Admin tax routes: `/tax/rules`, `/tax/category-mapping`, `/tax/nodes`, `/tax/settings`, `/tax/reports`. Admin: `/trades`, `/trades/bundles/{id}`, `/payments`, `/reviews`.
- Admin tax pages are fully `data-testid`-instrumented (e.g. `tax-rule-form-*`, `ctm-row-*`, `tax-node-row-*`, `tax-report-*`).

## Group K-fixture note
Bundle `73d5eb11-…` (seller test-seller-3) has 2 completed trades — reused for Group Q review fixture + W bundle views.

## Friction log (live)
- (none yet)
