# AGENT-PROMPT-TEMPLATE.md
# Reusable AI Agent Prompt Template — Kids P2P Marketplace
# Covers: Mobile (React Native + Expo) and Admin (Next.js) stories
# Updated: 2026-03-01
# Replace all {{PLACEHOLDERS}} before using

---

## HOW TO USE THIS TEMPLATE

1. Copy the relevant section below (MOBILE TEMPLATE or ADMIN TEMPLATE)
2. Replace all `{{PLACEHOLDER}}` values
3. Paste into GitHub Copilot Chat in VS Code

---

## ⚠️ MANDATORY RULES (Apply to ALL Tasks — Mobile and Admin)

### RULE 1: Tests Are Never Optional
- Tests are mandatory for every change — UI-only, logic, backend, config, or admin
- There is no change too small to test
- You MUST NOT output "Tests: Not run" or "Tests: Not requested" for any reason
- Minimum for a UI-only change: one render test per user state + one automated UI assertion per new visible element

### RULE 2: State Matrix Required Before Conditional UI
- For ANY screen or component that renders differently based on a status/state field,
  produce a state matrix table BEFORE writing any code
- Format:

| State | Element A | Element B | CTA Label |
|-------|-----------|-----------|-----------|
| free  | ✅ show   | ❌ hide   | "Start Trial" |
| trial | ✅ show   | ✅ show   | null |

- Every row must have a corresponding unit test and automated UI assertion
- Show the table and wait for confirmation before implementing

### RULE 3: TC Markdown + Automated UI Test Are Always Delivered Together
- Always deliver the TC `.md` file AND the automated UI test file in the same response
- Mobile: TC `.md` + Maestro `.yaml`
- Admin: TC `.md` + Playwright `.e2e.test.ts`
- You MUST NOT deliver one without the other

### RULE 4: Admin Config Changes Require Mobile Regression Check
- If this task changes any admin-configurable value (price, grace period, feature flag, etc.),
  you MUST check `ADMIN-CONFIG-IMPACT-REGISTRY.md` and list all mobile screens, TC cases,
  and Maestro flows that need to be re-verified
- Include these as explicit steps in the manual verification section

### RULE 5: Strict Maestro Verification (No False Positives)
- Every Maestro flow must be strict by default.
- A flow is NOT strict if it can pass by skipping major steps.
- Do NOT rely on `runFlow: when: ...` for core requirement validation.
- Required for every YAML:
  1. Deterministic precondition steps (`clearKeychain`, `launchApp`, required navigation)
  2. Hard assertions (`assertVisible`) after each major transition
  3. Hard final assertion proving requirement outcome
  4. At least one negative/validation assertion for forms/mutations (where applicable)
- Prefer `testID` selectors. Use text selectors only when `testID` is not available.
- If a flow cannot be made strict due missing selectors, add missing `testID` props first; do not keep weak locators.

---

# ═══════════════════════════════════════
# MOBILE STORY TEMPLATE
# ═══════════════════════════════════════

## TASK {{TASK_ID}}: {{TASK_TITLE}}

I'm working on **{{MODULE_FILE}}** tasks.
Module: `/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/{{MODULE_FILE}}`
Verification: `/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/{{VERIFICATION_FILE}}`
App path: `/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace`

### Scope
{{PASTE_TASK_SCOPE_FROM_MODULE_FILE}}

---

### Step 0 — State Matrix (Required First if Conditional UI)
If this task involves a screen or component with conditional rendering per state,
produce the state matrix now and wait for confirmation before implementing.

---

### Pre-Implementation: Codebase Search
1. Search for existing implementations using feature keywords, table names, function names, UI labels, testIDs
2. Confirm: ✅ Existing found (will extend) OR ❌ New code required
3. Do NOT create parallel implementations — extend or refactor existing code
4. Cross-check with `{{VERIFICATION_FILE}}`

---

### Implementation Rules
- Use **npm** (not yarn)
- All Supabase interactions use the current staging project (not local)
- If SQL needed: stop and ask me before proceeding
- If Edge Function deployment needed: ask me to run `npm run deploy:function <name>`
- Show all created/edited files with full paths
- Update navigation file if new screens added
- Update `flow-registry.md` if new screen/flow added
- iOS Simulator + Android Emulator only — no physical devices

---

### Testing Requirements (All Mandatory)

> ⚠️ RULE 1: Tests required regardless of change size. No exceptions.

#### Unit Tests
- Location: `__tests__/`
- One test per function/hook/service
- One render test per row in state matrix (if conditional UI)
- Mock all Supabase and external dependencies
- Run: `npm run test:unit` → must PASS ✅

#### Integration Tests
- Location: `__tests__/integration/` or `e2e/*.integration.test.ts`
- Run against staging Supabase
- Run: `RUN_SUPABASE_E2E=true npm run test:e2e` → must PASS ✅
- List any required SQL separately and wait for confirmation

#### Maestro UI Flow Tests
> ⚠️ RULE 3: Maestro YAML must be delivered in same response as TC markdown.

- Check `.maestro/` for existing flow — update if exists, create if not
- File: `.maestro/{{flow-name}}.yaml`
- Requirements:
  - `testID` locators on all interactive elements (add missing `testID` props to source)
  - `assertVisible` after each major step
  - `waitForAnimationToEnd` for async loading
  - Cover ALL rows in state matrix — one flow block per state
  - Cover happy path + at least one error state
  - Enforce RULE 5 strictness: deterministic preconditions + hard final assertion
  - No skip-based success (conditional blocks cannot be the only validation path)
  - Comment header: `# FLOW: <name> | TASK: {{TASK_ID}} | States covered: <list>`
- Update `maestro-flows-registry.md`
- Run: `npm run test:maestro:ios` AND `npm run test:maestro:android` → both PASS ✅

---

### Deliverables Checklist
- [ ] State matrix produced and confirmed (if conditional UI)
- [ ] Codebase search complete (reuse vs new confirmed)
- [ ] All created/edited files listed with full paths
- [ ] Unit tests: one per function + one per state matrix row — PASSED
- [ ] Integration tests written and passing
- [ ] Maestro YAML in `.maestro/` covering ALL states
- [ ] Maestro YAML is STRICT (cannot pass by skipping core steps)
- [ ] TC markdown at `docs/manual-verification/{{TASK_ID}}-verification.md`
- [ ] ⚠️ Both TC markdown AND Maestro YAML in this response
- [ ] All new interactive components have `testID` props
- [ ] `maestro-flows-registry.md` updated
- [ ] `flow-registry.md` updated (if new screen/flow)
- [ ] Navigation file updated (if new screen)
- [ ] `{{VERIFICATION_FILE}}` items satisfied — list which ones
- [ ] SQL to run in Supabase listed separately (if any)

---

### Manual Verification (Happy Path Only — target: 5 min)
> Only reach this after ALL automated gates are GREEN.

File: `docs/manual-verification/{{TASK_ID}}-verification.md`

```markdown
# Manual Verification: {{TASK_ID}} — {{TASK_TITLE}}
Platform: iOS Simulator + Android Emulator
Prerequisite: All automated tests passing ✅

## Automated Gates (confirm before opening simulator)
- [ ] npm run test:unit — PASSED
- [ ] RUN_SUPABASE_E2E=true npm run test:e2e — PASSED
- [ ] npm run test:maestro:ios — PASSED
- [ ] npm run test:maestro:android — PASSED
- [ ] CI pipeline green

## Strict Flow Audit (required)
- [ ] Each Maestro flow has deterministic preconditions
- [ ] Each Maestro flow has hard final assertion
- [ ] No flow passes only due conditional `runFlow` skip

## TC-01: Happy Path — iOS
Steps: ...  Expected: ...  Status: ⬜ Pass / ⬜ Fail

## TC-02: Happy Path — Android
Steps: ...  Expected: ...  Status: ⬜ Pass / ⬜ Fail
```

---

# ═══════════════════════════════════════
# ADMIN STORY TEMPLATE
# ═══════════════════════════════════════

## TASK {{TASK_ID}}: {{TASK_TITLE}}

I'm working on **{{MODULE_FILE}}** tasks.
Module: `/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/{{MODULE_FILE}}`
Verification: `/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/{{VERIFICATION_FILE}}`
App path: `/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin`

### Scope
{{PASTE_TASK_SCOPE_FROM_MODULE_FILE}}

---

### Step 0 — State Matrix (Required First if Conditional UI)
Same rule as mobile — produce before implementing any conditional admin UI.

### Step 0b — Admin Config Impact Check (Required if Config Value Changes)
> ⚠️ RULE 4: If this task changes any admin-configurable value:
> 1. Look up the config key in `ADMIN-CONFIG-IMPACT-REGISTRY.md`
> 2. List all affected mobile screens, TC cases, and Maestro flows
> 3. Include them in the manual verification section below
> 4. If the config key is new, add it to `ADMIN-CONFIG-IMPACT-REGISTRY.md`

---

### Pre-Implementation: Codebase Search
Same rules as mobile template — search, confirm reuse vs new, no parallel implementations.

---

### Implementation Rules
- Use **npm** (not yarn)
- All Supabase interactions use the current staging project
- If SQL needed: stop and ask me before proceeding
- Show all created/edited files with full paths
- Add `data-testid` props to all new interactive admin components
- Update admin navigation/routing if new pages added
- Browser: localhost:3000 (headless Chromium via Playwright)

---

### Testing Requirements (All Mandatory)

> ⚠️ RULE 1: Tests required regardless of change size. No exceptions.

#### Unit Tests (Jest)
- Location: `__tests__/` or alongside source files
- Do NOT use vitest imports — use Jest globals only
- One test per function/service/utility
- Run: `npm test` → must PASS ✅

#### Playwright Browser E2E Tests
> ⚠️ RULE 3: Playwright test must be delivered in same response as TC markdown.

- Location: `e2e/{{task-name}}.e2e.test.ts`
- Use `page.getByTestId()` for all locators (add `data-testid` to source if missing)
- Assert on page state after each action
- Use `beforeEach` to log in; `afterEach` to reset any changed config values
- For config-change tests: add comment noting which mobile Maestro flows must be run after
- Run: `npm run test:playwright` → must PASS ✅

#### Mobile Regression (if admin config changed)
- List the Maestro flows to run from `ADMIN-CONFIG-IMPACT-REGISTRY.md`
- These are run manually by developer on mobile simulator after admin changes are verified

---

### Deliverables Checklist
- [ ] State matrix produced (if conditional UI)
- [ ] Admin config impact checked — affected mobile flows listed (if config change)
- [ ] `ADMIN-CONFIG-IMPACT-REGISTRY.md` updated (if new config value)
- [ ] Codebase search complete
- [ ] All created/edited files listed with full paths
- [ ] Unit tests (Jest only, no vitest) written and passing
- [ ] Playwright E2E test written at `e2e/{{task-name}}.e2e.test.ts`
- [ ] TC markdown at `docs/manual-verification/{{TASK_ID}}-verification.md`
- [ ] ⚠️ Both TC markdown AND Playwright test in this response
- [ ] All new interactive admin components have `data-testid` props
- [ ] `{{VERIFICATION_FILE}}` items satisfied — list which ones
- [ ] SQL to run in Supabase listed separately (if any)
- [ ] Mobile Maestro flows to run listed (if config change)

---

### Manual Verification (Happy Path Only — target: 5 min)
> Only reach this after ALL automated gates are GREEN.

File: `docs/manual-verification/{{TASK_ID}}-verification.md`

```markdown
# Manual Verification: {{TASK_ID}} — {{TASK_TITLE}}
Platform: Browser (localhost:3000)
Prerequisite: All automated tests passing ✅

## Automated Gates (confirm before opening browser)
- [ ] npm test — PASSED
- [ ] npm run test:playwright — PASSED
- [ ] CI pipeline green

## TC-01: Happy Path
Steps: ...  Expected: ...  Status: ⬜ Pass / ⬜ Fail

## Mobile Regression (if config changed)
- [ ] Run: npm run test:maestro:ios — for flows: <list from registry>
- [ ] Run: npm run test:maestro:android — for flows: <list from registry>
```

---

## EXAMPLE: Admin Config Story (grace_period_days change)

---

## TASK SUB-ADMIN-005: Update Grace Period Configuration

Module: `MODULE-11-SUBSCRIPTIONS-V2.md`
App path: `/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin`

### Step 0b — Admin Config Impact Check
Config key: `grace_period_days`
Per `ADMIN-CONFIG-IMPACT-REGISTRY.md`:
- Affected mobile screens: KidsClubOverviewScreen, SubscriptionStatusCard
- TC cases to rerun: TC-05, TC-13
- Maestro flows to rerun: `subscription-overview.yaml`

[All other sections follow admin template above]


## Example Samer for Admin task 



## TASK {{TASK_ID}}: ## TASK SUB-011: Admin Subscription Management & Analytics + Grace Period Config

I'm working on  MODULE-11-SUBSCRIPTIONS-V2.md tasks.
Module: MODULE-11-SUBSCRIPTIONS-V2.md in /Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts
Verification: `/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/MODULE-11-VERIFICATION-V2.md`
App path: `/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin`

### Scope

Define minimal admin-facing tooling to monitor and manage Kids Club+, including **grace period configuration management**:

1. **Subscription Monitoring:**
   - View list of current subscribers, trials, grace-period users, and expired users.
   - See key metrics: MRR, active subs, trials started, churn, grace → re-subscribe rate.
   - Perform safe admin actions: manually cancel, extend trial, or re-activate in edge cases.

2. **Grace Period Configuration (NEW):**
   - Manage `grace_period_days`: How many days users have to re-subscribe before SP deletion (default: 90)
   - Manage `grace_reminder_thresholds`: JSON array of day thresholds for reminder notifications (default: [60, 30, 7, 1])
   - Real-time validation and save feedback for admin config changes
   - Clear descriptions of each setting to guide admin behavior

Admin will mostly rely on Stripe Dashboard for billing operations; app admin UI is for **at-a-glance visibility**, grace period config tuning, and controlled overrides.

### Implementation Scope

**Subscription Monitoring (Part A):**
- Read-only list/dashboard of subscriptions by status
- MRR and metrics calculation
- Minimal admin action buttons (if needed)

**Grace Period Configuration (Part B) — For Deferred Implementation:**
- Form fields to update `grace_period_days` and `grace_reminder_thresholds` in admin_config
- Validation and save logic
- Real-time feedback
- See "IMPLEMENTATION NOTE: Grace Period Config Fields" section below for detailed UI spec

---

### Step 0 — State Matrix (Required First if Conditional UI)
Same rule as mobile — produce before implementing any conditional admin UI.

### Step 0b — Admin Config Impact Check (Required if Config Value Changes)
> ⚠️ RULE 4: If this task changes any admin-configurable value:
> 1. Look up the config key in `ADMIN-CONFIG-IMPACT-REGISTRY.md`
> 2. List all affected mobile screens, TC cases, and Maestro flows
> 3. Include them in the manual verification section below
> 4. If the config key is new, add it to `ADMIN-CONFIG-IMPACT-REGISTRY.md`

---

### Pre-Implementation: Codebase Search
Same rules as mobile template — search, confirm reuse vs new, no parallel implementations.

---

### Implementation Rules
- Use **npm** (not yarn)
- All Supabase interactions use the current staging project
- If SQL needed: ask me to run before testing
- Show all created/edited files with full paths
- Add `data-testid` props to all new interactive admin components
- Update admin navigation/routing if new pages added
- Browser: localhost:3000 (headless Chromium via Playwright)

---

### Testing Requirements (All Mandatory)

> ⚠️ RULE 1: Tests required regardless of change size. No exceptions.

#### Unit Tests (Jest)
- Location: `__tests__/` or alongside source files
- Do NOT use vitest imports — use Jest globals only
- One test per function/service/utility
- Run: `npm test` → must PASS ✅

#### Playwright Browser E2E Tests
> ⚠️ RULE 3: Playwright test must be delivered in same response as TC markdown.

- Location: `e2e/{{task-name}}.e2e.test.ts`
- Use `page.getByTestId()` for all locators (add `data-testid` to source if missing)
- Assert on page state after each action
- Use `beforeEach` to log in; `afterEach` to reset any changed config values
- For config-change tests: add comment noting which mobile Maestro flows must be run after
- Run: `npm run test:playwright` → must PASS ✅

#### Mobile Regression (if admin config changed)
- List the Maestro flows to run from `ADMIN-CONFIG-IMPACT-REGISTRY.md`
- These are run manually by developer on mobile simulator after admin changes are verified

---

### Deliverables Checklist
- [ ] State matrix produced (if conditional UI)
- [ ] Admin config impact checked — affected mobile flows listed (if config change)
- [ ] `ADMIN-CONFIG-IMPACT-REGISTRY.md` updated (if new config value)
- [ ] Codebase search complete
- [ ] All created/edited files listed with full paths
- [ ] Unit tests (Jest only, no vitest) written and passing
- [ ] Playwright E2E test written at `e2e/{{task-name}}.e2e.test.ts`
- [ ] TC markdown at `docs/manual-verification/{{TASK_ID}}-verification.md`
- [ ] ⚠️ Both TC markdown AND Playwright test in this response
- [ ] All new interactive admin components have `data-testid` props
- [ ] `{{VERIFICATION_FILE}}` items satisfied — list which ones
- [ ] SQL to run in Supabase listed separately (if any)
- [ ] Mobile Maestro flows to run listed (if config change)

---

### Manual Verification (Happy Path Only — target: 5 min)
> Only reach this after ALL automated gates are GREEN.

File: `docs/manual-verification/{{TASK_ID}}-verification.md`

```markdown
# Manual Verification: {{TASK_ID}} — {{TASK_TITLE}}
Platform: Browser (localhost:3000)
Prerequisite: All automated tests passing ✅

## Automated Gates (confirm before opening browser)
- [ ] npm test — PASSED
- [ ] npm run test:playwright — PASSED
- [ ] CI pipeline green

## TC-01: Happy Path
Steps: ...  Expected: ...  Status: ⬜ Pass / ⬜ Fail

## Mobile Regression (if config changed)
- [ ] Run: npm run test:maestro:ios — for flows: <list from registry>
- [ ] Run: npm run test:maestro:android — for flows: <list from registry>
```
