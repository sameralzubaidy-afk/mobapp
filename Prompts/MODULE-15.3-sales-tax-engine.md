# MODULE-15.3: SALES TAX ENGINE

**Version:** 1.0  
**Last Updated:** May 10, 2026  
**Status:** Ready for Implementation  
**Dependencies:** MODULE-15.2 (Cart System), Existing fee configuration in admin_config

---

## PART 1: TAX STRATEGY & DECISIONS DOCUMENTATION

### Purpose of This Section
This section documents all sales tax design decisions made during requirements gathering. It serves as the **authoritative reference** for understanding why specific tax strategies were chosen and how they align with legal requirements and business objectives.

---

## 1. BUSINESS CONTEXT & LEGAL REQUIREMENT

### Platform Overview
**Kids P2P Marketplace** - A peer-to-peer platform where:
- **Sellers:** Parents selling used kids' items (toys, clothes, books, equipment)
- **Buyers:** Parents purchasing with cash + swap points (loyalty currency)
- **Geography:** Connecticut, USA (initial launch)
- **Transaction Model:** In-person pickup (no shipping in MVP)
- **Monetization:** Transaction fees (buyer + seller percentages) + subscription revenue

### Legal Trigger: Marketplace Facilitator Law
**Connecticut Public Act 19-117** (Effective October 1, 2019) requires:

✅ **Marketplace facilitators must collect and remit sales tax** on third-party sales  
✅ **Applies when platform charges transaction fees** (we do)  
✅ **Removes casual sale exemption** when sales occur through facilitator  
✅ **Destination-based tax** (buyer's location determines rate)

**Key Decision:** We decided to implement sales tax from day 1 because:
1. We charge transaction fees → marketplace facilitator status
2. Sellers are adults (parents) conducting regular sales
3. Cash transactions occur (not pure barter)
4. Connecticut law mandates compliance before first sale

**Rejected Alternative:** Treating platform as "casual sale" facilitator exempt from tax. This was rejected because:
- Platform earns revenue from fees
- High transaction volume expected
- Regular, ongoing sales (not occasional)
- Legal risk of non-compliance is high

---

## 2. TAX CALCULATION MODEL

### Decision: Tax on Full Item Price (Swap Points Do NOT Reduce Taxable Base)

> **LOCKED RULE (2026-08-15):** Buyers pay tax on the **whole item price**. Swap Points are **payment tender**, not a coupon or discount — they reduce the cash the buyer owes but do **NOT** change the taxable base. Tax does not change as the SP slider moves. (Matches shipped code — BP-37.)

**Formula:**
```
Taxable Amount = Item Price              ← FULL price, SP does NOT reduce this
Sales Tax = Taxable Amount × Tax Rate
Total Buyer Pays = Item Price + Platform Fees + Sales Tax
Cash Owed After SP = Total Buyer Pays - Swap Points Applied
```

**Example Calculation:**
```
Item Price: $100.00
Swap Points Applied: -$20.00
─────────────────────────────
Net Item Cost: $80.00  ← cash portion (SP applied here)
Taxable Amount: $100.00 ← FULL ITEM PRICE (SP does not reduce this)

Buyer % Fee (2.5% of $80): +$2.00
Flat Platform Fee: +$0.25
─────────────────────────────
Subtotal (Pre-Tax): $82.25

Sales Tax (6.35% of $100 FULL): +$6.35  ← tax on full price, NOT on $80
─────────────────────────────
TOTAL BUYER PAYS: $88.60
Less SP tender: -$20.00
Cash Buyer Pays: $68.60

SELLER RECEIVES:
Item Price: $100.00
Seller % Fee (5% of $80): -$4.00
─────────────────────────────
Seller Payout: $96.00
```

**Why we decided this:**
- **Product Rule:** "Buyers pay tax on the whole price; SP points are not coupons" (confirmed 2026-08-15).
- **SP is Payment Tender:** Swap Points settle part of the buyer's cash obligation; they are not a price discount, so they do not shrink the taxable sale amount.
- **Matches Shipped Code (BP-37):** Server Edge Function, client previews, cart checkout, and RPC all tax the full `item.price`; SP never subtracts from the taxable amount.
- **Simple & Predictable:** Tax is stable as the SP slider moves — no recomputation or dispute surface.

**Rejected Alternative:** Tax only the net cash amount after swap points (treating SP as a promotional coupon). Rejected because:
- SP is a payment method, not a coupon — the whole item price is spent on a full-price good.
- Taxing the full price matches the confirmed product decision and the shipped implementation.

---

## 3. PLATFORM FEE TAX TREATMENT

### Decision: Platform Fees NOT Included in Taxable Amount

**Structure:**
```
Taxable: Item price (FULL — Swap Points do NOT reduce the taxable base)
NOT Taxable: Platform fees (buyer fixed, buyer %, seller %)
```

**Why we decided this:**
- **Lower Buyer Cost:** Reduces total tax burden (better UX)
- **Legally Defensible:** Platform fees are service charges for marketplace access, separate from the retail sale
- **Industry Standard:** Etsy, Poshmark, Mercari all separate service fees from sales tax
- **Clearer Accounting:** Simplifies tax remittance calculations
- **Tax Authority Precedent:** Service fees charged separately are generally non-taxable

**Implementation Requirement:** Fees must be:
- Labeled as "Service Fee" or "Platform Fee" on receipts
- Shown as separate line items (not bundled into item price)
- Clearly identified as marketplace access charges

**Rejected Alternative:** Include platform fees in taxable amount. Rejected because:
- Higher tax burden on buyers
- Legally questionable (fees are for platform service, not the item itself)
- Would create confusion in accounting (remitting tax on our own fees)
- Reduces our revenue slightly (fees would need to absorb tax cost)

---

## 4. SWAP POINTS AS PAYMENT TENDER (NOT A COUPON)

### Decision: Swap Points Treated as Payment Tender — They Do NOT Reduce Taxable Base

> **LOCKED RULE (2026-08-15):** "Buyers pay tax on the whole price; SP points are not coupons." SP does **NOT** reduce the taxable base.

**Tax Treatment:**
```
Swap Points = Payment tender applied to the buyer's cash obligation
Taxable base = FULL item price (SP does NOT reduce it)
```

**Why we decided this:**
- **Legal Classification:** Swap points are loyalty rewards (not currency), applied as tender
- **No Cash Value:** Cannot be redeemed for cash or transferred between users
- **Promotional Nature:** Earned through platform activity, used to settle part of a purchase
- **Product Rule (2026-08-15):** SP is a payment method, not a coupon — the whole item price is taxed

**Critical Design Constraint:**
We already implemented **category-based spend caps** to prevent swap points from covering 100% of item price. This ensures:
- Buyers always pay some cash
- SP can never fully offset an item's price
- Prevents SP-only "free" transactions

**Rejected Alternative:** Treat SP as a promotional coupon that reduces the taxable amount. Rejected because:
- SP is a payment method, not a discount on the sale price
- Tax on the full item price is the confirmed product rule and matches shipped code (BP-37)

---

## 5. FEE CALCULATION ON NET PRICE

### Decision: All Fees Calculated on Net Price (After Swap Points)

**Fee Calculation:**
```
Net Price = Item Price - Swap Points
Buyer % Fee = Net Price × buyer_fee_percentage
Seller % Fee = Net Price × seller_fee_percentage
Buyer Fixed Fee = flat amount (not percentage-based)
```

**Why we decided this:**
- **Clarity:** Fees use the net cash portion (after SP tender); tax uses the FULL item price (BP-37) — see §2
- **Fair to All Parties:** Everyone operates on actual transaction value
- **Simpler Code:** Single calculation base reduces bugs
- **Aligned Incentives:** Platform revenue tied to actual money changing hands

**Example:**
```
$100 item, $20 SP used → Net Price $80
Buyer Fee: 2.5% × $80 = $2.00 (not 2.5% × $100 = $2.50)
Seller Fee: 5% × $80 = $4.00 (not 5% × $100 = $5.00)
```

**Rejected Alternative:** Calculate fees on full price before SP. Rejected because:
- Creates incentive misalignment (platform makes more when SP used less)
- Buyers perceive as "double charging" on the discount
- Seller pays fee on money they didn't actually receive

---

## 6. NODE-BASED TAX RATE CONFIGURATION

### Decision: Tax Rates Configurable Per Node (Geographic Zone)

**Architecture:**
```sql
nodes table additions:
- tax_rate (decimal): e.g., 0.0635 for CT 6.35%
- tax_jurisdiction (text): e.g., "Connecticut"
- tax_enabled (boolean): Admin can disable tax for specific nodes
```

**Why we decided this:**
- **Future Scalability:** Supports multi-state expansion (CA, NY, TX each have different rates)
- **Local Tax Support:** Some states have municipal/county rates (e.g., California ~10,000 jurisdictions)
- **Flexibility:** Can A/B test markets with different tax structures
- **Admin Control:** Tax team can update rates without code deployment

**Connecticut Context:**
- CT has **uniform 6.35% statewide** rate (no local jurisdictions add to this)
- Simple for MVP: All nodes start with same rate
- But architecture supports future complexity (e.g., CA: 7.25% state + 0-3% local)

**Rejected Alternative:** Single global tax rate in admin_config. Rejected because:
- Blocks multi-state expansion
- Can't handle local tax variations
- Requires code changes for rate updates
- Not scalable for growth

---

## 7. DESTINATION-BASED TAX (BUYER'S LOCATION)

### Decision: Tax Rate Determined by Buyer's Node

**Logic:**
```
Tax Rate = buyer.active_node_id → nodes.tax_rate
```

**Why we decided this:**
- **Legal Requirement:** CT marketplace facilitator law requires destination-based tax
- **US Supreme Court:** Wayfair v. South Dakota (2018) establishes destination-based as standard
- **Industry Standard:** All major marketplaces use buyer's location
- **Fair:** Buyer's jurisdiction receives the tax revenue (correct public policy)

**Implementation:**
- Buyer's `active_node_id` determines which `nodes.tax_rate` applies
- Node isolation already ensures buyer and item are in same node (simplifies MVP)
- Future: If cross-node trades allowed, still use buyer's node for tax

**Rejected Alternative:** Origin-based (seller's location). Rejected because:
- CT law doesn't allow it for marketplace facilitators
- Would violate destination-based mandate
- Legally risky (audit issues)

---

## 8. SUBSCRIPTION FEE TAX TREATMENT

### Decision: Subscription Fees Non-Taxable by Default (Admin Toggle Available)

**Tax Treatment:**
```
Kids Club+ Subscription = Service fee (non-taxable in CT)
Admin can override via: subscription_fee_taxable toggle
```

**Why we decided this:**
- **CT Law:** Digital services and access fees generally exempt from sales tax
- **Industry Precedent:** Netflix, Spotify, Amazon Prime subscriptions not taxed in CT
- **Platform Service:** Subscription provides app access, not tangible goods
- **Admin Override:** Allows compliance if law changes or other states have different rules

**Rejected Alternative:** Tax all subscriptions. Rejected because:
- Increases subscription price without clear legal requirement
- Competitive disadvantage vs other apps
- CT doesn't currently tax digital service subscriptions

---

## 9. TAX REFUND STRATEGY

### Decision: Automatic Proportional Tax Refund + Audit Trail

**Refund Logic:**
```
If transaction refunded/disputed:
  Refund Amount = (Refund % of Item Price) × Original Tax Paid
  Store in: tax_records.refunded_tax_cents
  Update: transaction.tax_amount_cents (deduct refunded amount)
```

**Why we decided this:**
- **Legal Compliance:** Must track tax refunds for remittance calculations
- **Automatic:** Reduces manual work, prevents errors
- **Proportional:** Fair to buyer (get back exactly what they paid)
- **Audit Trail:** Required for state tax audits (3-7 year record retention)

**Example:**
```
Original Purchase: $80 taxable, $5.08 tax paid
Partial Refund: $40 (50% of purchase)
Tax Refund: $2.54 (50% of $5.08)
```

**Rejected Alternative:** Manual tax refunds by admin. Rejected because:
- Error-prone (admin might forget or miscalculate)
- Slow (delays refund processing)
- Doesn't scale (high refund volume expected)
- Audit risk (missing refund documentation)

---

## 10. TAX REPORTING REQUIREMENTS

### Decision: Comprehensive Reporting for CT DRS Compliance

**Required Reports (All 7 Types):**
1. **Gross Sales** - Total value of all taxable transactions (by date range)
2. **Tax Collected** - Total sales tax collected from buyers
3. **Tax Refunded** - Tax returned due to refunds/cancellations
4. **Net Tax Owed** - Collected - Refunded = Amount to remit to state
5. **By Jurisdiction** - Breakdown by node (future multi-jurisdiction support)
6. **Transaction Audit Trail** - Detailed log of every tax calculation
7. **CSV Export** - Format for CT DRS filing system

**Why we decided this:**
- **Legal Requirement:** CT Department of Revenue Services (DRS) requires monthly/quarterly filings
- **Audit Protection:** Detailed records prevent penalties during audits
- **Operational Need:** Finance team needs reports for accounting
- **Automation Ready:** Data structured for future auto-filing

**Filing Frequency (CT Requirements):**
- Monthly: If annual sales tax > $200,000
- Quarterly: If annual sales tax $100-$200k
- Annual: If annual sales tax < $100k

**Rejected Alternative:** Basic totals only. Rejected because:
- Insufficient for state filing requirements
- Can't handle audits effectively
- Finance team needs granular data
- Missing export capability blocks workflow

---

## 11. TAX EXEMPTIONS

### Decision: No Tax Exemptions for MVP

**Exemption Handling:**
```
MVP: All transactions taxed (no exemptions)
Post-MVP: Add support for:
  - Non-profit exemption certificates
  - Reseller permits
  - Government agency purchases
```

**Why we decided this:**
- **Rare in P2P:** Used goods marketplaces rarely have exempt buyers
- **Complexity:** Certificate validation, expiration tracking, compliance
- **MVP Focus:** Core functionality first, edge cases later
- **No User Demand:** Parents buying for personal use (not exempt scenarios)

**Future Architecture Ready:**
- Database can add `buyer_tax_exempt` boolean
- Tax calculation function checks exemption status
- Admin can upload exemption certificates

**Rejected Alternative:** Build full exemption system in MVP. Rejected because:
- Adds 2-3 weeks development time
- Legal complexity (validate certificates, track expiration)
- Virtually no expected usage in target market
- Feature can be added later without breaking changes

---

## 12. REAL-TIME TAX RECALCULATION

### Decision: Live Tax Updates as Swap Points Change

**User Experience:**
```
User adjusts swap points slider in cart/checkout:
  → Debounced recalculation (300ms delay)
  → Update taxable amount
  → Recalculate tax
  → Update total instantly
```

**Why we decided this:**
- **Transparency:** Buyer sees exactly what they'll pay before checkout
- **No Surprises:** Prevents "sticker shock" at final checkout
- **User Control:** Empowers buyers to optimize SP usage
- **Industry Standard:** Amazon, Shopify show live tax updates

**Technical Implementation:**
- React hook with debounced tax calculation
- Call RPC function `calculate_sales_tax()` on each change
- Loading state during calculation
- Error handling for calculation failures

**Rejected Alternative:** Calculate tax only at final checkout. Rejected because:
- Poor UX (buyer doesn't know final cost until committed)
- Higher cart abandonment (surprise tax at checkout)
- Reduces trust ("why didn't you show me this earlier?")

---

## 13. MULTI-SELLER TAX HANDLING

### Decision: Per-Seller Tax Calculation (Separate Carts)

**Tax Calculation:**
```
Cart Architecture: Separate cart per seller (from MODULE-15.2)
Tax Calculation: Separate tax per seller transaction
Checkout: Each seller = separate payment + separate tax
```

**Why we decided this:**
- **Aligns with Cart System:** MODULE-15.2 already uses per-seller carts
- **Simpler Accounting:** Each transaction is isolated (easy to reconcile)
- **Clearer Receipts:** One seller = one receipt with one tax amount
- **Refund Simplicity:** Refunding one seller doesn't affect another's tax

**Example:**
```
Seller A Cart: $50 item → $3.18 tax
Seller B Cart: $30 item → $1.91 tax
Total Taxes: $5.09 (two separate transactions)
```

**Rejected Alternative:** Combined tax for multi-seller checkout. Rejected because:
- Cart system doesn't support multi-seller checkout
- Complicates refund calculations
- Makes receipt less clear
- Harder to trace tax per transaction

---

## 14. TAX EFFECTIVE DATE & RATE CHANGES

### Decision: Immediate Tax Collection + Historical Rate Tracking

**Implementation:**
```
Tax Collection: Starts day 1 of launch (legal requirement)
Rate Changes: Stored with effective_date for historical tracking
Tax Calculation: Always uses rate from transaction date (immutable)
```

**Why we decided this:**
- **Legal Mandate:** Must collect tax before first sale (CT law)
- **Audit Compliance:** Tax authorities audit historical transactions (need rate at time of sale)
- **Rate Changes:** CT could change 6.35% rate in future (rare but possible)
- **Data Integrity:** Never retroactively change tax on completed transactions

**Database Design:**
```sql
tax_records table:
  - tax_rate_applied (decimal) -- Rate used at transaction time
  - created_at (timestamp) -- When transaction occurred
  - node_id → nodes.tax_rate -- Links to current rate
```

**Rejected Alternative:** Use current rate for all calculations. Rejected because:
- Audit failure (tax authority sees wrong rates for historical transactions)
- Legal risk (claiming we collected different amount than we did)
- Refund errors (refunding based on new rate, not original rate)

---

## 15. INTEGRATION WITH EXISTING FEE SYSTEM

### Decision: Leverage Existing admin_config Fee Parameters

**Existing Fee Configuration (in admin_config table):**
```sql
platform_fee_buyer_fixed_cents = 25         -- $0.25
platform_fee_buyer_percentage = 2.5         -- 2.5%
platform_fee_seller_percentage = 5.0        -- 5.0%
platform_fee_seller_discount_percentage_freemium = 0
platform_fee_seller_discount_percentage_kids_club_plus = 0
```

**Tax Configuration (to add to admin_config):**
```sql
sales_tax_enabled = true                    -- Global tax on/off
default_sales_tax_rate = 6.35              -- Fallback if node missing rate
subscription_fee_taxable = false           -- Tax subscriptions?
tax_remittance_jurisdiction = "Connecticut" -- Where to file
```

**Why we decided this:**
- **Consistency:** Tax config lives with fee config (related settings together)
- **Reuse Existing UI:** Admin config page already exists
- **No New Tables:** Simpler database schema
- **Single Source of Truth:** All financial config in one place

**Integration Points:**
1. Tax calculation reads fee configs to display total breakdown
2. Cart shows: Item + Fees + Tax (all from admin_config + nodes)
3. Receipt itemizes: Item, Fees (from admin_config), Tax (from nodes)

**Rejected Alternative:** Create new tax_config table. Rejected because:
- Unnecessary complexity
- admin_config already has category system (can add 'tax' category)
- Fragments configuration across multiple tables
- Requires new admin UI pages

---

## SUMMARY OF ALL DECISIONS

| Decision Area | Choice | Key Rationale |
|--------------|--------|---------------|
| **Legal Basis** | Implement sales tax (CT Marketplace Facilitator Law) | Platform charges fees → facilitator status |
| **Taxable Amount** | Item Price - Swap Points | Industry standard, fair to buyers |
| **Fee Taxability** | Fees NOT taxed (separate service charges) | Lower cost, legally defensible |
| **Swap Points** | Promotional discount (applied before tax) | Loyalty reward, not currency |
| **Fee Calculation** | All fees on net price (after SP) | Consistency, fairness |
| **Tax Rates** | Node-based configuration | Future scalability (multi-state) |
| **Tax Jurisdiction** | Destination-based (buyer's node) | CT law requirement |
| **Subscription Tax** | Non-taxable (admin toggle) | Service fee exemption |
| **Tax Refunds** | Automatic proportional + audit trail | Compliance, accuracy |
| **Tax Reporting** | All 7 report types | CT DRS filing requirements |
| **Tax Exemptions** | None for MVP | Rare in P2P, defer complexity |
| **Real-Time Calc** | Live updates as SP changes | Transparency, no surprises |
| **Multi-Seller** | Per-seller tax calculation | Aligns with cart architecture |
| **Effective Date** | Immediate collection + rate tracking | Legal mandate, audit compliance |
| **Config Integration** | Leverage existing admin_config | Consistency, reuse existing UI |

---

## PART 2: OVERVIEW

### Sales Tax Engine Purpose
Implement a legally compliant, transparent sales tax system that:
- Calculates tax on net transaction amount (item price - swap points)
- Collects tax at checkout and remits to Connecticut DRS
- Provides comprehensive reporting for tax compliance
- Integrates seamlessly with existing fee structure
- Supports future multi-state expansion

### Key Features
- **Node-Based Rates**: Tax rate configured per geographic node
- **Real-Time Calculation**: Tax updates live as swap points change
- **Automatic Refunds**: Proportional tax refund on returns/disputes
- **Comprehensive Reporting**: All 7 report types for CT DRS filing
- **Admin Configuration**: Tax settings manageable via admin dashboard
- **Audit Trail**: Complete transaction-level tax records

### Architecture Principles
- **Separation of Concerns**: Tax calculation isolated from fee calculation
- **Data Integrity**: Immutable tax records (never retroactively changed)
- **Performance**: Tax calculation < 100ms (cached node tax rates)
- **Scalability**: Architecture supports 50-state expansion
- **Compliance First**: All features align with CT tax law requirements

---

## PART 3: IMPLEMENTATION TASKS

**Total Tasks:** 14  
**Estimated Duration:** 57 hours  
**Phases:** 5

---

## TASK SUMMARY TABLE

| Phase | Task ID | Task Name | Duration | Priority | Status |
|-------|---------|-----------|----------|----------|--------|
| **Phase 1: Database** | | | **4h** | | |
| 1 | TAX-001 | Database Schema Migration | 4h | P0 | ✅ Ready |
| **Phase 2: RPC Functions** | | | **14h** | | |
| 2 | TAX-002 | RPC - Calculate Sales Tax | 3h | P0 | 🔲 Pending |
| 2 | TAX-003 | RPC - Apply Tax to Transaction | 2h | P0 | 🔲 Pending |
| 2 | TAX-004 | RPC - Refund Sales Tax | 3h | P1 | 🔲 Pending |
| 2 | TAX-005 | RPC - Get Tax Summary | 4h | P1 | 🔲 Pending |
| 2 | TAX-006 | RPC - Get Tax Export Data | 2h | P1 | 🔲 Pending |
| **Phase 3: Admin Site** | | | **17h** | | |
| 3 | TAX-007 | Admin UI - Node Tax Rate Config | 6h | P1 | 🔲 Pending |
| 3 | TAX-008 | Admin UI - Tax Reporting Dashboard | 8h | P1 | 🔲 Pending |
| 3 | TAX-009 | Admin UI - Global Tax Settings | 3h | P2 | 🔲 Pending |
| **Phase 4: Mobile Integration** | | | **16h** | | |
| 4 | TAX-010 | Mobile Hook - useTaxCalculation | 4h | P0 | 🔲 Pending |
| 4 | TAX-011 | Mobile UI - Checkout Tax Display | 5h | P0 | 🔲 Pending |
| 4 | TAX-012 | Mobile UI - Transaction History Tax | 3h | P2 | 🔲 Pending |
| 4 | TAX-013 | Mobile Service - Tax Integration | 4h | P0 | 🔲 Pending |
| **Phase 5: Testing** | | | **6h** | | |
| 5 | TAX-014 | End-to-End Tax Flow Testing | 6h | P1 | 🔲 Pending |

---

## PHASE 1: DATABASE FOUNDATION

---

### TASK TAX-001: Database Schema Migration

**Duration:** 4 hours  
**Priority:** Critical (P0)  
**Dependencies:** Existing nodes, trades, admin_config tables

#### Description
Create complete tax database infrastructure in a single migration file:
1. Add tax columns to `nodes` table (tax_rate, tax_jurisdiction, tax_enabled)
2. Add tax columns to `trades` table (tax_amount_cents, taxable_amount_cents, tax_rate_applied, tax_jurisdiction)
3. Create `tax_records` table for audit trail
4. Add tax configuration entries to `admin_config` table
5. Create all indexes, constraints, and RLS policies

#### Acceptance Criteria
- [ ] `nodes` table has tax configuration columns
- [ ] `trades` table stores tax data for each transaction
- [ ] `tax_records` table provides detailed audit trail
- [ ] `admin_config` has global tax settings
- [ ] All indexes created for performance
- [ ] RLS policies secure tax data
- [ ] Migration runs successfully in Supabase

#### Deliverables
- **File:** `supabase/migrations/20260510000001_sales_tax_schema.sql`
- **Tables Modified:** `nodes`, `trades`, `admin_config`
- **Tables Created:** `tax_records`
- **Functions Created:** `get_node_tax_rate()`
- **Indexes:** 6 indexes for performance
- **RLS Policies:** Full row-level security

#### Testing Checklist
- [ ] Migration runs without errors
- [ ] All verification queries pass
- [ ] `nodes` table has 3 new columns
- [ ] `trades` table has 4 new columns
- [ ] `tax_records` table created with all fields
- [ ] 4 new entries in `admin_config`
- [ ] `get_node_tax_rate()` function works
- [ ] RLS policies prevent unauthorized access
- [ ] Existing data unaffected by migration

---

## PHASE 2: RPC FUNCTIONS (TAX CALCULATION & REPORTING)

---

### TASK TAX-002: RPC Function - Calculate Sales Tax

**Duration:** 3 hours  
**Priority:** Critical (P0)  
**Dependencies:** TAX-001 (Database Schema)

#### Description
Create RPC function to calculate sales tax for a transaction:
- Accepts item price, swap points, and buyer node ID
- Reads node tax rate and global tax settings
- Returns taxable amount and tax amount
- Handles all validation and error cases

#### Acceptance Criteria
- [ ] `calculate_sales_tax()` computes correct tax on the FULL item price (SP does NOT reduce taxable base)
- [ ] Reads tax_rate from buyer's node
- [ ] Returns 0 if tax globally disabled or node tax disabled
- [ ] Validates input parameters (item_price > 0, valid node_id)
- [ ] Returns JSONB with {success, data: {taxable_amount_cents, tax_amount_cents, tax_rate, jurisdiction}}
- [ ] Performance: < 100ms
- [ ] Comprehensive error handling

#### Deliverables
- **File:** `supabase/migrations/20260510000002_rpc_calculate_tax.sql`
- **Function:** `calculate_sales_tax(p_item_price_cents, p_swap_points_cents, p_buyer_node_id)`
- **Returns:** JSONB with tax calculation details

#### Testing Checklist
- [ ] $100 item, $20 SP → $100 taxable (full price), correct tax calculated
- [ ] Tax disabled globally → $0 tax returned
- [ ] Tax disabled for node → $0 tax returned
- [ ] Invalid node ID → proper error returned
- [ ] Negative item price → proper error returned
- [ ] Performance target met (< 100ms)

---

### TASK TAX-003: RPC Function - Apply Tax to Transaction

**Duration:** 2 hours  
**Priority:** Critical (P0)  
**Dependencies:** TAX-001, TAX-002

#### Description
Create RPC function to store tax data when a transaction completes:
- Updates `trades` table with tax information
- Creates `tax_records` entry for audit trail
- Links tax record to transaction and user
- Validates transaction exists before applying tax

#### Acceptance Criteria
- [ ] `apply_tax_to_transaction()` updates `trades.tax_amount_cents`
- [ ] Creates corresponding `tax_records` entry
- [ ] Links to correct buyer user_id and node_id
- [ ] Validates transaction exists
- [ ] Returns tax_record_id on success
- [ ] Atomic operation (both updates succeed or both fail)
- [ ] Performance: < 150ms

#### Deliverables
- **File:** `supabase/migrations/20260510000003_rpc_apply_tax.sql`
- **Function:** `apply_tax_to_transaction(p_transaction_id, p_taxable_amount_cents, p_tax_rate, p_tax_amount_cents, p_tax_jurisdiction, p_node_id)`
- **Returns:** JSONB with {success, data: {tax_record_id}}

#### Testing Checklist
- [ ] Tax applied to valid transaction
- [ ] Both `trades` and `tax_records` updated
- [ ] Invalid transaction ID → error returned
- [ ] Tax record has all required fields
- [ ] Audit trail complete

---

### TASK TAX-004: RPC Function - Refund Sales Tax

**Duration:** 3 hours  
**Priority:** High (P1)  
**Dependencies:** TAX-001, TAX-002, TAX-003

#### Description
Create RPC function to handle proportional tax refunds:
- Calculates refund percentage based on refund amount vs original price
- Updates `tax_records` with refunded_tax_cents
- Updates `trades` to reflect reduced tax
- Tracks cumulative refunds (supports multiple partial refunds)

#### Acceptance Criteria
- [ ] `refund_sales_tax()` calculates proportional tax refund
- [ ] Supports multiple partial refunds
- [ ] Prevents refunding more tax than collected
- [ ] Updates both `tax_records` and `trades` tables
- [ ] Includes refund reason in audit trail
- [ ] Returns refund details with breakdown
- [ ] Performance: < 200ms

#### Deliverables
- **File:** `supabase/migrations/20260510000004_rpc_refund_tax.sql`
- **Function:** `refund_sales_tax(p_transaction_id, p_refund_amount_cents, p_refund_reason)`
- **Returns:** JSONB with refund details and cumulative tracking

#### Testing Checklist
- [ ] 50% refund → 50% of tax refunded
- [ ] Multiple refunds tracked correctly
- [ ] Cannot refund more than collected
- [ ] Refund reason stored in audit trail
- [ ] Math precision correct (no rounding errors)

---

### TASK TAX-005: RPC Function - Get Tax Summary

**Duration:** 4 hours  
**Priority:** High (P1)  
**Dependencies:** TAX-001, TAX-003

#### Description
Create comprehensive tax reporting RPC function:
- Supports 7 report types (summary, transactions, refunds, jurisdictions, by_period, tax_exempt, audit_trail)
- Aggregates tax collected, refunded, net owed
- Groups by jurisdiction for multi-node reporting
- Filters by date range and optional node
- Returns data ready for admin dashboard display

#### Acceptance Criteria
- [ ] `get_tax_summary()` returns all 7 report types
- [ ] Date range filtering works correctly
- [ ] Jurisdiction breakdown groups properly
- [ ] Net tax calculation is accurate (collected - refunded)
- [ ] Audit trail limited to 1000 records for performance
- [ ] Performance: < 1 second for 30-day range
- [ ] All monetary values converted to USD correctly

#### Deliverables
- **File:** `supabase/migrations/20260510000005_rpc_tax_summary.sql`
- **Function:** `get_tax_summary(p_start_date, p_end_date, p_node_id, p_report_type)`
- **Returns:** JSONB with comprehensive tax report data

#### Testing Checklist
- [ ] Summary section includes collected/refunded/net
- [ ] Jurisdiction breakdown accurate
- [ ] Date filtering works
- [ ] Report type selector filters correctly
- [ ] Performance target met
- [ ] Empty data sets handled gracefully

---

### TASK TAX-006: RPC Function - Get Tax Export Data

**Duration:** 2 hours  
**Priority:** High (P1)  
**Dependencies:** TAX-001, TAX-003

#### Description
Create RPC function for CSV export:
- Returns table format (not JSONB) for easy CSV conversion
- Includes all fields required for CT DRS filing
- Joins with users/nodes for complete data
- Optimized for large date ranges

#### Acceptance Criteria
- [ ] `get_tax_export_data()` returns TABLE format
- [ ] Includes: transaction_date, buyer_email, node_name, taxable_amount, tax_rate, tax_amount, refunded_tax, net_tax
- [ ] Joins with `auth.users` for buyer_email
- [ ] Joins with `nodes` for node_name
- [ ] Date range filtering works
- [ ] Performance: < 2 seconds for 1-year data

#### Deliverables
- **File:** `supabase/migrations/20260510000006_rpc_tax_export.sql`
- **Function:** `get_tax_export_data(p_start_date, p_end_date)`
- **Returns:** TABLE (CSV-friendly format)

#### Testing Checklist
- [ ] Returns table rows (not JSON)
- [ ] All required fields present
- [ ] Decimal formatting correct (2 decimals for USD)
- [ ] Date range filtering accurate
- [ ] Performance acceptable for large datasets

---

## PHASE 3: ADMIN SITE TAX MANAGEMENT

---

### TASK TAX-007: Admin UI - Node Tax Rate Configuration

**Duration:** 6 hours  
**Priority:** High (P1)  
**Dependencies:** TAX-001 (Database Schema), Existing admin_config infrastructure

#### Description
Create admin interface for managing tax rates at the node level:
1. **Node Tax Settings Page:** View/edit tax configuration for each geographic node
2. **Bulk Tax Update:** Update multiple nodes at once (e.g., when CT changes state rate)
3. **Tax Rate History:** Track when rates change (audit trail for compliance)
4. **Global Tax Toggle:** Enable/disable tax collection globally

#### Acceptance Criteria
- [ ] Admin can view tax_rate, tax_jurisdiction, tax_enabled for each node
- [ ] Admin can edit tax rate per node with validation (0-100%)
- [ ] Changes require confirmation modal (preventing accidental updates)
- [ ] Bulk update UI for applying same rate to multiple nodes
- [ ] Tax rate change history logged (who changed, when, old/new values)
- [ ] Global tax enabled/disabled toggle synced with admin_config
- [ ] Input validation: Tax rate must be 0-100%, jurisdiction required
- [ ] Success/error notifications on save
- [ ] Loading states during API calls

#### Deliverables
- **File:** `p2p-kids-admin/src/app/tax/nodes/page.tsx`
- **Components:** NodeTaxConfigPage, NodeTaxEditForm
- **API Integration:** Supabase queries to nodes table
- **UI Elements:** Table, edit modals, bulk update form, global toggle

#### Testing Checklist
- [ ] Page loads and displays all nodes
- [ ] Global tax toggle updates admin_config correctly
- [ ] Individual node tax rate can be edited
- [ ] Bulk update applies to all enabled nodes only
- [ ] Validation prevents invalid tax rates (< 0 or > 100)
- [ ] Success/error toasts display appropriately
- [ ] Loading states shown during API calls
- [ ] Tax enabled/disabled toggle works per node
- [ ] Changes persist after page refresh

---

### TASK TAX-008: Admin UI - Tax Reporting Dashboard

**Duration:** 8 hours  
**Priority:** High (P1)  
**Dependencies:** TAX-005, TAX-006 (Tax Reporting RPCs)

#### Description
Create comprehensive tax reporting dashboard for admin site:
1. **Summary Card View:** Total tax collected, refunded, net owed (current month/year/all-time)
2. **Jurisdiction Breakdown:** Tax by node/jurisdiction with drill-down
3. **Date Range Filter:** Custom date range selector for reports
4. **7 Report Types:** All CT DRS filing requirements (summary, transactions, refunds, jurisdictions, by-period, tax-exempt, audit trail)
5. **CSV Export:** Download tax data for CT DRS filing

#### Acceptance Criteria
- [ ] Dashboard displays tax summary (collected, refunded, net owed)
- [ ] Date range picker with presets (This Month, Last Month, Q1-Q4, YTD, All Time)
- [ ] Jurisdiction breakdown table with amounts per node
- [ ] Transaction count and average tax per transaction
- [ ] All 7 report types accessible (tabs or dropdown selector)
- [ ] CSV export button downloads data in CT DRS format
- [ ] Charts/visualizations for tax trends over time
- [ ] Performance: Load time < 2 seconds for 1-year data
- [ ] Responsive design for mobile admin access

#### Deliverables
- **File:** `p2p-kids-admin/src/app/tax/reports/page.tsx`
- **Components:** TaxReportsPage, SummaryCards, JurisdictionTable, DateRangePicker, CSVExportButton
- **API Integration:** Calls get_tax_summary and get_tax_export_data RPCs
- **UI Elements:** Summary cards, data table, date picker, export button

#### Testing Checklist
- [ ] Dashboard loads tax summary correctly
- [ ] Date preset selector updates data
- [ ] All 4 summary cards display correct totals
- [ ] Jurisdiction breakdown table populated
- [ ] CSV export downloads with correct data
- [ ] Report type selector filters data
- [ ] Loading states shown during fetch
- [ ] Error handling displays toast notifications
- [ ] Responsive design works on mobile
- [ ] Performance: < 2s load time for 1-year data

---

### TASK TAX-009: Admin UI - Global Tax Settings

**Duration:** 3 hours  
**Priority:** Medium (P2)  
**Dependencies:** TAX-001 (Database Schema)

#### Description
Create dedicated admin page for global tax configuration:
- Global tax enabled/disabled toggle
- Default tax rate configuration (fallback when node missing rate)
- Subscription fee taxable toggle
- Tax remittance jurisdiction setting
- Integrates with existing admin_config UI patterns

#### Acceptance Criteria
- [ ] Page displays all tax-related admin_config entries
- [ ] Toggle for sales_tax_enabled (global on/off)
- [ ] Input for default_sales_tax_rate with validation
- [ ] Toggle for subscription_fee_taxable
- [ ] Input for tax_remittance_jurisdiction
- [ ] Changes saved to admin_config table
- [ ] Warning banner when tax disabled globally
- [ ] Success/error notifications
- [ ] Audit log of config changes

#### Deliverables
- **File:** `p2p-kids-admin/src/app/tax/settings/page.tsx`
- **Components:** TaxSettingsPage, ConfigToggle, ConfigInput
- **API Integration:** admin_config table queries
- **UI Elements:** Toggles, inputs, save button, warning banners

#### Testing Checklist
- [ ] All tax config settings displayed
- [ ] Toggles update admin_config
- [ ] Default rate validation (0-100%)
- [ ] Jurisdiction input saves correctly
- [ ] Warning shown when tax disabled
- [ ] Changes persist after refresh
- [ ] Audit trail logged

---

## PHASE 4: MOBILE APP INTEGRATION

---

### TASK TAX-010: Mobile Hook - useTaxCalculation

**Duration:** 4 hours  
**Priority:** Critical (P0)  
**Dependencies:** TAX-002 (Calculate Tax RPC)

#### Description
Create React hook for tax calculation in mobile app:
- Calls `calculate_sales_tax` RPC function
- Debounced recalculation (300ms) as SP slider changes
- Handles loading, error, and disabled states
- Caches node tax rate for performance
- Returns structured tax data for UI display

#### Acceptance Criteria
- [ ] Hook accepts item_price, swap_points, node_id
- [ ] Calls calculate_sales_tax RPC with debounce (300ms)
- [ ] Returns: {taxableAmount, taxAmount, taxRate, jurisdiction, loading, error}
- [ ] Handles tax-disabled scenarios (returns $0)
- [ ] Error handling with retry capability
- [ ] TypeScript types for all inputs/outputs
- [ ] Unit tests for hook logic

#### Deliverables
- **File:** `p2p-kids-marketplace/src/hooks/useTaxCalculation.ts`
- **Hook:** `useTaxCalculation(itemPrice, swapPoints, nodeId)`
- **Types:** TaxCalculationResult, TaxCalculationError
- **Tests:** `src/__tests__/hooks/useTaxCalculation.test.ts`

#### Testing Checklist
- [ ] Hook calculates tax correctly
- [ ] Debounce prevents excessive RPC calls
- [ ] Loading state accurate
- [ ] Error state handled gracefully
- [ ] Tax-disabled returns $0 without error
- [ ] TypeScript compile clean
- [ ] Unit tests pass

---

### TASK TAX-011: Mobile UI - Checkout Tax Display

**Duration:** 5 hours  
**Priority:** Critical (P0)  
**Dependencies:** TAX-010 (useTaxCalculation hook)

#### Description
Update checkout screen to display sales tax:
- Add tax breakdown section below SP slider
- Real-time tax updates as SP amount changes
- Display: Item Price → SP Discount → Subtotal → Tax → Platform Fee → Total
- Kid-friendly labels ("Sales Tax" not "CT State Tax")
- Integrate with existing fee calculation
- Show tax-exempt indicator if applicable

#### Acceptance Criteria
- [ ] Tax breakdown section added to CheckoutScreen
- [ ] Real-time tax recalculation as SP changes
- [ ] Breakdown shows: Item Price, SP Discount, Subtotal, Tax, Platform Fee, Total
- [ ] Kid-friendly label: "Sales Tax" used
- [ ] Tax updates within 300ms of SP change (debounced)
- [ ] Tax-exempt users see "Tax Free" badge
- [ ] Loading state during tax calculation
- [ ] Error handling if tax calculation fails

#### Deliverables
- **File:** `p2p-kids-marketplace/src/screens/trade/CheckoutScreen.tsx`
- **Components:** TaxBreakdownSection, TaxLineItem
- **Hooks Used:** useTaxCalculation, existing fee hooks
- **UI Elements:** Breakdown card, line items, badges

#### Testing Checklist
- [ ] Tax breakdown renders correctly
- [ ] SP slider change triggers tax recalc
- [ ] All breakdown items display
- [ ] Labels are kid-friendly
- [ ] Tax-exempt badge shows when applicable
- [ ] Loading indicator during calculation
- [ ] Error state displays user-friendly message
- [ ] Visual design matches design system

---

### TASK TAX-012: Mobile UI - Transaction History Tax Details

**Duration:** 3 hours  
**Priority:** Medium (P2)  
**Dependencies:** TAX-003 (Apply Tax RPC)

#### Description
Add tax information to transaction history:
- Show tax amount in transaction list items
- Create tax breakdown detail view (modal/sheet)
- Display: taxable amount, tax rate, tax jurisdiction, refunds
- Link to full transaction details

#### Acceptance Criteria
- [ ] Transaction list shows tax amount per transaction
- [ ] "View Tax Details" button/link available
- [ ] Tax detail modal shows: taxable_amount, tax_rate, jurisdiction, refunds
- [ ] Refunded tax shown separately (if applicable)
- [ ] Net tax displayed (collected - refunded)
- [ ] Tax rate formatted as percentage (e.g., "6.35%")
- [ ] All amounts formatted as USD

#### Deliverables
- **File:** `p2p-kids-marketplace/src/screens/trade/TransactionHistoryScreen.tsx`
- **Components:** TaxDetailModal, TaxLineItem
- **Queries:** Fetch tax_records for transaction
- **UI Elements:** Modal, breakdown table, badges

#### Testing Checklist
- [ ] Tax amount shown in transaction list
- [ ] Tax detail modal opens correctly
- [ ] All tax fields displayed
- [ ] Refund tracking accurate
- [ ] Formatting consistent (USD, percentages)
- [ ] Modal dismisses properly

---

### TASK TAX-013: Mobile Service - Tax Integration

**Duration:** 4 hours  
**Priority:** Critical (P0)  
**Dependencies:** TAX-002, TAX-003, TAX-010

#### Description
Create tax service layer for mobile app:
- Wrapper functions for all tax RPCs
- Integration with existing transaction service
- Call `apply_tax_to_transaction` when trade completes
- Error handling and retry logic
- TypeScript types for all tax operations

#### Acceptance Criteria
- [ ] Tax service created with methods: calculateTax, applyTax, getTaxSummary
- [ ] Integrated into transaction creation flow
- [ ] Tax applied automatically when transaction completes
- [ ] Error handling with structured error types
- [ ] Retry logic for network failures
- [ ] TypeScript types for all inputs/outputs
- [ ] Unit tests for service methods

#### Deliverables
- **File:** `p2p-kids-marketplace/src/services/tax.ts`
- **Methods:** calculateTax, applyTax, getTaxSummary, refundTax
- **Types:** TaxCalculation, TaxRecord, TaxSummary
- **Tests:** `src/__tests__/services/tax.test.ts`

#### Testing Checklist
- [ ] Service methods call correct RPCs
- [ ] Transaction integration works
- [ ] Tax applied on transaction completion
- [ ] Error handling robust
- [ ] Retry logic prevents data loss
- [ ] TypeScript compile clean
- [ ] Unit tests pass

---

## PHASE 5: TESTING & VALIDATION

---

### TASK TAX-014: End-to-End Tax Flow Testing

**Duration:** 6 hours  
**Priority:** High (P1)  
**Dependencies:** All previous tasks

#### Description
Create comprehensive end-to-end tests for tax flows:
- Unit tests for all RPC functions
- Integration tests for mobile hooks/services
- E2E tests for complete tax scenarios
- Smoke test script for manual validation
- Test data fixtures for all scenarios

#### Acceptance Criteria
- [ ] Unit tests for all 5 RPC functions (TAX-002 to TAX-006)
- [ ] Integration tests for mobile tax hook
- [ ] E2E tests covering 9 key scenarios (see below)
- [ ] Smoke test script executable via npm/yarn
- [ ] Test fixtures for users, nodes, items, transactions
- [ ] All tests pass in CI/CD pipeline
- [ ] Test coverage > 80% for tax-related code

#### Test Scenarios
1. **Purchase with 0% SP** → full tax on item price
2. **Purchase with 50% SP** → tax on discounted amount  
3. **Tax disabled globally** → $0 tax collected
4. **Tax disabled for node** → $0 tax for that node
5. **Partial refund** → proportional tax refunded
6. **Full refund** → full tax refunded
7. **Multiple refunds** → cumulative tracking works
8. **Admin changes tax rate** → new transactions use new rate
9. **CSV export** → data matches expectations

#### Deliverables
- **File:** `p2p-kids-marketplace/src/__tests__/tax-e2e.test.ts`
- **Smoke Script:** `scripts/smoke/tax-flow.mjs`
- **Test Fixtures:** `src/test-data/tax-fixtures.ts`
- **Documentation:** `TESTING-TAX-FLOWS.md`

#### Testing Checklist
- [ ] All 9 scenarios pass
- [ ] Unit tests cover edge cases
- [ ] Integration tests stable
- [ ] Smoke script runs successfully
- [ ] Test data fixtures complete
- [ ] CI/CD integration verified
- [ ] Documentation updated

---

## ✅ MODULE-15.3 COMPLETE

**Total Deliverables:**
- 1 Database migration (3 tables, 6 functions, RLS policies)
- 5 RPC functions (calculate, apply, refund, summary, export)
- 3 Admin pages (node config, reporting, settings)
- 4 Mobile integrations (hook, checkout UI, history UI, service)
- 1 Comprehensive test suite

**Files Created/Modified:**
- 6 SQL migration files
- 3 Admin pages (Next.js/TypeScript)
- 4 Mobile files (React Native/TypeScript)
- 5 Test files (Jest/React Native Testing Library)

**Database Objects:**
- 3 tables modified (nodes, trades, admin_config)
- 1 table created (tax_records)
- 6 RPC functions
- 12+ indexes
- 10+ RLS policies

---

## AGENT EXECUTION NOTES

### Recommended Order
1. **TAX-001** (Database) - Foundation for everything
2. **TAX-002, TAX-003, TAX-004** (Core RPCs) - Tax calculation logic
3. **TAX-005, TAX-006** (Reporting RPCs) - Admin reporting
4. **TAX-007, TAX-008, TAX-009** (Admin UI) - Admin configuration
5. **TAX-010, TAX-013** (Mobile services) - Mobile backend
6. **TAX-011, TAX-012** (Mobile UI) - Mobile frontend
7. **TAX-014** (Testing) - Validation

### Dependencies Graph
```
TAX-001 (Database)
    ├─> TAX-002 (Calculate RPC)
    │       ├─> TAX-003 (Apply RPC)
    │       │       ├─> TAX-004 (Refund RPC)
    │       │       ├─> TAX-005 (Summary RPC)
    │       │       ├─> TAX-006 (Export RPC)
    │       │       └─> TAX-007, TAX-008, TAX-009 (Admin UI)
    │       └─> TAX-010 (Mobile Hook)
    │               ├─> TAX-011 (Checkout UI)
    │               ├─> TAX-012 (History UI)
    │               └─> TAX-013 (Mobile Service)
    └─> TAX-014 (Testing - depends on all)
```

### Performance Targets
- Database queries: < 200ms
- RPC functions: < 500ms
- Admin page load: < 2s
- Mobile tax calculation: < 300ms (debounced)
- CSV export (1 year): < 5s

### Error Handling Standards
All RPC functions must return:
```typescript
{
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

---

**END OF MODULE-15.3: SALES TAX ENGINE**
