# MODULE-05: DISCOVERY – ADMIN MANAGEMENT (POST-MVP)

**Version:** 1.0 (Post-MVP / Admin Discovery Controls)
**Status:** Draft – Add implementation tasks and verification steps
**Last Updated:** [Auto-generated timestamp]

---

## OVERVIEW

This Post-MVP module defines the **admin-side discovery management** surface for the Kids Club+ marketplace. It complements MODULE-05 (Search & Discovery V2) by giving operators and product managers the tools to tune, curate, and monitor discovery outcomes without code changes.

Why this exists:
- Allow non-devs (admins) to adjust search/recommendation behavior quickly for experiments, promotions, and moderation.
- Provide safe, auditable controls for "featured" and "boosted" listings, search-weight tuning, and A/B tests.
- Surface analytics to measure impact of discovery changes (CTR, conversions, SP adoption).

Dependencies: MODULE-05 (Discovery), MODULE-12 (Admin Panel), MODULE-09 (SP Wallet / Boosts), MODULE-01 (Infrastructure for boost tables / admin_config).

Key Flows impacted: FLOW-06 (Discovery), FLOW-18 (Admin Controls), FLOW-11 (SP rules for boost purchase), FLOW-09 (Fees & Pricing Engine for any SP cost changes).

---

## GOALS & PRINCIPLES

- Admin operations must be auditable (admin_activity_log + admin_discovery_changes).
- All admin UI actions are server-enforced (feature gating at RPC / DB level) — UI-only toggles are insufficient.
- Any DB migration that affects money/SP must follow Tier 2 regression rules and include rollback instructions.
- Keep runtime controls minimal and safe: tunable multipliers, feature flags, pin/featured lists, and boost lifecycle.

---

## TASKS (HIGH LEVEL)

- ADMIN-DISCOVERY-001: Admin discovery settings migration + RPCs
- ADMIN-DISCOVERY-002: Admin UI pages & components (p2p-kids-admin)
- ADMIN-DISCOVERY-003: API / Edge Functions (validate admin JWT, Zod schemas, contracts)
- ADMIN-DISCOVERY-004: Boost & Featured listings lifecycle (purchase, expire, analytics)
- ADMIN-DISCOVERY-005: A/B testing & analytics (run experiments, measure effect)
- ADMIN-DISCOVERY-006: Tests, verification checklist, and smoke scripts

Each task below contains an "AI Prompt for Cursor" with exact implementation guidance.

---

### TASK ADMIN-DISCOVERY-001: Database & RPC (admin_discovery_settings)

**Priority:** High — DB schema, migration, RLS, and helper RPCs.

**Description:** Add tables and RPCs to store and serve admin discovery configuration safely.

Mode (choose one):
- Mode B: Idempotent rerunnable migration (recommended)

#### Migration — Block 1 (Schema)

-- filepath: supabase/migrations/2025xxxxxx_admin_discovery_settings.sql

```sql
-- Create settings table
CREATE TABLE IF NOT EXISTS admin_discovery_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,                      -- e.g. 'search_weights', 'featured_ttl_days'
  value JSONB NOT NULL,                          -- value payload
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Featured listings table (pinned / curated)
CREATE TABLE IF NOT EXISTS featured_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES users(id),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,  -- nullable = indefinite until removed
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Admin audit table (discovery actions)
CREATE TABLE IF NOT EXISTS admin_discovery_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  action_type TEXT NOT NULL,  -- 'update_setting','feature_listing_add','feature_listing_remove','tune_weights'
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on these tables
ALTER TABLE admin_discovery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_discovery_changes ENABLE ROW LEVEL SECURITY;
```

#### Migration — Block 2 (Policies & Indexes)

```sql
-- Policies: only admins can view/modify
CREATE POLICY discovery_admin_select ON admin_discovery_settings FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY discovery_admin_insert ON admin_discovery_settings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY featured_admin_select ON featured_listings FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY featured_admin_insert ON featured_listings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY discovery_changes_insert ON admin_discovery_changes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Indexes: for lookup & TTL queries
CREATE INDEX IF NOT EXISTS idx_featured_listing_expires ON featured_listings(ends_at);
CREATE INDEX IF NOT EXISTS idx_admin_discovery_key ON admin_discovery_settings(key);
```

#### RPCs / Helper functions
- `rpc_get_discovery_settings()` → returns key/value map (admin-only)
- `rpc_set_discovery_setting(p_key text, p_value jsonb)` → validates and writes, logs change in admin_discovery_changes
- `rpc_feature_listing(p_listing_id uuid, p_admin_id uuid, p_duration_days int, p_reason text)` → inserts into featured_listings, handles TTL

RPCs must validate admin role and return structured errors. Use SECURITY DEFINER only for admin helper functions when necessary and include audit logs.

#### Verification queries (examples)
- SELECT * FROM admin_discovery_settings WHERE key = 'search_weights';
- SELECT * FROM featured_listings WHERE listing_id = '<uuid>' AND now() < coalesce(ends_at, now() + interval '100 years');

**DB Object Checklist:**
- [ ] tables created
- [ ] RLS enabled
- [ ] policies created
- [ ] indexes created
- [ ] helper RPCs implemented
- [ ] verification queries pass

### Suggested Setting: display_recommendation_score (boolean)
- **Key:** `display_recommendation_score`
- **Type:** boolean
- **Default:** `true` (show scores in the Recommendation carousel / Search dev mode)
- **Description:** Allows admins to turn on/off visual display of recommendation scores on item cards (Dev mode: scores may be shown for debugging; Admin toggle controls production visibility).

Example SQL to seed default value (idempotent):
```sql
INSERT INTO admin_discovery_settings (key, value, description)
VALUES ('display_recommendation_score', 'true'::jsonb, 'Toggle showing recommendation score in UI')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
```

**Implementation note:** The mobile/web clients should read this setting from the `rpc_get_discovery_settings()` RPC (or a dedicated endpoint) and enforce the visibility server-side by hiding score text even if score data is present. Admin UI changes must be audited in `admin_discovery_changes`.

---

### TASK ADMIN-DISCOVERY-002: Admin UI – Management Pages

**Priority:** High — p2p-kids-admin changes.

**Description:** Add a new section under Admin → `Discovery` with pages:
- `Discovery Settings` (key-value / JSON editor for 'search_weights', 'recommendation_multipliers', 'featured_ttl_days')
- `Featured Listings` (list, add/remove, schedule start/end)
- `Boosts` monitoring (current boosts, remaining durations, analytics link)
- `Experiments` (A/B experiments manager; create experiments tied to a setting key)

**Files (examples):**
- `p2p-kids-admin/src/app/discovery/page.tsx` (top-level route)
- `p2p-kids-admin/src/app/discovery/SettingsPage.tsx`
- `p2p-kids-admin/src/app/discovery/FeaturedListingsPage.tsx`
- `p2p-kids-admin/src/app/discovery/ExperimentsPage.tsx`
- `p2p-kids-admin/src/app/components/DiscoverySettingEditor.tsx`

**UI Rules:**
- All actions must show a confirmation modal and require an admin reason (stored in `admin_discovery_changes`).
- Feature toggles must display current value, last changed by admin and timestamp.
- Disallow editing production-critical weights without a mandatory note and a 'dry run' option.
- **Show Recommendation Score toggle:** Add a dedicated toggle control named **"Show recommendation score"** on the `Discovery Settings` page that updates the `display_recommendation_score` setting via `admin-discovery-set` RPC. Changes must be server-enforced and audited; the toggle should include a short contextual help text explaining that this controls whether score labels (e.g., "Score: 110.0") appear on item cards in the Recommendations carousel and (dev) Search UI.

**Security & Auth:**
- Use existing admin session middleware; pages must be server-side guarded (Next.js server checks role before render).

**Acceptance Criteria:**
- Admins can add/edit discovery settings
- Admins can schedule featured listings (start/end)
- Admin actions create an audit entry

---

### TASK ADMIN-DISCOVERY-003: Edge Functions & Contracts

**Priority:** High — API to power Admin UI and enforce server-side controls.

**Files / Contracts:**
- Supabase RPCs (see ADMIN-DISCOVERY-001)
- Edge Functions: `admin-discovery-get`, `admin-discovery-set`, `admin-discovery-feature`, `admin-discovery-experiments`
- Contract files: `supabase/functions/_shared/contracts/admin-discovery.ts` and mirrored `p2p-kids-admin/src/contracts/admin-discovery.ts`.

**Requirements:**
- Validate admin JWT at entry; use zod schemas for inputs/outputs.
- Return structured errors: { error: { code, message, details? }}.
- Enforce server-side checks for any setting that affects SP redemption/fees.

**Idempotency & Safety:**
- `admin-discovery-set` must be idempotent by key+value.
- For featured-listing actions, require idempotency keys for retries.

**Tests:**
- Unit tests for zod validation and RPC wrapper
- Integration tests that call RPCs with an admin JWT and verify DB state and audit entry

---

### TASK ADMIN-DISCOVERY-004: Boost & Featured Lifecycle

**Priority:** High — coordinate boost purchases (SP) and featured listing lifecycle.

**Description:**
- Admins need to monitor and (rarely) adjust boosts bought by sellers using SP. They must be able to refund or extend boosts and see analytics about their performance (impressions, CTR, conversions).

**Implementation notes:**
- Boost purchases should already be logged as `swap_points_transactions` type `spend_boost` (MODULE-09). Admin operations affecting boosts must create `admin_discovery_changes` audit rows and, when necessary, `admin_activity_log` entries per ADMIN-V2 rules.
- Featured listings (manual pin) must accept `starts_at` and `ends_at` and be surfaced as a scoring bump in discovery RPCs (e.g., +200 score if currently featured)

**Safety:**
- Admin adjustments that refund SP must create ledger entries via canonical SP RPCs and follow invariants (no negative balance, check trial/grace rules).

---

### TASK ADMIN-DISCOVERY-005: A/B Testing & Analytics

**Priority:** Medium — allow experiments and measure outcomes.

**Description:**
- Provide admin capability to run experiments for discovery settings: e.g. test search weight A vs B.
- Experiment metadata stored in `admin_experiments` table with a `target_key` (e.g., 'search_weights'), `variants` JSON, start/end time, and sampling ratio.

**Measurement:**
- Track experiment events: impressions, clicks, transactions (tie to FLOW-06 metrics).
- Expose experiment summary in admin UI (lift, p-values, conversion delta)

**Smoke scripts:**
- `scripts/smoke/discovery-admin.mjs` to seed an experiment and assert outcomes against local telemetry data

---

### TASK ADMIN-DISCOVERY-006: Tests & Verification

**Priority:** High — must include unit/integration/Tiered smoke coverage.

**Verification checklist (deliverable):**
- [ ] Migrations apply cleanly (Block 1 then Block 2)
- [ ] RPCs have zod contracts and contract mirroring script updated
- [ ] Admin UI pages exist and gated by role
- [ ] Actions produce `admin_discovery_changes` audit rows
- [ ] FEATURE: featured listings show in /feed/test endpoint and ranking bump applies
- [ ] **TOGGLE:** `display_recommendation_score` controls visibility of score labels in Recommendations carousel and Search dev mode (verify both enabled and disabled states)
- [ ] BOOST: Refund / extend flows produce ledger adjustments and admin_activity_log entries
- [ ] A/B: Experiments run and experiment metrics appear in admin UI
- [ ] Tier 0 gates: typecheck & lint pass for admin app and functions
- [ ] Tier 1: smoke tests for discovery flows + admin flows
- [ ] Tier 2: DB migration full-run + smoke flow tests (if DB changes included)

---

## AGENT TEMPLATE (How to implement this module)

```text
Agent instructions:
1. Read this file and MODULE-05-DISCOVERY-V2.md, MODULE-12-ADMIN-V2.md, MODULE-09-POINTS-GAMIFICATION-V2.md.
2. Plan: create DB migrations (2 blocks), implement RPCs, add contracts, build admin UI pages, add unit/integration tests, add smoke scripts.
3. Preflight checks: search for existing identifiers (tables, RPC names) to avoid duplicates.
4. Add TODOs in code for any ambiguous UX choices or missing telemetry keys.
5. Run: Typecheck + Lint + Tests (Tier 0). Then run smoke scripts (Tier 1) and full DB rebuild if migrations touched core SP flows (Tier 2).
```

---

## SECURITY & COMPLIANCE NOTES

- Admin-only actions must be validated against users.role = 'admin'. Do not rely on client-side checks.
- Do not log PII in audit rows. Audit rows should reference IDs & sanitized notes.
- Changes that modify SP balances must call canonical SP RPCs and create ledger entries.

---

## ACCEPTANCE CRITERIA

- Admins can safely change discovery settings with audit trail
- Featured listings are honored in recommendations and search results
- Boosts lifecycle is visible and adjustable to admins, with safe SP refunds/enforcement
- Experiments can be created and show quick measurable analytics
- All DB and API changes pass Tier 0/1/2 preflight and smoke tests

---

## APPENDIX: Example RPC Signature (template)

```sql
CREATE OR REPLACE FUNCTION rpc_set_discovery_setting(
  p_key TEXT,
  p_value JSONB,
  p_admin_id UUID
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  -- verify admin
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'not an admin';
  END IF;
  -- upsert and log
  INSERT INTO admin_discovery_settings (key, value)
  VALUES (p_key, p_value)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  INSERT INTO admin_discovery_changes (admin_id, action_type, payload) VALUES (p_admin_id, 'update_setting', jsonb_build_object('key', p_key, 'value', p_value));
END;
$$;
```

---

## NOTES & OPEN QUESTIONS

- QoS: Should some setting changes require a cooldown period or have a 'dry run' option? Add as TODO.
- A/B: Are we using an existing experimentation platform or rolling a lightweight in-house solution?

---

## CHANGE CLASSIFICATION
- Type: Admin UI + DB migrations + RPCs + Tests
- Impacted Flows: FLOW-06 (Discovery), FLOW-18 (Admin Controls), FLOW-11 (SP/Boosts)
- Required Regression Plan: Tier 0 & Tier 1 required; Tier 2 required if we change SP ledger or boost bookkeeping.

---

If you'd like, I can now:
1) create the migration stub files in `supabase/migrations/` and add TODOs,
2) add a small admin UI skeleton under `p2p-kids-admin/src/app/discovery/`, and
3) add smoke script skeleton `scripts/smoke/discovery-admin.mjs`.

Which of these implementation steps should I do next? (You can pick one or ask me to do all.)
